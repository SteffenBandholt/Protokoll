// src/renderer/views/TopsView.js
//
// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.0

import { shouldShowTopForMeeting, shouldGrayTopForMeeting } from "../utils/topVisibility.js";
import { ampelHexFrom } from "../utils/ampelColors.js";
import { createAmpelComputer } from "../utils/ampelLogic.js";
import { applyPopupButtonStyle, applyPopupCardStyle } from "../ui/popupButtonStyles.js";
import { fireAndForget } from "../utils/async.js";

const EMPTY_LEVEL1_HINT_PNG = new URL("../assets/BBM-bunt.png", import.meta.url).href;

export default class TopsView {
  constructor({ router, projectId, meetingId }) {
    this.router = router;
    this.projectId = projectId;
    this.meetingId = meetingId;

    this.root = null;
    this.listEl = null;

    this.selectedTopId = null;
    this.selectedTop = null;

    this.meetingMeta = null;
    this.isReadOnly = false;

    // Editbox buttons
    this.btnL1 = null;
    this.btnChild = null;

    // Topbar buttons
    this.btnEndMeeting = null; // "Protokoll schließen"
    this.btnCloseMeeting = null; // "zurück"
    this.btnLongToggle = null;

    this.btnAmpelToggle = null;
    this.box = null;
    this.topBarEl = null;
    this.editMetaCol = null;
    this.editMetaSep = null;
    this.boxTitleEl = null;

    this.inpTitle = null;
    this.taLongtext = null;

    this.chkImportant = null;
    this.chkHidden = null;

    this.inpDueDate = null;
    this.selStatus = null;
    this.selResponsible = null;
    this.dueAmpelEl = null;

    this.projectFirms = [];
    this._projectFirmsLoaded = false;
    this._projectFirmsLoading = null;
    this._respOptionsKey = "";
    this._respDirty = false;
    this._respDirtyTopId = null;
    this._respLastSetTopId = null;
    this._respLegacyReadonly = false;

    // List toggle: Langtext anzeigen
    this.showLongtextInList = false;

    this.showAmpelInList = true;
    // Char counter
    this.titleCountEl = null;
    this.longCountEl = null;

    // Limits UI
    this.titleMax = 100;
    this.longMax = 500;

    // Labels in topbar (when longtext on)
    this.topMetaEl = null;

    // Save button
    this.btnSaveTop = null;
    this.btnTrashTop = null;
    this.saveInfoEl = null;

    this.btnMove = null;
    this.moveModeActive = false;

    this.btnDelete = null;

    this.btnParticipants = null;

    this.items = [];
    this.childrenCountByParent = new Map();
    this.isNewUi = this._readUiMode() === "new";
    this.level1Collapsed = new Set();
    this._level1CollapsedLoaded = false;
    this._level1CollapsedProjectId = null;
    this._level1CollapsedMap = {};

    this._suppressBlurOnce = false;
    this._saveInfoTimer = null;
    this._userSelectedTop = false;
    this._updateAmpelToggleUi = null;
    // Layout: pinned bars
    this._fixedResizeObs = null;
    this._fixedHorzResizeObs = null;
    this._fixedHorzSidebarEl = null;
    this._topsLimitsListenerBound = false;
    this._onTopLimitsChanged = null;
    this._longtextSettingLoaded = false;
    this.listFontScale = "medium";
    this._listFontScaleLoaded = false;
    this.editFontScale = "small";
    this._editFontScaleLoaded = false;
    this._fontScaleListenerBound = false;
    this._onFontScaleChanged = null;

    // Busy (NEVER-BLOCK-UI)
    this._busy = false;
    this._deleteInFlight = false;

    // Markierungen für Nummernlücken
    this._markTopIds = new Set();
    this._gapPopupOverlay = null;

    // UI sizing (Meta-Spalte ~30% schmaler)
    this.META_COL_W = 133; // px
    this.NUM_COL_W = 56; // px (ohne Ampel links)
  }

  _readUiMode() {
    try {
      const raw = String(window.localStorage?.getItem?.("bbm.uiMode") || "").trim().toLowerCase();
      return raw === "new" ? "new" : "old";
    } catch (_e) {
      return "old";
    }
  }

  _titleMax() {
    return Number(this.titleMax) > 0 ? Number(this.titleMax) : 100;
  }

  _longMax() {
    return Number(this.longMax) > 0 ? Number(this.longMax) : 500;
  }

  _clampStr(v, max) {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.length <= max) return s;
    return s.slice(0, max);
  }

  _parseBool(value, fallback) {
    if (value == null || value === "") return fallback;
    const s = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "ja", "on"].includes(s)) return true;
    if (["0", "false", "no", "nein", "off"].includes(s)) return false;
    return fallback;
  }

  _computeNextMeetingDefaultDateIso() {
    const m = this.meetingMeta || {};
    const raw =
      m.meeting_date ||
      m.meetingDate ||
      m.date ||
      m.held_on ||
      m.starts_at ||
      m.updated_at ||
      m.updatedAt ||
      "";
    let baseIso = "";

    if (raw) {
      const s = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        baseIso = s.slice(0, 10);
      } else {
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) {
          baseIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate()
          ).padStart(2, "0")}`;
        }
      }
    }

    if (!baseIso) return "";
    const base = new Date(`${baseIso}T00:00:00`);
    if (Number.isNaN(base.getTime())) return "";
    base.setDate(base.getDate() + 7);
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(
      base.getDate()
    ).padStart(2, "0")}`;
  }

  async _loadAmpelSetting() {
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") {
      this.showAmpelInList = true;
      this._applyAmpelVisibility();
      if (typeof this._updateAmpelToggleUi === "function") this._updateAmpelToggleUi();
      return;
    }

    const res = await api.appSettingsGetMany(["tops.ampelEnabled"]);
    if (!res?.ok) {
      this.showAmpelInList = true;
      this._applyAmpelVisibility();
      if (typeof this._updateAmpelToggleUi === "function") this._updateAmpelToggleUi();
      return;
    }

    const data = res.data || {};
    this.showAmpelInList = this._parseBool(data["tops.ampelEnabled"], true);
    this._applyAmpelVisibility();
    if (typeof this._updateAmpelToggleUi === "function") this._updateAmpelToggleUi();
  }

  async _loadTextLimitsSetting() {
    const DEFAULT_TITLE_MAX = 100;
    const DEFAULT_LONG_MAX = 500;
    const parseLimit = (val, min, max, fallback) => {
      const n = Math.floor(Number(val));
      if (!Number.isFinite(n) || n <= 0) return fallback;
      return Math.max(min, Math.min(max, n));
    };

    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") {
      this.titleMax = DEFAULT_TITLE_MAX;
      this.longMax = DEFAULT_LONG_MAX;
      return;
    }

    const res = await api.appSettingsGetMany(["tops.titleMax", "tops.longMax"]);
    if (!res?.ok) {
      this.titleMax = DEFAULT_TITLE_MAX;
      this.longMax = DEFAULT_LONG_MAX;
      return;
    }

    const data = res.data || {};
    const titleMax = parseLimit(data["tops.titleMax"], 1, 5000, DEFAULT_TITLE_MAX);
    const longMax = parseLimit(data["tops.longMax"], 1, 20000, DEFAULT_LONG_MAX);

    this.titleMax = titleMax;
    this.longMax = longMax;

    if (this.inpTitle) {
      this.inpTitle.maxLength = this._titleMax();
      this.inpTitle.value = this._clampStr(this.inpTitle.value, this._titleMax());
    }
    if (this.taLongtext) {
      this.taLongtext.maxLength = this._longMax();
      this.taLongtext.value = this._clampStr(this.taLongtext.value, this._longMax());
    }

    this._updateCharCounters();
    if (this.listEl) this._renderListOnly();
    this._updateTopBarMetaLabels();
  }

  async _loadLongtextSetting() {
    if (this._longtextSettingLoaded) return;
    const key = "tops.showLongtextInList";
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany === "function") {
      const res = await api.appSettingsGetMany([key]);
      if (res?.ok) {
        const data = res.data || {};
        this.showLongtextInList = this._parseBool(data[key], this.showLongtextInList);
      }
      this._longtextSettingLoaded = true;
      return;
    }

    try {
      const raw = window.localStorage?.getItem?.(key);
      if (raw != null) {
        this.showLongtextInList = this._parseBool(raw, this.showLongtextInList);
      }
    } catch (_e) {
      // ignore
    }
    this._longtextSettingLoaded = true;
  }

  async _saveLongtextSetting() {
    const key = "tops.showLongtextInList";
    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany === "function") {
      await api.appSettingsSetMany({ [key]: this.showLongtextInList ? "1" : "0" });
      return;
    }
    try {
      window.localStorage?.setItem?.(key, this.showLongtextInList ? "1" : "0");
    } catch (_e) {
      // ignore
    }
  }

  async _loadListFontScaleSetting(force = false) {
    if (this._listFontScaleLoaded && !force) return;
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") {
      this.listFontScale = "medium";
      this._listFontScaleLoaded = true;
      return;
    }
    const res = await api.appSettingsGetMany(["tops.fontscale.list"]);
    if (!res?.ok) {
      this.listFontScale = "medium";
      this._listFontScaleLoaded = true;
      return;
    }
    const raw = String(res?.data?.["tops.fontscale.list"] || "").trim().toLowerCase();
    this.listFontScale = ["small", "medium", "large"].includes(raw) ? raw : "medium";
    this._listFontScaleLoaded = true;
  }

  async _loadEditFontScaleSetting(force = false) {
    if (this._editFontScaleLoaded && !force) return;
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") {
      this.editFontScale = "small";
      this._editFontScaleLoaded = true;
      return;
    }
    const res = await api.appSettingsGetMany(["tops.fontscale.editbox"]);
    if (!res?.ok) {
      this.editFontScale = "small";
      this._editFontScaleLoaded = true;
      return;
    }
    const raw = String(res?.data?.["tops.fontscale.editbox"] || "").trim().toLowerCase();
    this.editFontScale = ["small", "large"].includes(raw) ? raw : "small";
    this._editFontScaleLoaded = true;
  }

  _getListFontSizes() {
    const scale = (this.listFontScale || "medium").toString().toLowerCase();
    if (scale === "small") {
      return { l1: 15, l24: 14, long: 13 };
    }
    if (scale === "large") {
      return { l1: 21, l24: 20, long: 19 };
    }
    return { l1: 18, l24: 17, long: 16 };
  }

  _getEditFontSizes() {
    const scale = (this.editFontScale || "small").toString().toLowerCase();
    if (scale === "large") {
      return { short: 18, long: 17 };
    }
    return { short: 14, long: 13 };
  }

  _applyEditFontSizes() {
    const sizes = this._getEditFontSizes();
    if (this.inpTitle) this.inpTitle.style.fontSize = `${sizes.short}px`;
    if (this.taLongtext) this.taLongtext.style.fontSize = `${sizes.long}px`;
  }

  async _loadLevel1CollapsedSetting() {
    const pid = this.projectId ? String(this.projectId) : "";
    if (!pid) {
      this.level1Collapsed = new Set();
      this._level1CollapsedLoaded = true;
      this._level1CollapsedProjectId = null;
      return;
    }

    if (this._level1CollapsedLoaded && this._level1CollapsedProjectId === pid) return;

    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") {
      this.level1Collapsed = new Set();
      this._level1CollapsedLoaded = true;
      this._level1CollapsedProjectId = pid;
      return;
    }

    const res = await api.appSettingsGetMany(["tops.level1Collapsed"]);
    if (!res?.ok) {
      this.level1Collapsed = new Set();
      this._level1CollapsedLoaded = true;
      this._level1CollapsedProjectId = pid;
      return;
    }

    const raw = String(res?.data?.["tops.level1Collapsed"] || "").trim();
    let map = {};
    try {
      const parsed = JSON.parse(raw || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        map = parsed;
      }
    } catch {
      map = {};
    }

    this._level1CollapsedMap = map;
    const list = Array.isArray(map[pid]) ? map[pid] : [];
    this.level1Collapsed = new Set(list.map((x) => String(x)));
    this._level1CollapsedLoaded = true;
    this._level1CollapsedProjectId = pid;
  }

  async _saveLevel1CollapsedSetting() {
    const pid = this.projectId ? String(this.projectId) : "";
    if (!pid) return;

    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") return;

    if (!this._level1CollapsedMap || typeof this._level1CollapsedMap !== "object") {
      this._level1CollapsedMap = {};
    }

    this._level1CollapsedMap[pid] = Array.from(this.level1Collapsed || []);
    const payload = {
      "tops.level1Collapsed": JSON.stringify(this._level1CollapsedMap),
    };

    await api.appSettingsSetMany(payload);
  }

  async _saveAmpelSetting() {
    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") return;

    const res = await api.appSettingsSetMany({
      "tops.ampelEnabled": this.showAmpelInList ? "true" : "false",
    });
    if (!res?.ok) {
      alert(res?.error || "Speichern fehlgeschlagen");
    }
  }

  _applyAmpelVisibility() {
    const show = !!this.showAmpelInList;
    if (this.dueAmpelEl) this.dueAmpelEl.style.display = show ? "inline-block" : "none";
  }

  _normTitle(v) {
    const s = (v || "").trim();
    const clamped = this._clampStr(s, this._titleMax());
    return clamped || "(ohne Bezeichnung)";
  }

  _normLong(v) {
    const s = v === null || v === undefined ? "" : String(v);
    const clamped = this._clampStr(s, this._longMax());
    return clamped.length === 0 ? null : clamped;
  }

  _updateCharCounters() {
    if (this.inpTitle && this.titleCountEl) {
      const max = this._titleMax();
      const cur = String(this.inpTitle.value || "");
      const left = Math.max(0, max - cur.length);
      this.titleCountEl.textContent = `${left}`;
    }
    if (this.taLongtext && this.longCountEl) {
      const max = this._longMax();
      const cur = String(this.taLongtext.value || "");
      const left = Math.max(0, max - cur.length);
      this.longCountEl.textContent = `${left}`;
    }
  }

  _blurGuard(fn) {
    return async () => {
      if (this._suppressBlurOnce) {
        this._suppressBlurOnce = false;
        return;
      }
      await fn();
    };
  }

  _topIdKey(id) {
    if (id === null || id === undefined || id === "") return "";
    return String(id);
  }

  _sameTopId(a, b) {
    const ak = this._topIdKey(a);
    const bk = this._topIdKey(b);
    return !!ak && ak === bk;
  }

  _findTopById(id) {
    const key = this._topIdKey(id);
    if (!key) return null;
    return (this.items || []).find((t) => this._sameTopId(t?.id, key)) || null;
  }

  _showSavedPulse() {
    if (!this.saveInfoEl) return;
    this.saveInfoEl.textContent = "Gespeichert";
    this.saveInfoEl.style.opacity = "0.9";

    if (this._saveInfoTimer) clearTimeout(this._saveInfoTimer);
    this._saveInfoTimer = setTimeout(() => {
      if (!this.saveInfoEl) return;
      this.saveInfoEl.textContent = "";
      this.saveInfoEl.style.opacity = "0.85";
    }, 900);
  }

  _setBusy(on) {
    this._busy = !!on;

    if (on) {
      if (this.btnL1) this.btnL1.disabled = true;
      if (this.btnChild) this.btnChild.disabled = true;

      if (this.btnEndMeeting) this.btnEndMeeting.disabled = true;
      if (this.btnCloseMeeting) this.btnCloseMeeting.disabled = true;

      if (this.btnMove) this.btnMove.disabled = true;
      if (this.btnSaveTop) this.btnSaveTop.disabled = true;
      if (this.btnTrashTop) this.btnTrashTop.disabled = true;
      if (this.btnDelete) this.btnDelete.disabled = true;

      if (this.inpTitle) this.inpTitle.disabled = true;
      if (this.taLongtext) this.taLongtext.disabled = true;
      if (this.inpDueDate) this.inpDueDate.disabled = true;
      if (this.selStatus) this.selStatus.disabled = true;
      if (this.selResponsible) this.selResponsible.disabled = true;
      if (this.chkImportant) this.chkImportant.disabled = true;
      if (this.chkHidden) this.chkHidden.disabled = true;

      return;
    }

    this.applyEditBoxState();
    this._applyReadOnlyState();
    this._updateMoveControls();
    this._updateDeleteControls();
  }

  async _saveMeetingTopPatch(patch, { reload = true, pulse = false } = {}) {
    if (this.isReadOnly) return;
    if (this._busy) return;

    const selected = this.selectedTop || this._findTopById(this.selectedTopId);
    const selectedTopId = selected?.id ?? this.selectedTopId;
    if (!selectedTopId) return;
    const selectedInItems = this._findTopById(selectedTopId);
    if (!selectedInItems) return;

    const nextPatch = patch && typeof patch === "object" ? { ...patch } : {};

    if (this.inpTitle?.disabled) delete nextPatch.title;
    if (this.taLongtext?.disabled) delete nextPatch.longtext;
    if (this.inpDueDate?.disabled) delete nextPatch.due_date;
    if (this.selStatus?.disabled) {
      delete nextPatch.status;
      delete nextPatch.completed_in_meeting_id;
    }
    if (this.selResponsible?.disabled) {
      delete nextPatch.responsible_kind;
      delete nextPatch.responsible_id;
      delete nextPatch.responsible_label;
    }
    if (this.chkHidden?.disabled) delete nextPatch.is_hidden;
    if (this.chkImportant?.disabled) delete nextPatch.is_important;

    if (Number(selectedInItems.is_carried_over) === 1) {
      delete nextPatch.title;
    }

    if (Object.keys(nextPatch).length === 0) return;

    this._setBusy(true);
    try {
      const res = await window.bbmDb.meetingTopsUpdate({
        meetingId: this.meetingId,
        topId: selectedInItems.id,
        patch: nextPatch,
      });

      if (!res?.ok) {
        alert(res?.error || "Fehler beim Speichern");
        return;
      }

      const t = this._findTopById(selectedInItems.id) || this.selectedTop;
      if (t && nextPatch) {
        if (nextPatch.title !== undefined) t.title = nextPatch.title;
        if (nextPatch.longtext !== undefined) t.longtext = nextPatch.longtext;
        if (nextPatch.due_date !== undefined) t.due_date = nextPatch.due_date;
        if (nextPatch.status !== undefined) t.status = nextPatch.status;
        if (nextPatch.completed_in_meeting_id !== undefined) {
          t.completed_in_meeting_id = nextPatch.completed_in_meeting_id;
        }
        if (nextPatch.is_hidden !== undefined) t.is_hidden = nextPatch.is_hidden ? 1 : 0;
        if (nextPatch.is_important !== undefined) t.is_important = nextPatch.is_important ? 1 : 0;
        if (nextPatch.responsible_kind !== undefined) t.responsible_kind = nextPatch.responsible_kind;
        if (nextPatch.responsible_id !== undefined) t.responsible_id = nextPatch.responsible_id;
        if (nextPatch.responsible_label !== undefined) t.responsible_label = nextPatch.responsible_label;
      }

      if (pulse) this._showSavedPulse();

      if (reload) {
        fireAndForget(() => this.reloadList(false), "TopsView reload after save");
      }

      return res;
    } finally {
      this._setBusy(false);
    }
  }

  _collectEditorPatch() {
    const t = this.selectedTop;
    if (!t) return null;

    const patch = {};

    if (this.inpTitle && !this.inpTitle.disabled) {
      patch.title = this._normTitle(this.inpTitle.value);
    }

    if (this.taLongtext && !this.taLongtext.disabled) {
      patch.longtext = this._normLong(this.taLongtext.value);
    }

    if (this.chkImportant && !this.chkImportant.disabled) {
      patch.is_important = this.chkImportant.checked ? 1 : 0;
    }

    if (this.inpDueDate && !this.inpDueDate.disabled) {
      const dueVal = (this.inpDueDate.value || "").trim();
      patch.due_date = dueVal || null;
    }

    if (this.selStatus && !this.selStatus.disabled) {
      const st = (this.selStatus.value || "").trim();
      patch.status = st || "offen";
      patch.completed_in_meeting_id = this._isDoneStatus(patch.status) ? this.meetingId : null;
    }

    if (this.selResponsible && !this.selResponsible.disabled) {
      const parsed = this._parseResponsibleOptionValue(this.selResponsible.value);
      if (parsed?.id) {
        const lbl = this._getResponsibleLabelForSelection(this.selResponsible, parsed);
        patch.responsible_kind = parsed.kind || "company";
        patch.responsible_id = String(parsed.id);
        patch.responsible_label = lbl;
      } else {
        patch.responsible_kind = null;
        patch.responsible_id = null;
        patch.responsible_label = null;
      }
    }

    return patch;
  }

  _sanitizeResponsibleLabel(label) {
    const s = (label ?? "").toString().trim();
    if (!s) return "";
    if (s === "?" || s === "-" || s === "—") return "";
    if (/^\?+$/.test(s)) return "";
    return s;
  }

  _buildResponsibleDisplayLabel(row) {
    const s = (row?.short || "").toString().trim();
    if (s) return s;
    const n = (row?.name || "").toString().trim();
    if (n) return n;

    const rawId = row?.id ?? row?.firm_id ?? row?.firmId ?? "";
    const id = rawId === null || rawId === undefined ? "" : String(rawId).trim();
    if (id) return `Unbenannte Firma (ID: ${id})`;
    return "Unbenannte Firma";
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

  _getResponsibleLabelForSelection(sel, parsed) {
    if (!parsed?.id) return null;

    const selectedText = this._sanitizeResponsibleLabel(sel?.selectedOptions?.[0]?.textContent || "");
    if (selectedText) return selectedText;

    const value = (sel?.value || "").toString();
    const fromCandidates = (this.projectFirms || []).find((c) => (
      this._buildResponsibleOptionValue(c?.kind, c?.id ?? c?.firm_id ?? c?.firmId ?? null) === value
    ));
    if (fromCandidates) return this._buildResponsibleDisplayLabel(fromCandidates);

    return this._buildResponsibleDisplayLabel({ id: parsed.id, kind: parsed.kind });
  }

  _normalizeResponsibleCandidates(list) {
    const out = [];
    const seen = new Set();
    for (const row of list || []) {
      const activeRaw = row?.is_active ?? row?.isActive;
      if (activeRaw !== undefined && activeRaw !== null) {
        if (this._parseActiveFlag(activeRaw) === 0) continue;
      }
      const rawId = row?.id ?? row?.firm_id ?? row?.firmId ?? null;
      if (rawId === null || rawId === undefined || rawId === "") continue;

      const kindRaw = (row?.kind || "").toString().trim();
      const kind = kindRaw || (this.isNewUi ? "project_firm" : "company");
      const id = String(rawId).trim();
      if (!id) continue;

      const short = (row?.short || "").toString().trim();
      const name = (row?.name || "").toString().trim();
      const displayLabel = this._buildResponsibleDisplayLabel({ kind, id, short, name });
      const key = `${kind}::${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ kind, id, short, name, label: displayLabel, displayLabel });
    }

    out.sort((a, b) => {
      const al = this._buildResponsibleDisplayLabel(a).toLocaleLowerCase("de-DE");
      const bl = this._buildResponsibleDisplayLabel(b).toLocaleLowerCase("de-DE");
      if (al < bl) return -1;
      if (al > bl) return 1;
      const ak = String(a?.kind || "");
      const bk = String(b?.kind || "");
      if (ak < bk) return -1;
      if (ak > bk) return 1;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });

    return out;
  }

  _buildResponsibleOptionValue(kind, id) {
    const idStr = id === null || id === undefined ? "" : String(id).trim();
    if (!idStr) return "";
    if (!this.isNewUi) return idStr;
    const kindStr = (kind || "").toString().trim() || "project_firm";
    return `${kindStr}::${idStr}`;
  }

  _parseResponsibleOptionValue(value) {
    const raw = (value || "").toString().trim();
    if (!raw) return null;
    if (raw.startsWith("__legacy_responsible__")) return null;
    if (!this.isNewUi) {
      return { kind: "company", id: raw };
    }

    const sep = raw.indexOf("::");
    if (sep <= 0) return null;
    const kind = raw.slice(0, sep).trim();
    const id = raw.slice(sep + 2).trim();
    if (!kind || !id) return null;
    return { kind, id };
  }

  _normalizeResponsibleKind(kind) {
    const s = (kind || "").toString().trim().toLowerCase();
    if (!s) return "";
    if (s === "project_firm" || s === "global_firm") return s;
    if (s.includes("global")) return "global_firm";
    if (s.includes("project") || s.includes("local")) return "project_firm";
    if (["company", "firma", "firm"].includes(s)) return "";
    return s;
  }

  _findResponsibleOption(value) {
    const sel = this.selResponsible;
    if (!sel) return null;
    const target = (value || "").toString();
    return Array.from(sel.options || []).find((o) => String(o.value) === target) || null;
  }

  _clearLegacyResponsibleOption() {
    const sel = this.selResponsible;
    if (!sel) return;
    for (const opt of Array.from(sel.options || [])) {
      if (opt?.dataset?.legacyResponsible === "1") {
        opt.remove();
      }
    }
    if (String(sel.value || "").startsWith("__legacy_responsible__")) {
      sel.value = "";
    }
    this._respLegacyReadonly = false;
  }

  _setLegacyResponsibleOption(label) {
    const sel = this.selResponsible;
    if (!sel) return;
    const text = this._sanitizeResponsibleLabel(label);
    if (!text) {
      this._clearLegacyResponsibleOption();
      return;
    }

    let opt = Array.from(sel.options || []).find((o) => o?.dataset?.legacyResponsible === "1") || null;
    if (!opt) {
      opt = document.createElement("option");
      opt.dataset.legacyResponsible = "1";
      sel.appendChild(opt);
    }
    opt.value = "__legacy_responsible__";
    opt.textContent = text;
    sel.value = opt.value;
    this._respLegacyReadonly = true;
  }

  _resolveResponsibleSelection(top) {
    const rid = (top?.responsible_id ?? "").toString().trim();
    const rk = (top?.responsible_kind ?? "").toString().trim();
    const rl = this._sanitizeResponsibleLabel(top?.responsible_label);
    if (!rid) return { value: "", fallbackLabel: "" };
    if (!this.isNewUi) return { value: rid, fallbackLabel: "" };

    const candidates = this.projectFirms || [];
    if (!candidates.length) {
      return { value: "", fallbackLabel: rl || this._buildResponsibleDisplayLabel({ kind: rk, id: rid }) };
    }

    const exactKind = candidates.find((c) => String(c.kind) === rk && String(c.id) === rid);
    if (exactKind) {
      return { value: this._buildResponsibleOptionValue(exactKind.kind, exactKind.id), fallbackLabel: "" };
    }

    const mappedKind = this._normalizeResponsibleKind(rk);
    if (mappedKind) {
      const mapped = candidates.find((c) => String(c.kind) === mappedKind && String(c.id) === rid);
      if (mapped) {
        return { value: this._buildResponsibleOptionValue(mapped.kind, mapped.id), fallbackLabel: "" };
      }
    }

    const sameId = candidates.filter((c) => String(c.id) === rid);
    if (sameId.length === 1) {
      const only = sameId[0];
      return { value: this._buildResponsibleOptionValue(only.kind, only.id), fallbackLabel: "" };
    }

    if (sameId.length > 1 && rl) {
      const rlNorm = rl.toLocaleLowerCase("de-DE");
      const byLabel = sameId.find((c) => String(c.label || "").toLocaleLowerCase("de-DE") === rlNorm);
      if (byLabel) {
        return { value: this._buildResponsibleOptionValue(byLabel.kind, byLabel.id), fallbackLabel: "" };
      }
    }

    if (rl) {
      const rlNorm = rl.toLocaleLowerCase("de-DE");
      const byAnyLabel = candidates.filter(
        (c) => String(c.label || "").toLocaleLowerCase("de-DE") === rlNorm
      );
      if (byAnyLabel.length === 1) {
        const one = byAnyLabel[0];
        return { value: this._buildResponsibleOptionValue(one.kind, one.id), fallbackLabel: "" };
      }
    }

    return { value: "", fallbackLabel: rl || this._buildResponsibleDisplayLabel({ kind: rk, id: rid }) };
  }

  async _ensureProjectFirmsLoaded() {
    if (this._projectFirmsLoaded) return;
    if (this._projectFirmsLoading) return await this._projectFirmsLoading;

    const api = window.bbmDb || {};
    this._projectFirmsLoading = (async () => {
      if (!this.isNewUi) {
        if (typeof api.projectFirmsListByProject === "function") {
          const res = await api.projectFirmsListByProject(this.projectId);
          if (res?.ok) {
            const raw = (res.list || []).map((row) => ({
              ...row,
              kind: "company",
              id: row?.id ?? row?.firm_id ?? row?.firmId ?? null,
            }));
            this.projectFirms = this._normalizeResponsibleCandidates(raw);
          } else {
            this.projectFirms = [];
          }
        } else {
          this.projectFirms = [];
        }
        this._projectFirmsLoaded = true;
        return;
      }

      let list = [];
      if (this.isNewUi && typeof api.projectFirmsListFirmCandidatesByProject === "function") {
        const res = await api.projectFirmsListFirmCandidatesByProject(this.projectId);
        if (res?.ok) {
          const raw = res.list || res.items || [];
          list = this._normalizeResponsibleCandidates(raw);
        }
      }

      if (!list.length && typeof api.projectFirmsListByProject === "function") {
        const res = await api.projectFirmsListByProject(this.projectId);
        if (res?.ok) {
          const raw = (res.list || []).map((row) => ({
            ...row,
            kind: "company",
            id: row?.id ?? row?.firm_id ?? row?.firmId ?? null,
          }));
          list = this._normalizeResponsibleCandidates(raw);
        }
      }

      this.projectFirms = list;
      this._projectFirmsLoaded = true;
    })();

    try {
      await this._projectFirmsLoading;
    } finally {
      this._projectFirmsLoading = null;
    }
  }

  _computeRespOptionsKey(list) {
    const base = String(this.projectId || "");
    const parts = (list || []).map((f) => {
      const kind = (f?.kind || "").toString().trim();
      const id = (f?.id ?? f?.firm_id ?? f?.firmId ?? "").toString().trim();
      const label = this._buildResponsibleDisplayLabel(f);
      return `${kind}|${id}|${label}`;
    });
    return `${base}::${parts.join("#")}`;
  }

  _buildResponsibleOptionsIfNeeded() {
    if (!this.selResponsible) return;

    const key = this._computeRespOptionsKey(this.projectFirms || []);
    if (key === this._respOptionsKey) return;

    const sel = this.selResponsible;
    const current = (sel.value || "").toString();

    sel.innerHTML = "";
    this._respLegacyReadonly = false;

    const optAll = document.createElement("option");
    optAll.value = this._buildResponsibleOptionValue("all", "all");
    optAll.textContent = "alle";
    sel.appendChild(optAll);

    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "-";
    sel.appendChild(optEmpty);

    for (const f of this.projectFirms || []) {
      const value = this._buildResponsibleOptionValue(f?.kind, f?.id ?? f?.firm_id ?? f?.firmId ?? null);
      if (!value) continue;
      const label = this._buildResponsibleDisplayLabel(f);
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      opt.dataset.displayLabel = label;
      sel.appendChild(opt);
    }

    this._respOptionsKey = key;

    if (current && this._findResponsibleOption(current)) {
      sel.value = current;
    } else {
      sel.value = "";
    }
  }

  // ========= Layout helper (Sidebar/Header offsets) =========
  _isVisibleElement(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!r || r.width < 40 || r.height < 24) return false;
    const cs = window.getComputedStyle(el);
    if (!cs || cs.display === "none" || cs.visibility === "hidden") return false;
    return true;
  }

  _findSidebarCandidate() {
    const selectors = [
      "[data-bbm-sidebar]",
      "#sidebar",
      ".sidebar",
      ".bbm-sidebar",
      "[data-testid='sidebar']",
      "[aria-label='Sidebar']",
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (this._isVisibleElement(el)) return el;
    }

    const all = Array.from(document.querySelectorAll("aside, nav, [role='navigation']"));
    let best = null;
    let bestScore = 0;
    for (const el of all) {
      if (!this._isVisibleElement(el)) continue;
      const r = el.getBoundingClientRect();
      const nearLeft = r.left <= 4;
      const nearRight = Math.abs(window.innerWidth - r.right) <= 4;
      if (!nearLeft && !nearRight) continue;

      const score = r.height * r.width;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  _computeHeaderOffsetPx() {
    try {
      const bodyPt = parseFloat(window.getComputedStyle(document.body).paddingTop || "0") || 0;
      const htmlPt =
        parseFloat(window.getComputedStyle(document.documentElement).paddingTop || "0") || 0;
      const pt = Math.max(0, bodyPt, htmlPt);
      if (pt >= 24) return Math.round(pt);
    } catch (_) {}

    const bar = this.topBarEl;
    const prevVis = bar ? bar.style.visibility : "";
    const prevPE = bar ? bar.style.pointerEvents : "";

    if (bar) {
      bar.style.visibility = "hidden";
      bar.style.pointerEvents = "none";
    }

    try {
      const x = Math.max(10, Math.round(window.innerWidth * 0.3));
      const y = 2;

      const hit = document.elementFromPoint(x, y);
      if (!hit) return 0;

      let cur = hit;
      let best = null;
      let bestBottom = 0;

      while (cur && cur !== document.body && cur !== document.documentElement) {
        const cs = window.getComputedStyle(cur);
        if (cs) {
          const pos = cs.position;
          if (pos === "fixed" || pos === "sticky") {
            const r = cur.getBoundingClientRect();
            const wideEnough = r.width >= window.innerWidth * 0.6;
            const topish = r.top <= 2 && r.bottom >= 20;
            const heightOk = r.height >= 24 && r.height <= 240;

            if (wideEnough && topish && heightOk) {
              if (r.bottom > bestBottom) {
                best = cur;
                bestBottom = r.bottom;
              }
            }
          }
        }
        cur = cur.parentElement;
      }

      if (best) return Math.max(0, Math.round(bestBottom));

      const hr = hit.getBoundingClientRect();
      if (
        hr.top <= 2 &&
        hr.bottom >= 24 &&
        hr.height <= 240 &&
        hr.width >= window.innerWidth * 0.6
      ) {
        return Math.max(0, Math.round(hr.bottom));
      }

      return 0;
    } finally {
      if (bar) {
        bar.style.visibility = prevVis || "";
        bar.style.pointerEvents = prevPE || "";
      }
    }
  }

  _syncPinnedHorizontal(el) {
    if (!this.root || !el) return;

    const rootRect = this.root.getBoundingClientRect();
    if (!rootRect) return;

    let left = Math.round(rootRect.left);
    let right = Math.round(window.innerWidth - rootRect.right);

    const sidebarEl = this._findSidebarCandidate();
    if (sidebarEl && this._isVisibleElement(sidebarEl)) {
      const sr = sidebarEl.getBoundingClientRect();

      if (sr.left > window.innerWidth * 0.5 && sr.left < rootRect.right - 4) {
        right = Math.round(window.innerWidth - sr.left);
      }

      if (sr.right < window.innerWidth * 0.5 && sr.right > rootRect.left + 4) {
        left = Math.round(sr.right);
      }

      if (this._fixedHorzSidebarEl !== sidebarEl) {
        this._fixedHorzSidebarEl = sidebarEl;

        if (this._fixedHorzResizeObs) {
          try {
            this._fixedHorzResizeObs.disconnect();
          } catch (_) {}
          this._fixedHorzResizeObs = null;
        }

        if (typeof ResizeObserver !== "undefined") {
          this._fixedHorzResizeObs = new ResizeObserver(() => {
            this._syncPinnedBars();
          });
          try {
            this._fixedHorzResizeObs.observe(sidebarEl);
          } catch (_) {}
        }
      }
    }

    left = Math.max(0, left);
    right = Math.max(0, right);

    el.style.left = `${left}px`;
    el.style.right = `${right}px`;
  }

  _syncPinnedBars() {
    this._syncPinnedHorizontal(this.topBarEl);
    this._syncPinnedHorizontal(this.box);

    if (this.topBarEl) {
      const headerOff = this._computeHeaderOffsetPx();
      // ✅ direkt unter Header (kein extra gap)
      const gap = 0;
      this.topBarEl.style.top = `${headerOff + gap}px`;
    }
  }

  _formatDue(v) {
    if (!v) return "-";
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const y = s.slice(0, 4);
      const m = s.slice(5, 7);
      const d = s.slice(8, 10);
      return `${d}.${m}.${y}`;
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = String(d.getFullYear());
      return `${dd}.${mm}.${yy}`;
    }
    return s;
  }

  _formatStatus(v) {
    const s = (v || "").toString().trim();
    return s ? s : "—";
  }

  _formatResponsible(top) {
    const lbl = this._sanitizeResponsibleLabel(top?.responsible_label);
    if (!lbl) return "—";
    const max = 22;
    return lbl.length <= max ? lbl : lbl.slice(0, max - 1) + "…";
  }

  _ampelBaseDate() {
    if (this.meetingMeta && Number(this.meetingMeta.is_closed) === 1) {
      const raw = this.meetingMeta.updated_at || this.meetingMeta.updatedAt || null;
      if (raw) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
    return new Date();
  }

  _ampelColorPx(color) {
    return ampelHexFrom(color);
  }

  _makeAmpelDot(color, size = 10) {
    const dot = document.createElement("span");
    dot.style.display = "inline-block";
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.borderRadius = "999px";
    dot.style.flex = "0 0 auto";

    const bg = this._ampelColorPx(color);
    if (bg) {
      dot.style.background = bg;
      dot.style.border = "1px solid rgba(0,0,0,0.25)";
    } else {
      dot.style.background = "transparent";
      dot.style.border = "1px solid #ccc";
    }
    return dot;
  }

  _applyAmpelDotColor(dot, color) {
    if (!dot) return;
    const bg = this._ampelColorPx(color);
    if (bg) {
      dot.style.background = bg;
      dot.style.border = "1px solid rgba(0,0,0,0.25)";
    } else {
      dot.style.background = "transparent";
      dot.style.border = "1px solid #ccc";
    }
    dot.title = color ? String(color) : "";
  }

  _parseYmdDate(value) {
    const s = (value || "").toString().trim();
    if (!s) return null;
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  _todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  _computeDueAmpelColor(status, dueDateStr) {
    const st = (status || "").toString().trim().toLowerCase();
    return st === "erledigt"
      ? "gruen"
      : st === "blockiert" || st === "verzug"
      ? "rot"
      : !this._parseYmdDate(dueDateStr)
      ? "grau"
      : this._parseYmdDate(dueDateStr).getTime() < this._todayStart().getTime()
      ? "rot"
      : this._parseYmdDate(dueDateStr).getTime() <=
        this._todayStart().getTime() + 3 * 24 * 60 * 60 * 1000
      ? "orange"
      : "gruen";
  }

  _updateDueAmpelFromInputs() {
    const dueVal = (this.inpDueDate?.value || "").trim();
    const statusVal = (this.selStatus?.value || "").trim() || "offen";
    const t = this.selectedTop;
    const overrides = new Map();
    if (t && t.id) {
      overrides.set(String(t.id), { ...t, status: statusVal, due_date: dueVal || null });
    }
    const ampelCompute = createAmpelComputer(this.items || [], this._ampelBaseDate(), overrides);
    const color = t ? ampelCompute(t) : null;
    this._applyAmpelDotColor(this.dueAmpelEl, color);
  }

  _isDoneStatus(status) {
    const st = (status || "").toString().trim().toLowerCase();
    return st === "erledigt";
  }

  _shouldHideDoneTop(top) {
    if (Number(top?.is_hidden ?? top?.isHidden ?? 0) === 1) return true;
    const meeting = this.meetingMeta || { id: this.meetingId };
    return !shouldShowTopForMeeting(top, meeting);
  }

  _updateTopBarMetaLabels() {
    if (!this.topMetaEl) return;

    const on = !!this.showLongtextInList;

    // ✅ Platz immer reservieren -> keine Sprünge
    this.topMetaEl.style.visibility = on ? "visible" : "hidden";
    this.topMetaEl.style.pointerEvents = on ? "auto" : "none";
    this.topMetaEl.style.opacity = on ? "0.65" : "0";
    this.topMetaEl.style.borderLeft = on ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent";

    if (!on) {
      this.topMetaEl.textContent = "";
      return;
    }

    this.topMetaEl.textContent = "";

    const mk = (txt) => {
      const d = document.createElement("div");
      d.textContent = txt;
      d.style.whiteSpace = "nowrap";
      return d;
    };

    this.topMetaEl.append(mk("Fertig bis"), mk("Status"), mk("verantw"));
  }

  render() {
    const root = document.createElement("div");
    if (!this._fontScaleListenerBound) {
      this._fontScaleListenerBound = true;
      this._onFontScaleChanged = () => {
        this._loadListFontScaleSetting(true)
          .then(() => {
            if (this.listEl) this._renderListOnly();
          })
          .catch(() => {});
        this._loadEditFontScaleSetting(true)
          .then(() => {
            this._applyEditFontSizes();
          })
          .catch(() => {});
      };
      window.addEventListener("bbm:tops-fontscale-changed", this._onFontScaleChanged);
    }
    if (!this._topsLimitsListenerBound) {
      this._onTopLimitsChanged = async () => {
        await this._loadTextLimitsSetting();
      };
      window.addEventListener("bbm:tops-limits-changed", this._onTopLimitsChanged);
      this._topsLimitsListenerBound = true;
    }

    const BTN_MIN_H = "26px";
    const BTN_PAD = "2px 8px";
    const BTN_PAD_ACTION = "3px 9px";
    const BTN_RADIUS = "6px";

    // ✅ feste Höhe der Buttonbar (ausgerichtet auf "Langtext an")
    const TOPBAR_H = 56; // px

    const styleBtnBase = (b) => {
      b.style.minHeight = BTN_MIN_H;
      b.style.padding = BTN_PAD;
      b.style.borderRadius = BTN_RADIUS;
      b.style.flex = "0 0 auto";
    };

    // "Protokoll schließen"
    const btnEndMeeting = document.createElement("button");
    btnEndMeeting.textContent = "Protokoll schließen";
    btnEndMeeting.style.background = "#ef6c00";
    btnEndMeeting.style.color = "white";
    btnEndMeeting.style.border = "1px solid rgba(0,0,0,0.25)";
    styleBtnBase(btnEndMeeting);
    btnEndMeeting.onclick = async () => {
      if (this._busy) return;

      const defDate = this._computeNextMeetingDefaultDateIso();
      const promptRes = await this.router?.promptNextMeetingSettings?.({
        defaultDateIso: defDate,
      });
      if (promptRes?.cancelled) return;
      const nextMeetingInput = promptRes?.data || {};

      const closePayload = {
        meetingId: this.meetingId,
        pdf_show_ampel: this.showAmpelInList ? 1 : 0,
        nextMeeting: {
          enabled: String(nextMeetingInput["print.nextMeeting.enabled"] ?? "").trim(),
          date: String(nextMeetingInput["print.nextMeeting.date"] || "").trim(),
          time: String(nextMeetingInput["print.nextMeeting.time"] || "").trim(),
          place: String(nextMeetingInput["print.nextMeeting.place"] || "").trim(),
          extra: String(nextMeetingInput["print.nextMeeting.extra"] || "").trim(),
        },
      };

      const attemptClose = async () => {
        try {
          if (typeof window.bbmDb?.topsPurgeTrashedByMeeting === "function") {
            const purgeRes = await window.bbmDb.topsPurgeTrashedByMeeting({
              meetingId: this.meetingId,
            });
            if (purgeRes?.ok === false) {
              console.warn("[tops] purgeTrashedByMeeting failed before close:", purgeRes.error);
            }
          }
        } catch (err) {
          console.warn("[tops] purgeTrashedByMeeting error before close:", err);
        }

        const res = await window.bbmDb.meetingsClose(closePayload);
        if (res?.ok) {
          if (Array.isArray(res?.warnings) && res.warnings.length > 0) {
            alert(`Hinweis beim Schließen:\n${res.warnings.join("\n")}`);
          }
          await this.router.showProjects();
          return;
        }

        if (res?.errorCode === "NUM_GAP") {
          const gap = (res.gaps || [])[0] || null;
          this._setMarkedTopIds(res.markTopIds || []);
          await this._showNumberGapPopup({
            gap,
            onCancel: () => {
              this._clearMarkedTopIds();
            },
            onConfirm: async () => {
              const fixRes = await window.bbmDb.meetingTopsFixNumberGap({
                meetingId: this.meetingId,
                level: gap?.level,
                parentTopId: gap?.parentTopId ?? null,
                fromTopId: gap?.lastTopId,
                toNumber: gap?.missingNumber,
              });

              if (!fixRes?.ok) {
                alert(fixRes?.error || fixRes?.errorCode || "Reparatur fehlgeschlagen");
                return;
              }

              this._clearGapPopup();
              this._clearMarkedTopIds();
              await this.reloadList(true);
              await attemptClose();
            },
          });
          return;
        }

        alert(res?.error || "Schließen fehlgeschlagen");
      };

      await attemptClose();
    };

    // "zurück"
    const btnCloseMeeting = document.createElement("button");
    btnCloseMeeting.textContent = "zurück";
    btnCloseMeeting.style.background = "#f3f3f3";
    btnCloseMeeting.style.color = "#333";
    btnCloseMeeting.style.border = "1px solid #ddd";
    styleBtnBase(btnCloseMeeting);
    btnCloseMeeting.onclick = async () => {
      if (this._busy) return;
      await this.router.showProjects();
    };

    // + Titel
    const btnL1 = document.createElement("button");
    btnL1.textContent = "+ Titel";
    btnL1.style.border = "1px solid #ddd";
    btnL1.style.background = "#f3f3f3";
    styleBtnBase(btnL1);
    btnL1.onclick = () => this.createTop(1, null);

    // + TOP
    const btnChild = document.createElement("button");
    btnChild.textContent = "+ TOP";
    btnChild.style.border = "1px solid #ddd";
    btnChild.style.background = "#f3f3f3";
    styleBtnBase(btnChild);
    btnChild.onclick = () => {
      const activeTop = this.selectedTop || this._findTopById(this.selectedTopId);

      if (!activeTop) {
        alert("Bitte zuerst einen TOP auswaehlen. '+ TOP' legt nur Level 2 bis 4 an.");
        return;
      }

      if (this._userSelectedTop) {
        const nextLevel = Number(activeTop.level) + 1;
        if (nextLevel > 4) {
          alert("Maximale TOP-Tiefe erreicht (Level 4).");
          return;
        }
        this.createTop(nextLevel, activeTop.id);
        return;
      }

      const siblingLevel = Number(activeTop.level);
      if (siblingLevel < 2) {
        this.createTop(2, activeTop.id);
        return;
      }
      if (siblingLevel > 4) {
        alert("Maximale TOP-Tiefe erreicht (Level 4).");
        return;
      }
      const parentId = activeTop.parent_top_id || null;
      this.createTop(siblingLevel, parentId);
    };

    // Langtext Toggle (stabile Breite)
    const btnLongToggle = document.createElement("button");
    btnLongToggle.type = "button";
    btnLongToggle.style.display = "inline-flex";
    btnLongToggle.style.alignItems = "center";
    btnLongToggle.style.justifyContent = "center";
    btnLongToggle.style.gap = "6px";
    btnLongToggle.style.padding = BTN_PAD;
    btnLongToggle.style.borderRadius = BTN_RADIUS;
    btnLongToggle.style.cursor = "pointer";
    btnLongToggle.style.border = "1px solid #ddd";
    btnLongToggle.style.background = "#f3f3f3";
    btnLongToggle.style.minHeight = BTN_MIN_H;
    btnLongToggle.style.flex = "0 0 auto";
    btnLongToggle.style.minWidth = "118px";
    btnLongToggle.title = "Langtext in der TOP-Liste anzeigen/ausblenden";

    const updateLongToggleUi = () => {
      const on = !!this.showLongtextInList;
      btnLongToggle.textContent = on ? "Langtext an" : "Langtext aus";
      btnLongToggle.style.background = on ? "#eef7ff" : "#f3f3f3";
      btnLongToggle.style.border = on ? "1px solid #b6d4ff" : "1px solid #ddd";
      btnLongToggle.style.color = on ? "#0b4db4" : "";
      this._updateTopBarMetaLabels();
    };

    btnLongToggle.onclick = () => {
      this.showLongtextInList = !this.showLongtextInList;
      updateLongToggleUi();
      this._renderListOnly();
      this._saveLongtextSetting().catch(() => {});
    };

    btnLongToggle.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      btnLongToggle.click();
    });

    this._loadLongtextSetting()
      .then(() => {
        updateLongToggleUi();
        this._renderListOnly();
      })
      .catch(() => {});

    this._loadListFontScaleSetting()
      .then(() => {
        this._renderListOnly();
      })
      .catch(() => {});

    this._loadEditFontScaleSetting()
      .then(() => {
        this._applyEditFontSizes();
      })
      .catch(() => {});

    // Ampel Toggle
    const btnAmpelToggle = document.createElement("button");
    btnAmpelToggle.type = "button";
    btnAmpelToggle.style.display = "inline-flex";
    btnAmpelToggle.style.alignItems = "center";
    btnAmpelToggle.style.justifyContent = "center";
    btnAmpelToggle.style.gap = "6px";
    btnAmpelToggle.style.padding = BTN_PAD;
    btnAmpelToggle.style.borderRadius = BTN_RADIUS;
    btnAmpelToggle.style.cursor = "pointer";
    btnAmpelToggle.style.border = "1px solid #ddd";
    btnAmpelToggle.style.background = "#f3f3f3";
    btnAmpelToggle.style.minHeight = BTN_MIN_H;
    btnAmpelToggle.style.flex = "0 0 auto";
    btnAmpelToggle.style.minWidth = "118px";
    btnAmpelToggle.title = "Ampel an/aus";

    const updateAmpelToggleUi = () => {
      const on = !!this.showAmpelInList;
      btnAmpelToggle.textContent = on ? "Ampel an" : "Ampel aus";
      btnAmpelToggle.style.background = on ? "#eef7ff" : "#f3f3f3";
      btnAmpelToggle.style.border = on ? "1px solid #b6d4ff" : "1px solid #ddd";
      btnAmpelToggle.style.color = on ? "#0b4db4" : "";
    };

    btnAmpelToggle.onclick = () => {
      this.showAmpelInList = !this.showAmpelInList;
      updateAmpelToggleUi();
      this._applyAmpelVisibility();
      this._renderListOnly();
      this._saveAmpelSetting().catch(() => {});
    };

    btnAmpelToggle.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      btnAmpelToggle.click();
    });

    // Topbar: fixed
    const topBar = document.createElement("div");
    topBar.style.position = "fixed";
    topBar.style.top = "0"; // wird in _syncPinnedBars gesetzt
    topBar.style.left = "0";
    topBar.style.right = "0";

    // ✅ feste Höhe (keine Sprünge), etwas kompakter gepaddet
    topBar.style.height = `${TOPBAR_H}px`;
    topBar.style.minHeight = `${TOPBAR_H}px`;
    topBar.style.maxHeight = `${TOPBAR_H}px`;

    topBar.style.padding = "2px 12px";
    topBar.style.display = "flex";
    topBar.style.alignItems = "center";
    topBar.style.gap = "8px";
    topBar.style.flexWrap = "nowrap";
    topBar.style.overflowX = "auto";
    topBar.style.overflowY = "hidden";

    topBar.style.background = "#fff";
    topBar.style.borderBottom = "1px solid #ddd";
    topBar.style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)";
    topBar.style.zIndex = "5";

    const topsText = document.createElement("div");
    topsText.textContent = "Protokoll bearbeiten";
    topsText.style.fontWeight = "600";
    topsText.style.whiteSpace = "nowrap";
    topsText.style.flex = "0 0 auto";

    const spacer = document.createElement("div");
    spacer.style.flex = "1 1 auto";

    // Feldbezeichnungen rechts über Meta-Spalte (Platz immer reserviert)
    const topMeta = document.createElement("div");
    topMeta.style.display = "flex";
    topMeta.style.flexDirection = "column";
    topMeta.style.alignItems = "flex-start";
    topMeta.style.textAlign = "left";
    topMeta.style.gap = "1px";
    topMeta.style.fontSize = "11px";
    topMeta.style.lineHeight = "1.05";
    topMeta.style.fontVariantNumeric = "tabular-nums";
    topMeta.style.whiteSpace = "nowrap";

    topMeta.style.flex = `0 0 ${this.META_COL_W}px`;
    topMeta.style.width = `${this.META_COL_W}px`;
    topMeta.style.paddingLeft = "10px";

    topMeta.style.visibility = "hidden";
    topMeta.style.pointerEvents = "none";
    topMeta.style.opacity = "0";
    topMeta.style.borderLeft = "1px solid transparent";

    // Reihenfolge rechts: Spacer, Protokoll schließen + Schalter, Labels (ganz rechts)
    topBar.append(
      topsText,
      spacer,
      btnEndMeeting,
      btnAmpelToggle,
      btnLongToggle,
      btnCloseMeeting,
      topMeta
    );

    const list = document.createElement("ul");
    list.style.paddingLeft = "0";
    list.style.margin = "0";
    list.style.paddingTop = "64px"; // wird dynamisch überschrieben
    list.style.paddingBottom = "320px";

    // Editbox fixed bottom
    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.bottom = "0";
    box.style.margin = "0";
    box.style.padding = "12px";
    box.style.borderTop = "1px solid #ddd";
    box.style.borderLeft = "0";
    box.style.borderRight = "0";
    box.style.borderBottom = "0";
    box.style.borderRadius = "0";
    box.style.background = "#fafafa";
    box.style.boxShadow = "0 -2px 10px rgba(0,0,0,0.12)";
    box.style.zIndex = "10";
    box.style.maxHeight = "45vh";
    box.style.overflow = "auto";
    box.style.left = "0";
    box.style.right = "0";

    const boxHeader = document.createElement("div");
    boxHeader.style.display = "flex";
    boxHeader.style.alignItems = "center";
    boxHeader.style.gap = "10px";
    boxHeader.style.marginBottom = "8px";

    const boxTitle = document.createElement("div");
    boxTitle.textContent = "TOP bearbeiten";
    boxTitle.style.color = "#1b5e20";
    boxTitle.style.fontWeight = "600";
    boxTitle.style.whiteSpace = "nowrap";
    boxTitle.style.minWidth = "7.5cm";
    boxTitle.style.maxWidth = "7.5cm";
    boxTitle.style.overflow = "hidden";
    boxTitle.style.textOverflow = "ellipsis";

    const addActions = document.createElement("div");
    addActions.style.display = "inline-flex";
    addActions.style.alignItems = "center";
    addActions.style.gap = "8px";
    addActions.style.marginLeft = "1.5cm";
    addActions.append(btnL1, btnChild);

    const headerActions = document.createElement("div");
    headerActions.style.display = "inline-flex";
    headerActions.style.alignItems = "center";
    headerActions.style.gap = "8px";
    headerActions.style.flexWrap = "wrap";
    headerActions.style.marginLeft = "auto";

    const btnMove = document.createElement("button");
    btnMove.textContent = "Schieben";
    btnMove.style.borderRadius = BTN_RADIUS;
    btnMove.style.padding = BTN_PAD_ACTION;
    btnMove.style.minHeight = BTN_MIN_H;
    btnMove.onclick = () => this.toggleMoveMode();

    const btnSaveTop = document.createElement("button");
    btnSaveTop.textContent = "Speichern";
    btnSaveTop.style.borderRadius = BTN_RADIUS;
    btnSaveTop.style.padding = BTN_PAD_ACTION;
    btnSaveTop.style.minHeight = BTN_MIN_H;

    btnSaveTop.addEventListener("mousedown", () => {
      this._suppressBlurOnce = true;
    });

    btnSaveTop.onclick = async () => {
      if (this.isReadOnly) return;
      if (!this.selectedTop) return;

      const patch = this._collectEditorPatch();
      if (!patch) return;

      await this._saveMeetingTopPatch(patch, { reload: true, pulse: true });
    };

    const btnTrashTop = document.createElement("button");
    btnTrashTop.textContent = "Papierkorb";
    btnTrashTop.title = "In Papierkorb (wie Ausblenden)";
    btnTrashTop.style.background = "#fdd835";
    btnTrashTop.style.color = "#1f1f1f";
    btnTrashTop.style.border = "1px solid rgba(0,0,0,0.25)";
    btnTrashTop.style.borderRadius = BTN_RADIUS;
    btnTrashTop.style.padding = BTN_PAD_ACTION;
    btnTrashTop.style.minHeight = BTN_MIN_H;
    btnTrashTop.addEventListener("pointerdown", (e) => {
      this._suppressBlurOnce = true;
      e.preventDefault();
    });
    btnTrashTop.onclick = async (e) => {
      e.preventDefault();
      this._suppressBlurOnce = true;
      await this.moveSelectedTopToTrash();
    };

    headerActions.append(btnMove, btnSaveTop, btnTrashTop);
    boxHeader.append(boxTitle, addActions, headerActions);

    // Editor
    const makeCountBadge = (initialText) => {
      const b = document.createElement("span");
      b.style.fontSize = "12px";
      b.style.opacity = "0.9";
      b.title = "Restliche Zeichen";
      b.textContent = initialText;
      b.style.padding = "1px 7px";
      b.style.border = "1px solid #ddd";
      b.style.borderRadius = "999px";
      b.style.background = "#fff";
      b.style.minWidth = "34px";
      b.style.textAlign = "right";
      b.style.fontVariantNumeric = "tabular-nums";
      return b;
    };

    const makeToggleLabel = (text, inputEl) => {
      const lab = document.createElement("label");
      lab.style.display = "inline-flex";
      lab.style.alignItems = "center";
      lab.style.gap = "6px";
      lab.style.cursor = "pointer";
      lab.style.userSelect = "none";
      const t = document.createElement("span");
      t.textContent = text;
      lab.append(inputEl, t);
      return lab;
    };

    const inpTitle = document.createElement("input");
    inpTitle.type = "text";
    inpTitle.placeholder = "Kurztext…";
    inpTitle.style.width = "100%";
    inpTitle.style.fontFamily = "Calibri, Arial, sans-serif";
    inpTitle.maxLength = this._titleMax();
    inpTitle.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (this.taLongtext && !this.taLongtext.disabled) {
        this.taLongtext.focus();
      }
    });

    const chkImportant = document.createElement("input");
    chkImportant.type = "checkbox";

    const chkHidden = document.createElement("input");
    chkHidden.type = "checkbox";

    const titleWrap = document.createElement("div");
    titleWrap.style.display = "flex";
    titleWrap.style.flexDirection = "column";
    titleWrap.style.gap = "4px";

    const titleLabelRow = document.createElement("div");
    titleLabelRow.style.display = "flex";
    titleLabelRow.style.alignItems = "center";
    titleLabelRow.style.gap = "10px";

    const lblTitleText = document.createElement("span");
    lblTitleText.textContent = "Kurztext";

    const titleCount = makeCountBadge(`${this._titleMax()}`);

    const labImportant = makeToggleLabel("wichtig", chkImportant);
    const labHidden = makeToggleLabel("TOP ausblenden", chkHidden);

    const titleLeft = document.createElement("div");
    titleLeft.style.display = "inline-flex";
    titleLeft.style.alignItems = "center";
    titleLeft.style.gap = "10px";
    titleLeft.append(lblTitleText, titleCount, labImportant);

    const titleRight = document.createElement("div");
    titleRight.style.display = "inline-flex";
    titleRight.style.alignItems = "center";
    titleRight.style.gap = "10px";
    titleRight.style.marginLeft = "auto";
    titleRight.append(labHidden);

    titleLabelRow.append(titleLeft, titleRight);
    titleWrap.append(titleLabelRow, inpTitle);

    const longWrap = document.createElement("div");
    longWrap.style.display = "flex";
    longWrap.style.flexDirection = "column";
    longWrap.style.gap = "4px";
    longWrap.style.marginTop = "10px";

    const longLabelRow = document.createElement("div");
    longLabelRow.style.display = "flex";
    longLabelRow.style.alignItems = "center";
    longLabelRow.style.gap = "10px";

    const lblLongText = document.createElement("span");
    lblLongText.textContent = "Langtext";

    const longCount = makeCountBadge(`${this._longMax()}`);

    const longLeft = document.createElement("div");
    longLeft.style.display = "inline-flex";
    longLeft.style.alignItems = "center";
    longLeft.style.gap = "10px";
    longLeft.append(lblLongText, longCount);

    longLabelRow.append(longLeft);

    const taLong = document.createElement("textarea");
    taLong.rows = 4;
    taLong.placeholder = "Langtext…";
    taLong.style.width = "100%";
    taLong.style.fontFamily = "Calibri, Arial, sans-serif";
    taLong.maxLength = this._longMax();
    // Hinweis: Enter = neue Zeile, Ctrl/Cmd+Enter = Speichern
    taLong.title = "Enter: neue Zeile · Ctrl/Cmd+Enter: speichern";

    longWrap.append(longLabelRow, taLong);

    const editorRow = document.createElement("div");
    editorRow.style.display = "flex";
    editorRow.style.alignItems = "stretch";
    editorRow.style.gap = "12px";

    const leftCol = document.createElement("div");
    leftCol.style.display = "flex";
    leftCol.style.flexDirection = "column";
    leftCol.style.gap = "10px";
    leftCol.style.flex = "1 1 auto";
    leftCol.append(titleWrap, longWrap);

    const sep = document.createElement("div");
    sep.style.width = "1px";
    sep.style.background = "rgba(0,0,0,0.15)";
    sep.style.alignSelf = "stretch";
    sep.style.margin = "0 6px";

    const metaCol = document.createElement("div");
    metaCol.style.display = "flex";
    metaCol.style.flexDirection = "column";
    metaCol.style.gap = "10px";
    metaCol.style.flex = "0 0 114px";
    metaCol.style.width = "114px";
    metaCol.style.minWidth = "114px";
    metaCol.style.maxWidth = "120px";
    metaCol.style.paddingLeft = "6px";

    const mkMetaField = (labelText) => {
      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.gap = "4px";

      const lab = document.createElement("span");
      lab.textContent = labelText;
      lab.style.fontSize = "12px";
      lab.style.opacity = "0.8";

      wrap.append(lab);
      return wrap;
    };

    const dueWrap = mkMetaField("Fertig bis");
    const dueRow = document.createElement("div");
    dueRow.style.display = "flex";
    dueRow.style.alignItems = "center";
    dueRow.style.gap = "6px";
    const inpDueDate = document.createElement("input");
    inpDueDate.type = "date";
    inpDueDate.style.width = "100%";
    inpDueDate.style.flex = "1 1 auto";
    inpDueDate.style.marginLeft = "-3mm";
    inpDueDate.style.width = "calc(100% + 3mm)";
    const dueAmpel = this._makeAmpelDot("grau", 11);
    dueAmpel.style.display = this.showAmpelInList ? "inline-block" : "none";
    dueRow.append(inpDueDate, dueAmpel);
    dueWrap.append(dueRow);

    const statusWrap = mkMetaField("Status");
    const selStatus = document.createElement("select");
    selStatus.style.width = "100%";
    selStatus.style.marginLeft = "-3mm";
    selStatus.style.width = "calc(100% + 3mm)";
    const statusOptions = ["offen", "in arbeit", "erledigt", "blockiert", "verzug"];
    for (const v of statusOptions) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selStatus.appendChild(opt);
    }
    statusWrap.append(selStatus);

    const respWrap = mkMetaField("Verantw.");
    const selResponsible = document.createElement("select");
    selResponsible.style.width = "100%";
    selResponsible.style.marginLeft = "-3mm";
    selResponsible.style.width = "calc(100% + 3mm)";
    respWrap.append(selResponsible);

    metaCol.append(dueWrap, statusWrap, respWrap);
    editorRow.append(leftCol, sep, metaCol);

    box.append(boxHeader, editorRow);

    root.append(topBar, list, box);

    // refs
    this.root = root;
    this.listEl = list;

    this.btnL1 = btnL1;
    this.btnChild = btnChild;

    this.btnEndMeeting = btnEndMeeting;
    this.btnCloseMeeting = btnCloseMeeting;
    this.btnLongToggle = btnLongToggle;
    this.btnAmpelToggle = btnAmpelToggle;

    this.topBarEl = topBar;
    this.box = box;
    this.editMetaCol = metaCol;
    this.editMetaSep = sep;

    this.inpTitle = inpTitle;
    this.taLongtext = taLong;
    this.inpDueDate = inpDueDate;
    this.selStatus = selStatus;
    this.selResponsible = selResponsible;
    this.dueAmpelEl = dueAmpel;

    this.chkImportant = chkImportant;
    this.chkHidden = chkHidden;

    this.titleCountEl = titleCount;
    this.longCountEl = longCount;
    this.boxTitleEl = boxTitle;

    this._applyEditFontSizes();

    this.btnSaveTop = btnSaveTop;
    this.btnTrashTop = btnTrashTop;
    this.saveInfoEl = null;

    this.btnMove = btnMove;

    this.topMetaEl = topMeta;
    this._updateAmpelToggleUi = updateAmpelToggleUi;
    updateAmpelToggleUi();

    // layout spacers
    const updateEditBoxSpacer = () => {
      if (!this.listEl || !this.box) return;
      const h = Math.ceil(this.box.getBoundingClientRect().height || 0);
      const pad = Math.max(0, h + 16);
      this.listEl.style.paddingBottom = `${pad}px`;
    };

    const updateTopBarSpacer = () => {
      if (!this.listEl || !this.topBarEl) return;
      const h = Math.ceil(this.topBarEl.getBoundingClientRect().height || 0);
      this.listEl.style.paddingTop = `${Math.max(0, h + 8)}px`;
    };

    if (this._fixedResizeObs) {
      try {
        this._fixedResizeObs.disconnect();
      } catch (_) {}
      this._fixedResizeObs = null;
    }

    if (typeof ResizeObserver !== "undefined") {
      this._fixedResizeObs = new ResizeObserver(() => {
        updateEditBoxSpacer();
        updateTopBarSpacer();
        this._syncPinnedBars();
      });
      this._fixedResizeObs.observe(box);
      this._fixedResizeObs.observe(topBar);
      this._fixedResizeObs.observe(root);
    }

    const syncLoop = (n) => {
      requestAnimationFrame(() => {
        updateEditBoxSpacer();
        updateTopBarSpacer();
        this._syncPinnedBars();
        if (n > 0) syncLoop(n - 1);
      });
    };
    syncLoop(8);

    requestAnimationFrame(() => {
      updateEditBoxSpacer();
      updateTopBarSpacer();
      this._syncPinnedBars();
    });

    // editor handlers
    const blurGuard = this._blurGuard.bind(this);

    inpTitle.addEventListener("input", () => {
      this._updateCharCounters();
    });

    inpTitle.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      if (inpTitle.disabled || !this.selectedTop) return;
      e.preventDefault();
      this._suppressBlurOnce = true;

      const v = this._normTitle(inpTitle.value);
      inpTitle.value = this._clampStr(v, this._titleMax());
      this._updateCharCounters();

      await this._saveMeetingTopPatch({ title: v }, { reload: true, pulse: false });
      this.btnL1?.focus();
    });

    inpTitle.addEventListener(
      "blur",
      blurGuard(async () => {
        if (inpTitle.disabled || !this.selectedTop) return;
        const v = this._normTitle(inpTitle.value);
        inpTitle.value = this._clampStr(v, this._titleMax());
        this._updateCharCounters();

        await this._saveMeetingTopPatch({ title: v }, { reload: true, pulse: false });
      })
    );

    taLong.addEventListener("input", () => {
      this._updateCharCounters();
    });

    // ✅ Änderung: Enter erzeugt Zeilenumbruch; Ctrl/Cmd+Enter speichert
    taLong.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      if (taLong.disabled || !this.selectedTop) return;

      const isCtrlOrCmd = !!(e.ctrlKey || e.metaKey);
      if (!isCtrlOrCmd) {
        // normaler Enter -> Zeilenumbruch zulassen
        return;
      }

      // Ctrl/Cmd+Enter -> speichern (ohne Zeilenumbruch)
      e.preventDefault();
      this._suppressBlurOnce = true;

      const v = this._normLong(taLong.value);
      taLong.value = this._clampStr(taLong.value, this._longMax());
      this._updateCharCounters();

      await this._saveMeetingTopPatch({ longtext: v }, { reload: true, pulse: false });
      this.btnL1?.focus();
    });

    taLong.addEventListener(
      "blur",
      blurGuard(async () => {
        if (taLong.disabled || !this.selectedTop) return;
        const v = this._normLong(taLong.value);
        taLong.value = this._clampStr(taLong.value, this._longMax());
        this._updateCharCounters();

        await this._saveMeetingTopPatch({ longtext: v }, { reload: true, pulse: false });
      })
    );

    inpDueDate.addEventListener("change", async () => {
      if (this.isReadOnly) return;
      if (inpDueDate.disabled) return;
      if (!this.selectedTop) return;
      const dueVal = (inpDueDate.value || "").trim();
      await this._saveMeetingTopPatch({ due_date: dueVal || null }, { reload: true, pulse: true });
    });

    selStatus.addEventListener("change", async () => {
      if (this.isReadOnly) return;
      if (selStatus.disabled) return;
      if (!this.selectedTop) return;
      const st = (selStatus.value || "").trim() || "offen";
      const completedIn = this._isDoneStatus(st) ? this.meetingId : null;
      this._updateDueAmpelFromInputs();
      await this._saveMeetingTopPatch(
        { status: st, completed_in_meeting_id: completedIn },
        { reload: true, pulse: true }
      );
      this._renderListOnly();
    });

    selResponsible.addEventListener("change", async () => {
      if (this.isReadOnly || this._busy) return;
      if (selResponsible.disabled) return;
      if (!this.selectedTop) return;

      const val = (selResponsible.value || "").toString();
      const parsed = this._parseResponsibleOptionValue(val);
      this._respDirty = true;
      this._respDirtyTopId = this.selectedTop.id;

      if (!parsed?.id) {
        const res = await this._saveMeetingTopPatch(
          { responsible_kind: null, responsible_id: null, responsible_label: null },
          { reload: false, pulse: true }
        );
        if (res?.ok) {
          if (this.selectedTop) {
            this.selectedTop.responsible_kind = null;
            this.selectedTop.responsible_id = null;
            this.selectedTop.responsible_label = null;
          }
          this._respDirty = false;
          this._respDirtyTopId = null;
          this._respLastSetTopId = this.selectedTop ? this.selectedTop.id : null;
          this._renderListOnly();
        }
        return;
      }

      const lbl = this._getResponsibleLabelForSelection(selResponsible, parsed);
      const res = await this._saveMeetingTopPatch(
        {
          responsible_kind: parsed.kind || "company",
          responsible_id: String(parsed.id),
          responsible_label: lbl,
        },
        { reload: false, pulse: true }
      );
      if (res?.ok) {
        if (this.selectedTop) {
          this.selectedTop.responsible_kind = parsed.kind || "company";
          this.selectedTop.responsible_id = String(parsed.id);
          this.selectedTop.responsible_label = lbl;
        }
        this._respDirty = false;
        this._respDirtyTopId = null;
        this._respLastSetTopId = this.selectedTop ? this.selectedTop.id : null;
      }
    });

    chkImportant.addEventListener("change", async () => {
      if (this.isReadOnly) return;
      if (chkImportant.disabled) return;
      if (!this.selectedTop) return;

      await this._saveMeetingTopPatch(
        { is_important: chkImportant.checked ? 1 : 0 },
        { reload: true, pulse: true }
      );
    });

    chkHidden.addEventListener("change", async () => {
      if (this.isReadOnly) return;
      if (chkHidden.disabled) return;
      if (!this.selectedTop) return;

      const hideNow = chkHidden.checked;
      const selectedId = this.selectedTop.id;
      const savePromise = this._saveMeetingTopPatch(
        { is_hidden: hideNow ? 1 : 0 },
        { reload: false, pulse: false }
      );

      if (hideNow) {
        if (this.selectedTop && this._sameTopId(this.selectedTop.id, selectedId)) {
          this.selectedTop.is_hidden = 1;
        }
        const item = this._findTopById(selectedId);
        if (item) item.is_hidden = 1;
        this.selectedTopId = null;
        this.selectedTop = null;
        this._renderListOnly();
        this.applyEditBoxState();
      }

      const res = await savePromise;
      if (!res?.ok) {
        await this.reloadList(true);
        return;
      }

      if (!hideNow) {
        await this.reloadList(false);
      }
    });

    // init
    updateLongToggleUi();
    this._updateCharCounters();
    this._updateTopBarMetaLabels();

    return root;
  }

  async load() {
    await this._loadAmpelSetting();
    await this._loadTextLimitsSetting();
    await this.reloadList(true);
    this._ensureProjectFirmsLoaded().catch(() => {});
    this.applyEditBoxState();
  }

  _applyReadOnlyState() {
    const ro = !!this.isReadOnly;
    const busy = !!this._busy;
    if (this.btnL1) this.btnL1.disabled = ro || busy;
    this._updateCreateChildControls();

    if (this.box) {
      this.box.style.display = ro ? "none" : "";
      if (this.listEl) {
        const h = Math.ceil(this.box.getBoundingClientRect().height || 0);
        const pad = Math.max(0, h + 16);
        this.listEl.style.paddingBottom = `${pad}px`;
      }
    }

    if (this.btnEndMeeting) {
      // "Protokoll schließen" darf immer schließen (auch bei read-only),
      // nur bei busy sperren.
      this.btnEndMeeting.disabled = busy;
      this.btnEndMeeting.style.opacity = this.btnEndMeeting.disabled ? "0.65" : "1";
    }
    if (this.btnCloseMeeting) {
      this.btnCloseMeeting.disabled = busy ? true : false;
      this.btnCloseMeeting.style.opacity = this.btnCloseMeeting.disabled ? "0.65" : "1";
    }

    if (ro) this.moveModeActive = false;
    this._updateMoveControls();
    this._updateDeleteControls();

    if (this.btnSaveTop) {
      this.btnSaveTop.disabled = busy || ro || !this.selectedTop;
      this.btnSaveTop.style.opacity = this.btnSaveTop.disabled ? "0.55" : "1";
    }
    if (this.btnTrashTop) {
      this.btnTrashTop.disabled = busy || ro || !this.selectedTop || this._deleteInFlight;
      this.btnTrashTop.style.opacity = this.btnTrashTop.disabled ? "0.55" : "1";
    }

    if (this.btnMove) {
      this.btnMove.disabled = busy || this.btnMove.disabled;
    }

    if (this.chkImportant) this.chkImportant.disabled = busy || ro || !this.selectedTop;
    if (this.chkHidden) this.chkHidden.disabled = busy || ro || !this.selectedTop;

    if (this.inpTitle) this.inpTitle.disabled = busy || ro || !this.selectedTop || this.inpTitle.disabled;
    if (this.taLongtext) this.taLongtext.disabled = busy || ro || !this.selectedTop;
    if (this.inpDueDate) this.inpDueDate.disabled = busy || ro || !this.selectedTop;
    if (this.selStatus) this.selStatus.disabled = busy || ro || !this.selectedTop;
    if (this.selResponsible) {
      this.selResponsible.disabled = busy || ro || !this.selectedTop || !!this._respLegacyReadonly;
    }
  }

  _rebuildChildrenIndex(items) {
    const map = new Map();
    for (const t of items) {
      const pid = t.parent_top_id || null;
      if (!pid) continue;
      const key = this._topIdKey(pid);
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    this.childrenCountByParent = map;
  }

  _updateCreateChildControls() {
    if (!this.btnChild) return;
    const activeTop = this.selectedTop || this._findTopById(this.selectedTopId);
    const hasSelection = !!activeTop;
    const maxed = hasSelection ? Number(activeTop.level) >= 4 : false;
    const dis = this.isReadOnly || this._busy || !hasSelection || maxed;
    this.btnChild.disabled = dis;
    this.btnChild.style.opacity = dis ? "0.55" : "1";
    this.btnChild.style.cursor = dis ? "default" : "pointer";
    this.btnChild.title = !hasSelection
      ? "Bitte zuerst einen TOP auswaehlen (nur Level 2 bis 4)."
      : maxed
      ? "Maximale TOP-Tiefe erreicht (Level 4)."
      : "Unterpunkt hinzufuegen (Level 2 bis 4).";
  }

  _isBlue(top) {
    return Number(top.is_carried_over) !== 1;
  }

  _selectedHasChildren() {
    const key = this._topIdKey(this.selectedTopId);
    if (!key) return false;
    return (this.childrenCountByParent.get(key) || 0) > 0;
  }

  _canTrashSelected() {
    const t = this.selectedTop;
    if (!t) return false;
    if (this.isReadOnly) return false;
    if (this._busy) return false;
    if (this._deleteInFlight) return false;
    if (Number(t.is_carried_over) === 1) return false;
    return true;
  }

  _canDeleteSelected() {
    const t = this.selectedTop;
    if (!t) return false;
    if (this.isReadOnly) return false;
    if (this._busy) return false;
    if (this._deleteInFlight) return false;
    if (!this._isBlue(t)) return false;
    if (this._selectedHasChildren()) return false;
    return true;
  }

  _updateDeleteControls() {
    const can = this._canDeleteSelected();
    if (this.btnDelete) {
      this.btnDelete.disabled = !can;
      this.btnDelete.style.opacity = can ? "1" : "0.55";
      this.btnDelete.style.cursor = can ? "pointer" : "default";
    }

    if (this.btnTrashTop) {
      const canTrash = this._canTrashSelected();
      this.btnTrashTop.disabled = !canTrash;
      this.btnTrashTop.style.opacity = canTrash ? "1" : "0.55";
      if (!canTrash && Number(this.selectedTop?.is_carried_over) === 1) {
        this.btnTrashTop.title = "Uebernommene TOPs koennen nicht geloescht werden.";
      } else {
        this.btnTrashTop.title = "In Papierkorb (wie Ausblenden)";
      }
    }
  }

  async moveSelectedTopToTrash() {
    const t = this.selectedTop;
    if (!t) return;
    if (this.isReadOnly) return;
    if (this._busy) return;
    if (this._deleteInFlight) return;
    if (Number(t.is_carried_over) === 1) {
      alert("Uebernommene TOPs koennen nicht geloescht werden.");
      return;
    }

    const currentId = this._topIdKey(t.id);
    const visibleIds = (this.items || [])
      .filter((x) => !this._shouldHideDoneTop(x))
      .map((x) => this._topIdKey(x.id))
      .filter(Boolean);
    const idx = visibleIds.indexOf(currentId);
    const nextId = idx >= 0 ? visibleIds[idx - 1] || visibleIds[idx + 1] || null : null;

    this._deleteInFlight = true;
    this._updateDeleteControls();

    const savePromise = this._saveMeetingTopPatch(
      { is_hidden: 1 },
      { reload: false, pulse: false }
    );

    if (this.selectedTop && this._sameTopId(this.selectedTop.id, currentId)) {
      this.selectedTop.is_hidden = 1;
    }
    const item = this._findTopById(currentId);
    if (item) item.is_hidden = 1;

    const nextTop = nextId ? this._findTopById(nextId) : null;
    this.selectedTopId = nextTop?.id || null;
    this.selectedTop = nextTop || null;

    this.applyEditBoxState();
    this._updateMoveControls();
    this._updateDeleteControls();
    this._updateCreateChildControls();
    this._renderListOnly();

    try {
      const res = await savePromise;
      if (!res?.ok) {
        await this.reloadList(true);
        return;
      }

      if (typeof window.bbmDb?.topsMarkTrashed === "function") {
        window.bbmDb
          .topsMarkTrashed({ topId: currentId })
          .then((markRes) => {
            if (markRes?.ok === false) {
              console.warn("[tops] topsMarkTrashed failed:", markRes.error);
            }
          })
          .catch((err) => {
            console.warn("[tops] topsMarkTrashed error:", err);
          });
      }
    } finally {
      this._deleteInFlight = false;
      this._updateDeleteControls();
    }
  }

  async deleteSelectedTop() {
    const t = this.selectedTop;
    if (!t) return;

    if (this.isReadOnly) {
      alert("Besprechung ist geschlossen – Löschen nicht erlaubt.");
      return;
    }
    if (this._busy) return;
    if (this._deleteInFlight) return;

    if (!this._isBlue(t)) {
      alert("Löschen ist nur für blaue (neue) TOPs erlaubt.");
      return;
    }
    if (this._selectedHasChildren()) {
      alert("Löschen ist nicht erlaubt: der TOP hat Unterpunkte (Kinder).");
      return;
    }

    const ok = confirm("TOP wirklich löschen?");
    if (!ok) return;

    const ids = (this.items || []).map((x) => this._topIdKey(x.id)).filter(Boolean);
    const currentId = this._topIdKey(t.id);
    const idx = ids.indexOf(currentId);
    const nextId = idx >= 0 ? ids[idx + 1] || ids[idx - 1] || null : null;

    this.moveModeActive = false;
    this._deleteInFlight = true;
    this._updateDeleteControls();

    const savePromise = this._saveMeetingTopPatch(
      { is_hidden: 1 },
      { reload: false, pulse: false }
    );

    if (this.selectedTop && this._sameTopId(this.selectedTop.id, currentId)) {
      this.selectedTop.is_hidden = 1;
    }
    const item = this._findTopById(currentId);
    if (item) item.is_hidden = 1;

    const nextTop = nextId ? this._findTopById(nextId) : null;
    this.selectedTopId = nextTop?.id || null;
    this.selectedTop = nextTop || null;

    this.applyEditBoxState();
    this._updateMoveControls();
    this._updateDeleteControls();
    this._updateCreateChildControls();
    this._renderListOnly();

    try {
      const res = await savePromise;
      if (!res?.ok) {
        alert(res?.error || "Löschen fehlgeschlagen");
        await this.reloadList(false);
      }
    } finally {
      this._deleteInFlight = false;
      this._updateDeleteControls();
    }
  }

  _updateMoveControls() {
    const t = this.selectedTop;
    const canMove = !this._busy && !this.isReadOnly && !!t && this._isBlue(t) && !this._selectedHasChildren();
    if (this.btnMove) this.btnMove.disabled = !canMove;
  }

  toggleMoveMode() {
    if (this.isReadOnly) return;
    if (this._busy) return;

    const t = this.selectedTop;
    if (!t) return;

    if (!this._isBlue(t)) {
      alert("Schieben ist nur für blaue (neue) TOPs erlaubt.");
      return;
    }
    if (this._selectedHasChildren()) {
      alert("Schieben ist nur erlaubt, wenn der TOP keine Unterpunkte (Kinder) hat.");
      return;
    }

    this.moveModeActive = !this.moveModeActive;
    this._updateMoveControls();
    this._renderListOnly();
  }

  async performMove(targetParentId) {
    if (this.isReadOnly) return;
    if (this._busy) return;

    const t = this.selectedTop;
    if (!t) return;
    if (!this.moveModeActive) return;

    if (targetParentId === null && Number(t.level) !== 1) {
      alert("Zu Root ist nur für Level-1-TOPs erlaubt.");
      return;
    }

    let needsReload = false;
    this._setBusy(true);
    try {
      const res = await window.bbmDb.topsMove({
        topId: t.id,
        targetParentId: targetParentId || null,
      });

      if (!res?.ok) {
        alert(res?.error || "Schieben fehlgeschlagen");
        return;
      }

      this.moveModeActive = false;
      needsReload = true;
    } finally {
      this._setBusy(false);
      if (needsReload) {
        setTimeout(() => {
          this.reloadList(true).catch(() => {});
        }, 0);
      }
    }
  }

  async reloadList(keepSelection) {
    const list = this.listEl;
    if (!list) return;

    this._reloadSeq = (this._reloadSeq || 0) + 1;
    const seq = this._reloadSeq;

    let res = null;
    try {
      res = await Promise.race([
        window.bbmDb.topsListByMeeting(this.meetingId),
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: false, error: "Timeout", _timeout: true }), 8000);
        }),
      ]);
    } catch (err) {
      if (seq !== this._reloadSeq) return;
      console.warn("[tops] reloadList failed:", err);
      return;
    }

    if (seq !== this._reloadSeq) return;
    if (res?._timeout) {
      console.warn("[tops] reloadList timeout after 8000ms");
      return;
    }
    if (!res?.ok) {
      console.warn("[tops] reloadList failed:", res?.error || "unbekannter Fehler");
      return;
    }

    this.meetingMeta = res.meeting || null;
    this.isReadOnly = this.meetingMeta ? Number(this.meetingMeta.is_closed) === 1 : false;

    const items = res.list || [];
    this.items = items;
    this._rebuildChildrenIndex(items);

    await this._loadLevel1CollapsedSetting();

    const selectedKey = this.selectedTopId == null ? "" : String(this.selectedTopId);
    if (keepSelection && selectedKey) {
      this.selectedTop = items.find((t) => String(t?.id) === selectedKey) || null;
      this.selectedTopId = this.selectedTop ? this.selectedTop.id : null;
    } else if (selectedKey) {
      this.selectedTop = items.find((t) => String(t?.id) === selectedKey) || null;
      if (!this.selectedTop) {
        this.selectedTopId = null;
      } else {
        this.selectedTopId = this.selectedTop.id;
      }
    } else {
      this.selectedTop = null;
    }

    list.innerHTML = "";
    this._renderListOnly();
    this.applyEditBoxState();
    this._applyReadOnlyState();
    this._updateTopBarMetaLabels();

    requestAnimationFrame(() => {
      this._syncPinnedBars();
    });
  }

  _isAllowedTarget(target, movingTop) {
    if (!movingTop) return false;
    if (target.id === movingTop.id) return false;

    const tl = Number(target.level);
    if (Number.isNaN(tl)) return false;
    if (tl < 1 || tl > 3) return false;

    return true;
  }

  _renderListOnly() {
    const list = this.listEl;
    list.innerHTML = "";
    const hasLevel1Top = (this.items || []).some((top) => Number(top?.level) === 1);

    const movingTop = this.moveModeActive ? this.selectedTop : null;
    const fontSizes = this._getListFontSizes();
    const ampelCompute = createAmpelComputer(this.items, this._ampelBaseDate());
    const meeting = this.meetingMeta || { id: this.meetingId };

    let collapsedParentId = null;
    for (const top of this.items) {
      if (this._shouldHideDoneTop(top)) continue;
      const li = document.createElement("li");
      li.dataset.topId = String(top.id);
      li.style.listStyle = "none";
      li.style.padding = "6px 8px";
      li.style.margin = "4px 0";
      li.style.borderRadius = "6px";
      li.style.cursor = "pointer";

      const isSelected = this._sameTopId(top.id, this.selectedTopId);
      const isMarked = this._markTopIds && this._markTopIds.has(top.id);

      const isImportant = Number(top.is_important) === 1;
      const isOld = Number(top.is_carried_over) === 1;
      const isTouched = Number(top.is_touched) === 1;
      const isLevel1 = Number(top.level) === 1;
      const isDone = shouldGrayTopForMeeting(top, meeting);

      const topIdKey = String(top.id);
      const isCollapsed = isLevel1 && this.level1Collapsed.has(topIdKey);
      if (isLevel1) {
        collapsedParentId = isCollapsed ? topIdKey : null;
      } else if (collapsedParentId) {
        continue;
      }

      const doneColor = "#9e9e9e";
      const shortColor = isDone
        ? doneColor
        : isImportant
        ? "#c62828"
        : isOld
        ? "black"
        : "blue";
      const longColor = isDone
        ? doneColor
        : isImportant
        ? "#c62828"
        : isOld
        ? isTouched
          ? "blue"
          : "black"
        : "blue";

      const baseBg = isLevel1 ? "#f3f3f3" : "transparent";
      li.style.background = isSelected ? "#dff0ff" : baseBg;
      li.style.border = isSelected ? "1px solid #7aa7ff" : "1px solid transparent";
      li.style.fontWeight = isSelected ? "700" : "400";
      if (isMarked) {
        li.style.border = "1px solid #f9a825";
        li.style.boxShadow = "0 0 0 2px rgba(249, 168, 37, 0.25)";
        if (!isSelected) li.style.background = "#fff8e1";
      }

      const num = top.displayNumber ?? top.number ?? "";

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "flex-start";
      row.style.gap = "10px";

      const numBlock = document.createElement("div");
      numBlock.style.flex = `0 0 ${this.NUM_COL_W}px`;
      numBlock.style.width = `${this.NUM_COL_W}px`;
      numBlock.style.minWidth = `${this.NUM_COL_W}px`;
      numBlock.style.fontVariantNumeric = "tabular-nums";
      numBlock.style.opacity = "0.85";
      numBlock.style.textAlign = "left";
      numBlock.style.fontSize = isLevel1 ? `${fontSizes.l1}px` : `${fontSizes.l24}px`;
      numBlock.style.display = "flex";
      numBlock.style.alignItems = "center";
      numBlock.style.gap = "6px";

      if (isLevel1) {
        const btnToggle = document.createElement("button");
        btnToggle.type = "button";
        btnToggle.textContent = isCollapsed ? "+" : "-";
        btnToggle.style.width = "18px";
        btnToggle.style.height = "18px";
        btnToggle.style.minWidth = "18px";
        btnToggle.style.borderRadius = "4px";
        btnToggle.style.border = "1px solid #cfd8dc";
        btnToggle.style.background = "#fff";
        btnToggle.style.cursor = "pointer";
        btnToggle.style.fontWeight = "700";
        btnToggle.style.lineHeight = "1";
        btnToggle.title = isCollapsed ? "Unterpunkte einblenden" : "Unterpunkte ausblenden";
        btnToggle.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isCollapsed) this.level1Collapsed.delete(topIdKey);
          else this.level1Collapsed.add(topIdKey);
          this._saveLevel1CollapsedSetting().catch(() => {});
          this._renderListOnly();
        };
        numBlock.appendChild(btnToggle);
      }

      const numLabel = document.createElement("span");
      numLabel.textContent = `${num}.`;
      numBlock.appendChild(numLabel);

      const textCol = document.createElement("div");
      textCol.style.display = "flex";
      textCol.style.flexDirection = "column";
      textCol.style.gap = "4px";
      textCol.style.flex = "1 1 auto";
      textCol.style.minWidth = "0";

      const shortLine = document.createElement("div");
      shortLine.textContent = `${top.title || ""}`;
      shortLine.style.color = shortColor;
      shortLine.style.fontSize = isLevel1 ? `${fontSizes.l1}px` : `${fontSizes.l24}px`;
      shortLine.style.whiteSpace = "nowrap";
      shortLine.style.overflow = "hidden";
      shortLine.style.textOverflow = "ellipsis";

      textCol.append(shortLine);

      if (this.showLongtextInList) {
        const lt = top.longtext ? String(top.longtext) : "";
        if (lt) {
          const longDiv = document.createElement("div");
          longDiv.textContent = this._clampStr(lt, this._longMax());
          longDiv.style.fontSize = `${fontSizes.long}px`;
          longDiv.style.opacity = "0.85";
          longDiv.style.whiteSpace = "pre-wrap";
          longDiv.style.color = longColor;
          textCol.append(longDiv);
        }
      }

      let metaCol = null;
      if (this.showLongtextInList && !isLevel1) {
        metaCol = document.createElement("div");
        metaCol.style.display = "flex";
        metaCol.style.flexDirection = "column";
        metaCol.style.alignItems = "flex-start";
        metaCol.style.textAlign = "left";
        metaCol.style.gap = "2px";
        metaCol.style.flex = `0 0 ${this.META_COL_W}px`;
        metaCol.style.width = `${this.META_COL_W}px`;
        metaCol.style.fontSize = "12px";
        metaCol.style.opacity = "0.65";
        metaCol.style.fontVariantNumeric = "tabular-nums";
        metaCol.style.paddingLeft = "10px";
        metaCol.style.borderLeft = "1px solid rgba(0,0,0,0.08)";

        const due = this._formatDue(top.due_date);
        const st = this._formatStatus(top.status);
        const resp = this._formatResponsible(top);

        const dueRow = document.createElement("div");
        dueRow.style.display = "flex";
        dueRow.style.alignItems = "center";
        dueRow.style.justifyContent = "space-between";
        dueRow.style.gap = "8px";
        dueRow.style.width = "100%";

        const dueTxt = document.createElement("span");
        dueTxt.textContent = `${due}`;
        dueTxt.style.whiteSpace = "nowrap";
        dueTxt.style.overflow = "hidden";
        dueTxt.style.textOverflow = "ellipsis";
        dueTxt.style.flex = "1 1 auto";
        dueTxt.style.minWidth = "0";

        const ampelColor = ampelCompute(top);
        const dot = this.showAmpelInList ? this._makeAmpelDot(ampelColor, 10) : null;
        if (dot) dot.title = ampelColor ? String(ampelColor) : "";

        dueRow.append(dueTxt);
        if (dot) dueRow.append(dot);

        const stRow = document.createElement("div");
        stRow.textContent = `${st}`;
        stRow.style.whiteSpace = "nowrap";

        const respRow = document.createElement("div");
        respRow.textContent = `${resp}`;
        respRow.style.whiteSpace = "nowrap";

        metaCol.append(dueRow, stRow, respRow);
      }

      row.append(numBlock, textCol);
      if (metaCol) row.append(metaCol);

      li.appendChild(row);

      if (this.moveModeActive && movingTop && !this.isReadOnly && !this._busy) {
        const okTarget = this._isAllowedTarget(top, movingTop);
        if (okTarget) {
          li.style.outline = "2px dashed #7aa7ff";
          li.style.background = "#eef7ff";
          li.style.opacity = "1";
        } else {
          li.style.opacity = "0.6";
        }
      }

      li.onclick = async () => {
        if (this._busy) return;

        if (this.moveModeActive && movingTop && !this.isReadOnly) {
          const okTarget = this._isAllowedTarget(top, movingTop);
          if (!okTarget) return;
          await this.performMove(top.id);
          return;
        }

        this.selectedTopId = top.id;
        this.selectedTop = top;
        this._userSelectedTop = true;

        this._updateMoveControls();
        this.applyEditBoxState();
        this._renderListOnly();
      };

      list.appendChild(li);
    }

    if (!hasLevel1Top) {
      const emptyWrap = document.createElement("div");
      emptyWrap.style.display = "flex";
      emptyWrap.style.flexDirection = "column";
      emptyWrap.style.alignItems = "center";
      emptyWrap.style.justifyContent = "center";
      emptyWrap.style.gap = "10px";
      emptyWrap.style.padding = "22px 10px";
      emptyWrap.style.opacity = "0.95";

      const img = document.createElement("img");
      img.src = EMPTY_LEVEL1_HINT_PNG;
      img.alt = "Hinweis erstes Level 1";
      img.style.width = "220px";
      img.style.maxWidth = "70%";
      img.style.height = "auto";
      img.style.objectFit = "contain";

      const hint = document.createElement("div");
      hint.textContent = "Mit Button  |+Titel|  den ersten Titel anlegen";
      hint.style.fontSize = "14px";
      hint.style.fontWeight = "600";
      hint.style.textAlign = "center";
      hint.style.color = "#1f2937";

      emptyWrap.append(img, hint);
      list.appendChild(emptyWrap);
    }

    this._updateMoveControls();
    this._updateDeleteControls();
    this._updateTopBarMetaLabels();

    requestAnimationFrame(() => {
      this._syncPinnedBars();
    });
  }

  _scrollListToSelectedAndEnd() {
    const list = this.listEl;
    if (!list) return;
    const id = this.selectedTopId;
    if (!id) return;

    const li = list.querySelector(`li[data-top-id="${id}"]`);
    if (!li) return;

    const findScrollParent = (node) => {
      let cur = node ? node.parentElement : null;
      while (cur) {
        const cs = window.getComputedStyle ? window.getComputedStyle(cur) : null;
        const oy = (cs?.overflowY || "").toLowerCase();
        const scrollable = (oy === "auto" || oy === "scroll") && cur.scrollHeight > cur.clientHeight;
        if (scrollable) return cur;
        cur = cur.parentElement;
      }
      return null;
    };

    const scroller = findScrollParent(li);
    if (!scroller) {
      if (typeof li.scrollIntoView === "function") li.scrollIntoView({ block: "nearest" });
      return;
    }

    const liRect = li.getBoundingClientRect();
    const scRect = scroller.getBoundingClientRect();
    const boxH = this.box ? Math.ceil(this.box.getBoundingClientRect().height || 0) : 0;

    const topPad = 8;
    const bottomPad = 8;
    const visibleTop = scRect.top + topPad;
    const visibleBottom = Math.min(scRect.bottom, window.innerHeight - boxH - bottomPad);

    if (liRect.bottom > visibleBottom) {
      scroller.scrollTop += Math.ceil(liRect.bottom - visibleBottom);
    } else if (liRect.top < visibleTop) {
      scroller.scrollTop -= Math.ceil(visibleTop - liRect.top);
    }
  }

  applyEditBoxState() {
    const t = this.selectedTop;

    const isLevel1 = Number(t?.level) === 1;
    if (this.editMetaCol) this.editMetaCol.style.display = isLevel1 ? "none" : "";
    if (this.editMetaSep) this.editMetaSep.style.display = isLevel1 ? "none" : "";

    if (this.boxTitleEl) {
      const num = t?.displayNumber ?? t?.number ?? "";
      this.boxTitleEl.textContent = num ? `TOP ${num} bearbeiten` : "TOP bearbeiten";
    }

    if (!t) {
      this.inpTitle.value = "";
      if (this.taLongtext) this.taLongtext.value = "";
      this.chkHidden.checked = false;
      if (this.chkImportant) this.chkImportant.checked = false;

      if (this.inpDueDate) this.inpDueDate.value = "";
      if (this.selStatus) this.selStatus.value = "offen";
      if (this.selResponsible) this.selResponsible.value = "";
      this._clearLegacyResponsibleOption();
      this._respLegacyReadonly = false;
      this._respDirty = false;
      this._updateDueAmpelFromInputs();
      this._respDirtyTopId = null;
      this._respLastSetTopId = null;

      this.inpTitle.disabled = true;
      if (this.taLongtext) this.taLongtext.disabled = true;
      if (this.inpDueDate) this.inpDueDate.disabled = true;
      if (this.selStatus) this.selStatus.disabled = true;
      if (this.selResponsible) this.selResponsible.disabled = true;
      this.chkHidden.disabled = true;
      if (this.chkImportant) this.chkImportant.disabled = true;

      if (this.btnSaveTop) {
        this.btnSaveTop.disabled = true;
        this.btnSaveTop.style.opacity = "0.55";
      }
      if (this.btnTrashTop) {
        this.btnTrashTop.disabled = true;
        this.btnTrashTop.style.opacity = "0.55";
      }

      this.moveModeActive = false;
      this._updateDeleteControls();
      this._updateCreateChildControls();
      this._updateCharCounters();
      return;
    }

    const titleVal = this._clampStr(t.title || "", this._titleMax());
    this.inpTitle.value = titleVal;

    if (this.taLongtext) {
      this.taLongtext.value = this._clampStr(t.longtext || "", this._longMax());
    }

    this.chkHidden.checked = Number(t.is_hidden) === 1;
    if (this.chkImportant) this.chkImportant.checked = Number(t.is_important) === 1;

    if (this.inpDueDate) {
      const dueRaw = t.due_date ?? t.dueDate ?? "";
      const dueVal = (dueRaw || "").toString();
      this.inpDueDate.value = dueVal ? dueVal.slice(0, 10) : "";
    }

    if (this.selStatus) {
      const st = (t.status || "").toString().trim();
      this.selStatus.value = st || "offen";
    }

    this._updateDueAmpelFromInputs();
    this._clearLegacyResponsibleOption();
    this._respLegacyReadonly = false;

    const topId = t.id;
    const sameTopDirty = this._respDirty && this._sameTopId(this._respDirtyTopId, topId);

    this._ensureProjectFirmsLoaded()
      .then(() => {
        this._buildResponsibleOptionsIfNeeded();
        if (!sameTopDirty && this.selResponsible && !this._sameTopId(this._respLastSetTopId, topId)) {
          const resolved = this._resolveResponsibleSelection(t);
          if (resolved.value && this._findResponsibleOption(resolved.value)) {
            this._clearLegacyResponsibleOption();
            this.selResponsible.value = resolved.value;
          } else if (resolved.fallbackLabel) {
            this._setLegacyResponsibleOption(resolved.fallbackLabel);
          } else {
            this._clearLegacyResponsibleOption();
            this.selResponsible.value = "";
          }
          this.selResponsible.disabled = !!this._respLegacyReadonly || this.isReadOnly || this._busy;
          this._respLastSetTopId = topId;
          this._respDirty = false;
          this._respDirtyTopId = null;
        }
      })
      .catch(() => {});

    this._updateCharCounters();

    const isOld = Number(t.is_carried_over) === 1;

    if (this.isReadOnly || this._busy) {
      this.inpTitle.disabled = true;
      if (this.taLongtext) this.taLongtext.disabled = true;
      if (this.inpDueDate) this.inpDueDate.disabled = true;
      if (this.selStatus) this.selStatus.disabled = true;
      if (this.selResponsible) this.selResponsible.disabled = true;
      this.chkHidden.disabled = true;
      if (this.chkImportant) this.chkImportant.disabled = true;

      if (this.btnSaveTop) {
        this.btnSaveTop.disabled = true;
        this.btnSaveTop.style.opacity = "0.55";
      }
      if (this.btnTrashTop) {
        this.btnTrashTop.disabled = true;
        this.btnTrashTop.style.opacity = "0.55";
      }

      this.moveModeActive = false;
      this._updateMoveControls();
      this._updateDeleteControls();
      this._updateCreateChildControls();
      return;
    }

    this.inpTitle.disabled = isOld;
    if (this.taLongtext) this.taLongtext.disabled = false;
    if (this.inpDueDate) this.inpDueDate.disabled = false;
    if (this.selStatus) this.selStatus.disabled = false;
    if (this.selResponsible) this.selResponsible.disabled = !!this._respLegacyReadonly;

    this.chkHidden.disabled = false;
    if (this.chkImportant) this.chkImportant.disabled = false;

    if (this.btnSaveTop) {
      this.btnSaveTop.disabled = false;
      this.btnSaveTop.style.opacity = "1";
    }
    if (this.btnTrashTop) {
      const canTrash = this._canTrashSelected();
      this.btnTrashTop.disabled = !canTrash;
      this.btnTrashTop.style.opacity = canTrash ? "1" : "0.55";
      if (!canTrash && Number(t?.is_carried_over) === 1) {
        this.btnTrashTop.title = "Uebernommene TOPs koennen nicht geloescht werden.";
      } else {
        this.btnTrashTop.title = "In Papierkorb (wie Ausblenden)";
      }
    }

    this._updateMoveControls();
    this._updateCreateChildControls();
    this._updateDeleteControls();
  }

  async createTop(level, parentTopId) {
    if (this.isReadOnly) return;
    if (this._busy) return;
    if (Number(level) > 4) {
      alert("Maximale TOP-Tiefe erreicht (Level 4).");
      return;
    }

    let shouldReloadAfterCreate = false;
    this._setBusy(true);
    try {
      const res = await window.bbmDb.topsCreate({
        projectId: this.projectId,
        meetingId: this.meetingId,
        level,
        parentTopId,
        title: "(ohne Bezeichnung)",
      });

      if (!res?.ok) {
        alert(res?.error || "Fehler beim Anlegen");
        return;
      }

      const createdId = res?.top?.id || null;
      if (!createdId) {
        alert("Fehler beim Anlegen: keine TOP-ID erhalten");
        return;
      }

      this._userSelectedTop = false;
      this.selectedTopId = createdId;
      this.selectedTop = null;
      shouldReloadAfterCreate = true;
    } catch (err) {
      alert(err?.message || String(err));
    } finally {
      this._setBusy(false);
      if (shouldReloadAfterCreate) {
        this.reloadList(true)
          .then(() => {
            requestAnimationFrame(() => {
              this._scrollListToSelectedAndEnd();
              if (!this.isReadOnly && this.selectedTop && this.inpTitle && !this.inpTitle.disabled) {
                this.inpTitle.focus();
                this.inpTitle.select?.();
              }
            });
          })
          .catch(() => {});
      }
    }
  }

  _clearGapPopup() {
    if (this._gapPopupOverlay && this._gapPopupOverlay.parentElement) {
      this._gapPopupOverlay.parentElement.removeChild(this._gapPopupOverlay);
    }
    this._gapPopupOverlay = null;
  }

  _setMarkedTopIds(ids) {
    this._markTopIds = new Set((ids || []).map((x) => Number(x)).filter((x) => Number.isFinite(x)));
    if (this.listEl) this._renderListOnly();
  }

  _clearMarkedTopIds() {
    this._markTopIds = new Set();
    if (this.listEl) this._renderListOnly();
  }

  _buildGapDetailsText(gap) {
    const lvl = Number(gap?.level || 0);
    const missingNumber = gap?.missingNumber ?? "?";
    const lastNumber = gap?.lastNumber ?? "?";
    const parentTopId = gap?.parentTopId ?? null;

    if (!parentTopId) {
      return [
        `Betroffene Ebene: Level ${lvl}`,
        `Bei Level 1 fehlt Nummer ${missingNumber}.`,
        `Vorschlag: Letzten TOP (Nr. ${lastNumber}) in die Lücke setzen.`,
      ];
    }

    const parent = (this.items || []).find((t) => String(t.id) === String(parentTopId));
    const parentNum = parent?.displayNumber ?? parent?.number ?? "";
    const parentTitle = parent?.title ? String(parent.title) : "";
    const parentLabel = parent
      ? `${parentNum ? `${parentNum}. ` : ""}${parentTitle || "TOP"}`
      : `TOP ${parentTopId}`;

    return [
      `Betroffene Ebene: Level ${lvl}`,
      `Unter TOP ${parentLabel} fehlt Nummer ${missingNumber}.`,
      `Vorschlag: Letzten TOP (Nr. ${lastNumber}) in die Lücke setzen.`,
    ];
  }

  async _showNumberGapPopup({ gap, onConfirm, onCancel }) {
    this._clearGapPopup();

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "20000";
    overlay.tabIndex = -1;

    const card = document.createElement("div");
    card.style.width = "min(560px, 92vw)";
    card.style.maxHeight = "80vh";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.background = "#fff";
    card.style.borderRadius = "10px";
    card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
    applyPopupCardStyle(card);

    const header = document.createElement("div");
    header.style.padding = "14px 16px 10px 16px";
    header.style.borderBottom = "1px solid rgba(0,0,0,0.08)";
    header.style.fontWeight = "700";
    header.textContent = "Nummernlücke gefunden";

    const content = document.createElement("div");
    content.style.padding = "12px 16px";
    content.style.overflow = "auto";
    content.style.flex = "1 1 auto";
    content.style.lineHeight = "1.4";

    const intro = document.createElement("div");
    intro.textContent =
      "Das Protokoll kann erst geschlossen werden, wenn die Nummerierung lückenlos ist.";
    intro.style.marginBottom = "8px";
    content.appendChild(intro);

    const lines = this._buildGapDetailsText(gap);
    for (const line of lines) {
      const p = document.createElement("div");
      p.textContent = line;
      p.style.marginBottom = "6px";
      content.appendChild(p);
    }

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.padding = "10px 16px";
    footer.style.borderTop = "1px solid rgba(0,0,0,0.08)";
    footer.style.background = "rgba(255,255,255,0.98)";

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel, { variant: "neutral" });

    const btnOk = document.createElement("button");
    btnOk.textContent = "Letzten TOP in Lücke setzen";
    applyPopupButtonStyle(btnOk, { variant: "primary" });
    const canRepair = !!gap?.lastTopId;
    btnOk.disabled = !canRepair;
    btnOk.style.opacity = canRepair ? "1" : "0.55";

    btnCancel.onclick = () => {
      this._clearGapPopup();
      if (typeof onCancel === "function") onCancel();
    };

    btnOk.onclick = async () => {
      if (!gap?.lastTopId) {
        alert("Reparatur nicht möglich: letzter TOP nicht ermittelt");
        return;
      }
      if (typeof onConfirm === "function") await onConfirm();
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this._clearGapPopup();
        if (typeof onCancel === "function") onCancel();
      }
    };
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this._clearGapPopup();
      if (typeof onCancel === "function") onCancel();
    });

    footer.append(btnCancel, btnOk);
    card.append(header, content, footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    try {
      overlay.focus();
    } catch (_e) {
      // ignore
    }

    this._gapPopupOverlay = overlay;
  }
}



