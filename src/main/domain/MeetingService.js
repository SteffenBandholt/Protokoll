// src/main/domain/MeetingService.js
//
// Domain-Service: Meetings
// - createMeeting: legt Meeting an + übernimmt ggf. TOPs aus letztem geschlossenen Meeting
// - closeMeeting: snapshot + meeting schließen
//
// KEINE UI-Logik
// DB-Zugriffe nur über Repos

const { createAmpelService } = require("./AmpelService");

const TODO_GROUP_FALLBACK = "Ohne Verantwortlich";
const TODO_AMP_HEX = {
  gruen: "#2e7d32",
  orange: "#ef6c00",
  rot: "#c62828",
  blau: "#1565c0",
};

function _extractMeetingId(arg) {
  if (!arg) return null;
  if (typeof arg === "string") return arg;
  if (typeof arg === "object") return arg.meetingId || arg.id || null;
  return null;
}

function _extractPdfShowAmpel(arg) {
  if (!arg || typeof arg !== "object") return undefined;
  if (arg.pdf_show_ampel !== undefined) return arg.pdf_show_ampel;
  if (arg.pdfShowAmpel !== undefined) return arg.pdfShowAmpel;
  return undefined;
}

function _extractNextMeeting(arg) {
  if (!arg || typeof arg !== "object") return null;
  const src = arg.nextMeeting || null;
  if (!src || typeof src !== "object") return null;
  return {
    enabled: src.enabled,
    date: src.date,
    time: src.time,
    place: src.place,
    extra: src.extra,
  };
}

function _isDoneStatus(status) {
  return String(status || "").trim().toLowerCase() === "erledigt";
}

function isMeetingTopTask(top) {
  if (!top || typeof top !== "object") return false;
  const raw = top.is_task !== undefined ? top.is_task : top.isTask;
  return Number(raw) === 1 || raw === true;
}

function isMeetingTopDecision(top) {
  if (!top || typeof top !== "object") return false;
  const raw = top.is_decision !== undefined ? top.is_decision : top.isDecision;
  return Number(raw) === 1 || raw === true;
}

function _parseYmdTs(value) {
  const s = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
  const d = new Date(`${s}T00:00:00`);
  const ts = d.getTime();
  return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
}

function _isOverdueTask(top, todayTs) {
  if (!top) return false;
  if (_isDoneStatus(top.status)) return false;
  const dueTs = _parseYmdTs(top.due_date);
  return Number.isFinite(dueTs) && dueTs < todayTs;
}

function _positionParts(pos) {
  const s = String(pos || "").trim();
  if (!s) return [Number.POSITIVE_INFINITY];
  return s.split(".").map((x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  });
}

function _cmpPosition(a, b) {
  const pa = _positionParts(a);
  const pb = _positionParts(b);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i += 1) {
    const av = pa[i] ?? -1;
    const bv = pb[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function _buildDisplayNumber(byId, topId, memo, stack) {
  if (!topId) return "";
  const key = String(topId);
  if (memo.has(key)) return memo.get(key);
  if (stack.has(key)) return "";

  const node = byId.get(key);
  if (!node) return "";

  stack.add(key);

  const own = node.number === undefined || node.number === null ? "" : String(node.number);
  const parentId = node.parent_top_id || null;
  const out = !parentId ? own : (() => {
    const parentPos = _buildDisplayNumber(byId, parentId, memo, stack);
    return parentPos ? `${parentPos}.${own}` : own;
  })();

  stack.delete(key);
  memo.set(key, out);
  return out;
}

class MeetingService {
  constructor({ meetingsRepo, meetingTopsRepo }) {
    if (!meetingsRepo) throw new Error("MeetingService: meetingsRepo required");
    if (!meetingTopsRepo) throw new Error("MeetingService: meetingTopsRepo required");

    this.meetingsRepo = meetingsRepo;
    this.meetingTopsRepo = meetingTopsRepo;
  }

  _checkNumberGaps(meetingId) {
    const rows = this.meetingTopsRepo.listJoinedByMeeting(meetingId) || [];
    const groups = new Map();

    for (const r of rows) {
      const level = Number(r.level);
      if (!Number.isFinite(level) || level < 1 || level > 4) continue;

      const parentTopId = r.parent_top_id ? String(r.parent_top_id) : null;
      const number = Math.floor(Number(r.number));
      if (!Number.isFinite(number) || number < 1) continue;

      const key = `${level}::${parentTopId ?? "root"}`;
      if (!groups.has(key)) {
        groups.set(key, { level, parentTopId, items: [] });
      }
      groups.get(key).items.push({ id: String(r.id), number });
    }

    const gaps = [];
    const markTopIds = new Set();

    for (const group of groups.values()) {
      if (!group.items.length) continue;

      let lastNumber = 0;
      const numbers = new Set();
      for (const item of group.items) {
        numbers.add(item.number);
        if (item.number > lastNumber) lastNumber = item.number;
      }

      if (lastNumber < 1) continue;

      let missingNumber = null;
      for (let i = 1; i <= lastNumber; i += 1) {
        if (!numbers.has(i)) {
          missingNumber = i;
          break;
        }
      }

      if (missingNumber !== null) {
        let lastTopId = null;
        for (const item of group.items) {
          if (item.number !== lastNumber) continue;
          if (lastTopId === null || String(item.id) > String(lastTopId)) lastTopId = item.id;
        }
        if (lastTopId === null) {
          for (const item of group.items) {
            if (lastTopId === null || String(item.id) > String(lastTopId)) lastTopId = item.id;
          }
        }

        gaps.push({
          level: group.level,
          parentTopId: group.parentTopId,
          missingNumber,
          lastNumber,
          lastTopId,
        });

        if (group.parentTopId !== null) markTopIds.add(group.parentTopId);
        if (lastTopId !== null) markTopIds.add(lastTopId);
      }
    }

    gaps.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      const ap = a.parentTopId ?? "";
      const bp = b.parentTopId ?? "";
      if (ap !== bp) return String(ap) < String(bp) ? -1 : 1;
      return a.missingNumber - b.missingNumber;
    });

    return { gaps, markTopIds: Array.from(markTopIds) };
  }

  createMeeting({ projectId, title }) {
    if (!projectId) throw new Error("projectId required");

    const openMeeting = this.meetingsRepo.getOpenMeetingByProject(projectId);
    if (openMeeting?.id) return openMeeting;

    // 1) Meeting anlegen
    const meeting = this.meetingsRepo.createMeeting({ projectId, title: title || null });

    // 2) Letztes geschlossenes Meeting finden und TOPs übernehmen (schwarz)
    const lastClosed = this.meetingsRepo.getLastClosedMeetingByProject(projectId);
    if (lastClosed && lastClosed.id) {
      // meetingTopsRepo unterstützt beide Signaturen
      this.meetingTopsRepo.carryOverFromMeeting(lastClosed.id, meeting.id);

      // Offene Aufgaben-TOPs: Task-Felder robust übernehmen
      const carryRows = this.meetingTopsRepo.listJoinedByMeeting(lastClosed.id) || [];
      for (const r of carryRows) {
        if (!isMeetingTopTask(r)) continue;
        if (_isDoneStatus(r.status)) continue;
        this.meetingTopsRepo.updateMeetingTop({
          meetingId: meeting.id,
          topId: r.id,
          status: r.status,
          dueDate: r.due_date,
          longtext: r.longtext,
          is_decision: r.is_decision ?? r.isDecision,
          responsible_kind: r.responsible_kind,
          responsible_id: r.responsible_id,
          responsible_label: r.responsible_label,
          contact_kind: r.contact_kind,
          contact_person_id: r.contact_person_id,
          contact_label: r.contact_label,
        });
      }
    }

    return meeting;
  }

  listProjectTasks(projectId, statusFilter) {
    if (!projectId) throw new Error("projectId required");

    const rows = this.meetingTopsRepo.listLatestByProject(projectId) || [];
    let out = rows.filter((r) => isMeetingTopTask(r));
    if (statusFilter === "open") {
      out = out.filter((r) => !_isDoneStatus(r.status));
    } else if (statusFilter === "completed") {
      out = out.filter((r) => _isDoneStatus(r.status));
    }
    const todayTs = _parseYmdTs(new Date().toISOString());
    return out.map((r) => ({
      ...r,
      is_overdue: _isOverdueTask(r, todayTs),
    }));
  }

  listProjectDecisions(projectId) {
    if (!projectId) throw new Error("projectId required");

    const rows = this.meetingTopsRepo.listLatestByProject(projectId) || [];
    return rows.filter((r) => isMeetingTopDecision(r));
  }

  _buildTodoSnapshot(meeting) {
    const meetingId = meeting?.id;
    if (!meetingId) throw new Error("meetingId missing for todo snapshot");

    const rows = this.meetingTopsRepo.listJoinedByMeeting(meetingId) || [];
    const byId = new Map();
    const displayMemo = new Map();
    const ampelMemo = new Map();
    const ampelSvc = createAmpelService();
    const now = new Date();

    for (const r of rows) {
      const node = {
        id: r.id,
        parent_top_id: r.parent_top_id || null,
        number: r.number,
        title: String(r.title || "").trim(),
        status: String(r.status || "").trim(),
        due_date: r.due_date || null,
        responsible_label: String(r.responsible_label || "").trim(),
      };
      byId.set(String(node.id), node);
    }

    const computeAmpelById = (id) => {
      const key = String(id || "");
      if (!key) return null;
      if (ampelMemo.has(key)) return ampelMemo.get(key);

      const node = byId.get(key);
      if (!node) {
        ampelMemo.set(key, null);
        return null;
      }

      const own = ampelSvc.evaluateTop(
        { status: node.status, due_date: node.due_date },
        now
      );
      const color = own?.color || null;
      ampelMemo.set(key, color);
      return color;
    };

    const items = [];
    for (const node of byId.values()) {
      if (_isDoneStatus(node.status)) continue;

      const position = _buildDisplayNumber(byId, node.id, displayMemo, new Set());
      const respLabel = String(node.responsible_label || "").trim();
      const groupLabel = respLabel || TODO_GROUP_FALLBACK;
      const groupSort = respLabel ? respLabel.toLocaleLowerCase("de-DE") : "\uffff";
      const ampelColor = computeAmpelById(node.id);

      items.push({
        top_id: node.id,
        position: position || String(node.number ?? ""),
        short_text: node.title || "(ohne Bezeichnung)",
        status: node.status || "",
        due_date: node.due_date || null,
        responsible_label: respLabel,
        group_label: groupLabel,
        ampel_color: ampelColor || null,
        ampel_hex: ampelColor ? (TODO_AMP_HEX[String(ampelColor)] || null) : null,
        _group_sort: groupSort,
      });
    }

    items.sort((a, b) => {
      if (a._group_sort !== b._group_sort) {
        return a._group_sort < b._group_sort ? -1 : 1;
      }
      const ad = _parseYmdTs(a.due_date);
      const bd = _parseYmdTs(b.due_date);
      if (ad !== bd) return ad - bd;
      return _cmpPosition(a.position, b.position);
    });

    const outItems = items.map((x) => {
      const row = { ...x };
      delete row._group_sort;
      return row;
    });

    return {
      version: 1,
      created_at: new Date().toISOString(),
      meeting_id: meetingId,
      project_id: meeting.project_id || null,
      items: outItems,
    };
  }

  closeMeeting(meetingIdOrObj) {
    const meetingId = _extractMeetingId(meetingIdOrObj);
    if (!meetingId) throw new Error("meetingId required");

    const meeting = this.meetingsRepo.getMeetingById(meetingId);
    const pdfShowAmpel = _extractPdfShowAmpel(meetingIdOrObj);
    const nextMeeting = _extractNextMeeting(meetingIdOrObj);
    if (!meeting) throw new Error("Besprechung nicht gefunden");

    if (Number(meeting.is_closed) === 1) {
      // already closed -> idempotent
      return { changed: 0, meeting };
    }

    const gapCheck = this._checkNumberGaps(meetingId);
    if (gapCheck.gaps.length > 0) {
      return {
        ok: false,
        errorCode: "NUM_GAP",
        error: "Protokoll kann nicht geschlossen werden: Nummernl\u00fccke gefunden.",
        gaps: gapCheck.gaps,
        markTopIds: gapCheck.markTopIds,
      };
    }

    const warnings = [];

    // Snapshot meeting_tops (bestehendes Verhalten)
    try {
      this.meetingTopsRepo.snapshotMeetingTops(meetingId);
    } catch (err) {
      const msg = err?.stack || err?.message || String(err);
      console.error("[MeetingService] snapshotMeetingTops failed", { meetingId, error: msg });
      warnings.push("TOP-Snapshot konnte nicht vollständig gespeichert werden.");
    }

    // Snapshot ToDo-Auswertung als JSON (für spätere PDF bei geschlossenem Meeting)
    let todoSnapshotJson = null;
    try {
      const snap = this._buildTodoSnapshot(meeting);
      todoSnapshotJson = JSON.stringify(snap);
    } catch (err) {
      const msg = err?.stack || err?.message || String(err);
      console.error("[MeetingService] todo snapshot build failed", { meetingId, error: msg });
      warnings.push("ToDo-Snapshot konnte nicht gespeichert werden.");
    }

    // Meeting schließen
    const res = this.meetingsRepo.closeMeeting(meetingId, {
      pdfShowAmpel,
      todoSnapshotJson,
      nextMeeting,
    });
    if (warnings.length) return { ...res, warnings };
    return res;
  }
}

function createMeetingService(deps) {
  return new MeetingService(deps);
}

module.exports = {
  MeetingService,
  createMeetingService,
  isMeetingTopTask,
  isMeetingTopDecision,
};
