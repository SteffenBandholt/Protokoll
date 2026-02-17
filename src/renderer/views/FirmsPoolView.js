// src/renderer/views/FirmsPoolView.js
//
// Step 1:
// - Links: Firmenliste (project_firm + global_firm)
// - Rechts: Mitarbeiter der ausgewaehlten Firma
// - global_firm visuell hellorange markieren

import { applyPopupButtonStyle, applyPopupCardStyle } from "../ui/popupButtonStyles.js";
import xEmployeeEditModal from "../ui/xEmployeeEditModal.js";
import { fireAndForget } from "../utils/async.js";

export default class FirmsPoolView {
  constructor({ router, projectId } = {}) {
    this.router = router;
    this.projectId = projectId || this.router?.currentProjectId || null;

    this.root = null;
    this.msgEl = null;
    this.firmsBodyEl = null;
    this.personsBodyEl = null;
    this.personsTitleEl = null;
    this.detailFirmTitleEl = null;
    this.detailFirmMetaEl = null;
    this.leftErrorEl = null;
    this.rightErrorEl = null;
    this.btnDeleteFirmEl = null;
    this.btnOpenGlobalAssignEl = null;

    this.firms = [];
    this.selectedFirmKey = null;
    this.selectedFirm = null;
    this.persons = [];
    this.selectedPersonId = null;

    this.loadingFirms = false;
    this.loadingPersons = false;
    this.deletingFirm = false;
    this.activePersonModal = null;

    this.globalAssignOpen = false;
    this.globalAssignAll = [];
    this.globalAssignSelectedIds = new Set();
    this.globalAssignInitialIds = new Set();
    this.globalAssignSearchLeft = "";
    this.globalAssignSearchRight = "";
    this.globalAssignErr = "";
    this.globalAssignOverlayEl = null;
    this.globalAssignErrEl = null;
    this.globalAssignLeftListEl = null;
    this.globalAssignRightListEl = null;
    this.globalAssignInpLeftEl = null;
    this.globalAssignInpRightEl = null;
    this.globalAssignBtnSaveEl = null;
    this.globalAssignBtnCancelEl = null;
    this.globalAssignBtnCloseEl = null;

    this.isNewUi = this._readUiMode() === "new";
  }

  _ensureProjectId() {
    this.projectId = this.projectId || this.router?.currentProjectId || null;
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

  _isFirmActive(item) {
    return this._parseActiveFlag(item?.is_active) === 1;
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

  _notifyPoolDataChanged(reason) {
    this._requestSetupStatusRefresh();
    try {
      window.dispatchEvent(
        new CustomEvent("bbm:pool-data-changed", {
          detail: {
            projectId: this.projectId || null,
            reason: String(reason || "").trim() || "firms-pool-updated",
            source: "FirmsPoolView",
          },
        })
      );
    } catch (_e) {
      // ignore
    }
  }

  _setMsg(text) {
    if (!this.msgEl) return;
    this.msgEl.textContent = text || "";
  }

  _setLeftError(text) {
    if (!this.leftErrorEl) return;
    const msg = String(text || "").trim();
    this.leftErrorEl.textContent = msg;
    this.leftErrorEl.style.display = msg ? "block" : "none";
  }

  _setRightError(text) {
    if (!this.rightErrorEl) return;
    const msg = String(text || "").trim();
    this.rightErrorEl.textContent = msg;
    this.rightErrorEl.style.display = msg ? "block" : "none";
  }

  _labelFirm(item) {
    if (!item) return "(ohne Name)";
    const short = String(item.short || "").trim();
    const name = String(item.name || "").trim();
    return short || name || "(ohne Name)";
  }

  _personsTitle() {
    return "Mitarbeiter (Lokal)";
  }

  _selectedFirmMeta() {
    if (!this.selectedFirm) return "Bitte links eine Firma auswählen.";
    const isGlobal = this.selectedFirm.kind === "global_firm";
    return isGlobal ? "Kategorie: Firmenstamm" : "Kategorie: Projektfirma";
  }

  _personName(p) {
    const full = String(p.name || "").trim();
    if (full) return full;
    const first = String(p.first_name || "").trim();
    const last = String(p.last_name || "").trim();
    const joined = `${first} ${last}`.trim();
    return joined || "(ohne Name)";
  }

  _personId(p) {
    return String(p?.id || p?.personId || "").trim();
  }

  _personFirstName(p) {
    const raw = String(p?.first_name || "").trim();
    if (raw) return raw;
    const full = this._personName(p);
    return String(full.split(/\s+/)[0] || "").trim();
  }

  _personLastName(p) {
    const raw = String(p?.last_name || "").trim();
    if (raw) return raw;
    const full = this._personName(p);
    const parts = full.split(/\s+/);
    return String(parts.slice(1).join(" ") || "").trim();
  }

  _projectLabelText() {
    const label = String(this.router?.context?.projectLabel || "").trim();
    return label || "diesem Projekt";
  }

  _canDeleteSelectedProjectFirm() {
    if (this.deletingFirm || this.loadingFirms || this.loadingPersons) return false;
    if (!this.selectedFirm) return false;
    if (this.selectedFirm.kind !== "project_firm") return false;
    return Array.isArray(this.persons) && this.persons.length === 0;
  }

  _applyDeleteFirmButtonState() {
    const btn = this.btnDeleteFirmEl;
    if (!btn) return;
    const canDelete = this._canDeleteSelectedProjectFirm();
    btn.disabled = !canDelete;
    btn.style.opacity = canDelete ? "1" : "0.55";

    const selected = this.selectedFirm;
    if (!selected) {
      btn.title = "Bitte zuerst eine Projektfirma auswählen.";
      return;
    }
    if (selected.kind !== "project_firm") {
      btn.title = "Nur Projektfirmen können gelöscht werden.";
      return;
    }
    if (this.loadingPersons) {
      btn.title = "Mitarbeiter werden geladen...";
      return;
    }
    if (Array.isArray(this.persons) && this.persons.length > 0) {
      btn.title = "Löschen nur möglich, wenn keine Mitarbeiter vorhanden sind.";
      return;
    }
    btn.title = "";
  }

  async _deleteSelectedFirm() {
    const selected = this.selectedFirm;
    if (!selected) {
      alert("Bitte zuerst eine Projektfirma auswählen.");
      return;
    }
    if (selected.kind !== "project_firm") {
      alert("Nur Projektfirmen können gelöscht werden.");
      return;
    }
    if (this.loadingPersons) return;
    if (Array.isArray(this.persons) && this.persons.length > 0) {
      alert("Löschen nicht möglich: Projektfirma hat noch aktive Mitarbeiter.");
      return;
    }

    const api = window.bbmDb || {};
    if (typeof api.projectFirmsDelete !== "function") {
      alert("Löschen ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }

    this.deletingFirm = true;
    this._applyDeleteFirmButtonState();
    this._setMsg("Lösche Firma...");
    let reloadAfterDelete = false;
    try {
      const res = await api.projectFirmsDelete(selected.id);
      if (!res?.ok) {
        alert(res?.error || "Löschen fehlgeschlagen.");
        return;
      }
      this.selectedFirmKey = null;
      this.selectedFirm = null;
      this.persons = [];
      this.selectedPersonId = null;
      this._renderFirms();
      this._renderPersons();
      reloadAfterDelete = true;
      this._notifyPoolDataChanged("project-firm-deleted");
    } finally {
      this.deletingFirm = false;
      this._setMsg("");
      this._renderPersons();
      this._applyDeleteFirmButtonState();
    }

    if (reloadAfterDelete) {
      fireAndForget(() => this.reloadFirms(), "FirmsPoolView reload after deleteSelectedFirm");
    }
  }

  async _setFirmActive(item, isActive) {
    if (!item || !this.projectId) return;
    const api = window.bbmDb || {};
    if (typeof api.projectFirmsSetActive !== "function") {
      alert("Aktiv/Inaktiv ist nicht verfuegbar (projectFirmsSetActive fehlt).");
      return;
    }

    this._setMsg("Speichere Firmen-Status...");
    try {
      const res = await api.projectFirmsSetActive({
        projectId: this.projectId,
        firmId: item.id,
        isActive: !!isActive,
      });
      if (!res?.ok) {
        alert(res?.error || "Aktiv/Inaktiv konnte nicht gespeichert werden.");
        return;
      }
      await this.reloadFirms();
      if (this.selectedFirm) {
        await this.reloadPersonsForSelectedFirm();
      }
      this._notifyPoolDataChanged("firm-active-changed");
    } finally {
      this._setMsg("");
    }
  }

  render() {
    const root = document.createElement("div");
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "10px";
    root.style.minHeight = "0";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";

    const title = document.createElement("h2");
    title.textContent = "Firmenpool";
    title.style.margin = "0";

    const msg = document.createElement("div");
    msg.style.marginLeft = "auto";
    msg.style.fontSize = "12px";
    msg.style.opacity = "0.85";

    head.append(title, msg);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "12px";
    grid.style.minHeight = "0";

    const leftCard = document.createElement("div");
    applyPopupCardStyle(leftCard);
    leftCard.style.padding = "10px";
    leftCard.style.display = "flex";
    leftCard.style.flexDirection = "column";
    leftCard.style.minHeight = "0";

    const leftHead = document.createElement("div");
    leftHead.style.display = "flex";
    leftHead.style.alignItems = "center";
    leftHead.style.justifyContent = "space-between";
    leftHead.style.gap = "8px";
    leftHead.style.marginBottom = "8px";

    const leftTitle = document.createElement("div");
    leftTitle.textContent = "Firmen (Lokal)";
    leftTitle.style.fontWeight = "700";

    const leftSubtitle = document.createElement("div");
    leftSubtitle.textContent = `Firmen sind nur in ${this._projectLabelText()}`;
    leftSubtitle.style.fontSize = "12px";
    leftSubtitle.style.fontWeight = "400";
    leftSubtitle.style.opacity = "0.8";

    const leftActions = document.createElement("div");
    leftActions.style.display = "flex";
    leftActions.style.alignItems = "center";
    leftActions.style.gap = "8px";

    const btnOpenGlobalAssign = document.createElement("button");
    btnOpenGlobalAssign.textContent = "Global zuordnen";
    applyPopupButtonStyle(btnOpenGlobalAssign);
    btnOpenGlobalAssign.onclick = async () => {
      try {
        await this.openGlobalAssign();
      } catch (e) {
        this._setLeftError(e?.message || "Global-Zuordnung konnte nicht geöffnet werden.");
      }
    };

    const btnDeleteFirm = document.createElement("button");
    btnDeleteFirm.textContent = "Löschen";
    applyPopupButtonStyle(btnDeleteFirm, { variant: "danger" });
    btnDeleteFirm.onclick = async () => {
      await this._deleteSelectedFirm();
    };

    if (this.isNewUi) {
      leftActions.append(btnDeleteFirm);
    } else {
      leftActions.append(btnOpenGlobalAssign, btnDeleteFirm);
    }
    const leftTitleWrap = document.createElement("div");
    leftTitleWrap.style.display = "flex";
    leftTitleWrap.style.flexDirection = "column";
    leftTitleWrap.style.gap = "2px";
    leftTitleWrap.append(leftTitle, leftSubtitle);
    leftHead.append(leftTitleWrap, leftActions);

    const leftError = document.createElement("div");
    leftError.style.color = "#c62828";
    leftError.style.fontSize = "12px";
    leftError.style.marginBottom = "8px";
    leftError.style.display = "none";

    const firmsWrap = document.createElement("div");
    firmsWrap.style.flex = "1 1 auto";
    firmsWrap.style.minHeight = "0";
    firmsWrap.style.overflowY = "auto";
    firmsWrap.style.border = "1px solid #e2e8f0";
    firmsWrap.style.borderRadius = "8px";

    const firmsTable = document.createElement("table");
    firmsTable.style.width = "100%";
    firmsTable.style.borderCollapse = "collapse";

    const firmsHead = document.createElement("thead");
    firmsHead.innerHTML = this.isNewUi
      ? `
      <tr>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Firma</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;width:130px;">Typ</th>
        <th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;width:86px;">Aktiv</th>
      </tr>
    `
      : `
      <tr>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Firma</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;width:130px;">Typ</th>
      </tr>
    `;

    const firmsBody = document.createElement("tbody");
    firmsTable.append(firmsHead, firmsBody);
    firmsWrap.appendChild(firmsTable);

    leftCard.append(leftHead, leftError, firmsWrap);

    const rightCard = document.createElement("div");
    applyPopupCardStyle(rightCard);
    rightCard.style.padding = "10px";
    rightCard.style.display = "flex";
    rightCard.style.flexDirection = "column";
    rightCard.style.minHeight = "0";

    const rightHead = document.createElement("div");
    rightHead.style.display = "flex";
    rightHead.style.alignItems = "center";
    rightHead.style.justifyContent = "space-between";
    rightHead.style.gap = "8px";
    rightHead.style.marginBottom = "8px";

    const rightTitle = document.createElement("div");
    rightTitle.textContent = "-";
    rightTitle.style.fontWeight = "700";

    rightHead.append(rightTitle);

    const rightMeta = document.createElement("div");
    rightMeta.textContent = "Bitte links eine Firma auswählen.";
    rightMeta.style.fontSize = "12px";
    rightMeta.style.opacity = "0.8";
    rightMeta.style.marginBottom = "8px";

    const personsTitle = document.createElement("div");
    personsTitle.textContent = "Mitarbeiter (Lokal)";
    personsTitle.style.fontWeight = "700";
    personsTitle.style.marginBottom = "8px";

    const rightError = document.createElement("div");
    rightError.style.color = "#c62828";
    rightError.style.fontSize = "12px";
    rightError.style.marginBottom = "8px";
    rightError.style.display = "none";

    const personsWrap = document.createElement("div");
    personsWrap.style.flex = "1 1 auto";
    personsWrap.style.minHeight = "0";
    personsWrap.style.overflowY = "auto";
    personsWrap.style.border = "1px solid #e2e8f0";
    personsWrap.style.borderRadius = "8px";

    const personsTable = document.createElement("table");
    personsTable.style.width = "100%";
    personsTable.style.borderCollapse = "collapse";

    const personsHead = document.createElement("thead");
    personsHead.innerHTML = `
      <tr>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Name</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Rolle</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">E-Mail</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Telefon</th>
      </tr>
    `;

    const personsBody = document.createElement("tbody");
    personsTable.append(personsHead, personsBody);
    personsWrap.appendChild(personsTable);

    rightCard.append(rightHead, rightMeta, personsTitle, rightError, personsWrap);

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";
    overlay.tabIndex = -1;
    overlay.onclick = (e) => {
      if (e.target === overlay) this._closeGlobalAssignModal();
    };
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this._closeGlobalAssignModal();
    });

    const modal = document.createElement("div");
    applyPopupCardStyle(modal);
    modal.style.width = "min(980px, calc(100vw - 24px))";
    modal.style.maxHeight = "calc(100vh - 24px)";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.overflow = "hidden";
    modal.style.padding = "0";

    const modalHead = document.createElement("div");
    modalHead.style.display = "flex";
    modalHead.style.alignItems = "center";
    modalHead.style.justifyContent = "space-between";
    modalHead.style.gap = "10px";
    modalHead.style.padding = "12px";
    modalHead.style.borderBottom = "1px solid #e2e8f0";

    const modalTitle = document.createElement("div");
    modalTitle.textContent = "Globale Firmen zuordnen";
    modalTitle.style.fontWeight = "bold";

    const btnClose = document.createElement("button");
    btnClose.textContent = "X";
    applyPopupButtonStyle(btnClose);
    btnClose.onclick = () => this._closeGlobalAssignModal();
    modalHead.append(modalTitle, btnClose);

    const modalErr = document.createElement("div");
    modalErr.style.color = "#c62828";
    modalErr.style.fontSize = "12px";
    modalErr.style.marginBottom = "8px";
    modalErr.style.display = "none";

    const modalBodyWrap = document.createElement("div");
    modalBodyWrap.style.flex = "1 1 auto";
    modalBodyWrap.style.minHeight = "0";
    modalBodyWrap.style.overflow = "auto";
    modalBodyWrap.style.padding = "12px";

    const mkListCol = (titleText) => {
      const col = document.createElement("div");
      col.style.border = "1px solid #ddd";
      col.style.borderRadius = "8px";
      col.style.padding = "8px";
      col.style.background = "#fff";
      col.style.minHeight = "340px";
      col.style.display = "flex";
      col.style.flexDirection = "column";
      const title = document.createElement("div");
      title.textContent = titleText;
      title.style.fontWeight = "bold";
      title.style.marginBottom = "6px";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = "Suchen...";
      inp.style.width = "100%";
      inp.style.marginBottom = "8px";
      const list = document.createElement("div");
      list.style.flex = "1 1 auto";
      list.style.minHeight = "0";
      list.style.overflow = "auto";
      list.style.border = "1px solid #e2e8f0";
      list.style.borderRadius = "6px";
      col.append(title, inp, list);
      return { col, inp, list };
    };

    const listsGrid = document.createElement("div");
    listsGrid.style.display = "grid";
    listsGrid.style.gridTemplateColumns = "1fr 1fr";
    listsGrid.style.gap = "10px";

    const leftCol = mkListCol("Alle globalen Firmen");
    const rightCol = mkListCol("Dem Projekt zugeordnet");
    listsGrid.append(leftCol.col, rightCol.col);
    modalBodyWrap.append(modalErr, listsGrid);

    const modalFoot = document.createElement("div");
    modalFoot.style.display = "flex";
    modalFoot.style.justifyContent = "flex-end";
    modalFoot.style.gap = "8px";
    modalFoot.style.borderTop = "1px solid #e2e8f0";
    modalFoot.style.padding = "10px 12px";

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel);
    btnCancel.onclick = () => this._closeGlobalAssignModal();

    const btnSave = document.createElement("button");
    btnSave.textContent = "Speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });
    btnSave.onclick = async () => {
      await this._saveGlobalAssignments();
    };

    modalFoot.append(btnCancel, btnSave);
    modal.append(modalHead, modalBodyWrap, modalFoot);
    overlay.appendChild(modal);

    const bottomActions = document.createElement("div");
    bottomActions.style.display = this.isNewUi ? "flex" : "none";
    bottomActions.style.justifyContent = "flex-end";
    bottomActions.style.alignItems = "center";
    bottomActions.style.gap = "8px";
    bottomActions.append(btnOpenGlobalAssign);

    grid.append(leftCard, rightCard);
    root.append(head, grid, bottomActions, overlay);

    this.root = root;
    this.msgEl = msg;
    this.firmsBodyEl = firmsBody;
    this.personsBodyEl = personsBody;
    this.personsTitleEl = personsTitle;
    this.detailFirmTitleEl = rightTitle;
    this.detailFirmMetaEl = rightMeta;
    this.leftErrorEl = leftError;
    this.rightErrorEl = rightError;
    this.btnDeleteFirmEl = btnDeleteFirm;
    this.btnOpenGlobalAssignEl = btnOpenGlobalAssign;
    this.globalAssignOverlayEl = overlay;
    this.globalAssignErrEl = modalErr;
    this.globalAssignLeftListEl = leftCol.list;
    this.globalAssignRightListEl = rightCol.list;
    this.globalAssignInpLeftEl = leftCol.inp;
    this.globalAssignInpRightEl = rightCol.inp;
    this.globalAssignBtnSaveEl = btnSave;
    this.globalAssignBtnCancelEl = btnCancel;
    this.globalAssignBtnCloseEl = btnClose;

    this.globalAssignInpLeftEl.oninput = () => {
      this.globalAssignSearchLeft = (this.globalAssignInpLeftEl?.value || "").trim();
      this._renderGlobalAssignLists();
    };
    this.globalAssignInpRightEl.oninput = () => {
      this.globalAssignSearchRight = (this.globalAssignInpRightEl?.value || "").trim();
      this._renderGlobalAssignLists();
    };

    this._applyDeleteFirmButtonState();
    this._applyGlobalAssignState();

    return root;
  }

  async load() {
    this._ensureProjectId();
    if (!this.projectId) {
      this._setMsg("Bitte zuerst ein Projekt auswählen.");
      this.firms = [];
      this.selectedFirmKey = null;
      this.selectedFirm = null;
      this.persons = [];
      this._renderFirms();
      this._renderPersons();
      this._applyGlobalAssignState();
      return;
    }

    await this.reloadFirms();
    this._applyGlobalAssignState();
  }

  async openGlobalAssign() {
    this._ensureProjectId();
    if (!this.projectId) {
      this._setLeftError("Bitte zuerst ein Projekt auswählen.");
      this._applyGlobalAssignState();
      return false;
    }
    await this._openGlobalAssignModal();
    return true;
  }

  async reloadFirms() {
    this.loadingFirms = true;
    this._setLeftError("");
    this._setMsg("Lade Firmen...");
    this._renderFirms();
    try {
      const api = window.bbmDb || {};
      if (typeof api.projectFirmsListFirmCandidatesByProject !== "function") {
        this.firms = [];
        this._setLeftError("API projectFirmsListFirmCandidatesByProject ist nicht verfügbar.");
        return;
      }

      const res = await api.projectFirmsListFirmCandidatesByProject(this.projectId);
      if (!res?.ok) {
        this.firms = [];
        this._setLeftError(res?.error || "Fehler beim Laden der Firmenliste.");
        return;
      }

      const list = Array.isArray(res.list) ? res.list : [];
      this.firms = list.map((x) => {
        const kind = String(x?.kind || "").trim() === "global_firm" ? "global_firm" : "project_firm";
        const id = String(x?.id || "");
        return {
          key: `${kind}:${id}`,
          kind,
          sourceType: kind,
          id,
          short: x?.short ?? "",
          name: x?.name ?? "",
          label: x?.label ?? "",
          is_active: this._parseActiveFlag(x?.is_active),
        };
      });

      if (this.selectedFirmKey) {
        this.selectedFirm = this.firms.find((x) => x.key === this.selectedFirmKey) || null;
        if (!this.selectedFirm) {
          this.selectedFirmKey = null;
          this.persons = [];
          this.selectedPersonId = null;
        }
      }
    } finally {
      this.loadingFirms = false;
      this._setMsg("");
      this._renderFirms();
      this._renderPersons();
      this._applyDeleteFirmButtonState();
      this._applyGlobalAssignState();
    }
  }

  async _selectFirm(item) {
    this.selectedFirm = item || null;
    this.selectedFirmKey = item?.key || null;
    this.selectedPersonId = null;
    this._renderFirms();
    this._applyDeleteFirmButtonState();
    await this.reloadPersonsForSelectedFirm();
  }

  _selectPerson(person) {
    this.selectedPersonId = this._personId(person) || null;
    this._renderPersons();
  }

  async _openPersonEditModal(person) {
    if (!person || !this.selectedFirm) return;
    const api = window.bbmDb || {};
    const id = this._personId(person);
    if (!id) return;
    if (this.activePersonModal) {
      this.activePersonModal.close();
      this.activePersonModal = null;
    }

    const isGlobal = this.selectedFirm.kind === "global_firm";
    const canUpdateGlobal = typeof api.personsUpdate === "function";
    const canUpdateProject = typeof api.projectPersonsUpdate === "function";
    if ((isGlobal && !canUpdateGlobal) || (!isGlobal && !canUpdateProject)) {
      alert(
        isGlobal
          ? "Bearbeiten nicht verfügbar (personsUpdate fehlt)."
          : "Bearbeiten nicht verfügbar (projectPersonsUpdate fehlt)."
      );
      return;
    }

    const modal = new xEmployeeEditModal({
      title: isGlobal ? "Mitarbeiter bearbeiten (Firmenstamm)" : "Mitarbeiter bearbeiten (Projektfirma)",
      initial: {
        firstName: this._personFirstName(person),
        lastName: this._personLastName(person),
        role: String(person.rolle || person.role || "").trim(),
        email: String(person.email || "").trim(),
        phone: String(person.phone || person.funktion || "").trim(),
        notes: String(person.notes || "").trim(),
      },
      onSave: async (payload) => {
        let res = null;
        if (isGlobal) {
          res = await api.personsUpdate({
            personId: id,
            patch: {
              first_name: payload.firstName,
              last_name: payload.lastName,
              rolle: payload.role,
              email: payload.email,
              phone: payload.phone,
              notes: payload.notes,
            },
          });
        } else {
          res = await api.projectPersonsUpdate({
            projectPersonId: id,
            patch: {
              first_name: payload.firstName,
              last_name: payload.lastName,
              rolle: payload.role,
              email: payload.email,
              phone: payload.phone,
              notes: payload.notes,
            },
          });
        }
        if (!res?.ok) throw new Error(res?.error || "Bearbeiten fehlgeschlagen.");
        await this.reloadPersonsForSelectedFirm();
        this.selectedPersonId = id;
        this._renderPersons();
      },
    });
    this.activePersonModal = modal;
    modal.open();
  }

  async reloadPersonsForSelectedFirm() {
    this._setRightError("");
    this.persons = [];
    this.loadingPersons = true;
    this._renderPersons();

    try {
      if (!this.selectedFirm) return;

      const api = window.bbmDb || {};
      let res = null;
      if (this.selectedFirm.kind === "project_firm") {
        if (typeof api.projectPersonsListByProjectFirm !== "function") {
          this._setRightError("API projectPersonsListByProjectFirm ist nicht verfügbar.");
          return;
        }
        res = await api.projectPersonsListByProjectFirm(this.selectedFirm.id);
      } else {
        if (typeof api.personsListByFirm !== "function") {
          this._setRightError("API personsListByFirm ist nicht verfügbar.");
          return;
        }
        res = await api.personsListByFirm(this.selectedFirm.id);
      }

      if (!res?.ok) {
        this._setRightError(res?.error || "Fehler beim Laden der Mitarbeiter.");
        return;
      }

      this.persons = Array.isArray(res.list) ? res.list : [];
      if (this.selectedPersonId) {
        const exists = this.persons.some((p) => this._personId(p) === this.selectedPersonId);
        if (!exists) this.selectedPersonId = null;
      }
    } finally {
      this.loadingPersons = false;
      this._renderPersons();
      this._applyDeleteFirmButtonState();
    }
  }

  _renderFirms() {
    const tb = this.firmsBodyEl;
    if (!tb) return;
    tb.innerHTML = "";
    this._applyDeleteFirmButtonState();
    const colCount = this.isNewUi ? 3 : 2;

    if (this.loadingFirms) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = colCount;
      td.style.padding = "10px";
      td.style.opacity = "0.75";
      td.textContent = "Lade Firmen...";
      tr.appendChild(td);
      tb.appendChild(tr);
      return;
    }

    if (!(this.firms || []).length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = colCount;
      td.style.padding = "10px";
      td.style.opacity = "0.75";
      td.textContent = "Keine Firmen vorhanden.";
      tr.appendChild(td);
      tb.appendChild(tr);
      return;
    }

    for (const item of this.firms) {
      const tr = document.createElement("tr");
      const isSel = this.selectedFirmKey === item.key;
      const isGlobal = item.kind === "global_firm";

      tr.style.cursor = "pointer";
      tr.style.background = isSel ? "#dff0ff" : isGlobal ? "#fff0dc" : "transparent";
      tr.onmouseenter = () => {
        if (isSel) return;
        tr.style.background = isGlobal ? "#ffe7c7" : "#f4f8ff";
      };
      tr.onmouseleave = () => {
        tr.style.background = isSel ? "#dff0ff" : isGlobal ? "#fff0dc" : "transparent";
      };
      tr.onclick = async () => {
        await this._selectFirm(item);
      };

      const tdName = document.createElement("td");
      tdName.style.padding = "6px";
      tdName.style.borderBottom = "1px solid #eee";
      tdName.textContent = this._labelFirm(item);

      const tdType = document.createElement("td");
      tdType.style.padding = "6px";
      tdType.style.borderBottom = "1px solid #eee";
      tdType.textContent = isGlobal ? "Stamm" : "Projekt";

      tr.append(tdName, tdType);
      if (this.isNewUi) {
        const tdActive = document.createElement("td");
        tdActive.style.padding = "6px";
        tdActive.style.borderBottom = "1px solid #eee";
        tdActive.style.textAlign = "center";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = this._isFirmActive(item);
        cb.disabled = this.loadingFirms || this.deletingFirm;
        cb.title = cb.checked ? "Firma ist aktiv" : "Firma ist inaktiv";
        cb.onclick = (e) => e.stopPropagation();
        cb.onchange = async (e) => {
          e.stopPropagation();
          await this._setFirmActive(item, cb.checked);
        };
        tdActive.appendChild(cb);
        tr.appendChild(tdActive);
      }
      tb.appendChild(tr);
    }
  }

  _renderPersons() {
    const tb = this.personsBodyEl;
    if (!tb) return;
    tb.innerHTML = "";

    if (this.personsTitleEl) this.personsTitleEl.textContent = this._personsTitle();
    if (this.detailFirmTitleEl) {
      this.detailFirmTitleEl.textContent = this.selectedFirm ? this._labelFirm(this.selectedFirm) : "-";
    }
    if (this.detailFirmMetaEl) {
      this.detailFirmMetaEl.textContent = this._selectedFirmMeta();
    }

    if (!this.selectedFirm) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.style.padding = "10px";
      td.style.opacity = "0.75";
      td.textContent = "Bitte links eine Firma auswählen.";
      tr.appendChild(td);
      tb.appendChild(tr);
      return;
    }

    if (this.loadingPersons) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.style.padding = "10px";
      td.style.opacity = "0.75";
      td.textContent = "Lade Mitarbeiter...";
      tr.appendChild(td);
      tb.appendChild(tr);
      return;
    }

    if (!(this.persons || []).length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.style.padding = "10px";
      td.style.opacity = "0.75";
      td.textContent = "Keine Mitarbeiter vorhanden.";
      tr.appendChild(td);
      tb.appendChild(tr);
      return;
    }

    for (const p of this.persons) {
      const tr = document.createElement("tr");
      const pid = this._personId(p);
      const isSel = !!pid && this.selectedPersonId === pid;
      tr.style.cursor = "pointer";
      tr.style.background = isSel ? "#dff0ff" : "transparent";
      tr.onmouseenter = () => {
        if (!isSel) tr.style.background = "#f4f8ff";
      };
      tr.onmouseleave = () => {
        tr.style.background = isSel ? "#dff0ff" : "transparent";
      };
      tr.onclick = () => this._selectPerson(p);
      tr.ondblclick = async () => {
        tr.style.background = "#dff0ff";
        this.selectedPersonId = pid || null;
        await this._openPersonEditModal(p);
      };

      const tdName = document.createElement("td");
      tdName.style.padding = "6px";
      tdName.style.borderBottom = "1px solid #eee";
      tdName.textContent = this._personName(p);

      const tdRole = document.createElement("td");
      tdRole.style.padding = "6px";
      tdRole.style.borderBottom = "1px solid #eee";
      tdRole.textContent = String(p.rolle || p.role || "").trim() || "—";

      const tdEmail = document.createElement("td");
      tdEmail.style.padding = "6px";
      tdEmail.style.borderBottom = "1px solid #eee";
      tdEmail.textContent = String(p.email || "").trim() || "—";

      const tdPhone = document.createElement("td");
      tdPhone.style.padding = "6px";
      tdPhone.style.borderBottom = "1px solid #eee";
      tdPhone.textContent = String(p.phone || p.funktion || "").trim() || "—";

      tr.append(tdName, tdRole, tdEmail, tdPhone);
      tb.appendChild(tr);
    }
  }

  _applyGlobalAssignState() {
    const can = !!this.projectId && !this.loadingFirms && !this.deletingFirm;
    if (this.btnOpenGlobalAssignEl) {
      this.btnOpenGlobalAssignEl.disabled = !can;
      this.btnOpenGlobalAssignEl.style.opacity = can ? "1" : "0.55";
      this.btnOpenGlobalAssignEl.title = can
        ? "Globale Firmen dem Projekt zuordnen"
        : "Projekt wählen";
    }
  }

  _setGlobalAssignError(text) {
    this.globalAssignErr = text || "";
    const el = this.globalAssignErrEl;
    if (!el) return;
    if (!this.globalAssignErr) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "block";
    el.textContent = this.globalAssignErr;
  }

  async _openGlobalAssignModal() {
    this._ensureProjectId();
    if (!this.projectId || !this.globalAssignOverlayEl) return;
    this.globalAssignOpen = true;
    this.globalAssignSearchLeft = "";
    this.globalAssignSearchRight = "";
    this._setGlobalAssignError("");

    this.globalAssignOverlayEl.style.display = "flex";
    try {
      this.globalAssignOverlayEl.focus();
    } catch (_e) {
      // ignore
    }

    if (this.globalAssignInpLeftEl) this.globalAssignInpLeftEl.value = "";
    if (this.globalAssignInpRightEl) this.globalAssignInpRightEl.value = "";

    await this._loadGlobalAssignData();
    this._renderGlobalAssignLists();
    this._applyGlobalAssignState();
  }

  _closeGlobalAssignModal() {
    this.globalAssignOpen = false;
    this.globalAssignSearchLeft = "";
    this.globalAssignSearchRight = "";
    this.globalAssignAll = [];
    this.globalAssignSelectedIds = new Set();
    this.globalAssignInitialIds = new Set();
    this._setGlobalAssignError("");
    if (this.globalAssignOverlayEl) this.globalAssignOverlayEl.style.display = "none";
  }

  async _loadGlobalAssignData() {
    const api = window.bbmDb || {};
    if (typeof api.firmsListGlobal !== "function") {
      this.globalAssignAll = [];
      this._setGlobalAssignError("API firmsListGlobal ist nicht verfügbar.");
      return;
    }
    if (typeof api.projectFirmsListFirmCandidatesByProject !== "function") {
      this.globalAssignAll = [];
      this._setGlobalAssignError("API projectFirmsListFirmCandidatesByProject ist nicht verfügbar.");
      return;
    }

    const [resF, resC] = await Promise.all([
      api.firmsListGlobal(),
      api.projectFirmsListFirmCandidatesByProject(this.projectId),
    ]);

    if (!resF?.ok) {
      this.globalAssignAll = [];
      this._setGlobalAssignError(resF?.error || "Fehler beim Laden der globalen Firmen.");
      return;
    }

    const all = (resF.list || []).map((f) => ({
      id: String(f?.id || ""),
      short: String(f?.short || "").trim(),
      name: String(f?.name || "").trim(),
    }));
    all.sort((a, b) => this._labelFirm(a).localeCompare(this._labelFirm(b), "de"));
    this.globalAssignAll = all;

    const selected = new Set();
    if (resC?.ok) {
      for (const x of resC.list || []) {
        if (String(x?.kind || "") === "global_firm" && x?.id) selected.add(String(x.id));
      }
    }
    this.globalAssignInitialIds = new Set([...selected]);
    this.globalAssignSelectedIds = new Set([...selected]);
  }

  _renderGlobalAssignLists() {
    if (!this.globalAssignLeftListEl || !this.globalAssignRightListEl) return;
    this.globalAssignLeftListEl.innerHTML = "";
    this.globalAssignRightListEl.innerHTML = "";

    const qL = (this.globalAssignSearchLeft || "").toLowerCase();
    const qR = (this.globalAssignSearchRight || "").toLowerCase();
    const selectedIds = this.globalAssignSelectedIds || new Set();
    const all = this.globalAssignAll || [];

    const left = [];
    const right = [];
    for (const f of all) {
      const label = this._labelFirm(f).toLowerCase();
      const isSel = selectedIds.has(f.id);
      if (isSel) {
        if (!qR || label.includes(qR)) right.push(f);
      } else if (!qL || label.includes(qL)) {
        left.push(f);
      }
    }

    const renderList = (host, items, onDbl) => {
      host.innerHTML = "";
      for (const f of items) {
        const row = document.createElement("div");
        row.textContent = this._labelFirm(f);
        row.style.padding = "6px 8px";
        row.style.borderBottom = "1px solid #eee";
        row.style.cursor = "pointer";
        row.onmouseenter = () => {
          row.style.background = "#f4f8ff";
        };
        row.onmouseleave = () => {
          row.style.background = "transparent";
        };
        row.ondblclick = () => {
          onDbl(f);
        };
        host.appendChild(row);
      }
      if (!items.length) {
        const empty = document.createElement("div");
        empty.style.padding = "8px";
        empty.style.fontSize = "12px";
        empty.style.opacity = "0.75";
        empty.textContent = "Keine Einträge.";
        host.appendChild(empty);
      }
    };

    renderList(this.globalAssignLeftListEl, left, (f) => {
      this.globalAssignSelectedIds.add(f.id);
      this._renderGlobalAssignLists();
    });
    renderList(this.globalAssignRightListEl, right, (f) => {
      this.globalAssignSelectedIds.delete(f.id);
      this._renderGlobalAssignLists();
    });
  }

  async _saveGlobalAssignments() {
    const api = window.bbmDb || {};
    if (!this.projectId) return;
    if (typeof api.projectFirmsAssignGlobalFirm !== "function") {
      this._setGlobalAssignError("API projectFirmsAssignGlobalFirm ist nicht verfügbar.");
      return;
    }
    if (typeof api.projectFirmsUnassignGlobalFirm !== "function") {
      this._setGlobalAssignError("API projectFirmsUnassignGlobalFirm ist nicht verfügbar.");
      return;
    }

    const initial = this.globalAssignInitialIds || new Set();
    const current = this.globalAssignSelectedIds || new Set();
    const toAssign = [];
    const toUnassign = [];
    for (const id of current) if (!initial.has(id)) toAssign.push(id);
    for (const id of initial) if (!current.has(id)) toUnassign.push(id);

    this._setGlobalAssignError("");
    if (this.globalAssignBtnSaveEl) this.globalAssignBtnSaveEl.disabled = true;
    let changed = false;
    let refreshAfterSave = false;
    const selectedKeyBeforeReload = this.selectedFirmKey || null;
    try {
      for (const firmId of toAssign) {
        const res = await api.projectFirmsAssignGlobalFirm({ projectId: this.projectId, firmId });
        if (!res?.ok) throw new Error(res?.error || "Zuordnung fehlgeschlagen.");
        changed = true;
      }
      for (const firmId of toUnassign) {
        const res = await api.projectFirmsUnassignGlobalFirm({ projectId: this.projectId, firmId });
        if (!res?.ok) throw new Error(res?.error || "Entfernen fehlgeschlagen.");
        changed = true;
      }
      this._closeGlobalAssignModal();
      refreshAfterSave = true;
      if (changed) this._notifyPoolDataChanged("global-assignments-saved");
    } catch (e) {
      this._setGlobalAssignError(e?.message || "Fehler beim Speichern der Zuordnung.");
    } finally {
      if (this.globalAssignBtnSaveEl) this.globalAssignBtnSaveEl.disabled = false;
      this._applyGlobalAssignState();
    }

    if (refreshAfterSave) {
      fireAndForget(
        async () => {
          await this.reloadFirms();
          if (selectedKeyBeforeReload) {
            this.selectedFirm = this.firms.find((x) => x.key === selectedKeyBeforeReload) || null;
            this.selectedFirmKey = this.selectedFirm?.key || null;
          }
          if (this.selectedFirm) await this.reloadPersonsForSelectedFirm();
        },
        "FirmsPoolView reload after saveGlobalAssignments"
      );
    }
  }

  destroy() {
    if (this.activePersonModal) {
      this.activePersonModal.close();
      this.activePersonModal = null;
    }
    this._closeGlobalAssignModal();
  }
}
