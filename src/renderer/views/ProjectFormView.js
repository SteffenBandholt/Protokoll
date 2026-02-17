// src/renderer/views/ProjectFormView.js
//
// Projekt anlegen / bearbeiten
// - Projektnummer (project_number) ist Pflicht? -> NEIN (optional), aber wird gespeichert
// - Speichern: create oder update über IPC
// - Danach zurück zu ProjectsView

import { applyPopupButtonStyle } from "../ui/popupButtonStyles.js";

export default class ProjectFormView {
  constructor({ router, projectId, mode = "page", onClose, onSaved } = {}) {
    this.router = router;
    this.projectId = projectId || null;

    this.mode = mode || "page";
    this.isModal = this.mode === "modal";
    this.onClose = typeof onClose === "function" ? onClose : null;
    this.onSaved = typeof onSaved === "function" ? onSaved : null;

    this.root = null;
    this.msgEl = null;

    this.overlayEl = null;
    this.modalEl = null;
    this.modalBodyEl = null;
    this.modalFooterEl = null;
    this.modalTitleEl = null;
    this.modalMsgEl = null;
    this.btnModalClose = null;
    this.btnModalCancel = null;

    this.busy = false;
    this.loaded = false;
    this.project = null;

    // inputs
    this.inpName = null;
    this.inpProjectNumber = null;

    this.inpShort = null;
    this.inpStreet = null;
    this.inpZip = null;
    this.inpCity = null;

    this.inpLead = null;
    this.inpLeadPhone = null;

    this.inpStart = null;
    this.inpEnd = null;

    this.taNotes = null;

    // buttons
    this.btnSave = null;
    this.btnClose = null;
    this.btnArchive = null;
    this.btnFirmsPdf = null;
  }

  _setMsg(t) {
    const text = t || "";
    if (this.msgEl) this.msgEl.textContent = text;
    if (this.modalMsgEl) this.modalMsgEl.textContent = text;
  }

  _normText(v) {
    const s = v !== undefined && v !== null ? String(v).trim() : "";
    return s ? s : null;
  }

  _normName(v) {
    const s = v !== undefined && v !== null ? String(v).trim() : "";
    return s ? s : "";
  }

  _setBusy(on) {
    this.busy = !!on;

    try {
      if (this.router) {
        this.router.context = this.router.context || {};
        this.router.context.ui = this.router.context.ui || {};
        this.router.context.ui.stickyNotice = this.busy
          ? "Debug: Projektformular ist gesperrt (busy=true)."
          : "";
        this.router.refreshHeader?.();
      }

      window.dispatchEvent(
        new CustomEvent("bbm:sticky-notice", {
          detail: {
            message: this.busy
              ? "Debug: Projektformular ist gesperrt (busy=true)."
              : "",
          },
        })
      );
    } catch (_e) {
      // ignore
    }

    const dis = this.busy;

    const els = [
      this.inpName,
      this.inpProjectNumber,
      this.inpShort,
      this.inpStreet,
      this.inpZip,
      this.inpCity,
      this.inpLead,
      this.inpLeadPhone,
      this.inpStart,
      this.inpEnd,
      this.taNotes,
      this.btnSave,
      this.btnClose,
      this.btnFirmsPdf,
      this.btnArchive,
      this.btnModalCancel,
      this.btnModalClose,
    ];

    for (const el of els) {
      if (!el) continue;
      el.disabled = dis;
      el.style.opacity = dis ? "0.7" : "1";
    }

    if (this.btnSave) this.btnSave.style.cursor = dis ? "default" : "pointer";
    if (this.btnClose) this.btnClose.style.cursor = dis ? "default" : "pointer";
    if (this.btnArchive) this.btnArchive.style.cursor = dis ? "default" : "pointer";
    if (this.btnModalCancel) this.btnModalCancel.style.cursor = dis ? "default" : "pointer";
    if (this.btnModalClose) this.btnModalClose.style.cursor = dis ? "default" : "pointer";

    // Archiv-Button zusätzlich: bei Neuanlage immer deaktiviert
    if (this.btnFirmsPdf) {
      const canPrint = !!this.projectId && !this.busy;
      this.btnFirmsPdf.disabled = !canPrint;
      this.btnFirmsPdf.style.opacity = canPrint ? "1" : "0.5";
      this.btnFirmsPdf.style.cursor = canPrint ? "pointer" : "default";
    }
    if (this.btnArchive) {
      const canArchive = !!this.projectId && !this.busy;
      this.btnArchive.disabled = !canArchive;
      this.btnArchive.style.opacity = canArchive ? "1" : "0.5";
      this.btnArchive.style.cursor = canArchive ? "pointer" : "default";
    }
  }

  _fill(p) {
    const proj = p || {};

    if (this.inpName) this.inpName.value = (proj.name || "").toString();
    if (this.inpProjectNumber)
      this.inpProjectNumber.value = (proj.project_number ?? proj.projectNumber ?? "").toString();

    if (this.inpShort) this.inpShort.value = (proj.short || "").toString();
    if (this.inpStreet) this.inpStreet.value = (proj.street || "").toString();
    if (this.inpZip) this.inpZip.value = (proj.zip || "").toString();
    if (this.inpCity) this.inpCity.value = (proj.city || "").toString();

    if (this.inpLead) this.inpLead.value = (proj.project_lead || "").toString();
    if (this.inpLeadPhone) this.inpLeadPhone.value = (proj.project_lead_phone || "").toString();

    if (this.inpStart) this.inpStart.value = (proj.start_date || "").toString().slice(0, 10);
    if (this.inpEnd) this.inpEnd.value = (proj.end_date || "").toString().slice(0, 10);

    if (this.taNotes) this.taNotes.value = (proj.notes || "").toString();
  }

  _collectPayload() {
    const name = this._normName(this.inpName?.value);
    const project_number = this._normText(this.inpProjectNumber?.value);

    const payload = {
      name,
      project_number,

      short: this._normText(this.inpShort?.value),
      street: this._normText(this.inpStreet?.value),
      zip: this._normText(this.inpZip?.value),
      city: this._normText(this.inpCity?.value),

      project_lead: this._normText(this.inpLead?.value),
      project_lead_phone: this._normText(this.inpLeadPhone?.value),

      start_date: this._normText(this.inpStart?.value),
      end_date: this._normText(this.inpEnd?.value),

      notes: this._normText(this.taNotes?.value),
    };

    return payload;
  }

  async _closeToProjects() {
    if (this.busy) return;
    await this.router.showProjects();
  }

  async _archive() {
    if (this.busy) return;
    if (!this.projectId) return;

    const api = window.bbmDb || {};
    if (typeof api.projectsArchive !== "function") {
      alert("projectsArchive ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }

    this._setBusy(true);
    this._setMsg("Archiviere...");

    try {
      const res = await api.projectsArchive(this.projectId);
      if (!res?.ok) {
        alert(res?.error || "Archivieren fehlgeschlagen");
        return;
      }

      // nach Archivieren direkt zurück zu ProjectsView
      this.router.currentProjectId = null;
      this.router.currentMeetingId = null;

      if (this.isModal) {
        this._closeModal();
        await this._notifySaved();
        return;
      }

      await this.router.showProjects();
    } finally {
      this._setMsg("");
      this._setBusy(false);
    }
  }

  async _save() {
    if (this.busy) return;

    const api = window.bbmDb || {};
    if (typeof api.projectsCreate !== "function" || typeof api.projectsUpdate !== "function") {
      alert("projectsCreate/projectsUpdate ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }

    const payload = this._collectPayload();

    if (!payload.name) {
      alert("Name/Bezeichnung ist Pflicht.");
      this.inpName?.focus();
      return;
    }

    this._setBusy(true);
    this._setMsg("Speichere...");

    try {
      if (!this.projectId) {
        // CREATE
        const res = await api.projectsCreate(payload);
        if (!res?.ok) {
          alert(res?.error || "Anlegen fehlgeschlagen");
          return;
        }

        const created = res.project || null;
        const newId = created?.id || null;

        // Router-Kontext sauber setzen
        this.router.currentProjectId = newId || null;
        this.router.currentMeetingId = null;

        if (this.isModal) {
          this._closeModal();
          await this._notifySaved();
          return;
        }

        await this.router.showProjects();
        return;
      }

      // UPDATE
      const res = await api.projectsUpdate({
        projectId: this.projectId,
        patch: payload,
      });

      if (!res?.ok) {
        alert(res?.error || "Speichern fehlgeschlagen");
        return;
      }

      this.router.currentProjectId = this.projectId;
      this.router.currentMeetingId = null;

      if (this.isModal) {
        this._closeModal();
        await this._notifySaved();
        return;
      }

      await this.router.showProjects();
    } finally {
      this._setMsg("");
      this._setBusy(false);
    }
  }

  _buildFormContent() {
    const root = document.createElement("div");
    root.style.maxWidth = "900px";
    root.style.width = "100%";
    root.style.boxSizing = "border-box";
    root.style.margin = "0 auto";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.marginBottom = this.isModal ? "0" : "10px";

    const h = document.createElement("h2");
    h.textContent = this.projectId ? "Projekt bearbeiten" : "Projekt anlegen";
    h.style.margin = "0";
    h.style.fontSize = "22px";
    h.style.fontWeight = "700";

    const msg = document.createElement("div");
    msg.style.marginLeft = "auto";
    msg.style.fontSize = "12px";
    msg.style.opacity = "0.85";

    header.append(h, msg);
    if (this.isModal) header.style.display = "none";

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const applyWidthFromMaxLength = (
      el,
      { fallback = 24, min = 10, max = 50, padding = 1 } = {}
    ) => {
      const raw = Number(el?.maxLength);
      const source = Number.isFinite(raw) && raw > 0 ? raw : fallback;
      const widthCh = clamp(source + padding, min, max);
      el.style.width = `${widthCh}ch`;
      el.style.maxWidth = "100%";
    };

    const mkLbl = (t) => {
      const d = document.createElement("div");
      d.textContent = t;
      d.style.opacity = "0.9";
      d.style.fontSize = "12px";
      d.style.fontWeight = "600";
      d.style.lineHeight = "1.2";
      return d;
    };

    const mkField = (labelText, inputEl, { grow = true } = {}) => {
      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.gap = "5px";
      wrap.style.flex = grow ? "1 1 0" : "0 1 auto";
      wrap.style.minWidth = "0";
      wrap.append(mkLbl(labelText), inputEl);
      return wrap;
    };

    const mkRow = (mt) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "10px";
      row.style.alignItems = "flex-end";
      row.style.flexWrap = "wrap";
      if (mt) row.style.marginTop = mt;
      return row;
    };

    const mkInp = (type = "text") => {
      const i = document.createElement("input");
      i.type = type;
      i.style.padding = "7px 9px";
      i.style.borderRadius = "8px";
      i.style.border = "1px solid #ddd";
      i.style.boxSizing = "border-box";
      i.style.fontSize = "13px";
      i.style.minHeight = "34px";
      return i;
    };

    const mkTa = () => {
      const t = document.createElement("textarea");
      t.rows = 4;
      t.style.padding = "7px 9px";
      t.style.borderRadius = "8px";
      t.style.border = "1px solid #ddd";
      t.style.boxSizing = "border-box";
      t.style.resize = "vertical";
      t.style.fontSize = "13px";
      t.style.minHeight = "120px";
      return t;
    };

    const inpName = mkInp("text");
    inpName.placeholder = "Bezeichnung / Name";
    inpName.required = true;
    inpName.maxLength = 50;
    applyWidthFromMaxLength(inpName, { fallback: 40, min: 28, max: 52 });

    // Projektnummer
    const inpProjectNumber = mkInp("text");
    inpProjectNumber.placeholder = "z.B. 24-017";
    inpProjectNumber.maxLength = 10;
    applyWidthFromMaxLength(inpProjectNumber, { fallback: 10, min: 9, max: 14 });

    const inpShort = mkInp("text");
    inpShort.placeholder = "Kurzbezeichnung";
    inpShort.maxLength = 20;
    applyWidthFromMaxLength(inpShort, { fallback: 20, min: 16, max: 24 });

    const inpStreet = mkInp("text");
    inpStreet.placeholder = "Straße";
    inpStreet.maxLength = 50;
    applyWidthFromMaxLength(inpStreet, { fallback: 40, min: 26, max: 52 });

    const inpZip = mkInp("text");
    inpZip.placeholder = "PLZ";
    inpZip.maxLength = 10;
    applyWidthFromMaxLength(inpZip, { fallback: 10, min: 9, max: 14 });

    const inpCity = mkInp("text");
    inpCity.placeholder = "Ort";
    inpCity.maxLength = 40;
    applyWidthFromMaxLength(inpCity, { fallback: 30, min: 20, max: 42 });

    const inpLead = mkInp("text");
    inpLead.placeholder = "Projektleiter";
    inpLead.maxLength = 25;
    applyWidthFromMaxLength(inpLead, { fallback: 25, min: 18, max: 30 });

    const inpLeadPhone = mkInp("text");
    inpLeadPhone.placeholder = "Telefon";
    inpLeadPhone.maxLength = 20;
    applyWidthFromMaxLength(inpLeadPhone, { fallback: 20, min: 14, max: 24 });

    const inpStart = mkInp("date");
    const inpEnd = mkInp("date");
    applyWidthFromMaxLength(inpStart, { fallback: 12, min: 12, max: 16 });
    applyWidthFromMaxLength(inpEnd, { fallback: 12, min: 12, max: 16 });

    const taNotes = mkTa();
    taNotes.placeholder = "Notizen";
    applyWidthFromMaxLength(taNotes, { fallback: 34, min: 22, max: 42 });

    const row0 = mkRow();
    row0.append(mkField("Bezeichnung *", inpName, { grow: false }));

    const row1 = mkRow();
    const fieldProjectNumber = mkField("Projektnummer", inpProjectNumber, { grow: false });
    const fieldShort = mkField("Kurzbez.", inpShort, { grow: false });
    row1.append(fieldProjectNumber, fieldShort);

    const row2 = mkRow();
    row2.append(mkField("Straße", inpStreet, { grow: false }));

    const row3 = mkRow();
    const fieldZip = mkField("PLZ", inpZip, { grow: false });
    const fieldCity = mkField("Ort", inpCity, { grow: false });
    row3.append(fieldZip, fieldCity);

    const row4 = mkRow();
    const fieldLead = mkField("Projektleiter", inpLead, { grow: false });
    const fieldLeadPhone = mkField("PL-Handy", inpLeadPhone, { grow: false });
    row4.append(fieldLead, fieldLeadPhone);

    const row5 = mkRow();
    const fieldEnd = mkField("Enddatum", inpEnd, { grow: false });
    row5.append(mkField("Startdatum", inpStart, { grow: false }), fieldEnd);

    const row6 = mkRow();
    row6.append(mkField("Notizen", taNotes, { grow: false }));

    const leftCol = document.createElement("div");
    leftCol.style.minWidth = "0";
    leftCol.style.display = "flex";
    leftCol.style.flexDirection = "column";
    leftCol.style.gap = "10px";
    leftCol.style.paddingRight = "4px";
    leftCol.append(row0, row1, row2, row3);

    const rightCol = document.createElement("div");
    rightCol.style.minWidth = "0";
    rightCol.style.display = "flex";
    rightCol.style.flexDirection = "column";
    rightCol.style.gap = "10px";
    rightCol.style.paddingLeft = "4px";
    rightCol.append(row4, row5, row6);

    const separator = document.createElement("div");
    separator.style.width = "1px";
    separator.style.background = "rgba(0,0,0,0.16)";
    separator.style.alignSelf = "stretch";
    separator.style.marginTop = "2px";
    separator.style.marginBottom = "2px";

    const form = document.createElement("div");
    form.style.display = "grid";
    form.style.gridTemplateColumns = "minmax(0, 1fr) 1px minmax(0, 1fr)";
    form.style.columnGap = "14px";
    form.style.alignItems = "stretch";
    form.style.width = "100%";
    form.style.minWidth = "0";
    form.style.boxSizing = "border-box";
    form.append(leftCol, separator, rightCol);

    const formCard = document.createElement("div");
    formCard.style.border = "1px solid #e5e7eb";
    formCard.style.borderRadius = "10px";
    formCard.style.padding = "12px";
    formCard.style.width = "100%";
    formCard.style.boxSizing = "border-box";
    formCard.style.overflow = "hidden";
    formCard.style.background = "#fff";
    formCard.append(form);

    // Enter in inputs => Save
    const enterToSave = (e) => {
      if (e.key !== "Enter") return;
      if (e.target === taNotes) return;
      e.preventDefault();
      this._save();
    };

    for (const el of [
      inpName,
      inpProjectNumber,
      inpShort,
      inpStreet,
      inpZip,
      inpCity,
      inpLead,
      inpLeadPhone,
      inpStart,
      inpEnd,
    ]) {
      el.addEventListener("keydown", enterToSave);
    }

    root.append(header, formCard);

    this.root = root;
    this.msgEl = msg;

    this.inpName = inpName;
    this.inpProjectNumber = inpProjectNumber;

    this.inpShort = inpShort;
    this.inpStreet = inpStreet;
    this.inpZip = inpZip;
    this.inpCity = inpCity;

    this.inpLead = inpLead;
    this.inpLeadPhone = inpLeadPhone;

    this.inpStart = inpStart;
    this.inpEnd = inpEnd;

    this.taNotes = taNotes;

    this.btnFirmsPdf = null;
    this.btnClose = null;
    this.btnArchive = null;

    return root;
  }


  _buildPageButtonRow() {
    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "6px";
    btnRow.style.marginTop = "8px";

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.textContent = "Speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });

    const btnFirmsPdf = document.createElement("button");
    btnFirmsPdf.type = "button";
    btnFirmsPdf.textContent = "Firmenliste (PDF)";
    applyPopupButtonStyle(btnFirmsPdf);

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "Schließen";
    applyPopupButtonStyle(btnClose);

    const btnArchive = document.createElement("button");
    btnArchive.type = "button";
    btnArchive.textContent = "Archiv";
    applyPopupButtonStyle(btnArchive, { variant: "danger" });

    btnSave.onclick = () => this._save();
    btnClose.onclick = () => this._closeToProjects();
    btnFirmsPdf.onclick = async () => {
      if (this.busy) return;
      if (!this.projectId) {
        alert("Bitte zuerst ein Projekt auswählen.");
        return;
      }
      await this.router?.openFirmsPrintPreview?.({ projectId: this.projectId });
    };
    btnArchive.onclick = () => this._archive();

    btnRow.append(btnSave, btnFirmsPdf, btnClose, btnArchive);

    this.btnSave = btnSave;
    this.btnFirmsPdf = btnFirmsPdf;
    this.btnClose = btnClose;
    this.btnArchive = btnArchive;

    return btnRow;
  }

  _buildModalFooter() {
    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.justifyContent = "flex-end";
    btnRow.style.gap = "8px";
    btnRow.style.width = "100%";

    const btnArchive = document.createElement("button");
    btnArchive.type = "button";
    btnArchive.textContent = "Archiv";
    applyPopupButtonStyle(btnArchive, { variant: "danger" });

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel);

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.textContent = "Speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });

    btnArchive.onclick = () => this._archive();
    btnCancel.onclick = () => this._handleModalClose();
    btnSave.onclick = () => this._save();

    btnRow.append(btnArchive, btnCancel, btnSave);

    this.btnArchive = btnArchive;
    this.btnModalCancel = btnCancel;
    this.btnSave = btnSave;

    return btnRow;
  }

  _ensureModalDom() {
    if (this.overlayEl) return;

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";
    overlay.tabIndex = -1;

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) this._handleModalClose();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this._handleModalClose();
      }
    });

    const modal = document.createElement("div");
    modal.style.width = "min(900px, calc(100vw - 32px))";
    modal.style.maxHeight = "min(92vh, calc(100vh - 32px))";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.background = "#fff";
    modal.style.border = "1px solid rgba(0,0,0,0.2)";
    modal.style.borderRadius = "12px";
    modal.style.boxShadow = "0 18px 50px rgba(0,0,0,0.35)";
    modal.style.overflow = "hidden";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "10px";
    header.style.padding = "12px 16px";
    header.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.fontSize = "18px";
    title.textContent = this.projectId ? "Projekt bearbeiten" : "Projekt anlegen";

    const headerRight = document.createElement("div");
    headerRight.style.display = "flex";
    headerRight.style.alignItems = "center";
    headerRight.style.gap = "8px";
    headerRight.style.marginLeft = "auto";

    const msg = document.createElement("div");
    msg.style.fontSize = "12px";
    msg.style.opacity = "0.85";
    msg.style.minWidth = "120px";
    msg.style.textAlign = "right";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "X";
    applyPopupButtonStyle(btnClose);
    btnClose.onclick = () => this._handleModalClose();

    headerRight.append(msg, btnClose);
    header.append(title, headerRight);

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.overflow = "hidden";

    const contentWrapper = document.createElement("div");
    contentWrapper.style.flex = "1 1 auto";
    contentWrapper.style.overflow = "auto";
    contentWrapper.style.padding = "12px 16px";
    contentWrapper.style.width = "100%";
    contentWrapper.style.boxSizing = "border-box";

    body.appendChild(contentWrapper);

    const footer = document.createElement("div");
    footer.style.borderTop = "1px solid #e2e8f0";
    footer.style.padding = "12px 16px";
    footer.style.background = "#fff";

    modal.append(header, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.overlayEl = overlay;
    this.modalEl = modal;
    this.modalBodyEl = contentWrapper;
    this.modalFooterEl = footer;
    this.modalTitleEl = title;
    this.modalMsgEl = msg;
    this.btnModalClose = btnClose;
  }

  _handleModalClose() {
    if (!this.isModal) return;
    if (this.busy) return;
    this._closeModal();
    if (typeof this.onClose === "function") {
      try {
        this.onClose();
      } catch (_e) {
        // ignore
      }
    }
  }

  _closeModal() {
    if (!this.overlayEl) return;
    const overlay = this.overlayEl;
    if (this.modalBodyEl) this.modalBodyEl.innerHTML = "";
    if (this.modalFooterEl) this.modalFooterEl.innerHTML = "";
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
    try {
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
    } catch (_e) {
      // ignore
    }
    this.overlayEl = null;
    this.modalEl = null;
    this.modalBodyEl = null;
    this.modalFooterEl = null;
    this.modalTitleEl = null;
    this.modalMsgEl = null;
    this.btnModalClose = null;
  }

  destroy() {
    try {
      this._closeModal();
    } catch (_e) {
      // ignore
    }
  }

  async openModal() {
    if (!this.isModal) return;
    this._ensureModalDom();
    this.modalTitleEl.textContent = this.projectId ? "Projekt bearbeiten" : "Projekt anlegen";
    if (!this.root) {
      this.render();
    }
    if (this.modalBodyEl) {
      this.modalBodyEl.innerHTML = "";
      this.modalBodyEl.appendChild(this.root);
    }
    if (this.modalFooterEl) {
      this.modalFooterEl.innerHTML = "";
      this.modalFooterEl.appendChild(this._buildModalFooter());
    }
    this.overlayEl.style.display = "flex";
    this.overlayEl.focus();
    this._setBusy(this.busy);
  }

  async _notifySaved() {
    if (typeof this.onSaved !== "function") return;
    try {
      await this.onSaved();
    } catch (err) {
      console.warn("[ProjectFormView] onSaved handler failed", err);
    }
  }

  render() {
    const root = this._buildFormContent();
    if (!this.isModal) {
      const btnRow = this._buildPageButtonRow();
      root.appendChild(btnRow);
    }
    this._setBusy(this.busy);
    return root;
  }

  async load() {
    if (this.loaded) return;
    this.loaded = true;

    // NEU anlegen -> nix zu laden
    if (!this.projectId) {
      this._fill({});
      this._setBusy(false); // sets archive disabled properly
      this.inpName?.focus();
      return;
    }

    const api = window.bbmDb || {};
    if (typeof api.projectsList !== "function") {
      alert("projectsList ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }

    this._setBusy(true);
    this._setMsg("Lade...");

    try {
      const res = await api.projectsList();
      if (!res?.ok) {
        alert(res?.error || "Fehler beim Laden");
        return;
      }

      const list = res.list || [];
      const p = list.find((x) => x.id === this.projectId) || null;

      if (!p) {
        alert("Projekt nicht gefunden.");
        return;
      }

      this.project = p;
      this._fill(p);

      // Fokus sinnvoll
      setTimeout(() => {
        try {
          this.inpName?.focus();
          this.inpName?.select?.();
        } catch (_) {}
      }, 0);
    } finally {
      this._setMsg("");
      this._setBusy(false);
    }
  }
}
