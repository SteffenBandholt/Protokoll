// src/main/domain/TopService.js

const { createAmpelService } = require("./AmpelService");

class TopService {
  constructor({ topsRepo, meetingsRepo, meetingTopsRepo }) {
    if (!topsRepo) throw new Error("TopService: topsRepo required");
    if (!meetingsRepo) throw new Error("TopService: meetingsRepo required");
    if (!meetingTopsRepo) throw new Error("TopService: meetingTopsRepo required");

    this.topsRepo = topsRepo;
    this.meetingsRepo = meetingsRepo;
    this.meetingTopsRepo = meetingTopsRepo;
  }

  listByMeeting(meetingId) {
    if (!meetingId) throw new Error("meetingId required");

    const meeting = this.meetingsRepo.getMeetingById(meetingId);
    if (!meeting) throw new Error("Besprechung nicht gefunden");

    const rows = this.meetingTopsRepo.listJoinedByMeeting(meetingId);

    const isOpen = Number(meeting.is_closed) === 0;
    const ampelService = createAmpelService();

    // ---------- Datengrundlage pro Modus ----------
    // Offenes Meeting: live aus tops + meeting_tops
    // Geschlossenes Meeting: Snapshot aus meeting_tops.frozen_*
    const baseById = new Map();

    for (const r of rows) {
      if (isOpen) {
        baseById.set(r.id, {
          id: r.id,
          project_id: r.project_id,
          parent_top_id: r.parent_top_id,
          level: r.level,
          number: r.number,
          title: r.title,
          is_hidden: r.is_hidden,

          // ✅ TOP angelegt am (aus tops.created_at, alias top_created_at)
          top_created_at: r.top_created_at ?? null,

          meeting_id: r.meeting_id,
          status: r.status,
          due_date: r.due_date,
          longtext: r.longtext,
          is_carried_over: r.is_carried_over,
          completed_in_meeting_id: r.completed_in_meeting_id ?? null,

          // Wichtig (pro Meeting)
          is_important: r.is_important ?? 0,

          // ✅ „angefasst“ (nur fürs UI-Farbverhalten)
          is_touched: r.is_touched ?? 0,

          // Task / Decision
          is_task: r.is_task ?? 0,
          is_decision: r.is_decision ?? 0,

          // Verantwortlich (optional, kommt aus meeting_tops)
          responsible_kind: r.responsible_kind ?? null,
          responsible_id: r.responsible_id ?? null,
          responsible_label: r.responsible_label ?? null,
          contact_kind: r.contact_kind ?? null,
          contact_person_id: r.contact_person_id ?? null,
          contact_label: r.contact_label ?? null,

          frozen_at: r.frozen_at,
          frozen_title: r.frozen_title,
          frozen_is_hidden: r.frozen_is_hidden,
          frozen_parent_top_id: r.frozen_parent_top_id,
          frozen_level: r.frozen_level,
          frozen_number: r.frozen_number,
          frozen_display_number: r.frozen_display_number,
          frozen_ampel_color: r.frozen_ampel_color,
          frozen_ampel_reason: r.frozen_ampel_reason,
        });
      } else {
        // ============================================================
        // ✅ FIX: NULL-Snapshotwerte dürfen NICHT "live" Werte überschreiben
        // Vorher: frozen_parent_top_id !== undefined -> nimmt auch NULL -> parent wird NULL
        // Ergebnis: Hierarchie/Nummerierung kollabiert (Unterpunkte nur "1")
        // ============================================================

        const hasFrozenParent =
          r.frozen_parent_top_id !== undefined && r.frozen_parent_top_id !== null;
        const parentId = hasFrozenParent ? r.frozen_parent_top_id : r.parent_top_id;

        const lvl =
          r.frozen_level !== undefined && r.frozen_level !== null ? r.frozen_level : r.level;

        const num =
          r.frozen_number !== undefined && r.frozen_number !== null ? r.frozen_number : r.number;

        const title =
          r.frozen_title !== undefined && r.frozen_title !== null ? r.frozen_title : r.title;

        const isHidden =
          r.frozen_is_hidden !== undefined && r.frozen_is_hidden !== null
            ? r.frozen_is_hidden
            : r.is_hidden;

        baseById.set(r.id, {
          id: r.id,
          project_id: r.project_id,
          parent_top_id: parentId || null,
          level: lvl,
          number: num,
          title: title,
          is_hidden: isHidden,

          // ✅ TOP angelegt am (aus tops.created_at, alias top_created_at)
          top_created_at: r.top_created_at ?? null,

          meeting_id: r.meeting_id,
          status: r.status,
          due_date: r.due_date,
          longtext: r.longtext,
          is_carried_over: r.is_carried_over,

          // Wichtig (pro Meeting) – nicht frozen, aber Meeting ist ohnehin read-only
          is_important: r.is_important ?? 0,

          // ✅ „angefasst“ (für Anzeige, auch wenn Meeting read-only)
          is_touched: r.is_touched ?? 0,

          // Task / Decision
          is_task: r.is_task ?? 0,
          is_decision: r.is_decision ?? 0,

          // Verantwortlich (optional, nicht „frozen“, aber soll angezeigt werden)
          responsible_kind: r.responsible_kind ?? null,
          responsible_id: r.responsible_id ?? null,
          responsible_label: r.responsible_label ?? null,
          contact_kind: r.contact_kind ?? null,
          contact_person_id: r.contact_person_id ?? null,
          contact_label: r.contact_label ?? null,

          frozen_at: r.frozen_at,
          frozen_title: r.frozen_title,
          frozen_is_hidden: r.frozen_is_hidden,
          frozen_parent_top_id: r.frozen_parent_top_id,
          frozen_level: r.frozen_level,
          frozen_number: r.frozen_number,
          frozen_display_number: r.frozen_display_number,
          frozen_ampel_color: r.frozen_ampel_color,
          frozen_ampel_reason: r.frozen_ampel_reason,
        });
      }
    }

    const items = Array.from(baseById.values());

    // ---------- Nummernanzeige (DisplayNumber) ----------
    const cache = new Map();

    const isHierString = (v) => {
      if (v === null || v === undefined) return false;
      const s = String(v).trim();
      if (!s) return false;
      return /^\d+(\.\d+)*$/.test(s);
    };

    // ✅ "1" ist nur ok, wenn Level-1/ohne Parent
    const isGoodHierForNode = (node, v) => {
      if (!isHierString(v)) return false;
      const s = String(v).trim();
      const hasParent = !!node.parent_top_id;
      const lvl = Number(node.level) || 1;
      if (hasParent || lvl > 1) return s.includes(".");
      return true;
    };

    const buildDisplay = (top) => {
      if (!top) return "";

      // ✅ frozen_display_number nur akzeptieren, wenn es zur Ebene passt
      if (!isOpen && top.frozen_display_number && isGoodHierForNode(top, top.frozen_display_number)) {
        return String(top.frozen_display_number);
      }

      if (cache.has(top.id)) return cache.get(top.id);

      const own = String(top.number);
      if (!top.parent_top_id) {
        cache.set(top.id, own);
        return own;
      }

      const parent = baseById.get(top.parent_top_id);
      const val = parent ? `${buildDisplay(parent)}.${own}` : own;
      cache.set(top.id, val);
      return val;
    };

    // ---------- Ampel ----------
    const nowForOpen = new Date();
    const closeTime = meeting.updated_at ? new Date(meeting.updated_at) : new Date();

    const ampelCache = new Map();
    const computeAmpelForId = (id) => {
      if (ampelCache.has(id)) return ampelCache.get(id);

      const t = baseById.get(id);
      if (!t) {
        const v = { color: null, reason: "TOP nicht gefunden" };
        ampelCache.set(id, v);
        return v;
      }

      if (!isOpen && t.frozen_ampel_color !== undefined && t.frozen_ampel_color !== null) {
        const v = { color: t.frozen_ampel_color, reason: t.frozen_ampel_reason || "" };
        ampelCache.set(id, v);
        return v;
      }

      const own = ampelService.evaluateTop(
        { status: t.status, due_date: t.due_date },
        isOpen ? nowForOpen : closeTime
      );
      ampelCache.set(id, own);
      return own;
    };

    const withDisplay = items.map((t) => {
      const a = computeAmpelForId(t.id);

      return {
        ...t,
        displayNumber: buildDisplay(t),

        ampelColor: a.color,
        ampelReason: a.reason,
      };
    });

    withDisplay.sort((a, b) => {
      const as = String(a.displayNumber).split(".").map((x) => Number(x));
      const bs = String(b.displayNumber).split(".").map((x) => Number(x));
      const n = Math.max(as.length, bs.length);

      for (let i = 0; i < n; i++) {
        const av = as[i] ?? -1;
        const bv = bs[i] ?? -1;
        if (av !== bv) return av - bv;
      }
      return 0;
    });

    return withDisplay;
  }

  createTop(input) {
    if (!input) throw new Error("input required");

    const { projectId, meetingId, parentTopId, level, title } = input;

    if (!projectId) throw new Error("projectId required");
    if (!meetingId) throw new Error("meetingId required");
    if (!level) throw new Error("level required");

    const meeting = this.meetingsRepo.getMeetingById(meetingId);
    if (!meeting) throw new Error("Besprechung nicht gefunden");
    if (Number(meeting.is_closed) === 1) {
      throw new Error("Besprechung ist geschlossen – TOP darf nicht angelegt werden");
    }

    const number = this.topsRepo.getNextNumber(projectId, parentTopId || null);

    const created = this.topsRepo.createTop({
      projectId,
      parentTopId: parentTopId || null,
      level,
      number,
      title,
    });

    const todayIso = new Date().toISOString().slice(0, 10);
    this.meetingTopsRepo.attachTopToMeeting({
      meetingId,
      topId: created.id,
      status: "offen",
      dueDate: todayIso,
      longtext: null,
      isCarriedOver: false,
    });

    return created;
  }

  moveTop({ topId, targetParentId }) {
    if (!topId) throw new Error("topId required");

    const top = this.topsRepo.getTopById(topId);
    if (!top) throw new Error("TOP nicht gefunden");

    const openMeeting = this.meetingsRepo.getOpenMeetingByProject(top.project_id);
    if (!openMeeting) {
      throw new Error("Kein offenes Meeting – Verschieben nicht erlaubt");
    }

    const mt = this.meetingTopsRepo.getMeetingTop(openMeeting.id, topId);
    if (!mt) {
      throw new Error("TOP ist nicht Teil der offenen Besprechung – Verschieben nicht erlaubt");
    }

    if (Number(mt.is_carried_over) === 1) {
      throw new Error("Alter TOP (übernommen) – Verschieben nicht erlaubt");
    }

    if (targetParentId && String(targetParentId) === String(topId)) {
      throw new Error("TOP kann nicht unter sich selbst verschoben werden");
    }

    let newLevel = Number(top.level);

    if (targetParentId) {
      const targetParent = this.topsRepo.getTopById(targetParentId);
      if (!targetParent) throw new Error("Ziel-Parent nicht gefunden");
      if (targetParent.project_id !== top.project_id) {
        throw new Error("Ziel-Parent gehört zu einem anderen Projekt");
      }

      const parentLevel = Number(targetParent.level);
      if (Number.isNaN(parentLevel) || parentLevel < 1 || parentLevel > 4) {
        throw new Error("Ziel-Parent hat ein ungültiges Level");
      }
      if (parentLevel === 4) {
        throw new Error("Unter einen Level-4-TOP kann nicht geschoben werden (max Level 4)");
      }

      // Zyklus-Check
      let cur = targetParent;
      let guard = 0;
      while (cur && guard < 100) {
        if (String(cur.id) === String(topId)) {
          throw new Error("Ziel-Parent liegt im eigenen Stammbaum – Zyklus nicht erlaubt");
        }
        if (!cur.parent_top_id) break;
        cur = this.topsRepo.getTopById(cur.parent_top_id);
        guard++;
      }

      newLevel = parentLevel + 1;
      if (newLevel > 4) {
        throw new Error("Maximale TOP-Tiefe ist Level 4");
      }
    } else {
      if (Number(top.level) !== 1) {
        throw new Error("Nur Level-1-TOPs dürfen Root sein");
      }
      newLevel = 1;
    }

    const newNumber = this.topsRepo.getNextNumber(top.project_id, targetParentId || null);

    return this.topsRepo.moveTop({
      topId,
      targetParentId: targetParentId || null,
      newLevel,
      newNumber,
    });
  }

  deleteTop({ meetingId, topId }) {
    if (!meetingId) throw new Error("meetingId required");
    if (!topId) throw new Error("topId required");

    const meeting = this.meetingsRepo.getMeetingById(meetingId);
    if (!meeting) throw new Error("Besprechung nicht gefunden");
    if (Number(meeting.is_closed) === 1) {
      throw new Error("Besprechung ist geschlossen – Löschen nicht erlaubt");
    }

    const mt = this.meetingTopsRepo.getMeetingTop(meetingId, topId);
    if (!mt) throw new Error("TOP ist nicht Teil dieser Besprechung");
    if (Number(mt.is_carried_over) === 1) {
      throw new Error("Alter TOP (übernommen) – Löschen nicht erlaubt");
    }

    const top = this.topsRepo.getTopById(topId);
    if (!top) throw new Error("TOP nicht gefunden");
    if (String(top.project_id) !== String(meeting.project_id)) {
      throw new Error("TOP gehört nicht zu dieser Besprechung");
    }

    if (this.topsRepo.hasChildren(topId)) {
      throw new Error("Löschen nicht erlaubt: TOP hat Unterpunkte (Kinder)");
    }

    this.topsRepo.softDeleteTop({ topId });

    if (typeof this.meetingTopsRepo.deleteByTopId === "function") {
      this.meetingTopsRepo.deleteByTopId(topId);
    }

    return { topId };
  }

  updateMeetingFields({ meetingId, topId, patch }) {
    if (!meetingId) throw new Error("meetingId required");
    if (!topId) throw new Error("topId required");
    if (!patch) throw new Error("patch required");

    const meeting = this.meetingsRepo.getMeetingById(meetingId);
    if (!meeting) throw new Error("Besprechung nicht gefunden");
    if (Number(meeting.is_closed) === 1) {
      throw new Error("Besprechung ist geschlossen – Änderungen nicht erlaubt");
    }

    if (patch && typeof patch === "object" && patch.completed_in_meeting && patch.completed_in_meeting.id) {
      patch.completed_in_meeting_id = patch.completed_in_meeting.id;
      delete patch.completed_in_meeting;
    }

    const existingMt = this.meetingTopsRepo.getMeetingTop(meetingId, topId);
    if (!existingMt) throw new Error("TOP ist nicht Teil dieser Besprechung");

    const top = this.topsRepo.getTopById(topId);
    if (!top) throw new Error("TOP nicht gefunden");

    const allowedKeys = new Set([
      "status",
      "dueDate",
      "due_date",
      "longtext",
      "title",
      "is_hidden",

      "completed_in_meeting_id",
      "completedInMeetingId",

      "is_important",
      "isImportant",

      "is_task",
      "isTask",
      "is_decision",
      "isDecision",

      "responsible_kind",
      "responsible_id",
      "responsible_label",
      "responsibleKind",
      "responsibleId",
      "responsibleLabel",
    ]);

    for (const k of Object.keys(patch)) {
      if (!allowedKeys.has(k)) {
        throw new Error(`Feld nicht erlaubt: ${k}`);
      }
    }

    if (patch.title !== undefined) {
      if (Number(existingMt.is_carried_over) === 1) {
        throw new Error("Alter TOP (übernommen) – Titel ist gesperrt");
      }
      this.topsRepo.updateTitle({ topId, title: patch.title });
    }

    if (patch.is_hidden !== undefined) {
      this.topsRepo.setHidden({ topId, isHidden: !!patch.is_hidden });
    }

    const rk =
      patch.responsible_kind !== undefined
        ? patch.responsible_kind
        : (patch.responsibleKind !== undefined ? patch.responsibleKind : undefined);

    const ri =
      patch.responsible_id !== undefined
        ? patch.responsible_id
        : (patch.responsibleId !== undefined ? patch.responsibleId : undefined);

    const rl =
      patch.responsible_label !== undefined
        ? patch.responsible_label
        : (patch.responsibleLabel !== undefined ? patch.responsibleLabel : undefined);

    const ck = undefined;
    const cp = undefined;
    const cl = undefined;

    const imp =
      patch.is_important !== undefined
        ? patch.is_important
        : (patch.isImportant !== undefined ? patch.isImportant : undefined);

    const isTask =
      patch.is_task !== undefined
        ? patch.is_task
        : (patch.isTask !== undefined ? patch.isTask : undefined);

    const isDecision =
      patch.is_decision !== undefined
        ? patch.is_decision
        : (patch.isDecision !== undefined ? patch.isDecision : undefined);

    const completedIn =
      patch.completed_in_meeting_id !== undefined
        ? patch.completed_in_meeting_id
        : (patch.completedInMeetingId !== undefined ? patch.completedInMeetingId : undefined);

    const meetingFieldsTouched =
      patch.status !== undefined ||
      patch.dueDate !== undefined ||
      patch.due_date !== undefined ||
      patch.longtext !== undefined ||
      completedIn !== undefined ||
      imp !== undefined ||
      isTask !== undefined ||
      isDecision !== undefined ||
      rk !== undefined ||
      ri !== undefined ||
      rl !== undefined;

    if (!meetingFieldsTouched) {
      return this.meetingTopsRepo.getMeetingTop(meetingId, topId);
    }

    const status = patch.status !== undefined ? patch.status : existingMt.status;

    let dueDate =
      patch.dueDate !== undefined
        ? patch.dueDate
        : (patch.due_date !== undefined ? patch.due_date : existingMt.due_date);

    let longtext = patch.longtext !== undefined ? patch.longtext : existingMt.longtext;

    // ✅ Blau machen NUR, wenn ein übernommener TOP im Langtext geändert wurde
    let touch = undefined;
    const longProvided = Object.prototype.hasOwnProperty.call(patch, "longtext");
    if (longProvided && Number(existingMt.is_carried_over) === 1) {
      const prev =
        existingMt.longtext === null || existingMt.longtext === undefined ? null : String(existingMt.longtext);
      const nextRaw =
        patch.longtext === null || patch.longtext === undefined ? null : String(patch.longtext);
      const isChanged = prev !== nextRaw;
      if (isChanged) {
        touch = 1;
        const d = new Date();
        const stamp = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1)
          .padStart(2, "0")}.${d.getFullYear()}`;
        const marker = `(Text geändert ${stamp})`;
        const base = nextRaw || "";
        if (!base.includes(marker)) {
          const sep = base && !base.endsWith("\n") ? "\n" : "";
          longtext = `${base}${sep}${marker}`;
        } else {
          longtext = base;
        }
      }
    }

    const statusNorm = String(status || "").trim().toLowerCase();
    if (statusNorm === "erledigt") {
      dueDate = new Date().toISOString().slice(0, 10);
    }

    return this.meetingTopsRepo.updateMeetingTop({
      meetingId,
      topId,
      status,
      dueDate,
      longtext,
      completed_in_meeting_id: completedIn,

      is_important: imp,
      is_task: isTask,
      is_decision: isDecision,

      responsible_kind: rk,
      responsible_id: ri,
      responsible_label: rl,

      is_touched: touch,
    });
  }
}

function createTopService(deps) {
  return new TopService(deps);
}

module.exports = {
  TopService,
  createTopService,
};
