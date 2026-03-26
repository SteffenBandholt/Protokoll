// src/renderer/views/TopsView.js
//
// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.0

import { shouldShowTopForMeeting, shouldGrayTopForMeeting } from "../utils/topVisibility.js";
import { ampelHexFrom } from "../utils/ampelColors.js";
import { createAmpelComputer } from "../utils/ampelLogic.js";
import { applyPopupButtonStyle, applyPopupCardStyle } from "../ui/popupButtonStyles.js";
import { attachAudioFeature } from "../features/audio/AudioFeature.js";
import { DictationController } from "../features/audio-dictation/DictationController.js";
import { AudioSuggestionsFlow } from "../features/audio-suggestions/AudioSuggestionsFlow.js";
import { CloseMeetingOutputFlow } from "../features/output/CloseMeetingOutputFlow.js";
import { ResponsibleOptionsService } from "../features/assignments/ResponsibleOptionsService.js";
import { ResponsibleAssignmentAdapter } from "../features/assignments/ResponsibleAssignmentAdapter.js";
import { ResponsibleEditorController } from "../features/assignments/ResponsibleEditorController.js";
import { TopResponsibleService } from "../features/assignments/TopResponsibleService.js";
import { EditBoxStateService } from "../features/editor/EditBoxStateService.js";
import { TopMetaColumnRenderer } from "../features/list/TopMetaColumnRenderer.js";
import { renderTopTextColumn } from "../features/list/TopTextColumnRenderer.js";
import { TopEditorController } from "../features/editor/TopEditorController.js";
import { TopsViewDialogs } from "../features/dialogs/TopsViewDialogs.js";
import { TopsViewSettingsService } from "../features/settings/TopsViewSettingsService.js";
import { TopPatchService } from "../features/tops/TopPatchService.js";
import { TopGapFlow } from "../features/tops/TopGapFlow.js";
import { TopService } from "../features/tops/TopService.js";
import { TopTrashService } from "../features/tops/TopTrashService.js";
import { POPOVER_MENU } from "../ui/zIndex.js";
import { fireAndForget } from "../utils/async.js";

const EMPTY_LEVEL1_HINT_PNG = new URL("../assets/icon-bbm.png", import.meta.url).href;
const TODO_PNG = new URL("../assets/todo.png", import.meta.url).href;
const RED_FLAG_PNG = new URL("../assets/redFlag.png", import.meta.url).href;

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
    this.btnEndMeeting = null; // "Protokoll beenden"
    this.btnCloseMeeting = null; // "Schließen"
    this.btnLongToggle = null;
    this.btnAudioAnalyze = null;
    this.btnTitleDictate = null;
    this.btnLongDictate = null;

    this.btnAmpelToggle = null;
    this.btnTasks = null;
    this.btnProjectTasks = null;
    this.box = null;
    this.topBarEl = null;
    this.editMetaCol = null;
    this.editMetaSep = null;
    this.boxTitleEl = null;

    this.inpTitle = null;
    this.taLongtext = null;

    this.chkImportant = null;
    this.chkHidden = null;
    this.chkTask = null;
    this.chkDecision = null;

    this.inpDueDate = null;
    this.selStatus = null;
    this.selResponsible = null;
    this.dueAmpelEl = null;
    this.statusTaskMarkerEl = null;
    this.statusDecisionFlagEl = null;
    this._todoStatusOptionEl = null;

    this.projectFirms = [];
    this._projectFirmsLoaded = false;
    this._projectFirmsLoading = null;
    this._respOptionsKey = "";
    this._respDirty = false;
    this._respDirtyTopId = null;
    this._respLastSetTopId = null;
    this._respLegacyReadonly = false;
    this.projectStartDate = null;
    this.projectEndDate = null;
    this._dueDirty = false;
    this._dueDirtyTopId = null;

    // List toggle: Langtext anzeigen
    this.showLongtextInList = false;

    this.showAmpelInList = true;
    this.viewFilter = "all";
    // Char counter
    this.titleCountEl = null;
    this.longCountEl = null;

    // Limits UI
    this.titleMax = 100;
    this.longMax = 500;

    // Labels in topbar (when longtext on)
    this.topMetaEl = null;
    this.topsTitleEl = null;

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
    this._updateTaskDecisionUi = null;
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

    // Mail-Flow nach Protokoll beenden
    this._lastClosedMeetingForEmail = null;

    this._viewMenuOpen = false;
    this._viewMenuDocMouseDown = null;
    this._viewMenuEl = null;
    this._viewMenuBtn = null;
    this._projectTasksOverlayEl = null;
    this.settingsService = new TopsViewSettingsService({ view: this });
    this.topPatchService = new TopPatchService({ view: this });
    this.editBoxStateService = new EditBoxStateService({ view: this });
    this.topMetaColumnRenderer = new TopMetaColumnRenderer({ view: this });

    this._initModules(router);
  }

  _initModules(router) {
    this._initAudioModule();
    this._initOutputModule(router);
    this._initAssignmentsModule();
    this._initDialogsModule();
  }

  _initAudioModule() {
    attachAudioFeature(this);

    // === MODULE: Audio ===
    this.dictationController = new DictationController({
      view: this,
      ensureAudioAvailable: (options) => this._ensureAudioAvailable?.(options),
    });
    this.audioSuggestionsFlow = new AudioSuggestionsFlow({ view: this });
  }

  _initOutputModule(router) {
    // === MODULE: Output ===
    this.closeMeetingOutputFlow = new CloseMeetingOutputFlow({ view: this, router });
  }

  _startDictation(options) {
    return this.dictationController?.start(options);
  }

  _maybeOfferDictationTermCorrection(...args) {
    return this.dictationController?.maybeOfferTermCorrection(...args);
  }

  _loadProjectTermCorrections(...args) {
    return this.dictationController?.loadProjectTermCorrections(...args);
  }

  _tryShowPendingTermPrompt() {
    return this.dictationController?.tryShowPendingTermPrompt();
  }

  _onTopCleared() {
    return this.dictationController?.onTopCleared();
  }

  _updateDictationButtons(options) {
    return this.dictationController?.updateButtons(options);
  }

  _destroyDictationController() {
    return this.dictationController?.destroy();
  }

  _openAudioSuggestions() {
    return this.audioSuggestionsFlow?.open?.();
  }

  _applyAudioReadOnlyState(...args) {
    return this.audioSuggestionsFlow?.applyReadOnlyState?.(...args);
  }

  _onEnterIdleAfterClose() {
    return this.audioSuggestionsFlow?.onEnterIdleAfterClose?.();
  }

  _destroyAudioSuggestions() {
    return this.audioSuggestionsFlow?.destroy?.();
  }

  _runCloseMeetingOutputFlow() {
    return this.closeMeetingOutputFlow.run();
  }

  _initAssignmentsModule() {
    // === MODULE: Assignments ===
    this.responsibleOptionsService = new ResponsibleOptionsService({ view: this });
    this.responsibleAssignmentAdapter = new ResponsibleAssignmentAdapter({ view: this });
    this.responsibleService = new TopResponsibleService({ view: this });
    this.responsibleEditor = new ResponsibleEditorController({ view: this });
    this.topEditor = new TopEditorController({ view: this });
    this.topGapFlow = new TopGapFlow({ view: this });
    this.topService = new TopService();
    this.topTrash = new TopTrashService();
    this._initAssignmentDelegates();
  }

  _initDialogsModule() {
    // === MODULE: Dialogs ===
    this.dialogs = new TopsViewDialogs({ view: this });
    this._initDialogDelegates();
  }

  _initAssignmentDelegates() {
    this._buildResponsibleDisplayLabel = (...args) =>
      this.responsibleOptionsService.buildResponsibleDisplayLabel(...args);
    this._normalizeResponsibleCandidates = (...args) =>
      this.responsibleOptionsService.normalizeResponsibleCandidates(...args);
    this._buildResponsibleOptionValue = (...args) =>
      this.responsibleOptionsService.buildResponsibleOptionValue(...args);
    this._parseResponsibleOptionValue = (...args) =>
      this.responsibleOptionsService.parseResponsibleOptionValue(...args);
    this._normalizeResponsibleKind = (...args) =>
      this.responsibleOptionsService.normalizeResponsibleKind(...args);
    this._ensureProjectFirmsLoaded = (...args) =>
      this.responsibleOptionsService.ensureProjectFirmsLoaded(...args);
    this._computeRespOptionsKey = (...args) =>
      this.responsibleOptionsService.computeRespOptionsKey(...args);
    this._findResponsibleOption = (value) =>
      this.responsibleOptionsService.findResponsibleOption(this.selResponsible, value);
    this._clearLegacyResponsibleOption = () =>
      this.responsibleOptionsService.clearLegacyResponsibleOption(this.selResponsible);
    this._setLegacyResponsibleOption = (label) =>
      this.responsibleOptionsService.setLegacyResponsibleOption(this.selResponsible, label);
    this._buildResponsibleOptionsIfNeeded = () =>
      this.responsibleOptionsService.buildResponsibleOptionsIfNeeded(this.selResponsible);
    this._readResponsibleFromTop = (...args) =>
      this.responsibleAssignmentAdapter.readFromTop(...args);
    this._writeResponsibleToSelect = (...args) =>
      this.responsibleAssignmentAdapter.writeToSelect(...args);
    this._readResponsibleFromSelect = (...args) =>
      this.responsibleAssignmentAdapter.readFromSelect(...args);
  }

  _initDialogDelegates() {
    this._clearGapPopup = () => this.dialogs.clearGapPopup();
    this._buildGapDetailsText = (...args) => this.dialogs.buildGapDetailsText(...args);
  }

  _updateTopBarProtocolTitle() {
    // Idle-State: kein aktives Protokoll
    if (!this.meetingId) {
      const host = this.topsTitleEl;
      host.innerHTML = "";
      host.style.display = "flex";
      host.style.flexDirection = "column";
      host.style.alignItems = "flex-start";
      host.style.gap = "1px";
      host.style.lineHeight = "1.1";

      const labelLine = document.createElement("div");
      labelLine.textContent = "Protokoll";
      labelLine.style.color = "#000";
      labelLine.style.fontWeight = "600";
      host.appendChild(labelLine);

      const line1 = document.createElement("div");
      line1.textContent = this._idleHasProtocols ? "kein Protokoll aktiv" : "kein Protokoll vorhanden";
      line1.style.color = "#616161";
      line1.style.fontWeight = "700";
      host.appendChild(line1);

      host.title = "";
      host.style.cursor = "default";
      return;
    }

    if (!this.topsTitleEl) return;
    const isClosedMeeting = Number(this.meetingMeta?.is_closed) === 1 || !!this.isReadOnly;
    const parts = this._parseMeetingTitleParts();
    const meetingIndex = parts.meetingIndex;
    const meetingDateText = parts.meetingDateText;
    const meetingKeyword = parts.meetingKeyword;

    const host = this.topsTitleEl;
    host.innerHTML = "";
    host.style.display = "flex";
    host.style.flexDirection = "column";
    host.style.alignItems = "flex-start";
    host.style.gap = "1px";
    host.style.lineHeight = "1.1";
    host.style.fontSize = "10pt";

    const labelLine = document.createElement("div");
    labelLine.textContent = "Protokoll";
    labelLine.style.color = "#000";
    labelLine.style.fontWeight = "600";
    labelLine.style.fontSize = "10pt";
    host.appendChild(labelLine);

    const firstLineBase =
      meetingIndex && meetingDateText
        ? `${meetingIndex} - ${meetingDateText}`
        : meetingIndex || meetingDateText || "";
    const firstLineSafe = firstLineBase || "Protokoll";

    const line1 = document.createElement("div");
    if (isClosedMeeting) {
      line1.textContent = `${firstLineSafe} (geschlossen) read only`.trim();
      line1.style.color = "#b71c1c";
      line1.style.fontWeight = "700";
      line1.style.fontSize = "10pt";
    } else {
      const green = document.createElement("span");
      green.textContent = firstLineSafe;
      green.style.color = "#1b5e20";
      green.style.fontWeight = "700";
      green.style.fontSize = "10pt";
      line1.appendChild(green);
    }
    host.appendChild(line1);

    if (meetingKeyword) {
      const line2 = document.createElement("div");
      line2.textContent = meetingKeyword;
      line2.style.color = isClosedMeeting ? "#b71c1c" : "#1b5e20";
      line2.style.fontWeight = "700";
      line2.style.fontSize = "10pt";
      host.appendChild(line2);
    }

    const titleText = [line1.textContent || "", meetingKeyword].filter(Boolean).join(" | ");
    host.title = titleText;
    host.style.cursor = "pointer";
  }

  _formatDateToDdMmYyyy(raw) {
    const src = String(raw || "").trim();
    if (!src) return "";
    const direct = src.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (direct) return `${direct[3]}.${direct[2]}.${direct[1]}`;
    const d = new Date(src);
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  }

  _closeProjectTasksPopup() {
    if (this._projectTasksOverlayEl && this._projectTasksOverlayEl.parentElement) {
      this._projectTasksOverlayEl.parentElement.removeChild(this._projectTasksOverlayEl);
    }
    this._projectTasksOverlayEl = null;
  }

  async _openProjectTasksPopup() {
    if (this._projectTasksOverlayEl) return;

    const api = window.bbmDb || {};
    if (typeof api.meetingsListProjectTasks !== "function") {
      alert("Aufgabenliste ist nicht verfuegbar.");
      return;
    }
    if (!this.projectId) {
      alert("Projekt nicht gefunden.");
      return;
    }

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "1400";
    overlay.tabIndex = -1;

    const card = document.createElement("div");
    applyPopupCardStyle(card);
    card.style.width = "min(900px, calc(100vw - 24px))";
    card.style.maxHeight = "80vh";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.overflow = "hidden";
    card.style.background = "#fff";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "10px";
    header.style.padding = "12px 16px";
    header.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.textContent = "Projekt-Aufgaben";
    title.style.fontWeight = "800";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "X";
    applyPopupButtonStyle(btnClose);
    btnClose.style.marginLeft = "auto";
    btnClose.onclick = () => this._closeProjectTasksPopup();

    header.append(title, btnClose);

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.overflow = "auto";
    body.style.padding = "12px 16px";
    body.textContent = "Lade...";

    const renderTasks = (rows) => {
      body.innerHTML = "";
      const list = Array.isArray(rows) ? rows : [];
      title.textContent = `Projekt-Aufgaben (${list.length})`;

      if (!list.length) {
        const empty = document.createElement("div");
        empty.textContent = "Keine Aufgaben vorhanden.";
        empty.style.opacity = "0.75";
        body.appendChild(empty);
        return;
      }

      const wrap = document.createElement("div");
      wrap.style.display = "grid";
      wrap.style.gap = "8px";

      const mkMeta = (label, value) => {
        const el = document.createElement("div");
        el.textContent = `${label}: ${value}`;
        return el;
      };

      for (const t of list) {
        const item = document.createElement("div");
        item.style.border = "1px solid #e5e7eb";
        item.style.borderRadius = "8px";
        item.style.padding = "8px 10px";
        item.style.display = "grid";
        item.style.gap = "6px";

        const titleEl = document.createElement("div");
        titleEl.textContent = String(t?.title || t?.short_text || t?.shortText || "(ohne Bezeichnung)");
        titleEl.style.fontWeight = "600";

        const meta = document.createElement("div");
        meta.style.display = "flex";
        meta.style.flexWrap = "wrap";
        meta.style.gap = "8px";
        meta.style.fontSize = "12px";
        meta.style.color = "#374151";

        const resp = String(t?.responsible_label || t?.responsibleLabel || "").trim() || "-";
        const dueRaw = t?.due_date ?? t?.dueDate ?? "";
        const due = this._formatDateToDdMmYyyy(dueRaw) || String(dueRaw || "").trim() || "-";
        const statusRaw = String(t?.status || "").trim();
        const status = this._formatStatus(statusRaw);
        const meetingRef = String(t?.meeting_id ?? t?.meetingId ?? "").trim() || "-";

        if (statusRaw && statusRaw.toLowerCase() !== "erledigt") {
          item.style.borderColor = "#b6d4ff";
          item.style.background = "#eef7ff";
        }

        meta.append(mkMeta("Verantw.", resp));
        meta.append(mkMeta("Faellig", due));
        meta.append(mkMeta("Status", status));
        meta.append(mkMeta("Meeting", meetingRef));

        item.append(titleEl, meta);
        wrap.appendChild(item);
      }

      body.appendChild(wrap);
    };

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) this._closeProjectTasksPopup();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this._closeProjectTasksPopup();
    });

    card.append(header, body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this._projectTasksOverlayEl = overlay;
    try {
      overlay.focus();
    } catch (_e) {
      // ignore
    }

    try {
      const res = await api.meetingsListProjectTasks({ projectId: this.projectId });
      if (!res?.ok) {
        body.textContent = res?.error || "Aufgaben konnten nicht geladen werden.";
        return;
      }
      renderTasks(res.list || []);
    } catch (err) {
      body.textContent = err?.message || "Aufgaben konnten nicht geladen werden.";
    }
  }

  _parseMeetingTitleParts() {
    const meetingIndexRaw = Number(this.meetingMeta?.meeting_index);
    const hasMeetingIndex = Number.isFinite(meetingIndexRaw) && meetingIndexRaw > 0;
    const meetingIndexInt = hasMeetingIndex ? Math.trunc(meetingIndexRaw) : 0;
    const meetingIndex = hasMeetingIndex ? `#${meetingIndexInt}` : "";
    let meetingTitle = String(this.meetingMeta?.title || "").trim();

    if (hasMeetingIndex) {
      const leadingIndexPattern = new RegExp(`^#\\s*${meetingIndexInt}(?:\\s*[-–—:]\\s*|\\s+)`, "i");
      if (leadingIndexPattern.test(meetingTitle)) {
        meetingTitle = meetingTitle.replace(leadingIndexPattern, "").trim();
      } else if (new RegExp(`^#\\s*${meetingIndexInt}$`, "i").test(meetingTitle)) {
        meetingTitle = "";
      }
    }

    const titleNormalized = meetingTitle.replace(/^#\d+\s*(?:-\s*)?/i, "").trim();
    let meetingDateText = "";
    let meetingKeyword = "";

    if (titleNormalized) {
      const directDate = titleNormalized.match(/^(\d{2}\.\d{2}\.\d{4})(?:\s*-\s*(.*))?$/);
      if (directDate) {
        meetingDateText = directDate[1];
        meetingKeyword = String(directDate[2] || "").trim();
      } else {
        const dateInText = titleNormalized.match(/(\d{2}\.\d{2}\.\d{4})/);
        if (dateInText) {
          meetingDateText = dateInText[1];
          const idx = titleNormalized.indexOf(dateInText[1]);
          const after = titleNormalized.slice(idx + dateInText[1].length).replace(/^\s*-\s*/, "").trim();
          meetingKeyword = after;
        } else {
          meetingKeyword = titleNormalized;
        }
      }
    }

    if (!meetingDateText) {
      const m = this.meetingMeta || {};
      meetingDateText = this._formatDateToDdMmYyyy(
        m.meeting_date || m.meetingDate || m.date || m.created_at || m.createdAt || m.updated_at || m.updatedAt || ""
      );
    }

    if (meetingKeyword) {
      meetingKeyword = meetingKeyword.replace(/^#\d+\s*(?:-\s*)?/i, "").trim();
    }

    return {
      meetingIndex,
      meetingDateText: String(meetingDateText || "").trim(),
      meetingKeyword: String(meetingKeyword || "").trim(),
    };
  }


// ---- Date helpers (kompatibel) ----
_todayISO() {
  // YYYY-MM-DD (lokal)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

todayISO() {
  // Alias, falls irgendwo noch todayISO() genutzt wird
  return this._todayISO();
}

_isoToDDMMYYYY(iso) {
  // iso: YYYY-MM-DD
  if (!iso || typeof iso !== "string" || iso.length < 10) return "";
  const y = iso.slice(0, 4);
  const m = iso.slice(5, 7);
  const d = iso.slice(8, 10);
  return `${d}.${m}.${y}`;
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
    return this.settingsService.loadAmpelSetting();
  }

  _emitAmpelStateChanged() {
    try {
      window.dispatchEvent(
        new CustomEvent("bbm:ampel-state", {
          detail: { enabled: !!this.showAmpelInList },
        })
      );
    } catch (_err) {}
  }

  async _loadProjectDates() {
    this.projectStartDate = null;
    this.projectEndDate = null;

    const pid = this.projectId;
    const api = window.bbmDb || {};
    if (!pid || typeof api.projectsList !== "function") return;

    const normalize = (v) => {
      const s = (v || "").toString().trim();
      if (!s) return null;
      return s.slice(0, 10);
    };

    try {
      const res = await api.projectsList();
      if (!res?.ok) return;
      const list = Array.isArray(res.list) ? res.list : [];
      const proj = list.find((p) => this._topIdKey(p?.id) === this._topIdKey(pid));
      if (!proj) return;
      this.projectStartDate = normalize(proj.start_date ?? proj.startDate);
      this.projectEndDate = normalize(proj.end_date ?? proj.endDate);
    } catch (err) {
      console.warn("[tops] _loadProjectDates failed:", err);
    }
  }

  _emitLongtextStateChanged() {
    try {
      window.dispatchEvent(
        new CustomEvent("bbm:longtext-state", {
          detail: { enabled: !!this.showLongtextInList },
        })
      );
    } catch (_err) {}
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
    } catch (e) {
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
    return this.settingsService.saveAmpelSetting();
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
      if (this.btnAudioAnalyze) this.btnAudioAnalyze.disabled = true;
      if (this.btnTitleDictate) this.btnTitleDictate.disabled = true;
      if (this.btnLongDictate) this.btnLongDictate.disabled = true;
      if (this.btnTasks) this.btnTasks.disabled = true;
      if (this.btnProjectTasks) this.btnProjectTasks.disabled = true;

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
      if (this.chkTask) this.chkTask.disabled = true;
      if (this.chkDecision) this.chkDecision.disabled = true;

      return;
    }

    this.applyEditBoxState();
    this._applyReadOnlyState();
    this._updateMoveControls();
    this._updateDeleteControls();
  }

  // === CORE: Save / Patch Flow ===
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
    return this.responsibleOptionsService.getResponsibleLabelForSelection(sel, parsed);
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

  _resolveDisplayDueForTop(top) {
    const dueRaw = top?.due_date ?? top?.dueDate ?? "";
    const statusRaw = String(top?.status || "").trim().toLowerCase();
    if ((!statusRaw || statusRaw === "alle") && this.projectEndDate) {
      const dueStr = String(dueRaw || "").trim();
      if (!dueStr) return this.projectEndDate;
    }
    return dueRaw;
  }

  _formatStatus(v) {
    const s = (v || "").toString().trim();
    if (!s) return "Alle";
    const lower = s.toLowerCase();
    if (lower === "alle") return "Alle";
    if (lower === "festlegung") return "Festgelegt";
    if (lower === "todo") return "ToDo";
    return s;
  }

  // === CORE: Core Meta / Core Sync Helpers ===
  _getTopMeta(top) {
    const responsible = this.responsibleService.getFromTop(top);
    return {
      dueDate: top?.due_date ?? top?.dueDate ?? "",
      status: top?.status ?? "",
      responsible,
    };
  }

  _shouldShowMetaColumn(top) {
    const lvl = Number(top?.level);
    if (!Number.isFinite(lvl)) return false;
    return lvl >= 2 && lvl <= 4;
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
      : st === "festlegung"
      ? "gruen"
      : st === "blockiert" || st === "verzug"
      ? "rot"
      : !this._parseYmdDate(dueDateStr)
      ? "gruen"
      : this._parseYmdDate(dueDateStr).getTime() < this._todayStart().getTime()
      ? "rot"
      : this._parseYmdDate(dueDateStr).getTime() <=
        this._todayStart().getTime() + 3 * 24 * 60 * 60 * 1000
      ? "orange"
      : "gruen";
  }

  _updateDueAmpelFromInputs() {
    const dueVal = (this.inpDueDate?.value || "").trim();
    const rawStatusVal = (this.selStatus?.value || "").trim();
    if (rawStatusVal && rawStatusVal.toLowerCase() === "alle") {
      this._applyAmpelDotColor(this.dueAmpelEl, "gruen");
      return;
    }
    const statusVal = rawStatusVal || "offen";
    const t = this.selectedTop;
    const overrides = new Map();
    if (t && t.id) {
      overrides.set(String(t.id), { ...t, status: statusVal, due_date: dueVal || null });
    }
    const ampelCompute = createAmpelComputer(this.items || [], this._ampelBaseDate(), overrides);
    const color = t ? ampelCompute(t) : null;
    this._applyAmpelDotColor(this.dueAmpelEl, color);
  }

  _shouldShowDecisionFlag(status) {
    const s = (status || "").toString().trim().toLowerCase();
    return s === "festlegung" || s === "festgelegt";
  }

  _shouldShowTaskMarker() {
    const statusRaw = (this.selStatus?.value || this.selectedTop?.status || "").toString();
    if (statusRaw.trim().toLowerCase() === "todo") return true;
    const raw = this.selectedTop?.is_task ?? this.selectedTop?.isTask ?? 0;
    if (raw === true || raw === false) return raw;
    if (typeof raw === "string") {
      const s = raw.trim().toLowerCase();
      return s === "1" || s === "true";
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n === 1 : false;
  }

  _hasTodoResponsibleSelection() {
    if (!this.selResponsible) return false;
    const responsible = this._readResponsibleFromSelect(this.selResponsible, this.projectFirms || []);
    if (!responsible?.id || responsible.kind === "all") return false;
    const lbl = responsible.label;
    const txt = (lbl || "").toString().trim();
    return !!txt && txt !== "-";
  }

  _updateTodoStatusAvailability() {
    if (!this.selStatus || !this._todoStatusOptionEl) return;
    const allowed = this._hasTodoResponsibleSelection();
    this._todoStatusOptionEl.disabled = !allowed;
    this._todoStatusOptionEl.title = allowed ? "" : "ToDo nur mit Verantwortlich";
    if (!allowed && String(this.selStatus.value || "").trim().toLowerCase() === "todo") {
      this.selStatus.value = "-";
      this._updateStatusMarkers();
    }
  }

  _updateStatusMarkers() {
    if (this.statusTaskMarkerEl) {
      this.statusTaskMarkerEl.style.display = this._shouldShowTaskMarker() ? "block" : "none";
    }
    if (this.statusDecisionFlagEl) {
      const showDecision = this._shouldShowDecisionFlag(this.selStatus?.value || this.selectedTop?.status || "");
      this.statusDecisionFlagEl.style.display = showDecision ? "block" : "none";
    }
  }

  _isResponsibleAllSelection() {
    if (!this.selResponsible) return false;
    const responsible = this._readResponsibleFromSelect(this.selResponsible, this.projectFirms || []);
    if (responsible?.kind === "all") return true;
    const val = (this.selResponsible.value || "").toString();
    const opt = this.selResponsible.selectedOptions?.[0];
    const lbl = (opt?.textContent || "").trim().toLowerCase();
    return !responsible && !val && lbl === "alle";
  }

  _applyProjectDueDefaults(top) {
    if (!top || !this.inpDueDate) return;
    if (this._dueDirty && this._sameTopId(this._dueDirtyTopId, top.id)) return;

    const current = (this.inpDueDate.value || "").trim();
    const startDate = this.projectStartDate;
    const endDate = this.projectEndDate;
    const statusRaw = (this.selStatus?.value || "").trim().toLowerCase();
    const isStatusAll = statusRaw === "alle";

    let nextVal = "";
    if (endDate && (!current || (isStatusAll && current === (startDate || "")))) {
      nextVal = endDate;
    } else if (this._isResponsibleAllSelection() && endDate) {
      if (!current || current === (startDate || "")) {
        nextVal = endDate;
      }
    } else if (!current && startDate) {
      nextVal = startDate;
    }

    if (nextVal) {
      this.inpDueDate.value = nextVal;
      this._updateDueAmpelFromInputs();
    }
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

  _isTaskTop(top) {
    if (!top || typeof top !== "object") return false;
    const raw = top.is_task ?? top.isTask;
    if (raw === true || raw === false) return raw;
    if (typeof raw === "string") {
      const s = raw.trim().toLowerCase();
      return s === "1" || s === "true";
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n === 1 : false;
  }

  _isDecisionTop(top) {
    if (!top || typeof top !== "object") return false;
    const status = (top.status || "").toString().trim().toLowerCase();
    if (status === "festlegung") return true;
    const raw = top.is_decision ?? top.isDecision;
    if (raw === true || raw === false) return raw;
    if (typeof raw === "string") {
      const s = raw.trim().toLowerCase();
      return s === "1" || s === "true";
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n === 1 : false;
  }

  _isVerzugTop(top) {
    return String(top?.status || "").trim().toLowerCase() === "verzug";
  }

  _matchesViewFilter(top) {
    const mode = String(this.viewFilter || "all").trim().toLowerCase();
    if (mode === "tasks") return this._isTaskTop(top);
    if (mode === "verzug") return this._isVerzugTop(top);
    if (mode === "decisions") return this._isDecisionTop(top);
    return true;
  }

  _shouldHideTopInList(top) {
    if (this._shouldHideDoneTop(top)) return true;
    if (!this._matchesViewFilter(top)) return true;
    return false;
  }

  _viewFilterLabel(mode) {
    const key = String(mode || "all").trim().toLowerCase();
    if (key === "tasks") return "Aufgaben";
    if (key === "verzug") return "Verzug";
    if (key === "decisions") return "Festlegungen";
    return "Alle";
  }

  _setViewMenuOpen(nextOpen) {
    this._viewMenuOpen = !!nextOpen;
    if (this._viewMenuEl) {
      this._viewMenuEl.style.display = this._viewMenuOpen ? "flex" : "none";
      if (this._viewMenuOpen) {
        this._positionViewMenu();
      }
    }
    if (this._viewMenuBtn) {
      this._viewMenuBtn.setAttribute("aria-expanded", this._viewMenuOpen ? "true" : "false");
    }
  }

  _positionViewMenu() {
    if (!this._viewMenuEl || !this._viewMenuBtn) return;
    const menuEl = this._viewMenuEl;
    const btnRect = this._viewMenuBtn.getBoundingClientRect();
    const gap = 4;
    const viewportPad = 8;
    menuEl.style.top = `${Math.round(btnRect.bottom + gap)}px`;
    menuEl.style.left = "0px";
    const menuWidth = Math.ceil(menuEl.getBoundingClientRect().width || menuEl.offsetWidth || 190);
    const maxLeft = Math.max(viewportPad, window.innerWidth - menuWidth - viewportPad);
    const targetLeft = Math.round(btnRect.right - menuWidth);
    menuEl.style.left = `${Math.min(maxLeft, Math.max(viewportPad, targetLeft))}px`;
  }

  _updateTopBarMetaLabels() {
    if (!this.topMetaEl) return;

    const hasMeeting = !!this.meetingId;
    const hasTops = hasMeeting && Array.isArray(this.items) && this.items.length > 0;
    const on = !!this.showLongtextInList && hasTops;

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

    this.topMetaEl.append(mk("Fertig bis"), mk("Status"), mk("verantw"), mk("anspr"));
  }


  render() {
    const root = document.createElement("div");
    if (!this._fontScaleListenerBound) {
      this._fontScaleListenerBound = true;
      this._onFontScaleChanged = () => {
        this.settingsService.loadListFontScaleSetting(true)
          .then(() => {
            if (this.listEl) this._renderListOnly();
          })
          .catch(() => {});
        this.settingsService.loadEditFontScaleSetting(true)
          .then(() => {
            this._applyEditFontSizes();
          })
          .catch(() => {});
      };
      window.addEventListener("bbm:tops-fontscale-changed", this._onFontScaleChanged);
    }
    if (!this._topsLimitsListenerBound) {
      this._onTopLimitsChanged = async () => {
        await this.settingsService.loadTextLimitsSetting();
      };
      window.addEventListener("bbm:tops-limits-changed", this._onTopLimitsChanged);
      this._topsLimitsListenerBound = true;
    }

    const BTN_MIN_H = "0";
    const BTN_PAD = "1px 6px";
    const BTN_PAD_ACTION = "2px 6px";
    const BTN_FONT_SIZE = "8pt";
    const BTN_RADIUS = "6px";

    // ✅ feste Höhe der Buttonbar (ausgerichtet auf "Langtext an")
    const TOPBAR_H = 56; // px

    const styleBtnBase = (b) => {
      b.style.minHeight = BTN_MIN_H;
      b.style.padding = BTN_PAD;
      b.style.borderRadius = BTN_RADIUS;
      b.style.fontSize = BTN_FONT_SIZE;
      b.style.lineHeight = "1.2";
      b.style.flex = "0 0 auto";
    };

    // "Protokoll beenden"
    const btnEndMeeting = document.createElement("button");
    btnEndMeeting.textContent = "Protokoll beenden";
    btnEndMeeting.style.background = "#ef6c00";
    btnEndMeeting.style.color = "white";
    btnEndMeeting.style.border = "1px solid rgba(0,0,0,0.25)";
    styleBtnBase(btnEndMeeting);
    btnEndMeeting.onclick = async () => {
      if (this._busy) return;
      await this._runCloseMeetingOutputFlow();
      return;
    };

    const btnAudioAnalyze = document.createElement("button");
    btnAudioAnalyze.textContent = "Audio";
    btnAudioAnalyze.style.background = "#1565c0";
    btnAudioAnalyze.style.color = "white";
    btnAudioAnalyze.style.border = "1px solid rgba(0,0,0,0.25)";
    btnAudioAnalyze.style.display = "none";
    styleBtnBase(btnAudioAnalyze);
    btnAudioAnalyze.onclick = async () => {
      if (this._busy || this.isReadOnly || !this.meetingId) return;
      await this._openAudioSuggestions();
    };

    const btnCloseMeeting = document.createElement("button");
    btnCloseMeeting.textContent = "Schließen";
    btnCloseMeeting.style.background = "#fff";
    btnCloseMeeting.style.color = "#222";
    btnCloseMeeting.style.border = "1px solid rgba(0,0,0,0.25)";
    styleBtnBase(btnCloseMeeting);
    btnCloseMeeting.onclick = async () => {
      if (this._busy) return;
      await this._closeViewOnly();
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
    btnLongToggle.style.display = "none";
    btnLongToggle.style.alignItems = "center";
    btnLongToggle.style.justifyContent = "center";
    btnLongToggle.style.gap = "6px";
    btnLongToggle.style.padding = BTN_PAD;
    btnLongToggle.style.borderRadius = BTN_RADIUS;
    btnLongToggle.style.cursor = "pointer";
    btnLongToggle.style.border = "1px solid #ddd";
    btnLongToggle.style.background = "#f3f3f3";
    btnLongToggle.style.minHeight = BTN_MIN_H;
    btnLongToggle.style.fontSize = BTN_FONT_SIZE;
    btnLongToggle.style.lineHeight = "1.2";
    btnLongToggle.style.flex = "0 0 auto";
    btnLongToggle.style.minWidth = "86px";
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
      this._emitLongtextStateChanged();
      this.settingsService.saveLongtextSetting().catch(() => {});
    };

    btnLongToggle.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      btnLongToggle.click();
    });

    const btnProjectTasks = document.createElement("button");
    btnProjectTasks.type = "button";
    btnProjectTasks.textContent = "Aufgaben";
    btnProjectTasks.style.display = "none";
    btnProjectTasks.style.alignItems = "center";
    btnProjectTasks.style.justifyContent = "center";
    btnProjectTasks.style.gap = "6px";
    btnProjectTasks.style.padding = BTN_PAD;
    btnProjectTasks.style.borderRadius = BTN_RADIUS;
    btnProjectTasks.style.cursor = "pointer";
    btnProjectTasks.style.border = "1px solid #ddd";
    btnProjectTasks.style.background = "#f3f3f3";
    btnProjectTasks.style.minHeight = BTN_MIN_H;
    btnProjectTasks.style.fontSize = BTN_FONT_SIZE;
    btnProjectTasks.style.lineHeight = "1.2";
    btnProjectTasks.style.flex = "0 0 auto";
    btnProjectTasks.style.minWidth = "72px";
    btnProjectTasks.title = "Projektweite ToDo-Liste anzeigen";
    btnProjectTasks.onclick = async () => {
      await this._openProjectTasksPopup();
    };
    btnProjectTasks.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      btnProjectTasks.click();
    });

    this.settingsService.loadLongtextSetting()
      .then(() => {
        updateLongToggleUi();
        this._renderListOnly();
      })
      .catch(() => {});

    this.settingsService.loadListFontScaleSetting()
      .then(() => {
        this._renderListOnly();
      })
      .catch(() => {});

    this.settingsService.loadEditFontScaleSetting()
      .then(() => {
        this._applyEditFontSizes();
      })
      .catch(() => {});

    // Ampel Toggle
    const btnAmpelToggle = document.createElement("button");
    btnAmpelToggle.type = "button";
    btnAmpelToggle.style.display = "none";
    btnAmpelToggle.style.alignItems = "center";
    btnAmpelToggle.style.justifyContent = "center";
    btnAmpelToggle.style.gap = "6px";
    btnAmpelToggle.style.padding = BTN_PAD;
    btnAmpelToggle.style.borderRadius = BTN_RADIUS;
    btnAmpelToggle.style.cursor = "pointer";
    btnAmpelToggle.style.border = "1px solid #ddd";
    btnAmpelToggle.style.background = "#f3f3f3";
    btnAmpelToggle.style.minHeight = BTN_MIN_H;
    btnAmpelToggle.style.fontSize = BTN_FONT_SIZE;
    btnAmpelToggle.style.lineHeight = "1.2";
    btnAmpelToggle.style.flex = "0 0 auto";
    btnAmpelToggle.style.minWidth = "78px";
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
      this._emitAmpelStateChanged();
      this._saveAmpelSetting().catch(() => {});
    };

    btnAmpelToggle.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      btnAmpelToggle.click();
    });

    const viewWrap = document.createElement("div");
    viewWrap.style.position = "relative";
    viewWrap.style.display = "inline-flex";
    viewWrap.style.alignItems = "center";
    viewWrap.style.flex = "0 0 auto";

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.title = "Ansicht";
    viewBtn.setAttribute("aria-haspopup", "menu");
    viewBtn.style.display = "inline-flex";
    viewBtn.style.alignItems = "center";
    viewBtn.style.justifyContent = "space-between";
    viewBtn.style.gap = "8px";
    viewBtn.style.padding = BTN_PAD;
    viewBtn.style.borderRadius = BTN_RADIUS;
    viewBtn.style.cursor = "pointer";
    viewBtn.style.border = "1px solid #ddd";
    viewBtn.style.background = "#f3f3f3";
    viewBtn.style.color = "#222";
    viewBtn.style.minHeight = BTN_MIN_H;
    viewBtn.style.minWidth = "64px";
    viewBtn.style.fontSize = BTN_FONT_SIZE;
    viewBtn.style.fontWeight = "600";
    viewBtn.style.lineHeight = "1.2";
    viewBtn.style.whiteSpace = "nowrap";
    viewBtn.onmouseenter = () => {
      if (viewBtn.disabled) return;
      viewBtn.style.background = "#ececec";
      viewBtn.style.borderColor = "#cfcfcf";
    };
    viewBtn.onmouseleave = () => {
      viewBtn.style.background = "#f3f3f3";
      viewBtn.style.borderColor = "#ddd";
    };

    const viewBtnLabel = document.createElement("span");
    viewBtnLabel.textContent = "Ansicht";
    const viewBtnCaret = document.createElement("span");
    viewBtnCaret.textContent = "v";
    viewBtnCaret.style.fontSize = "11px";
    viewBtnCaret.style.opacity = "0.75";
    viewBtn.append(viewBtnLabel, viewBtnCaret);

    const viewMenu = document.createElement("div");
    viewMenu.style.position = "fixed";
    viewMenu.style.top = "0";
    viewMenu.style.left = "0";
    viewMenu.style.minWidth = "190px";
    viewMenu.style.maxWidth = "calc(100vw - 16px)";
    viewMenu.style.display = "none";
    viewMenu.style.flexDirection = "column";
    viewMenu.style.gap = "0";
    viewMenu.style.padding = "4px";
    viewMenu.style.border = "1px solid var(--card-border)";
    viewMenu.style.borderRadius = "8px";
    viewMenu.style.background = "var(--card-bg)";
    viewMenu.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
    viewMenu.style.zIndex = String(POPOVER_MENU);

    const updateViewMenuUi = () => {
      const filterLabel = this._viewFilterLabel(this.viewFilter);
      viewBtn.title = `Ansicht: ${filterLabel}`;
      viewBtn.setAttribute("aria-label", `Ansicht: ${filterLabel}`);
      Array.from(viewMenu.querySelectorAll("button[data-view-filter]")).forEach((item) => {
        const active = item.getAttribute("data-view-filter") === this.viewFilter;
        item.style.background = active ? "var(--btn-outline-hover-bg)" : "transparent";
        item.style.fontWeight = active ? "700" : "400";
      });
    };

    const mkViewItem = (value, label) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = label;
      item.setAttribute("data-view-filter", value);
      item.style.display = "block";
      item.style.width = "100%";
      item.style.textAlign = "left";
      item.style.border = "none";
      item.style.background = "transparent";
      item.style.color = "var(--text-main)";
      item.style.padding = "8px 10px";
      item.style.borderRadius = "6px";
      item.style.minHeight = "30px";
      item.style.cursor = "pointer";
      item.onmouseenter = () => {
        item.style.background = "var(--btn-outline-hover-bg)";
      };
      item.onmouseleave = () => {
        if (item.getAttribute("data-view-filter") !== this.viewFilter) {
          item.style.background = "transparent";
        }
      };
      item.onclick = () => {
        this.viewFilter = value;
        updateViewMenuUi();
        this._setViewMenuOpen(false);
        this._renderListOnly();
      };
      return item;
    };

    viewMenu.append(
      mkViewItem("all", "Alle"),
      mkViewItem("tasks", "Aufgaben"),
      mkViewItem("verzug", "Verzug"),
      mkViewItem("decisions", "Festlegungen")
    );
    updateViewMenuUi();
    document.body.appendChild(viewMenu);

    viewBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (viewBtn.disabled) return;
      this._setViewMenuOpen(!this._viewMenuOpen);
    };
    viewBtn.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      viewBtn.click();
    });

    if (this._viewMenuDocMouseDown) {
      document.removeEventListener("mousedown", this._viewMenuDocMouseDown, true);
      this._viewMenuDocMouseDown = null;
    }
    this._viewMenuDocMouseDown = (e) => {
      if (!this._viewMenuOpen) return;
      if (viewWrap.contains(e.target)) return;
      if (viewMenu.contains(e.target)) return;
      this._setViewMenuOpen(false);
    };
    document.addEventListener("mousedown", this._viewMenuDocMouseDown, true);

    viewWrap.append(viewBtn);

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
    topsText.textContent = "Protokoll";
    topsText.style.fontWeight = "600";
    topsText.style.whiteSpace = "nowrap";
    topsText.style.flex = "0 0 auto";
    topsText.style.cursor = "pointer";
    topsText.title = "Schlagwort bearbeiten";
    topsText.onclick = async () => {
      await this.dialogs.handleOpenMeetingKeyword();
    };

    const spacer = document.createElement("div");
    spacer.style.flex = "1 1 auto";

    const actionBtnsWrap = document.createElement("div");
    actionBtnsWrap.style.display = "inline-flex";
    actionBtnsWrap.style.alignItems = "center";
    actionBtnsWrap.style.gap = "8px";
    actionBtnsWrap.style.marginRight = "calc(120px - 1cm + 3mm)";
    actionBtnsWrap.append(
      viewWrap,
      btnProjectTasks,
      btnAmpelToggle,
      btnLongToggle,
      btnAudioAnalyze,
      btnEndMeeting,
      btnCloseMeeting
    );

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
      actionBtnsWrap,
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
    btnMove.style.fontSize = BTN_FONT_SIZE;
    btnMove.style.lineHeight = "1.2";
    btnMove.onclick = () => this.toggleMoveMode();

    const btnSaveTop = document.createElement("button");
    btnSaveTop.textContent = "Speichern";
    btnSaveTop.style.borderRadius = BTN_RADIUS;
    btnSaveTop.style.padding = BTN_PAD_ACTION;
    btnSaveTop.style.minHeight = BTN_MIN_H;
    btnSaveTop.style.fontSize = BTN_FONT_SIZE;
    btnSaveTop.style.lineHeight = "1.2";

    btnSaveTop.addEventListener("mousedown", () => {
      this._suppressBlurOnce = true;
    });

    btnSaveTop.onclick = async () => {
      if (this.isReadOnly) return;
      if (!this.selectedTop) return;

      const patch = this.topPatchService.collectEditorPatch();
      if (!patch) return;

      await this.topPatchService.saveMeetingTopPatch(patch, { reload: true, pulse: true });
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
    btnTrashTop.style.fontSize = BTN_FONT_SIZE;
    btnTrashTop.style.lineHeight = "1.2";
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
      t.style.fontSize = "10pt";
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

    const chkDecision = document.createElement("input");
    chkDecision.type = "checkbox";

    const titleWrap = document.createElement("div");
    titleWrap.style.display = "flex";
    titleWrap.style.flexDirection = "column";
    titleWrap.style.gap = "2px";

    const titleLabelRow = document.createElement("div");
    titleLabelRow.style.display = "flex";
    titleLabelRow.style.alignItems = "center";
    titleLabelRow.style.gap = "6px";

    const lblTitleText = document.createElement("span");
    lblTitleText.textContent = "Kurztext";
    lblTitleText.style.fontSize = "10pt";

    const titleCount = makeCountBadge(`${this._titleMax()}`);

    const labImportant = makeToggleLabel("wichtig", chkImportant);
    const labHidden = makeToggleLabel("TOP ausblenden", chkHidden);

    const updateTaskDecisionUi = () => {};

    const titleLeft = document.createElement("div");
    titleLeft.style.display = "inline-flex";
    titleLeft.style.alignItems = "center";
    titleLeft.style.gap = "6px";
    const btnTitleDictate = document.createElement("button");
    btnTitleDictate.type = "button";
    btnTitleDictate.textContent = "Diktat";
    btnTitleDictate.title = "Spracheingabe fuer Kurztext";
    btnTitleDictate.style.border = "1px solid #cfd8dc";
    btnTitleDictate.style.background = "#f7f9fb";
    btnTitleDictate.style.color = "#0b4db4";
    styleBtnBase(btnTitleDictate);
    btnTitleDictate.onclick = async () => {
      await this._startDictation({ target: "shortText", meetingId: this.meetingId, projectId: this.projectId || null });
    };

    titleLeft.append(lblTitleText, titleCount, btnTitleDictate);

    const titleRight = document.createElement("div");
    titleRight.style.display = "inline-flex";
    titleRight.style.alignItems = "center";
    titleRight.style.gap = "6px";
    titleRight.style.marginLeft = "auto";
    titleRight.append(labImportant, labHidden);

    titleLabelRow.append(titleLeft, titleRight);
    titleWrap.append(titleLabelRow, inpTitle);

    const longWrap = document.createElement("div");
    longWrap.style.display = "flex";
    longWrap.style.flexDirection = "column";
    longWrap.style.gap = "2px";
    longWrap.style.marginTop = "6px";

    const longLabelRow = document.createElement("div");
    longLabelRow.style.display = "flex";
    longLabelRow.style.alignItems = "center";
    longLabelRow.style.gap = "6px";

    const lblLongText = document.createElement("span");
    lblLongText.textContent = "Langtext";
    lblLongText.style.fontSize = "10pt";

    const longCount = makeCountBadge(`${this._longMax()}`);

    const longLeft = document.createElement("div");
    longLeft.style.display = "inline-flex";
    longLeft.style.alignItems = "center";
    longLeft.style.gap = "6px";
    const btnLongDictate = document.createElement("button");
    btnLongDictate.type = "button";
    btnLongDictate.textContent = "Diktat";
    btnLongDictate.title = "Spracheingabe fuer Langtext";
    btnLongDictate.style.border = "1px solid #cfd8dc";
    btnLongDictate.style.background = "#f7f9fb";
    btnLongDictate.style.color = "#0b4db4";
    styleBtnBase(btnLongDictate);
    btnLongDictate.onclick = async () => {
      await this._startDictation({ target: "longText", meetingId: this.meetingId, projectId: this.projectId || null });
    };

    longLeft.append(lblLongText, longCount, btnLongDictate);

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
    editorRow.style.gap = "8px";

    const leftCol = document.createElement("div");
    leftCol.style.display = "flex";
    leftCol.style.flexDirection = "column";
    leftCol.style.gap = "6px";
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
    metaCol.style.gap = "6px";
    metaCol.style.flex = "0 0 114px";
    metaCol.style.width = "114px";
    metaCol.style.minWidth = "114px";
    metaCol.style.maxWidth = "120px";
    metaCol.style.paddingLeft = "6px";

    const mkMetaField = (labelText) => {
      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.gap = "2px";

      const lab = document.createElement("span");
      lab.textContent = labelText;
      lab.style.fontSize = "10pt";
      lab.style.opacity = "0.8";

      wrap.append(lab);
      return wrap;
    };

    const dueWrap = mkMetaField("Fertig bis");
    const dueRow = document.createElement("div");
    dueRow.style.display = "flex";
    dueRow.style.alignItems = "center";
    dueRow.style.gap = "4px";
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
    statusWrap.style.width = "100%";
    statusWrap.style.maxWidth = "100%";
    statusWrap.style.minWidth = "0";
    const statusRow = document.createElement("div");
    statusRow.style.display = "flex";
    statusRow.style.alignItems = "center";
    statusRow.style.gap = "4px";
    statusRow.style.marginLeft = "-3mm";
    statusRow.style.width = "calc(100% + 3mm)";
    statusRow.style.position = "relative";
    statusRow.style.zIndex = "20";
    const selStatus = document.createElement("select");
    selStatus.style.flex = "1 1 auto";
    selStatus.style.minWidth = "0";
    selStatus.style.position = "relative";
    selStatus.style.zIndex = "21";
    const statusOptions = [
      "alle",
      "festlegung",
      "todo",
      "-",
      "in arbeit",
      "erledigt",
      "blockiert",
      "verzug",
    ];
    for (const v of statusOptions) {
      const opt = document.createElement("option");
      opt.value = v;
      if (v === "alle") opt.textContent = "Alle";
      else if (v === "festlegung") opt.textContent = "Festgelegt";
      else if (v === "todo") opt.textContent = "ToDo";
      else opt.textContent = v;
      if (v === "todo") this._todoStatusOptionEl = opt;
      selStatus.appendChild(opt);
    }
    const statusMarkers = document.createElement("div");
    statusMarkers.style.display = "flex";
    statusMarkers.style.alignItems = "center";
    statusMarkers.style.gap = "4px";
    statusMarkers.style.flex = "0 0 auto";
    statusMarkers.style.marginLeft = "auto";
    const statusTaskMarker = document.createElement("img");
    statusTaskMarker.src = TODO_PNG;
    statusTaskMarker.alt = "ToDo";
    statusTaskMarker.title = "ToDo";
    statusTaskMarker.style.width = "14px";
    statusTaskMarker.style.height = "14px";
    statusTaskMarker.style.flex = "0 0 14px";
    statusTaskMarker.style.objectFit = "contain";
    statusTaskMarker.style.display = "none";
    const statusDecisionFlag = document.createElement("img");
    statusDecisionFlag.src = RED_FLAG_PNG;
    statusDecisionFlag.alt = "Festlegung";
    statusDecisionFlag.title = "Festlegung";
    statusDecisionFlag.style.width = "14px";
    statusDecisionFlag.style.height = "14px";
    statusDecisionFlag.style.flex = "0 0 14px";
    statusDecisionFlag.style.objectFit = "contain";
    statusDecisionFlag.style.display = "none";
    statusMarkers.append(statusTaskMarker, statusDecisionFlag);
    statusRow.append(selStatus, statusMarkers);
    statusWrap.append(statusRow);

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
    this.btnAudioAnalyze = btnAudioAnalyze;
    this.btnTitleDictate = btnTitleDictate;
    this.btnLongDictate = btnLongDictate;
    this.btnAmpelToggle = btnAmpelToggle;
    this.btnTasks = viewBtn;
    this.btnProjectTasks = btnProjectTasks;
    this._viewMenuEl = viewMenu;
    this._viewMenuBtn = viewBtn;

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
    this.statusTaskMarkerEl = statusTaskMarker;
    this.statusDecisionFlagEl = statusDecisionFlag;

    this.chkImportant = chkImportant;
    this.chkHidden = chkHidden;
    this.chkTask = null;
    this.chkDecision = chkDecision;
    this._updateTaskDecisionUi = updateTaskDecisionUi;

    this.titleCountEl = titleCount;
    this.longCountEl = longCount;
    this.boxTitleEl = boxTitle;

    this._applyEditFontSizes();

    this.btnSaveTop = btnSaveTop;
    this.btnTrashTop = btnTrashTop;
    this.saveInfoEl = null;

    this.btnMove = btnMove;

    this.topMetaEl = topMeta;
    this.topsTitleEl = topsText;
    this._updateAmpelToggleUi = updateAmpelToggleUi;
    updateAmpelToggleUi();
    updateTaskDecisionUi();
    this._updateTopBarProtocolTitle();

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
      this._maybeOfferDictationTermCorrection("shortText", v, inpTitle);
      inpTitle.value = this._clampStr(v, this._titleMax());
      this._updateCharCounters();

      await this.topPatchService.saveMeetingTopPatch({ title: v }, { reload: true, pulse: false });
      this.btnL1?.focus();
    });

    inpTitle.addEventListener(
      "blur",
      blurGuard(async () => {
        if (inpTitle.disabled || !this.selectedTop) return;
        const v = this._normTitle(inpTitle.value);
        this._maybeOfferDictationTermCorrection("shortText", v, inpTitle);
        inpTitle.value = this._clampStr(v, this._titleMax());
        this._updateCharCounters();

        await this.topPatchService.saveMeetingTopPatch({ title: v }, { reload: true, pulse: false });
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
      this._maybeOfferDictationTermCorrection("longText", v, taLong);
      taLong.value = this._clampStr(taLong.value, this._longMax());
      this._updateCharCounters();

      await this.topPatchService.saveMeetingTopPatch({ longtext: v }, { reload: true, pulse: false });
      this.btnL1?.focus();
    });

    taLong.addEventListener(
      "blur",
      blurGuard(async () => {
        if (taLong.disabled || !this.selectedTop) return;
        const v = this._normLong(taLong.value);
        this._maybeOfferDictationTermCorrection("longText", v, taLong);
        taLong.value = this._clampStr(taLong.value, this._longMax());
        this._updateCharCounters();

        await this.topPatchService.saveMeetingTopPatch({ longtext: v }, { reload: true, pulse: false });
      })
    );

    inpDueDate.addEventListener("change", async () => {
      if (this.isReadOnly) return;
      if (inpDueDate.disabled) return;
      if (!this.selectedTop) return;
      const dueVal = (inpDueDate.value || "").trim();
      this._dueDirty = true;
      this._dueDirtyTopId = this.selectedTop.id;
      await this.topPatchService.saveMeetingTopPatch({ due_date: dueVal || null }, { reload: true, pulse: true });
    });

    selStatus.addEventListener("change", async () => {
      if (this.isReadOnly) return;
      if (selStatus.disabled) return;
      if (!this.selectedTop) return;
      const rawStatus = (selStatus.value || "").trim();
      const st = rawStatus && rawStatus.toLowerCase() === "alle" ? "" : rawStatus;
      const stLower = (st || "").toString().trim().toLowerCase();
      if (stLower === "todo" && !this._hasTodoResponsibleSelection()) {
        selStatus.value = "-";
        this._updateStatusMarkers();
        return;
      }
      let dueVal = (this.inpDueDate?.value || "").trim();
      if (!st && this.projectEndDate) {
        const startIso = this.projectStartDate || "";
        if (!dueVal || dueVal === startIso) {
          dueVal = this.projectEndDate;
          if (this.inpDueDate) this.inpDueDate.value = dueVal;
        }
      }
      if (stLower === "festlegung") {
        dueVal = this._todayISO();
        if (this.inpDueDate) this.inpDueDate.value = dueVal;
      }
      const completedIn = this._isDoneStatus(st) ? this.meetingId : null;
      this._updateStatusMarkers();
      this._updateDueAmpelFromInputs();
      await this.topPatchService.saveMeetingTopPatch(
        {
          status: st,
          due_date: dueVal || null,
          completed_in_meeting_id: completedIn,
          is_task: stLower === "todo" ? 1 : 0,
        },
        { reload: true, pulse: true }
      );
      this._renderListOnly();
    });

    selResponsible.addEventListener("change", async () => {
      if (this.isReadOnly || this._busy) return;
      if (selResponsible.disabled) return;
      if (!this.selectedTop) return;

      const responsible = this._readResponsibleFromSelect(selResponsible, this.projectFirms || []);
      this._respDirty = true;
      this._respDirtyTopId = this.selectedTop.id;
      const currentTopId = this.selectedTop.id;

      const dueDirtySameTop = this._dueDirty && this._sameTopId(this._dueDirtyTopId, currentTopId);
      if (
        !dueDirtySameTop &&
        this.inpDueDate &&
        responsible?.kind === "all" &&
        responsible?.id === "all" &&
        this.projectEndDate
      ) {
        const currentDue = (this.inpDueDate.value || "").trim();
        const startIso = this.projectStartDate || "";
        if (!currentDue || currentDue === startIso) {
          this.inpDueDate.value = this.projectEndDate;
          this._updateDueAmpelFromInputs();
        }
      }

      if (!responsible?.id) {
        const res = await this.topPatchService.saveMeetingTopPatch(
          this.responsibleService.toPatch(null),
          { reload: false, pulse: true }
        );
        if (res?.ok) {
          if (this.selectedTop) {
            Object.assign(this.selectedTop, this.responsibleService.toPatch(null));
          }
          this._respDirty = false;
          this._respDirtyTopId = null;
          this._respLastSetTopId = this.selectedTop ? this.selectedTop.id : null;
          this._renderListOnly();
        }
        this._updateTodoStatusAvailability();
        if (!this._hasTodoResponsibleSelection() && (this.selStatus?.value || "").toLowerCase() === "todo") {
          this.selStatus.value = "-";
          this._updateStatusMarkers();
          await this.topPatchService.saveMeetingTopPatch({ status: "-", is_task: 0 }, { reload: true, pulse: true });
        }
        return;
      }

      const res = await this.topPatchService.saveMeetingTopPatch(
        this.responsibleService.toPatch(responsible),
        { reload: false, pulse: true }
      );
      if (res?.ok) {
        if (this.selectedTop) {
          Object.assign(this.selectedTop, this.responsibleService.toPatch(responsible));
        }
        this._respDirty = false;
        this._respDirtyTopId = null;
        this._respLastSetTopId = this.selectedTop ? this.selectedTop.id : null;
        this._renderListOnly();
      }
      this._updateTodoStatusAvailability();
    });

    chkImportant.addEventListener("change", async () => {
      if (this.isReadOnly) return;
      if (chkImportant.disabled) return;
      if (!this.selectedTop) return;

      await this.topPatchService.saveMeetingTopPatch(
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
      const savePromise = this.topPatchService.saveMeetingTopPatch(
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
    fireAndForget(async () => {
      await this._loadAudioLicenseState(true);
    });

    return root;
  }

  async load() {
    // Idle-State: TopsView ohne aktives Protokoll anzeigen (kein MeetingId).
    if (!this.meetingId) {
      await this._refreshIdleProtocolPresence();
      this._renderIdleState();
      return;
    }

    await this._loadProjectDates();
    await this._loadProjectTermCorrections(true);
    await this._loadAmpelSetting();
    await this.settingsService.loadTextLimitsSetting();
    await this.reloadList(true);
    this._ensureProjectFirmsLoaded().catch(() => {});
    this.applyEditBoxState();
  }


async _refreshIdleProtocolPresence() {
  // Prüft, ob im Projekt bereits Protokolle (Meetings) existieren.
  // Ergebnis steuert, ob im Idle-State zusätzlich "E-Mail senden" angeboten wird.
  this._idleHasProtocols = false;

  const pid = this.projectId;
  if (!pid) return;

  const api = window.bbmDb || {};
  if (typeof api.meetingsListByProject !== "function") {
    // Ohne API können wir es nicht sicher sagen -> konservativ: false
    return;
  }

  try {
    const res = await api.meetingsListByProject(pid);
    if (res && res.ok) {
      const list = Array.isArray(res.list) ? res.list : [];
      this._idleHasProtocols = list.length > 0;
    }
  } catch (e) {
    // ignore
  }
}

_renderIdleState() {
  // UI im Idle-State: kein aktives Protokoll.
  // Regeln:
  // - Editbox nicht anzeigen
  // - Topsbar zeigt "kein Protokoll aktiv" oder "kein Protokoll vorhanden"
  // - Ampel, Langtext, Protokoll schließen disabled
  // - Main: keine TOP-Liste, Buttons "Protokoll neu" (+ ggf. "E-Mail senden")
  try {
    // Editbox
    if (this.box) this.box.style.display = "none";

    // Buttons deaktivieren
    const dis = (b) => {
      if (!b) return;
      b.disabled = true;
      b.style.opacity = "0.55";
      b.style.cursor = "default";
    };
    dis(this.btnAmpelToggle);
    dis(this.btnLongToggle);
    dis(this.btnTasks);
    dis(this.btnProjectTasks);
    dis(this.btnEndMeeting);
    dis(this.btnAudioAnalyze);

    // Liste leeren und Idle Buttons anzeigen
    if (this.listEl) {
      this.listEl.innerHTML = "";
      const li = document.createElement("li");
      li.style.listStyle = "none";
      li.style.padding = "28px 12px";
      li.style.display = "flex";
      li.style.justifyContent = "center";

      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = "center";
      wrap.style.gap = "10px";
      wrap.style.maxWidth = "520px";
      wrap.style.width = "100%";
      wrap.style.opacity = "0.95";

      const img = document.createElement("img");
      img.src = EMPTY_LEVEL1_HINT_PNG;
      img.alt = "Hinweis Protokoll neu";
      img.style.width = "220px";
      img.style.maxWidth = "70%";
      img.style.height = "auto";
      img.style.objectFit = "contain";
      wrap.appendChild(img);

      const btnNew = document.createElement("button");
      btnNew.type = "button";
      btnNew.textContent = "Protokoll neu";
      btnNew.style.display = "inline-flex";
      btnNew.style.alignItems = "center";
      btnNew.style.justifyContent = "center";
      btnNew.style.border = "none";
      btnNew.style.background = "transparent";
      btnNew.style.color = "#111827";
      btnNew.style.padding = "0 2px 2px";
      btnNew.style.margin = "0";
      btnNew.style.minHeight = "0";
      btnNew.style.lineHeight = "1.25";
      btnNew.style.fontSize = "14px";
      btnNew.style.fontWeight = "700";
      btnNew.style.borderRadius = "0";
      btnNew.style.borderBottom = "2px solid currentColor";
      btnNew.style.borderBottomColor = "currentColor";
      btnNew.style.cursor = this._busy ? "default" : "pointer";
      btnNew.style.whiteSpace = "nowrap";
      btnNew.disabled = !!this._busy;
      btnNew.onmouseenter = () => {
        if (btnNew.disabled) return;
        btnNew.style.borderBottomColor = "#ff8c00";
      };
      btnNew.onmouseleave = () => {
        btnNew.style.borderBottomColor = "currentColor";
      };
      btnNew.onclick = () => {
        if (this._busy) return;
        this._createMeetingFromIdle().catch((e) => {
          console.error("[TopsView] _createMeetingFromIdle failed:", e);
          alert(e && e.message ? e.message : String(e));
        });
      };
      wrap.appendChild(btnNew);

      li.appendChild(wrap);
      this.listEl.appendChild(li);
      this.listEl.style.paddingBottom = "16px";
    }

    this._updateTopBarProtocolTitle();
    this._updateTopBarMetaLabels();
  } catch (e) {
    console.error("[TopsView] _renderIdleState error:", e);
  }
}


getSelectedClosedMeetingForEmail() {
  if (this.closeMeetingOutputFlow?.getSelectedClosedMeetingForEmail) {
    return this.closeMeetingOutputFlow.getSelectedClosedMeetingForEmail();
  }
  return null;
}

_writeCreateMeetingEditParticipants(val) {
  // Merker (optional) – aktuell nur für den Create-Flow relevant.
  this._createMeetingEditParticipants = !!val;
}



async _createMeetingFromIdle() {
  const api = window.bbmDb || {};
  if (typeof api.meetingsCreate !== "function") {
    alert("meetingsCreate ist nicht verfügbar (Preload/IPC fehlt).");
    return;
  }

  const pid = this.projectId;
  if (!pid) {
    alert("Kein Projekt ausgewählt.");
    return;
  }

  // Zwischendialog: Datum wählen + entscheiden, ob Teilnehmer-Popup geöffnet werden soll.
  // (Datum wird NICHT automatisch übernommen, sondern muss bestätigt werden.)
  let dateISO = this._todayISO(); // Vorschlag (User kann ändern)
  let keyword = "";
  let editParticipants = true;

  const modalRes = await this.dialogs.handleCreateMeeting({ dateISO, keyword, editParticipants });
  if (!modalRes) return;

  const pickedISO = String(modalRes.dateISO || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(pickedISO)) dateISO = pickedISO;
  keyword = String(modalRes.keyword || "").trim();
  editParticipants = modalRes.editParticipants !== false;
  this._writeCreateMeetingEditParticipants(editParticipants);

  // nextIndex ermitteln
  let nextIndex = 1;
  if (typeof api.meetingsListByProject === "function") {
    try {
      const res = await api.meetingsListByProject(pid);
      if (res && res.ok) {
        const list = Array.isArray(res.list) ? res.list : [];
        const maxIdx = list.reduce((mx, x) => Math.max(mx, Number(x.meeting_index || 0)), 0);
        nextIndex = (maxIdx || 0) + 1;
      }
    } catch (e) {
      // ignore
    }
  }

  const dd = this._isoToDDMMYYYY(dateISO);
  const idx = `#${nextIndex}`;
  const title = keyword ? `${idx} ${dd} - ${keyword}` : `${idx} ${dd}`;

  const createRes = await api.meetingsCreate({ projectId: pid, title });
  if (!createRes || !createRes.ok) {
    const msg = (createRes && createRes.error) ? createRes.error : "Besprechung anlegen fehlgeschlagen";
    console.error("[TopsView] meetingsCreate failed", { pid, dateISO, keyword, title, error: msg });
    alert("Besprechung konnte nicht angelegt werden.");
    return;
  }

  const mid = createRes && createRes.meeting ? createRes.meeting.id : null;
  if (!mid) {
    alert("Besprechung angelegt, aber keine ID erhalten.");
    return;
  }

  // Tops öffnen
  this.router.currentProjectId = pid;
  this.router.currentMeetingId = mid;
  await this.router.showTops(mid, pid);

  // optional Teilnehmer bearbeiten
  if (editParticipants && this.router && typeof this.router.openParticipantsModal === "function") {
    try {
      await this.router.openParticipantsModal({ projectId: pid, meetingId: mid });
    } catch (e) {
      console.warn("[TopsView] openParticipantsModal failed:", e);
    }
  }
}

async _enterIdleAfterClose() {
  // Nach dem fachlichen Beenden des Protokolls im TopsView bleiben und Idle anzeigen.
  this._onEnterIdleAfterClose();
  this.meetingId = null;
  this.meetingMeta = null;
  this.selectedTopId = null;
  this.selectedTop = null;
  this.isReadOnly = false;

  await this._refreshIdleProtocolPresence();
  this._renderIdleState();
}

async _findOpenMeetingIdForProject() {
  const pid = this.projectId || this.router?.currentProjectId || null;
  const api = window.bbmDb || {};
  if (!pid || typeof api.meetingsListByProject !== "function") return null;

  try {
    const res = await api.meetingsListByProject(pid);
    if (!res?.ok) return null;
    const list = Array.isArray(res.list) ? res.list : [];
    const openMeeting = list.find((m) => Number(m?.is_closed) === 0);
    return openMeeting?.id || null;
  } catch (err) {
    console.warn("[TopsView] _findOpenMeetingIdForProject failed:", err);
    return null;
  }
}

async _closeViewOnly() {
  const pid = this.projectId || this.router?.currentProjectId || null;
  const isClosedMeeting = Number(this.meetingMeta?.is_closed) === 1 || !!this.isReadOnly;

  if (isClosedMeeting) {
    const openMeetingId = await this._findOpenMeetingIdForProject();
    if (openMeetingId) {
      await this.router?.showTops?.(openMeetingId, pid);
      return;
    }
  }

  await this.router?.showProjects?.();
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
      this.btnEndMeeting.disabled = ro || busy;
      this.btnEndMeeting.style.opacity = this.btnEndMeeting.disabled ? "0.65" : "1";
      this.btnEndMeeting.style.display = ro ? "none" : "";
    }
    this._applyAudioReadOnlyState(ro, busy);
    this._updateDictationButtons({ readOnly: ro, busy, meetingId: this.meetingId });
    if (this.btnTasks) {
      this.btnTasks.disabled = ro || busy || !this.meetingId;
      this.btnTasks.style.opacity = this.btnTasks.disabled ? "0.65" : "1";
      this.btnTasks.style.display = ro || !this.meetingId ? "none" : "";
      if (this.btnTasks.disabled) this._setViewMenuOpen(false);
    }
    if (this.btnProjectTasks) {
      this.btnProjectTasks.disabled = busy || !this.projectId;
      this.btnProjectTasks.style.opacity = this.btnProjectTasks.disabled ? "0.65" : "1";
      this.btnProjectTasks.style.display = "none";
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
      .filter((x) => !this._shouldHideTopInList(x))
      .map((x) => this._topIdKey(x.id))
      .filter(Boolean);
    const idx = visibleIds.indexOf(currentId);
    const nextId = idx >= 0 ? visibleIds[idx - 1] || visibleIds[idx + 1] || null : null;

    this._deleteInFlight = true;
    this._updateDeleteControls();

    const savePromise = this.topPatchService.saveMeetingTopPatch(
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
        const markRes = await this.topTrash.markTrashed(currentId);
        if (markRes?.ok === false) {
          console.warn("[tops] topsMarkTrashed failed:", markRes.error);
        }
      }
      await this.reloadList(false);
      await this.topGapFlow.autoFixAfterDelete();
    } finally {
      this._deleteInFlight = false;
      this._updateDeleteControls();
    }
  }

  async deleteSelectedTop() {
    const t = this.selectedTop;
    if (!t) return;

    if (this.isReadOnly) {
      alert("Besprechung ist geschlossen - Löschen nicht erlaubt.");
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

    const savePromise = this.topPatchService.saveMeetingTopPatch(
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
        return;
      }
      if (typeof window.bbmDb?.topsMarkTrashed === "function") {
        const markRes = await this.topTrash.markTrashed(currentId);
        if (markRes?.ok === false) {
          console.warn("[tops] topsMarkTrashed failed:", markRes.error);
        }
      }
      await this.reloadList(false);
      await this.topGapFlow.autoFixAfterDelete();
    } finally {
      this._deleteInFlight = false;
      this._updateDeleteControls();
    }
  }

  _firstNumberGapFromItems() {
    const rows = Array.isArray(this.items) ? this.items : [];
    const groups = new Map();

    for (const row of rows) {
      const id = row?.id;
      const level = Math.floor(Number(row?.level));
      const number = Math.floor(Number(row?.number));
      if (!id || !Number.isFinite(level) || level < 1 || level > 4) continue;
      if (!Number.isFinite(number) || number < 1) continue;

      const parentTopId = row?.parent_top_id ?? null;
      const key = `${level}::${parentTopId ?? "root"}`;
      if (!groups.has(key)) groups.set(key, { level, parentTopId, items: [] });
      groups.get(key).items.push({ id, number });
    }

    const gaps = [];
    for (const group of groups.values()) {
      if (!group.items.length) continue;
      const numbers = new Set();
      let maxNumber = 0;
      for (const item of group.items) {
        numbers.add(item.number);
        if (item.number > maxNumber) maxNumber = item.number;
      }
      if (maxNumber < 1) continue;

      let missingNumber = null;
      for (let i = 1; i <= maxNumber; i += 1) {
        if (!numbers.has(i)) {
          missingNumber = i;
          break;
        }
      }
      if (missingNumber === null) continue;

      let lastTopId = null;
      for (const item of group.items) {
        if (item.number !== maxNumber) continue;
        if (lastTopId === null || String(item.id) > String(lastTopId)) lastTopId = item.id;
      }
      if (!lastTopId) continue;

      gaps.push({
        level: group.level,
        parentTopId: group.parentTopId,
        missingNumber,
        lastTopId,
      });
    }

    gaps.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      const ap = a.parentTopId ?? "";
      const bp = b.parentTopId ?? "";
      if (ap !== bp) return String(ap) < String(bp) ? -1 : 1;
      return a.missingNumber - b.missingNumber;
    });

    return gaps[0] || null;
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
      const res = await this.topService.moveTop({
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
        fireAndForget(async () => {
          // Nach dem Schieben kann in der Ursprungs-Gruppe eine Nummernlücke entstehen.
          // Die bestehende Auto-Fix-Prozedur (meetingTopsFixNumberGap) schließt diese Lücke(n) sofort.
          await this.reloadList(true);
          await this.topGapFlow.autoFixAfterDelete();
        });
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
        this.topService.listByMeeting(this.meetingId),
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
    this._updateTopBarProtocolTitle();

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

  // === CORE: List Rendering ===
  _renderListOnly() {
    const list = this.listEl;
    list.innerHTML = "";
    const hasLevel1Top = (this.items || []).some((top) => Number(top?.level) === 1);

    const movingTop = this.moveModeActive ? this.selectedTop : null;
    const fontSizes = this._getListFontSizes();
    const ampelCompute = createAmpelComputer(this.items, this._ampelBaseDate());
    const meeting = this.meetingMeta || { id: this.meetingId };
    const isMeetingClosed = Number(meeting?.is_closed) === 1;

    let collapsedParentId = null;
    for (const top of this.items) {
      if (this._shouldHideTopInList(top)) continue;
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
      const parseFlag = (v) => {
        if (v === true || v === false) return v;
        if (typeof v === "string") {
          const s = v.trim().toLowerCase();
          return s === "1" || s === "true";
        }
        const n = Number(v);
        return Number.isFinite(n) ? n === 1 : false;
      };

      const meta = this._getTopMeta(top);
      const isOld = parseFlag(
        top.is_carried_over ??
          top.isCarriedOver ??
          top.frozen_is_carried_over ??
          top.frozenIsCarriedOver
      );
      const statusLower = String(meta.status || "").trim().toLowerCase();
      const isTask = statusLower === "todo" || parseFlag(top.is_task ?? top.isTask);
      const isTouched = parseFlag(
        top.is_touched ??
          top.isTouched ??
          top.frozen_is_touched ??
          top.frozenIsTouched
      );
      const isLevel1 = Number(top.level) === 1;
      const isDone = shouldGrayTopForMeeting(top, meeting);
      const changedRaw =
        top.updated_at ??
        top.updatedAt ??
        top.changed_at ??
        top.changedAt ??
        top.frozen_changed_at ??
        top.frozenChangedAt ??
        top.longtext_changed_at ??
        top.longtextChangedAt ??
        top.created_at ??
        top.createdAt ??
        null;
      const changedDate = changedRaw ? this._formatDue(changedRaw) : "";

      const topIdKey = String(top.id);
      const isCollapsed = isLevel1 && this.level1Collapsed.has(topIdKey);
      if (isLevel1) {
        collapsedParentId = isCollapsed ? topIdKey : null;
      } else if (collapsedParentId) {
        continue;
      }

      const doneColor = "#9e9e9e";
      const shortColor = isMeetingClosed
        ? (isImportant ? "#c62828" : "black")
        : isDone
          ? doneColor
          : isImportant
            ? "#c62828"
            : isOld
              ? "black"
              : "blue";
      const longColor = isMeetingClosed
        ? (isImportant ? "#c62828" : "black")
        : isDone
          ? doneColor
          : isImportant
            ? "#c62828"
            : isOld
              ? (isTouched ? "blue" : "black")
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

            const numWrap = document.createElement("div");
      numWrap.style.display = "flex";
      numWrap.style.flexDirection = "column";
      numWrap.style.lineHeight = "1.05";

      const numLabel = document.createElement("span");
      numLabel.textContent = `${num}.`;
      numWrap.appendChild(numLabel);

      // Hinweis unter Nummer, danach Stern (Flag bleibt auch nach Kopie sichtbar)
      if (isOld && changedDate) {
        const hint = document.createElement("span");
        hint.textContent =
          changedDate && changedDate !== "-"
            ? `(Text geändert\n${changedDate})`
            : "(Text geändert)";
        hint.style.fontSize = "7pt";
        hint.style.opacity = "0.85";
        hint.style.color = "#000000";
        hint.style.lineHeight = "1.1";
        hint.style.whiteSpace = "pre";
        numWrap.appendChild(hint);
      }

      if (!isOld && !isTouched) {
        const star = document.createElement("span");
        star.textContent = "★";
        star.title = !isOld ? "Neuer TOP" : "Übernommener, geänderter TOP";
        star.setAttribute("aria-label", star.title);
        star.style.color = "#fbc02d";
        star.style.fontSize = isLevel1 ? `${Math.max(fontSizes.l1 - 1, 12)}px` : `${Math.max(fontSizes.l24 - 1, 12)}px`;
        star.style.lineHeight = "1";
        star.style.marginLeft = "0px";
        numWrap.appendChild(star);
      }

      numBlock.appendChild(numWrap);
      let lt = top.longtext ? String(top.longtext) : "";
      if (isOld && isTouched && changedDate) {
        lt = `${lt}${lt ? "\n" : ""}(Text geändert ${changedDate})`;
      }

      const textCol = renderTopTextColumn({
        titleText: `${top.title || ""}`,
        titleColor: shortColor,
        titleFontSize: isLevel1 ? `${fontSizes.l1}px` : `${fontSizes.l24}px`,
        showLongtextInList: this.showLongtextInList,
        longtext: lt,
        longtextDisplayText: this._clampStr(lt, this._longMax()),
        longtextFontSizePx: fontSizes.long,
        longtextColor: longColor,
      });

      const metaCol = this.topMetaColumnRenderer.buildMetaColumn(top, ampelCompute);

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
      hint.style.fontSize = "14px";
      hint.style.fontWeight = "600";
      hint.style.textAlign = "center";
      hint.style.color = "#1f2937";
      hint.style.display = "flex";
      hint.style.flexWrap = "wrap";
      hint.style.alignItems = "center";
      hint.style.justifyContent = "center";
      hint.style.gap = "6px";

      const hintPrefix = document.createElement("span");
      hintPrefix.textContent = "Mit Button";

      const hintBtn = document.createElement("button");
      hintBtn.textContent = "+Titel";
      hintBtn.style.display = "inline-flex";
      hintBtn.style.alignItems = "center";
      hintBtn.style.justifyContent = "center";
      hintBtn.style.border = "none";
      hintBtn.style.background = "transparent";
      hintBtn.style.color = "var(--header-text)";
      hintBtn.style.padding = "0 2px 2px";
      hintBtn.style.margin = "0";
      hintBtn.style.minHeight = "0";
      hintBtn.style.lineHeight = "1.25";
      hintBtn.style.fontSize = "13px";
      hintBtn.style.fontWeight = "700";
      hintBtn.style.borderRadius = "0";
      hintBtn.style.borderBottom = "2pt solid currentColor";
      hintBtn.style.lineHeight = "1.2";
      hintBtn.style.alignSelf = "center";
      hintBtn.style.borderBottomColor = "currentColor";
      hintBtn.style.cursor = "pointer";
      hintBtn.style.whiteSpace = "nowrap";
      hintBtn.onmouseenter = () => {
        if (hintBtn.disabled) return;
        hintBtn.style.borderBottomColor = "#ff8c00";
      };
      hintBtn.onmouseleave = () => {
        hintBtn.style.borderBottomColor = "currentColor";
      };
      hintBtn.addEventListener("click", () => {
        if (this.isReadOnly || this._busy) return;
        this.createTop(1, null);
      });

      const hintSuffix = document.createElement("span");
      hintSuffix.textContent = "den ersten Titel anlegen";

      hint.append(hintPrefix, hintBtn, hintSuffix);

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

  // === CORE: Editor State ===
  applyEditBoxState() {
    return this.editBoxStateService.applyState(this.selectedTop);
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
      const res = await this.topService.createTop({
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

  async destroy() {
    await this._destroyAudioSuggestions();
    this._destroyDictationController();

    if (this._viewMenuDocMouseDown) {
      document.removeEventListener("mousedown", this._viewMenuDocMouseDown, true);
      this._viewMenuDocMouseDown = null;
    }
    this._setViewMenuOpen(false);
    if (this._viewMenuEl && this._viewMenuEl.parentNode) {
      this._viewMenuEl.parentNode.removeChild(this._viewMenuEl);
    }
    this._closeProjectTasksPopup();
  }
}
