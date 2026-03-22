// src/renderer/ui/ParticipantsModals.js
//
// Blockierende Modals:
// - Kandidaten (Projekt)  => openCandidates({ projectId })
// - Teilnehmer (Meeting)  => openParticipants({ projectId, meetingId })

import { applyPopupButtonStyle } from "./popupButtonStyles.js";
import { createPopupOverlay, stylePopupCard, registerPopupCloseHandlers } from "./popupCommon.js";

const PARTICIPANTS_EMPTY_HINT_STYLE_ID = "bbm-participants-empty-hint-style";
function _ensureParticipantsEmptyHintStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(PARTICIPANTS_EMPTY_HINT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PARTICIPANTS_EMPTY_HINT_STYLE_ID;
  style.textContent = `
.list-empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 700;
  color: #ff8a00;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  user-select: none;
}
`;
  document.head?.appendChild(style);
}
//
// UX / Regeln:
// - Dual-List, flach: Name, Rolle, Firma
// - Auswahl/Abwahl per Doppelklick (keine Hinzufügen/Entfernen Buttons)
// - App-Font wie Rest (system-ui, im Zweifel Calibri)
// - Kandidaten entfernen ist BLOCKIERT, wenn Person Teilnehmer in irgendeiner OFFENEN Besprechung des Projekts ist
// - Teilnehmer: beim Hinzufügen sind "Anwesend" und "Im Verteiler" standardmäßig ANGEHAKT (1/1)
// - Meeting geschlossen => Modal read-only (Toggles disabled, Save disabled)
//
// WICHTIG: IPC/Preload kann je nach Stand entweder Objekt-Payload ODER String erwarten.
// Daher wird bei kritischen Calls "compat" genutzt: erst {projectId}, dann fallback projectId.

export default class ParticipantsModals {
  constructor({ router } = {}) {
    this.router = router || null;

    this.overlayEl = null;
    this.modalEl = null;
    this.titleEl = null;
    this.errEl = null;
    this.bodyEl = null;
    this.footerEl = null;

    this.isOpen = false;
    this.isSaving = false;
    this.readOnly = false;

    this.mode = null; // "candidates" | "participants"
    this.projectId = null;
    this.meetingId = null;

    this.pool = [];
    this.candidates = []; // left in candidates modal
    this.projectCandidates = []; // right in participants modal
    this.participants = []; // left in participants modal
    this.distributionHintKeys = new Set();

    this.searchLeft = "";
    this.searchRight = "";

    // key => [meeting_index,...] (offene Meetings)
    this.openParticipantRefs = new Map();
    this.isNewUi = this._readUiMode() === "new";

    this._ensureDom();

    this._poolDataChangedHandler = (event) => {
      this._handlePoolDataChanged(event).catch(() => {});
    };
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("bbm:pool-data-changed", this._poolDataChangedHandler);
    }
  }

  _readUiMode() {
    try {
      const raw = String(window.localStorage?.getItem?.("bbm.uiMode") || "").trim().toLowerCase();
      return raw === "new" ? "new" : "old";
    } catch (_e) {
      return "old";
    }
  }

  _parseActiveFlag(value) {
    if (value === undefined || value === null || value === "") return 1;
    if (typeof value === "boolean") return value ? 1 : 0;
    const n = Number(value);
    if (Number.isFinite(n)) return n === 0 ? 0 : 1;
    const s = String(value).trim().toLowerCase();
    if (["0", "false", "off", "nein", "inactive"].includes(s)) return 0;
    return 1;
  }

  _personEmail(person) {
    return String(person?.email ?? person?.email_raw ?? "").trim();
  }

  _hasPersonEmail(person) {
    return this._personEmail(person) !== "";
  }

  _requestSetupStatusRefresh() {
    if (!this.isNewUi) return;
    const router = this.router || null;
    if (typeof router?.requestSetupStatusRefresh === "function") {
      router.requestSetupStatusRefresh();
      return;
    }
    router?.refreshHeader?.();
  }

  _requestCurrentViewLayoutRefresh() {
    const view = this.router?.currentView || null;
    if (!view) return;
    try {
      if (typeof view._syncPinnedBars === "function") view._syncPinnedBars();
      if (typeof view._updateListTopPadding === "function") view._updateListTopPadding();
      if (typeof view._syncPinnedPositions === "function") view._syncPinnedPositions();
    } catch (_e) {
      // ignore
    }
  }

  _syncRouterMeetingContext() {
    const router = this.router || null;
    if (!router) return;
    const meetingId = this.meetingId || null;
    if (String(router.currentMeetingId || "") === String(meetingId || "")) return;
    router.currentMeetingId = meetingId;
    if (typeof router._emitContextChange === "function") router._emitContextChange();
    if (typeof router._refreshHeaderSafe === "function") {
      router._refreshHeaderSafe();
      return;
    }
    router?.refreshHeader?.();
  }

  _rerenderCurrentModal() {
    if (!this.isOpen) return;
    if (this.mode === "candidates") {
      this._renderCandidatesModal();
      return;
    }
    if (this.mode === "participants") {
      this._renderParticipantsModal();
    }
  }

  async _handlePoolDataChanged(event) {
    if (!this.isOpen || this.isSaving) return;
    const changedProjectId = event?.detail?.projectId ?? null;
    if (changedProjectId && String(changedProjectId) !== String(this.projectId || "")) return;

    if (this.mode === "candidates") {
      await this._loadCandidatesData();
      this._renderCandidatesModal();
      return;
    }

    if (this.mode === "participants") {
      await this._loadParticipantsData();
      this._renderParticipantsModal();
    }
  }

  // ============================================================
  // Public API expected by Router
  // ============================================================
  async openCandidates({ projectId } = {}) {
    this._ensureDom();
    this.mode = "candidates";
    this.projectId = projectId || null;
    this.meetingId = null;

    if (!this.projectId) {
      alert("Projekt-Kontext fehlt.");
      return;
    }

    this.isOpen = true;
    this.isSaving = false;
    this.readOnly = false;
    this.searchLeft = "";
    this.searchRight = "";
    this._setError("");

    this.overlayEl.style.display = "flex";
    try {
      this.overlayEl.focus();
    } catch (_e) {
      // ignore
    }
    this.titleEl.textContent = "Personalpool";

    await this._loadCandidatesData();
    this._renderCandidatesModal();
  }

  async openParticipants({ projectId, meetingId } = {}) {
    this._ensureDom();
    this.mode = "participants";
    this.projectId = projectId || null;
    this.meetingId = meetingId || null;

    if (!this.projectId) {
      alert("Projekt-Kontext fehlt.");
      return;
    }
    if (!this.meetingId) {
      alert("Meeting-Kontext fehlt.");
      return;
    }

    this.isOpen = true;
    this.isSaving = false;
    this.searchLeft = "";
    this.searchRight = "";
    this.distributionHintKeys = new Set();
    this._setError("");

    this.overlayEl.style.display = "flex";
    try {
      this.overlayEl.focus();
    } catch (_e) {
      // ignore
    }
    this.titleEl.textContent = "Teilnehmer";

    await this._ensureOpenMeetingContext();
    this._syncRouterMeetingContext();
    this.readOnly = false;
    await this._loadParticipantsData();
    this._renderParticipantsModal();
  }

  close() {
    this.isOpen = false;
    this.isSaving = false;
    this.readOnly = false;

    this.mode = null;
    this.projectId = null;
    this.meetingId = null;

    this.pool = [];
    this.candidates = [];
    this.projectCandidates = [];
    this.participants = [];

    this.searchLeft = "";
    this.searchRight = "";
    this.openParticipantRefs = new Map();
    this.distributionHintKeys = new Set();

    this._setError("");

    if (this.overlayEl) this.overlayEl.style.display = "none";
    if (this.bodyEl) this.bodyEl.innerHTML = "";
    if (this.footerEl) this.footerEl.innerHTML = "";

    // Nach Modal-Close die fixe Tops-Buttonbar neu einmessen.
    this._requestCurrentViewLayoutRefresh();
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => this._requestCurrentViewLayoutRefresh());
    }
  }

  // ============================================================
  // DOM
  // ============================================================
  _ensureDom() {
    if (this.overlayEl) return;

    const overlay = createPopupOverlay({ background: "rgba(0,0,0,0.35)" });
    registerPopupCloseHandlers(overlay, () => this.close());

    const modal = document.createElement("div");
    stylePopupCard(modal, { width: "min(980px, calc(100vw - 24px))" });
    modal.style.padding = "0";
    modal.style.fontFamily = 'Calibri, Arial, sans-serif';

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.justifyContent = "space-between";
    head.style.gap = "10px";
    head.style.padding = "12px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.style.fontWeight = "bold";
    title.textContent = "€”";

    const btnClose = document.createElement("button");
    btnClose.textContent = "œ•";
    applyPopupButtonStyle(btnClose);
    btnClose.onclick = () => this.close();

    head.append(title, btnClose);

    const err = document.createElement("div");
    err.style.color = "#c62828";
    err.style.fontSize = "12px";
    err.style.marginBottom = "8px";
    err.style.display = "none";

    const bodyWrap = document.createElement("div");
    bodyWrap.style.flex = "1 1 auto";
    bodyWrap.style.minHeight = "0";
    bodyWrap.style.overflow = "auto";
    bodyWrap.style.padding = "12px";

    const body = document.createElement("div");
    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.borderTop = "1px solid #e2e8f0";
    footer.style.padding = "10px 12px";

    bodyWrap.append(err, body);
    modal.append(head, bodyWrap, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.overlayEl = overlay;
    this.modalEl = modal;
    this.titleEl = title;
    this.errEl = err;
    this.bodyEl = body;
    this.footerEl = footer;
  }

  _setError(text) {
    const t = (text || "").toString().trim();
    if (!this.errEl) return;
    if (!t) {
      this.errEl.style.display = "none";
      this.errEl.textContent = "";
    } else {
      this.errEl.style.display = "block";
      this.errEl.textContent = t;
    }
  }

  _mkListCol(titleText) {
    const col = document.createElement("div");
    col.style.display = "flex";
    col.style.flexDirection = "column";
    col.style.gap = "8px";

    const t = document.createElement("div");
    t.textContent = titleText;
    t.style.fontWeight = "bold";

    const list = document.createElement("div");
    list.style.border = "1px solid #ddd";
    list.style.borderRadius = "8px";
    list.style.padding = "6px";
    list.style.height = "420px";
    list.style.overflow = "auto";
    list.style.background = "#fafafa";

    col.append(t, list);
    return { col, list };
  }

  // ============================================================
  // Response helpers (list/items/rows)
  // ============================================================
  _hasArray(res) {
    return (
      Array.isArray(res?.list) ||
      Array.isArray(res?.items) ||
      Array.isArray(res?.rows)
    );
  }

  _pickArray(res) {
    if (Array.isArray(res?.list)) return res.list;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.rows)) return res.rows;
    return [];
  }

  // ============================================================
  // Data helpers
  // ============================================================
  _key(kind, personId) {
    return `${kind}:${personId}`;
  }

  _normKind(x) {
    return (x?.kind || "").toString().trim();
  }

  _isInternalPerson(x) {
    return this._normKind(x) === "project_person";
  }

  _normPersonId(x) {
    return x?.personId ?? x?.person_id ?? x?.id ?? null;
  }

  _labelRow(p) {
    const name = (p.name || "").toString().trim() || "?";
    const rolle = (p.rolle || "").toString().trim();
    const firm = (
      p.firm ??
      p.firm_raw ??
      p.firm_name ??
      p.firmName ??
      p.company ??
      p.company_name ??
      ""
    ).toString().trim();
    return { name, rolle, firm };
  }

  _sortPersons(list) {
    const arr = [...(list || [])];
    arr.sort((a, b) => {
      const fa = (a.firm || a.firm_name || a.firmName || "").toString().toLowerCase();
      const fb = (b.firm || b.firm_name || b.firmName || "").toString().toLowerCase();
      if (fa < fb) return -1;
      if (fa > fb) return 1;

      const na = (a.name || "").toString().toLowerCase();
      const nb = (b.name || "").toString().toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });
    return arr;
  }

  _renderEmpty(container, text = "Keine Einträge") {
    _ensureParticipantsEmptyHintStyle();
    const empty = document.createElement("div");
    empty.className = "list-empty-hint";
    empty.textContent = text;
    container.appendChild(empty);
  }

  _renderRow({
    container,
    person,
    onDblClick,
    extraRight,
    isDisabled,
    badgeText,
    roleInline = false,
    firmBelowName = false,
    hideFirmRight = false,
    rightWidth = null,
    dividerOffsetMm = 0,
    flushLeftToDivider = false,
    leftHintText = "",
  }) {
    const row = document.createElement("div");
    row.style.padding = "8px";
    row.style.borderRadius = "8px";
    const canClick = !this.readOnly && !this.isSaving && !isDisabled;
    row.style.cursor = canClick ? "pointer" : "default";
    row.style.userSelect = "none";
    row.style.border = "1px solid rgba(0,0,0,0.08)";
    row.style.marginBottom = "6px";
    row.style.opacity = isDisabled ? "0.55" : "1";
    const isGlobalPoolPerson = this.mode === "candidates" && String(person?.kind || "") === "global_person";
    row.style.background = isGlobalPoolPerson ? "#fff3e6" : "#fff";

    row.ondblclick = () => {
      if (!canClick) return;
      if (typeof onDblClick === "function") onDblClick();
    };

    const head = document.createElement("div");
    head.style.display = "grid";
    head.style.gridTemplateColumns = rightWidth
      ? `minmax(0, 1fr) ${rightWidth}`
      : "minmax(0, 1fr) minmax(210px, 42%)";
    head.style.alignItems = "stretch";
    head.style.columnGap = "0";

    const left = document.createElement("div");
    left.style.flex = "1";
    left.style.minWidth = "0";
    left.style.paddingRight = flushLeftToDivider ? "0" : "8px";

    const { name, rolle, firm } = this._labelRow(person);

    const line1 = document.createElement("div");
    line1.style.display = "flex";
    line1.style.alignItems = "center";
    line1.style.gap = "8px";
    line1.style.width = "100%";

    const t1 = document.createElement("div");
    t1.textContent = name;
    t1.style.fontWeight = "bold";
    t1.style.minWidth = "0";
    t1.style.flex = "1 1 auto";
    t1.style.whiteSpace = "nowrap";
    t1.style.overflow = "hidden";
    t1.style.textOverflow = "ellipsis";

    line1.append(t1);
    if (leftHintText) {
      const leftHint = document.createElement("span");
      leftHint.textContent = leftHintText;
      leftHint.style.fontSize = "11px";
      leftHint.style.fontWeight = "700";
      leftHint.style.color = "#b42318";
      leftHint.style.whiteSpace = "nowrap";
      leftHint.style.flexShrink = "0";
      line1.append(leftHint);
      row.title = row.title ? `${row.title} | ${leftHintText}` : leftHintText;
    }
    if (roleInline && rolle) {
      const roleInlineEl = document.createElement("div");
      roleInlineEl.textContent = rolle;
      roleInlineEl.style.fontSize = "12px";
      roleInlineEl.style.opacity = "0.8";
      roleInlineEl.style.whiteSpace = "nowrap";
      roleInlineEl.style.overflow = "hidden";
      roleInlineEl.style.textOverflow = "ellipsis";
      roleInlineEl.style.maxWidth = "45%";
      line1.append(roleInlineEl);
    }

    const t2 = document.createElement("div");
    t2.textContent = firmBelowName ? (firm || "") : (rolle || "");
    t2.style.fontSize = "12px";
    t2.style.opacity = "0.8";

    left.append(line1, t2);
    head.append(left);

    const rightWrap = document.createElement("div");
    rightWrap.style.display = "flex";
    rightWrap.style.alignItems = "center";
    rightWrap.style.justifyContent = "flex-end";
    rightWrap.style.gap = "6px";
    rightWrap.style.flexShrink = "0";
    rightWrap.style.position = "relative";
    if (Number(dividerOffsetMm) > 0) {
      const divider = document.createElement("div");
      divider.style.position = "absolute";
      divider.style.left = `${Number(dividerOffsetMm)}mm`;
      divider.style.top = "0";
      divider.style.bottom = "0";
      divider.style.width = "1px";
      divider.style.background = "#8fa1b3";
      rightWrap.append(divider);
      rightWrap.style.paddingLeft = `calc(8px + ${Number(dividerOffsetMm)}mm)`;
    } else {
      rightWrap.style.borderLeft = "1px solid #8fa1b3";
      rightWrap.style.paddingLeft = "8px";
    }
    rightWrap.style.minWidth = "0";

    if (!hideFirmRight) {
      const firmEl = document.createElement("div");
      firmEl.textContent = firm || "";
      firmEl.style.fontWeight = "bold";
      firmEl.style.textAlign = "right";
      firmEl.style.whiteSpace = "nowrap";
      firmEl.style.maxWidth = "160px";
      firmEl.style.overflow = "hidden";
      firmEl.style.textOverflow = "ellipsis";
      rightWrap.append(firmEl);
    }

    if (extraRight) rightWrap.append(extraRight);
    if (badgeText) {
      const badge = document.createElement("span");
      badge.textContent = badgeText;
      badge.style.fontSize = "11px";
      badge.style.padding = "2px 6px";
      badge.style.borderRadius = "999px";
      badge.style.background = "#ffe3b3";
      badge.style.color = "#7a4a00";
      rightWrap.append(badge);
      row.title = badgeText;
    }
    head.append(rightWrap);

    row.append(head);
    container.appendChild(row);
  }

  // ============================================================
  // IPC compat helpers (Objekt vs. String)
  // ============================================================
  async _invokeCompatList(fn, objArg, strArg) {
    // Ziel: erst Objekt versuchen. Fallback NUR bei Fehler oder wenn Response "komisch" ist.
    try {
      const r1 = await fn(objArg);
      if (r1?.ok && this._hasArray(r1)) return r1;

      // wenn ok aber ohne list/items/rows -> fallback versuchen
      const r2 = await fn(strArg);
      return r2 ?? r1;
    } catch (_e1) {
      try {
        const r2 = await fn(strArg);
        return r2;
      } catch (e2) {
        return { ok: false, error: e2?.message || String(e2) };
      }
    }
  }

  async _invokeCompatAny(fn, objArg, strArg) {
    try {
      const r1 = await fn(objArg);
      if (r1?.ok) return r1;
      const r2 = await fn(strArg);
      return r2 ?? r1;
    } catch (_e1) {
      try {
        const r2 = await fn(strArg);
        return r2;
      } catch (e2) {
        return { ok: false, error: e2?.message || String(e2) };
      }
    }
  }

  // ============================================================
  // Load data
  // ============================================================
  async _isMeetingClosed() {
    try {
      const api = window.bbmDb || {};
      if (typeof api.meetingsListByProject !== "function") return false;

      const res = await this._invokeCompatAny(
        api.meetingsListByProject,
        { projectId: this.projectId },
        this.projectId
      );

      if (!res?.ok) return false;

      const meetings = this._pickArray(res);
      const m = (meetings || []).find((x) => String(x?.id ?? "") === String(this.meetingId ?? ""));
      return Number(m?.is_closed || 0) === 1;
    } catch (_e) {
      return false;
    }
  }

  async _ensureOpenMeetingContext() {
    try {
      const api = window.bbmDb || {};
      if (!this.projectId) return;
      if (typeof api.meetingsListByProject !== "function") return;

      const res = await this._invokeCompatAny(
        api.meetingsListByProject,
        { projectId: this.projectId },
        this.projectId
      );
      if (!res?.ok) return;

      const meetings = this._pickArray(res) || [];
      const current = meetings.find((x) => String(x?.id ?? "") === String(this.meetingId ?? ""));
      const open = meetings
        .filter((x) => Number(x?.is_closed || 0) !== 1)
        .sort((a, b) => Number(b?.meeting_index || 0) - Number(a?.meeting_index || 0));

      // Explizit gesetzte Meeting-ID nicht auf ein anderes offenes Meeting umbiegen
      // (wichtig direkt nach Neuanlage, wenn List-Refresh verzögert ist).
      if (this.meetingId && !current) return;
      if (current && Number(current?.is_closed || 0) !== 1) return;
      if (open.length > 0) {
        this.meetingId = open[0]?.id || this.meetingId;
      }
    } catch (_e) {
      // ignore
    }
  }

  async _loadCandidatesData() {
    this._setError("");

    const api = window.bbmDb || {};
    if (typeof api.projectParticipantsPool !== "function") {
      this._setError("API fehlt: projectParticipantsPool");
      this.pool = [];
      this.candidates = [];
      return;
    }
    if (typeof api.projectCandidatesList !== "function") {
      this._setError("API fehlt: projectCandidatesList");
      this.pool = [];
      this.candidates = [];
      return;
    }

    const resPool = await this._invokeCompatList(
      api.projectParticipantsPool,
      { projectId: this.projectId },
      this.projectId
    );

    if (!resPool?.ok) {
      this._setError(resPool?.error || "Fehler beim Laden des Pools");
      this.pool = [];
      this.candidates = [];
      return;
    }

    const poolRaw = this._pickArray(resPool);

    const pool = (poolRaw || [])
      .map((x) => {
        const kind = this._normKind(x);
        const personId = this._normPersonId(x);
        return {
          ...x,
          kind,
          personId,
          name: (x.name || "").toString(),
          email: this._personEmail(x),
          rolle: (x.rolle || x.role || "").toString(),
          firm: (x.firm || x.firm_name || x.firmName || "").toString(),
          firmId: x.firmId ?? x.firm_id ?? null,
          firmIsActive: this._parseActiveFlag(
            x.firm_is_active ?? x.firmIsActive ?? x.is_firm_active
          ),
        };
      })
      .filter((x) => x.kind && x.personId);

    const resC = await this._invokeCompatAny(
      api.projectCandidatesList,
      { projectId: this.projectId },
      this.projectId
    );

    if (!resC?.ok) {
      this._setError(resC?.error || "Fehler beim Laden der Kandidaten");
      this.pool = this._sortPersons(pool);
      this.candidates = [];
      return;
    }

    const itemsRaw = this._pickArray(resC);
    const items = (itemsRaw || [])
      .map((x) => ({
        kind: this._normKind(x),
        personId: this._normPersonId(x),
        is_active: this._parseActiveFlag(x?.is_active ?? x?.isActive),
      }))
      .filter((x) => x.kind && x.personId);

    const poolMap = new Map(pool.map((p) => [this._key(p.kind, p.personId), p]));
    const left = [];

    const activeKeys = new Set();
    for (const it of items) {
      if (this._parseActiveFlag(it?.is_active) !== 1) continue;
      const k = this._key(it.kind, it.personId);
      if (k) activeKeys.add(k);
      const p = poolMap.get(k);
      if (p) {
        left.push({
          ...p,
          is_active: this._parseActiveFlag(it?.is_active),
          firmIsActive: this._parseActiveFlag(
            p.firmIsActive ?? p.firm_is_active ?? p.is_firm_active
          ),
        });
      } else {
        left.push({
          kind: it.kind,
          personId: it.personId,
          name: "?",
          email: "",
          rolle: "",
          firm: "",
          is_active: this._parseActiveFlag(it?.is_active),
          firmId: null,
          firmIsActive: 0,
        });
      }
    }

    this.pool = this._sortPersons(
      (pool || []).filter((p) => activeKeys.has(this._key(p.kind, p.personId)))
    );
    this.candidates = this._sortPersons(left);

    await this._buildOpenParticipantRefs();
  }

  async _buildOpenParticipantRefs() {
    this.openParticipantRefs = new Map();

    const api = window.bbmDb || {};
    if (typeof api.meetingsListByProject !== "function") return;
    if (typeof api.meetingParticipantsList !== "function") return;

    try {
      const resM = await this._invokeCompatAny(
        api.meetingsListByProject,
        { projectId: this.projectId },
        this.projectId
      );
      if (!resM?.ok) return;

      const meetings = this._pickArray(resM);
      const openMeetings = (meetings || []).filter((m) => Number(m.is_closed || 0) === 0);
      const idxById = new Map(openMeetings.map((m) => [m.id, m.meeting_index]));

      for (const m of openMeetings) {
        const resP = await api.meetingParticipantsList({ meetingId: m.id });
        if (!resP?.ok) continue;

        const plist = this._pickArray(resP);
        const items = (plist || [])
          .map((x) => ({ kind: this._normKind(x), personId: this._normPersonId(x) }))
          .filter((x) => x.kind && x.personId);

        for (const it of items) {
          const key = this._key(it.kind, it.personId);
          const arr = this.openParticipantRefs.get(key) || [];
          const idx = idxById.get(m.id);
          if (idx != null && !arr.includes(idx)) arr.push(idx);
          this.openParticipantRefs.set(key, arr);
        }
      }
    } catch (_e) {
      // ignore
    }
  }

  async _loadParticipantsData() {
    this._setError("");

    const api = window.bbmDb || {};
    if (typeof api.projectParticipantsPool !== "function") {
      this._setError("API fehlt: projectParticipantsPool");
      this.pool = [];
      this.projectCandidates = [];
      return;
    }
    if (typeof api.meetingParticipantsList !== "function") {
      this._setError("API fehlt: meetingParticipantsList");
      this.participants = [];
      return;
    }

    const resPool = await this._invokeCompatList(
      api.projectParticipantsPool,
      { projectId: this.projectId },
      this.projectId
    );

    if (resPool?.ok) {
      const poolRaw = this._pickArray(resPool);
      const pool = (poolRaw || [])
        .map((x) => {
          const kind = this._normKind(x);
          const personId = this._normPersonId(x);
          return {
            ...x,
            kind,
            personId,
            name: (x.name || "").toString(),
            email: this._personEmail(x),
            rolle: (x.rolle || x.role || "").toString(),
            firm: (x.firm || x.firm_name || x.firmName || "").toString(),
            firmId: x.firmId ?? x.firm_id ?? null,
            is_active: this._parseActiveFlag(x?.is_active ?? x?.isActive),
            firmIsActive: this._parseActiveFlag(
              x.firm_is_active ?? x.firmIsActive ?? x.is_firm_active
            ),
          };
        })
        .filter((x) => x.kind && x.personId);

      this.pool = this._sortPersons(pool);
      this.projectCandidates = this._sortPersons(
        pool
          .filter((x) => this._parseActiveFlag(x?.is_active ?? x?.isActive) === 1)
          .map((x) => ({
            ...x,
            is_active: 1,
          }))
      );
    } else {
      this.pool = [];
      this.projectCandidates = [];
    }

    const poolMap = new Map(this.pool.map((p) => [this._key(p.kind, p.personId), p]));

    const resP = await api.meetingParticipantsList({ meetingId: this.meetingId });
    if (!resP?.ok) {
      this._setError(resP?.error || "Fehler beim Laden der Teilnehmer");
      this.participants = [];
      return;
    }
    this.readOnly = Number(resP?.isClosed ?? 0) === 1;

    const plist = this._pickArray(resP);
    const items = (plist || [])
      .map((x) => {
        const kind = this._normKind(x);
        const personId = this._normPersonId(x);
        const k = this._key(kind, personId);
        const p = poolMap.get(k);

        const rawPresent = Number(x.isPresent ?? x.is_present ?? 0) ? 1 : 0;
        const rawDistribution = Number(x.isInDistribution ?? x.is_in_distribution ?? 0) ? 1 : 0;

        return {
          kind,
          personId,
          name: (p?.name || x.name || "").toString() || "€”",
          email: this._personEmail(p) || this._personEmail(x),
          rolle: (p?.rolle || x.rolle || "").toString(),
          firm: (p?.firm || x.firm || x.firm_name || "").toString(),
          firmId: p?.firmId ?? p?.firm_id ?? null,
          firmIsActive: this._parseActiveFlag(
            p?.firmIsActive ?? p?.firm_is_active ?? p?.is_firm_active
          ),
          invalidReason: p ? "" : "Person nicht mehr verfuegbar",
          isPresent: rawPresent,
          isInDistribution: rawDistribution,
        };
      })
      .filter((x) => x.kind && x.personId);

    this.participants = this._sortPersons(items);
  }

  // ============================================================
  // Render: Candidates modal
  // ============================================================
  _renderCandidatesModal() {
    if (!this.bodyEl || !this.footerEl) return;

    this.bodyEl.innerHTML = "";
    this.footerEl.innerHTML = "";

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "12px";

    const leftCol = this._mkListCol("Mitarbeiter im Personalpool");
    const rightCol = this._mkListCol("Alle Mitarbeiter (Projekt)");

    grid.append(leftCol.col, rightCol.col);
    this.bodyEl.appendChild(grid);

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel);
    btnCancel.disabled = this.isSaving;
    btnCancel.onclick = () => this.close();

    const btnSave = document.createElement("button");
    btnSave.textContent = "Speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });
    btnSave.disabled = this.isSaving;
    btnSave.style.opacity = btnSave.disabled ? "0.55" : "1";
    btnSave.onclick = async () => this._saveCandidates();

    this.footerEl.style.justifyContent = "space-between";
    this.footerEl.style.alignItems = "center";
    const hint = document.createElement("div");
    hint.textContent = "Auswahl nur per Doppelklick";
    hint.style.fontSize = "12px";
    hint.style.opacity = "0.75";
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.append(btnCancel, btnSave);
    this.footerEl.append(hint, actions);

    this._renderCandidatesLists(leftCol.list, rightCol.list);
  }

  _renderCandidatesLists(leftListEl, rightListEl) {
    leftListEl.innerHTML = "";
    rightListEl.innerHTML = "";

    const selectedByKey = new Map(
      (this.candidates || []).map((p) => [this._key(p.kind, p.personId), p])
    );
    const selectedSet = new Set(selectedByKey.keys());
    const poolByKey = new Map((this.pool || []).map((p) => [this._key(p.kind, p.personId), p]));

    const left = [];
    for (const [key, selected] of selectedByKey.entries()) {
      const fromPool = poolByKey.get(key);
      left.push({
        ...(fromPool || selected),
        kind: selected.kind,
        personId: selected.personId,
        is_active: this._parseActiveFlag(selected?.is_active),
      });
    }

    const right = [];
    for (const p of this.pool || []) {
      const k = this._key(p.kind, p.personId);
      if (selectedSet.has(k)) continue;
      right.push(p);
    }

    const leftSorted = this._sortPersons(left);
    const rightSorted = this._sortPersons(right);

    for (const p of leftSorted) {
      const firmIsActive = this._parseActiveFlag(
        p.firmIsActive ?? p.firm_is_active ?? p.is_firm_active
      );
      const badgeText = firmIsActive === 1 ? "" : "Firma im Projekt nicht aktiv";

      this._renderRow({
        container: leftListEl,
        person: p,
        badgeText,
        onDblClick: () => {
          const key = this._key(p.kind, p.personId);
          const refs = this.openParticipantRefs.get(key) || [];
          if (refs.length) {
            alert(
              `Entfernen blockiert: Person ist Teilnehmer in offener Besprechung(en): ${refs
                .slice()
                .sort((a, b) => a - b)
                .map((x) => `#${x}`)
                .join(", ")}`
            );
            return;
          }

          this.candidates = (this.candidates || []).filter(
            (x) => this._key(x.kind, x.personId) !== key
          );
          this._renderCandidatesLists(leftListEl, rightListEl);
        },
      });
    }
    if (!leftSorted.length) this._renderEmpty(leftListEl);

    for (const p of rightSorted) {
      const isDisabled = false;
      const badgeText = "";
      this._renderRow({
        container: rightListEl,
        person: p,
        isDisabled,
        badgeText,
        onDblClick: () => {
          const key = this._key(p.kind, p.personId);
          if (selectedSet.has(key)) return;
          if (isDisabled) return;
          this.candidates = this._sortPersons([
            ...(this.candidates || []),
            { ...p, is_active: 1 },
          ]);
          this._renderCandidatesLists(leftListEl, rightListEl);
        },
      });
    }
    if (!rightSorted.length) this._renderEmpty(rightListEl);
  }

  async _saveCandidates() {
    const api = window.bbmDb || {};
    if (typeof api.projectCandidatesSet !== "function") {
      this._setError("API fehlt: projectCandidatesSet");
      return;
    }

    if (this.isSaving) return;
    this.isSaving = true;
    this._setError("");

    try {
      const items = (this.candidates || []).map((p) => ({
        kind: p.kind,
        personId: p.personId,
        isActive: true,
      }));

      const res = await api.projectCandidatesSet({ projectId: this.projectId, items });

      if (!res?.ok) {
        this._setError(res?.error || "Speichern fehlgeschlagen");
        return;
      }

      this._requestSetupStatusRefresh();
      this.close();
    } catch (e) {
      this._setError(e?.message || "Speichern fehlgeschlagen");
    } finally {
      this.isSaving = false;
      this._rerenderCurrentModal();
    }
  }

  async _setCandidateActive(person, isActive) {
    const api = window.bbmDb || {};
    if (typeof api.projectCandidatesSetActive !== "function") {
      this._setError("API fehlt: projectCandidatesSetActive");
      return false;
    }

    const kind = this._normKind(person);
    const personId = this._normPersonId(person);
    if (!kind || !personId || !this.projectId) return false;

    let res = null;
    try {
      res = await api.projectCandidatesSetActive({
        projectId: this.projectId,
        kind,
        personId,
        isActive: !!isActive,
      });
    } catch (e) {
      this._setError(e?.message || "Aktiv/Inaktiv konnte nicht gespeichert werden.");
      return false;
    }
    if (!res?.ok) {
      this._setError(res?.error || "Aktiv/Inaktiv konnte nicht gespeichert werden.");
      return false;
    }

    const next = this._parseActiveFlag(isActive);
    this.candidates = (this.candidates || []).map((x) => {
      if (this._key(x.kind, x.personId) !== this._key(kind, personId)) return x;
      return { ...x, is_active: next };
    });
    this._requestSetupStatusRefresh();
    return true;
  }

  // ============================================================
  // Render: Participants modal
  // ============================================================
  _renderParticipantsModal() {
    if (!this.bodyEl || !this.footerEl) return;

    this.bodyEl.innerHTML = "";
    this.footerEl.innerHTML = "";

    if (this.readOnly) {
      this._setError("Diese Besprechung ist geschlossen. Teilnehmer sind nur lesbar.");
    }

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "12px";

    const leftCol = this._mkListCol("Teilnehmer dieser Besprechung");
    const rightCol = this._mkListCol("Personen im Projekt");

    grid.append(leftCol.col, rightCol.col);
    this.bodyEl.appendChild(grid);

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel);
    btnCancel.disabled = this.isSaving;
    btnCancel.onclick = () => this.close();

    const btnSave = document.createElement("button");
    btnSave.textContent = "Speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });
    btnSave.disabled = this.isSaving || this.readOnly;
    btnSave.style.opacity = btnSave.disabled ? "0.55" : "1";
    btnSave.onclick = async () => this._saveParticipants();

    this.footerEl.style.justifyContent = "space-between";
    this.footerEl.style.alignItems = "center";
    const hint = document.createElement("div");
    hint.textContent = "Auswahl mit Doppelklick";
    hint.style.fontSize = "12px";
    hint.style.opacity = "0.75";
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.append(btnCancel, btnSave);
    this.footerEl.append(hint, actions);

    this._renderParticipantsLists(leftCol.list, rightCol.list);
  }

  _renderParticipantsLists(leftListEl, rightListEl) {
    leftListEl.innerHTML = "";
    rightListEl.innerHTML = "";

    const selSet = new Set((this.participants || []).map((p) => this._key(p.kind, p.personId)));

    // LEFT
    const left = [];
    for (const p of this.participants || []) {
      left.push(p);
    }

    const leftSorted = this._sortPersons(left);
    for (const p of leftSorted) {
      const rowKey = this._key(p.kind, p.personId);
      const hasEmail = this._hasPersonEmail(p);
      if (hasEmail) this.distributionHintKeys.delete(rowKey);
      const showDistributionHint = !hasEmail;
      if (!hasEmail && Number(p.isInDistribution) === 1) {
        p.isInDistribution = 0;
      }
      const firmIsActive = this._parseActiveFlag(
        p.firmIsActive ?? p.firm_is_active ?? p.is_firm_active
      );
      const invalidReason = p.invalidReason
        ? p.invalidReason
        : firmIsActive === 1
          ? ""
          : "Firma im Projekt nicht aktiv";

      const controls = document.createElement("div");
      controls.style.display = "grid";
      controls.style.gridTemplateRows = "auto auto";
      controls.style.rowGap = "2px";
      controls.style.width = "140px";
      controls.style.flexShrink = "0";
      controls.style.justifyItems = "end";

      const labelsRow = document.createElement("div");
      labelsRow.style.display = "grid";
      labelsRow.style.gridTemplateColumns = "1fr 1fr";
      labelsRow.style.columnGap = "10px";
      labelsRow.style.width = "100%";
      labelsRow.style.justifyItems = "end";

      const lblPresent = document.createElement("div");
      lblPresent.textContent = "Anwesend";
      lblPresent.style.fontSize = "12px";
      lblPresent.style.textAlign = "right";
      lblPresent.style.transform = "translateX(2.5mm)";

      const lblDistribution = document.createElement("div");
      lblDistribution.textContent = "Verteiler";
      lblDistribution.style.fontSize = "12px";
      lblDistribution.style.textAlign = "right";
      lblDistribution.style.cursor = hasEmail ? "default" : "not-allowed";
      lblDistribution.onclick = () => {
        if (hasEmail) return;
        this.distributionHintKeys.add(rowKey);
        this._renderParticipantsLists(leftListEl, rightListEl);
      };

      labelsRow.append(lblPresent, lblDistribution);

      const checksRow = document.createElement("div");
      checksRow.style.display = "grid";
      checksRow.style.gridTemplateColumns = "1fr 1fr";
      checksRow.style.columnGap = "10px";
      checksRow.style.width = "100%";
      checksRow.style.justifyItems = "center";

      const cbPresent = document.createElement("input");
      cbPresent.type = "checkbox";
      cbPresent.checked = Number(p.isPresent) === 1;
      cbPresent.disabled = this.readOnly || this.isSaving;
      cbPresent.onchange = () => {
        const wasPresent = Number(p.isPresent) === 1;
        p.isPresent = cbPresent.checked ? 1 : 0;
        if (this.isNewUi && !wasPresent && p.isPresent === 1 && hasEmail) {
          p.isInDistribution = 1;
          this._renderParticipantsLists(leftListEl, rightListEl);
        }
      };

      const cbDistribution = document.createElement("input");
      cbDistribution.type = "checkbox";
      cbDistribution.checked = Number(p.isInDistribution) === 1;
      cbDistribution.disabled = this.readOnly || this.isSaving || !hasEmail;
      cbDistribution.onchange = () => {
        if (!hasEmail) {
          cbDistribution.checked = false;
          p.isInDistribution = 0;
          this.distributionHintKeys.add(rowKey);
          this._renderParticipantsLists(leftListEl, rightListEl);
          return;
        }
        p.isInDistribution = cbDistribution.checked ? 1 : 0;
      };

      checksRow.append(cbPresent, cbDistribution);
      controls.append(labelsRow, checksRow);

      this._renderRow({
        container: leftListEl,
        person: p,
        extraRight: controls,
        roleInline: true,
        firmBelowName: true,
        hideFirmRight: true,
        rightWidth: "172px",
        dividerOffsetMm: 14,
        flushLeftToDivider: true,
        leftHintText: showDistributionHint ? "E-Mail Adresse fehlt." : "",
        badgeText: invalidReason ? invalidReason : "",
        onDblClick: () => {
          if (this.readOnly) return;
          const key = this._key(p.kind, p.personId);
          this.participants = (this.participants || []).filter(
            (x) => this._key(x.kind, x.personId) !== key
          );
          this._renderParticipantsLists(leftListEl, rightListEl);
        },
      });
    }
    if (!leftSorted.length) {
      this._renderEmpty(
        leftListEl,
        '„Mitarbeiter aus Liste "Personen im Projekt" mit Doppelklick auswählen“'
      );
    }

    // RIGHT
    const right = [];
    for (const c of this.projectCandidates || []) {
      const key = this._key(c.kind, c.personId);
      if (selSet.has(key)) continue;
      right.push(c);
    }

    const rightActive = right.filter(
      (p) => this._parseActiveFlag(p?.is_active ?? p?.isActive) === 1
    );
    const rightSorted = this._sortPersons(rightActive);
    for (const c of rightSorted) {
      const firmIsActive = this._parseActiveFlag(
        c.firmIsActive ?? c.firm_is_active ?? c.is_firm_active
      );
      const isDisabled = firmIsActive !== 1;
      const badgeText = isDisabled ? "Firma im Projekt nicht aktiv" : "";
      this._renderRow({
        container: rightListEl,
        person: c,
        isDisabled,
        badgeText,
        onDblClick: () => {
          if (this.readOnly) return;
          if (isDisabled) return;
          const key = this._key(c.kind, c.personId);
          if (selSet.has(key)) return;

          // œ… beim Wählen sind beide Toggles angehakt
          const newP = {
            kind: c.kind,
            personId: c.personId,
            name: c.name,
            email: this._personEmail(c),
            rolle: c.rolle,
            firm: c.firm,
            isPresent: 1,
            isInDistribution: this._hasPersonEmail(c) ? 1 : 0,
          };

          this.participants = this._sortPersons([...(this.participants || []), newP]);
          this._renderParticipantsLists(leftListEl, rightListEl);
        },
      });
    }
    if (!rightSorted.length) {
      this._renderEmpty(
        rightListEl,
        "„zunächst Firmen incl. Mitarbeitern anlegen“"
      );
    }
  }

  async _saveParticipants() {
    if (this.readOnly) return;

    const api = window.bbmDb || {};
    if (typeof api.meetingParticipantsSet !== "function") {
      this._setError("API fehlt: meetingParticipantsSet");
      return;
    }

    if (this.isSaving) return;
    this.isSaving = true;

    try {
      const items = (this.participants || []).map((p) => ({
        kind: p.kind,
        personId: p.personId,
        isPresent: Number(p.isPresent) === 1,
        isInDistribution: Number(p.isInDistribution) === 1 && this._hasPersonEmail(p),
      }));

      const res = await api.meetingParticipantsSet({ meetingId: this.meetingId, items });
      if (!res?.ok) {
        this._setError(res?.error || "Speichern fehlgeschlagen");
        return;
      }

      this.close();
    } catch (e) {
      this._setError(e?.message || "Speichern fehlgeschlagen");
    } finally {
      this.isSaving = false;
      this._rerenderCurrentModal();
    }
  }
}
