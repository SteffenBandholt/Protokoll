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
    this.btnAssignGlobalEl = null;

    this.firms = [];
    this.selectedFirmKey = null;
    this.selectedFirm = null;
    this.persons = [];
    this.selectedPersonId = null;
    this.candidates = [];
    this.candidatesByKey = new Map();

    this.loadingFirms = false;
    this.loadingPersons = false;
    this.deletingFirm = false;
    this.activePersonModal = null;

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
    return "Mitarbeiter";
  }

  _selectedFirmMeta() {
    if (!this.selectedFirm) return "Bitte links eine Firma ausw\u00e4hlen.";
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

  _personKindForSelectedFirm() {
    if (!this.selectedFirm) return "";
    return this.selectedFirm.kind === "global_firm" ? "global_person" : "project_person";
  }

  _candidateKey(kind, personId) {
    const k = String(kind || "").trim();
    const id = String(personId || "").trim();
    if (!k || !id) return "";
    return `${k}::${id}`;
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
      btn.title = "Bitte zuerst eine Projektfirma ausw\u00e4hlen.";
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

    const btnAssign = this.btnAssignGlobalEl;
    if (btnAssign) {
      const canAssign = !!this.projectId && !this.deletingFirm && !this.loadingFirms;
      btnAssign.disabled = !canAssign;
      btnAssign.style.opacity = canAssign ? "1" : "0.55";
    }
  }

  async _deleteSelectedFirm() {
    const selected = this.selectedFirm;
    if (!selected) {
      alert("Bitte zuerst eine Projektfirma ausw\u00e4hlen.");
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
      alert("Löschen ist nicht verf\u00fcgbar (Preload/IPC fehlt).");
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

  async _goToTopsView() {
    const r = this.router || null;
    const pid = this.projectId || r?.currentProjectId || null;
    if (!r || !pid || typeof r.showTops !== "function") {
      if (r && typeof r.showProjects === "function") await r.showProjects();
      return;
    }

    let meetingId = r.currentMeetingId || null;
    if (typeof window?.bbmDb?.meetingsListByProject === "function") {
      const res = await window.bbmDb.meetingsListByProject(pid);
      const list = res?.ok && Array.isArray(res.list) ? res.list : [];
      const openMeeting = list.find((m) => Number(m?.is_closed || 0) === 0) || null;
      const currentMeeting = list.find((m) => String(m?.id || "") === String(meetingId || "")) || null;
      if (!currentMeeting || Number(currentMeeting?.is_closed || 0) === 1) {
        meetingId = openMeeting?.id || null;
      }
    }

    if (!meetingId) {
      await r.showTops(null, pid);
      return;
    }

    await r.showTops(meetingId, pid);
  }

  render() {
    const root = document.createElement("div");
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "10px";
    root.style.minHeight = "0";

    const head = document.createElement("div");
    head.style.display = "grid";
    head.style.gridTemplateColumns = "1fr 1fr";
    head.style.alignItems = "center";
    head.style.columnGap = "12px";

    const title = document.createElement("h2");
    title.textContent = "Firmenpool";
    title.style.margin = "0";

    const headLeft = document.createElement("div");
    headLeft.style.display = "flex";
    headLeft.style.alignItems = "center";
    headLeft.style.gap = "8px";
    headLeft.append(title);

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "Schließen";
    applyPopupButtonStyle(btnClose);
    btnClose.onclick = async () => {
      await this._goToTopsView();
    };

    const msg = document.createElement("div");
    msg.style.fontSize = "12px";
    msg.style.opacity = "0.85";

    const headActions = document.createElement("div");
    headActions.style.display = "flex";
    headActions.style.alignItems = "center";
    headActions.style.gap = "8px";
    headActions.style.marginLeft = "auto";
    headActions.append(btnClose, msg);

    head.append(headLeft, headActions);

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
    leftTitle.textContent = "Firmen";
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

    const btnAssignGlobal = document.createElement("button");
    btnAssignGlobal.textContent = "Firma (extern) zuordnen";
    applyPopupButtonStyle(btnAssignGlobal);
    btnAssignGlobal.onclick = async () => {
      this._ensureProjectId();
      if (!this.projectId) {
        alert("Bitte zuerst ein Projekt ausw\u00e4hlen.");
        return;
      }
      if (typeof this.router?.showProjectFirms !== "function") {
        alert("Projektfirmen sind nicht verf\u00fcgbar.");
        return;
      }
      try {
        await this.router.showProjectFirms(this.projectId);
        const view = this.router?.currentView || null;
        if (view && typeof view._openGlobalAssignModal === "function") {
          await view._openGlobalAssignModal();
        } else {
          alert("Zuordnen-Dialog konnte nicht ge\u00f6ffnet werden.");
        }
      } catch (err) {
        console.error("[FirmsPoolView] open global assign failed:", err);
        alert("Zuordnen fehlgeschlagen.");
      }
    };
    btnAssignGlobal.style.marginLeft = "auto";
    headLeft.append(btnAssignGlobal);

    const btnDeleteFirm = document.createElement("button");
    btnDeleteFirm.textContent = "Löschen";
    applyPopupButtonStyle(btnDeleteFirm, { variant: "danger" });
    btnDeleteFirm.onclick = async () => {
      await this._deleteSelectedFirm();
    };

    leftActions.append(btnDeleteFirm);

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
    rightMeta.textContent = "Bitte links eine Firma ausw\u00e4hlen.";
    rightMeta.style.fontSize = "12px";
    rightMeta.style.opacity = "0.8";
    rightMeta.style.marginBottom = "8px";

    const personsTitle = document.createElement("div");
    personsTitle.textContent = "Mitarbeiter";
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
        <th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;width:70px;line-height:1;">
          <span style="display:inline-block;font-size:10px;line-height:1.05;">im<br>Pool</span>
        </th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Name</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Funktion/Rolle</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Telefon</th>
      </tr>
    `;

    const personsBody = document.createElement("tbody");
    personsTable.append(personsHead, personsBody);
    personsWrap.appendChild(personsTable);

    rightCard.append(rightHead, rightMeta, personsTitle, rightError, personsWrap);

    grid.append(leftCard, rightCard);
    root.append(head, grid);

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
    this.btnAssignGlobalEl = btnAssignGlobal;

    this._applyDeleteFirmButtonState();

    return root;
  }

  async load() {
    this._ensureProjectId();
    if (!this.projectId) {
      this._setMsg("Bitte zuerst ein Projekt ausw\u00e4hlen.");
      this.firms = [];
      this.selectedFirmKey = null;
      this.selectedFirm = null;
      this.persons = [];
      this._renderFirms();
      this._renderPersons();
      return;
    }

    await this.reloadFirms();
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
        this._setLeftError("API projectFirmsListFirmCandidatesByProject ist nicht verf\u00fcgbar.");
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
    const canDeleteGlobal = typeof api.personsDelete === "function";
    const canDeleteProject = typeof api.projectPersonsDelete === "function";
    if ((isGlobal && !canUpdateGlobal) || (!isGlobal && !canUpdateProject)) {
      alert(
        isGlobal
          ? "Bearbeiten nicht verf\u00fcgbar (personsUpdate fehlt)."
          : "Bearbeiten nicht verf\u00fcgbar (projectPersonsUpdate fehlt)."
      );
      return;
    }

    const modal = new xEmployeeEditModal({
      title: isGlobal ? "Mitarbeiter bearbeiten (Firmenstamm)" : "Mitarbeiter bearbeiten (Projektfirma)",
      initial: {
        firstName: this._personFirstName(person),
        lastName: this._personLastName(person),
        role: String(person.rolle || person.funktion || person.role || "").trim(),
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
              funktion: payload.role,
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
              funktion: payload.role,
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
      onDelete: async () => {
        const ok = window.confirm("Mitarbeiter wirklich löschen?");
        if (!ok) return;

        let res = null;
        if (isGlobal) {
          if (!canDeleteGlobal) throw new Error("Löschen nicht verfügbar (personsDelete fehlt).");
          res = await api.personsDelete(id);
        } else {
          if (!canDeleteProject) throw new Error("Löschen nicht verfügbar (projectPersonsDelete fehlt).");
          res = await api.projectPersonsDelete(id);
        }
        if (!res?.ok) throw new Error(res?.error || "Löschen fehlgeschlagen.");

        await this.reloadPersonsForSelectedFirm();
        this.selectedPersonId = null;
        this._renderPersons();
      },
    });
    this.activePersonModal = modal;
    modal.open();
  }

  async _loadProjectCandidates() {
    this.candidates = [];
    this.candidatesByKey = new Map();

    const api = window.bbmDb || {};
    if (!this.projectId || typeof api.projectCandidatesList !== "function") return;

    const res = await api.projectCandidatesList({ projectId: this.projectId });
    if (!res?.ok) {
      this._setRightError(res?.error || "Fehler beim Laden der Projektpersonen.");
      return;
    }

    const raw = Array.isArray(res.items)
      ? res.items
      : Array.isArray(res.list)
        ? res.list
        : [];

    const out = [];
    for (const it of raw) {
      const kind = String(it?.kind || "").trim();
      const personId = String(it?.personId ?? it?.person_id ?? "").trim();
      if (!kind || !personId) continue;
      const row = {
        kind,
        personId,
        is_active: this._parseActiveFlag(it?.is_active ?? it?.isActive),
      };
      out.push(row);
    }

    this.candidates = out;
    this.candidatesByKey = new Map(
      out.map((x) => [this._candidateKey(x.kind, x.personId), x])
    );
  }

  async _ensureCandidatesForPersons(kind, persons) {
    const api = window.bbmDb || {};
    if (!this.projectId || typeof api.projectCandidatesSet !== "function") return;

    const map = new Map(this.candidatesByKey);
    let changed = false;
    const defaultIsActive = String(kind || "").trim() === "global_person" ? 0 : 1;

    for (const p of persons || []) {
      const personId = this._personId(p);
      const key = this._candidateKey(kind, personId);
      if (!key || map.has(key)) continue;
      map.set(key, { kind, personId, is_active: defaultIsActive });
      changed = true;
    }

    if (!changed) return;

    const items = Array.from(map.values()).map((x) => ({
      kind: x.kind,
      personId: x.personId,
      isActive: this._parseActiveFlag(x.is_active) === 1,
    }));

    const res = await api.projectCandidatesSet({ projectId: this.projectId, items });
    if (!res?.ok) {
      this._setRightError(res?.error || "Aktiv-Status konnte nicht gespeichert werden.");
      return;
    }

    this.candidatesByKey = map;
    this.candidates = Array.from(map.values());
    this._notifyPoolDataChanged("person-candidates-upserted");
  }

  async _setPersonCandidateActive(person, isActive) {
    const api = window.bbmDb || {};
    const kind = this._personKindForSelectedFirm();
    const personId = this._personId(person);
    if (!this.projectId || !kind || !personId) return false;

    const key = this._candidateKey(kind, personId);
    if (!key) return false;

    this._setRightError("");

    if (!this.candidatesByKey.has(key)) {
      if (!isActive) return true;
      await this._ensureCandidatesForPersons(kind, [person]);
      return this.candidatesByKey.has(key);
    }

    if (typeof api.projectCandidatesSetActive === "function") {
      const res = await api.projectCandidatesSetActive({
        projectId: this.projectId,
        kind,
        personId,
        isActive: !!isActive,
      });
      if (!res?.ok) {
        this._setRightError(res?.error || "Aktiv/Inaktiv konnte nicht gespeichert werden.");
        return false;
      }
    } else if (typeof api.projectCandidatesSet === "function") {
      const map = new Map(this.candidatesByKey);
      const prev = map.get(key) || { kind, personId, is_active: 1 };
      map.set(key, { ...prev, is_active: this._parseActiveFlag(isActive) });
      const items = Array.from(map.values()).map((x) => ({
        kind: x.kind,
        personId: x.personId,
        isActive: this._parseActiveFlag(x.is_active) === 1,
      }));
      const res = await api.projectCandidatesSet({ projectId: this.projectId, items });
      if (!res?.ok) {
        this._setRightError(res?.error || "Aktiv/Inaktiv konnte nicht gespeichert werden.");
        return false;
      }
      this.candidatesByKey = map;
      this.candidates = Array.from(map.values());
      this._notifyPoolDataChanged("person-candidate-active-changed");
      return true;
    } else {
      this._setRightError("API projectCandidatesSetActive ist nicht verf\u00fcgbar.");
      return false;
    }

    const next = this._parseActiveFlag(isActive);
    const current = this.candidatesByKey.get(key) || { kind, personId };
    this.candidatesByKey.set(key, { ...current, is_active: next });
    this.candidates = Array.from(this.candidatesByKey.values());
    this._notifyPoolDataChanged("person-candidate-active-changed");
    return true;
  }

  async reloadPersonsForSelectedFirm() {
    this._setRightError("");
    this.persons = [];
    this.loadingPersons = true;
    this._renderPersons();

    try {
      if (!this.selectedFirm) {
        this.candidates = [];
        this.candidatesByKey = new Map();
        return;
      }

      const api = window.bbmDb || {};
      let res = null;
      if (this.selectedFirm.kind === "project_firm") {
        if (typeof api.projectPersonsListByProjectFirm !== "function") {
          this._setRightError("API projectPersonsListByProjectFirm ist nicht verf\u00fcgbar.");
          return;
        }
        res = await api.projectPersonsListByProjectFirm(this.selectedFirm.id);
      } else {
        if (typeof api.personsListByFirm !== "function") {
          this._setRightError("API personsListByFirm ist nicht verf\u00fcgbar.");
          return;
        }
        res = await api.personsListByFirm(this.selectedFirm.id);
      }

      if (!res?.ok) {
        this._setRightError(res?.error || "Fehler beim Laden der Mitarbeiter.");
        return;
      }

      this.persons = Array.isArray(res.list) ? res.list : [];
      await this._loadProjectCandidates();
      const kind = this._personKindForSelectedFirm();
      if (kind) {
        await this._ensureCandidatesForPersons(kind, this.persons);
      }
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
      tdType.textContent = isGlobal ? "extern" : "intern";

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
      td.textContent = "Bitte links eine Firma ausw\u00e4hlen.";
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

      const kind = this._personKindForSelectedFirm();
      const key = this._candidateKey(kind, pid);
      const candidate = this.candidatesByKey.get(key) || null;
      const isActive = candidate ? this._parseActiveFlag(candidate.is_active) === 1 : true;

      const tdActive = document.createElement("td");
      tdActive.style.padding = "6px";
      tdActive.style.borderBottom = "1px solid #eee";
      tdActive.style.textAlign = "center";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isActive;
      cb.disabled = this.loadingPersons || this.loadingFirms || this.deletingFirm;
      cb.onclick = (e) => e.stopPropagation();
      cb.onchange = async (e) => {
        e.stopPropagation();
        const ok = await this._setPersonCandidateActive(p, cb.checked);
        if (!ok) cb.checked = !cb.checked;
      };
      tdActive.appendChild(cb);

      const tdName = document.createElement("td");
      tdName.style.padding = "6px";
      tdName.style.borderBottom = "1px solid #eee";
      tdName.textContent = this._personName(p);

      const tdRole = document.createElement("td");
      tdRole.style.padding = "6px";
      tdRole.style.borderBottom = "1px solid #eee";
      tdRole.textContent = String(p.rolle || p.funktion || p.role || "").trim() || "—";

      const tdPhone = document.createElement("td");
      tdPhone.style.padding = "6px";
      tdPhone.style.borderBottom = "1px solid #eee";
      tdPhone.textContent = String(p.phone || p.funktion || "").trim() || "—";

      tr.append(tdActive, tdName, tdRole, tdPhone);
      tb.appendChild(tr);
    }
  }

  destroy() {
    if (this.activePersonModal) {
      this.activePersonModal.close();
      this.activePersonModal = null;
    }
  }
}
