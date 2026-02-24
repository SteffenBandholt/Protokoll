// src/renderer/ui/xEmployeeEditModal.js
import { applyPopupButtonStyle, applyPopupCardStyle } from "./popupButtonStyles.js";

export default class xEmployeeEditModal {
  constructor({ title, initial, onSave, onDelete } = {}) {
    this.title = String(title || "Mitarbeiter bearbeiten");
    this.initial = initial || {};
    this.onSave = typeof onSave === "function" ? onSave : null;
    this.onDelete = typeof onDelete === "function" ? onDelete : null;

    this.overlayEl = null;
    this.cardEl = null;
    this.msgEl = null;
    this.btnSaveEl = null;
    this.btnDeleteEl = null;
    this._onKeyDown = null;
    this._lastFocused = null;

    this.inpFirstName = null;
    this.inpLastName = null;
    this.inpRole = null;
    this.inpEmail = null;
    this.inpPhone = null;
    this.taNotes = null;
  }

  open() {
    if (this.overlayEl) return;
    this._lastFocused = document.activeElement || null;
    this._buildDom();
    document.body.appendChild(this.overlayEl);
    this._bindEvents();
    setTimeout(() => this.inpFirstName?.focus(), 0);
  }

  close() {
    if (this._onKeyDown) {
      document.removeEventListener("keydown", this._onKeyDown);
      this._onKeyDown = null;
    }
    if (this.overlayEl) this.overlayEl.remove();
    this.overlayEl = null;
    this.cardEl = null;
    this.msgEl = null;
    this.btnSaveEl = null;
    this.btnDeleteEl = null;
    this.inpFirstName = null;
    this.inpLastName = null;
    this.inpRole = null;
    this.inpEmail = null;
    this.inpPhone = null;
    this.taNotes = null;
    try {
      if (this._lastFocused && typeof this._lastFocused.focus === "function") {
        this._lastFocused.focus();
      }
    } catch (_e) {
      // ignore
    }
    this._lastFocused = null;
  }

  _buildDom() {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "10000";

    const card = document.createElement("div");
    applyPopupCardStyle(card);
    card.style.width = "min(760px, calc(100vw - 24px))";
    card.style.maxHeight = "calc(100vh - 24px)";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.overflow = "hidden";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.justifyContent = "space-between";
    head.style.gap = "10px";
    head.style.padding = "12px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.textContent = this.title;
    title.style.fontWeight = "bold";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "X";
    applyPopupButtonStyle(btnClose);
    btnClose.onclick = () => this.close();
    head.append(title, btnClose);

    const msg = document.createElement("div");
    msg.style.color = "#c62828";
    msg.style.fontSize = "12px";
    msg.style.display = "none";
    msg.style.padding = "8px 12px 0 12px";

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.minHeight = "0";
    body.style.overflow = "auto";
    body.style.padding = "12px";
    body.style.display = "grid";
    body.style.gridTemplateColumns = "1fr 1fr";
    body.style.gap = "8px";

    const mkRow = (labelText, input, full = false) => {
      const wrap = document.createElement("label");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.gap = "4px";
      wrap.style.gridColumn = full ? "1 / span 2" : "auto";
      const label = document.createElement("span");
      label.style.fontSize = "12px";
      label.style.opacity = "0.85";
      label.textContent = labelText;
      wrap.append(label, input);
      return wrap;
    };

    const mkInput = (value = "", type = "text") => {
      const inp = document.createElement("input");
      inp.type = type;
      inp.value = String(value || "");
      inp.style.width = "100%";
      return inp;
    };

    const inpFirstName = mkInput(this.initial.firstName || "");
    const inpLastName = mkInput(this.initial.lastName || "");
    const inpRole = mkInput(this.initial.role || "");
    const inpEmail = mkInput(this.initial.email || "", "email");
    const inpPhone = mkInput(this.initial.phone || "");
    const taNotes = document.createElement("textarea");
    taNotes.rows = 3;
    taNotes.value = String(this.initial.notes || "");
    taNotes.style.width = "100%";

    body.append(
      mkRow("Vorname", inpFirstName),
      mkRow("Nachname", inpLastName),
      mkRow("Funktion/Rolle", inpRole),
      mkRow("E-Mail", inpEmail),
      mkRow("Telefon", inpPhone),
      mkRow("Notizen", taNotes, true)
    );

    const foot = document.createElement("div");
    foot.style.display = "flex";
    foot.style.justifyContent = "space-between";
    foot.style.gap = "8px";
    foot.style.padding = "10px 12px";
    foot.style.borderTop = "1px solid #e2e8f0";

    const leftActions = document.createElement("div");
    leftActions.style.display = "flex";
    leftActions.style.gap = "8px";
    leftActions.style.alignItems = "center";

    const rightActions = document.createElement("div");
    rightActions.style.display = "flex";
    rightActions.style.gap = "8px";
    rightActions.style.alignItems = "center";

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.textContent = "Löschen";
    applyPopupButtonStyle(btnDelete);
    btnDelete.style.background = "#c62828";
    btnDelete.style.color = "#fff";
    btnDelete.style.border = "1px solid rgba(0,0,0,0.25)";
    btnDelete.style.opacity = this.onDelete ? "1" : "0.55";
    btnDelete.disabled = !this.onDelete;
    btnDelete.onclick = async () => {
      if (!this.onDelete) return;
      btnDelete.disabled = true;
      try {
        await this.onDelete();
        this.close();
      } catch (e) {
        this._setMsg(e?.message || "Löschen fehlgeschlagen.");
      } finally {
        if (this.btnDeleteEl) this.btnDeleteEl.disabled = false;
      }
    };

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel);
    btnCancel.onclick = () => this.close();

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.textContent = "Speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });
    btnSave.onclick = async () => {
      if (!this.onSave) return this.close();
      btnSave.disabled = true;
      if (this.btnDeleteEl) this.btnDeleteEl.disabled = true;
      try {
        const payload = {
          firstName: String(inpFirstName.value || "").trim(),
          lastName: String(inpLastName.value || "").trim(),
          role: String(inpRole.value || "").trim(),
          email: String(inpEmail.value || "").trim(),
          phone: String(inpPhone.value || "").trim(),
          notes: String(taNotes.value || "").trim(),
        };
        await this.onSave(payload);
        this.close();
      } catch (e) {
        this._setMsg(e?.message || "Speichern fehlgeschlagen.");
      } finally {
        if (this.btnSaveEl) this.btnSaveEl.disabled = false;
        if (this.btnDeleteEl) this.btnDeleteEl.disabled = !this.onDelete;
      }
    };

    leftActions.append(btnDelete);
    rightActions.append(btnCancel, btnSave);
    foot.append(leftActions, rightActions);
    card.append(head, msg, body, foot);
    overlay.appendChild(card);

    this.overlayEl = overlay;
    this.cardEl = card;
    this.msgEl = msg;
    this.btnSaveEl = btnSave;
    this.btnDeleteEl = btnDelete;
    this.inpFirstName = inpFirstName;
    this.inpLastName = inpLastName;
    this.inpRole = inpRole;
    this.inpEmail = inpEmail;
    this.inpPhone = inpPhone;
    this.taNotes = taNotes;
  }

  _bindEvents() {
    this.overlayEl.onclick = (e) => {
      if (e.target === this.overlayEl) this.close();
    };
    this._onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this.close();
    };
    document.addEventListener("keydown", this._onKeyDown);
  }

  _setMsg(text) {
    if (!this.msgEl) return;
    const msg = String(text || "").trim();
    this.msgEl.textContent = msg;
    this.msgEl.style.display = msg ? "block" : "none";
  }
}
