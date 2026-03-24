// src/renderer/views/TopsView.js
//
// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.0

import { shouldShowTopForMeeting, shouldGrayTopForMeeting } from "../utils/topVisibility.js";
import { ampelHexFrom } from "../utils/ampelColors.js";
import { createAmpelComputer } from "../utils/ampelLogic.js";
import { applyPopupButtonStyle, applyPopupCardStyle } from "../ui/popupButtonStyles.js";
import AudioSuggestionsPanel from "../ui/AudioSuggestionsPanel.js";
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
    this.selContactPerson = null;
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
    this.contactPersons = [];
    this._contactOptionsKey = "";
    this._contactSourceKey = "";
    this._contactDirty = false;
    this._contactDirtyTopId = null;
    this._contactLastSetTopId = null;
    this._contactLegacyReadonly = false;
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
    this._audioPanel = null;
    this._audioPanelBusy = false;
    this._audioPanelStatusMessage = "";
    this._audioDictationBusy = false;
    this._audioDictationActive = false;
    this._audioDictationTarget = null;
    this._audioRecorder = null;
    this._audioStream = null;
    this._lastDictation = null;
    this._termCorrections = new Map();
    this._termPromptEl = null;
    this._termPromptCleanup = null;
    this._audioLicensed = false;
    this._audioLicenseChecked = false;
    this._audioLicenseMessage = "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
    this._audioLicenseLoading = null;
    this._audioDevOverride = false;
    this._audioDevOverrideChecked = false;
    this._audioDevOverrideLoading = null;
    this._audioSuggestionsDevEnabled = false;
    this._audioSuggestionsDevChecked = false;
    this._audioSuggestionsDevLoading = null;
    this._audioSuggestionMarkTimer = null;
    this._viewMenuOpen = false;
    this._viewMenuDocMouseDown = null;
    this._viewMenuEl = null;
    this._viewMenuBtn = null;
    this._projectTasksOverlayEl = null;
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

  async _openMeetingKeywordPopup() {
    const api = window.bbmDb || {};
    if (typeof api.meetingsUpdateTitle !== "function") {
      alert("Meeting-Update ist nicht verfuegbar.");
      return;
    }

    const parts = this._parseMeetingTitleParts();

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "1400";
    overlay.tabIndex = -1;

    const modal = document.createElement("div");
    applyPopupCardStyle(modal);
    modal.style.width = "min(560px, calc(100vw - 24px))";
    modal.style.background = "#fff";
    modal.style.padding = "12px";
    modal.style.display = "grid";
    modal.style.gap = "10px";

    const title = document.createElement("div");
    title.textContent = "Schlagwort bearbeiten";
    title.style.fontWeight = "700";

    const mkReadOnly = (labelText, value) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "170px 1fr";
      row.style.gap = "8px";
      const lab = document.createElement("div");
      lab.textContent = labelText;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.readOnly = true;
      inp.value = String(value || "");
      inp.style.width = "100%";
      row.append(lab, inp);
      return row;
    };

    const rowKeyword = document.createElement("div");
    rowKeyword.style.display = "grid";
    rowKeyword.style.gridTemplateColumns = "170px 1fr";
    rowKeyword.style.gap = "8px";
    const keywordLabel = document.createElement("div");
    keywordLabel.textContent = "Schlagwort";
    const keywordInput = document.createElement("input");
    keywordInput.type = "text";
    keywordInput.value = parts.meetingKeyword || "";
    keywordInput.maxLength = 120;
    keywordInput.style.width = "100%";
    rowKeyword.append(keywordLabel, keywordInput);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel);

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.textContent = "Loeschen";
    applyPopupButtonStyle(btnDelete);

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.textContent = "Speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });

    actions.append(btnCancel, btnDelete, btnSave);

    const close = () => {
      try {
        overlay.remove();
      } catch (e) {
        // ignore
      }
    };

    const applyKeyword = async (nextKeywordRaw) => {
      const nextKeyword = String(nextKeywordRaw || "").trim();
      const titleValue = parts.meetingDateText
        ? (nextKeyword ? `${parts.meetingDateText} - ${nextKeyword}` : parts.meetingDateText)
        : nextKeyword;
      const res = await api.meetingsUpdateTitle({ meetingId: this.meetingId, title: titleValue });
      if (!res?.ok) {
        alert(res?.error || "Schlagwort konnte nicht gespeichert werden.");
        return;
      }
      if (res.meeting) {
        this.meetingMeta = res.meeting;
        this.isReadOnly = this.meetingMeta ? Number(this.meetingMeta.is_closed) === 1 : false;
      }
      this._updateTopBarProtocolTitle();
      close();
    };

    btnSave.onclick = async () => {
      await applyKeyword(keywordInput.value);
    };
    btnDelete.onclick = async () => {
      await applyKeyword("");
    };
    btnCancel.onclick = () => close();

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    });

    modal.append(
      title,
      mkReadOnly("Besprechungsnummer", parts.meetingIndex),
      mkReadOnly("Datum", parts.meetingDateText),
      rowKeyword,
      actions
    );
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => {
      try {
        keywordInput.focus();
        keywordInput.select();
      } catch (e) {
        // ignore
      }
    }, 0);
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
      this._emitAmpelStateChanged();
      return;
    }

    const res = await api.appSettingsGetMany(["tops.ampelEnabled"]);
    if (!res?.ok) {
      this.showAmpelInList = true;
      this._applyAmpelVisibility();
      if (typeof this._updateAmpelToggleUi === "function") this._updateAmpelToggleUi();
      this._emitAmpelStateChanged();
      return;
    }

    const data = res.data || {};
    this.showAmpelInList = this._parseBool(data["tops.ampelEnabled"], true);
    this._applyAmpelVisibility();
    if (typeof this._updateAmpelToggleUi === "function") this._updateAmpelToggleUi();
    this._emitAmpelStateChanged();
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
      this._emitLongtextStateChanged();
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
    this._emitLongtextStateChanged();
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
      if (this.selContactPerson) this.selContactPerson.disabled = true;
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
    if (this.selContactPerson?.disabled) {
      const wantsContactClear =
        nextPatch.contact_person_kind === null ||
        nextPatch.contact_person_id === null ||
        nextPatch.contact_person_label === null;
      if (!wantsContactClear) {
        delete nextPatch.contact_person_kind;
        delete nextPatch.contact_person_id;
        delete nextPatch.contact_person_label;
      }
    }
    if (this.chkHidden?.disabled) delete nextPatch.is_hidden;
    if (this.chkImportant?.disabled) delete nextPatch.is_important;
    if (this.chkTask?.disabled) delete nextPatch.is_task;
    if (this.chkDecision?.disabled) delete nextPatch.is_decision;

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

      this._applyPatchToCurrentSelection(nextPatch);

      if (pulse) this._showSavedPulse();

      if (reload) {
        fireAndForget(() => this.reloadList(false), "TopsView reload after save");
      } else {
        this._renderListOnly();
        this.applyEditBoxState();
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


    if (this.chkDecision && !this.chkDecision.disabled) {
      patch.is_decision = this.chkDecision.checked ? 1 : 0;
    }

    if (this.inpDueDate && !this.inpDueDate.disabled) {
      const dueVal = (this.inpDueDate.value || "").trim();
      patch.due_date = dueVal || null;
    }

    if (this.selStatus && !this.selStatus.disabled) {
      const rawStatus = (this.selStatus.value || "").trim();
      const st = rawStatus && rawStatus.toLowerCase() === "alle" ? "" : rawStatus;
      patch.status = st;
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

    if (this.selContactPerson && !this.selContactPerson.disabled) {
      const parsed = this._parseContactPersonOptionValue(this.selContactPerson.value);
      if (parsed?.id) {
        const lbl = this._getContactPersonLabelForSelection(this.selContactPerson, parsed);
        patch.contact_person_kind = parsed.kind || "project_person";
        patch.contact_person_id = String(parsed.id);
        patch.contact_person_label = lbl;
      } else {
        patch.contact_person_kind = null;
        patch.contact_person_id = null;
        patch.contact_person_label = null;
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

  _sanitizeContactPersonLabel(label) {
    const s = (label ?? "").toString().trim();
    if (!s) return "";
    if (s === "?" || s === "-") return "";
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

  _buildContactPersonDisplayLabel(row) {
    const name = (row?.name || "").toString().trim();
    if (name) return name;
    const first = (row?.first_name ?? row?.firstName ?? "").toString().trim();
    const last = (row?.last_name ?? row?.lastName ?? "").toString().trim();
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;

    const rawId = row?.id ?? row?.person_id ?? row?.personId ?? "";
    const id = rawId === null || rawId === undefined ? "" : String(rawId).trim();
    if (id) return `Unbenannter Mitarbeiter (ID: ${id})`;
    return "Unbenannter Mitarbeiter";
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

  _getContactPersonLabelForSelection(sel, parsed) {
    if (!parsed?.id) return null;

    const selectedText = this._sanitizeContactPersonLabel(sel?.selectedOptions?.[0]?.textContent || "");
    if (selectedText) return selectedText;

    const value = (sel?.value || "").toString();
    const fromCandidates = (this.contactPersons || []).find((c) => (
      this._buildContactPersonOptionValue(c?.kind, c?.id ?? c?.person_id ?? c?.personId ?? null) === value
    ));
    if (fromCandidates) return this._buildContactPersonDisplayLabel(fromCandidates);

    return this._buildContactPersonDisplayLabel({ id: parsed.id, kind: parsed.kind });
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

  _normalizeContactPersonCandidates(list, kind) {
    const out = [];
    const seen = new Set();
    for (const row of list || []) {
      const rawId = row?.id ?? row?.person_id ?? row?.personId ?? null;
      if (rawId === null || rawId === undefined || rawId === "") continue;

      const id = String(rawId).trim();
      if (!id) continue;

      const normalizedKind =
        (kind || row?.kind || "").toString().trim() || (this.isNewUi ? "project_person" : "person");
      const label = this._buildContactPersonDisplayLabel(row);
      const key = `${normalizedKind}::${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ ...row, kind: normalizedKind, id, label, displayLabel: label });
    }

    out.sort((a, b) => {
      const al = this._buildContactPersonDisplayLabel(a).toLocaleLowerCase("de-DE");
      const bl = this._buildContactPersonDisplayLabel(b).toLocaleLowerCase("de-DE");
      if (al < bl) return -1;
      if (al > bl) return 1;
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

  _buildContactPersonOptionValue(kind, id) {
    const idStr = id === null || id === undefined ? "" : String(id).trim();
    if (!idStr) return "";
    if (!this.isNewUi) return idStr;
    const kindStr = (kind || "").toString().trim() || "project_person";
    return `${kindStr}::${idStr}`;
  }

  _parseContactPersonOptionValue(value) {
    const raw = (value || "").toString().trim();
    if (!raw) return null;
    if (raw.startsWith("__legacy_contact_person__")) return null;
    if (!this.isNewUi) return { kind: "project_person", id: raw };

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

  _findContactPersonOption(value) {
    const sel = this.selContactPerson;
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

  _clearLegacyContactPersonOption() {
    const sel = this.selContactPerson;
    if (!sel) return;
    for (const opt of Array.from(sel.options || [])) {
      if (opt?.dataset?.legacyContactPerson === "1") {
        opt.remove();
      }
    }
    if (String(sel.value || "").startsWith("__legacy_contact_person__")) {
      sel.value = "";
    }
    this._contactLegacyReadonly = false;
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

  _setLegacyContactPersonOption(label) {
    const sel = this.selContactPerson;
    if (!sel) return;
    const text = this._sanitizeContactPersonLabel(label);
    if (!text) {
      this._clearLegacyContactPersonOption();
      return;
    }

    let opt = Array.from(sel.options || []).find((o) => o?.dataset?.legacyContactPerson === "1") || null;
    if (!opt) {
      opt = document.createElement("option");
      opt.dataset.legacyContactPerson = "1";
      sel.appendChild(opt);
    }
    opt.value = "__legacy_contact_person__";
    opt.textContent = text;
    sel.value = opt.value;
    this._contactLegacyReadonly = true;
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

  _resolveContactPersonSelection(top) {
    const contact = this._getTopContactPerson(top);
    const pid = (contact?.id ?? "").toString().trim();
    const pk = (contact?.kind ?? "").toString().trim();
    const pl = this._sanitizeContactPersonLabel(contact?.label);
    if (!pid) return { value: "", fallbackLabel: "" };
    if (!this.isNewUi) return { value: pid, fallbackLabel: "" };

    const candidates = this.contactPersons || [];
    if (!candidates.length) {
      return { value: "", fallbackLabel: pl || this._buildContactPersonDisplayLabel({ kind: pk, id: pid }) };
    }

    const exactKind = candidates.find((c) => String(c.kind) === pk && String(c.id) === pid);
    if (exactKind) {
      return { value: this._buildContactPersonOptionValue(exactKind.kind, exactKind.id), fallbackLabel: "" };
    }

    const sameId = candidates.filter((c) => String(c.id) === pid);
    if (sameId.length === 1) {
      const only = sameId[0];
      return { value: this._buildContactPersonOptionValue(only.kind, only.id), fallbackLabel: "" };
    }

    if (pl) {
      const plNorm = pl.toLocaleLowerCase("de-DE");
      const byLabel = candidates.filter(
        (c) => String(c.label || "").toLocaleLowerCase("de-DE") === plNorm
      );
      if (byLabel.length === 1) {
        const one = byLabel[0];
        return { value: this._buildContactPersonOptionValue(one.kind, one.id), fallbackLabel: "" };
      }
    }

    return { value: "", fallbackLabel: pl || this._buildContactPersonDisplayLabel({ kind: pk, id: pid }) };
  }

  async _loadContactPersonsForResponsible(parsed) {
    const api = window.bbmDb || {};
    const kind = (parsed?.kind || "").toString().trim();
    const id = (parsed?.id || "").toString().trim();
    if (!id || kind === "all") {
      this.contactPersons = [];
      this._contactSourceKey = "";
      return [];
    }

    let list = [];
    let normalizedKind = "project_person";
    let activeCandidateSet = null;

    if (this.projectId && typeof api.projectCandidatesList === "function") {
      try {
        const candidateRes = await api.projectCandidatesList({ projectId: this.projectId });
        if (candidateRes?.ok) {
          const rawCandidates = candidateRes.items || candidateRes.list || candidateRes.data || [];
          activeCandidateSet = new Set(
            (rawCandidates || [])
              .filter((row) => Number(row?.is_active ?? row?.isActive ?? 1) === 1)
              .map((row) => {
                const candidateKind = String(row?.kind || "").trim();
                const personId = String(row?.personId ?? row?.person_id ?? "").trim();
                return candidateKind && personId ? `${candidateKind}::${personId}` : "";
              })
              .filter((key) => !!key)
          );
        }
      } catch (_) {}
    }

    if (kind === "project_firm" || kind === "company") {
      normalizedKind = "project_person";
      if (typeof api.projectPersonsListByProjectFirm === "function") {
        const res = await api.projectPersonsListByProjectFirm(id);
        if (res?.ok) {
          list = this._normalizeContactPersonCandidates(res.list || res.items || res.rows || [], normalizedKind);
          if (activeCandidateSet) {
            list = list.filter((row) => activeCandidateSet.has(`project_person::${String(row?.id || "").trim()}`));
          }
        }
      }
    } else if (kind === "global_firm" || kind === "firm") {
      normalizedKind = "global_person";
      if (typeof api.personsListByFirm === "function") {
        const res = await api.personsListByFirm(id);
        if (res?.ok) {
          list = this._normalizeContactPersonCandidates(res.list || res.items || res.rows || [], normalizedKind);
          if (activeCandidateSet) {
            list = list.filter((row) => activeCandidateSet.has(`global_person::${String(row?.id || "").trim()}`));
          }
        }
      }
    }

    this.contactPersons = list;
    this._contactSourceKey = `${kind}::${id}`;
    return list;
  }

  _computeContactOptionsKey(sourceKey, list) {
    const base = String(sourceKey || "");
    const parts = (list || []).map((p) => {
      const kind = (p?.kind || "").toString().trim();
      const id = (p?.id ?? p?.person_id ?? p?.personId ?? "").toString().trim();
      const label = this._buildContactPersonDisplayLabel(p);
      return `${kind}|${id}|${label}`;
    });
    return `${base}::${parts.join("#")}`;
  }

  _buildContactOptionsIfNeeded(sourceKey) {
    if (!this.selContactPerson) return;

    const key = this._computeContactOptionsKey(sourceKey, this.contactPersons || []);
    if (key === this._contactOptionsKey) return;

    const sel = this.selContactPerson;
    const current = (sel.value || "").toString();

    sel.innerHTML = "";
    this._contactLegacyReadonly = false;

    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "-";
    sel.appendChild(optEmpty);

    for (const p of this.contactPersons || []) {
      const value = this._buildContactPersonOptionValue(p?.kind, p?.id ?? p?.person_id ?? p?.personId ?? null);
      if (!value) continue;
      const label = this._buildContactPersonDisplayLabel(p);
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      opt.dataset.displayLabel = label;
      sel.appendChild(opt);
    }

    this._contactOptionsKey = key;

    if (current && this._findContactPersonOption(current)) {
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

  _formatResponsible(top) {
    const res = this._getTopResponsible(top);
    const lbl = this._sanitizeResponsibleLabel(res?.label);
    if (!lbl) return "—";
    const max = 22;
    return lbl.length <= max ? lbl : lbl.slice(0, max - 1) + "…";
  }

  _formatContactPerson(top) {
    const contact = this._getTopContactPerson(top);
    const lbl = this._sanitizeContactPersonLabel(contact?.label ?? "-");
    if (!lbl || lbl === "-") return "—";
    const max = 22;
    return lbl.length <= max ? lbl : lbl.slice(0, max - 1) + "…";
  }

  _getTopResponsible(top) {
    return {
      kind: top?.responsible_kind ?? top?.responsibleKind ?? "",
      id: top?.responsible_id ?? top?.responsibleId ?? "",
      label: top?.responsible_label ?? top?.responsibleLabel ?? "",
    };
  }

  _getTopContactPerson(top) {
    return {
      kind: top?.contact_person_kind ?? top?.contactPersonKind ?? top?.contact_kind ?? top?.contactKind ?? "",
      id: top?.contact_person_id ?? top?.contactPersonId ?? "",
      label: top?.contact_person_label ?? top?.contactPersonLabel ?? top?.contact_label ?? top?.contactLabel ?? "",
    };
  }

  _getTopMeta(top) {
    return {
      dueDate: top?.due_date ?? top?.dueDate ?? "",
      status: top?.status ?? "",
      responsible: this._getTopResponsible(top),
      contactPerson: this._getTopContactPerson(top),
    };
  }

  _shouldShowMetaColumn(top) {
    const lvl = Number(top?.level);
    return Number.isFinite(lvl) && lvl >= 2 && lvl <= 4;
  }

  _applyPatchToLocalTop(top, patch) {
    if (!top || !patch || typeof patch !== "object") return;

    if (patch.title !== undefined) top.title = patch.title;
    if (patch.longtext !== undefined) top.longtext = patch.longtext;
    if (patch.due_date !== undefined) top.due_date = patch.due_date;
    if (patch.status !== undefined) top.status = patch.status;
    if (patch.completed_in_meeting_id !== undefined) {
      top.completed_in_meeting_id = patch.completed_in_meeting_id;
    }
    if (patch.is_hidden !== undefined) top.is_hidden = patch.is_hidden ? 1 : 0;
    if (patch.is_important !== undefined) top.is_important = patch.is_important ? 1 : 0;
    if (patch.is_task !== undefined) top.is_task = patch.is_task ? 1 : 0;
    if (patch.is_decision !== undefined) top.is_decision = patch.is_decision ? 1 : 0;

    if (patch.responsible_kind !== undefined) top.responsible_kind = patch.responsible_kind;
    if (patch.responsible_id !== undefined) top.responsible_id = patch.responsible_id;
    if (patch.responsible_label !== undefined) top.responsible_label = patch.responsible_label;

    if (patch.contact_person_kind !== undefined) {
      top.contact_person_kind = patch.contact_person_kind;
      top.contact_kind = patch.contact_person_kind;
    }
    if (patch.contact_kind !== undefined) {
      top.contact_kind = patch.contact_kind;
      top.contact_person_kind = patch.contact_kind;
    }
    if (patch.contact_person_id !== undefined) top.contact_person_id = patch.contact_person_id;
    if (patch.contact_person_label !== undefined) {
      top.contact_person_label = patch.contact_person_label;
      top.contact_label = patch.contact_person_label;
    }
    if (patch.contact_label !== undefined) {
      top.contact_label = patch.contact_label;
      top.contact_person_label = patch.contact_label;
    }
  }

  _applyPatchToCurrentSelection(patch) {
    if (!patch || typeof patch !== "object") return;
    const sel = this.selectedTop || null;
    const selId = sel?.id ?? this.selectedTopId;
    const inItems = selId ? this._findTopById(selId) : null;

    if (sel) this._applyPatchToLocalTop(sel, patch);
    if (inItems && inItems !== sel) this._applyPatchToLocalTop(inItems, patch);
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
    const parsed = this._parseResponsibleOptionValue(this.selResponsible.value);
    if (!parsed || !parsed.id || parsed.kind === "all") return false;
    const lbl = this._getResponsibleLabelForSelection(this.selResponsible, parsed);
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
    const val = (this.selResponsible.value || "").toString();
    const parsed = this._parseResponsibleOptionValue(val);
    if (parsed && parsed.kind === "all") return true;
    const opt = this.selResponsible.selectedOptions?.[0];
    const lbl = (opt?.textContent || "").trim().toLowerCase();
    return !parsed && !val && lbl === "alle";
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
    const on = hasTops;

    // ✅ Platz immer reservieren -> keine Sprünge
    this.topMetaEl.style.visibility = "visible";
    this.topMetaEl.style.pointerEvents = "auto";
    this.topMetaEl.style.opacity = "0.65";
    this.topMetaEl.style.borderLeft = "1px solid rgba(0,0,0,0.08)";

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

  _getAudioPanel() {
    if (!this._audioPanel) {
      this._audioPanel = new AudioSuggestionsPanel();
    }
    return this._audioPanel;
  }

  _formatAudioLicenseMessage(status = null) {
    if (status?.valid) {
      return "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
    }

    const reason = String(status?.reason || "").trim();
    switch (reason) {
      case "NO_LICENSE":
        return "Audio erfordert eine gueltige Lizenz.";
      case "LICENSE_EXPIRED":
        return "Audio ist gesperrt, weil die Lizenz abgelaufen ist.";
      case "WRONG_MACHINE":
        return "Audio ist gesperrt, weil diese Lizenz zu einem anderen Rechner gehoert.";
      case "PUBLIC_KEY_INVALID":
      case "PUBLIC_KEY_MISSING":
        return "Audio bleibt gesperrt, weil die lokale Signaturpruefung nicht vollstaendig eingerichtet ist.";
      default:
        return "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
    }
  }

  _buildLockedAudioPanelState(message) {
    return {
      title: "Sprachdatei auswerten",
      modeLabel: "Pruefmodus",
      busy: false,
      statusMessage: String(message || this._audioLicenseMessage || "").trim(),
      suggestions: [],
      audioImport: null,
      transcript: null,
      parentOptions: this._getAudioParentOptions(),
      onImportAudio: async () => {},
      onCreateDemoSuggestion: async () => {},
      onApplySuggestion: async () => {},
      onFocusSuggestion: async () => {},
      onRejectSuggestion: async () => {},
    };
  }

  _setAudioLicenseState(licensed, message = "") {
    this._audioLicensed = !!licensed;
    this._audioLicenseChecked = true;
    this._audioLicenseMessage = this._audioLicensed
      ? ""
      : (String(message || "").trim() || "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.");
    this._updateDictationButtons();

    if (this.root) {
      this.applyEditBoxState();
    }

    if (this._audioPanel && !this._audioLicensed) {
      this._audioPanelBusy = false;
      this._audioPanelStatusMessage = this._audioLicenseMessage;
      this._audioPanel.update(this._buildLockedAudioPanelState(this._audioPanelStatusMessage));
    }
  }

  async _loadAudioLicenseState(force = false) {
    if (!force && this._audioLicenseChecked) return this._audioLicensed;
    if (!force && this._audioLicenseLoading) return this._audioLicenseLoading;

    const task = (async () => {
      const devOverride = await this._loadAudioDevOverrideState(force);
      await this._loadAudioSuggestionsDevFlag(force);
      if (devOverride) {
        this._setAudioLicenseState(true, "");
        return true;
      }

      const api = window.bbmDb || {};
      if (typeof api.licenseGetStatus !== "function") {
        this._setAudioLicenseState(false, "Lizenzstatus ist nicht verfuegbar. Audio bleibt gesperrt.");
        return false;
      }

      try {
        const res = await api.licenseGetStatus();
        const features = Array.isArray(res?.features)
          ? res.features.map((value) => String(value || "").trim().toLowerCase())
          : [];
        const licensed = !!res?.ok && !!res?.valid && features.includes("audio");
        this._setAudioLicenseState(licensed, this._formatAudioLicenseMessage(res));
        return licensed;
      } catch (_err) {
        this._setAudioLicenseState(false, "Lizenzstatus konnte nicht geladen werden. Audio bleibt gesperrt.");
        return false;
      } finally {
        this._audioLicenseLoading = null;
      }
    })();

    this._audioLicenseLoading = task;
    return task;
  }

  async _loadAudioDevOverrideState(force = false) {
    if (!force && this._audioDevOverrideChecked) return this._audioDevOverride;
    if (!force && this._audioDevOverrideLoading) return this._audioDevOverrideLoading;

    const task = (async () => {
      const api = window.bbmDb || {};
      const readDevFallback = async () => {
        if (typeof api.appGetBuildChannel === "function") {
          try {
            const res = await api.appGetBuildChannel();
            const channel = String(res?.channel || "").trim().toLowerCase();
            if (res?.ok && channel === "dev") return true;
          } catch (_err) {
            // ignore
          }
        }
        if (typeof api.appIsPackaged !== "function") return false;
        try {
          const packaged = await api.appIsPackaged();
          return packaged === false;
        } catch (_err) {
          return false;
        }
      };

      if (typeof api.devAudioUnlockStatus !== "function") {
        this._audioDevOverride = await readDevFallback();
        this._audioDevOverrideChecked = true;
        this._updateDictationButtons();
        return this._audioDevOverride;
      }

      try {
        const res = await api.devAudioUnlockStatus();
        const enabled = !!res?.ok && !!res?.enabled;
        const fallback = enabled ? false : await readDevFallback();
        this._audioDevOverride = enabled;
        this._audioDevOverrideChecked = true;
        this._updateDictationButtons();
        if (fallback) {
          this._audioDevOverride = true;
          this._updateDictationButtons();
          return true;
        }
        return enabled;
      } catch (_err) {
        this._audioDevOverride = await readDevFallback();
        this._audioDevOverrideChecked = true;
        this._updateDictationButtons();
        return this._audioDevOverride;
      } finally {
        this._audioDevOverrideLoading = null;
      }
    })();

    this._audioDevOverrideLoading = task;
    return task;
  }

  async _loadAudioSuggestionsDevFlag(force = false) {
    if (!force && this._audioSuggestionsDevChecked) return this._audioSuggestionsDevEnabled;
    if (!force && this._audioSuggestionsDevLoading) return this._audioSuggestionsDevLoading;

    const task = (async () => {
      const api = window.bbmDb || {};
      if (typeof api.devAudioSuggestionsEnabled !== "function") {
        this._audioSuggestionsDevEnabled = false;
        this._audioSuggestionsDevChecked = true;
        this._applyReadOnlyState();
        return this._audioSuggestionsDevEnabled;
      }

      try {
        const res = await api.devAudioSuggestionsEnabled();
        this._audioSuggestionsDevEnabled = !!res?.ok && !!res?.enabled;
        this._audioSuggestionsDevChecked = true;
        this._applyReadOnlyState();
        return this._audioSuggestionsDevEnabled;
      } catch (_err) {
        this._audioSuggestionsDevEnabled = false;
        this._audioSuggestionsDevChecked = true;
        this._applyReadOnlyState();
        return this._audioSuggestionsDevEnabled;
      } finally {
        this._audioSuggestionsDevLoading = null;
      }
    })();

    this._audioSuggestionsDevLoading = task;
    return task;
  }

  async _ensureAudioAvailable({ alertOnFailure = true, force = false } = {}) {
    const licensed = await this._loadAudioLicenseState(force);
    if (licensed) return true;

    if (alertOnFailure) {
      alert(this._audioLicenseMessage || "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.");
    }
    return false;
  }

  _updateDictationButtons() {
    const effectiveTop = this.selectedTop || this._findTopById?.(this.selectedTopId) || null;
    if (!this.selectedTop && effectiveTop) this.selectedTop = effectiveTop;
    const baseDisabled = !!this._audioDictationBusy;
    const audioLocked = !this._audioLicensed && !this._audioDevOverride;
    const isRecording = !!this._audioDictationActive;
    const activeTarget = this._audioDictationTarget;

    if (this.btnTitleDictate) {
      const disabled = baseDisabled || audioLocked || (isRecording && activeTarget !== "shortText");
      this.btnTitleDictate.disabled = disabled;
      this.btnTitleDictate.style.opacity = disabled ? "0.6" : "1";
      this.btnTitleDictate.textContent =
        isRecording && activeTarget === "shortText" ? "Stop" : "Diktat";
      this.btnTitleDictate.style.background =
        isRecording && activeTarget === "shortText" ? "#ffebee" : "#f7f9fb";
      this.btnTitleDictate.style.color =
        isRecording && activeTarget === "shortText" ? "#b71c1c" : "#0b4db4";
      this.btnTitleDictate.title = audioLocked
        ? this._audioLicenseMessage
        : "Spracheingabe fuer Kurztext";
    }

    if (this.btnLongDictate) {
      const disabled = baseDisabled || audioLocked || (isRecording && activeTarget !== "longText");
      this.btnLongDictate.disabled = disabled;
      this.btnLongDictate.style.opacity = disabled ? "0.6" : "1";
      this.btnLongDictate.textContent =
        isRecording && activeTarget === "longText" ? "Stop" : "Diktat";
      this.btnLongDictate.style.background =
        isRecording && activeTarget === "longText" ? "#ffebee" : "#f7f9fb";
      this.btnLongDictate.style.color =
        isRecording && activeTarget === "longText" ? "#b71c1c" : "#0b4db4";
      this.btnLongDictate.title = audioLocked
        ? this._audioLicenseMessage
        : "Spracheingabe fuer Langtext";
    }
  }

  _applyDictationTextToField(targetField, transcriptText) {
    const text = String(transcriptText || "").trim();
    if (!text) return;

    if (targetField === "shortText") {
      const next = this._normTitle(text);
      if (this.inpTitle) {
        this.inpTitle.value = this._clampStr(next, this._titleMax());
        this.inpTitle.focus();
        this.inpTitle.select?.();
      }
      this._lastDictation = { field: "shortText", text: next, at: Date.now() };
    } else if (targetField === "longText") {
      const current = this.taLongtext ? String(this.taLongtext.value || "") : "";
      const joined = current ? `${current.replace(/\s+$/g, "")}\n${text}` : text;
      const next = this._normLong(joined);
      if (this.taLongtext) {
        this.taLongtext.value = this._clampStr(next, this._longMax());
        this.taLongtext.focus();
      }
      this._lastDictation = { field: "longText", text: text, at: Date.now() };
    }

    this._updateCharCounters();
  }

  _cleanupDictationText(text) {
    let cleaned = String(text || "").trim();
    if (!cleaned) return "";

    cleaned = cleaned.replace(/\s{2,}/g, " ");
    cleaned = cleaned.replace(/\s+([,.;:!?])/g, "$1");
    cleaned = cleaned.replace(/([,.;:!?])([^\s])/g, "$1 $2");
    cleaned = cleaned.replace(/([,.;:!?])\1+/g, "$1");
    cleaned = cleaned.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
    cleaned = cleaned.replace(/\)\s*(\w)/g, ") $1");
    cleaned = cleaned.replace(/\s+$/g, "").trim();

    if (/^[a-z\u00e4\u00f6\u00fc]/.test(cleaned)) {
      cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
    }

    return this._applyDictationDictionary(cleaned);
  }

  _normalizeTerm(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  _applyDictationDictionary(text) {
    let out = String(text || "");
    const replaceWord = (pattern, replacement) => {
      out = out.replace(pattern, (match) => {
        const first = match[0];
        if (first && first === first.toUpperCase()) {
          return replacement[0].toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
    };

    replaceWord(/\brohrbau\b/gi, "Rohbau");
    replaceWord(/\bschallung\b/gi, "Schalung");
    replaceWord(/\bbewehrung\b/gi, "Bewehrung");
    replaceWord(/\bbetonage\b/gi, "Betonage");
    replaceWord(/\bfreigabe\b/gi, "Freigabe");
    replaceWord(/\bnachtrag\b/gi, "Nachtrag");
    replaceWord(/\bschacht\s?hoehen\b/gi, "Schachthöhen");
    replaceWord(/\bschachthoehen\b/gi, "Schachthöhen");
    replaceWord(/\bschachthohen\b/gi, "Schachthöhen");
    replaceWord(/\bsohlen\b/gi, "Sohlen");
    replaceWord(/\babsteckung\b/gi, "Absteckung");
    replaceWord(/\bgeruestpruefung\b/gi, "Gerüstprüfung");
    replaceWord(/\bgeruest pruefung\b/gi, "Gerüstprüfung");
    replaceWord(/\bstatik\b/gi, "Statik");
    replaceWord(/\bbauzaun\b/gi, "Bauzaun");

    out = out.replace(/\bSchachthöhen\s+Sohlen\b/gi, "Schachthöhen (Sohlen)");
    out = this._applyProjectTermCorrections(out);
    return out;
  }

  _applyProjectTermCorrections(text) {
    let out = String(text || "");
    if (!this._termCorrections || this._termCorrections.size === 0) return out;

    for (const [wrongTerm, correctTerm] of this._termCorrections.entries()) {
      if (!wrongTerm || !correctTerm) continue;
      const pattern = new RegExp(`\\b${wrongTerm.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi");
      out = out.replace(pattern, (match) => {
        const first = match[0];
        if (first && first === first.toUpperCase()) {
          return correctTerm[0].toUpperCase() + correctTerm.slice(1);
        }
        return correctTerm;
      });
    }

    return out;
  }

  async _loadProjectTermCorrections(force = false) {
    if (!this.projectId) return;
    if (!force && this._termCorrections?.size) return;
    const api = window.bbmDb || {};
    if (typeof api.audioTermCorrectionsList !== "function") return;

    try {
      const res = await api.audioTermCorrectionsList({ projectId: this.projectId });
      if (!res?.ok) return;
      const map = new Map();
      const list = Array.isArray(res.list) ? res.list : [];
      for (const row of list) {
        const wrong = String(row?.wrong_term || row?.wrongTerm || "").trim();
        const correct = String(row?.correct_term || row?.correctTerm || "").trim();
        if (!wrong || !correct) continue;
        map.set(this._normalizeTerm(wrong), correct);
      }
      this._termCorrections = map;
    } catch (_err) {
      // ignore
    }
  }

  _detectSimpleTermCorrection(originalText, editedText) {
    const original = this._cleanupDictationText(originalText);
    const edited = this._cleanupDictationText(editedText);
    if (!original || !edited) return null;
    if (original === edited) return null;

    const wordRe = /[\p{L}\p{N}\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df-]+/gu;
    const origWords = original.match(wordRe) || [];
    const editWords = edited.match(wordRe) || [];
    if (origWords.length === 0 || editWords.length === 0) return null;
    if (origWords.length !== editWords.length) return null;

    let diffIndex = -1;
    for (let i = 0; i < origWords.length; i += 1) {
      if (origWords[i].toLowerCase() !== editWords[i].toLowerCase()) {
        if (diffIndex !== -1) return null;
        diffIndex = i;
      }
    }
    if (diffIndex === -1) return null;

    const wrongTerm = origWords[diffIndex].trim();
    const correctTerm = editWords[diffIndex].trim();
    if (!wrongTerm || !correctTerm) return null;
    if (wrongTerm.length < 3 || correctTerm.length < 3) return null;
    if (wrongTerm.length > 40 || correctTerm.length > 40) return null;
    if (wrongTerm.toLowerCase() === correctTerm.toLowerCase()) return null;

    return { wrongTerm, correctTerm };
  }

  _showTermCorrectionPrompt({ field, wrongTerm, correctTerm, anchorEl }) {
    if (!anchorEl) return;
    if (this._termPromptEl) {
      this._termPromptEl.remove();
      this._termPromptEl = null;
    }

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "10px";
    wrap.style.marginTop = "4px";
    wrap.style.padding = "4px 8px";
    wrap.style.border = "1px solid #ffe0b2";
    wrap.style.background = "#fff8e1";
    wrap.style.borderRadius = "6px";
    wrap.style.fontSize = "12px";
    wrap.style.color = "#5d4037";
    wrap.style.zIndex = "5";

    const text = document.createElement("div");
    text.textContent = `Korrektur merken? '${wrongTerm}' → '${correctTerm}'`;

    const btnYes = document.createElement("button");
    btnYes.type = "button";
    btnYes.textContent = "Merken";
    btnYes.style.border = "1px solid #cfd8dc";
    btnYes.style.background = "#f7f9fb";
    btnYes.style.borderRadius = "6px";
    btnYes.style.padding = "3px 8px";
    btnYes.style.cursor = "pointer";

    const btnNo = document.createElement("button");
    btnNo.type = "button";
    btnNo.textContent = "Nein";
    btnNo.style.border = "1px solid #cfd8dc";
    btnNo.style.background = "#f7f9fb";
    btnNo.style.borderRadius = "6px";
    btnNo.style.padding = "3px 8px";
    btnNo.style.cursor = "pointer";

    wrap.append(text, btnYes, btnNo);
    anchorEl.insertAdjacentElement("afterend", wrap);
    this._termPromptEl = wrap;

    const cleanup = () => {
      if (this._termPromptEl) this._termPromptEl.remove();
      this._termPromptEl = null;
      if (this._termPromptCleanup) this._termPromptCleanup = null;
    };

    btnNo.onclick = () => cleanup();
    btnYes.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.audioTermCorrectionUpsert === "function" && this.projectId) {
        await api.audioTermCorrectionUpsert({
          projectId: this.projectId,
          wrongTerm,
          correctTerm,
        });
        this._termCorrections.set(this._normalizeTerm(wrongTerm), correctTerm);
      }
      cleanup();
    };

    this._termPromptCleanup = cleanup;
  }

  _maybeOfferTermCorrection(field, newValue, anchorEl) {
    const last = this._lastDictation;
    if (!last || last.field !== field) return;
    const maxAgeMs = 10 * 60 * 1000;
    if (Date.now() - (last.at || 0) > maxAgeMs) {
      this._lastDictation = null;
      return;
    }

    const correction = this._detectSimpleTermCorrection(last.text || "", newValue || "");
    this._lastDictation = null;
    if (!correction) return;

    const normalizedWrong = this._normalizeTerm(correction.wrongTerm);
    if (this._termCorrections.has(normalizedWrong)) return;
    this._pendingTermPrompt = {
      field,
      wrongTerm: correction.wrongTerm,
      correctTerm: correction.correctTerm,
      topId: this.selectedTop?.id ?? null,
      at: Date.now(),
    };
    this._showTermCorrectionPrompt({
      field,
      wrongTerm: correction.wrongTerm,
      correctTerm: correction.correctTerm,
      anchorEl,
    });
  }

  _tryShowPendingTermPrompt() {
    const pending = this._pendingTermPrompt;
    if (!pending) return;
    if (!this.selectedTop || !this._sameTopId(this.selectedTop.id, pending.topId)) return;
    if (Date.now() - (pending.at || 0) > 2 * 60 * 1000) {
      this._pendingTermPrompt = null;
      return;
    }
    const anchorEl = pending.field === "shortText" ? this.inpTitle : this.taLongtext;
    if (!anchorEl) return;
    this._showTermCorrectionPrompt({
      field: pending.field,
      wrongTerm: pending.wrongTerm,
      correctTerm: pending.correctTerm,
      anchorEl,
    });
    this._pendingTermPrompt = null;
  }

  _deriveShortTextFromDictation(text) {
    const cleaned = this._cleanupDictationText(text).replace(/^[.!?;,:-]+\s*/g, "").trim();
    if (!cleaned) return "";

    const dotIndex = cleaned.indexOf(".");
    const commaIndex = cleaned.indexOf(",");
    const cutIndex = dotIndex >= 0 ? dotIndex : commaIndex >= 0 ? commaIndex : -1;
    let title =
      cutIndex >= 0
        ? cleaned.slice(0, cutIndex).trim()
        : cleaned.length > 80
        ? cleaned.slice(0, 80).trim()
        : cleaned;

    title = title.replace(/[.!?;,]+$/g, "").trim();
    if (!title) return cleaned;

    const stop = new Set([
      "mit",
      "ist",
      "sind",
      "wird",
      "werden",
      "war",
      "waren",
      "muss",
      "muessen",
      "soll",
      "sollen",
      "noch",
      "zu",
      "auf",
      "fuer",
      "von",
      "im",
      "am",
      "an",
      "der",
      "die",
      "das",
      "und",
      "oder",
      "bei",
      "beim",
      "zum",
      "zur",
      "des",
      "den",
      "dem",
    ]);

    const words = title.split(/\s+/).filter(Boolean);
    while (words.length > 2) {
      const last = words[words.length - 1].toLowerCase();
      if (!stop.has(last)) break;
      words.pop();
    }
    const compact = words.join(" ").trim();
    if (compact.length >= 6) return compact;
    return title;
  }

  async _runFieldDictation(targetField) {
    if (this._audioDictationActive && this._audioDictationTarget === targetField) {
      await this._stopFieldDictation();
      return;
    }
    await this._startFieldDictation(targetField);
  }

  async _startFieldDictation(targetField) {
    if (!(await this._ensureAudioAvailable())) return;
    if (this._audioDictationBusy || this._audioDictationActive) return;
    if (!this.selectedTop) {
      const fallbackTop = this._findTopById?.(this.selectedTopId) || null;
      if (fallbackTop) this.selectedTop = fallbackTop;
    }
    if (!this.selectedTop) {
      alert("Bitte zuerst einen TOP auswaehlen.");
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      alert("Mikrofonaufnahme wird nicht unterstuetzt.");
      return;
    }

    this._audioDictationBusy = true;
    this._updateDictationButtons();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      const mimeType =
        preferredTypes.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event?.data && event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        await this._handleDictationBlob(blob, recorder._bbmTargetField || targetField);
      };

      recorder.start();
      recorder._bbmTargetField = targetField;
      this._audioRecorder = recorder;
      this._audioStream = stream;
      this._audioDictationActive = true;
      this._audioDictationTarget = targetField;
    } catch (err) {
      alert(err?.message || String(err));
    } finally {
      this._audioDictationBusy = false;
      this._updateDictationButtons();
    }
  }

  async _stopFieldDictation() {
    if (!this._audioRecorder) return;
    try {
      this._audioRecorder.stop();
    } catch (_err) {
      // ignore
    }
    if (this._audioStream) {
      this._audioStream.getTracks().forEach((track) => track.stop());
    }
    this._audioRecorder = null;
    this._audioStream = null;
    this._audioDictationActive = false;
    this._audioDictationTarget = null;
    this._updateDictationButtons();
  }

  async _handleDictationBlob(blob, targetField) {
    if (!blob || !blob.size) {
      alert("Aufnahme ist leer.");
      return;
    }

    const api = window.bbmDb || {};
    if (typeof api.audioTranscribeBlob !== "function") {
      alert("Audio-Transkription ist nicht verfuegbar.");
      return;
    }

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || "");
        const payload = result.includes(",") ? result.split(",").pop() : result;
        resolve(payload || "");
      };
      reader.onerror = () => reject(reader.error || new Error("Datei konnte nicht gelesen werden"));
      reader.readAsDataURL(blob);
    });

    this._audioDictationBusy = true;
    this._updateDictationButtons();

    try {
      const res = await api.audioTranscribeBlob({
        meetingId: this.meetingId,
        projectId: this.projectId || null,
        mimeType: blob.type || "audio/webm",
        base64,
      });
      if (!res?.ok) {
        throw new Error(res?.error || "Transkription fehlgeschlagen.");
      }
      const transcriptText = String(res?.transcript?.full_text || "").trim();
      if (!transcriptText) {
        alert("Transkription ist leer.");
        return;
      }
      const cleanedText = this._cleanupDictationText(transcriptText);
      if (targetField === "shortText") {
        const shortText = this._deriveShortTextFromDictation(cleanedText) || cleanedText;
        this._applyDictationTextToField("shortText", shortText);
      } else {
        this._applyDictationTextToField(targetField || "longText", cleanedText);
      }
    } catch (err) {
      alert(err?.message || String(err));
    } finally {
      this._audioDictationBusy = false;
      this._updateDictationButtons();
    }
  }

  _manualAssignTitle() {
    return "Manuell zuordnen";
  }

  _normalizeManualAssignTitle(value) {
    return String(value || "").trim().toLocaleLowerCase("de-DE");
  }

  _findManualAssignTop() {
    const target = this._normalizeManualAssignTitle(this._manualAssignTitle());
    return (
      (this.items || []).find((item) => {
        return Number(item?.level) === 1 && this._normalizeManualAssignTitle(item?.title) === target;
      }) || null
    );
  }

  _hasManualAssignChildren() {
    const manualAssignTop = this._findManualAssignTop();
    if (!manualAssignTop?.id) return false;
    const itemById = new Map((this.items || []).map((item) => [String(item.id), item]));
    const rootId = String(manualAssignTop.id);
    return (this.items || []).some((item) => {
      if (Number(item?.is_hidden || 0) === 1) return false;
      let parentId = String(item?.parent_top_id || "").trim();
      while (parentId) {
        if (parentId === rootId) return true;
        parentId = String(itemById.get(parentId)?.parent_top_id || "").trim();
      }
      return false;
    });
  }

  _getAudioParentOptions() {
    const list = Array.isArray(this.items) ? this.items : [];
    return list
      .filter((item) => {
        const level = Number(item?.level || 0);
        return Number(item?.is_hidden || 0) !== 1 && level >= 1 && level < 4;
      })
      .map((item) => {
        const level = Math.max(1, Number(item?.level || 1));
        const prefix = level > 1 ? `${"  ".repeat(level - 1)}- ` : "";
        const number = String(item?.number || "").trim();
        const title = String(item?.title || "").trim();
        const label = `${prefix}${number ? `${number} ` : ""}${title || item?.id || ""}`.trim();
        return {
          id: String(item.id),
          label,
          level,
        };
      });
  }

  async _focusAudioSuggestion(suggestion, options = {}) {
    const overrideParentTopId = String(options?.overrideParentTopId || "").trim() || null;
    const type = String(suggestion?.type || "").trim();

    let targetTopId = null;
    if (type === "append_to_top") {
      targetTopId = String(suggestion?.target_top_id || suggestion?.targetTopId || "").trim() || null;
    } else if (overrideParentTopId) {
      targetTopId = overrideParentTopId;
    } else if (type === "create_child_top") {
      targetTopId = String(suggestion?.parent_top_id || suggestion?.parentTopId || "").trim() || null;
    } else if (type === "manual_assign_child_top") {
      targetTopId = String(this._findManualAssignTop()?.id || "").trim() || null;
    }

    if (!targetTopId) return;
    const target = this._findTopById(targetTopId);
    if (!target) return;

    this.selectedTopId = target.id;
    this.selectedTop = target;
    this._userSelectedTop = true;
    this.applyEditBoxState();
    this._updateDictationButtons();
    this._updateMoveControls();
    this._updateDeleteControls();
    this._updateCreateChildControls();
    this._setMarkedTopIds([target.id]);

    if (this._audioSuggestionMarkTimer) {
      clearTimeout(this._audioSuggestionMarkTimer);
      this._audioSuggestionMarkTimer = null;
    }
    this._audioSuggestionMarkTimer = setTimeout(() => {
      this._clearMarkedTopIds();
      this._audioSuggestionMarkTimer = null;
    }, 2500);

    this._renderListOnly();
    requestAnimationFrame(() => this._scrollListToSelectedAndEnd());
  }

  async _warnAboutManualAssignBeforeClose() {
    if (!this._hasManualAssignChildren()) return true;
    return window.confirm(
      "Im Bereich 'Manuell zuordnen' befinden sich noch nicht zugeordnete Punkte.\n\nTrotzdem abschließen?"
    );
  }

  async _loadAudioSuggestions() {
    if (!(await this._ensureAudioAvailable({ alertOnFailure: false }))) {
      return { suggestions: [], audioImport: null, transcript: null };
    }

    if (!this.meetingId || typeof window?.bbmDb?.audioGetSuggestions !== "function") {
      return { suggestions: [], audioImport: null, transcript: null };
    }

    const res = await window.bbmDb.audioGetSuggestions({
      meetingId: this.meetingId,
      status: "pending",
    });
    if (!res?.ok) throw new Error(res?.error || "Vorschl?ge konnten nicht geladen werden.");
    return {
      suggestions: Array.isArray(res.list) ? res.list : [],
      audioImport: res.audioImport || null,
      transcript: res.transcript || null,
    };
  }

  async _refreshAudioPanel(options = {}) {
    const panel = this._getAudioPanel();
    const forceMessage =
      options && Object.prototype.hasOwnProperty.call(options, "statusMessage")
        ? options.statusMessage
        : undefined;

    if (!(await this._loadAudioLicenseState())) {
      panel.update(
        this._buildLockedAudioPanelState(
          forceMessage !== undefined ? String(forceMessage || "") : this._audioLicenseMessage
        )
      );
      return;
    }

    try {
      const audioState = await this._loadAudioSuggestions();
      const suggestions = Array.isArray(audioState?.suggestions) ? audioState.suggestions : [];
      const fallbackMessage = suggestions.length
        ? ""
        : "Aktuell liegen keine Vorschl?ge vor. Die Transkription ist real angebunden, die Zuordnungslogik bleibt noch Platzhalter.";
      panel.update({
        title: "Sprachdatei auswerten",
        modeLabel: "Pr?fmodus",
        busy: !!this._audioPanelBusy,
        statusMessage:
          forceMessage !== undefined
            ? String(forceMessage || "")
            : (this._audioPanelStatusMessage || fallbackMessage),
        suggestions,
        audioImport: audioState?.audioImport || null,
        transcript: audioState?.transcript || null,
        parentOptions: this._getAudioParentOptions(),
        onImportAudio: async () => this._runAudioImportFlow(),
        onCreateDemoSuggestion: async (demoType) => this._createDemoAudioSuggestion(demoType),
        onApplySuggestion: async (suggestion, extra = {}) => this._applyAudioSuggestion(suggestion, extra),
        onFocusSuggestion: async (suggestion, extra = {}) => this._focusAudioSuggestion(suggestion, extra),
        onRejectSuggestion: async (suggestion) => this._rejectAudioSuggestion(suggestion),
      });
    } catch (err) {
      panel.update({
        title: "Sprachdatei auswerten",
        modeLabel: "Pr?fmodus",
        busy: !!this._audioPanelBusy,
        statusMessage: err?.message || String(err),
        suggestions: [],
        audioImport: null,
        transcript: null,
        parentOptions: this._getAudioParentOptions(),
        onImportAudio: async () => this._runAudioImportFlow(),
        onCreateDemoSuggestion: async (demoType) => this._createDemoAudioSuggestion(demoType),
        onApplySuggestion: async (suggestion, extra = {}) => this._applyAudioSuggestion(suggestion, extra),
        onFocusSuggestion: async (suggestion, extra = {}) => this._focusAudioSuggestion(suggestion, extra),
        onRejectSuggestion: async (suggestion) => this._rejectAudioSuggestion(suggestion),
      });
    }
  }

  async _openAudioPanel() {
    if (!this.meetingId || this.isReadOnly) return;
    const panel = this._getAudioPanel();

    if (!(await this._loadAudioLicenseState())) {
      panel.open(this._buildLockedAudioPanelState(this._audioLicenseMessage));
      return;
    }
    if (!(await this._loadAudioSuggestionsDevFlag())) {
      alert("Audio-Suggestions sind nur in der Entwicklung verfuegbar.");
      return;
    }

    panel.open({
      title: "Sprachdatei auswerten",
      modeLabel: "Pr?fmodus",
      busy: !!this._audioPanelBusy,
      statusMessage: this._audioPanelStatusMessage,
      suggestions: [],
      audioImport: null,
      transcript: null,
      parentOptions: this._getAudioParentOptions(),
      onImportAudio: async () => this._runAudioImportFlow(),
      onCreateDemoSuggestion: async (demoType) => this._createDemoAudioSuggestion(demoType),
      onApplySuggestion: async (suggestion, extra = {}) => this._applyAudioSuggestion(suggestion, extra),
      onFocusSuggestion: async (suggestion, extra = {}) => this._focusAudioSuggestion(suggestion, extra),
      onRejectSuggestion: async (suggestion) => this._rejectAudioSuggestion(suggestion),
    });
    await this._refreshAudioPanel();
  }

  async _runAudioImportFlow() {
    if (!this.meetingId || this.isReadOnly) return;
    if (!(await this._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (
      typeof api.audioImport !== "function" ||
      typeof api.audioTranscribe !== "function" ||
      typeof api.audioAnalyze !== "function"
    ) {
      alert("Audio-Funktionen sind nicht verfügbar.");
      return;
    }

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Sprachdatei wird importiert...";
    await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

    try {
      const importRes = await api.audioImport({
        meetingId: this.meetingId,
        projectId: this.projectId || this.router?.currentProjectId || null,
        processingMode: "review",
      });
      if (importRes?.canceled) {
        this._audioPanelStatusMessage = "Auswahl abgebrochen.";
        return;
      }
      if (!importRes?.ok || !importRes.audioImport?.id) {
        throw new Error(importRes?.error || "Audio-Import fehlgeschlagen.");
      }

      const audioImportId = importRes.audioImport.id;
      this._audioPanelStatusMessage = "Lokale Transkription wird gestartet...";
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

      const transcribeRes = await api.audioTranscribe({ audioImportId });
      if (!transcribeRes?.ok) {
        throw new Error(transcribeRes?.error || "Transkription fehlgeschlagen.");
      }

      this._audioPanelStatusMessage = "Zuordnungslogik wird als Platzhalter ausgef?hrt...";
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

      const analyzeRes = await api.audioAnalyze({
        audioImportId,
        processingMode: "review",
      });
      if (!analyzeRes?.ok) {
        throw new Error(analyzeRes?.error || "Analyse fehlgeschlagen.");
      }

      this._audioPanelStatusMessage =
        analyzeRes?.message ||
        "Transkript gespeichert. Die TOP-Zuordnung bleibt in diesem Stand noch ein klar markierter Platzhalter.";
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
    }
  }

  async _createDemoAudioSuggestion(demoType) {
    if (!this.meetingId || this.isReadOnly) return;
    if (!(await this._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (typeof api.audioCreateDemoSuggestion !== "function") {
      alert("audioCreateDemoSuggestion ist nicht verfügbar.");
      return;
    }

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Demo-Vorschlag wird angelegt...";
    await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

    try {
      const res = await api.audioCreateDemoSuggestion({
        meetingId: this.meetingId,
        demoType,
      });
      if (!res?.ok) {
        throw new Error(res?.error || "Demo-Vorschlag konnte nicht angelegt werden.");
      }
      this._audioPanelStatusMessage = res?.message || "Demo-Vorschlag wurde zur Prüfung angelegt.";
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
    }
  }

  async _applyAudioSuggestion(suggestion, options = {}) {
    if (!(await this._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (typeof api.audioApplySuggestion !== "function") {
      alert("audioApplySuggestion ist nicht verf?gbar.");
      return;
    }

    const suggestionId = String(suggestion?.id || "").trim();
    if (!suggestionId) return;

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Vorschlag wird ?bernommen...";
    await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

    try {
      const res = await api.audioApplySuggestion({
        suggestionId,
        overrideParentTopId: String(options?.overrideParentTopId || "").trim() || null,
      });
      if (!res?.ok) {
        throw new Error(res?.error || "Vorschlag konnte nicht ?bernommen werden.");
      }
      this._audioPanelStatusMessage = String(res?.message || "Vorschlag ?bernommen.");
      await this.reloadList(true);
      await this._focusAudioSuggestion(suggestion, options);
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
    }
  }

  async _rejectAudioSuggestion(suggestion) {
    if (!(await this._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (typeof api.audioRejectSuggestion !== "function") {
      alert("audioRejectSuggestion ist nicht verfügbar.");
      return;
    }

    const suggestionId = String(suggestion?.id || "").trim();
    if (!suggestionId) return;

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Vorschlag wird verworfen...";
    await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

    try {
      const res = await api.audioRejectSuggestion({ suggestionId });
      if (!res?.ok) {
        throw new Error(res?.error || "Vorschlag konnte nicht verworfen werden.");
      }
      this._audioPanelStatusMessage = String(res?.message || "Vorschlag verworfen.");
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
    }
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
      if (!(await this._warnAboutManualAssignBeforeClose())) return;

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
        const projIdForPrint = this.projectId || this.router?.currentProjectId || null;
        const meetingIdForPrint = this.meetingId;
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

          // Reihenfolge: Protokoll -> Firmenliste -> ToDo-Liste (alles Datei-Druck, keine Vorschau)
          const printResults = {
            protocol: { ok: false, filePath: "" },
            firms: { ok: false, filePath: "" },
            todo: { ok: false, filePath: "" },
            tops: { ok: false, filePath: "" },
          };

          try {
            if (typeof this.router?.printClosedMeetingDirect === "function") {
              const r = await this.router.printClosedMeetingDirect({
                projectId: projIdForPrint,
                meetingId: meetingIdForPrint,
              });
              printResults.protocol.ok = r?.ok !== false;
              printResults.protocol.filePath = r?.filePath || r?.path || "";
            }
          } catch (err) {
            console.warn("[tops] Protokoll-PDF nach Schließen fehlgeschlagen:", err);
            alert("Protokoll-PDF konnte nach dem Schließen nicht erzeugt werden.");
          }

          try {
            if (typeof this.router?.printFirmsDirect === "function") {
              const r = await this.router.printFirmsDirect({
                projectId: projIdForPrint,
                meetingId: meetingIdForPrint,
              });
              printResults.firms.ok = r?.ok !== false;
              printResults.firms.filePath = r?.filePath || r?.path || "";
            }
          } catch (err) {
            console.warn("[tops] Firmenliste-PDF nach Schließen fehlgeschlagen:", err);
            alert("Firmenliste-PDF konnte nach dem Schließen nicht erzeugt werden.");
          }

          try {
            if (typeof this.router?.printTodoDirect === "function") {
              const r = await this.router.printTodoDirect({
                projectId: projIdForPrint,
                meetingId: meetingIdForPrint,
              });
              printResults.todo.ok = r?.ok !== false;
              printResults.todo.filePath = r?.filePath || r?.path || "";
            }
          } catch (err) {
            console.warn("[tops] ToDo-PDF nach Schlie?en fehlgeschlagen:", err);
            alert("ToDo-PDF konnte nach dem Schlie?en nicht erzeugt werden.");
          }

          try {
            if (typeof this.router?.printTopListAllDirect === "function") {
              const r = await this.router.printTopListAllDirect({
                projectId: projIdForPrint,
                meetingId: meetingIdForPrint,
              });
              printResults.tops.ok = r?.ok !== false;
              printResults.tops.filePath = r?.filePath || r?.path || "";
            }
          } catch (err) {
            console.warn("[tops] Top-Liste-PDF nach Schlie?en fehlgeschlagen:", err);
            alert("Top-Liste-PDF konnte nach dem Schlie?en nicht erzeugt werden.");
          }

          const allPrinted =
            printResults.protocol.ok !== false &&
            printResults.firms.ok !== false &&
            printResults.todo.ok !== false &&
            printResults.tops.ok !== false;

          this._lastClosedMeetingForEmail = res?.meeting
            ? { ...res.meeting, id: res.meeting.id || meetingIdForPrint }
            : { ...(this.meetingMeta || {}), id: meetingIdForPrint };

          if (allPrinted) {
            await this._maybePromptSendAfterClose({ printResults, meeting: this._lastClosedMeetingForEmail });
          } else {
            await this._enterIdleAfterClose();
          }
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

      // Nach erfolgreichem Schließen: automatische Druckläufe (Protokoll, Firmenliste, ToDo-Liste, Top-Liste)
      try {
        const projectId = this.projectId || this.router?.currentProjectId || null;
        const meetingId = this.meetingId || this.router?.currentMeetingId || null;
        const pm = typeof this.router?._ensurePrintModal === "function" ? await this.router._ensurePrintModal() : null;

        if (pm && projectId && meetingId) {
          // Protokoll
          if (typeof pm.printClosedMeetingDirect === "function") {
            await pm.printClosedMeetingDirect({ projectId, meetingId });
          }
          // Firmenliste
          if (typeof pm._printFirmsPdf === "function") {
            await pm._printFirmsPdf({ projectId, meetingId, preview: false });
          }
          // ToDo-Liste
          if (typeof pm._printTodoPdf === "function") {
            await pm._printTodoPdf({ projectId, meetingId, preview: false });
          }
          // Top-Liste (alle)
          if (typeof pm._printTopListAllPdf === "function") {
            await pm._printTopListAllPdf({ projectId, meetingId, preview: false });
          }
        }
      } catch (errPrint) {
        console.error("[TopsView] auto-print after close failed:", errPrint);
      }

      await this._enterIdleAfterClose();
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
      await this._openAudioPanel();
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
      this._saveLongtextSetting().catch(() => {});
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
      await this._openMeetingKeywordPopup();
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
      await this._runFieldDictation("shortText");
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
      await this._runFieldDictation("longText");
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

    const contactWrap = mkMetaField("Ansprechp.");
    const selContactPerson = document.createElement("select");
    selContactPerson.style.width = "100%";
    selContactPerson.style.marginLeft = "-3mm";
    selContactPerson.style.width = "calc(100% + 3mm)";
    contactWrap.append(selContactPerson);

    metaCol.append(dueWrap, statusWrap, respWrap, contactWrap);
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
    this.selContactPerson = selContactPerson;
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
      this._maybeOfferTermCorrection("shortText", v, inpTitle);
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
        this._maybeOfferTermCorrection("shortText", v, inpTitle);
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
      this._maybeOfferTermCorrection("longText", v, taLong);
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
        this._maybeOfferTermCorrection("longText", v, taLong);
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
      this._dueDirty = true;
      this._dueDirtyTopId = this.selectedTop.id;
      await this._saveMeetingTopPatch({ due_date: dueVal || null }, { reload: true, pulse: true });
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
      await this._saveMeetingTopPatch(
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

      const val = (selResponsible.value || "").toString();
      const parsed = this._parseResponsibleOptionValue(val);
      this._respDirty = true;
      this._respDirtyTopId = this.selectedTop.id;
      const currentTopId = this.selectedTop.id;

      const dueDirtySameTop = this._dueDirty && this._sameTopId(this._dueDirtyTopId, currentTopId);
      if (
        !dueDirtySameTop &&
        this.inpDueDate &&
        parsed?.kind === "all" &&
        parsed?.id === "all" &&
        this.projectEndDate
      ) {
        const currentDue = (this.inpDueDate.value || "").trim();
        const startIso = this.projectStartDate || "";
        if (!currentDue || currentDue === startIso) {
          this.inpDueDate.value = this.projectEndDate;
          this._updateDueAmpelFromInputs();
        }
      }

      if (!parsed?.id) {
        const res = await this._saveMeetingTopPatch(
          {
            responsible_kind: null,
            responsible_id: null,
            responsible_label: null,
            contact_person_kind: null,
            contact_person_id: null,
            contact_person_label: null,
          },
          { reload: false, pulse: true }
        );
        if (res?.ok) {
          if (this.selectedTop) {
            this.selectedTop.responsible_kind = null;
            this.selectedTop.responsible_id = null;
            this.selectedTop.responsible_label = null;
            this.selectedTop.contact_person_kind = null;
            this.selectedTop.contact_person_id = null;
            this.selectedTop.contact_person_label = null;
          }
          this.contactPersons = [];
          this._contactSourceKey = "";
          this._contactOptionsKey = "";
          this._clearLegacyContactPersonOption();
          if (this.selContactPerson) {
            this.selContactPerson.innerHTML = "";
            this.selContactPerson.value = "";
            this.selContactPerson.disabled = true;
          }
          this._respDirty = false;
          this._respDirtyTopId = null;
          this._respLastSetTopId = this.selectedTop ? this.selectedTop.id : null;
          this._contactDirty = false;
          this._contactDirtyTopId = null;
          this._contactLastSetTopId = this.selectedTop ? this.selectedTop.id : null;
          this._renderListOnly();
        }
        this._updateTodoStatusAvailability();
        if (!this._hasTodoResponsibleSelection() && (this.selStatus?.value || "").toLowerCase() === "todo") {
          this.selStatus.value = "-";
          this._updateStatusMarkers();
          await this._saveMeetingTopPatch({ status: "-", is_task: 0 }, { reload: true, pulse: true });
        }
        return;
      }

      const lbl = this._getResponsibleLabelForSelection(selResponsible, parsed);
      const res = await this._saveMeetingTopPatch(
        {
          responsible_kind: parsed.kind || "company",
          responsible_id: String(parsed.id),
          responsible_label: lbl,
          contact_person_kind: null,
          contact_person_id: null,
          contact_person_label: null,
        },
        { reload: false, pulse: true }
      );
      if (res?.ok) {
        if (this.selectedTop) {
          this.selectedTop.responsible_kind = parsed.kind || "company";
          this.selectedTop.responsible_id = String(parsed.id);
          this.selectedTop.responsible_label = lbl;
          this.selectedTop.contact_person_kind = null;
          this.selectedTop.contact_person_id = null;
          this.selectedTop.contact_person_label = null;
        }
        this.contactPersons = [];
        this._contactSourceKey = "";
        this._contactOptionsKey = "";
        this._clearLegacyContactPersonOption();
        if (this.selContactPerson) {
          this.selContactPerson.innerHTML = "";
          this.selContactPerson.value = "";
          this.selContactPerson.disabled = true;
        }
        this._respDirty = false;
        this._respDirtyTopId = null;
        this._respLastSetTopId = this.selectedTop ? this.selectedTop.id : null;
        this._contactDirty = false;
        this._contactDirtyTopId = null;
        this._contactLastSetTopId = this.selectedTop ? this.selectedTop.id : null;
        const currentTopIdAfterSave = this.selectedTop ? this.selectedTop.id : null;
        await this._loadContactPersonsForResponsible(parsed);
        this._buildContactOptionsIfNeeded(`${parsed.kind || "company"}::${String(parsed.id)}`);
        if (this.selContactPerson && this.selectedTop && this._sameTopId(this.selectedTop.id, currentTopIdAfterSave)) {
          this.selContactPerson.value = "";
          this.selContactPerson.disabled =
            !this.contactPersons.length || this.isReadOnly || this._busy || !!this._contactLegacyReadonly;
        }
        this._renderListOnly();
      }
      this._updateTodoStatusAvailability();
    });

    selContactPerson.addEventListener("change", async () => {
      if (this.isReadOnly || this._busy) return;
      if (selContactPerson.disabled) return;
      if (!this.selectedTop) return;

      const parsed = this._parseContactPersonOptionValue((selContactPerson.value || "").toString());
      this._contactDirty = true;
      this._contactDirtyTopId = this.selectedTop.id;

      if (!parsed?.id) {
        const res = await this._saveMeetingTopPatch(
          { contact_person_kind: null, contact_person_id: null, contact_person_label: null },
          { reload: false, pulse: true }
        );
        if (res?.ok && this.selectedTop) {
          this.selectedTop.contact_person_kind = null;
          this.selectedTop.contact_person_id = null;
          this.selectedTop.contact_person_label = null;
          this._contactDirty = false;
          this._contactDirtyTopId = null;
          this._contactLastSetTopId = this.selectedTop.id;
          this._renderListOnly();
        }
        return;
      }

      const lbl = this._getContactPersonLabelForSelection(selContactPerson, parsed);
      const res = await this._saveMeetingTopPatch(
        {
          contact_person_kind: parsed.kind || "project_person",
          contact_person_id: String(parsed.id),
          contact_person_label: lbl,
        },
        { reload: false, pulse: true }
      );
      if (res?.ok && this.selectedTop) {
        this.selectedTop.contact_person_kind = parsed.kind || "project_person";
        this.selectedTop.contact_person_id = String(parsed.id);
        this.selectedTop.contact_person_label = lbl;
        this._contactDirty = false;
        this._contactDirtyTopId = null;
        this._contactLastSetTopId = this.selectedTop.id;
        this._renderListOnly();
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
    await this._loadTextLimitsSetting();
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

_openMailClient() {
  // Öffnet den Standard-Mailclient (Windows Handler für MAILTO).
  const subject = encodeURIComponent("Baubesprechung");
  const body = encodeURIComponent("Hallo,\n\n");
  const href = `mailto:?subject=${subject}&body=${body}`;
  try {
    window.location.href = href;
  } catch (e) {
    console.warn("[TopsView] mailto failed:", e);
  }
}

getSelectedClosedMeetingForEmail() {
  if (this._lastClosedMeetingForEmail && this._lastClosedMeetingForEmail.id) {
    return this._lastClosedMeetingForEmail;
  }
  if (this.meetingMeta && Number(this.meetingMeta.is_closed) === 1) {
    return { ...this.meetingMeta, id: this.meetingId };
  }
  return null;
}

async _maybePromptSendAfterClose({ printResults, meeting }) {
  await this._openSendMailAfterClose({ printResults, meeting });
}

async _openSendMailAfterClose({ printResults, meeting }) {
  const MainHeader = (await import("../ui/MainHeader.js")).default;
  const headerHelper = new MainHeader({ router: this.router });
  const meetingRef = meeting || this.getSelectedClosedMeetingForEmail() || { id: this.meetingId };
  const meetingId = meetingRef?.id || this.meetingId || null;

  const recOptions = await headerHelper._getMeetingRecipientOptions(meetingId);
  const allRecipients = recOptions.all || [];
  const distRecipients =
    (recOptions.anyDistributionField && recOptions.distribution.length ? recOptions.distribution : allRecipients) || [];
  let selectedRecipients = [...distRecipients];

  const { projectNumber, projectShortName } = await headerHelper._getCurrentProjectMailContext();
  const protocolTitle = await headerHelper._resolveProtocolTitleForEmail(this.projectId || this.router?.currentProjectId);
  const emailTemplate = await headerHelper._getStoredEmailTemplate();
  const templateContext = headerHelper._buildEmailTemplateContext({
    projectNumber,
    projectShortName,
    protocolTitle,
    meeting: meetingRef,
  });
  const baseSubject = headerHelper._applyEmailSubjectTemplate(emailTemplate.subject || "", templateContext) ||
    headerHelper._buildFallbackEmailSubject({ projectNumber, projectShortName, mailType: "" }) ||
    headerHelper._defaultMeetingEmailSubject(templateContext);
  const baseBody =
    (emailTemplate.body || "").trim() ||
    "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie das neue Protokoll für das oben genannte Projekt mit der Bitte um Beachtung und Veranlassung.";

  const attachments = [
    { key: "protocol", label: "Protokoll", path: printResults?.protocol?.filePath || "" },
    { key: "firms", label: "Firmenliste", path: printResults?.firms?.filePath || "" },
    { key: "todo", label: "ToDo-Liste", path: printResults?.todo?.filePath || "" },
    { key: "tops", label: "Top-Liste", path: printResults?.tops?.filePath || "" },
  ];

  // fallback: versuche gespeichertes Protokoll zu finden, falls Pfad fehlt
  if (!attachments[0].path) {
    try {
      const lookup = await headerHelper._buildProtocolPdfLookupPayload(meetingRef, this.projectId || this.router?.currentProjectId);
      if (lookup && window.bbmPrint?.findStoredProtocolPdf) {
        const found = await window.bbmPrint.findStoredProtocolPdf(lookup);
        if (found?.ok && found?.filePath) attachments[0].path = String(found.filePath || "");
      }
    } catch (_e) {
      // ignore
    }
  }

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.45)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "13000";
  overlay.tabIndex = -1;

  const card = document.createElement("div");
  applyPopupCardStyle(card);
  card.style.width = "min(720px, 94vw)";
  card.style.maxHeight = "90vh";
  card.style.display = "grid";
  card.style.gridTemplateRows = "auto 1fr auto";
  card.style.rowGap = "14px";
  card.style.padding = "16px";

  const title = document.createElement("div");
  title.textContent = "Protokoll versenden";
  title.style.fontWeight = "700";
  title.style.fontSize = "16px";

  const content = document.createElement("div");
  content.style.display = "grid";
  content.style.gridTemplateColumns = "1fr 1fr";
  content.style.gap = "14px";
  content.style.overflow = "auto";

  // Empfänger
  const recWrap = document.createElement("div");
  recWrap.style.display = "flex";
  recWrap.style.flexDirection = "column";
  recWrap.style.gap = "8px";

  const recTitle = document.createElement("div");
  recTitle.textContent = "Empfänger";
  recTitle.style.fontWeight = "700";

  const recActions = document.createElement("div");
  recActions.style.display = "flex";
  recActions.style.flexWrap = "wrap";
  recActions.style.gap = "6px";

  const mkRecAction = (label, handler) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    applyPopupButtonStyle(btn, { variant: "neutral" });
    btn.style.padding = "4px 8px";
    btn.onclick = handler;
    return btn;
  };

  const applyRecipientSelection = (list) => {
    selectedRecipients = [...list];
    Array.from(recList.querySelectorAll("input[type=checkbox]")).forEach((cb) => {
      cb.checked = selectedRecipients.includes(cb.value);
    });
  };

  recActions.append(
    mkRecAction("Alle", () => applyRecipientSelection(allRecipients)),
    mkRecAction("Keine", () => applyRecipientSelection([]))
  );

  const recList = document.createElement("div");
  recList.style.display = "flex";
  recList.style.flexDirection = "column";
  recList.style.gap = "4px";
  recList.style.maxHeight = "220px";
  recList.style.overflow = "auto";

  const mkRecRow = (email) => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = email;
    cb.checked = selectedRecipients.includes(email);
    cb.onchange = () => {
      if (cb.checked) {
        if (!selectedRecipients.includes(email)) selectedRecipients.push(email);
      } else {
        selectedRecipients = selectedRecipients.filter((x) => x !== email);
      }
    };
    const text = document.createElement("span");
    text.textContent = email;
    row.append(cb, text);
    return row;
  };

  const uniqueAll = Array.from(new Set(allRecipients));
  if (uniqueAll.length) {
    uniqueAll.forEach((mail) => recList.appendChild(mkRecRow(mail)));
  } else {
    const hint = document.createElement("div");
    hint.textContent = "Keine Empfänger gefunden.";
    hint.style.opacity = "0.7";
    recList.appendChild(hint);
  }

  recWrap.append(recTitle, recActions, recList);

  // Anhänge
  const attWrap = document.createElement("div");
  attWrap.style.display = "flex";
  attWrap.style.flexDirection = "column";
  attWrap.style.gap = "8px";

  const attTitle = document.createElement("div");
  attTitle.textContent = "Anhänge";
  attTitle.style.fontWeight = "700";

  const attList = document.createElement("div");
  attList.style.display = "flex";
  attList.style.flexDirection = "column";
  attList.style.gap = "6px";

  attachments.forEach((att) => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.onchange = () => {
      att.selected = cb.checked;
    };
    att.selected = true;
    const text = document.createElement("span");
    text.textContent = att.label + (att.path ? "" : " (Pfad fehlt)");
    row.append(cb, text);
    attList.appendChild(row);
  });

  attWrap.append(attTitle, attList);

  // Betreff / Text
  const subjectLabel = document.createElement("div");
  subjectLabel.textContent = "Betreff";
  subjectLabel.style.fontWeight = "700";
  subjectLabel.style.gridColumn = "1 / -1";

  const subjectInput = document.createElement("input");
  subjectInput.type = "text";
  subjectInput.value = baseSubject;
  subjectInput.style.width = "100%";
  subjectInput.style.maxWidth = "100%";
  subjectInput.style.boxSizing = "border-box";
  subjectInput.style.padding = "8px";
  subjectInput.style.gridColumn = "1 / -1";

  const bodyLabel = document.createElement("div");
  bodyLabel.textContent = "Mailtext";
  bodyLabel.style.fontWeight = "700";
  bodyLabel.style.gridColumn = "1 / -1";

  const bodyInput = document.createElement("textarea");
  bodyInput.value = baseBody;
  bodyInput.style.width = "100%";
  bodyInput.style.maxWidth = "100%";
  bodyInput.style.boxSizing = "border-box";
  bodyInput.style.minHeight = "180px";
  bodyInput.style.padding = "8px";
  bodyInput.style.gridColumn = "1 / -1";

  content.append(recWrap, attWrap);
  content.append(subjectLabel, subjectInput, bodyLabel, bodyInput);
  content.style.gridTemplateColumns = "1fr 1fr";
  content.style.gridTemplateRows = "auto auto auto auto";
  content.style.gridAutoFlow = "row";

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.justifyContent = "flex-end";
  actions.style.gap = "10px";

  const btnCancel = document.createElement("button");
  btnCancel.type = "button";
  btnCancel.textContent = "Abbrechen";
  applyPopupButtonStyle(btnCancel, { variant: "neutral" });


  const btnSend = document.createElement("button");
  btnSend.type = "button";
  btnSend.textContent = "Mit Outlook / Mailprogramm öffnen";
  applyPopupButtonStyle(btnSend, { variant: "primary" });

  const closeOverlay = () => {
    try {
      overlay.remove();
    } catch (_e) {
      // ignore
    }
  };

  const collectAttachments = () =>
    attachments.filter((a) => a.selected && a.path).map((a) => a.path);

  btnSend.onclick = async () => {
    btnSend.disabled = true;
    try {
      await headerHelper._openMailClient("", {
        recipients: selectedRecipients,
        subject: subjectInput.value,
        body: bodyInput.value,
        attachments: collectAttachments(),
        meeting: meetingRef,
      });
    } catch (err) {
      console.error("[tops] send mail failed:", err);
    } finally {
      closeOverlay();
      await this._enterIdleAfterClose();
    }
  };


  btnCancel.onclick = async () => {
    closeOverlay();
    await this._enterIdleAfterClose();
  };

  actions.append(btnCancel, btnSend);

  card.append(title, content, actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  try {
    overlay.focus();
  } catch (_e) {
    // ignore
  }
}



_writeCreateMeetingEditParticipants(val) {
  // Merker (optional) – aktuell nur für den Create-Flow relevant.
  this._createMeetingEditParticipants = !!val;
}

_openCreateMeetingModal({ dateISO, keyword = "", editParticipants = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";

    const panel = document.createElement("div");
    panel.style.background = "#fff";
    panel.style.borderRadius = "12px";
    panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
    panel.style.width = "min(520px, calc(100vw - 32px))";
    panel.style.padding = "16px";

    const h = document.createElement("div");
    h.textContent = "Neue Besprechung";
    h.style.fontWeight = "700";
    h.style.fontSize = "16px";
    h.style.marginBottom = "12px";
    panel.appendChild(h);

    const row = (labelText, inputEl) => {
      const r = document.createElement("div");
      r.style.display = "flex";
      r.style.flexDirection = "column";
      r.style.gap = "6px";
      r.style.marginBottom = "12px";

      const lab = document.createElement("div");
      lab.textContent = labelText;
      lab.style.fontSize = "12px";
      lab.style.color = "#444";
      r.appendChild(lab);

      r.appendChild(inputEl);
      return r;
    };

    const inpDate = document.createElement("input");
    inpDate.type = "date";
    if (typeof dateISO === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateISO)) inpDate.value = dateISO;
    inpDate.style.padding = "10px 12px";
    inpDate.style.borderRadius = "10px";
    inpDate.style.border = "1px solid rgba(0,0,0,0.2)";
    panel.appendChild(row("Datum der Besprechung", inpDate));

    const inpKw = document.createElement("input");
    inpKw.type = "text";
    inpKw.placeholder = "Schlagwort (optional)";
    inpKw.value = String(keyword || "");
    inpKw.style.padding = "10px 12px";
    inpKw.style.borderRadius = "10px";
    inpKw.style.border = "1px solid rgba(0,0,0,0.2)";
    panel.appendChild(row("Schlagwort", inpKw));

    const chkWrap = document.createElement("label");
    chkWrap.style.display = "flex";
    chkWrap.style.alignItems = "center";
    chkWrap.style.gap = "10px";
    chkWrap.style.margin = "6px 0 14px 0";
    chkWrap.style.userSelect = "none";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = !!editParticipants;

    const chkText = document.createElement("div");
    chkText.textContent = "Teilnehmer nach dem Anlegen öffnen";
    chkText.style.fontSize = "13px";

    chkWrap.appendChild(chk);
    chkWrap.appendChild(chkText);
    panel.appendChild(chkWrap);

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.justifyContent = "flex-end";
    btnRow.style.gap = "10px";

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Abbrechen";
    btnCancel.style.padding = "10px 14px";
    btnCancel.style.borderRadius = "10px";
    btnCancel.style.border = "1px solid rgba(0,0,0,0.2)";
    btnCancel.style.background = "#fff";

    const btnOk = document.createElement("button");
    btnOk.textContent = "Übernehmen";
    btnOk.style.padding = "10px 14px";
    btnOk.style.borderRadius = "10px";
    btnOk.style.border = "1px solid rgba(0,0,0,0.2)";
    btnOk.style.background = "#fff";
    btnOk.style.fontWeight = "700";

    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnOk);
    panel.appendChild(btnRow);

    const cleanup = (res) => {
      try { overlay.remove(); } catch (e) {}
      resolve(res);
    };

    btnCancel.onclick = () => cleanup(null);
    overlay.onclick = (ev) => {
      if (ev.target === overlay) cleanup(null);
    };

    const submit = () => {
      const vDate = String(inpDate.value || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(vDate)) {
        alert("Bitte ein gültiges Datum auswählen.");
        return;
      }
      cleanup({
        dateISO: vDate,
        keyword: String(inpKw.value || "").trim(),
        editParticipants: !!chk.checked,
      });
    };

    btnOk.onclick = submit;
    inpDate.onkeydown = (ev) => {
      if (ev.key === "Enter") submit();
      if (ev.key === "Escape") cleanup(null);
    };
    inpKw.onkeydown = (ev) => {
      if (ev.key === "Enter") submit();
      if (ev.key === "Escape") cleanup(null);
    };
    document.addEventListener("keydown", function escHandler(ev) {
      if (ev.key === "Escape") {
        document.removeEventListener("keydown", escHandler);
        cleanup(null);
      }
    });

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Fokus
    setTimeout(() => { try { inpDate.focus(); } catch (e) {} }, 0);
  });
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

  const modalRes = await this._openCreateMeetingModal({ dateISO, keyword, editParticipants });
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
  if (this._audioPanel && typeof this._audioPanel.close === "function") {
    this._audioPanel.close();
  }
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
    if (this.btnAudioAnalyze) {
      const audioLocked = !this._audioLicensed && !this._audioDevOverride;
      const allowLegacy = !!this._audioSuggestionsDevEnabled;
      this.btnAudioAnalyze.disabled = ro || busy || !this.meetingId || audioLocked || !allowLegacy;
      this.btnAudioAnalyze.style.opacity = this.btnAudioAnalyze.disabled ? "0.65" : "1";
      this.btnAudioAnalyze.style.display = allowLegacy ? "" : "none";
      this.btnAudioAnalyze.title = audioLocked
        ? this._audioLicenseMessage
        : allowLegacy
        ? "Audio-Suggestions (DEV)"
        : "Audio-Mapping ist deaktiviert";
    }
      this._updateDictationButtons();
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
        const markRes = await window.bbmDb.topsMarkTrashed({ topId: currentId });
        if (markRes?.ok === false) {
          console.warn("[tops] topsMarkTrashed failed:", markRes.error);
        }
      }
      await this.reloadList(false);
      await this._autoFixNumberGapsAfterDelete();
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
        return;
      }
      if (typeof window.bbmDb?.topsMarkTrashed === "function") {
        const markRes = await window.bbmDb.topsMarkTrashed({ topId: currentId });
        if (markRes?.ok === false) {
          console.warn("[tops] topsMarkTrashed failed:", markRes.error);
        }
      }
      await this.reloadList(false);
      await this._autoFixNumberGapsAfterDelete();
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

  async _autoFixNumberGapsAfterDelete() {
    if (this.isReadOnly) return;
    if (typeof window.bbmDb?.meetingTopsFixNumberGap !== "function") return;

    const maxSteps = 20;
    for (let i = 0; i < maxSteps; i += 1) {
      const gap = this._firstNumberGapFromItems();
      if (!gap?.lastTopId) break;

      const fixRes = await window.bbmDb.meetingTopsFixNumberGap({
        meetingId: this.meetingId,
        level: gap.level,
        parentTopId: gap.parentTopId ?? null,
        fromTopId: gap.lastTopId,
        toNumber: gap.missingNumber,
      });
      if (!fixRes?.ok) {
        console.warn("[tops] auto fixNumberGap failed:", fixRes?.error || fixRes?.errorCode);
        break;
      }

      await this.reloadList(false);
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
        fireAndForget(async () => {
          // Nach dem Schieben kann in der Ursprungs-Gruppe eine Nummernlücke entstehen.
          // Die bestehende Auto-Fix-Prozedur (meetingTopsFixNumberGap) schließt diese Lücke(n) sofort.
          await this.reloadList(true);
          await this._autoFixNumberGapsAfterDelete();
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
      const meta = this._getTopMeta(top);
      const parseFlag = (v) => {
        if (v === true || v === false) return v;
        if (typeof v === "string") {
          const s = v.trim().toLowerCase();
          return s === "1" || s === "true";
        }
        const n = Number(v);
        return Number.isFinite(n) ? n === 1 : false;
      };

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

      let lt = top.longtext ? String(top.longtext) : "";
      if (isOld && isTouched && changedDate) {
        lt = `${lt}${lt ? "\n" : ""}(Text geändert ${changedDate})`;
      }

      if (this.showLongtextInList && lt) {
        const longDiv = document.createElement("div");
        longDiv.textContent = this._clampStr(lt, this._longMax());
        longDiv.style.fontSize = `${fontSizes.long}px`;
        longDiv.style.opacity = "0.85";
        longDiv.style.whiteSpace = "pre-wrap";
        longDiv.style.color = longColor;
        textCol.append(longDiv);
      }

      let metaCol = null;
      if (this._shouldShowMetaColumn(top)) {
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

        const due = this._formatDue(meta.dueDate || this._resolveDisplayDueForTop(top));
        const st = this._formatStatus(meta.status);
        const resp = this._formatResponsible(top);
        const contact = this._formatContactPerson(top);

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
        stRow.style.display = "flex";
        stRow.style.alignItems = "center";
        stRow.style.gap = "8px";
        stRow.style.width = "100%";

        const stTxt = document.createElement("span");
        stTxt.textContent = `${st}`;
        stTxt.style.whiteSpace = "nowrap";
        stTxt.style.overflow = "hidden";
        stTxt.style.textOverflow = "ellipsis";
        stTxt.style.flex = "1 1 auto";
        stTxt.style.minWidth = "0";
        stRow.append(stTxt);

        if (isTask) {
          const taskMarker = document.createElement("img");
          taskMarker.src = TODO_PNG;
          taskMarker.alt = "ToDo";
          taskMarker.title = "ToDo";
          taskMarker.style.width = "14px";
          taskMarker.style.height = "14px";
          taskMarker.style.flex = "0 0 14px";
          taskMarker.style.objectFit = "contain";
          stRow.append(taskMarker);
        }

        if (this._shouldShowDecisionFlag(st)) {
          const flag = document.createElement("img");
          flag.src = RED_FLAG_PNG;
          flag.alt = "Festlegung";
          flag.title = "Festlegung";
          flag.style.width = "14px";
          flag.style.height = "14px";
          flag.style.flex = "0 0 14px";
          flag.style.objectFit = "contain";
          stRow.append(flag);
        }

        const respRow = document.createElement("div");
        respRow.textContent = `${resp}`;
        respRow.style.whiteSpace = "nowrap";
        respRow.style.overflow = "hidden";
        respRow.style.textOverflow = "ellipsis";

        const contactRow = document.createElement("div");
        contactRow.textContent = `${contact}`;
        contactRow.style.whiteSpace = "nowrap";
        contactRow.style.overflow = "hidden";
        contactRow.style.textOverflow = "ellipsis";

        metaCol.append(dueRow, stRow, respRow, contactRow);
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

  applyEditBoxState() {
    const t = this.selectedTop;

    if (!t) {
      this._dueDirty = false;
      this._dueDirtyTopId = null;
    } else if (!this._sameTopId(this._dueDirtyTopId, t.id)) {
      this._dueDirty = false;
      this._dueDirtyTopId = null;
    }

    const isLevel1 = Number(t?.level) === 1;
    if (this.editMetaCol) this.editMetaCol.style.display = isLevel1 ? "none" : "";
    if (this.editMetaSep) this.editMetaSep.style.display = isLevel1 ? "none" : "";

    if (this.boxTitleEl) {
      const num = t?.displayNumber ?? t?.number ?? "";
      this.boxTitleEl.textContent = num ? `TOP ${num} bearbeiten` : "TOP bearbeiten";
    }

    if (!t) {
      if (this._termPromptCleanup) this._termPromptCleanup();
      this._pendingTermPrompt = null;
      this.inpTitle.value = "";
      if (this.taLongtext) this.taLongtext.value = "";
      this.chkHidden.checked = false;
      if (this.chkImportant) this.chkImportant.checked = false;
      if (this.chkTask) this.chkTask.checked = false;
      if (this.chkDecision) this.chkDecision.checked = false;

      if (this.inpDueDate) this.inpDueDate.value = "";
      if (this.selStatus) this.selStatus.value = "alle";
      if (this.selResponsible) this.selResponsible.value = "";
      if (this.selContactPerson) this.selContactPerson.value = "";
      this._clearLegacyResponsibleOption();
      this._clearLegacyContactPersonOption();
      this._respLegacyReadonly = false;
      this._contactLegacyReadonly = false;
      this._respDirty = false;
      this._contactDirty = false;
      this.contactPersons = [];
      this._contactOptionsKey = "";
      this._contactSourceKey = "";
      this._updateDueAmpelFromInputs();
      this._updateStatusMarkers();
      this._respDirtyTopId = null;
      this._respLastSetTopId = null;
      this._contactDirtyTopId = null;
      this._contactLastSetTopId = null;

      this.inpTitle.disabled = true;
      if (this.taLongtext) this.taLongtext.disabled = true;
      if (this.inpDueDate) this.inpDueDate.disabled = true;
      if (this.selStatus) this.selStatus.disabled = true;
      if (this.selResponsible) this.selResponsible.disabled = true;
      if (this.selContactPerson) {
        this.selContactPerson.innerHTML = "";
        this.selContactPerson.disabled = true;
      }
      this.chkHidden.disabled = true;
      if (this.chkImportant) this.chkImportant.disabled = true;
      if (this.chkTask) this.chkTask.disabled = true;
      if (this.chkDecision) this.chkDecision.disabled = true;

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
      if (this._updateTaskDecisionUi) this._updateTaskDecisionUi();
      return;
    }

    const titleVal = this._clampStr(t.title || "", this._titleMax());
    this.inpTitle.value = titleVal;

    if (this.taLongtext) {
      this.taLongtext.value = this._clampStr(t.longtext || "", this._longMax());
    }

    this.chkHidden.checked = Number(t.is_hidden) === 1;
    if (this.chkImportant) this.chkImportant.checked = Number(t.is_important) === 1;
    if (this.chkTask) this.chkTask.checked = Number(t.is_task ?? t.isTask ?? 0) === 1;
    if (this.chkDecision) this.chkDecision.checked = Number(t.is_decision ?? t.isDecision ?? 0) === 1;

    const meta = this._getTopMeta(t);

    if (this.inpDueDate) {
      const dueRaw = meta.dueDate;
      const dueVal = (dueRaw || "").toString();
      this.inpDueDate.value = dueVal ? dueVal.slice(0, 10) : "";
    }

      if (this.selStatus) {
        const st = (meta.status || "").toString().trim();
        const stLower = st.toLowerCase();
        if (!st && (Number(t.is_task ?? t.isTask ?? 0) === 1)) {
          this.selStatus.value = "todo";
        } else {
          this.selStatus.value = st ? st : "alle";
        }
      }

    this._applyProjectDueDefaults(t);
    this._updateDueAmpelFromInputs();
    this._updateStatusMarkers();
    this._updateTodoStatusAvailability();
    this._tryShowPendingTermPrompt();
    this._clearLegacyResponsibleOption();
    this._clearLegacyContactPersonOption();
    this._respLegacyReadonly = false;
    this._contactLegacyReadonly = false;

    const topId = t.id;
    const sameTopDirty = this._respDirty && this._sameTopId(this._respDirtyTopId, topId);
    const sameContactDirty = this._contactDirty && this._sameTopId(this._contactDirtyTopId, topId);

    this._ensureProjectFirmsLoaded()
      .then(async () => {
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
          this._applyProjectDueDefaults(t);
        }

        const selectedResponsible = this.selResponsible
          ? this._parseResponsibleOptionValue(this.selResponsible.value)
          : null;
        await this._loadContactPersonsForResponsible(selectedResponsible);
        if (!this.selectedTop || !this._sameTopId(this.selectedTop.id, topId)) return;
        this._buildContactOptionsIfNeeded(this._contactSourceKey);

        if (
          !sameContactDirty &&
          this.selContactPerson &&
          !this._sameTopId(this._contactLastSetTopId, topId)
        ) {
          const resolvedContact = this._resolveContactPersonSelection(t);
          if (resolvedContact.value && this._findContactPersonOption(resolvedContact.value)) {
            this._clearLegacyContactPersonOption();
            this.selContactPerson.value = resolvedContact.value;
          } else if (resolvedContact.fallbackLabel) {
            this._setLegacyContactPersonOption(resolvedContact.fallbackLabel);
          } else {
            this._clearLegacyContactPersonOption();
            this.selContactPerson.value = "";
          }
          this.selContactPerson.disabled =
            !selectedResponsible?.id ||
            selectedResponsible?.kind === "all" ||
            !!this._contactLegacyReadonly ||
            (!this.contactPersons.length && !resolvedContact.fallbackLabel) ||
            this.isReadOnly ||
            this._busy;
          this._contactLastSetTopId = topId;
          this._contactDirty = false;
          this._contactDirtyTopId = null;
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
      if (this.selContactPerson) this.selContactPerson.disabled = true;
      this.chkHidden.disabled = true;
      if (this.chkImportant) this.chkImportant.disabled = true;
      if (this.chkTask) this.chkTask.disabled = true;
      if (this.chkDecision) this.chkDecision.disabled = true;

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
      if (this._updateTaskDecisionUi) this._updateTaskDecisionUi();
      return;
    }

    this.inpTitle.disabled = isOld;
    if (this.taLongtext) this.taLongtext.disabled = false;
    if (this.inpDueDate) this.inpDueDate.disabled = false;
    if (this.selStatus) this.selStatus.disabled = false;
    if (this.selResponsible) this.selResponsible.disabled = !!this._respLegacyReadonly;
    if (this.selContactPerson) {
      const parsedResponsible = this.selResponsible
        ? this._parseResponsibleOptionValue(this.selResponsible.value)
        : null;
      this.selContactPerson.disabled =
        !parsedResponsible?.id ||
        parsedResponsible?.kind === "all" ||
        !!this._contactLegacyReadonly ||
        !this.contactPersons.length;
    }

    this.chkHidden.disabled = false;
    if (this.chkImportant) this.chkImportant.disabled = false;
    if (this.chkTask) this.chkTask.disabled = false;
    if (this.chkDecision) this.chkDecision.disabled = false;

    if (this.isReadOnly || this._busy) {
      if (this.selContactPerson) this.selContactPerson.disabled = true;
    }

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
    if (this._updateTaskDecisionUi) this._updateTaskDecisionUi();
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

  async destroy() {
    try {
      if (this._audioPanel && typeof this._audioPanel.destroy === "function") {
        this._audioPanel.destroy();
      }
    } catch (_err) {
      // ignore cleanup issues
    }
    if (this._audioSuggestionMarkTimer) {
      clearTimeout(this._audioSuggestionMarkTimer);
      this._audioSuggestionMarkTimer = null;
    }
    this._audioPanel = null;
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
