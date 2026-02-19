// src/renderer/ui/PrintModal.js
//
// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.1
//
// PDF-Druck Phase 1.2 (Layout/Optik):
// - nur geschlossene Besprechungen (Standard-Modal)
// - Spalten: Datum (TOP angelegt) | Nr | TOP (Kurz+Lang) | Meta (Status/Due/Ampel + Verantw.)
// - Spalten?berschrift auf JEDER Seite (thead table-header-group)
// - Ampel in Meta-Spalte, rechts
// - Stern (4.5mm, gelb mit schwarzem Rand) vor dem Kurztext, Kurz+Lang bleiben in Flucht
// - Level 1: hellgrau, KEINE Meta (kein Status/Due/Verantw/Ampel), kein "Linien-Gefrickel"
// - Text-Limits: Kurz 50 Zeichen, Lang 250 Zeichen
//
// INVARIANT (BBM): Print bleibt ?ber bbmDb.printHtmlToPdf (print:htmlToPdf).
//
// Erweiterung:
// - printVorabzug({ projectId, meetingId }) erlaubt Vorabzug für OFFENE Besprechung
// - openPrint({ projectId }) bleibt: Auswahl nur geschlossene Besprechungen
//
// WICHTIG (User-Req):
// - Projektnummer MUSS im PDF-Kopf sein (project_number aus DB), nicht nur im UI.
// - Closed-PDF: kein Wasserzeichen, kein roter Header, kein "Geschlossen"-Badge/Statuszeile.
// - Vorabzug-PDF: Wasserzeichen + Header rot.
// - beide: Projektnummer vor Bezeichnung.
import { shouldShowTopForMeeting, shouldGrayTopForMeeting } from "../utils/topVisibility.js";
import { ampelHexFrom } from "../utils/ampelColors.js";
import { createAmpelComputer } from "../utils/ampelLogic.js";
import { applyPopupButtonStyle } from "./popupButtonStyles.js";
import { createPopupOverlay, stylePopupCard, registerPopupCloseHandlers } from "./popupCommon.js";

export default class PrintModal {
  constructor({ router } = {}) {
    this.router = router;

    this.root = null;
    this.modal = null;

    this.projectId = null;

    this.previewRoot = null;
    this.previewFrame = null;
    this.previewTitleEl = null;
    this.previewCloseBtn = null;
    this.previewLoading = false;

    this.msgEl = null;
    this.titleEl = null;
    this.hintEl = null;

    this.nextMeetingEnabled = null;
    this.nextMeetingDate = null;
    this.nextMeetingTime = null;
    this.nextMeetingPlace = null;
    this.nextMeetingExtra = null;
    this.nextMeetingMsg = null;
    this._nextMeetingMsgTimer = null;
    this._nextMeetingOverride = null;
    this._nextMeetingCache = null;

    this.selMeeting = null;
    this.btnPrint = null;
    this.btnClose = null;

    this.meetings = [];
    this.selectedMeetingId = null;

    this.loading = false;
    this.printing = false;

    this._escHandler = null;

    // mode: "closed" (Modal) | "vorabzug" (direkt)
    this.mode = "closed";
  }

  render() {
    const overlay = createPopupOverlay();
    overlay.classList.add("bbm-print-overlay");
    overlay.setAttribute("data-bbm-print-overlay", "main");
    registerPopupCloseHandlers(overlay, () => this.close());

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) this.close();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this.close();
    });

    const modal = document.createElement("div");
    stylePopupCard(modal, { width: "920px" });
    modal.style.maxWidth = "calc(100vw - 28px)";
    modal.style.maxHeight = "calc(100vh - 28px)";
    modal.style.padding = "0";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.gap = "10px";
    head.style.alignItems = "center";
    head.style.padding = "12px 14px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.textContent = "Druck (geschlossene Besprechung)";
    title.style.fontWeight = "800";
    title.style.fontSize = "16px";

    const msg = document.createElement("div");
    msg.style.marginLeft = "auto";
    msg.style.fontSize = "12px";
    msg.style.opacity = "0.85";

    head.append(title, msg);

    const box = document.createElement("div");
    box.style.border = "1px solid #ddd";
    box.style.borderRadius = "10px";
    box.style.background = "#fafafa";
    box.style.padding = "12px";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.flexWrap = "wrap";
    row.style.alignItems = "center";

    const sel = document.createElement("select");
    sel.style.minWidth = "520px";
    sel.style.maxWidth = "100%";
    sel.onchange = () => {
      this.selectedMeetingId = sel.value || null;
      this._applyState();
    };

    const btnPrint = document.createElement("button");
    btnPrint.textContent = "PDF erzeugen";
    applyPopupButtonStyle(btnPrint, { variant: "primary" });
    btnPrint.onclick = async () => {
      await this._printSelected();
    };

    const btnClose = document.createElement("button");
    btnClose.textContent = "Schlie?en";
    applyPopupButtonStyle(btnClose);
    btnClose.onclick = () => this.close();

    row.append(sel, btnPrint);

    const hint = document.createElement("div");
    hint.style.marginTop = "8px";
    hint.style.fontSize = "12px";
    hint.style.opacity = "0.8";
    hint.textContent = "Hinweis: Es werden nur geschlossene Besprechungen angezeigt.";

    box.append(row, hint);

    const nextMeetBox = document.createElement("div");
    nextMeetBox.style.border = "1px solid #ddd";
    nextMeetBox.style.borderRadius = "10px";
    nextMeetBox.style.background = "#fafafa";
    nextMeetBox.style.padding = "12px";
    nextMeetBox.style.marginTop = "12px";

    const nextMeetTitle = document.createElement("div");
    nextMeetTitle.textContent = "Nächste Besprechung";
    nextMeetTitle.style.fontWeight = "700";
    nextMeetTitle.style.marginBottom = "8px";

    const mkRow = (labelText, inputEl) => {
      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexWrap = "wrap";
      wrap.style.alignItems = "center";
      wrap.style.gap = "8px";
      wrap.style.marginBottom = "8px";

      const lab = document.createElement("div");
      lab.textContent = labelText;
      lab.style.minWidth = "160px";
      lab.style.fontSize = "12px";
      lab.style.opacity = "0.85";

      inputEl.style.flex = "1 1 auto";
      inputEl.style.minWidth = "220px";

      wrap.append(lab, inputEl);
      return wrap;
    };

    const chkShow = document.createElement("input");
    chkShow.type = "checkbox";
    const chkWrap = document.createElement("label");
    chkWrap.style.display = "inline-flex";
    chkWrap.style.alignItems = "center";
    chkWrap.style.gap = "8px";
    chkWrap.style.cursor = "pointer";
    const chkText = document.createElement("span");
    chkText.textContent = "Auf letzter Seite anzeigen";
    chkWrap.append(chkShow, chkText);

    const inpDate = document.createElement("input");
    inpDate.type = "date";

    const inpTime = document.createElement("input");
    inpTime.type = "time";

    const inpPlace = document.createElement("input");
    inpPlace.type = "text";
    inpPlace.placeholder = "Meetingort";

    const inpExtra = document.createElement("input");
    inpExtra.type = "text";
    inpExtra.placeholder = "Zusatz (optional)";

    const nextMeetMsg = document.createElement("div");
    nextMeetMsg.style.fontSize = "12px";
    nextMeetMsg.style.opacity = "0.8";

    nextMeetBox.append(
      nextMeetTitle,
      chkWrap,
      mkRow("Datum", inpDate),
      mkRow("Uhrzeit", inpTime),
      mkRow("Meetingort", inpPlace),
      mkRow("Zusatz", inpExtra),
      nextMeetMsg
    );

    const content = document.createElement("div");
    content.style.flex = "1 1 auto";
    content.style.minHeight = "0";
    content.style.overflow = "auto";
    content.style.padding = "14px";
    content.append(box, nextMeetBox);

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.padding = "10px 14px";
    footer.style.borderTop = "1px solid #e2e8f0";
    footer.append(btnClose);

    modal.append(head, content, footer);
    overlay.appendChild(modal);

    this.root = overlay;
    this.modal = modal;

    this.msgEl = msg;
    this.titleEl = title;
    this.hintEl = hint;

    this.selMeeting = sel;
    this.btnPrint = btnPrint;
    this.btnClose = btnClose;

    this.nextMeetingEnabled = chkShow;
    this.nextMeetingDate = inpDate;
    this.nextMeetingTime = inpTime;
    this.nextMeetingPlace = inpPlace;
    this.nextMeetingExtra = inpExtra;
    this.nextMeetingMsg = nextMeetMsg;

    const saveNextMeeting = () => this._saveNextMeetingSettings();
    chkShow.addEventListener("change", saveNextMeeting);
    inpDate.addEventListener("change", saveNextMeeting);
    inpTime.addEventListener("change", saveNextMeeting);
    inpPlace.addEventListener("change", saveNextMeeting);
    inpPlace.addEventListener("blur", saveNextMeeting);
    inpExtra.addEventListener("change", saveNextMeeting);
    inpExtra.addEventListener("blur", saveNextMeeting);

    return overlay;
  }

  _renderPreview() {
    const overlay = createPopupOverlay({ zIndex: 10000 });
    overlay.classList.add("bbm-print-overlay");
    overlay.setAttribute("data-bbm-print-overlay", "preview");
    registerPopupCloseHandlers(overlay, () => this._closePreview());

    const modal = document.createElement("div");
    stylePopupCard(modal, { width: "1100px" });
    modal.style.maxWidth = "calc(100vw - 28px)";
    modal.style.maxHeight = "calc(100vh - 28px)";
    modal.style.height = "80vh";
    modal.style.padding = "0";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";
    head.style.padding = "10px 12px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.textContent = "PDF Vorschau";
    title.style.fontWeight = "800";
    title.style.fontSize = "16px";

    const btnClose = document.createElement("button");
    btnClose.textContent = "Schliessen";
    applyPopupButtonStyle(btnClose);
    btnClose.style.marginLeft = "auto";
    btnClose.onclick = () => this._closePreview();

    head.append(title, btnClose);

    const frame = document.createElement("iframe");
    frame.style.width = "100%";
    frame.style.flex = "1 1 auto";
    frame.style.height = "100%";
    frame.style.minHeight = "0";
    frame.style.border = "0";
    frame.style.borderRadius = "0";
    frame.style.background = "#fafafa";

    const content = document.createElement("div");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.flex = "1 1 auto";
    content.style.minHeight = "0";
    content.style.overflow = "hidden";
    content.style.padding = "12px";
    content.append(frame);

    modal.append(head, content);
    overlay.appendChild(modal);

    this.previewRoot = overlay;
    this.previewFrame = frame;
    this.previewTitleEl = title;
    this.previewCloseBtn = btnClose;

    return overlay;
  }

  _setMsg(text) {
    if (!this.msgEl) return;
    this.msgEl.textContent = text || "";
  }

  _setPreviewLoading(isLoading) {
    this.previewLoading = !!isLoading;
    if (this.previewCloseBtn) {
      this.previewCloseBtn.disabled = this.previewLoading;
      this.previewCloseBtn.style.opacity = this.previewLoading ? "0.65" : "1";
    }
  }

  _setUiMode(mode) {
    this.mode = mode || "closed";

    if (this.titleEl) {
      this.titleEl.textContent =
        this.mode === "vorabzug"
          ? "PDF-Vorabzug (offene Besprechung)"
          : "Druck (geschlossene Besprechung)";
    }

    if (this.hintEl) {
      this.hintEl.textContent =
        this.mode === "vorabzug"
          ? "Hinweis: Vorabzug ist für offene Besprechungen gedacht."
          : "Hinweis: Es werden nur geschlossene Besprechungen angezeigt.";
    }
  }

  _applyState() {
    const busy = this.loading || this.printing;

    // Im closed-Modal darf man wählen. Vorabzug wird ohne Modal gedruckt.
    const isClosedMode = this.mode !== "vorabzug";

    if (this.selMeeting) {
      this.selMeeting.disabled = busy || !isClosedMode;
      this.selMeeting.style.opacity = busy || !isClosedMode ? "0.65" : "1";
    }

    if (this.btnPrint) {
      const can =
        isClosedMode &&
        !busy &&
        !!this.selectedMeetingId &&
        this.meetings.some((m) => m.id === this.selectedMeetingId);
      this.btnPrint.disabled = !can;
      this.btnPrint.style.opacity = can ? "1" : "0.55";
    }

    if (this.btnClose) {
      this.btnClose.disabled = busy;
      this.btnClose.style.opacity = busy ? "0.65" : "1";
    }
  }

  _setNextMeetingMsg(text) {
    if (!this.nextMeetingMsg) return;
    this.nextMeetingMsg.textContent = text || "";
    if (this._nextMeetingMsgTimer) clearTimeout(this._nextMeetingMsgTimer);
    if (text) {
      this._nextMeetingMsgTimer = setTimeout(() => {
        if (this.nextMeetingMsg) this.nextMeetingMsg.textContent = "";
      }, 900);
    }
  }

  async _loadNextMeetingSettings() {
    if (!this.nextMeetingEnabled) return;
    const api = window.bbmDb || {};
    const defaults = {
      enabled: true,
      date: "",
      time: "",
      place: "",
      extra: "",
    };

    if (typeof api.appSettingsGetMany !== "function") {
      this.nextMeetingEnabled.checked = defaults.enabled;
      this.nextMeetingDate.value = defaults.date;
      this.nextMeetingTime.value = defaults.time;
      this.nextMeetingPlace.value = defaults.place;
      this.nextMeetingExtra.value = defaults.extra;
      this._setNextMeetingMsg("Settings-API fehlt (IPC noch nicht aktiv).");
      return;
    }

    const res = await api.appSettingsGetMany([
      "print.nextMeeting.enabled",
      "print.nextMeeting.date",
      "print.nextMeeting.time",
      "print.nextMeeting.place",
      "print.nextMeeting.extra",
    ]);
    if (!res?.ok) {
      this.nextMeetingEnabled.checked = defaults.enabled;
      this.nextMeetingDate.value = defaults.date;
      this.nextMeetingTime.value = defaults.time;
      this.nextMeetingPlace.value = defaults.place;
      this.nextMeetingExtra.value = defaults.extra;
      this._setNextMeetingMsg(res?.error || "Fehler beim Laden der Einstellungen");
      return;
    }

    const data = res.data || {};
    this.nextMeetingEnabled.checked = this._parseBool(data["print.nextMeeting.enabled"], false);
    this.nextMeetingDate.value = String(data["print.nextMeeting.date"] || "").trim();
    this.nextMeetingTime.value = String(data["print.nextMeeting.time"] || "").trim();
    this.nextMeetingPlace.value = String(data["print.nextMeeting.place"] || "").trim();
    this.nextMeetingExtra.value = String(data["print.nextMeeting.extra"] || "").trim();
    this._setNextMeetingMsg("");
  }

  async _saveNextMeetingSettings() {
    if (!this.nextMeetingEnabled) return;
    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") {
      this._setNextMeetingMsg("Settings-API fehlt (IPC noch nicht aktiv).");
      return;
    }

    const enabled = this.nextMeetingEnabled.checked ? "true" : "false";
    const date = String(this.nextMeetingDate.value || "").trim();
    const time = String(this.nextMeetingTime.value || "").trim();
    const place = String(this.nextMeetingPlace.value || "").trim();
    const extra = String(this.nextMeetingExtra.value || "").trim();

    const res = await api.appSettingsSetMany({
      "print.nextMeeting.enabled": enabled,
      "print.nextMeeting.date": date,
      "print.nextMeeting.time": time,
      "print.nextMeeting.place": place,
      "print.nextMeeting.extra": extra,
    });
    if (!res?.ok) {
      this._setNextMeetingMsg(res?.error || "Speichern fehlgeschlagen");
      return;
    }
    this._setNextMeetingMsg("Gespeichert");
  }

  async promptNextMeetingSettings({ defaultDateIso } = {}) {
    const api = window.bbmDb || {};
    const defaults = {
      enabled: true,
      date: "",
      time: "",
      place: "",
      extra: "",
    };

    const hasSettingsApi =
      typeof api.appSettingsGetMany === "function" && typeof api.appSettingsSetMany === "function";

    let loaded = { ...defaults };
    let hasSavedEnabled = false;
    if (typeof api.appSettingsGetMany === "function") {
      const res = await api.appSettingsGetMany([
        "print.nextMeeting.enabled",
        "print.nextMeeting.date",
        "print.nextMeeting.time",
        "print.nextMeeting.place",
        "print.nextMeeting.extra",
      ]);
      if (res?.ok) {
        const data = res.data || {};
        const enabledRaw = data["print.nextMeeting.enabled"];
        hasSavedEnabled = enabledRaw != null && String(enabledRaw).trim() !== "";
        loaded = {
          enabled: hasSavedEnabled ? this._parseBool(enabledRaw, false) : defaults.enabled,
          date: String(data["print.nextMeeting.date"] || "").trim(),
          time: String(data["print.nextMeeting.time"] || "").trim(),
          place: String(data["print.nextMeeting.place"] || "").trim(),
          extra: String(data["print.nextMeeting.extra"] || "").trim(),
        };
      }
    }
    if (this._nextMeetingCache) {
      loaded = {
        enabled: this._parseBool(this._nextMeetingCache["print.nextMeeting.enabled"], loaded.enabled),
        date: String(this._nextMeetingCache["print.nextMeeting.date"] || loaded.date || "").trim(),
        time: String(this._nextMeetingCache["print.nextMeeting.time"] || loaded.time || "").trim(),
        place: String(this._nextMeetingCache["print.nextMeeting.place"] || loaded.place || "").trim(),
        extra: String(this._nextMeetingCache["print.nextMeeting.extra"] || loaded.extra || "").trim(),
      };
    }

    const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
    const loadedDate = isIsoDate(loaded.date) ? loaded.date : "";
    const defaultDate = loadedDate || (isIsoDate(defaultDateIso) ? defaultDateIso : "");

    return new Promise((resolve) => {
      const overlay = createPopupOverlay({ background: "rgba(0,0,0,0.35)", zIndex: 10001 });
      overlay.classList.add("bbm-print-overlay");
      overlay.setAttribute("data-bbm-print-overlay", "prompt");
      overlay.style.display = "flex";

      const modal = document.createElement("div");
      stylePopupCard(modal, { width: "720px" });
      modal.style.maxWidth = "calc(100vw - 28px)";
      modal.style.maxHeight = "calc(100vh - 28px)";
      modal.style.padding = "0";

      const head = document.createElement("div");
      head.style.display = "flex";
      head.style.alignItems = "center";
      head.style.gap = "10px";
      head.style.padding = "12px 14px";
      head.style.borderBottom = "1px solid #e2e8f0";

      const title = document.createElement("div");
      title.textContent = "Nächste Besprechung";
      title.style.fontWeight = "800";
      title.style.fontSize = "16px";
      head.append(title);

      const hint = document.createElement("div");
      hint.style.fontSize = "12px";
      hint.style.opacity = "0.75";
      hint.textContent = hasSettingsApi
        ? "Wird auf der letzten Seite des Protokolls gedruckt."
        : "Settings-API fehlt (IPC noch nicht aktiv). Druck läuft trotzdem.";

      const mkRow = (labelText, inputEl) => {
        const wrap = document.createElement("div");
        wrap.style.display = "flex";
        wrap.style.flexWrap = "wrap";
        wrap.style.alignItems = "center";
        wrap.style.gap = "8px";
        wrap.style.marginTop = "8px";

        const lab = document.createElement("div");
        lab.textContent = labelText;
        lab.style.minWidth = "160px";
        lab.style.fontSize = "12px";
        lab.style.opacity = "0.85";

        inputEl.style.flex = "1 1 auto";
        inputEl.style.minWidth = "220px";

        wrap.append(lab, inputEl);
        return wrap;
      };

      const chkShow = document.createElement("input");
      chkShow.type = "checkbox";
      chkShow.checked = !!loaded.enabled;
      const chkWrap = document.createElement("label");
      chkWrap.style.display = "inline-flex";
      chkWrap.style.alignItems = "center";
      chkWrap.style.gap = "8px";
      chkWrap.style.cursor = "pointer";
      const chkText = document.createElement("span");
      chkText.textContent = "Drucken";
      chkWrap.append(chkShow, chkText);

      const inpDate = document.createElement("input");
      inpDate.type = "date";
      inpDate.value = defaultDate;

      const inpTime = document.createElement("input");
      inpTime.type = "time";
      inpTime.value = loaded.time;

      const inpPlace = document.createElement("input");
      inpPlace.type = "text";
      inpPlace.placeholder = "Meetingort";
      inpPlace.value = loaded.place;

      const inpExtra = document.createElement("input");
      inpExtra.type = "text";
      inpExtra.placeholder = "Zusatz (optional)";
      inpExtra.value = loaded.extra;

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.justifyContent = "flex-end";
      actions.style.gap = "8px";
      actions.style.padding = "10px 14px";
      actions.style.borderTop = "1px solid #e2e8f0";

      const btnCancel = document.createElement("button");
      btnCancel.type = "button";
      btnCancel.textContent = "Abbrechen";
      applyPopupButtonStyle(btnCancel);

      const btnOk = document.createElement("button");
      btnOk.type = "button";
      btnOk.textContent = "Übernehmen";
      applyPopupButtonStyle(btnOk, { variant: "primary" });

      actions.append(btnCancel, btnOk);

      const body = document.createElement("div");
      body.style.flex = "1 1 auto";
      body.style.minHeight = "0";
      body.style.overflow = "auto";
      body.style.padding = "14px";
      body.append(
        chkWrap,
        mkRow("Datum", inpDate),
        mkRow("Uhrzeit", inpTime),
        mkRow("Meetingort", inpPlace),
        mkRow("Zusatz", inpExtra),
        hint
      );

      modal.append(head, body, actions);
      overlay.appendChild(modal);

      const cleanup = () => {
        overlay.removeEventListener("mousedown", onOverlayClick);
        overlay.removeEventListener("keydown", onOverlayKeyDown);
        btnCancel.removeEventListener("click", onCancel);
        btnOk.removeEventListener("click", onOk);
        try {
          document.body.removeChild(overlay);
        } catch {
          // ignore
        }
      };

      const onOverlayClick = (e) => {
        if (e.target !== overlay) return;
        cleanup();
        resolve({ ok: false, cancelled: true });
      };

      const onCancel = () => {
        cleanup();
        resolve({ ok: false, cancelled: true });
      };

      const onOverlayKeyDown = (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        onCancel();
      };

      const onOk = async () => {
        const payload = {
          "print.nextMeeting.enabled": chkShow.checked ? "true" : "false",
          "print.nextMeeting.date": String(inpDate.value || "").trim(),
          "print.nextMeeting.time": String(inpTime.value || "").trim(),
          "print.nextMeeting.place": String(inpPlace.value || "").trim(),
          "print.nextMeeting.extra": String(inpExtra.value || "").trim(),
        };

        cleanup();
        this._nextMeetingOverride = payload;
        this._nextMeetingCache = payload;
        resolve({ ok: true, data: payload });

        if (typeof api.appSettingsSetMany !== "function") {
          alert("Settings-API fehlt (IPC noch nicht aktiv).");
          return;
        }
        const res = await api.appSettingsSetMany(payload);
        if (!res?.ok) {
          alert(res?.error || "Speichern fehlgeschlagen");
          return;
        }
        this._nextMeetingCache = payload;
      };

      overlay.addEventListener("mousedown", onOverlayClick);
      overlay.addEventListener("keydown", onOverlayKeyDown);
      btnCancel.addEventListener("click", onCancel);
      btnOk.addEventListener("click", onOk);

      document.body.appendChild(overlay);
      try {
        overlay.focus();
      } catch (_e) {
        // ignore
      }
    });
  }

  _ensureDom() {
    if (!this.root) {
      const el = this.render();
      document.body.appendChild(el);
      return;
    }
    if (!this.root.isConnected) {
      document.body.appendChild(this.root);
    }
  }

  _ensurePreviewDom() {
    if (!this.previewRoot) {
      const el = this._renderPreview();
      document.body.appendChild(el);
      return;
    }
    if (!this.previewRoot.isConnected) {
      document.body.appendChild(this.previewRoot);
    }
  }

  _toFileUrl(filePath) {
    const raw = String(filePath || "").trim();
    if (!raw) return "";
    if (/^file:\/\//i.test(raw)) return raw;
    const url = `file:///${raw.replace(/\\/g, "/")}`;
    return encodeURI(url).replace(/#/g, "%23");
  }

  _openPreview({ filePath, title } = {}) {
    this._ensurePreviewDom();
    if (this.previewTitleEl) this.previewTitleEl.textContent = title || "PDF Vorschau";
    if (this.previewFrame) this.previewFrame.src = this._toFileUrl(filePath);
    if (this.previewRoot) {
      this.previewRoot.style.display = "flex";
      try {
        this.previewRoot.focus();
      } catch (_e) {
        // ignore
      }
    }
  }

  _closePreview() {
    if (this.previewRoot) this.previewRoot.style.display = "none";
    if (this.previewFrame) this.previewFrame.src = "about:blank";
  }

  _destroyPreviewDom() {
    try {
      if (this.previewRoot && this.previewRoot.parentElement) {
        this.previewRoot.parentElement.removeChild(this.previewRoot);
      }
    } catch (_e) {
      // ignore
    }
    this.previewRoot = null;
    this.previewFrame = null;
    this.previewTitleEl = null;
    this.previewCloseBtn = null;
  }

  _destroyMainDom() {
    try {
      if (this.root && this.root.parentElement) {
        this.root.parentElement.removeChild(this.root);
      }
    } catch (_e) {
      // ignore
    }

    this.root = null;
    this.modal = null;

    this.msgEl = null;
    this.titleEl = null;
    this.hintEl = null;

    this.nextMeetingEnabled = null;
    this.nextMeetingDate = null;
    this.nextMeetingTime = null;
    this.nextMeetingPlace = null;
    this.nextMeetingExtra = null;
    this.nextMeetingMsg = null;

    this.selMeeting = null;
    this.btnPrint = null;
    this.btnClose = null;
  }

  // ============================================================
  // Public API
  // ============================================================

  // Standard: Druck-Modal für geschlossene Besprechungen
  async openPrint({ projectId } = {}) {
    this._ensureDom();
    this._setUiMode("closed");

    this.projectId = projectId || this.router?.currentProjectId || null;
    if (!this.projectId) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }

    // Router-Context (hilft UI, PDF holt Projektnummer trotzdem selbst)
    try {
      if (this.router) this.router.currentProjectId = this.projectId;
    } catch (_e) {}

    this.root.style.display = "flex";
    try {
      this.root.focus();
    } catch (_e) {
      // ignore
    }

    this._escHandler = (e) => {
      if (e.key === "Escape") this.close();
    };
    window.addEventListener("keydown", this._escHandler);

    await this._loadClosedMeetings();
    await this._loadNextMeetingSettings();
    this._applyState();
  }

  // Vorabzug: direkt drucken (ohne Auswahl-Modal)
  async printVorabzug({ projectId, meetingId } = {}) {
    const pid = projectId || this.router?.currentProjectId || null;
    const mid = meetingId || this.router?.currentMeetingId || null;

    if (!pid) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }
    if (!mid) {
      alert("Bitte zuerst eine Besprechung ?ffnen.");
      return;
    }

    try {
      if (this.router) {
        this.router.currentProjectId = pid;
        this.router.currentMeetingId = mid;
      }
    } catch (_e) {}

    this.projectId = pid;
    this._setUiMode("vorabzug");

    await this._printMeeting({
      projectId: pid,
      meetingId: mid,
      allowOpen: true,
      mode: "vorabzug",
      closeModalAfter: false,
      preview: true,
    });
  }

  // Direkt-Vorschau für ein bestimmtes Protokoll (ohne Auswahl-Modal)
  async printMeetingPreview({ projectId, meetingId, mode } = {}) {
    const pid = projectId || this.router?.currentProjectId || null;
    const mid = meetingId || this.router?.currentMeetingId || null;
    const m = mode === "vorabzug" ? "vorabzug" : "closed";

    if (!pid) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }
    if (!mid) {
      alert("Bitte zuerst eine Besprechung auswählen.");
      return;
    }

    try {
      if (this.router) {
        this.router.currentProjectId = pid;
        this.router.currentMeetingId = mid;
      }
    } catch (_e) {}

    this.projectId = pid;

    await this._printMeeting({
      projectId: pid,
      meetingId: mid,
      allowOpen: m === "vorabzug",
      mode: m,
      closeModalAfter: false,
      preview: true,
    });
  }

  // Firmenliste: Vorschau mit PDF (keine Save-UX)
  async openFirmsPrintPreview({ projectId } = {}) {
    await this._printFirmsPdf({ projectId, preview: true });
  }

  // ToDo-Liste: Vorschau mit PDF (gleiches Preview-Modal)
  async openTodoPrintPreview({ projectId, meetingId } = {}) {
    await this._printTodoPdf({ projectId, meetingId, preview: true });
  }

  // Top-Liste(alle): Vorschau mit PDF (gleiches Preview-Modal)
  async openTopListAllPreview({ projectId, meetingId } = {}) {
    await this._printTopListAllPdf({ projectId, meetingId, preview: true });
  }

  async _printFirmsPdf({ projectId, preview = true } = {}) {
    const pid = projectId || this.router?.currentProjectId || null;
    if (!pid) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }

    const api = window.bbmDb || {};
    if (typeof api.projectFirmsListByProject !== "function") {
      alert("projectFirmsListByProject ist nicht verfuegbar (Preload/IPC fehlt).");
      return;
    }
    if (typeof api.projectFirmsListFirmCandidatesByProject !== "function") {
      alert("projectFirmsListFirmCandidatesByProject ist nicht verfuegbar (Preload/IPC fehlt).");
      return;
    }
    if (typeof api.firmsListGlobal !== "function") {
      alert("firmsListGlobal ist nicht verfuegbar (Preload/IPC fehlt).");
      return;
    }
    if (typeof api.projectCandidatesList !== "function") {
      alert("projectCandidatesList ist nicht verfuegbar (Preload/IPC fehlt).");
      return;
    }
    if (typeof api.projectPersonsListByProjectFirm !== "function") {
      alert("projectPersonsListByProjectFirm ist nicht verfuegbar (Preload/IPC fehlt).");
      return;
    }
    if (typeof api.personsListByFirm !== "function") {
      alert("personsListByFirm ist nicht verfuegbar (Preload/IPC fehlt).");
      return;
    }
    if (typeof api.printHtmlToPdf !== "function") {
      alert("printHtmlToPdf ist nicht verfuegbar (Preload/IPC fehlt).");
      return;
    }

    if (preview) {
      this._ensurePreviewDom();
      this._setPreviewLoading(true);
    }

    try {
      if (this.router?.ensureAppSettingsLoaded) {
        await this.router.ensureAppSettingsLoaded({ force: false });
      }

      let settings = this.router?.context?.settings || {};
      const protocolsDir = String(settings?.["pdf.protocolsDir"] || "").trim();
      if (typeof api.appSettingsGetMany === "function") {
        const resNext = await api.appSettingsGetMany([
          "print.nextMeeting.enabled",
          "print.nextMeeting.date",
          "print.nextMeeting.time",
          "print.nextMeeting.place",
          "print.nextMeeting.extra",
        ]);
        if (resNext?.ok) {
          settings = { ...settings, ...(resNext.data || {}) };
        }
      }
      if (this._nextMeetingOverride) {
        settings = { ...settings, ...this._nextMeetingOverride };
        this._nextMeetingOverride = null;
      }
      let roleMeta = this._getRoleMetaFromSettings(settings);
      if (typeof api.appSettingsGetMany === "function") {
        const resRole = await api.appSettingsGetMany(["firm_role_order", "firm_role_labels"]);
        if (resRole?.ok) {
          const data = resRole.data || {};
          roleMeta = this._getRoleMetaFromSettings({
            firm_role_order: data.firm_role_order,
            firm_role_labels: data.firm_role_labels,
          });
        }
      }

      const resLocal = await api.projectFirmsListByProject(pid);
      if (!resLocal?.ok) {
        alert(resLocal?.error || "Fehler beim Laden der Projektfirmen");
        return;
      }
      const localFirms = resLocal.list || [];

      const resAssigned = await api.projectFirmsListFirmCandidatesByProject(pid);
      if (!resAssigned?.ok) {
        alert(resAssigned?.error || "Fehler beim Laden der zugeordneten Firmen");
        return;
      }
      const assignedIds = new Set(
        (resAssigned.list || [])
          .filter((x) => x && x.kind === "global_firm" && x.id)
          .map((x) => x.id)
      );

      const resGlobal = await api.firmsListGlobal();
      if (!resGlobal?.ok) {
        alert(resGlobal?.error || "Fehler beim Laden der Global-Firmen");
        return;
      }
      const globalFirms = (resGlobal.list || []).filter((f) => assignedIds.has(f.id));

      const resCandidates = await api.projectCandidatesList({ projectId: pid });
      if (!resCandidates?.ok) {
        alert(resCandidates?.error || "Fehler beim Laden der Teilnehmer");
        return;
      }

      const pickArray = (res) => res?.items || res?.list || res?.data || res?.candidates || [];
      const candidatesRaw = pickArray(resCandidates);
      const candidateSet = new Set(
        (candidatesRaw || [])
          .map((c) => {
            const kind = String(c?.kind || "").trim();
            const personId = c?.personId ?? c?.person_id ?? null;
            if (!kind || !personId) return "";
            return `${kind}::${String(personId)}`;
          })
          .filter((k) => !!k)
      );

      const localPeopleByFirm = new Map();
      const globalPeopleByFirm = new Map();

      const normPersonLocal = (p) => ({
        name: String(p?.name || `${p?.first_name || ""} ${p?.last_name || ""}` || "").trim(),
        rolle: String(p?.rolle || "").trim(),
        funk: String(p?.funktion || "").trim(),
        email: String(p?.email || "").trim(),
      });
      const normPersonGlobal = (p) => ({
        name: String(p?.name || `${p?.first_name || ""} ${p?.last_name || ""}` || "").trim(),
        rolle: String(p?.rolle || "").trim(),
        funk: String(p?.phone || "").trim(),
        email: String(p?.email || "").trim(),
      });

      await Promise.all(
        (localFirms || []).map(async (f) => {
          try {
            const res = await api.projectPersonsListByProjectFirm(f.id);
            if (!res?.ok) {
              localPeopleByFirm.set(f.id, []);
              return;
            }
            const list = (res.list || [])
              .filter((p) => candidateSet.has(`project_person::${String(p?.id ?? "")}`))
              .map((p) => normPersonLocal(p));
            localPeopleByFirm.set(f.id, list);
          } catch {
            localPeopleByFirm.set(f.id, []);
          }
        })
      );

      await Promise.all(
        (globalFirms || []).map(async (f) => {
          try {
            const res = await api.personsListByFirm(f.id);
            if (!res?.ok) {
              globalPeopleByFirm.set(f.id, []);
              return;
            }
            const list = (res.list || [])
              .filter((p) => candidateSet.has(`global_person::${String(p?.id ?? "")}`))
              .map((p) => normPersonGlobal(p));
            globalPeopleByFirm.set(f.id, list);
          } catch {
            globalPeopleByFirm.set(f.id, []);
          }
        })
      );

      const projectLabel = await this._getProjectLabelWithNumber(pid);
      const html = this._buildFirmsPrintHtml({
        projectLabel,
        localFirms,
        globalFirms,
        localPeopleByFirm,
        globalPeopleByFirm,
        roleLabels: roleMeta.roleLabels,
        roleOrder: roleMeta.roleOrder,
        settings,
      });

      const fn = this._sanitizeFileName(`BBM ${projectLabel || ""} Firmenliste`) + ".pdf";
      const out = await api.printHtmlToPdf({
        html,
        fileName: fn,
        bbmVersion: "1.0",
        ...(preview ? { targetDir: "temp" } : {}),
      });
      if (!out?.ok) {
        alert(out?.error || "PDF-Erzeugung fehlgeschlagen");
        return;
      }

      if (preview) {
        this._openPreview({ filePath: out.filePath, title: "Firmenliste (Vorschau)" });
      } else {
        alert(`PDF gespeichert:\n${out.filePath || "(Pfad unbekannt)"}`);
      }
    } catch (err) {
      console.error("[PrintModal] Firmenliste Vorschau fehlgeschlagen", err);
      alert("Vorschau konnte nicht erzeugt werden.");
    } finally {
      if (preview) this._setPreviewLoading(false);
    }
  }

  _isDoneStatus(status) {
    return String(status || "").trim().toLowerCase() === "erledigt";
  }

  _parseDueTs(value) {
    const s = String(value || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
    const d = new Date(`${s}T00:00:00`);
    const ts = d.getTime();
    return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
  }

  _positionParts(pos) {
    const s = String(pos || "").trim();
    if (!s) return [Number.POSITIVE_INFINITY];
    return s.split(".").map((x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    });
  }

  _cmpPosition(a, b) {
    const pa = this._positionParts(a);
    const pb = this._positionParts(b);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
      const av = pa[i] ?? -1;
      const bv = pb[i] ?? -1;
      if (av !== bv) return av - bv;
    }
    return 0;
  }

  _buildTodoRowsLive({ tops, meeting }) {
    const allTops = Array.isArray(tops) ? tops : [];
    const ampelCompute = createAmpelComputer(allTops, new Date());

    const rows = allTops
      .filter((t) => !this._isDoneStatus(t?.status))
      .map((t) => {
        const position = t.displayNumber ?? t.display_number ?? t.number ?? "";
        const dueRaw = String(t?.due_date || t?.dueDate || "").slice(0, 10);
        const responsible = String(t?.responsible_label || t?.responsibleLabel || "").trim();
        const groupLabel = responsible || "Ohne Verantwortlich";
        const groupSort = responsible ? responsible.toLocaleLowerCase("de-DE") : "\uffff";
        const color = t?.ampelColor || t?.ampel_color || ampelCompute(t) || null;
        return {
          top_id: t?.id || null,
          position: String(position || ""),
          short_text: String(t?.title || "(ohne Bezeichnung)").trim(),
          status: String(t?.status || "").trim(),
          due_date: /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null,
          responsible_label: responsible,
          group_label: groupLabel,
          ampel_color: color,
          ampel_hex: ampelHexFrom(color),
          _group_sort: groupSort,
        };
      });

    rows.sort((a, b) => {
      if (a._group_sort !== b._group_sort) {
        return a._group_sort < b._group_sort ? -1 : 1;
      }
      const ad = this._parseDueTs(a.due_date);
      const bd = this._parseDueTs(b.due_date);
      if (ad !== bd) return ad - bd;
      return this._cmpPosition(a.position, b.position);
    });

    return rows.map((r) => {
      const out = { ...r };
      delete out._group_sort;
      return out;
    });
  }

  _buildTodoPrintHtml({ projectLabel, meeting, rows, settings, logoHeightMm } = {}) {
    const protocolTitleRaw = String(settings?.["pdf.protocolTitle"] || "").trim();
    const protocolTitle = protocolTitleRaw || "Baubesprechung";
    const headerTemplate = this._buildPdfHeaderTemplate({
      projectLabel,
      meeting,
      settings,
      protocolTitle,
      logoHeightMm,
      maxLogoTopMm: 5,
    });
    const projectLine = headerTemplate.projectLine;
    const meetingLine = `ToDo´s für ${headerTemplate.meetingLine}`;
    const pdfLogoHtml = headerTemplate.pdfLogoHtml;
    const pdfLogoTopMm = headerTemplate.pdfLogoTopMm;
    const pdfLogoHeightMm = headerTemplate.effectiveLogoHeightMm;
    const todoLogoHeightMm = Math.min(Math.max(0, Number(pdfLogoHeightMm || 0)), 18);
    const headerHeightMm = pdfLogoTopMm + todoLogoHeightMm + 5;
    const todoHeaderTopMm = 5;
    const todoHeaderTextReserveMm = 28;
    const todoPageTopMarginMm = todoHeaderTopMm + headerHeightMm + todoHeaderTextReserveMm;

    const grouped = new Map();
    for (const r of rows || []) {
      const key = String(r?.group_label || "Ohne Verantwortlich");
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(r);
    }

    const groupKeys = Array.from(grouped.keys());
    groupKeys.sort((a, b) => {
      const aa = a === "Ohne Verantwortlich" ? "\uffff" : a.toLocaleLowerCase("de-DE");
      const bb = b === "Ohne Verantwortlich" ? "\uffff" : b.toLocaleLowerCase("de-DE");
      if (aa < bb) return -1;
      if (aa > bb) return 1;
      return 0;
    });

    const bodyHtml = groupKeys.length === 0
      ? `<div class="empty">Keine offenen TOPs vorhanden.</div>`
      : groupKeys.map((grp) => {
          const list = grouped.get(grp) || [];
          const rowsHtml = list.map((r) => {
            const due = r?.due_date ? this._fmtDateYYYYMMDD(r.due_date) : "-";
            const dotColor = r?.ampel_hex || ampelHexFrom(r?.ampel_color) || null;
            const dotHtml = dotColor
              ? `<span class="dot fill" style="background:${dotColor};"></span>`
              : `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                   <circle cx="5" cy="5" r="4" fill="none" stroke="#bdbdbd" stroke-width="2"></circle>
                 </svg>`;
            return `
              <tr>
                <td class="colPos">${this._escapeHtml(r?.position || "")}</td>
                <td class="colTop">${this._escapeHtml(r?.short_text || "")}</td>
                <td class="colStatus">${this._escapeHtml(r?.status || "")}</td>
                <td class="colDue">${this._escapeHtml(due)}</td>
                <td class="colAmp">${dotHtml}</td>
              </tr>
            `;
          }).join("");

          return `
            <div class="catBlock">
              <div class="catTitle">${this._escapeHtml(grp)}</div>
              <table class="todoTable">
                <thead>
                  <tr>
                    <th class="colPos">TOP</th>
                    <th class="colTop">Kurztext</th>
                    <th class="colStatus">Status</th>
                    <th class="colDue">Fertig bis</th>
                    <th class="colAmp">Ampel</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          `;
        }).join("");

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>BBM ToDo</title>
  <style>
    @page { size: A4; margin: 0 10mm 8mm 19mm; }
    :root{ --sepW: 0.25pt; --sepC: #000000; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Calibri, Arial, sans-serif;
      font-size: 10.5pt;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdfLogo {
      position: fixed;
      z-index: 9999;
      max-height: var(--logoHeight);
      width: auto !important;
    }
    .pdfLogoDummy {
      background: #f0f0f0;
      border: 0.2mm solid #bbb;
      color: #666;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 8.5pt;
      padding: 1mm;
      box-sizing: border-box;
    }
    .topRuleFixed {
      position: fixed;
      left: 0;
      right: 0;
      top: calc(var(--headerTop) + var(--headerH));
      border-top: var(--sepW) solid var(--sepC);
      z-index: 4;
      pointer-events: none;
    }
    .page { position: relative; z-index: 1; }
    .todoHeaderFixed {
      position: fixed;
      left: 19mm;
      right: 10mm;
      top: var(--headerTop);
      z-index: 3;
    }
    .page1 {
      margin: 0 0 6mm 0;
      padding-top: 0;
    }
    .todoPad {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 0;
    }
    .todoPad thead { display: table-header-group; }
    .todoPad .todoHeadPad th {
      padding: 0;
      height: var(--todoHeadH);
      border: 0;
      background: transparent;
    }
    .todoPad td {
      padding: 0;
      border: 0;
      vertical-align: top;
    }
    .projLine {
      margin-top: 1.5mm;
      font-weight: 400;
      font-size: 11pt;
    }
    .projLabel {
      margin-top: 2mm;
      font-weight: 400;
      font-size: 11pt;
    }
    .meetingLine {
      margin-top: 15mm;
      font-weight: 700;
      font-size: 18pt;
      text-align: center;
    }
    .catBlock {
      margin-bottom: 6mm;
      padding-bottom: 3mm;
      border-bottom: var(--sepW) solid var(--sepC);
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .catBlock:last-child { border-bottom: none; }
    .catTitle {
      font-weight: 700;
      font-size: 10pt;
      margin: 0 0 2mm 0;
    }
    .todoTable {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: var(--sepW) solid var(--sepC);
    }
    .todoTable th,
    .todoTable td {
      text-align: left;
      padding: 1.8mm 2mm;
      border-bottom: var(--sepW) solid var(--sepC);
      font-size: 9.6pt;
      vertical-align: top;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .todoTable th {
      background: #efefef;
      font-weight: 700;
    }
    .todoTable tbody tr:last-child td { border-bottom: 0; }
    .colPos { width: 14mm; }
    .colTop { width: auto; }
    .colStatus { width: 23mm; }
    .colDue { width: 22mm; }
    .colAmp { width: 14mm; text-align: center !important; }
    .dot {
      width: 4mm;
      height: 4mm;
      border-radius: 50%;
      box-sizing: border-box;
      display: inline-block;
      vertical-align: middle;
    }
    .dot.fill { border: 0.2mm solid rgba(0,0,0,0.25); }
    .dot.empty { background: transparent; border: 0.2mm solid #aaa; }
    .empty { padding: 3mm 2mm; opacity: .7; }
    ${this._pdfCopyrightStyle()}
  </style>
</head>
<body class="closed" style="--logoTop:${pdfLogoTopMm}mm; --logoHeight:${todoLogoHeightMm}mm; --headerH:${headerHeightMm}mm; --headerTop:${todoHeaderTopMm}mm; --todoHeadH:${todoPageTopMarginMm}mm;">
  ${pdfLogoHtml}
  ${this._pdfCopyrightHtml()}
  <div class="topRuleFixed" aria-hidden="true"></div>
  <div class="todoHeaderFixed">
    <div class="page1">
      <div class="projLabel">Projekt:</div>
      <div class="projLine">${this._escapeHtml(projectLine)}</div>
      <div class="meetingLine">${meetingLine}</div>
    </div>
  </div>
  <div class="page">
    <table class="todoPad">
      <thead>
        <tr class="todoHeadPad"><th></th></tr>
      </thead>
      <tbody>
        <tr><td>${bodyHtml}</td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>
    `.trim();
  }

  async _printTodoPdf({ projectId, meetingId, preview = true } = {}) {
    const pid = projectId || this.router?.currentProjectId || null;
    const mid = meetingId || this.router?.currentMeetingId || null;

    if (!pid) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }
    if (!mid) {
      alert("Bitte zuerst eine Besprechung auswählen.");
      return;
    }

    const api = window.bbmDb || {};
    if (typeof api.topsListByProject !== "function") {
      alert("topsListByProject ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }
    if (typeof api.printHtmlToPdf !== "function") {
      alert("printHtmlToPdf ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }

    if (preview) {
      this._ensurePreviewDom();
      this._setPreviewLoading(true);
    }

    try {
      if (this.router?.ensureAppSettingsLoaded) {
        await this.router.ensureAppSettingsLoaded({ force: false });
      }

      let settings = this.router?.context?.settings || {};
      const protocolsDir = String(settings?.["pdf.protocolsDir"] || "").trim();
      if (typeof api.appSettingsGetMany === "function") {
        const resNext = await api.appSettingsGetMany([
          "print.nextMeeting.enabled",
          "print.nextMeeting.date",
          "print.nextMeeting.time",
          "print.nextMeeting.place",
          "print.nextMeeting.extra",
        ]);
        if (resNext?.ok) {
          settings = { ...settings, ...(resNext.data || {}) };
        }
      }

      const res = await api.topsListByMeeting(mid);
      if (!res?.ok) {
        alert(res?.error || "Fehler beim Laden der TOPs");
        return;
      }

      const meeting = res?.meeting || null;
      if (!meeting) {
        alert("Besprechung nicht gefunden.");
        return;
      }

      let rows = [];
      const isClosed = Number(meeting?.is_closed) === 1;
      if (isClosed) {
        if (meeting?.todo_snapshot_error) {
          alert(`${meeting.todo_snapshot_error}\nBitte Besprechung erneut schließen.`);
          return;
        }
        const snap = meeting?.todo_snapshot || null;
        const snapItems = Array.isArray(snap?.items) ? snap.items : null;
        if (!snapItems) {
          alert("Kein ToDo-Snapshot vorhanden. Bitte Besprechung erneut schließen.");
          return;
        }
        rows = snapItems;
      } else {
        rows = this._buildTodoRowsLive({ tops: res?.list || [], meeting });
      }

      const projectLabel = await this._getProjectLabelWithNumber(pid);
      const projectInfo = await this._getProjectInfo(pid);
      const projectNumber = projectInfo.number || (pid || "");
      const meetingNr =
        meeting?.meeting_index ?? meeting?.meetingIndex ?? meeting?.index ?? meeting?.number ?? "";
      const meetingDateRaw =
        meeting?.meeting_date ||
        meeting?.meetingDate ||
        meeting?.date ||
        meeting?.created_at ||
        meeting?.createdAt ||
        meeting?.updated_at ||
        meeting?.updatedAt ||
        null;
      const meetingDateStr = this._formatDateForFile(meetingDateRaw || new Date());
      const fileName =
        this._sanitizeFileName(`${projectNumber}_ToDo_#${meetingNr}-${meetingDateStr}`) + ".pdf";

      const pdfLogoDefaults = {
        enabled: true,
        widthMm: 35,
        topMm: 8,
        rightMm: 8,
      };
      const pdfLogoEnabled = this._parseBool(settings?.["pdf.userLogoEnabled"], pdfLogoDefaults.enabled);
      const pdfLogoWidthMm = this._clampNumber(
        settings?.["pdf.userLogoWidthMm"],
        10,
        60,
        pdfLogoDefaults.widthMm
      );
      const pdfLogoDataUrl = String(settings?.["pdf.userLogoPngDataUrl"] || "").trim();
      const pdfLogoDummyHeightMm = Math.max(12, Math.round(pdfLogoWidthMm * 0.5));
      const logoHeightMm = await this._calcLogoHeightMm({
        enabled: pdfLogoEnabled,
        dataUrl: pdfLogoDataUrl,
        widthMm: pdfLogoWidthMm,
        dummyHeightMm: pdfLogoDummyHeightMm,
      });

      const html = this._buildTodoPrintHtml({ projectLabel, meeting, rows, settings, logoHeightMm });
      const out = await api.printHtmlToPdf({
        html,
        fileName,
        bbmVersion: "1.0",
        baseDir: protocolsDir,
        projectNumber,
        overwrite: true,
      });
      if (!out?.ok) {
        alert(out?.error || "PDF-Erzeugung fehlgeschlagen");
        return;
      }

      if (preview) {
        this._openPreview({ filePath: out.filePath, title: "ToDo (Vorschau)" });
      } else {
        alert(`PDF gespeichert:\n${out.filePath || "(Pfad unbekannt)"}`);
      }
    } catch (err) {
      console.error("[PrintModal] ToDo Vorschau fehlgeschlagen", err);
      alert("ToDo-Vorschau konnte nicht erzeugt werden.");
    } finally {
      if (preview) this._setPreviewLoading(false);
    }
  }

  async _printTopListAllPdf({ projectId, meetingId, preview = true } = {}) {
    const pid = projectId || this.router?.currentProjectId || null;
    const mid = meetingId || null;
    if (!pid) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }

    const api = window.bbmDb || {};
    if (typeof api.topsListByMeeting !== "function") {
      alert("topsListByMeeting ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }
    if (typeof api.printHtmlToPdf !== "function") {
      alert("printHtmlToPdf ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }

    if (preview) {
      this._ensurePreviewDom();
      this._setPreviewLoading(true);
    }

    try {
      if (this.router?.ensureAppSettingsLoaded) {
        await this.router.ensureAppSettingsLoaded({ force: false });
      }

      let settings = this.router?.context?.settings || {};
      const protocolsDir = String(settings?.["pdf.protocolsDir"] || "").trim();

      let meeting = null;
      if (mid) {
        if (typeof api.topsListByMeeting !== "function") {
          alert("topsListByMeeting ist nicht verfügbar (Preload/IPC fehlt).");
          return;
        }
        const resMeeting = await api.topsListByMeeting(mid);
        if (!resMeeting?.ok) {
          alert(resMeeting?.error || "Fehler beim Laden der Besprechung");
          return;
        }
        meeting = resMeeting.meeting || null;
        if (!meeting) {
          alert("Besprechung nicht gefunden.");
          return;
        }
      }

      const resAll = await api.topsListByProject(pid);
      if (!resAll?.ok) {
        alert(resAll?.error || "Fehler beim Laden der Projekt-TOPs");
        return;
      }

      const projectLabel = await this._getProjectLabelWithNumber(pid);
      const projectInfo = await this._getProjectInfo(pid);
      const projectNumber = projectInfo.number || (pid || "");
      const meetingNr =
        meeting?.meeting_index ?? meeting?.meetingIndex ?? meeting?.index ?? meeting?.number ?? "";
      const meetingDateRaw =
        meeting?.meeting_date ||
        meeting?.meetingDate ||
        meeting?.date ||
        meeting?.created_at ||
        meeting?.createdAt ||
        meeting?.updated_at ||
        meeting?.updatedAt ||
        null;
      const meetingDateStr = this._formatDateForFile(meetingDateRaw || new Date());
      const fileName = meetingNr
        ? this._sanitizeFileName(`${projectNumber}_TopListe-alle_#${meetingNr}-${meetingDateStr}`) +
          ".pdf"
        : this._sanitizeFileName(`${projectNumber}_TopListe-alle_${meetingDateStr}`) + ".pdf";

      const pdfLogoDefaults = {
        enabled: true,
        widthMm: 35,
        topMm: 8,
        rightMm: 8,
      };
      const pdfLogoEnabled = this._parseBool(
        settings?.["pdf.userLogoEnabled"],
        pdfLogoDefaults.enabled
      );
      const pdfLogoWidthMm = this._clampNumber(
        settings?.["pdf.userLogoWidthMm"],
        10,
        60,
        pdfLogoDefaults.widthMm
      );
      const pdfLogoDataUrl = String(settings?.["pdf.userLogoPngDataUrl"] || "").trim();
      const pdfLogoDummyHeightMm = Math.max(12, Math.round(pdfLogoWidthMm * 0.5));
      const logoHeightMm = await this._calcLogoHeightMm({
        enabled: pdfLogoEnabled,
        dataUrl: pdfLogoDataUrl,
        widthMm: pdfLogoWidthMm,
        dummyHeightMm: pdfLogoDummyHeightMm,
      });

      const tops = resAll.list || [];
      const html = this._buildTopListAllHtml({
        projectLabel,
        meeting,
        tops,
        settings,
        logoHeightMm,
      });

      const out = await api.printHtmlToPdf({
        html,
        fileName,
        bbmVersion: "1.0",
        baseDir: protocolsDir,
        projectNumber,
        overwrite: true,
      });
      if (!out?.ok) {
        alert(out?.error || "PDF-Erzeugung fehlgeschlagen");
        return;
      }

      if (preview) {
        this._openPreview({ filePath: out.filePath, title: "Top-Liste (alle)" });
      } else {
        alert(`PDF gespeichert:\n${out.filePath || "(Pfad unbekannt)"}`);
      }
    } catch (err) {
      console.error("[PrintModal] Top-Liste(alle) Vorschau fehlgeschlagen", err);
      alert("Top-Liste(alle)-Vorschau konnte nicht erzeugt werden.");
    } finally {
      if (preview) this._setPreviewLoading(false);
    }
  }

  close({ keepPreview = false } = {}) {
    if (!keepPreview) {
      this._closePreview();
    }

    this._setMsg("");
    this.meetings = [];
    this.selectedMeetingId = null;

    if (this.selMeeting) this.selMeeting.innerHTML = "";

    if (this._escHandler) {
      window.removeEventListener("keydown", this._escHandler);
      this._escHandler = null;
    }

    this.mode = "closed";
    this._destroyMainDom();
    if (!keepPreview) {
      this._destroyPreviewDom();
    }
  }

  // ============================================================
  // Data load (Modal)
  // ============================================================

  async _loadClosedMeetings() {
    if (this.loading) return;

    this.loading = true;
    this._setMsg("Lade?");
    this._applyState();

    try {
      const api = window.bbmDb || {};
      if (typeof api.meetingsListByProject !== "function") {
        alert("meetingsListByProject ist nicht verf?gbar (Preload/IPC fehlt).");
        return;
      }

      const res = await api.meetingsListByProject(this.projectId);
      if (!res?.ok) {
        alert(res?.error || "Fehler beim Laden der Besprechungen");
        return;
      }

      const list = (res.list || []).filter((m) => Number(m.is_closed) === 1);
      list.sort((a, b) => Number(b.meeting_index || 0) - Number(a.meeting_index || 0));

      this.meetings = list;

      this._renderMeetingOptions();

      if (this.meetings.length > 0) {
        this.selectedMeetingId = this.meetings[0].id;
      } else {
        this.selectedMeetingId = null;
      }

      this._renderMeetingOptions();

      if (!this.selectedMeetingId) {
        this._setMsg("Keine geschlossenen Besprechungen vorhanden.");
      } else {
        this._setMsg("");
      }
    } catch (err) {
      console.error("[PrintModal] _loadClosedMeetings failed", {
        projectId: this.projectId,
        message: err?.message || String(err),
        stack: err?.stack || null,
      });
      this._setMsg("Fehler beim Laden der Besprechungen.");
    } finally {
      this.loading = false;
      this._applyState();
    }
  }

  _renderMeetingOptions() {
    const sel = this.selMeeting;
    if (!sel) return;

    sel.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent =
      this.meetings.length > 0
        ? "— geschlossene Besprechung wählen —"
        : "— keine geschlossenen Besprechungen —";
    sel.appendChild(opt0);

    for (const m of this.meetings) {
      const opt = document.createElement("option");
      opt.value = m.id;

      const idx = m.meeting_index != null ? `#${m.meeting_index}` : "#—";
      const t = (m.title || "").toString().trim() || "(ohne Titel)";
      opt.textContent = `${idx} – ${t}`;
      sel.appendChild(opt);
    }

    sel.value = this.selectedMeetingId || "";
  }

  // ============================================================
  // Utils
  // ============================================================

  _sanitizeFileName(name) {
    const s = String(name || "").trim() || "BBM";
    return s
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }

  _pdfCopyrightText() {
    return "© 2026 BBM Alle Rechte vorbehalten";
  }

  _pdfCopyrightStyle() {
    return `
    .bbmCopyright {
      position: fixed;
      left: 7pt;
      bottom: 7pt;
      font-family: Calibri, Arial, sans-serif;
      font-size: 6pt;
      color: #222;
      z-index: 9999;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
    }
    `;
  }

  _pdfCopyrightHtml() {
    return `<div class="bbmCopyright">${this._escapeHtml(this._pdfCopyrightText())}</div>`;
  }

  _pad2(n) {
    return String(n).padStart(2, "0");
  }

  // (liefert DD.MM.YYYY)
  _fmtDateYYYYMMDD(dt) {
    if (!dt) return "?";
    try {
      const d = new Date(dt);
      if (Number.isNaN(d.getTime())) return "?";
      return `${this._pad2(d.getDate())}.${this._pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    } catch (_e) {
      return "?";
    }
  }

  _fmtDateTime(dt) {
    if (!dt) return null;
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return String(dt);
    const yyyy = d.getFullYear();
    const mm = this._pad2(d.getMonth() + 1);
    const dd = this._pad2(d.getDate());
    const hh = this._pad2(d.getHours());
    const mi = this._pad2(d.getMinutes());
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
  }

  _ampelHex(color) {
    return ampelHexFrom(color);
  }

  _shouldRenderAmpelInPdf({ mode, meeting, uiToggle } = {}) {
    const isVorabzug = mode === "vorabzug";
    const isClosed = Number(meeting?.is_closed) === 1;
    const uiOn = !!uiToggle;

    if (isVorabzug) return uiOn;

    if (isClosed) {
      const frozenRaw = meeting?.pdf_show_ampel ?? meeting?.pdfShowAmpel ?? null;
      if (frozenRaw === 0 || frozenRaw === "0" || frozenRaw === false) return false;
      if (frozenRaw === 1 || frozenRaw === "1" || frozenRaw === true) return true;
    }

    return uiOn;
  }

  _parseBool(value, fallback) {
    if (value == null || value === "") return fallback;
    const s = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "ja", "on"].includes(s)) return true;
    if (["0", "false", "no", "nein", "off"].includes(s)) return false;
    return fallback;
  }

  _clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const v = Math.round(n);
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  _escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  _truncate(s, n) {
    const v = String(s ?? "").trim();
    if (!v) return "";
    if (v.length <= n) return v;
    return v.slice(0, Math.max(0, n - 1)) + "…";
  }

  _cut(s, n) {
    const v = String(s ?? "").trim();
    if (!v) return "";
    if (v.length <= n) return v;
    return v.slice(0, Math.max(0, n));
  }

  async _calcLogoHeightMm({ enabled, dataUrl, widthMm, dummyHeightMm }) {
    if (!enabled) return 0;
    if (!dataUrl) return dummyHeightMm;

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = Number(img.naturalWidth || 0);
        const h = Number(img.naturalHeight || 0);
        if (!w || !h) {
          resolve(dummyHeightMm);
          return;
        }
        const ratio = h / w;
        const mm = Math.max(1, widthMm * ratio);
        resolve(Math.round(mm * 10) / 10);
      };
      img.onerror = () => resolve(dummyHeightMm);
      img.src = dataUrl;
    });
  }

  _defaultRoleLabels() {
    return {
      10: "Bauherr",
      20: "Planer",
      30: "Sachverstaendige",
      40: "Ing.-Bueros",
      50: "Gewerke",
      60: "Sonstige",
    };
  }

  _defaultRoleOrder() {
    return [10, 20, 30, 40, 50, 60];
  }

  _normalizeRoleLabels(raw) {
    const defaults = this._defaultRoleLabels();
    let parsed = null;

    try {
      const obj = JSON.parse(raw || "{}");
      if (obj && typeof obj === "object" && !Array.isArray(obj)) parsed = obj;
    } catch {
      parsed = null;
    }

    const out = { ...defaults };
    if (parsed) {
      for (const [k, v] of Object.entries(parsed)) {
        const n = Number(k);
        if (!Number.isFinite(n) || n <= 0) continue;
        const label = String(v ?? "").trim();
        if (!label) continue;
        out[n] = label;
      }
    }

    return out;
  }

  _normalizeRoleOrder(raw, labelsMap) {
    const baseOrder = this._defaultRoleOrder();
    const labelCodes = Object.keys(labelsMap || {})
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n) && n > 0);

    let parsed = [];
    try {
      const arr = JSON.parse(raw || "[]");
      if (Array.isArray(arr)) parsed = arr;
    } catch {
      parsed = [];
    }

    const out = [];
    const seen = new Set();
    for (const v of parsed) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (seen.has(n)) continue;
      out.push(n);
      seen.add(n);
    }

    for (const n of baseOrder) {
      if (seen.has(n)) continue;
      out.push(n);
      seen.add(n);
    }

    const extras = labelCodes.filter((n) => !seen.has(n));
    extras.sort((a, b) => a - b);
    for (const n of extras) out.push(n);

    return out;
  }

  _getRoleMetaFromSettings(settings) {
    const labelsRaw = settings?.firm_role_labels ?? settings?.["firm_role_labels"] ?? "";
    const orderRaw = settings?.firm_role_order ?? settings?.["firm_role_order"] ?? "";
    const roleLabels = this._normalizeRoleLabels(labelsRaw);
    const roleOrder = this._normalizeRoleOrder(orderRaw, roleLabels);
    return { roleLabels, roleOrder };
  }

  _sortFirmsByRoleAndName(firms, roleOrder) {
    const order =
      Array.isArray(roleOrder) && roleOrder.length ? roleOrder : this._defaultRoleOrder();
    const pos = new Map(order.map((code, idx) => [Number(code), idx]));

    const firmKey = (f) => {
      const short = String(f?.short || "").trim().toLowerCase();
      const name = String(f?.name || "").trim().toLowerCase();
      return short || name || "";
    };

    const list = Array.isArray(firms) ? [...firms] : [];
    list.sort((a, b) => {
      const ra = Number(a?.role_code);
      const rb = Number(b?.role_code);
      const ai = pos.has(ra) ? pos.get(ra) : order.length;
      const bi = pos.has(rb) ? pos.get(rb) : order.length;
      if (ai !== bi) return ai - bi;
      const ak = firmKey(a);
      const bk = firmKey(b);
      if (ak < bk) return -1;
      if (ak > bk) return 1;
      const an = String(a?.name || "").trim().toLowerCase();
      const bn = String(b?.name || "").trim().toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
    return list;
  }

  _firmLabel(f) {
    const short = String(f?.short || "").trim();
    const name = String(f?.name || "").trim();
    if (short && name) return `${short} - ${name}`;
    return short || name || "(ohne Name)";
  }

  _buildMeetingLabel(meeting) {
    const idx = meeting?.meeting_index != null ? `#${meeting.meeting_index}` : "#—";
    const rawTitle = (meeting?.title || "").toString().trim();

    let date = null;
    let keyword = "";

    if (rawTitle) {
      let t = rawTitle.replace(/^#\d+\s*(?:-|–)?\s*/i, "").trim();

      const m = t.match(/^(\d{2}\.\d{2}\.\d{4})(?:\s*-\s*(.*))?$/);
      if (m) {
        date = m[1];
        keyword = (m[2] || "").trim();
      } else {
        const dm = t.match(/(\d{2}\.\d{2}\.\d{4})/);
        if (dm) {
          date = dm[1];
          const after = t
            .slice(t.indexOf(dm[1]) + dm[1].length)
            .replace(/^\s*[-–]\s*/, "");
          keyword = after.trim();
        } else {
          keyword = t;
        }
      }
    }

    if (!date) {
      const fallback =
        meeting?.meeting_date ||
        meeting?.meetingDate ||
        meeting?.date ||
        meeting?.created_at ||
        meeting?.createdAt ||
        meeting?.updated_at ||
        meeting?.updatedAt ||
        null;
      const fmt = this._fmtDateYYYYMMDD(fallback);
      if (fmt && fmt !== "—") date = fmt;
    }

    if (keyword) {
      keyword = keyword.replace(/^#\d+\b\s*(?:-|–)?\s*/i, "").trim();
    }

    let label = date ? `${idx} ${date}` : idx;
    if (keyword) label += ` - ${keyword}`;
    return label.trim();
  }

  // ============================================================
  // Project label (WITH project_number) - direct DB fetch
  // ============================================================

  async _getProjectLabelWithNumber(projectId) {
    const pid = projectId || null;
    const api = window.bbmDb || {};

    // 1) bevorzugt: projectsList (bekannt vorhanden in vielen Builds)
    try {
      if (pid && typeof api.projectsList === "function") {
        const res = await api.projectsList();
        if (res?.ok) {
          const p = (res.list || []).find((x) => x.id === pid) || null;

          const pn = (p?.project_number ?? p?.projectNumber ?? "").toString().trim();

          const nm = (p?.name ?? "").toString().trim();
          const sh = (p?.short ?? "").toString().trim();
          const label = nm || sh;

          if (pn && label) return `${pn} - ${label}`;
          if (pn) return pn;
          if (label) return label;
        }
      }
    } catch (_e) {
      // ignore -> fallback
    }

    // 2) fallback: router label
    const rl = (this.router?.context?.projectLabel || "").toString().trim();
    if (rl) return rl;

    // 3) fallback: #id
    return pid ? `#${pid}` : "?";
  }

  async _getProjectInfo(projectId) {
    const api = window.bbmDb || {};
    const pid = projectId || this.router?.currentProjectId || null;
    if (!pid) return { number: "", name: "", short: "" };

    try {
      if (typeof api.projectsList === "function") {
        const res = await api.projectsList();
        if (res?.ok) {
          const p = (res.list || []).find((x) => x.id === pid) || null;
          return {
            number: (p?.project_number ?? p?.projectNumber ?? "").toString().trim(),
            name: (p?.name ?? "").toString().trim(),
            short: (p?.short ?? "").toString().trim(),
          };
        }
      }
    } catch (_e) {
      // ignore
    }

    return { number: "", name: "", short: "" };
  }

  _formatDateForFile(d) {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
    }
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate()
    ).padStart(2, "0")}`;
  }

  _sanitizeFileSegment(value) {
    return String(value || "")
      .replace(/[<>:"/\\|?*]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ============================================================
  // HTML Builder
  // ============================================================

  _buildPdfHeaderTemplate({
    projectLabel,
    meeting,
    settings,
    protocolTitle,
    logoHeightMm,
    maxLogoTopMm,
  } = {}) {
    const titleRaw = String(protocolTitle || "").trim();
    const title = titleRaw || "Baubesprechung";

    const meetingDate = this._fmtDateYYYYMMDD(
      meeting?.meeting_date ||
        meeting?.meetingDate ||
        meeting?.date ||
        meeting?.created_at ||
        meeting?.createdAt ||
        meeting?.updated_at ||
        meeting?.updatedAt ||
        null
    );
    const meetingIndex = meeting?.meeting_index != null ? `#${meeting.meeting_index}` : "#-";
    const meetingLine = `${this._escapeHtml(title)} Nr.:&nbsp;${this._escapeHtml(
      meetingIndex
    )}&nbsp;vom:&nbsp;${this._escapeHtml(meetingDate)}`;

    const projectNumber = (() => {
      const direct = meeting?.project_number ?? meeting?.projectNumber ?? "";
      if (direct) return String(direct).trim();
      const raw = (projectLabel || "").toString().trim();
      if (!raw) return "?";
      const parts = raw.split(" - ");
      return (parts[0] || raw).trim() || "?";
    })();
    const projectName = (() => {
      const raw = (projectLabel || "").toString().trim();
      if (!raw) return "";
      const parts = raw.split(" - ");
      if (parts.length <= 1) return "";
      return parts.slice(1).join(" - ").trim();
    })();
    const projectLine = projectName ? `${projectNumber} - ${projectName}` : projectNumber;

    const pdfLogoDefaults = {
      enabled: true,
      widthMm: 35,
      topMm: 8,
      rightMm: 8,
    };
    const pdfLogoEnabled = this._parseBool(
      settings?.["pdf.userLogoEnabled"],
      pdfLogoDefaults.enabled
    );
    const pdfLogoWidthMm = this._clampNumber(
      settings?.["pdf.userLogoWidthMm"],
      10,
      60,
      pdfLogoDefaults.widthMm
    );
    let pdfLogoTopMm = this._clampNumber(
      settings?.["pdf.userLogoTopMm"],
      0,
      30,
      pdfLogoDefaults.topMm
    );
    if (Number.isFinite(maxLogoTopMm)) {
      pdfLogoTopMm = Math.min(pdfLogoTopMm, Math.max(0, Number(maxLogoTopMm)));
    }
    const pdfLogoRightMm = this._clampNumber(
      settings?.["pdf.userLogoRightMm"],
      0,
      30,
      pdfLogoDefaults.rightMm
    );
    const pdfLogoDataUrl = String(settings?.["pdf.userLogoPngDataUrl"] || "").trim();
    const pdfLogoDummyHeightMm = Math.max(12, Math.round(pdfLogoWidthMm * 0.5));
    const effectiveLogoHeightMm = Number(logoHeightMm) > 0 ? Number(logoHeightMm) : 0;
    const headerHeightMm = pdfLogoTopMm + effectiveLogoHeightMm + 5;
    const pdfLogoPos = `top:${pdfLogoTopMm}mm; right:${pdfLogoRightMm}mm; width:${pdfLogoWidthMm}mm;`;

    const pdfLogoHtml = !pdfLogoEnabled
      ? ""
      : pdfLogoDataUrl
        ? `<img class="pdfLogo" src="${pdfLogoDataUrl}" style="${pdfLogoPos} height:auto;" />`
        : `<div class="pdfLogo pdfLogoDummy" style="${pdfLogoPos} height:${pdfLogoDummyHeightMm}mm;">Hier koennte Ihr Logo sein</div>`;

    return {
      projectLine,
      meetingLine,
      pdfLogoHtml,
      pdfLogoTopMm,
      effectiveLogoHeightMm,
      headerHeightMm,
    };
  }

  _buildPrintHtml({ projectLabel, meeting, tops, participants, settings, mode, logoHeightMm } = {}) {
    const proj = (projectLabel || "").trim() || "?";

    const meetingLabel = this._buildMeetingLabel(meeting);

    const isClosed = meeting ? Number(meeting.is_closed) === 1 : false;
    const isVorabzug = !isClosed && mode === "vorabzug";

    const userName = String(settings?.user_name || "").trim();
    const userCompany = String(settings?.user_company || "").trim();
    const userName1 = String(settings?.user_name1 || "").trim();
    const userName2 = String(settings?.user_name2 || "").trim();
    const userStreet = String(settings?.user_street || "").trim();
    const userZip = String(settings?.user_zip || "").trim();
    const userCity = String(settings?.user_city || "").trim();

    const protocolTitleRaw = String(settings?.["pdf.protocolTitle"] || "").trim();
    const protocolTitle = protocolTitleRaw || "Baubesprechung";
    const baseDateRaw = isClosed ? (meeting?.updated_at || meeting?.updatedAt || null) : null;
    let baseDate = baseDateRaw ? new Date(baseDateRaw) : new Date();
    if (Number.isNaN(baseDate.getTime())) baseDate = new Date();
    const uiToggle = this._parseBool(
      settings?.["tops.ampelEnabled"],
      this._parseBool(settings?.["pdf.trafficLightAllEnabled"], true)
    );
    const trafficLightAllEnabled = this._shouldRenderAmpelInPdf({ mode, meeting, uiToggle });
    const footerUseUserData = this._parseBool(settings?.["pdf.footerUseUserData"], false);
    const footerPlace = String(settings?.["pdf.footerPlace"] || "").trim();
    const footerDate = String(settings?.["pdf.footerDate"] || "").trim();
    const footerName1 = String(settings?.["pdf.footerName1"] || "").trim();
    const footerName2 = String(settings?.["pdf.footerName2"] || "").trim();
    const footerRecorder = String(settings?.["pdf.footerRecorder"] || "").trim();
    const footerStreet = String(settings?.["pdf.footerStreet"] || "").trim();
    const footerZip = String(settings?.["pdf.footerZip"] || "").trim();
    const footerCity = String(settings?.["pdf.footerCity"] || "").trim();

    const pickFooterValue = (value, fallback) => {
      const v = String(value || "").trim();
      if (v) return v;
      return String(fallback || "").trim();
    };

    const baseName1 = footerUseUserData ? userName1 : "";
    const baseName2 = footerUseUserData ? userName2 : "";
    const baseStreet = footerUseUserData ? userStreet : "";
    const baseZip = footerUseUserData ? userZip : "";
    const baseCity = footerUseUserData ? userCity : "";

    const footerOutName1 = pickFooterValue(footerName1, baseName1);
    const footerOutName2 = pickFooterValue(footerName2, baseName2);
    const footerOutStreet = pickFooterValue(footerStreet, baseStreet);
    const footerOutZip = pickFooterValue(footerZip, baseZip);
    const footerOutCity = pickFooterValue(footerCity, baseCity);

    const headerTemplate = this._buildPdfHeaderTemplate({
      projectLabel,
      meeting,
      settings,
      protocolTitle,
      logoHeightMm,
    });
    const projectLine = headerTemplate.projectLine;
    const meetingLine = meeting ? headerTemplate.meetingLine : "";
    const pdfLogoHtml = headerTemplate.pdfLogoHtml;
    const pdfLogoTopMm = headerTemplate.pdfLogoTopMm;
    const pdfLogoHeightMm = headerTemplate.effectiveLogoHeightMm;

    // (aktuell nicht im Layout genutzt, aber beibehalten)
    const rightLine1 = this._escapeHtml(userName || "?");
    const rightLine2 = this._escapeHtml(userCompany || "?");

    // Closed: KEINE Statuszeile ("Geschlossen"-Badge)
    // Vorabzug: Statuszeile mit Stand (aktuell bewusst leer)
    const statusLine = "";

    const starSvg = `
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <polygon
          points="50,7 61,36 92,36 66,54 76,84 50,66 24,84 34,54 8,36 39,36"
          fill="#fbc02d"
          stroke="none"
        />
      </svg>
    `.trim();

    const visibleTops = (tops || []).filter((t) => shouldShowTopForMeeting(t, meeting));
    const ampelCompute = createAmpelComputer(visibleTops, baseDate);
    const rowsHtml = visibleTops.map((t) => {
        const level = Number(t.level || 1);
        const isLevel1 = level === 1;
        const isImportant = Number(t.is_important ?? t.isImportant ?? 0) === 1;
        const isOld = Number(t.is_carried_over ?? t.isCarriedOver ?? 0) === 1;
        const isTouched = Number(t.is_touched ?? t.isTouched ?? 0) === 1;
        const isDone = shouldGrayTopForMeeting(t, meeting);

        const shouldMark = !isOld || (isOld && isTouched);
        const shortBlue = shouldMark;
        const longBlue = shouldMark;

        const BLUE = "#1565c0";
        const RED = "#c62828";

        const doneColor = "#9e9e9e";
        const shortColor = isDone ? doneColor : isImportant ? RED : shortBlue ? BLUE : "#111";
        const longColor = isDone ? doneColor : isImportant ? RED : longBlue ? BLUE : "#111";

        const hasStar = shouldMark;

        const numRaw = t.displayNumber ?? t.display_number ?? t.number ?? "?";
        const num = this._escapeHtml(String(numRaw));

        const createdAtRaw =
          t.created_at ?? t.createdAt ?? t.top_created_at ?? t.topCreatedAt ?? null;
        const createdDate = this._fmtDateYYYYMMDD(createdAtRaw);

        const shortText = this._truncate(t.title || "(ohne Bezeichnung)", 50);
        const longTextRaw = t.longtext != null ? String(t.longtext) : "";
        const longText = this._truncate(
          longTextRaw.replace(/\r?\n/g, " ").replace(/ +/g, " "),
          250
        );

        const statusRaw = (t.status || "").toString().trim();
        const status = this._cut(statusRaw || "?", 20);

        const dueRaw = (t.due_date || t.dueDate || "").toString().trim();
        const due = dueRaw ? this._fmtDateYYYYMMDD(dueRaw) : "?";

        const respRaw = (t.responsible_label || t.responsibleLabel || "").toString().trim();
        const resp = this._cut(respRaw || "?", 20);

        const dotHex =
          !isLevel1 && trafficLightAllEnabled
            ? this._ampelHex(ampelCompute(t)) || null
            : null;

        const dotHtml = trafficLightAllEnabled
          ? `<span class="dot ${dotHex ? "fill" : "empty"}" style="${
              dotHex ? `background:${dotHex};` : ""
            }"></span>`
          : "";

        const metaHtml = isLevel1
          ? ""
          : `
              <div class="metaLine1">
                <span class="metaText">${this._escapeHtml(due)}</span>
                ${dotHtml}
              </div>
              <div class="metaLine2">${this._escapeHtml(status)}</div>
              <div class="metaLine3">${this._escapeHtml(resp)}</div>
            `;

        return `
          <tr class="topRow ${isLevel1 ? "lvl1" : ""}" data-level="${level}">
            <td class="colNr">
              <div class="nr">${num}</div>
              <div class="nrDate">${this._escapeHtml(createdDate)}</div>
            </td>

            <td class="colText">
              <div class="textWrap">
                <div class="txtStar ${hasStar ? "" : "empty"}">${hasStar ? starSvg : ""}</div>
                <div class="txtBlock">
                  <div class="short" style="color:${shortColor};">${this._escapeHtml(shortText)}</div>
                  <div class="long" style="color:${longColor};">${this._escapeHtml(longText)}</div>
                </div>
              </div>
            </td>

            <td class="colMeta">
              ${metaHtml}
            </td>
          </tr>
        `;
      })
      .join("");

    const bodyClass = isVorabzug ? "vorabzug" : "closed";

    const watermarkHtml = isVorabzug ? `<div class="watermark" aria-hidden="true">VORABZUG</div>` : "";
    const statusHtml = statusLine ? `<div class="status">${statusLine}</div>` : "";

    const partRows = (participants || [])
      .filter((p) => Number(p?.isPresent ?? p?.is_present ?? 0) === 1)
      .map((p) => {
        const name = String(p?.name || "").trim();
        const rolle = String(p?.rolle || "").trim();
        const firm = String(p?.firm || "").trim();
        const funk = String(p?.funk || "").trim();
        const email = String(p?.email || "").trim();
        const isPresent = true;
        const isInDist = Number(p?.isInDistribution ?? p?.is_in_distribution ?? 0) === 1;
        const presentMark = isPresent ? "x" : "-";
        const distMark = isInDist ? "x" : "-";
        return `
          <tr>
            <td>${this._escapeHtml(name)}</td>
            <td>${this._escapeHtml(rolle)}</td>
            <td>${this._escapeHtml(firm)}</td>
            <td>${this._escapeHtml(funk)}</td>
            <td>${this._escapeHtml(email)}</td>
            <td class="chk">
              <div class="chkStack">
                <div class="chkRow">${presentMark}</div>
                <div class="chkRow">${distMark}</div>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    const participantsHtml =
      partRows ||
      `<tr><td colspan="6" style="padding:3mm 2mm; opacity:.7;">Keine Teilnehmer vorhanden.</td></tr>`;

    const footerLine1 = (() => {
      const parts = [footerPlace, footerDate].filter((v) => String(v || "").trim());
      return parts.join(", ");
    })();
    const footerLine2 = [footerOutName1, footerOutName2].filter((v) => v).join(", ");
    const footerLine3 = footerRecorder || "";
    const footerLine4 = footerOutStreet || "";
    const footerLine5 = [footerOutZip, footerOutCity].filter((v) => v).join(" ").trim();

    const fmtFooterLine = (value) => (value ? this._escapeHtml(value) : "&nbsp;");

    const nextMeetingEnabledRaw = this._parseBool(settings?.["print.nextMeeting.enabled"], false);
    const nextMeetingDateRaw = String(settings?.["print.nextMeeting.date"] || "").trim();
    const nextMeetingTimeRaw = String(settings?.["print.nextMeeting.time"] || "").trim();
    const nextMeetingPlaceRaw = String(settings?.["print.nextMeeting.place"] || "").trim();
    const nextMeetingExtraRaw = String(settings?.["print.nextMeeting.extra"] || "").trim();
    const nextMeetingEnabled =
      nextMeetingEnabledRaw ||
      !!(nextMeetingDateRaw || nextMeetingTimeRaw || nextMeetingPlaceRaw || nextMeetingExtraRaw);

    const buildNextMeetingSentence = () => {
      let weekday = "";
      let dateOut = "";
      if (nextMeetingDateRaw) {
        const d = new Date(`${nextMeetingDateRaw}T00:00:00`);
        if (!Number.isNaN(d.getTime())) {
          weekday = d.toLocaleDateString("de-DE", { weekday: "long" });
          dateOut = d.toLocaleDateString("de-DE");
        } else {
          dateOut = nextMeetingDateRaw;
        }
      }

      const timeOut = nextMeetingTimeRaw || "—";
      const dateFallback = dateOut || "—";
      const w = this._escapeHtml(weekday);
      const d = this._escapeHtml(dateFallback);
      const t = this._escapeHtml(timeOut);
      const extra = this._escapeHtml(nextMeetingExtraRaw);
      const place = this._escapeHtml(nextMeetingPlaceRaw);

      let s = "Die nächste Besprechung findet am ";
      if (w && d) {
        s += `${w}, den ${d} um ${t} Uhr`;
      } else {
        s += `${d} um ${t} Uhr`;
      }
      if (extra) s += ` ${extra}`;
      if (place) s += ` ${place}`;
      s += " statt.";
      return s;
    };

    const nextMeetingHtml = nextMeetingEnabled
      ? `
    <div class="bbm-next-meeting-inline">
      <p>${buildNextMeetingSentence()}</p>
    </div>
      `.trim()
      : "";

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>BBM Druck</title>
  <style>
    @page { size: A4; margin: 0 10mm 15mm 19mm; }

    :root{
      --sepW: 0.25pt;
      --sepC: #000000;
      --red: #2b6cb0;
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Calibri, Arial, sans-serif;
      font-size: 10.5pt;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .watermark {
      position: fixed;
      left: 50%;
      top: 45%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-weight: 900;
      font-size: 64pt;
      letter-spacing: 3pt;
      color: rgba(43,108,176,0.16);
      z-index: 0;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
    }

    .pageHeader {
      position: fixed;
      left: 0;
      right: 0;
      top: 0;
      height: var(--headerH);
      z-index: 5;
      overflow: hidden;
      pointer-events: none;
    }
    .pageHeader .pdfLogo {
      position: absolute;
      z-index: 6;
      pointer-events: none;
    }

    .pdfLogoDummy {
      background: #f0f0f0;
      border: 0.2mm solid #bbb;
      color: #666;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 8.5pt;
      padding: 1mm;
      box-sizing: border-box;
    }

    .topRuleFixed {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      border-top: var(--sepW) solid var(--sepC);
      pointer-events: none;
    }

    .page { position: relative; z-index: 1; }

    .page1 {
      margin: 0 0 6mm 0;
      padding-top: calc(var(--logoTop) + var(--logoHeight) + 5mm);
    }
    .projLine {
      margin-top: 1.5mm;
      font-weight: 400;
      font-size: 11pt;
    }
    .projLabel {
      margin-top: 2mm;
      font-weight: 400;
      font-size: 11pt;
    }
    .meetingLine {
      margin-top: 15mm;
      margin-left: 15mm;
      font-weight: 700;
      font-size: 18pt;
    }
    .participants {
      margin-top: 10mm;
    }
    .participantsTitle {
      font-weight: 700;
      margin: 0 0 2mm 0;
      padding-top: 2mm;
      border-top: var(--sepW) solid var(--sepC);
    }
    .participants table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .participants th,
    .participants td {
      text-align: left;
      padding: 2mm 2mm;
      border-bottom: var(--sepW) solid var(--sepC);
      font-size: 9.4pt;
      vertical-align: top;
    }
    .participants th {
      font-weight: 700;
      background: #efefef;
    }
    .participants .chk {
      text-align: center;
      width: 12mm;
      font-weight: 400;
    }
    .participants .chkLabel {
      font-size: 7pt;
      font-weight: 400;
      line-height: 1.1;
    }
    .participants .chkStack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1mm;
    }
    .participants .chkRow {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 2.2mm;
    }

    body.vorabzug .meetingLine { color: var(--red); }
    body.vorabzug .projLine { color: var(--red); }

    table.tops {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: calc(-1 * var(--headerH));
    }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    thead .topsHeadPad th {
      padding: 0;
      height: var(--headerH);
      border: 0;
      border-bottom: var(--sepW) solid var(--sepC);
      background: transparent;
      font-size: 0;
      line-height: 0;
    }

    .hdr th {
      background: #efefef;
      color: #111;
      font-weight: 800;
      font-size: 10pt;
      text-align: left;
      padding: 2.2mm 2mm;
      border-bottom: var(--sepW) solid var(--sepC);
    }

    body.vorabzug .hdr th {
      background: #e7f0ff;
    }

    .hdrTop {
      display: block;
      margin-left: calc(4.5mm + 1.6mm);
    }
    .hdrTop .hdrTitle {
      font-weight: 800;
      font-size: 10pt;
      line-height: 1.1;
      font-style: normal;
      margin-bottom: 0.6mm;
    }
    .hdrTop .hdrTops {
      font-weight: 400;
      font-size: 8.6pt;
      line-height: 1.1;
      font-style: normal;
    }

    .hdr th.metaHdr {
      font-weight: 400;
      font-size: 9pt;
    }
    .hdr th.metaHdr div {
      font-weight: 400;
      font-size: 8.6pt;
      line-height: 1.1;
    }

    .wNr   { width: 20mm; }
    .wText { width: 130mm; }
    .wMeta { width: 25mm; }

    tbody td {
      vertical-align: top;
      padding: 2.0mm 2mm;
      border-bottom: var(--sepW) solid var(--sepC);
      overflow: hidden;
    }
    tbody tr.topRow {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    tbody tr.topRow.allowSplit {
      break-inside: auto;
      page-break-inside: auto;
    }
    tbody tr.topRow.breakBefore {
      break-before: page;
      page-break-before: always;
    }

    tr.lvl1 td {
      background: #eeeeee;
      padding-top: 1.8mm;
      padding-bottom: 1.8mm;
    }
    tr.lvl1 .short { font-weight: 650; }

    .colNr .nr {
      font-weight: 400;
      font-size: 9.2pt;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .colNr .nrDate {
      font-size: 8.0pt;
      line-height: 1.12;
      margin-top: 0.7mm;
      color: #777;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .textWrap {
      display: flex;
      align-items: flex-start;
      gap: 1.6mm;
    }
    .txtStar {
      width: 2.5mm;
      height: 2.5mm;
      flex: 0 0 2.5mm;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 0.2mm;
    }
    .txtStar svg {
      width: 2.5mm;
      height: 2.5mm;
      display: block;
    }
    .txtStar.empty {
      visibility: hidden;
    }
    .txtBlock {
      min-width: 0;
      flex: 1 1 auto;
    }

    .short {
      font-weight: 400;
      font-size: 11.4pt;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    .long {
      margin-top: 1.2mm;
      font-size: 10.6pt;
      line-height: 1.25;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      color: #111;
      opacity: 0.95;
    }

    .colMeta { font-size: 9.2pt; color: #222; }
    .metaLine1 {
      display: flex;
      align-items: center;
      gap: 2mm;
    }
    .metaText {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
      flex: 1;
    }

    .dot {
      width: 4mm;
      height: 4mm;
      border-radius: 999px;
      box-sizing: border-box;
      flex: 0 0 auto;
    }
    .dot.fill { border: 0.2mm solid rgba(0,0,0,0.25); }
    .dot.empty { background: transparent; border: 0.2mm solid #aaa; }

    .metaLine2,
    .metaLine3 {
      margin-top: 1.0mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
      color: #222;
    }

    .footerBlock {
      margin-top: 10mm;
      font-size: 10.5pt;
    }
    .footerTitle {
      font-weight: 700;
      margin-bottom: 2mm;
    }
    .footerLine {
      margin-top: 1.2mm;
      min-height: 4mm;
    }
    .bbm-next-meeting-inline {
      margin-top: 15mm;
      font-size: 12pt;
    }
    ${this._pdfCopyrightStyle()}
  </style>
</head>

<body class="${bodyClass}" style="--logoTop:${pdfLogoTopMm}mm; --logoHeight:${pdfLogoHeightMm}mm; --headerH:${pdfLogoTopMm + pdfLogoHeightMm + 5}mm;">
  ${watermarkHtml}
  <div class="pageHeader" aria-hidden="true">
    ${pdfLogoHtml}
    <div class="topRuleFixed"></div>
  </div>
  ${this._pdfCopyrightHtml()}
    <div class="page">
      <div class="page1">
        <div class="projLabel">Projekt:</div>
        <div class="projLine">${this._escapeHtml(projectLine)}</div>
        <div class="meetingLine">${meetingLine}</div>
      <div class="participants">
        <div class="participantsTitle">Teilnehmer</div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Rolle</th>
              <th>Firma</th>
              <th>Funk</th>
              <th>E-Mail</th>
              <th class="chk">
                <div class="chkStack">
                  <div class="chkLabel">Anwesend</div>
                  <div class="chkLabel">Verteiler</div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            ${participantsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <table class="tops">
      <colgroup>
        <col class="wNr" />
        <col class="wText" />
        <col class="wMeta" />
      </colgroup>
      <thead>
        <tr class="topsHeadPad"><th colspan="3"></th></tr>
        <tr class="hdr">
          <th class="wNr">Nr.</th>
          <th class="wText">
            <div class="hdrTop">
              <div class="hdrTitle">Titel</div>
              <div class="hdrTops">TOPs</div>
            </div>
          </th>
          <th class="wMeta metaHdr">
            <div>Fertig bis</div>
            <div>Status</div>
            <div>verantwortlich</div>
          </th>
        </tr>
      </thead>

      <tbody>
        ${
          rowsHtml ||
          `<tr><td colspan="3" style="padding:3mm 2mm; opacity:.7;">Keine TOPs vorhanden.</td></tr>`
        }
      </tbody>
    </table>
    ${nextMeetingHtml}
    <div class="footerBlock">
      <div class="footerTitle">Aufgestellt:</div>
      <div class="footerLine">${fmtFooterLine(footerLine1)}</div>
      <div class="footerLine">${fmtFooterLine(footerLine2)}</div>
      <div class="footerLine">${fmtFooterLine(footerLine3)}</div>
      <div class="footerLine">${fmtFooterLine(footerLine4)}</div>
      <div class="footerLine">${fmtFooterLine(footerLine5)}</div>
    </div>
  </div>
  <script>
    (function () {
      const measureMm = () => {
        const probe = document.createElement("div");
        probe.style.position = "absolute";
        probe.style.left = "-10000px";
        probe.style.top = "-10000px";
        probe.style.width = "100mm";
        probe.style.height = "1px";
        document.body.appendChild(probe);
        const px = probe.getBoundingClientRect().width / 100;
        probe.remove();
        return px || 3.78;
      };

      const getLines = (row, lineHeight, longMarginTop) => {
        const block = row.querySelector(".txtBlock");
        if (!block) return 1;
        const h = block.getBoundingClientRect().height;
        const effective = Math.max(0, h - longMarginTop);
        return Math.max(1, Math.round(effective / lineHeight));
      };

      const applyPagination = () => {
        const table = document.querySelector("table.tops");
        if (!table) return;
        const tbody = table.querySelector("tbody");
        const thead = table.querySelector("thead");
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll("tr.topRow"));
        if (!rows.length) return;

        rows.forEach((r) => {
          r.classList.remove("breakBefore", "allowSplit");
          r.removeAttribute("data-keep-prev");
        });

        const mmPx = measureMm();
        const pageHeight = 297 * mmPx;
        const footerReserve = 15 * mmPx;
        const headHeight = thead ? thead.getBoundingClientRect().height : 0;
        const pageTbodyHeight = pageHeight - footerReserve - headHeight;

        const longSample = tbody.querySelector(".long");
        const lineHeight = longSample
          ? parseFloat(getComputedStyle(longSample).lineHeight) || 14
          : 14;
        const longMarginTop = longSample
          ? parseFloat(getComputedStyle(longSample).marginTop) || 0
          : 0;

        const tbodyTop = tbody.getBoundingClientRect().top + window.scrollY;
        const pageStart = Math.floor(tbodyTop / pageHeight) * pageHeight;
        let remaining = pageHeight - footerReserve - (tbodyTop - pageStart);
        if (!Number.isFinite(remaining) || remaining <= 0) remaining = pageTbodyHeight;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row.getAttribute("data-keep-prev") === "1") {
            const lines = getLines(row, lineHeight, longMarginTop);
            if (lines >= 6) row.classList.add("allowSplit");
            remaining -= row.getBoundingClientRect().height;
            if (remaining < 0) remaining = pageTbodyHeight - row.getBoundingClientRect().height;
            continue;
          }

          const level = Number(row.getAttribute("data-level") || "1");
          if (level === 1) {
            let nextIdx = -1;
            for (let j = i + 1; j < rows.length; j++) {
              const lvl = Number(rows[j].getAttribute("data-level") || "1");
              if (lvl === 2) {
                nextIdx = j;
                break;
              }
              if (lvl === 1) break;
            }
            if (nextIdx !== -1) {
              const nextRow = rows[nextIdx];
              const groupHeight =
                row.getBoundingClientRect().height + nextRow.getBoundingClientRect().height;
              if (remaining < groupHeight) {
                row.classList.add("breakBefore");
                remaining = pageTbodyHeight;
              }
              remaining -= row.getBoundingClientRect().height;
              nextRow.setAttribute("data-keep-prev", "1");
              continue;
            }
          }

          const lines = getLines(row, lineHeight, longMarginTop);
          const allowSplit = lines >= 6;
          if (allowSplit) row.classList.add("allowSplit");

          const minLinesPx = 3 * lineHeight;
          if (remaining < minLinesPx) {
            row.classList.add("breakBefore");
            remaining = pageTbodyHeight;
          }

          const rowHeight = row.getBoundingClientRect().height;
          if (!allowSplit && rowHeight > remaining) {
            row.classList.add("breakBefore");
            remaining = pageTbodyHeight;
          }

          if (rowHeight <= remaining) {
            remaining -= rowHeight;
          } else if (allowSplit) {
            let overflow = rowHeight - remaining;
            if (overflow > 0) {
              const fullPages = Math.floor(overflow / pageTbodyHeight);
              overflow -= fullPages * pageTbodyHeight;
              remaining = pageTbodyHeight - overflow;
              if (overflow === 0) remaining = 0;
            }
          } else {
            remaining -= rowHeight;
          }
        }
      };

      const run = () => applyPagination();
      window.addEventListener("load", () => {
        setTimeout(run, 0);
        requestAnimationFrame(run);
      });
    })();
  </script>
</body>
</html>
    `.trim();

    return html;
  }

  _buildTopListAllHtml({ projectLabel, meeting, tops, settings, logoHeightMm } = {}) {
    const isClosed = Number(meeting?.is_closed) === 1;
    const mode = isClosed ? "closed" : "vorabzug";

    const protocolTitleRaw = String(settings?.["pdf.protocolTitle"] || "").trim();
    const protocolTitle = protocolTitleRaw || "Baubesprechung";
    const baseDateRaw = isClosed ? (meeting?.updated_at || meeting?.updatedAt || null) : null;
    let baseDate = baseDateRaw ? new Date(baseDateRaw) : new Date();
    if (Number.isNaN(baseDate.getTime())) baseDate = new Date();
    const uiToggle = this._parseBool(
      settings?.["tops.ampelEnabled"],
      this._parseBool(settings?.["pdf.trafficLightAllEnabled"], true)
    );
    const trafficLightAllEnabled = this._shouldRenderAmpelInPdf({ mode, meeting, uiToggle });

    const headerTemplate = this._buildPdfHeaderTemplate({
      projectLabel,
      meeting,
      protocolTitle,
      logoHeightMm,
    });
    const projectLine = headerTemplate.projectLine;
    const meetingLine = headerTemplate.meetingLine;
    const pdfLogoHtml = headerTemplate.pdfLogoHtml;
    const pdfLogoTopMm = headerTemplate.pdfLogoTopMm;
    const pdfLogoHeightMm = headerTemplate.effectiveLogoHeightMm;

    const starSvg = `
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <polygon
          points="50,7 61,36 92,36 66,54 76,84 50,66 24,84 34,54 8,36 39,36"
          fill="#fbc02d"
          stroke="none"
        />
      </svg>
    `.trim();

    const isDoneStatus = (status) => {
      const st = (status || "").toString().trim().toLowerCase();
      return st === "erledigt";
    };

    const allTops = Array.isArray(tops) ? tops : [];
    const ampelCompute = createAmpelComputer(allTops, baseDate);
    const rowsHtml = allTops
      .map((t) => {
        const level = Number(t.level || 1);
        const isLevel1 = level === 1;
        const isImportant = Number(t.is_important ?? t.isImportant ?? 0) === 1;
        const isOld = Number(t.is_carried_over ?? t.isCarriedOver ?? 0) === 1;
        const isTouched = Number(t.is_touched ?? t.isTouched ?? 0) === 1;
        const isDone = isDoneStatus(t.status);

        const shouldMark = !isOld || (isOld && isTouched);
        const BLUE = "#1565c0";
        const RED = "#c62828";
        const doneColor = "#9e9e9e";
        const shortColor = isDone ? doneColor : isImportant ? RED : shouldMark ? BLUE : "#111";
        const longColor = isDone ? doneColor : isImportant ? RED : shouldMark ? BLUE : "#111";
        const hasStar = shouldMark;

        const numRaw = t.displayNumber ?? t.display_number ?? t.number ?? "?";
        const num = this._escapeHtml(String(numRaw));

        const createdAtRaw =
          t.created_at ?? t.createdAt ?? t.top_created_at ?? t.topCreatedAt ?? null;
        const createdDate = this._fmtDateYYYYMMDD(createdAtRaw);

        const shortText = this._truncate(t.title || "(ohne Bezeichnung)", 50);
        const longTextRaw = t.longtext != null ? String(t.longtext) : "";
        const longText = this._truncate(
          longTextRaw.replace(/\r?\n/g, " ").replace(/ +/g, " "),
          250
        );

        const statusRaw = (t.status || "").toString().trim();
        const status = this._cut(statusRaw || "?", 20);

        const dueRaw = (t.due_date || t.dueDate || "").toString().trim();
        const due = dueRaw ? this._fmtDateYYYYMMDD(dueRaw) : "?";

        const respRaw = (t.responsible_label || t.responsibleLabel || "").toString().trim();
        const resp = this._cut(respRaw || "?", 20);

        const dotHex =
          !isLevel1 && trafficLightAllEnabled
            ? this._ampelHex(ampelCompute(t)) || null
            : null;

        const dotHtml = trafficLightAllEnabled
          ? `<span class="dot ${dotHex ? "fill" : "empty"}" style="${
              dotHex ? `background:${dotHex};` : ""
            }"></span>`
          : "";

        const metaHtml = isLevel1
          ? ""
          : `
              <div class="metaLine1">
                <span class="metaText">${this._escapeHtml(due)}</span>
                ${dotHtml}
              </div>
              <div class="metaLine2">${this._escapeHtml(status)}</div>
              <div class="metaLine3">${this._escapeHtml(resp)}</div>
            `;

        return `
          <tr class="topRow ${isLevel1 ? "lvl1" : ""}" data-level="${level}">
            <td class="colNr">
              <div class="nr">${num}</div>
              <div class="nrDate">${this._escapeHtml(createdDate)}</div>
            </td>

            <td class="colText">
              <div class="textWrap">
                <div class="txtStar ${hasStar ? "" : "empty"}">${hasStar ? starSvg : ""}</div>
                <div class="txtBlock">
                  <div class="short" style="color:${shortColor};">${this._escapeHtml(shortText)}</div>
                  <div class="long" style="color:${longColor};">${this._escapeHtml(longText)}</div>
                </div>
              </div>
            </td>

            <td class="colMeta">
              ${metaHtml}
            </td>
          </tr>
        `;
      })
      .join("");

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>BBM Top-Liste (alle)</title>
  <style>
    @page { size: A4; margin: 0 10mm 15mm 19mm; }

    :root{
      --sepW: 0.25pt;
      --sepC: #000000;
      --red: #2b6cb0;
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Calibri, Arial, sans-serif;
      font-size: 10.5pt;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .pageHeader {
      position: fixed;
      left: 0;
      right: 0;
      top: 0;
      height: var(--headerH);
      z-index: 5;
      overflow: hidden;
      pointer-events: none;
    }
    .pageHeader .pdfLogo {
      position: absolute;
      z-index: 6;
      pointer-events: none;
    }

    .pdfLogoDummy {
      background: #f0f0f0;
      border: 0.2mm solid #bbb;
      color: #666;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 8.5pt;
      padding: 1mm;
      box-sizing: border-box;
    }

    .topRuleFixed {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      border-top: var(--sepW) solid var(--sepC);
      pointer-events: none;
    }

    .page { position: relative; z-index: 1; }

    .page1 {
      margin: 0 0 6mm 0;
      padding-top: calc(var(--logoTop) + var(--logoHeight) + 5mm);
    }
    .projLine {
      margin-top: 1.5mm;
      font-weight: 400;
      font-size: 11pt;
    }
    .projLabel {
      margin-top: 2mm;
      font-weight: 400;
      font-size: 11pt;
    }
    .meetingLine {
      margin-top: 15mm;
      margin-left: 15mm;
      font-weight: 700;
      font-size: 18pt;
    }
    .meetingMetaLine {
      margin-top: 3mm;
      margin-left: 15mm;
      font-weight: 400;
      font-size: 11pt;
    }

    table.tops {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: calc(-1 * var(--headerH));
    }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    thead .topsHeadPad th {
      padding: 0;
      height: var(--headerH);
      border: 0;
      border-bottom: var(--sepW) solid var(--sepC);
      background: transparent;
      font-size: 0;
      line-height: 0;
    }

    .hdr th {
      background: #efefef;
      color: #111;
      font-weight: 800;
      font-size: 10pt;
      text-align: left;
      padding: 2.2mm 2mm;
      border-bottom: var(--sepW) solid var(--sepC);
    }

    .hdrTop {
      display: block;
      margin-left: calc(4.5mm + 1.6mm);
    }
    .hdrTop .hdrTitle {
      font-weight: 800;
      font-size: 10pt;
      line-height: 1.1;
      font-style: normal;
      margin-bottom: 0.6mm;
    }
    .hdrTop .hdrTops {
      font-weight: 400;
      font-size: 8.6pt;
      line-height: 1.1;
      font-style: normal;
    }

    .hdr th.metaHdr {
      font-weight: 400;
      font-size: 9pt;
    }
    .hdr th.metaHdr div {
      font-weight: 400;
      font-size: 8.6pt;
      line-height: 1.1;
    }

    .wNr   { width: 20mm; }
    .wText { width: 130mm; }
    .wMeta { width: 25mm; }

    tbody td {
      vertical-align: top;
      padding: 2.0mm 2mm;
      border-bottom: var(--sepW) solid var(--sepC);
      overflow: hidden;
    }
    tbody tr.topRow {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    tbody tr.topRow.allowSplit {
      break-inside: auto;
      page-break-inside: auto;
    }
    tbody tr.topRow.breakBefore {
      break-before: page;
      page-break-before: always;
    }

    tr.lvl1 td {
      background: #eeeeee;
      padding-top: 1.8mm;
      padding-bottom: 1.8mm;
    }
    tr.lvl1 .short { font-weight: 650; }

    .colNr .nr {
      font-weight: 400;
      font-size: 9.2pt;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .colNr .nrDate {
      font-size: 8.0pt;
      line-height: 1.12;
      margin-top: 0.7mm;
      color: #777;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .textWrap {
      display: flex;
      align-items: flex-start;
      gap: 1.6mm;
    }
    .txtStar {
      width: 2.5mm;
      height: 2.5mm;
      flex: 0 0 2.5mm;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 0.2mm;
    }
    .txtStar svg {
      width: 2.5mm;
      height: 2.5mm;
      display: block;
    }
    .txtStar.empty {
      visibility: hidden;
    }
    .txtBlock {
      min-width: 0;
      flex: 1 1 auto;
    }

    .short {
      font-weight: 400;
      font-size: 11.4pt;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    .long {
      margin-top: 1.2mm;
      font-size: 10.6pt;
      line-height: 1.25;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      color: #111;
      opacity: 0.95;
    }

    .colMeta { font-size: 9.2pt; color: #222; }
    .metaLine1 {
      display: flex;
      align-items: center;
      gap: 2mm;
    }
    .metaText {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
      flex: 1;
    }

    .dot {
      width: 4mm;
      height: 4mm;
      border-radius: 999px;
      box-sizing: border-box;
      flex: 0 0 auto;
    }
    .dot.fill { border: 0.2mm solid rgba(0,0,0,0.25); }
    .dot.empty { background: transparent; border: 0.2mm solid #aaa; }

    .empty {
      padding: 3mm 2mm;
      opacity: .7;
    }
    ${this._pdfCopyrightStyle()}
  </style>
</head>

<body class="closed" style="--logoTop:${pdfLogoTopMm}mm; --logoHeight:${pdfLogoHeightMm}mm; --headerH:${pdfLogoTopMm + pdfLogoHeightMm + 5}mm;">
  <div class="pageHeader" aria-hidden="true">
    ${pdfLogoHtml}
    <div class="topRuleFixed"></div>
  </div>
  ${this._pdfCopyrightHtml()}
  <div class="page">
    <div class="page1">
      <div class="projLabel">Projekt:</div>
      <div class="projLine">${this._escapeHtml(projectLine)}</div>
      <div class="meetingLine">Top-Liste (alle)</div>
      <div class="meetingMetaLine">${meeting ? meetingLine : ""}</div>
    </div>

    <table class="tops">
      <colgroup>
        <col class="wNr" />
        <col class="wText" />
        <col class="wMeta" />
      </colgroup>
      <thead>
        <tr class="topsHeadPad"><th colspan="3"></th></tr>
        <tr class="hdr">
          <th class="wNr">Nr.</th>
          <th class="wText">
            <div class="hdrTop">
              <div class="hdrTitle">Titel</div>
              <div class="hdrTops">TOPs</div>
            </div>
          </th>
          <th class="wMeta metaHdr">
            <div>Fertig bis</div>
            <div>Status</div>
            <div>verantwortlich</div>
          </th>
        </tr>
      </thead>

      <tbody>
        ${
          rowsHtml ||
          `<tr><td colspan="3" style="padding:3mm 2mm; opacity:.7;">Keine TOPs vorhanden.</td></tr>`
        }
      </tbody>
    </table>
  </div>
  <script>
    (function () {
      const measureMm = () => {
        const probe = document.createElement("div");
        probe.style.position = "absolute";
        probe.style.left = "-10000px";
        probe.style.top = "-10000px";
        probe.style.width = "100mm";
        probe.style.height = "1px";
        document.body.appendChild(probe);
        const px = probe.getBoundingClientRect().width / 100;
        probe.remove();
        return px || 3.78;
      };

      const getLines = (row, lineHeight, longMarginTop) => {
        const block = row.querySelector(".txtBlock");
        if (!block) return 1;
        const h = block.getBoundingClientRect().height;
        const effective = Math.max(0, h - longMarginTop);
        return Math.max(1, Math.round(effective / lineHeight));
      };

      const applyPagination = () => {
        const table = document.querySelector("table.tops");
        if (!table) return;
        const tbody = table.querySelector("tbody");
        const thead = table.querySelector("thead");
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll("tr.topRow"));
        if (!rows.length) return;

        rows.forEach((r) => {
          r.classList.remove("breakBefore", "allowSplit");
          r.removeAttribute("data-keep-prev");
        });

        const mmPx = measureMm();
        const pageHeight = 297 * mmPx;
        const footerReserve = 15 * mmPx;
        const headHeight = thead ? thead.getBoundingClientRect().height : 0;
        const pageTbodyHeight = pageHeight - footerReserve - headHeight;

        const longSample = tbody.querySelector(".long");
        const lineHeight = longSample
          ? parseFloat(getComputedStyle(longSample).lineHeight) || 14
          : 14;
        const longMarginTop = longSample
          ? parseFloat(getComputedStyle(longSample).marginTop) || 0
          : 0;

        const tbodyTop = tbody.getBoundingClientRect().top + window.scrollY;
        const pageStart = Math.floor(tbodyTop / pageHeight) * pageHeight;
        let remaining = pageHeight - footerReserve - (tbodyTop - pageStart);
        if (!Number.isFinite(remaining) || remaining <= 0) remaining = pageTbodyHeight;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row.getAttribute("data-keep-prev") === "1") {
            const lines = getLines(row, lineHeight, longMarginTop);
            if (lines >= 6) row.classList.add("allowSplit");
            remaining -= row.getBoundingClientRect().height;
            if (remaining < 0) remaining = pageTbodyHeight - row.getBoundingClientRect().height;
            continue;
          }

          const level = Number(row.getAttribute("data-level") || "1");
          if (level === 1) {
            let nextIdx = -1;
            for (let j = i + 1; j < rows.length; j++) {
              const lvl = Number(rows[j].getAttribute("data-level") || "1");
              if (lvl === 2) {
                nextIdx = j;
                break;
              }
              if (lvl === 1) break;
            }
            if (nextIdx !== -1) {
              const nextRow = rows[nextIdx];
              const groupHeight =
                row.getBoundingClientRect().height + nextRow.getBoundingClientRect().height;
              if (remaining < groupHeight) {
                row.classList.add("breakBefore");
                remaining = pageTbodyHeight;
              }
              remaining -= row.getBoundingClientRect().height;
              nextRow.setAttribute("data-keep-prev", "1");
              continue;
            }
          }

          const lines = getLines(row, lineHeight, longMarginTop);
          const allowSplit = lines >= 6;
          if (allowSplit) row.classList.add("allowSplit");

          const minLinesPx = 3 * lineHeight;
          if (remaining < minLinesPx) {
            row.classList.add("breakBefore");
            remaining = pageTbodyHeight;
          }

          const rowHeight = row.getBoundingClientRect().height;
          if (!allowSplit && rowHeight > remaining) {
            row.classList.add("breakBefore");
            remaining = pageTbodyHeight;
          }

          if (rowHeight <= remaining) {
            remaining -= rowHeight;
          } else if (allowSplit) {
            let overflow = rowHeight - remaining;
            if (overflow > 0) {
              const fullPages = Math.floor(overflow / pageTbodyHeight);
              overflow -= fullPages * pageTbodyHeight;
              remaining = pageTbodyHeight - overflow;
              if (overflow === 0) remaining = 0;
            }
          } else {
            remaining -= rowHeight;
          }
        }
      };

      const run = () => applyPagination();
      window.addEventListener("load", () => {
        setTimeout(run, 0);
        requestAnimationFrame(run);
      });
    })();
  </script>
</body>
</html>
    `.trim();

    return html;
  }

  _buildFirmsPrintHtml({
    projectLabel,
    localFirms,
    globalFirms,
    localPeopleByFirm,
    globalPeopleByFirm,
    roleLabels,
    roleOrder,
    settings,
  } = {}) {
    const proj = (projectLabel || "").trim() || "?";

    const userName = String(settings?.user_name || "").trim();
    const userCompany = String(settings?.user_company || "").trim();

    const pdfLogoDefaults = {
      enabled: true,
      widthMm: 35,
      topMm: 8,
      rightMm: 8,
    };

    const pdfLogoEnabled = this._parseBool(settings?.["pdf.userLogoEnabled"], pdfLogoDefaults.enabled);
    const pdfLogoWidthMm = this._clampNumber(
      settings?.["pdf.userLogoWidthMm"],
      10,
      60,
      pdfLogoDefaults.widthMm
    );
    const pdfLogoTopMm = this._clampNumber(settings?.["pdf.userLogoTopMm"], 0, 30, pdfLogoDefaults.topMm);
    const pdfLogoRightMm = this._clampNumber(
      settings?.["pdf.userLogoRightMm"],
      0,
      30,
      pdfLogoDefaults.rightMm
    );
    const pdfLogoDataUrl = String(settings?.["pdf.userLogoPngDataUrl"] || "").trim();

    const pdfLogoPos = `top:${pdfLogoTopMm}mm; right:${pdfLogoRightMm}mm; width:${pdfLogoWidthMm}mm;`;
    const pdfLogoDummyHeightMm = Math.max(12, Math.round(pdfLogoWidthMm * 0.5));

    const pdfLogoHtml = !pdfLogoEnabled
      ? ""
      : pdfLogoDataUrl
        ? `<img class="pdfLogo" src="${pdfLogoDataUrl}" style="${pdfLogoPos} height:auto;" />`
        : `<div class="pdfLogo pdfLogoDummy" style="${pdfLogoPos} height:${pdfLogoDummyHeightMm}mm;">Hier koennte Ihr Logo sein</div>`;

    const rightLine1 = this._escapeHtml(userName || "?");
    const rightLine2 = this._escapeHtml(userCompany || "?");

    const locals = Array.isArray(localFirms) ? localFirms : [];
    const globals = Array.isArray(globalFirms) ? globalFirms : [];
    const allFirms = this._sortFirmsByRoleAndName([...locals, ...globals], roleOrder);

    const byRole = new Map();
    for (const f of allFirms) {
      const rc = Number(f?.role_code || 60);
      const arr = byRole.get(rc) || [];
      arr.push(f);
      byRole.set(rc, arr);
    }

    const allRoleCodes = [...byRole.keys()];
    const baseOrder =
      Array.isArray(roleOrder) && roleOrder.length ? roleOrder : this._defaultRoleOrder();
    const orderedCodes = [...baseOrder];
    const extras = allRoleCodes.filter((c) => !orderedCodes.includes(c));
    extras.sort((a, b) => a - b);
    for (const c of extras) orderedCodes.push(c);

    const buildFirmBlock = (f) => {
      const firmLabel = this._firmLabel(f);
      const name2 = String(f?.name2 || "").trim();
      const street = String(f?.street || "").trim();
      const zip = String(f?.zip || "").trim();
      const city = String(f?.city || "").trim();
      const place = [zip, city].filter((x) => !!x).join(" ");

      const email = String(f?.email || "").trim();
      const phone = String(f?.phone || "").trim();
      const funk = String(f?.funk || "").trim();

      const peopleMap = localPeopleByFirm?.has(f.id) ? localPeopleByFirm : globalPeopleByFirm;
      const people = peopleMap?.get(f.id) || [];
      const peopleRows = (people || [])
        .map((p) => {
          const name = String(p?.name || "").trim();
          const rolle = String(p?.rolle || "").trim();
          const funkP = String(p?.funk || "").trim();
          const emailP = String(p?.email || "").trim();
          if (!name && !rolle && !funkP && !emailP) return "";
          return `
            <div class="personRow">
              <div class="pName">${this._escapeHtml(name)}</div>
              <div class="pRole">${this._escapeHtml(rolle)}</div>
              <div class="pFunk">${this._escapeHtml(funkP)}</div>
              <div class="pEmail">${this._escapeHtml(emailP)}</div>
            </div>
          `;
        })
        .filter((x) => !!x)
        .join("");

      const peopleBlock = `
        <div class="people">
          <div class="peopleTitle">Vertreter</div>
          <div class="peopleList">${peopleRows}</div>
        </div>
      `;

      const leftLines = [firmLabel, name2, street, place].filter((x) => !!x);

      return `
        <div class="firmBlock">
          <div class="firmRow">
            <div class="firmLeft">
              ${leftLines.map((l) => `<div class="line">${this._escapeHtml(l)}</div>`).join("")}
            </div>
            <div class="firmRight">
              <div class="kv"><div class="k">E-Mail</div><div class="v">${this._escapeHtml(email)}</div></div>
              <div class="kv"><div class="k">Tel</div><div class="v">${this._escapeHtml(phone)}</div></div>
              <div class="kv"><div class="k">Funk</div><div class="v">${this._escapeHtml(funk)}</div></div>
            </div>
          </div>
          ${peopleBlock}
        </div>
      `;
    };

    const sectionsHtml = orderedCodes
      .map((code) => {
        const list = byRole.get(code) || [];
        if (!list.length) return "";
        const catLabel =
          (roleLabels && (roleLabels[code] || roleLabels[String(code)])) || `Kategorie ${code}`;
        return `
          <div class="catBlock">
            <div class="catTitle">${this._escapeHtml(catLabel)}</div>
            ${list.map((f) => buildFirmBlock(f)).join("")}
          </div>
        `;
      })
      .join("");

    const bodyHtml = sectionsHtml || `<div class="empty">Keine Projektfirmen vorhanden.</div>`;

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>BBM Firmenliste</title>
  <style>
    @page { size: A4; margin: 0 10mm 8mm 19mm; }

    :root{
      --sepW: 0.25pt;
      --sepC: #000000;
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Calibri, Arial, sans-serif;
      font-size: 10.5pt;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .pdfLogo {
      position: fixed;
      z-index: 9999;
    }

    .pdfLogoDummy {
      background: #f0f0f0;
      border: 0.2mm solid #bbb;
      color: #666;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 8.5pt;
      padding: 1mm;
      box-sizing: border-box;
    }

    .page { position: relative; z-index: 1; }

    .pdfHeader {
      display: grid;
      grid-template-columns: 1fr 70mm;
      gap: 8mm;
      align-items: start;
      margin: 0 0 6mm 0;
    }

    .hLeft .proj {
      font-weight: 800;
      font-size: 13pt;
      margin: 0 0 1.5mm 0;
      color: #111;
    }
    .hLeft .meet {
      font-weight: 700;
      font-size: 11pt;
      margin: 0 0 1mm 0;
      color: #111;
    }

    .hRight {
      text-align: right;
      font-size: 10pt;
      color: #222;
      line-height: 1.25;
      white-space: normal;
    }

    .catBlock {
      margin-bottom: 6mm;
      padding-bottom: 3mm;
      border-bottom: var(--sepW) solid var(--sepC);
    }
    .catBlock:last-child { border-bottom: none; }
    .catTitle {
      font-weight: 700;
      font-size: 10pt;
      margin: 0 0 2mm 0;
    }

    .firmBlock {
      border: var(--sepW) solid var(--sepC);
      padding: 2.5mm 2.5mm;
      margin: 0 0 2.2mm 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .firmRow {
      display: grid;
      grid-template-columns: 1fr 58mm;
      gap: 6mm;
      align-items: start;
    }

    .firmLeft .line {
      line-height: 1.25;
      margin-bottom: 0.6mm;
    }
    .firmLeft .line:first-child {
      font-weight: 700;
    }
    .firmLeft .line:last-child { margin-bottom: 0; }

    .firmRight {
      display: grid;
      gap: 1.2mm;
    }

    .kv {
      display: grid;
      grid-template-columns: 14mm 1fr;
      gap: 2mm;
      align-items: baseline;
    }
    .kv .k {
      font-weight: 700;
      color: #333;
    }
    .kv .v {
      color: #111;
      word-break: break-word;
    }

    .people {
      margin-top: 2mm;
      padding-top: 1.5mm;
      border-top: var(--sepW) solid var(--sepC);
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .peopleTitle {
      font-weight: 700;
      font-size: 9.6pt;
      margin-bottom: 1.2mm;
    }
    .peopleList {
      display: grid;
      gap: 1mm;
    }
    .personRow {
      display: grid;
      grid-template-columns: 25% calc(25% - 15mm) 25% calc(25% + 15mm);
      gap: 2mm;
      align-items: start;
      text-align: left;
    }
    .personRow > div {
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
    }
    .pName { font-weight: 600; }

    .empty {
      padding: 3mm 2mm;
      opacity: .7;
    }
    ${this._pdfCopyrightStyle()}
  </style>
</head>
<body class="closed">
  ${pdfLogoHtml}
  ${this._pdfCopyrightHtml()}
  <div class="page">
    <div class="pdfHeader">
      <div class="hLeft">
        <div class="proj">${this._escapeHtml(proj)}</div>
        <div class="meet">Firmenliste</div>
      </div>
      <div class="hRight">
        <div>${rightLine1}</div>
        <div>${rightLine2}</div>
      </div>
    </div>

    ${bodyHtml}
  </div>
</body>
</html>
    `.trim();

    return html;
  }

  // ============================================================
  // Printing
  // ============================================================

  async _printSelected() {
    if (this.printing) return;

    const meetingId = this.selectedMeetingId || null;
    if (!meetingId) return;

    await this._printMeeting({
      projectId: this.projectId || this.router?.currentProjectId || null,
      meetingId,
      allowOpen: false, // Modal: nur geschlossen
      mode: "closed",
      closeModalAfter: true,
      preview: true,
    });
  }

  async _printMeeting({ projectId, meetingId, allowOpen, mode, closeModalAfter, preview } = {}) {
    if (this.printing) return;

    const api = window.bbmDb || {};

    if (typeof api.topsListByMeeting !== "function") {
      alert("topsListByMeeting ist nicht verf?gbar (Preload/IPC fehlt).");
      return;
    }
    if (typeof api.meetingParticipantsList !== "function") {
      alert("meetingParticipantsList ist nicht verf?gbar (Preload/IPC fehlt).");
      return;
    }
    if (typeof api.printHtmlToPdf !== "function") {
      alert("printHtmlToPdf ist nicht verf?gbar (Preload/IPC fehlt).");
      return;
    }

    this.printing = true;
    this._setMsg("Erzeuge PDF?");
    this._applyState();

    const doPreview = !!preview;
    if (doPreview) {
      this._ensurePreviewDom();
      this._setPreviewLoading(true);
    }

    try {
      if (this.router?.ensureAppSettingsLoaded) {
        await this.router.ensureAppSettingsLoaded({ force: false });
      }

      let settings = this.router?.context?.settings || {};
      const protocolsDir = String(settings?.["pdf.protocolsDir"] || "").trim();
      if (typeof api.appSettingsGetMany === "function") {
        const resNext = await api.appSettingsGetMany([
          "print.nextMeeting.enabled",
          "print.nextMeeting.date",
          "print.nextMeeting.time",
          "print.nextMeeting.place",
          "print.nextMeeting.extra",
        ]);
        if (resNext?.ok) {
          settings = { ...settings, ...(resNext.data || {}) };
        }
      }
      if (this._nextMeetingOverride) {
        settings = { ...settings, ...this._nextMeetingOverride };
        this._nextMeetingOverride = null;
      }

      const res = await api.topsListByMeeting(meetingId);
      if (!res?.ok) {
        alert(res?.error || "Fehler beim Laden der TOPs");
        return;
      }

      const meeting = res.meeting || null;
      if (!meeting) {
        alert("Besprechung nicht gefunden.");
        return;
      }

      const isClosed = Number(meeting.is_closed) === 1;
      if (!allowOpen && !isClosed) {
        alert("Diese Besprechung ist nicht geschlossen. Druck nur für geschlossene Besprechungen.");
        return;
      }

      // Vorabzug nur wenn wirklich offen UND mode=vorabzug
      const isVorabzug = !isClosed && mode === "vorabzug";

      // Projektnummer/Label: direkt aus DB holen
      const pid = projectId || meeting.project_id || this.router?.currentProjectId || null;
      const projectLabel = await this._getProjectLabelWithNumber(pid);
      const meetingLabel = this._buildMeetingLabel(meeting);
      const projectInfo = await this._getProjectInfo(pid);
      const projectNumber = projectInfo.number || (pid || "");
      const protocolNameRaw = String(settings?.["pdf.protocolTitle"] || "").trim();
      const protocolName = this._sanitizeFileSegment(protocolNameRaw || "Baubesprechung");
      const meetingNr =
        meeting?.meeting_index ?? meeting?.meetingIndex ?? meeting?.index ?? meeting?.number ?? "";
      const meetingDateRaw =
        meeting?.meeting_date ||
        meeting?.meetingDate ||
        meeting?.date ||
        meeting?.created_at ||
        meeting?.createdAt ||
        meeting?.updated_at ||
        meeting?.updatedAt ||
        null;
      const meetingDateStr = this._formatDateForFile(meetingDateRaw || new Date());

      const resP = await api.meetingParticipantsList({ meetingId });
      if (!resP?.ok) {
        alert(resP?.error || "Fehler beim Laden der Teilnehmer");
        return;
      }
      const participants = resP.list || resP.items || [];

      const pdfLogoDefaults = {
        enabled: true,
        widthMm: 35,
        topMm: 8,
        rightMm: 8,
      };
      const pdfLogoEnabled = this._parseBool(settings?.["pdf.userLogoEnabled"], pdfLogoDefaults.enabled);
      const pdfLogoWidthMm = this._clampNumber(
        settings?.["pdf.userLogoWidthMm"],
        10,
        60,
        pdfLogoDefaults.widthMm
      );
      const pdfLogoDataUrl = String(settings?.["pdf.userLogoPngDataUrl"] || "").trim();
      const pdfLogoDummyHeightMm = Math.max(12, Math.round(pdfLogoWidthMm * 0.5));
      const logoHeightMm = await this._calcLogoHeightMm({
        enabled: pdfLogoEnabled,
        dataUrl: pdfLogoDataUrl,
        widthMm: pdfLogoWidthMm,
        dummyHeightMm: pdfLogoDummyHeightMm,
      });

      const tops = res.list || [];
      const html = this._buildPrintHtml({
        projectLabel,
        meeting,
        tops,
        participants,
        settings,
        mode: isVorabzug ? "vorabzug" : "closed",
        logoHeightMm,
      });

      const suffix = isVorabzug ? " VORABZUG" : "";
      const fn = isVorabzug
        ? this._sanitizeFileName(`BBM ${projectLabel || ""} ${meetingLabel}${suffix}`) + ".pdf"
        : this._sanitizeFileName(
            `${projectNumber}_${protocolName}_#${meetingNr}-${meetingDateStr}`
          ) + ".pdf";

      const out = await api.printHtmlToPdf({
        html,
        fileName: fn,
        bbmVersion: "1.0",
        ...(isVorabzug && doPreview ? { targetDir: "temp" } : {}),
        ...(isVorabzug
          ? {}
          : {
              baseDir: protocolsDir,
              projectNumber,
              overwrite: true,
            }),
      });
      if (!out?.ok) {
        alert(out?.error || "PDF-Erzeugung fehlgeschlagen");
        return;
      }

      if (doPreview) {
        if (!out?.filePath) {
          console.error("[PrintModal] Preview ohne Datei-Pfad", out);
          alert("Vorschau konnte nicht geladen werden (kein Dateipfad)." );
          return;
        }
        const title = isVorabzug ? "Vorabzug (Vorschau)" : "Protokoll (Vorschau)";
        this._openPreview({ filePath: out.filePath, title });
      } else {
        alert(`PDF gespeichert:\n${out.filePath || "(Pfad unbekannt)"}`);
      }

      if (closeModalAfter) {
        this.close();
      }
    } catch (err) {
      console.error("[PrintModal] _printMeeting failed", {
        projectId,
        meetingId,
        allowOpen: !!allowOpen,
        mode,
        closeModalAfter: !!closeModalAfter,
        preview: !!preview,
        message: err?.message || String(err),
        stack: err?.stack || null,
      });
      alert(`Druck fehlgeschlagen: ${err?.message || String(err)}`);
    } finally {
      if (doPreview) this._setPreviewLoading(false);
      this.printing = false;
      this._setMsg("");
      this._applyState();
    }
  }
}
