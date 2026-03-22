// src/renderer/views/ProjectFirmsView.js
//
// LOKALE Firmen (je Projekt) + LOKALE Mitarbeiter (je Projektfirma)
// + GLOBAL-Firmen dem Projekt zuordnen (nur Zuordnung, keine Mitarbeiter hier)
//
// NEU:
import { applyPopupButtonStyle, applyPopupCardStyle } from "../ui/popupButtonStyles.js";
import { OVERLAY, OVERLAY_TOP } from "../ui/zIndex.js";
import FirmsView from "./FirmsView.js";
import { fireAndForget } from "../utils/async.js";
// - Hauptscreen: 2 Spalten nebeneinander
//   links: "Lokale Firmen" (Kurzbezeichnung + Funktion/Gewerk) + bestehender Editor weiter genutzt
//   rechts: "Globale Firmen" (nur zugeordnet) + Button "Global zuordnen"
// - "Global zuordnen": Zuordnungsmaske (Modal) mit 2 Listen (alle vs zugeordnet),
//   Doppelklick zum HinzufÃ¼gen/Entfernen, Speichern persistiert Zielzustand (Diff -> assign/unassign)
//
// WICHTIG (User-Wunsch):
// - Die Zuordnungsmaske MUSS bei Klick auf "Speichern" geschlossen werden.
//   => Modal schlieÃŸt sofort, Speichern lÃ¤uft danach weiter; Fehler werden per alert angezeigt.

export default class ProjectFirmsView {
  constructor({ router, projectId, readOnly } = {}) {
    this.router = router;

    // wichtig: projektId robust ziehen (nicht nur ctor-arg)
    this.projectId = projectId || this.router?.currentProjectId || null;

    // optionaler Readonly-Override (wenn euer Kontext sowas hat)
    this.readOnly = typeof readOnly === "boolean" ? readOnly : undefined;

    this.root = null;

    // state (lokal)
    this.firms = [];
    this.selectedFirmId = null;
    this.selectedFirm = null;

    this.persons = [];

    // modes
    this.firmMode = "none"; // "none" | "create" | "edit"
    this.personMode = "none"; // "none" | "create" | "edit"
    this.editPersonId = null;

    // busy
    this.savingFirm = false;
    this.savingPerson = false;

    // state (global assignment)
    this.globalFirms = []; // alle globalen Firmen (firmsListGlobal)
    this.assignedGlobalFirms = []; // zugeordnete globale Firmen (fÃ¼r Hauptscreen rechts)

    // modal state
    this.globalAssignOpen = false;
    this.globalAssignAll = []; // alle globalen Firmen fÃ¼r Modal
    this.globalAssignSelectedIds = new Set(); // rechter Zustand im Modal
    this.globalAssignInitialIds = new Set(); // Initialzustand (fÃ¼r Diff)
    this.globalAssignErr = "";
    this.savingGlobalAssign = false;

    // ui refs
    this.msgEl = null;

    // local firms list refs
    this.tableBodyEl = null;
    this.btnNewFirm = null;
    this.btnImportCsv = null;
    this.btnEditFirmList = null;
    this.btnDeleteFirmList = null;
    this.btnImportPersonsCsv = null;

    // firm editor refs
    this.editWrapEl = null;
    this.firmGridEl = null;
    this.firmButtonsEl = null;

    // firm inputs
    this.inpFirmShort = null;
    this.inpFirmName1 = null;
    this.inpFirmName2 = null;
    this.inpFirmStreet = null;
    this.inpFirmZip = null;
    this.inpFirmCity = null;
    this.inpFirmPhone = null;
    this.inpFirmEmail = null;
    this.inpFirmGewerk = null;
    this.selFirmRole = null;
    this.taFirmNotes = null;

    this.btnSaveFirm = null;
    this.btnDeleteFirm = null;

    // persons
    this.personTableBodyEl = null;
    this.btnNewPerson = null;

    this.personFormEl = null;
    this.detailFirmTitleEl = null;
    this.detailFirmBodyEl = null;
    this.btnEditSelectedFirm = null;
    this.btnDeleteSelectedFirm = null;

    this.inpFirstName = null;
    this.inpLastName = null;
    this.inpFunktion = null;
    this.inpPhone = null;
    this.inpEmail = null;
    this.inpRolle = null;
    this.taPersonNotes = null;

    this.btnSavePerson = null;
    this.btnCancelPerson = null;
    this.btnDeletePerson = null;

    // local firm modal refs (create + edit)
    this.localFirmCreateOpen = false;
    this.localFirmModalMode = "create";
    this.localFirmEditId = null;
    this.localFirmOverlayEl = null;
    this.localFirmErrEl = null;
    this.localFirmTitleEl = null;
    this.localFirmInpName1 = null;
    this.localFirmInpName2 = null;
    this.localFirmInpShort = null;
    this.localFirmInpStreet = null;
    this.localFirmInpZip = null;
    this.localFirmInpCity = null;
    this.localFirmInpPhone = null;
    this.localFirmInpEmail = null;
    this.localFirmInpGewerk = null;
    this.localFirmSelRole = null;
    this.localFirmTaNotes = null;
    this.localFirmBtnSaveEl = null;
    this.localFirmBtnDeleteEl = null;
    this.localFirmBtnCancelEl = null;
    this.localFirmBtnCloseEl = null;

    // local person modal refs (create + edit)
    this.localPersonCreateOpen = false;
    this.localPersonModalMode = "create";
    this.localPersonEditId = null;
    this.localPersonOverlayEl = null;
    this.localPersonErrEl = null;
    this.localPersonTitleEl = null;
    this.localPersonInpFirstName = null;
    this.localPersonInpLastName = null;
    this.localPersonInpFunktion = null;
    this.localPersonInpPhone = null;
    this.localPersonInpEmail = null;
    this.localPersonInpRolle = null;
    this.localPersonTaNotes = null;
    this.localPersonBtnSaveEl = null;
    this.localPersonBtnDeleteEl = null;
    this.localPersonBtnCancelEl = null;
    this.localPersonBtnCloseEl = null;

    // global main (right column)
    this.globalAssignedBodyEl = null;
    this.btnGlobalAssign = null;

    this.isNewUi = this._readUiMode() === "new";

    // global assign modal refs
    this.globalAssignOverlayEl = null;
    this.globalAssignErrEl = null;
    this.globalAssignLeftListEl = null;
    this.globalAssignRightListEl = null;
    this.globalAssignBtnSaveEl = null;
    this.globalAssignBtnCancelEl = null;
    this.globalAssignBtnCloseEl = null;

    this.roleOrder = this._defaultRoleOrder();
    this.roleLabels = this._defaultRoleLabels();

    this.importPopupView = new FirmsView({
      router: this.router,
      importContext: "projekt",
      getImportProjectId: () => {
        this._ensureProjectId();
        return this.projectId;
      },
      getImportProjectFirmId: () => {
        return this._hasFirmSelectedSaved() ? this.selectedFirmId : "";
      },
      lockPersonImportFirmSelection: true,
      onImportRefresh: async () => {
        const selectedFirmId = this._hasFirmSelectedSaved() ? this.selectedFirmId : "";
        const selectedFirmIsAssignedGlobal =
          !!selectedFirmId && this._selectedFirmIsAssignedGlobal();
        try {
          await this.reloadFirms();
          await this.reloadGlobalAssignments();
          if (selectedFirmIsAssignedGlobal) {
            await this._ensureGlobalFirmPersonsProjectCandidates(selectedFirmId);
          }
          if (this._hasFirmSelectedSaved()) {
            await this._reloadPersons();
          }
        } finally {
          this.savingFirm = false;
          this.savingPerson = false;
          this.savingGlobalAssign = false;
          this._applyFirmFormState();
          this._applyPersonFormState();
          this._applyGlobalAssignState();
        }
      },
    });
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  render() {
    const root = document.createElement("div");

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";
    head.style.marginBottom = "10px";

    const title = document.createElement("h2");
    title.textContent = "Firmen";
    title.style.margin = "0";

    const viewLabel = document.createElement("div");
    viewLabel.textContent = "";
    viewLabel.style.fontSize = "16px";
    viewLabel.style.fontWeight = "600";
    viewLabel.style.opacity = "0.9";

    const viewScope = document.createElement("div");
    viewScope.textContent = this._projectScopeText();
    viewScope.style.fontSize = "16px";
    viewScope.style.fontWeight = "600";
    viewScope.style.opacity = "0.9";

    const titleWrap = document.createElement("div");
    titleWrap.style.display = "inline-flex";
    titleWrap.style.alignItems = "baseline";
    titleWrap.style.gap = "10px";
    titleWrap.append(title, viewLabel, viewScope);

    const btnToProject = document.createElement("button");
    btnToProject.type = "button";
    btnToProject.textContent = "Zum Projekt";
    applyPopupButtonStyle(btnToProject);
    btnToProject.onclick = async () => {
      const r = this.router || null;
      const pid = this.projectId || r?.currentProjectId || null;
      if (!r || !pid || typeof r.showTops !== "function") {
        if (r && typeof r.showProjects === "function") await r.showProjects();
        return;
      }

      let meetingId = r.currentMeetingId || null;
      if (!meetingId && typeof window?.bbmDb?.meetingsListByProject === "function") {
        const res = await window.bbmDb.meetingsListByProject(pid);
        if (res?.ok && Array.isArray(res.list) && res.list.length) {
          meetingId = res.list[0]?.id || null;
        }
      }

      if (!meetingId) {
        alert("Keine Besprechung vorhanden. Bitte zuerst ein Protokoll anlegen.");
        return;
      }

      await r.showTops(meetingId, pid);
    };

    const msg = document.createElement("div");
    msg.style.marginLeft = "auto";
    msg.style.fontSize = "12px";
    msg.style.opacity = "0.85";

    head.append(titleWrap, msg);

    // ------------------------------------------------------------
    // Layout: Lokale Firmen
    // ------------------------------------------------------------
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "12px";
    grid.style.alignItems = "start";

    // ------------------------------------------------------------
    // LINKS: Lokale Firmen
    // ------------------------------------------------------------
    const localCol = document.createElement("div");
    localCol.style.display = "flex";
    localCol.style.flexDirection = "column";
    localCol.style.gap = "12px";
    localCol.style.position = "relative";

    const localTopActions = document.createElement("div");
    localTopActions.style.display = "flex";
    localTopActions.style.justifyContent = "flex-end";
    localTopActions.style.width = "100%";
    localTopActions.style.position = "absolute";
    localTopActions.style.top = "-42px";
    localTopActions.style.left = "0";
    localTopActions.append(btnToProject);

    const listWrap = document.createElement("div");
    applyPopupCardStyle(listWrap);
    listWrap.style.padding = "10px";

    const listHead = document.createElement("div");
    listHead.style.display = "flex";
    listHead.style.alignItems = "center";
    listHead.style.justifyContent = "space-between";
    listHead.style.gap = "8px";
    listHead.style.marginBottom = "8px";

    const localTitle = document.createElement("div");
    localTitle.textContent = "Firmen im Projekt";
    localTitle.style.fontWeight = "bold";

    const btnNewFirm = document.createElement("button");
    btnNewFirm.textContent = "Neue Firma";
    applyPopupButtonStyle(btnNewFirm);
    btnNewFirm.onclick = async () => {
      if (this._isReadOnly()) return;
      if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;

      // projektId immer nochmal nachziehen
      this._ensureProjectId();
      if (!this.projectId) {
        alert("Bitte zuerst ein Projekt auswÃ¤hlen.");
        return;
      }

      this._openLocalFirmCreateModal();
    };
    const listActions = document.createElement("div");
    listActions.style.display = "flex";
    listActions.style.gap = "6px";

    const btnGlobalAssign = document.createElement("button");
    btnGlobalAssign.textContent = "Aus globaler Liste hinzufuegen";
    applyPopupButtonStyle(btnGlobalAssign);
    btnGlobalAssign.onclick = async () => {
      if (this._isReadOnly()) return;
      if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;
      await this._openGlobalAssignModal();
    };

    const btnImportCsv = document.createElement("button");
    btnImportCsv.textContent = "Import (CSV)";
    applyPopupButtonStyle(btnImportCsv);
    btnImportCsv.onclick = () => {
      if (this._isReadOnly()) return;
      if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;
      this._openProjectFirmImportModal();
    };

    listActions.append(btnNewFirm, btnGlobalAssign, btnImportCsv);

    listHead.append(localTitle, listActions);

    const firmsTable = document.createElement("table");
    firmsTable.style.width = "100%";
    firmsTable.style.borderCollapse = "collapse";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;width:160px;">Kurzbez.</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Funktion/Gewerk</th>
        <th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;width:70px;">Aktiv</th>
      </tr>
    `;

    const tbody = document.createElement("tbody");
    firmsTable.append(thead, tbody);

    const listHint = document.createElement("div");
    listHint.textContent = "Aktiv = Firma ist in der Verantwortlich-Auswahl f\u00fcr TOPs sichtbar.";
    listHint.style.fontSize = "12px";
    listHint.style.opacity = "0.75";
    listHint.style.marginBottom = "6px";

    listWrap.append(listHead, listHint, firmsTable);

    // ------------------------------------------------------------
    // Lokale Firmen Editbox (bestehend, weiterverwendet)
    // ------------------------------------------------------------
    const editWrap = document.createElement("div");
    applyPopupCardStyle(editWrap);
    editWrap.style.padding = "10px";
    editWrap.style.background = "#fff";
    editWrap.style.display = "none";
    editWrap.style.minHeight = "240px";
    editWrap.style.maxHeight = "240px";
    editWrap.style.overflow = "hidden";

    const detailHead = document.createElement("div");
    detailHead.style.display = "flex";
    detailHead.style.alignItems = "center";
    detailHead.style.justifyContent = "flex-start";
    detailHead.style.gap = "0";
    detailHead.style.marginBottom = "8px";

    const editTitle = document.createElement("div");
    editTitle.textContent = "-";
    editTitle.style.fontWeight = "bold";
    editTitle.style.fontSize = "16px";

    const detailBody = document.createElement("div");
    detailBody.style.display = "flex";
    detailBody.style.flexDirection = "column";
    detailBody.style.gap = "6px";
    detailBody.style.fontSize = "14px";
    detailBody.style.color = "#1a1a1a";
    detailBody.style.opacity = "0.92";
    detailBody.style.marginBottom = "12px";

    const detailActions = document.createElement("div");
    detailActions.style.display = "flex";
    detailActions.style.alignItems = "center";
    detailActions.style.gap = "8px";
    detailActions.style.marginBottom = "4px";

    const btnEditSelectedFirm = document.createElement("button");
    btnEditSelectedFirm.textContent = "Bearbeiten";
    applyPopupButtonStyle(btnEditSelectedFirm);
    btnEditSelectedFirm.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._isReadOnly()) return;
      if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;
      if (!this.selectedFirm) return;
      this._openLocalFirmEditModal(this.selectedFirm);
    };

    const btnDeleteSelectedFirm = document.createElement("button");
    btnDeleteSelectedFirm.textContent = "Loeschen";
    applyPopupButtonStyle(btnDeleteSelectedFirm, { variant: "danger" });
    btnDeleteSelectedFirm.title = "Loeschen";
    btnDeleteSelectedFirm.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._isReadOnly()) return;
      if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;
      if (!this.selectedFirmId || !this.selectedFirm || this.firmMode !== "edit") return;
      await this._deleteFirm();
    };

    detailActions.append(btnEditSelectedFirm, btnDeleteSelectedFirm);
    detailHead.append(editTitle);

    const mkLbl = (t) => {
      const d = document.createElement("div");
      d.textContent = t;
      return d;
    };

    const mkInp = (ph) => {
      const i = document.createElement("input");
      i.type = "text";
      i.placeholder = ph || "";
      i.style.width = "100%";
      return i;
    };
    const mkGewerkDatalist = (id) => {
      const dl = document.createElement("datalist");
      dl.id = id;
      ["Rohbau", "HLS", "Elektro", "Trockenbau", "Gala-Bau", "Erdarbeiten", "Abbruch"].forEach(
        (label) => {
          const opt = document.createElement("option");
          opt.value = label;
          dl.appendChild(opt);
        }
      );
      return dl;
    };

    const firmGrid = document.createElement("div");
    firmGrid.style.display = "grid";
    firmGrid.style.gridTemplateColumns = "160px 1fr";
    firmGrid.style.gap = "8px";
    firmGrid.style.alignItems = "center";
    firmGrid.style.marginBottom = "10px";

    const inpFirmName1 = mkInp("Name 1â€¦");
    const inpFirmName2 = mkInp("Name 2â€¦");
    const inpFirmShort = mkInp("verantw. im Projekt");
    const inpFirmStreet = mkInp("StraÃŸe / HsNrâ€¦");
    const inpFirmZip = mkInp("PLZâ€¦");
    const inpFirmCity = mkInp("Ortâ€¦");
    const inpFirmPhone = mkInp("Telefonâ€¦");

    const inpFirmEmail = document.createElement("input");
    inpFirmEmail.type = "email";
    inpFirmEmail.placeholder = "E-Mailâ€¦";
    inpFirmEmail.style.width = "100%";

    const inpFirmGewerk = mkInp("Funktion / Gewerk?");
    inpFirmGewerk.setAttribute("list", "firm-gewerk-options-project");
    const firmGewerkList = mkGewerkDatalist("firm-gewerk-options-project");

    const selFirmRole = document.createElement("select");
    selFirmRole.style.width = "100%";
    this._renderRoleOptions(selFirmRole);

const taFirmNotes = document.createElement("textarea");
    taFirmNotes.placeholder = "Notizenâ€¦";
    taFirmNotes.rows = 4;
    taFirmNotes.style.width = "100%";

    firmGrid.append(
      mkLbl("Name 1"),
      inpFirmName1,
      mkLbl("Name 2"),
      inpFirmName2,
      mkLbl("Kurzbez."),
      inpFirmShort,
      mkLbl("Str. / HsNr."),
      inpFirmStreet,
      mkLbl("PLZ"),
      inpFirmZip,
      mkLbl("Ort"),
      inpFirmCity,
      mkLbl("Telefon"),
      inpFirmPhone,
      mkLbl("E-Mail"),
      inpFirmEmail,
      mkLbl("Funktion/Gewerk"),
      inpFirmGewerk,
      mkLbl("Kategorie"),
      selFirmRole,
      mkLbl("Notizen"),
      taFirmNotes
    );

    const firmButtons = document.createElement("div");
    firmButtons.style.display = "flex";
    firmButtons.style.gap = "8px";
    firmButtons.style.marginBottom = "12px";

    const btnSaveFirm = document.createElement("button");
    btnSaveFirm.textContent = "Speichern";
    btnSaveFirm.onclick = async () => {
      await this._saveFirm();
    };

    firmButtons.append(btnSaveFirm);

    const personsWrap = document.createElement("div");
    applyPopupCardStyle(personsWrap);
    personsWrap.style.padding = "10px";
    personsWrap.style.display = "flex";
    personsWrap.style.flexDirection = "column";
    personsWrap.style.gap = "8px";
    personsWrap.style.minHeight = "0";

    // ---- Persons (lokal) ----
    const personsTitle = document.createElement("div");
    personsTitle.textContent = "Mitarbeiter";
    personsTitle.style.fontWeight = "bold";
    personsTitle.style.margin = "0";

    const personsHead = document.createElement("div");
    personsHead.style.display = "flex";
    personsHead.style.gap = "8px";
    personsHead.style.alignItems = "center";
    personsHead.style.marginBottom = "8px";

    const btnNewPerson = document.createElement("button");
    btnNewPerson.textContent = "Mitarbeiter hinzufuegen";
    applyPopupButtonStyle(btnNewPerson);
    btnNewPerson.onclick = () => {
      if (this._isReadOnly()) return;
      if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;
      if (!this._hasFirmSelectedSaved()) return;
      this._openLocalPersonCreateModal();
    };

    const btnImportPersonsCsv = document.createElement("button");
    btnImportPersonsCsv.textContent = "Import Kontakt (CSV)";
    applyPopupButtonStyle(btnImportPersonsCsv);
    btnImportPersonsCsv.onclick = () => {
      if (this._isReadOnly()) return;
      if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;
      this._openProjectPersonImportModal();
    };

    personsHead.append(btnNewPerson, btnImportPersonsCsv);

    const personsTable = document.createElement("table");
    personsTable.style.width = "100%";
    personsTable.style.borderCollapse = "collapse";

    const personsThead = document.createElement("thead");
    personsThead.innerHTML = `
      <tr>
        <th style="text-align:center;padding:6px;border-bottom:1px solid #ddd;">Aktiv</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Name</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Funktion/Rolle</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">E-Mail</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Telefon</th>
      </tr>
    `;

    const personsTbody = document.createElement("tbody");
    personsTable.append(personsThead, personsTbody);

    const personsTableWrap = document.createElement("div");
    personsTableWrap.style.flex = "1 1 auto";
    personsTableWrap.style.minHeight = "0";
    personsTableWrap.style.overflowY = "auto";
    personsTableWrap.style.border = "1px solid #e2e8f0";
    personsTableWrap.style.borderRadius = "8px";
    personsTableWrap.appendChild(personsTable);

    const personForm = document.createElement("div");
    personForm.style.marginTop = "10px";
    personForm.style.borderTop = "1px dashed #ddd";
    personForm.style.paddingTop = "10px";
    personForm.style.display = "none";

    const pGrid = document.createElement("div");
    pGrid.style.display = "grid";
    pGrid.style.gridTemplateColumns = "160px 1fr";
    pGrid.style.gap = "8px";
    pGrid.style.alignItems = "center";
    pGrid.style.marginBottom = "10px";

    const inpFirstName = mkInp("Vornameâ€¦");
    const inpLastName = mkInp("Nachnameâ€¦");
    const inpFunktionRolle = mkInp("Funktion/Rolleâ€¦");

    const inpEmail = document.createElement("input");
    inpEmail.type = "email";
    inpEmail.placeholder = "E-Mailâ€¦";
    inpEmail.style.width = "100%";

    const inpPhone = mkInp("Telefonâ€¦");

    const taPersonNotes = document.createElement("textarea");
    taPersonNotes.placeholder = "Notizenâ€¦";
    taPersonNotes.rows = 3;
    taPersonNotes.style.width = "100%";

    pGrid.append(
      mkLbl("Vorname"),
      inpFirstName,
      mkLbl("Nachname"),
      inpLastName,
      mkLbl("Funktion/Rolle"),
      inpFunktionRolle,
      mkLbl("E-Mail"),
      inpEmail,
      mkLbl("Telefon"),
      inpPhone,
      mkLbl("Notizen"),
      taPersonNotes
    );

    const pButtons = document.createElement("div");
    pButtons.style.display = "flex";
    pButtons.style.gap = "8px";

    const btnSavePerson = document.createElement("button");
    btnSavePerson.textContent = "Speichern";
    btnSavePerson.onclick = async () => {
      await this._savePerson();
    };

    const btnCancelPerson = document.createElement("button");
    btnCancelPerson.textContent = "Abbrechen";
    btnCancelPerson.onclick = () => {
      this.personMode = "none";
      this.editPersonId = null;
      this._applyPersonFormState();
      this._updateVisibility();
    };

    const btnDeletePerson = document.createElement("button");
    btnDeletePerson.textContent = "Loeschen";
    btnDeletePerson.style.background = "#c62828";
    btnDeletePerson.style.color = "white";
    btnDeletePerson.style.border = "1px solid rgba(0,0,0,0.25)";
    btnDeletePerson.style.borderRadius = "6px";
    btnDeletePerson.style.padding = "6px 10px";
    btnDeletePerson.title = "Loeschen";
    btnDeletePerson.onclick = async () => {
      if (!this.editPersonId) return;
      await this._deletePerson(this.editPersonId);
    };

    pButtons.append(btnSavePerson, btnCancelPerson, btnDeletePerson);
    personForm.append(pGrid, pButtons);

    editWrap.append(detailHead, detailBody, detailActions, firmGrid, firmButtons, firmGewerkList);
    personsWrap.append(personsTitle, personsHead, personsTableWrap, personForm);

    localCol.append(localTopActions, listWrap);

    const detailCol = document.createElement("div");
    detailCol.style.display = "flex";
    detailCol.style.flexDirection = "column";
    detailCol.style.gap = "12px";
    detailCol.style.minWidth = "0";
    detailCol.append(editWrap, personsWrap);

    // ------------------------------------------------------------
    // Modal: Global zuordnen (Dual-List)
    // ------------------------------------------------------------
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = String(OVERLAY);
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
    modal.style.width = "min(980px, calc(100vw - 24px))";
    modal.style.maxHeight = "calc(100vh - 24px)";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.overflow = "hidden";
    modal.style.background = "#fff";
    modal.style.borderRadius = "10px";
    modal.style.border = "1px solid rgba(0,0,0,0.15)";
    modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
    modal.style.padding = "0";

    const modalHead = document.createElement("div");
    modalHead.style.display = "flex";
    modalHead.style.alignItems = "center";
    modalHead.style.justifyContent = "space-between";
    modalHead.style.gap = "10px";
    modalHead.style.padding = "12px";
    modalHead.style.borderBottom = "1px solid #e2e8f0";

    const modalTitle = document.createElement("div");
    modalTitle.textContent = "Aus globaler Liste hinzufuegen";
    modalTitle.style.fontWeight = "bold";

    const btnClose = document.createElement("button");
    btnClose.textContent = "?";
    applyPopupButtonStyle(btnClose);
    btnClose.onclick = () => this._closeGlobalAssignModal();

    modalHead.append(modalTitle, btnClose);

    const modalErr = document.createElement("div");
    modalErr.style.color = "#c62828";
    modalErr.style.fontSize = "12px";
    modalErr.style.marginBottom = "8px";
    modalErr.style.display = "none";

    const modalGrid = document.createElement("div");
    modalGrid.style.display = "grid";
    modalGrid.style.gridTemplateColumns = "1fr 1fr";
    modalGrid.style.gap = "12px";

    const modalBody = document.createElement("div");
    modalBody.style.flex = "1 1 auto";
    modalBody.style.minHeight = "0";
    modalBody.style.overflow = "auto";
    modalBody.style.padding = "12px";

    const mkListCol = (titleText) => {
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
      list.style.height = "360px";
      list.style.overflow = "auto";
      list.style.background = "#fafafa";

      col.append(t, list);
      return { col, list };
    };

    const leftCol = mkListCol("Globale Firmen");
    const rightCol = mkListCol("Firmen im Projekt");

    modalGrid.append(leftCol.col, rightCol.col);

    const modalFoot = document.createElement("div");
    modalFoot.style.display = "flex";
    modalFoot.style.justifyContent = "space-between";
    modalFoot.style.alignItems = "center";
    modalFoot.style.gap = "8px";
    modalFoot.style.borderTop = "1px solid #e2e8f0";
    modalFoot.style.padding = "10px 12px";
    const modalHint = document.createElement("div");
    modalHint.textContent = "Doppelklick fuegt hinzu oder entfernt";
    modalHint.style.fontSize = "12px";
    modalHint.style.opacity = "0.75";

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel);
    btnCancel.onclick = () => this._closeGlobalAssignModal();

    const btnSave = document.createElement("button");
    btnSave.textContent = "Speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });
    btnSave.onclick = async () => {
      await this._saveGlobalAssignModal();
    };

    const modalActions = document.createElement("div");
    modalActions.style.display = "flex";
    modalActions.style.gap = "8px";
    modalActions.append(btnCancel, btnSave);
    modalFoot.append(modalHint, modalActions);

    modalBody.append(modalErr, modalGrid);
    modal.append(modalHead, modalBody, modalFoot);
    overlay.appendChild(modal);

    // ------------------------------------------------------------
    // Modal: Neue lokale Firma
    // ------------------------------------------------------------
    const localFirmOverlay = document.createElement("div");
    localFirmOverlay.style.position = "fixed";
    localFirmOverlay.style.inset = "0";
    localFirmOverlay.style.background = "rgba(0,0,0,0.35)";
    localFirmOverlay.style.display = "none";
    localFirmOverlay.style.alignItems = "center";
    localFirmOverlay.style.justifyContent = "center";
    localFirmOverlay.style.zIndex = String(OVERLAY_TOP);
    localFirmOverlay.onclick = (e) => {
      if (e.target === localFirmOverlay) this._closeLocalFirmCreateModal();
    };
    localFirmOverlay.tabIndex = -1;
    localFirmOverlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this._closeLocalFirmCreateModal();
      }
    });

    const localFirmModal = document.createElement("div");
    localFirmModal.style.width = "min(860px, calc(100vw - 24px))";
    localFirmModal.style.maxHeight = "calc(100vh - 24px)";
    localFirmModal.style.display = "flex";
    localFirmModal.style.flexDirection = "column";
    localFirmModal.style.overflow = "hidden";
    localFirmModal.style.background = "#fff";
    localFirmModal.style.borderRadius = "10px";
    localFirmModal.style.border = "1px solid rgba(0,0,0,0.15)";
    localFirmModal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
    localFirmModal.style.padding = "0";

    const localFirmHead = document.createElement("div");
    localFirmHead.style.display = "flex";
    localFirmHead.style.alignItems = "center";
    localFirmHead.style.justifyContent = "space-between";
    localFirmHead.style.gap = "10px";
    localFirmHead.style.padding = "12px";
    localFirmHead.style.borderBottom = "1px solid #e2e8f0";

    const localFirmTitle = document.createElement("div");
    localFirmTitle.textContent = "Neue Firma";
    localFirmTitle.style.fontWeight = "bold";

    const localFirmBtnClose = document.createElement("button");
    localFirmBtnClose.textContent = "X";
    applyPopupButtonStyle(localFirmBtnClose);
    localFirmBtnClose.onclick = () => this._closeLocalFirmCreateModal();
    localFirmHead.append(localFirmTitle, localFirmBtnClose);

    const localFirmErr = document.createElement("div");
    localFirmErr.style.color = "#c62828";
    localFirmErr.style.fontSize = "12px";
    localFirmErr.style.marginBottom = "8px";
    localFirmErr.style.display = "none";

    const mkModalRow = (labelText, inputEl) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "160px 1fr";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.marginBottom = "8px";
      const lbl = document.createElement("div");
      lbl.textContent = labelText;
      row.append(lbl, inputEl);
      return row;
    };

    const localFirmBody = document.createElement("div");
    localFirmBody.style.flex = "1 1 auto";
    localFirmBody.style.minHeight = "0";
    localFirmBody.style.overflow = "auto";
    localFirmBody.style.padding = "12px";
    const localFirmName1 = document.createElement("input");
    localFirmName1.type = "text";
    localFirmName1.placeholder = "Name 1";
    localFirmName1.style.width = "100%";
    const localFirmName2 = document.createElement("input");
    localFirmName2.type = "text";
    localFirmName2.placeholder = "Name 2";
    localFirmName2.style.width = "100%";
    const localFirmShort = document.createElement("input");
    localFirmShort.type = "text";
    localFirmShort.placeholder = "verantw. im Projekt";
    localFirmShort.style.width = "100%";
    const localFirmStreet = document.createElement("input");
    localFirmStreet.type = "text";
    localFirmStreet.placeholder = "Strasse / HsNr.";
    localFirmStreet.style.width = "100%";
    const localFirmZip = document.createElement("input");
    localFirmZip.type = "text";
    localFirmZip.placeholder = "PLZ";
    localFirmZip.style.width = "100%";
    const localFirmCity = document.createElement("input");
    localFirmCity.type = "text";
    localFirmCity.placeholder = "Ort";
    localFirmCity.style.width = "100%";
    const localFirmPhone = document.createElement("input");
    localFirmPhone.type = "text";
    localFirmPhone.placeholder = "Telefon";
    localFirmPhone.style.width = "100%";
    const localFirmEmail = document.createElement("input");
    localFirmEmail.type = "email";
    localFirmEmail.placeholder = "E-Mail";
    localFirmEmail.style.width = "100%";
    const localFirmGewerk = document.createElement("input");
    localFirmGewerk.type = "text";
    localFirmGewerk.placeholder = "Funktion/Gewerk";
    localFirmGewerk.style.width = "100%";
    localFirmGewerk.setAttribute("list", "firm-gewerk-options-project-modal");
    const localFirmGewerkList = mkGewerkDatalist("firm-gewerk-options-project-modal");
    const localFirmRole = document.createElement("select");
    localFirmRole.style.width = "100%";
    this._renderRoleOptions(localFirmRole);
    const localFirmNotes = document.createElement("textarea");
    localFirmNotes.rows = 3;
    localFirmNotes.placeholder = "Notizen";
    localFirmNotes.style.width = "100%";

    localFirmBody.append(
      mkModalRow("Name 1", localFirmName1),
      mkModalRow("Name 2", localFirmName2),
      mkModalRow("Kurzbez.", localFirmShort),
      mkModalRow("Str. / HsNr.", localFirmStreet),
      mkModalRow("PLZ", localFirmZip),
      mkModalRow("Ort", localFirmCity),
      mkModalRow("Telefon", localFirmPhone),
      mkModalRow("E-Mail", localFirmEmail),
      mkModalRow("Funktion/Gewerk", localFirmGewerk),
      mkModalRow("Kategorie", localFirmRole),
      mkModalRow("Notizen", localFirmNotes)
    );
    localFirmBody.appendChild(localFirmGewerkList);

    const localFirmFoot = document.createElement("div");
    localFirmFoot.style.display = "flex";
    localFirmFoot.style.justifyContent = "flex-end";
    localFirmFoot.style.gap = "8px";
    localFirmFoot.style.borderTop = "1px solid #e2e8f0";
    localFirmFoot.style.padding = "10px 12px";
    const localFirmBtnCancel = document.createElement("button");
    localFirmBtnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(localFirmBtnCancel);
    localFirmBtnCancel.onclick = () => this._closeLocalFirmCreateModal();
    const localFirmBtnSave = document.createElement("button");
    localFirmBtnSave.textContent = "Speichern";
    applyPopupButtonStyle(localFirmBtnSave, { variant: "primary" });
    localFirmBtnSave.onclick = async () => {
      await this._saveLocalFirmModal();
    };
    const localFirmBtnDelete = document.createElement("button");
    localFirmBtnDelete.textContent = "Loeschen";
    localFirmBtnDelete.title = "Loeschen";
    applyPopupButtonStyle(localFirmBtnDelete);
    this._applyDangerDeleteButtonStyle(localFirmBtnDelete, true);
    localFirmBtnDelete.onclick = async () => {
      await this._deleteLocalFirmFromModal();
    };
    localFirmFoot.append(localFirmBtnDelete, localFirmBtnCancel, localFirmBtnSave);
    localFirmBody.prepend(localFirmErr);
    localFirmModal.append(localFirmHead, localFirmBody, localFirmFoot);
    localFirmOverlay.appendChild(localFirmModal);

    // ------------------------------------------------------------
    // Modal: Neuer lokaler Mitarbeiter
    // ------------------------------------------------------------
    const localPersonOverlay = document.createElement("div");
    localPersonOverlay.style.position = "fixed";
    localPersonOverlay.style.inset = "0";
    localPersonOverlay.style.background = "rgba(0,0,0,0.35)";
    localPersonOverlay.style.display = "none";
    localPersonOverlay.style.alignItems = "center";
    localPersonOverlay.style.justifyContent = "center";
    localPersonOverlay.style.zIndex = String(OVERLAY_TOP);
    localPersonOverlay.onclick = (e) => {
      if (e.target === localPersonOverlay) this._closeLocalPersonCreateModal();
    };
    localPersonOverlay.tabIndex = -1;
    localPersonOverlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this._closeLocalPersonCreateModal();
      }
    });

    const localPersonModal = document.createElement("div");
    localPersonModal.style.width = "min(760px, calc(100vw - 24px))";
    localPersonModal.style.maxHeight = "calc(100vh - 24px)";
    localPersonModal.style.display = "flex";
    localPersonModal.style.flexDirection = "column";
    localPersonModal.style.overflow = "hidden";
    localPersonModal.style.background = "#fff";
    localPersonModal.style.borderRadius = "10px";
    localPersonModal.style.border = "1px solid rgba(0,0,0,0.15)";
    localPersonModal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
    localPersonModal.style.padding = "0";

    const localPersonHead = document.createElement("div");
    localPersonHead.style.display = "flex";
    localPersonHead.style.alignItems = "center";
    localPersonHead.style.justifyContent = "space-between";
    localPersonHead.style.gap = "10px";
    localPersonHead.style.padding = "12px";
    localPersonHead.style.borderBottom = "1px solid #e2e8f0";
    const localPersonTitle = document.createElement("div");
    localPersonTitle.textContent = "Neuer Mitarbeiter";
    localPersonTitle.style.fontWeight = "bold";
    const localPersonBtnClose = document.createElement("button");
    localPersonBtnClose.textContent = "X";
    applyPopupButtonStyle(localPersonBtnClose);
    localPersonBtnClose.onclick = () => this._closeLocalPersonCreateModal();
    localPersonHead.append(localPersonTitle, localPersonBtnClose);

    const localPersonErr = document.createElement("div");
    localPersonErr.style.color = "#c62828";
    localPersonErr.style.fontSize = "12px";
    localPersonErr.style.marginBottom = "8px";
    localPersonErr.style.display = "none";

    const localPersonBody = document.createElement("div");
    localPersonBody.style.flex = "1 1 auto";
    localPersonBody.style.minHeight = "0";
    localPersonBody.style.overflow = "auto";
    localPersonBody.style.padding = "12px";
    const localPersonFirst = document.createElement("input");
    localPersonFirst.type = "text";
    localPersonFirst.placeholder = "Vorname";
    localPersonFirst.style.width = "100%";
    const localPersonLast = document.createElement("input");
    localPersonLast.type = "text";
    localPersonLast.placeholder = "Nachname";
    localPersonLast.style.width = "100%";
    const localPersonFunktion = document.createElement("input");
    localPersonFunktion.type = "text";
    localPersonFunktion.placeholder = "Funktion/Rolle";
    localPersonFunktion.style.width = "100%";
    const localPersonPhone = document.createElement("input");
    localPersonPhone.type = "text";
    localPersonPhone.placeholder = "Telefon";
    localPersonPhone.style.width = "100%";
    const localPersonEmail = document.createElement("input");
    localPersonEmail.type = "email";
    localPersonEmail.placeholder = "E-Mail";
    localPersonEmail.style.width = "100%";
    const localPersonNotes = document.createElement("textarea");
    localPersonNotes.rows = 3;
    localPersonNotes.placeholder = "Notizen";
    localPersonNotes.style.width = "100%";
    localPersonBody.append(
      mkModalRow("Vorname", localPersonFirst),
      mkModalRow("Nachname", localPersonLast),
      mkModalRow("Funktion/Rolle", localPersonFunktion),
      mkModalRow("Telefon", localPersonPhone),
      mkModalRow("E-Mail", localPersonEmail),
      mkModalRow("Notizen", localPersonNotes)
    );

    const localPersonFoot = document.createElement("div");
    localPersonFoot.style.display = "flex";
    localPersonFoot.style.justifyContent = "flex-end";
    localPersonFoot.style.gap = "8px";
    localPersonFoot.style.borderTop = "1px solid #e2e8f0";
    localPersonFoot.style.padding = "10px 12px";
    const localPersonBtnCancel = document.createElement("button");
    localPersonBtnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(localPersonBtnCancel);
    localPersonBtnCancel.onclick = () => this._closeLocalPersonCreateModal();
    const localPersonBtnSave = document.createElement("button");
    localPersonBtnSave.textContent = "Speichern";
    applyPopupButtonStyle(localPersonBtnSave, { variant: "primary" });
    localPersonBtnSave.onclick = async () => {
      await this._saveLocalPersonModal();
    };
    const localPersonBtnDelete = document.createElement("button");
    localPersonBtnDelete.textContent = "Loeschen";
    localPersonBtnDelete.title = "Loeschen";
    applyPopupButtonStyle(localPersonBtnDelete);
    this._applyDangerDeleteButtonStyle(localPersonBtnDelete, true);
    localPersonBtnDelete.onclick = async () => {
      await this._deleteLocalPersonFromModal();
    };
    localPersonFoot.append(localPersonBtnDelete, localPersonBtnCancel, localPersonBtnSave);
    localPersonBody.prepend(localPersonErr);
    localPersonModal.append(localPersonHead, localPersonBody, localPersonFoot);
    localPersonOverlay.appendChild(localPersonModal);

    // final compose
    grid.append(localCol, detailCol);
    root.append(head, grid, overlay, localFirmOverlay, localPersonOverlay);

    // refs
    this.root = root;
    this.msgEl = msg;

    // local refs
    this.btnNewFirm = btnNewFirm;
    this.btnImportCsv = btnImportCsv;
    this.btnGlobalAssign = btnGlobalAssign;
    this.tableBodyEl = tbody;

    this.editWrapEl = editWrap;
    this.firmGridEl = firmGrid;
    this.firmButtonsEl = firmButtons;

    this.inpFirmName1 = inpFirmName1;
    this.inpFirmName2 = inpFirmName2;
    this.inpFirmShort = inpFirmShort;
    this.inpFirmStreet = inpFirmStreet;
    this.inpFirmZip = inpFirmZip;
    this.inpFirmCity = inpFirmCity;
    this.inpFirmPhone = inpFirmPhone;
    this.inpFirmEmail = inpFirmEmail;
    this.inpFirmGewerk = inpFirmGewerk;
    this.selFirmRole = selFirmRole;
    this.taFirmNotes = taFirmNotes;

    this.btnSaveFirm = btnSaveFirm;

    this.personTableBodyEl = personsTbody;
    this.btnNewPerson = btnNewPerson;
    this.btnImportPersonsCsv = btnImportPersonsCsv;
    this.personFormEl = personForm;
    this.detailFirmTitleEl = editTitle;
    this.detailFirmBodyEl = detailBody;
    this.btnEditSelectedFirm = btnEditSelectedFirm;
    this.btnDeleteSelectedFirm = btnDeleteSelectedFirm;

    this.inpFirstName = inpFirstName;
    this.inpLastName = inpLastName;
    this.inpFunktion = inpFunktionRolle;
    this.inpEmail = inpEmail;
    this.inpPhone = inpPhone;
    this.inpRolle = inpFunktionRolle;
    this.taPersonNotes = taPersonNotes;

    this.btnSavePerson = btnSavePerson;
    this.btnCancelPerson = btnCancelPerson;
    this.btnDeletePerson = btnDeletePerson;

    // global main refs
    this.globalAssignedBodyEl = null;

    // modal refs
    this.globalAssignOverlayEl = overlay;
    this.globalAssignErrEl = modalErr;
    this.globalAssignLeftListEl = leftCol.list;
    this.globalAssignRightListEl = rightCol.list;
    this.globalAssignBtnSaveEl = btnSave;
    this.globalAssignBtnCancelEl = btnCancel;
    this.globalAssignBtnCloseEl = btnClose;

    this.localFirmOverlayEl = localFirmOverlay;
    this.localFirmTitleEl = localFirmTitle;
    this.localFirmErrEl = localFirmErr;
    this.localFirmInpName1 = localFirmName1;
    this.localFirmInpName2 = localFirmName2;
    this.localFirmInpShort = localFirmShort;
    this.localFirmInpStreet = localFirmStreet;
    this.localFirmInpZip = localFirmZip;
    this.localFirmInpCity = localFirmCity;
    this.localFirmInpPhone = localFirmPhone;
    this.localFirmInpEmail = localFirmEmail;
    this.localFirmInpGewerk = localFirmGewerk;
    this.localFirmSelRole = localFirmRole;
    this.localFirmTaNotes = localFirmNotes;
    this.localFirmBtnSaveEl = localFirmBtnSave;
    this.localFirmBtnDeleteEl = localFirmBtnDelete;
    this.localFirmBtnCancelEl = localFirmBtnCancel;
    this.localFirmBtnCloseEl = localFirmBtnClose;

    this.localPersonOverlayEl = localPersonOverlay;
    this.localPersonTitleEl = localPersonTitle;
    this.localPersonErrEl = localPersonErr;
    this.localPersonInpFirstName = localPersonFirst;
    this.localPersonInpLastName = localPersonLast;
    this.localPersonInpFunktion = localPersonFunktion;
    this.localPersonInpPhone = localPersonPhone;
    this.localPersonInpEmail = localPersonEmail;
    this.localPersonInpRolle = localPersonFunktion;
    this.localPersonTaNotes = localPersonNotes;
    this.localPersonBtnSaveEl = localPersonBtnSave;
    this.localPersonBtnDeleteEl = localPersonBtnDelete;
    this.localPersonBtnCancelEl = localPersonBtnCancel;
    this.localPersonBtnCloseEl = localPersonBtnClose;

    return root;
  }

  async load() {
    this._ensureProjectId();
    await this._loadRoleMeta();

    if (!this.projectId) {
      this._setMsg("Bitte zuerst ein Projekt auswÃ¤hlen (Projekt-Kontext fehlt).");
      // Editor sicher zu
      this._closeFirmEditor();
      this._renderFirmsOnly();
      this._renderPersonsOnly();
      this._updateVisibility();
      this._applyFirmFormState();
      this._applyPersonFormState();
      await this.reloadGlobalAssignments();
      return;
    }

    await this.reloadFirms();
    await this.reloadGlobalAssignments();
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
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
            reason: String(reason || "").trim() || "project-firms-updated",
            source: "ProjectFirmsView",
          },
        })
      );
    } catch (_e) {
      // ignore
    }
  }

  _projectScopeText() {
    const label = String(this.router?.context?.projectLabel || "").trim();
    return label || "diesem Projekt";
  }

  _isReadOnly() {
    if (typeof this.readOnly === "boolean") return this.readOnly;

    const r = this.router;
    if (!r) return false;

    if (typeof r.isReadOnly === "function") return !!r.isReadOnly();
    if (typeof r.readOnly === "boolean") return r.readOnly;
    if (r.context && typeof r.context.readOnly === "boolean") return r.context.readOnly;

    return false;
  }

  _setMsg(text) {
    if (!this.msgEl) return;
    this.msgEl.textContent = text || "";
  }

  _clearStaleBusyState() {
    const modalVisible =
      !!this.globalAssignOpen ||
      !!this.localFirmCreateOpen ||
      !!this.localPersonCreateOpen ||
      (!!this.globalAssignOverlayEl && this.globalAssignOverlayEl.style.display !== "none") ||
      (!!this.localFirmOverlayEl && this.localFirmOverlayEl.style.display !== "none") ||
      (!!this.localPersonOverlayEl && this.localPersonOverlayEl.style.display !== "none");
    if (modalVisible) return;
    if (!this.savingFirm && !this.savingPerson && !this.savingGlobalAssign) return;
    this.savingFirm = false;
    this.savingPerson = false;
    this.savingGlobalAssign = false;
    this._setMsg("");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();
  }

  _openProjectFirmImportModal() {
    this._ensureProjectId();
    if (!this.projectId) {
      alert("Bitte zuerst ein Projekt auswÃ¤hlen.");
      return;
    }
    this.importPopupView?._openImportModal?.();
  }

  _openProjectPersonImportModal() {
    this._ensureProjectId();
    if (!this.projectId) {
      alert("Bitte zuerst ein Projekt auswÃ¤hlen.");
      return;
    }
    if (!this._hasFirmSelectedSaved()) {
      alert("Bitte zuerst eine Firma auswählen.");
      return;
    }
    this.importPopupView.importContext = this._selectedFirmIsAssignedGlobal() ? "stamm" : "projekt";
    this.importPopupView?._openPersonImportModal?.();
  }

  _hasFirmSelectedSaved() {
    return !!this.selectedFirmId && this.firmMode === "edit";
  }

  _sameId(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return false;
    return String(a) === String(b);
  }

  _selectFirm(firmId) {
    this.selectedFirmId = firmId || null;
    this.selectedFirm = this.firms.find((f) => this._sameId(f?.id, this.selectedFirmId)) || null;
  }

  _isAssignedGlobalFirm(firm) {
    return String(firm?.__firmSource || "") === "global_assigned";
  }

  _selectedFirmIsAssignedGlobal() {
    return this._isAssignedGlobalFirm(this.selectedFirm);
  }

  _selectedPersonCandidateKind() {
    return this._selectedFirmIsAssignedGlobal() ? "global_person" : "project_person";
  }

  _getSelectedFirmDeleteAction() {
    const isAssignedGlobalFirm = this._selectedFirmIsAssignedGlobal();
    return {
      isAssignedGlobalFirm,
      label: isAssignedGlobalFirm ? "Aus Projekt entfernen" : "Loeschen",
      title: isAssignedGlobalFirm ? "Aus Projekt entfernen" : "Loeschen",
      blockedTitle: "Loeschen nur moeglich, wenn keine Mitarbeiter vorhanden sind.",
      busyMessage: isAssignedGlobalFirm ? "Entferne Firma aus Projekt..." : "Loesche Firma...",
      errorMessage: isAssignedGlobalFirm ? "Entfernen fehlgeschlagen" : "Loeschen fehlgeschlagen",
    };
  }

  _beginCreateFirm() {
    this.firmMode = "create";
    this._selectFirm(null);
    this.selectedFirm = null;

    this.persons = [];
    this.personMode = "none";
    this.editPersonId = null;
  }

  _closeFirmEditor() {
    this.firmMode = "none";
    this.personMode = "none";
    this.editPersonId = null;
  }

  _updateVisibility() {
    if (this.editWrapEl) this.editWrapEl.style.display = "block";
    if (this.firmGridEl) this.firmGridEl.style.display = "none";
    if (this.firmButtonsEl) this.firmButtonsEl.style.display = "none";
    if (this.personFormEl) this.personFormEl.style.display = "none";
    this._updateSelectedFirmDetailHeader();
  }

  _updateSelectedFirmDetailHeader() {
    if (this.detailFirmTitleEl) {
      if (this.selectedFirm && this.selectedFirmId) {
        const name = (this.selectedFirm.name || "").trim();
        const fallback = this._firmShortText(this.selectedFirm);
        this.detailFirmTitleEl.textContent = name || fallback || "-";
      } else {
        this.detailFirmTitleEl.textContent = "-";
      }
    }
    this._renderSelectedFirmDetails();
    if (this.btnEditSelectedFirm) {
      const busy = !!this.savingFirm || !!this.savingPerson || !!this.savingGlobalAssign;
      const can =
        !busy &&
        !this._isReadOnly() &&
        !!this.selectedFirmId &&
        !!this.selectedFirm &&
        !this._isAssignedGlobalFirm(this.selectedFirm);
      this.btnEditSelectedFirm.disabled = !can;
      this.btnEditSelectedFirm.style.opacity = can ? "1" : "0.55";
    }
    if (this.btnDeleteSelectedFirm) {
      const busy = !!this.savingFirm || !!this.savingPerson || !!this.savingGlobalAssign;
      const hasPersons = Array.isArray(this.persons) && this.persons.length > 0;
      const deleteAction = this._getSelectedFirmDeleteAction();
      const can =
        !busy &&
        !this._isReadOnly() &&
        !!this.selectedFirmId &&
        !!this.selectedFirm &&
        (deleteAction.isAssignedGlobalFirm || !hasPersons);
      this.btnDeleteSelectedFirm.disabled = !can;
      this.btnDeleteSelectedFirm.style.opacity = can ? "1" : "0.55";
      this.btnDeleteSelectedFirm.textContent = deleteAction.label;
      this.btnDeleteSelectedFirm.title =
        !deleteAction.isAssignedGlobalFirm && hasPersons ? deleteAction.blockedTitle : deleteAction.title;
    }
  }

  _renderSelectedFirmDetails() {
    if (!this.detailFirmBodyEl) return;
    this.detailFirmBodyEl.innerHTML = "";

    if (!this.selectedFirm || !this.selectedFirmId) {
      const placeholder = document.createElement("div");
      placeholder.textContent = "Bitte links eine Firma auswaehlen.";
      this.detailFirmBodyEl.appendChild(placeholder);
      return;
    }

    const firm = this.selectedFirm;
    const mkRow = (label, value) => {
      const row = document.createElement("div");
      const lbl = document.createElement("span");
      lbl.textContent = `${label}: `;
      lbl.style.fontWeight = "600";
      const val = document.createElement("span");
      val.textContent = value || "-";
      row.append(lbl, val);
      return row;
    };

    const address = [firm.street, [firm.zip, firm.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    const roleLabel = this.roleLabels?.[String(firm.role_code ?? "")] || "Kategorie";

    this.detailFirmBodyEl.append(
      mkRow("Name", (firm.name || "").trim() || "-"),
      mkRow("Kurzbez.", (firm.short || "").trim() || "-"),
      mkRow("Adresse", address || "-"),
      mkRow("Telefon", (firm.phone || "").trim() || "-"),
      mkRow("E-Mail", (firm.email || "").trim() || "-"),
      mkRow("Kategorie", roleLabel || "-")
    );
  }

  _getFirmFormData() {
    return {
      name: (this.inpFirmName1?.value || "").trim(),
      name2: (this.inpFirmName2?.value || "").trim(),
      short: (this.inpFirmShort?.value || "").trim(),
      street: (this.inpFirmStreet?.value || "").trim(),
      zip: (this.inpFirmZip?.value || "").trim(),
      city: (this.inpFirmCity?.value || "").trim(),
      phone: (this.inpFirmPhone?.value || "").trim(),
      email: (this.inpFirmEmail?.value || "").trim(),
      gewerk: (this.inpFirmGewerk?.value || "").trim(),
      role_code: (this.selFirmRole?.value || "").toString(),
      notes: (this.taFirmNotes?.value || "").trim(),
    };
  }

  _getPersonFormData() {
    const funktionRolle = (this.inpFunktion?.value || this.inpRolle?.value || "").trim();
    return {
      firstName: (this.inpFirstName?.value || "").trim(),
      lastName: (this.inpLastName?.value || "").trim(),
      funktion: funktionRolle,
      email: (this.inpEmail?.value || "").trim(),
      phone: (this.inpPhone?.value || "").trim(),
      rolle: funktionRolle,
      notes: (this.taPersonNotes?.value || "").trim(),
    };
  }

  _roleOptions() {
    const labels = this.roleLabels || this._defaultRoleLabels();
    const order = Array.isArray(this.roleOrder) && this.roleOrder.length
      ? this.roleOrder
      : this._defaultRoleOrder();

    return order.map((code) => ({
      code,
      label: labels[code] || `Kategorie ${code}`,
    }));
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

  _renderRoleOptions(target) {
    const sel = target || this.selFirmRole;
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
    for (const r of this._roleOptions()) {
      const opt = document.createElement("option");
      opt.value = String(r.code);
      opt.textContent = r.label;
      sel.appendChild(opt);
    }
    if (prev) sel.value = prev;
  }

  async _loadRoleMeta() {
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") {
      this.roleLabels = this._defaultRoleLabels();
      this.roleOrder = this._defaultRoleOrder();
      this._renderRoleOptions();
      return;
    }

    const res = await api.appSettingsGetMany([
      "firm_role_order",
      "firm_role_labels",
    ]);
    if (!res?.ok) {
      this.roleLabels = this._defaultRoleLabels();
      this.roleOrder = this._defaultRoleOrder();
      this._renderRoleOptions();
      return;
    }

    const data = res.data || {};
    this.roleLabels = this._normalizeRoleLabels(data.firm_role_labels || "");
    this.roleOrder = this._normalizeRoleOrder(data.firm_role_order || "", this.roleLabels);
    this._renderRoleOptions();
  }

  _labelFirm(short, name) {
    const s = (short || "").trim();
    if (s) return s;
    const n = (name || "").trim();
    if (n) return n;
    return "(ohne Name)";
  }

  _firmShortText(f) {
    if (!f) return "";
    return this._labelFirm(f.short, f.name);
  }

  _firmGewerkText(f) {
    if (!f) return "";
    return (f.gewerk || f.trade || f.function || "").trim();
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

  _candidateActiveById(items, expectedKind) {
    const activeById = new Map();
    for (const item of items || []) {
      if (String(item?.kind || "") !== String(expectedKind || "")) continue;
      const personId = String(item?.personId ?? item?.person_id ?? "").trim();
      if (!personId) continue;
      activeById.set(personId, this._parseActiveFlag(item?.is_active ?? item?.isActive));
    }
    return activeById;
  }

  async _setPersonActive(person, isActive) {
    const api = window.bbmDb || {};
    const kind = this._selectedPersonCandidateKind();
    const personId = String(person?.id ?? person?.personId ?? person?.person_id ?? "").trim();
    if (!this.projectId || !kind || !personId) return false;

    const next = this._parseActiveFlag(isActive);

    if (typeof api.projectCandidatesSetActive === "function") {
      const res = await api.projectCandidatesSetActive({
        projectId: this.projectId,
        kind,
        personId,
        isActive: next === 1,
      });
      if (!res?.ok) {
        alert(res?.error || "Aktiv/Inaktiv konnte nicht gespeichert werden.");
        return false;
      }
    } else if (
      typeof api.projectCandidatesList === "function" &&
      typeof api.projectCandidatesSet === "function"
    ) {
      const currentRes = await api.projectCandidatesList({ projectId: this.projectId });
      if (!currentRes?.ok) {
        alert(currentRes?.error || "Aktiv/Inaktiv konnte nicht gespeichert werden.");
        return false;
      }

      const merged = new Map();
      for (const item of currentRes.items || []) {
        const itemKind = String(item?.kind || "").trim();
        const itemPersonId = String(item?.personId ?? item?.person_id ?? "").trim();
        if (!itemKind || !itemPersonId) continue;
        merged.set(`${itemKind}::${itemPersonId}`, {
          kind: itemKind,
          personId: itemPersonId,
          isActive: this._parseActiveFlag(item?.is_active ?? item?.isActive) === 1,
        });
      }

      merged.set(`${kind}::${personId}`, {
        kind,
        personId,
        isActive: next === 1,
      });

      const setRes = await api.projectCandidatesSet({
        projectId: this.projectId,
        items: [...merged.values()],
      });
      if (!setRes?.ok) {
        alert(setRes?.error || "Aktiv/Inaktiv konnte nicht gespeichert werden.");
        return false;
      }
    } else {
      alert("API fuer Aktiv/Inaktiv fehlt.");
      return false;
    }

    this.persons = (this.persons || []).map((entry) =>
      this._sameId(entry?.id, personId) ? { ...entry, is_active: next } : entry
    );
    this._renderPersonsOnly();
    this._applyPersonFormState();
    this._notifyPoolDataChanged("person-active-changed");
    return true;
  }

  async _ensureGlobalFirmPersonsProjectCandidates(firmId) {
    const api = window.bbmDb || {};
    const targetFirmId = String(firmId || "").trim();
    if (!this.projectId || !targetFirmId) return true;
    if (
      typeof api.projectCandidatesList !== "function" ||
      typeof api.projectCandidatesSet !== "function" ||
      typeof api.personsListByFirm !== "function"
    ) {
      return true;
    }

    const [existingCandidatesRes, personsRes] = await Promise.all([
      api.projectCandidatesList({ projectId: this.projectId }),
      api.personsListByFirm(targetFirmId),
    ]);

    if (!existingCandidatesRes?.ok || !personsRes?.ok) return false;

    const merged = new Map();
    for (const item of existingCandidatesRes.items || []) {
      const kind = String(item?.kind || "").trim();
      const personId = String(item?.personId ?? item?.person_id ?? "").trim();
      if (!kind || !personId) continue;
      merged.set(`${kind}::${personId}`, {
        kind,
        personId,
        isActive: this._parseActiveFlag(item?.is_active ?? item?.isActive) === 1,
      });
    }

    for (const person of personsRes.list || []) {
      const personId = String(person?.id || "").trim();
      if (!personId) continue;
      const key = `global_person::${personId}`;
      if (merged.has(key)) continue;
      merged.set(key, {
        kind: "global_person",
        personId,
        isActive: 0,
      });
    }

    const setRes = await api.projectCandidatesSet({
      projectId: this.projectId,
      items: [...merged.values()],
    });

    return !!setRes?.ok;
  }

  async _canDeactivateFirm(firmId) {
    const api = window.bbmDb || {};
    if (typeof api.projectFirmsCanDeactivate !== "function") return { ok: true, can: true };
    try {
      const res = await api.projectFirmsCanDeactivate({ projectId: this.projectId, firmId });
      if (!res?.ok) return { ok: false, can: false, reason: res?.error || "" };
      const can = res?.result?.canDeactivate !== false;
      return {
        ok: true,
        can,
        reason: res?.result?.reason || "",
      };
    } catch (e) {
      return { ok: false, can: false, reason: e?.message || String(e) };
    }
  }

  async _setFirmActiveWithGuard(firmId, isActive) {
    if (!this.projectId || !firmId) return false;
    const api = window.bbmDb || {};
    if (typeof api.projectFirmsSetActive !== "function") {
      alert("Aktiv/Inaktiv ist nicht verfuegbar (projectFirmsSetActive fehlt).");
      return false;
    }

    if (!isActive) {
      const check = await this._canDeactivateFirm(firmId);
      if (!check.ok || !check.can) {
        alert(
          check.reason ||
            "Firma kann nicht deaktiviert werden, solange Teilnehmer dieser Firma zugeordnet sind. Entferne zuerst die Teilnehmer und setze die Mitarbeiter im Personalpool inaktiv."
        );
        return false;
      }
    }

    const res = await api.projectFirmsSetActive({
      projectId: this.projectId,
      firmId,
      isActive: !!isActive,
    });
    if (!res?.ok) {
      alert(res?.error || "Aktiv/Inaktiv konnte nicht gespeichert werden.");
      return false;
    }

    await this.reloadFirms();
    await this.reloadGlobalAssignments();
    this._notifyPoolDataChanged("firm-active-changed");
    return true;
  }

  _normalizeFirmNameForDedupe(value) {
    return String(value || "").trim().toLocaleLowerCase("de-DE");
  }

  _findLocalFirmNameDuplicate(name, { excludeId = null } = {}) {
    const key = this._normalizeFirmNameForDedupe(name);
    if (!key) return null;
    const list = Array.isArray(this.firms) ? this.firms : [];
    for (const firm of list) {
      if (!firm) continue;
      if (excludeId && String(firm.id || "") === String(excludeId)) continue;
      const other = this._normalizeFirmNameForDedupe(firm.name);
      if (other === key) return firm;
    }
    return null;
  }

  async _countGlobalFirmAssignedPersons(firmId) {
    const api = window.bbmDb || {};
    if (!firmId || !this.projectId) return 0;
    if (typeof api.personsListByFirm !== "function") return -1;
    if (typeof api.projectCandidatesList !== "function") return -1;

    const [personsRes, candidatesRes] = await Promise.all([
      api.personsListByFirm(firmId),
      api.projectCandidatesList({ projectId: this.projectId }),
    ]);
    if (!personsRes?.ok || !candidatesRes?.ok) return -1;

    const firmPersonIds = new Set(
      (personsRes.list || []).map((p) => String(p?.id || "")).filter(Boolean)
    );
    if (!firmPersonIds.size) return 0;

    let count = 0;
    for (const c of candidatesRes.items || []) {
      if (String(c?.kind || "") !== "global_person") continue;
      const pid = String(c?.personId ?? c?.person_id ?? "");
      if (!pid) continue;
      if (firmPersonIds.has(pid)) count += 1;
    }
    return count;
  }

  // ------------------------------------------------------------
  // Data loading (lokal)
  // ------------------------------------------------------------
  async reloadFirms() {
    this._setMsg("");
    this._ensureProjectId();

    const res = await window.bbmDb.projectFirmsListByProject(this.projectId);
    if (!res?.ok) {
      this._setMsg(res?.error || "Fehler beim Laden der Projektfirmen");

      this.firms = [];
      this._closeFirmEditor();
      this._selectFirm(null);
      this.persons = [];

      this._renderFirmsOnly();
      this._renderPersonsOnly();
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility();
      this._applyGlobalAssignState();
      return;
    }

    this.firms = (res.list || []).map((firm) => ({
      ...firm,
      __firmSource: "project",
    }));

    if (this.selectedFirmId && this.firmMode === "edit") {
      const still = this.firms.find((f) => this._sameId(f?.id, this.selectedFirmId));
      if (!still) {
        this._closeFirmEditor();
        this._selectFirm(null);
      } else {
        this.selectedFirm = still;
      }
    }

    this._renderFirmsOnly();
    if (this.firmMode === "edit" && this.selectedFirmId) {
      await this._reloadPersons();
    } else {
      this.persons = [];
      this._renderPersonsOnly();
    }

    this._applyFirmFormState();
    this._applyPersonFormState();
    this._updateVisibility();
    this._applyGlobalAssignState();
  }

  async _reloadPersons() {
    this.persons = [];
    this.personMode = "none";
    this.editPersonId = null;

    if (!this.selectedFirmId) {
      this._renderPersonsOnly();
      return;
    }

    if (this._selectedFirmIsAssignedGlobal()) {
      const api = window.bbmDb || {};
      if (typeof api.personsListByFirm !== "function") {
        this.persons = [];
        this._renderPersonsOnly();
        return;
      }

      const [personsRes, candidatesRes] = await Promise.all([
        api.personsListByFirm(this.selectedFirmId),
        typeof api.projectCandidatesList === "function"
          ? api.projectCandidatesList({ projectId: this.projectId })
          : Promise.resolve(null),
      ]);
      if (!personsRes?.ok) {
        this._setMsg(personsRes?.error || "Fehler beim Laden der Mitarbeiter");
        this.persons = [];
        this._renderPersonsOnly();
        return;
      }

      const activeById = this._candidateActiveById(candidatesRes?.items, "global_person");

      this.persons = (personsRes.list || []).map((person) => ({
        ...person,
        __personKind: "global_person",
        is_active: activeById.has(String(person?.id ?? ""))
          ? activeById.get(String(person?.id ?? ""))
          : 0,
      }));
      this._renderPersonsOnly();
      return;
    }

    const api = window.bbmDb || {};
    const [res, candidatesRes] = await Promise.all([
      window.bbmDb.projectPersonsListByProjectFirm(this.selectedFirmId),
      typeof api.projectCandidatesList === "function"
        ? api.projectCandidatesList({ projectId: this.projectId })
        : Promise.resolve(null),
    ]);
    if (!res?.ok) {
      this._setMsg(res?.error || "Fehler beim Laden der Mitarbeiter");
      this.persons = [];
      this._renderPersonsOnly();
      return;
    }

    const activeById = this._candidateActiveById(candidatesRes?.items, "project_person");
    this.persons = (res.list || []).map((person) => ({
      ...person,
      is_active: activeById.has(String(person?.id ?? ""))
        ? activeById.get(String(person?.id ?? ""))
        : 1,
    }));
    this._renderPersonsOnly();
  }

  // ------------------------------------------------------------
  // Render lists (lokal)
  // ------------------------------------------------------------
  _renderFirmsOnly() {
    const tb = this.tableBodyEl;
    if (!tb) return;

    tb.innerHTML = "";

    for (const f of this.firms) {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      const isAssignedGlobalFirm = this._isAssignedGlobalFirm(f);

      const isSel = this._sameId(f?.id, this.selectedFirmId) && this.firmMode === "edit";
      tr.style.background = isSel ? "#dff0ff" : isAssignedGlobalFirm ? "#fff7e8" : "transparent";
      tr.onmouseenter = () => {
        if (isSel) return;
        tr.style.background = isAssignedGlobalFirm ? "#ffefcc" : "#f3f8ff";
      };
      tr.onmouseleave = () => {
        tr.style.background = isSel ? "#dff0ff" : isAssignedGlobalFirm ? "#fff7e8" : "transparent";
      };

      const tdShort = document.createElement("td");
      tdShort.style.padding = "6px";
      tdShort.style.borderBottom = "1px solid #eee";
      tdShort.textContent = this._firmShortText(f);

      const tdGewerk = document.createElement("td");
      tdGewerk.style.padding = "6px";
      tdGewerk.style.borderBottom = "1px solid #eee";
      tdGewerk.textContent = this._firmGewerkText(f);

      const tdActive = document.createElement("td");
      tdActive.style.padding = "6px";
      tdActive.style.borderBottom = "1px solid #eee";
      tdActive.style.textAlign = "center";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = this._parseActiveFlag(f?.is_active) === 1;
      cb.disabled =
        this._isReadOnly() ||
        this.savingFirm ||
        this.savingPerson ||
        this.savingGlobalAssign;
      cb.style.cursor = cb.disabled ? "default" : "pointer";
      cb.onclick = (e) => e.stopPropagation();
      cb.onchange = async (e) => {
        e.stopPropagation();
        const ok = await this._setFirmActiveWithGuard(f.id, cb.checked);
        if (!ok) cb.checked = !cb.checked;
      };
      tdActive.appendChild(cb);

      tr.append(tdShort, tdGewerk, tdActive);

      tr.onclick = async () => {
        if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;

        this.firmMode = "edit";
        this._selectFirm(f.id);

        this.personMode = "none";
        this.editPersonId = null;

        this._renderFirmsOnly();
        this._applyFirmFormState();
        this._applyPersonFormState();
        this._updateVisibility();

        await this._reloadPersons();
        this._applyPersonFormState();
        this._updateVisibility();
      };

      tb.appendChild(tr);
    }

    if (!(this.firms || []).length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 2;
      td.style.padding = "10px 6px";
      td.style.fontSize = "12px";
      td.style.opacity = "0.75";
      td.textContent = "Keine Firma im Projekt vorhanden.";
      tr.appendChild(td);
      tb.appendChild(tr);
    }
  }

  _renderPersonsOnly() {
    const tb = this.personTableBodyEl;
    if (!tb) return;

    tb.innerHTML = "";
    const selectedFirmIsAssignedGlobal = this._selectedFirmIsAssignedGlobal();

    if (!this._hasFirmSelectedSaved()) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.style.padding = "10px 6px";
      td.style.fontSize = "12px";
      td.style.opacity = "0.75";
      td.textContent = "Bitte zuerst eine Firma auswaehlen.";
      tr.appendChild(td);
      tb.appendChild(tr);
      return;
    }

    for (const p of this.persons) {
      const tr = document.createElement("tr");
      tr.style.cursor = selectedFirmIsAssignedGlobal ? "default" : "pointer";
      const isSel = this.personMode === "edit" && this._sameId(this.editPersonId, p.id);
      const isActive = this._parseActiveFlag(p?.is_active ?? p?.isActive) === 1;
      tr.style.background = isSel ? "#dff0ff" : "transparent";
      tr.style.opacity = isActive ? "1" : "0.65";
      tr.title = isActive ? "" : "Im Projekt inaktiv";
      tr.onmouseenter = () => {
        if (selectedFirmIsAssignedGlobal) return;
        if (isSel) return;
        tr.style.background = "#f3f8ff";
      };
      tr.onmouseleave = () => {
        if (selectedFirmIsAssignedGlobal) return;
        tr.style.background = isSel ? "#dff0ff" : "transparent";
      };

      const fn = p.first_name || "";
      const ln = p.last_name || "";
      const nameText = `${fn} ${ln}`.trim() || "(ohne Name)";

      const tdName = document.createElement("td");
      tdName.style.padding = "6px";
      tdName.style.borderBottom = "1px solid #eee";
      tdName.textContent = nameText;

      const tdRole = document.createElement("td");
      tdRole.style.padding = "6px";
      tdRole.style.borderBottom = "1px solid #eee";
      tdRole.textContent = p.rolle || p.funktion || "";

      const tdEmail = document.createElement("td");
      tdEmail.style.padding = "6px";
      tdEmail.style.borderBottom = "1px solid #eee";
      tdEmail.textContent = (p.email || "").trim() || "?";

      const tdPhone = document.createElement("td");
      tdPhone.style.padding = "6px";
      tdPhone.style.borderBottom = "1px solid #eee";
      tdPhone.textContent = (p.phone || "").trim() || "?";

      const tdActive = document.createElement("td");
      tdActive.style.padding = "6px";
      tdActive.style.borderBottom = "1px solid #eee";
      tdActive.style.textAlign = "center";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isActive;
      cb.disabled =
        this._isReadOnly() ||
        this.savingFirm ||
        this.savingPerson ||
        this.savingGlobalAssign;
      cb.style.cursor = cb.disabled ? "default" : "pointer";
      cb.onclick = (e) => e.stopPropagation();
      cb.onchange = async (e) => {
        e.stopPropagation();
        const ok = await this._setPersonActive(p, cb.checked);
        if (!ok) cb.checked = !cb.checked;
      };
      tdActive.appendChild(cb);

      tr.append(tdActive, tdName, tdRole, tdEmail, tdPhone);

      tr.onclick = () => {
        if (selectedFirmIsAssignedGlobal) return;
        if (this._isReadOnly()) return;
        if (this.savingPerson || this.savingFirm || this.savingGlobalAssign) return;
        this.personMode = "edit";
        this.editPersonId = p.id;
        this._applyPersonFormState();
        this._updateVisibility();
        this._openLocalPersonEditModal(p);
      };

      tb.appendChild(tr);
    }

    if (!(this.persons || []).length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.style.padding = "10px 6px";
      td.style.fontSize = "12px";
      td.style.opacity = "0.75";
      td.textContent = "Keine Mitarbeiter vorhanden.";
      tr.appendChild(td);
      tb.appendChild(tr);
    }
  }

  // ------------------------------------------------------------
  // Apply form state (lokal)
  // ------------------------------------------------------------
  _applyFirmFormState() {
    const isSaving = !!this.savingFirm || !!this.savingPerson || !!this.savingGlobalAssign;
    const hasEditor = this.firmMode === "create" || this.firmMode === "edit";
    const firm = this.selectedFirm;
    const ro = this._isReadOnly();

    // Hinweis + Button-Disable, wenn kein Projekt
    if (this.btnNewFirm) {
      this._ensureProjectId();
      const okProj = !!this.projectId;
      const can = okProj && !isSaving && !ro;
      this.btnNewFirm.disabled = !can;
      this.btnNewFirm.style.opacity = can ? "1" : "0.55";
      if (this.btnImportCsv) {
        this.btnImportCsv.disabled = !can;
        this.btnImportCsv.style.opacity = can ? "1" : "0.55";
      }
      if (this.btnImportPersonsCsv) {
        const canImportPersons = can && this._hasFirmSelectedSaved();
        this.btnImportPersonsCsv.disabled = !canImportPersons;
        this.btnImportPersonsCsv.style.opacity = canImportPersons ? "1" : "0.55";
      }
    }

    if (!hasEditor) return;

    const setInp = (el, val) => {
      if (!el) return;
      el.disabled = isSaving || ro;
      el.value = val || "";
    };

    setInp(this.inpFirmName1, firm ? firm.name || "" : "");
    setInp(this.inpFirmName2, firm ? firm.name2 || "" : "");
    setInp(this.inpFirmShort, firm ? firm.short || "" : "");
    setInp(this.inpFirmStreet, firm ? firm.street || "" : "");
    setInp(this.inpFirmZip, firm ? firm.zip || "" : "");
    setInp(this.inpFirmCity, firm ? firm.city || "" : "");
    setInp(this.inpFirmPhone, firm ? firm.phone || "" : "");
    setInp(this.inpFirmEmail, firm ? firm.email || "" : "");
    setInp(this.inpFirmGewerk, firm ? firm.gewerk || "" : "");

    if (this.selFirmRole) {
      const rc = firm && firm.role_code !== undefined && firm.role_code !== null ? String(firm.role_code) : "60";
      this.selFirmRole.value = rc;
      this.selFirmRole.disabled = isSaving || ro;
    }

    if (this.taFirmNotes) {
      this.taFirmNotes.disabled = isSaving || ro;
      this.taFirmNotes.value = firm ? firm.notes || "" : "";
    }

    if (this.btnSaveFirm) {
      const canSave = !isSaving && !ro;
      this.btnSaveFirm.disabled = !canSave;
      this.btnSaveFirm.style.opacity = canSave ? "1" : "0.55";
    }

    if (this.btnDeleteSelectedFirm) {
      const hasPersons = Array.isArray(this.persons) && this.persons.length > 0;
      const deleteAction = this._getSelectedFirmDeleteAction();
      const canDelete =
        !isSaving &&
        !ro &&
        this.firmMode === "edit" &&
        !!this.selectedFirmId &&
        (deleteAction.isAssignedGlobalFirm || !hasPersons);
      this.btnDeleteSelectedFirm.disabled = !canDelete;
      this.btnDeleteSelectedFirm.style.opacity = canDelete ? "1" : "0.55";
      this.btnDeleteSelectedFirm.textContent = deleteAction.label;
      this.btnDeleteSelectedFirm.title =
        !deleteAction.isAssignedGlobalFirm && hasPersons ? deleteAction.blockedTitle : deleteAction.title;
    }

    if (this.btnNewPerson) {
      const canNewPerson = !isSaving && !ro && this._hasFirmSelectedSaved();
      this.btnNewPerson.disabled = !canNewPerson;
      this.btnNewPerson.style.opacity = canNewPerson ? "1" : "0.55";
    }

    if (this.btnImportPersonsCsv) {
      const canImportPersons = !isSaving && !ro && this._hasFirmSelectedSaved();
      this.btnImportPersonsCsv.disabled = !canImportPersons;
      this.btnImportPersonsCsv.style.opacity = canImportPersons ? "1" : "0.55";
    }
  }

  _applyPersonFormState() {
    const hasFirm = this._hasFirmSelectedSaved();
    const isSaving = !!this.savingPerson || !!this.savingFirm || !!this.savingGlobalAssign;
    const ro = this._isReadOnly();

    const editing =
      this.personMode === "edit" && this.editPersonId
        ? this.persons.find((x) => this._sameId(x?.id, this.editPersonId)) || null
        : null;

    const show = hasFirm && (this.personMode === "create" || this.personMode === "edit");
    if (this.personFormEl) this.personFormEl.style.display = show ? "block" : "none";

    const setVal = (el, v) => {
      if (!el) return;
      el.value = v || "";
      el.disabled = isSaving || !show || ro;
    };

    setVal(this.inpFirstName, editing ? editing.first_name || "" : "");
    setVal(this.inpLastName, editing ? editing.last_name || "" : "");
    const funktionRolle = editing ? (editing.rolle || editing.funktion || "") : "";
    setVal(this.inpFunktion, funktionRolle);
    setVal(this.inpEmail, editing ? editing.email || "" : "");
    setVal(this.inpPhone, editing ? editing.phone || "" : "");
    if (this.inpRolle && this.inpRolle !== this.inpFunktion) {
      setVal(this.inpRolle, funktionRolle);
    }

    if (this.taPersonNotes) {
      this.taPersonNotes.value = editing ? editing.notes || "" : "";
      this.taPersonNotes.disabled = isSaving || !show || ro;
    }

    if (this.btnSavePerson) this.btnSavePerson.disabled = isSaving || !show || ro;
    if (this.btnCancelPerson) this.btnCancelPerson.disabled = isSaving || !show;

    if (this.btnDeletePerson) {
      const canDelete = !isSaving && !ro && show && this.personMode === "edit" && !!this.editPersonId;
      this.btnDeletePerson.disabled = !canDelete;
      this.btnDeletePerson.style.opacity = canDelete ? "1" : "0.55";
      this.btnDeletePerson.style.display = show ? "inline-block" : "none";
      this.btnDeletePerson.title = canDelete ? "Loeschen" : "Nur beim Bearbeiten moeglich";
    }
  }

  _setLocalFirmCreateError(text) {
    const msg = String(text || "").trim();
    if (!this.localFirmErrEl) return;
    if (!msg) {
      this.localFirmErrEl.style.display = "none";
      this.localFirmErrEl.textContent = "";
      return;
    }
    this.localFirmErrEl.style.display = "block";
    this.localFirmErrEl.textContent = msg;
  }

  _setLocalPersonCreateError(text) {
    const msg = String(text || "").trim();
    if (!this.localPersonErrEl) return;
    if (!msg) {
      this.localPersonErrEl.style.display = "none";
      this.localPersonErrEl.textContent = "";
      return;
    }
    this.localPersonErrEl.style.display = "block";
    this.localPersonErrEl.textContent = msg;
  }

  _applyDangerDeleteButtonStyle(btn, enabled = true) {
    if (!btn) return;
    btn.style.background = "#c62828";
    btn.style.color = "white";
    btn.style.border = "1px solid rgba(0,0,0,0.25)";
    btn.style.opacity = enabled ? "1" : "0.55";
  }

  _applyLocalCreateModalState() {
    const busy = !!this.savingFirm || !!this.savingPerson || !!this.savingGlobalAssign;
    const ro = this._isReadOnly();
    const lockFirm = busy || ro;
    const lockPerson = busy || ro || !this._hasFirmSelectedSaved();

    const setDisabled = (el, disabled) => {
      if (!el) return;
      el.disabled = !!disabled;
    };

    setDisabled(this.localFirmInpName1, lockFirm);
    setDisabled(this.localFirmInpName2, lockFirm);
    setDisabled(this.localFirmInpShort, lockFirm);
    setDisabled(this.localFirmInpStreet, lockFirm);
    setDisabled(this.localFirmInpZip, lockFirm);
    setDisabled(this.localFirmInpCity, lockFirm);
    setDisabled(this.localFirmInpPhone, lockFirm);
    setDisabled(this.localFirmInpEmail, lockFirm);
    setDisabled(this.localFirmInpGewerk, lockFirm);
    setDisabled(this.localFirmSelRole, lockFirm);
    setDisabled(this.localFirmTaNotes, lockFirm);
    setDisabled(this.localFirmBtnSaveEl, lockFirm);
    if (this.localFirmBtnDeleteEl) {
      const hasPersons = Array.isArray(this.persons) && this.persons.length > 0;
      const canDelete =
        !busy &&
        !ro &&
        this.localFirmModalMode === "edit" &&
        !!this.localFirmEditId &&
        !hasPersons;
      this.localFirmBtnDeleteEl.disabled = !canDelete;
      this._applyDangerDeleteButtonStyle(this.localFirmBtnDeleteEl, canDelete);
      this.localFirmBtnDeleteEl.style.display =
        this.localFirmModalMode === "edit" ? "inline-block" : "none";
      this.localFirmBtnDeleteEl.title = hasPersons
        ? "Loeschen nur moeglich, wenn keine Mitarbeiter vorhanden sind."
        : "Loeschen";
    }
    setDisabled(this.localFirmBtnCancelEl, busy);
    setDisabled(this.localFirmBtnCloseEl, busy);

    setDisabled(this.localPersonInpFirstName, lockPerson);
    setDisabled(this.localPersonInpLastName, lockPerson);
    setDisabled(this.localPersonInpFunktion, lockPerson);
    setDisabled(this.localPersonInpPhone, lockPerson);
    setDisabled(this.localPersonInpEmail, lockPerson);
    setDisabled(this.localPersonInpRolle, lockPerson);
    setDisabled(this.localPersonTaNotes, lockPerson);
    setDisabled(this.localPersonBtnSaveEl, lockPerson);
    if (this.localPersonBtnDeleteEl) {
      const canDelete =
        !busy &&
        !ro &&
        this.localPersonModalMode === "edit" &&
        !!this.localPersonEditId &&
        !!this._hasFirmSelectedSaved();
      this.localPersonBtnDeleteEl.disabled = !canDelete;
      this._applyDangerDeleteButtonStyle(this.localPersonBtnDeleteEl, canDelete);
      this.localPersonBtnDeleteEl.style.display = "inline-block";
      this.localPersonBtnDeleteEl.title = canDelete ? "Loeschen" : "Nur beim Bearbeiten moeglich";
    }
    setDisabled(this.localPersonBtnCancelEl, busy);
    setDisabled(this.localPersonBtnCloseEl, busy);
  }

  _openLocalFirmCreateModal() {
    if (this._isReadOnly()) return;
    if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;
    if (!this.localFirmOverlayEl) return;

    this.router?.cleanupTransientOverlays?.();

    this.localFirmModalMode = "create";
    this.localFirmEditId = null;
    this.localFirmCreateOpen = true;
    if (this.localFirmTitleEl) this.localFirmTitleEl.textContent = "Neue Firma";
    this._setLocalFirmCreateError("");
    if (this.localFirmInpName1) this.localFirmInpName1.value = "";
    if (this.localFirmInpName2) this.localFirmInpName2.value = "";
    if (this.localFirmInpShort) this.localFirmInpShort.value = "";
    if (this.localFirmInpStreet) this.localFirmInpStreet.value = "";
    if (this.localFirmInpZip) this.localFirmInpZip.value = "";
    if (this.localFirmInpCity) this.localFirmInpCity.value = "";
    if (this.localFirmInpPhone) this.localFirmInpPhone.value = "";
    if (this.localFirmInpEmail) this.localFirmInpEmail.value = "";
    if (this.localFirmInpGewerk) this.localFirmInpGewerk.value = "";
    if (this.localFirmSelRole) this.localFirmSelRole.value = "60";
    if (this.localFirmTaNotes) this.localFirmTaNotes.value = "";
    this.localFirmOverlayEl.style.display = "flex";
    this._applyLocalCreateModalState();
    this.localFirmOverlayEl.focus();
    setTimeout(() => {
      try {
        this.localFirmInpName1?.focus();
      } catch {
        // ignore
      }
    }, 0);
  }

  _closeLocalFirmCreateModal() {
    this.localFirmCreateOpen = false;
    this.localFirmModalMode = "create";
    this.localFirmEditId = null;
    this._setLocalFirmCreateError("");
    if (this.localFirmOverlayEl) this.localFirmOverlayEl.style.display = "none";
    this._applyLocalCreateModalState();
  }

  async _openEditorWindow(payload, onSaved, onDeleted) {
    if (typeof window.bbmDb?.editorOpen !== "function") return false;
    let res = null;
    try {
      res = await window.bbmDb.editorOpen(payload);
    } catch (err) {
      console.error("[ProjectFirmsView] editorOpen failed:", err);
      alert("Editor-Fenster konnte nicht geoeffnet werden.");
      return true;
    }

    try {
      if (res?.status === "saved" && typeof onSaved === "function") {
        await onSaved(res?.data || {});
      } else if (res?.status === "delete" && typeof onDeleted === "function") {
        await onDeleted();
      }
    } catch (err) {
      console.error("[ProjectFirmsView] editor callback failed:", err);
      const msg = String(err?.message || "").trim();
      alert(msg ? `Speichern aus dem Editor fehlgeschlagen:\n${msg}` : "Speichern aus dem Editor fehlgeschlagen.");
    }
    return true;
  }

  async _openLocalFirmEditModal(firm) {
    this._clearStaleBusyState();
    if (this._isReadOnly()) return;
    if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;
    if (!firm || !firm.id) return;
    if (!this.localFirmOverlayEl) return;

    this.router?.cleanupTransientOverlays?.();

    const usedEditor = await this._openEditorWindow(
      {
        kind: "firm",
        title: "Firma bearbeiten",
        firm: {
          id: firm.id,
          short: firm.short || "",
          name: firm.name || "",
          name2: firm.name2 || "",
          street: firm.street || "",
          zip: firm.zip || "",
          city: firm.city || "",
          phone: firm.phone || "",
          email: firm.email || "",
          gewerk: firm.gewerk || "",
          role_code: firm.role_code || "",
          notes: firm.notes || "",
        },
      },
      async (data) => {
        await this._saveLocalFirmFromEditor(firm.id, data);
      }
    );
    if (usedEditor) return;

    this.localFirmModalMode = "edit";
    this.localFirmEditId = firm.id;
    this.localFirmCreateOpen = true;
    if (this.localFirmTitleEl) this.localFirmTitleEl.textContent = "Firma bearbeiten";
    this._setLocalFirmCreateError("");

    if (this.localFirmInpName1) this.localFirmInpName1.value = firm.name || "";
    if (this.localFirmInpName2) this.localFirmInpName2.value = firm.name2 || "";
    if (this.localFirmInpShort) this.localFirmInpShort.value = firm.short || "";
    if (this.localFirmInpStreet) this.localFirmInpStreet.value = firm.street || "";
    if (this.localFirmInpZip) this.localFirmInpZip.value = firm.zip || "";
    if (this.localFirmInpCity) this.localFirmInpCity.value = firm.city || "";
    if (this.localFirmInpPhone) this.localFirmInpPhone.value = firm.phone || "";
    if (this.localFirmInpEmail) this.localFirmInpEmail.value = firm.email || "";
    if (this.localFirmInpGewerk) this.localFirmInpGewerk.value = firm.gewerk || "";
    if (this.localFirmSelRole) {
      const rc =
        firm && firm.role_code !== undefined && firm.role_code !== null
          ? String(firm.role_code)
          : "60";
      this.localFirmSelRole.value = rc;
    }
    if (this.localFirmTaNotes) this.localFirmTaNotes.value = firm.notes || "";
    this.localFirmOverlayEl.style.display = "flex";
    this._applyLocalCreateModalState();
    this.localFirmOverlayEl.focus();
    setTimeout(() => {
      try {
        this.localFirmInpName1?.focus();
      } catch {
        // ignore
      }
    }, 0);
  }

  _openLocalPersonCreateModal() {
    if (this._isReadOnly()) return;
    if (!this._hasFirmSelectedSaved()) return;
    if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;
    if (!this.localPersonOverlayEl) return;

    this.router?.cleanupTransientOverlays?.();

    this.localPersonModalMode = "create";
    this.localPersonEditId = null;
    this.localPersonCreateOpen = true;
    if (this.localPersonTitleEl) this.localPersonTitleEl.textContent = "Neuer Mitarbeiter";
    this._setLocalPersonCreateError("");
    if (this.localPersonInpFirstName) this.localPersonInpFirstName.value = "";
    if (this.localPersonInpLastName) this.localPersonInpLastName.value = "";
    if (this.localPersonInpFunktion) this.localPersonInpFunktion.value = "";
    if (this.localPersonInpPhone) this.localPersonInpPhone.value = "";
    if (this.localPersonInpEmail) this.localPersonInpEmail.value = "";
    if (this.localPersonInpRolle) this.localPersonInpRolle.value = "";
    if (this.localPersonTaNotes) this.localPersonTaNotes.value = "";
    this.localPersonOverlayEl.style.display = "flex";
    this._applyLocalCreateModalState();
    this.localPersonOverlayEl.focus();
    setTimeout(() => {
      try {
        this.localPersonInpFirstName?.focus();
      } catch {
        // ignore
      }
    }, 0);
  }

  _closeLocalPersonCreateModal() {
    this.localPersonCreateOpen = false;
    this.localPersonModalMode = "create";
    this.localPersonEditId = null;
    this._setLocalPersonCreateError("");
    if (this.localPersonOverlayEl) this.localPersonOverlayEl.style.display = "none";
    this._applyLocalCreateModalState();
  }

  async _openLocalPersonEditModal(person) {
    if (this._isReadOnly()) return;
    if (this.savingFirm || this.savingPerson || this.savingGlobalAssign) return;
    if (!this._hasFirmSelectedSaved()) return;
    if (!person || !person.id) return;
    if (!this.localPersonOverlayEl) return;

    this.router?.cleanupTransientOverlays?.();

    this.localPersonModalMode = "edit";
    this.localPersonEditId = person.id;
    this.localPersonCreateOpen = true;
    if (this.localPersonTitleEl) this.localPersonTitleEl.textContent = "Mitarbeiter bearbeiten";
    this._setLocalPersonCreateError("");
    if (this.localPersonInpFirstName) this.localPersonInpFirstName.value = person.first_name || "";
    if (this.localPersonInpLastName) this.localPersonInpLastName.value = person.last_name || "";
    const localFunktionRolle = String(person.rolle || person.funktion || "");
    if (this.localPersonInpFunktion) this.localPersonInpFunktion.value = localFunktionRolle;
    if (this.localPersonInpPhone) this.localPersonInpPhone.value = person.phone || "";
    if (this.localPersonInpEmail) this.localPersonInpEmail.value = person.email || "";
    if (this.localPersonInpRolle && this.localPersonInpRolle !== this.localPersonInpFunktion) {
      this.localPersonInpRolle.value = localFunktionRolle;
    }
    if (this.localPersonTaNotes) this.localPersonTaNotes.value = person.notes || "";
    this.localPersonOverlayEl.style.display = "flex";
    this._applyLocalCreateModalState();
    this.localPersonOverlayEl.focus();
    setTimeout(() => {
      try {
        this.localPersonInpFirstName?.focus();
      } catch {
        // ignore
      }
    }, 0);
  }

  async _saveLocalFirmModal() {
    if (this._isReadOnly()) return;
    if (this.savingFirm) return;
    this._ensureProjectId();
    if (!this.projectId) {
      this._setLocalFirmCreateError("Bitte zuerst ein Projekt auswaehlen.");
      return;
    }

    const name = (this.localFirmInpName1?.value || "").trim();
    if (!name) {
      this._setLocalFirmCreateError("Name 1 ist Pflicht.");
      this.localFirmInpName1?.focus();
      return;
    }

    if (this.isNewUi) {
      const duplicate = this._findLocalFirmNameDuplicate(name, {
        excludeId: this.localFirmModalMode === "edit" ? this.localFirmEditId : null,
      });
      if (duplicate) {
        this._setLocalFirmCreateError("Firma bereits vorhanden (Duplikat Name).");
        this.localFirmInpName1?.focus();
        return;
      }
    }

    const payload = {
      projectId: this.projectId,
      short: (this.localFirmInpShort?.value || "").trim(),
      name,
      name2: (this.localFirmInpName2?.value || "").trim(),
      street: (this.localFirmInpStreet?.value || "").trim(),
      zip: (this.localFirmInpZip?.value || "").trim(),
      city: (this.localFirmInpCity?.value || "").trim(),
      phone: (this.localFirmInpPhone?.value || "").trim(),
      email: (this.localFirmInpEmail?.value || "").trim(),
      gewerk: (this.localFirmInpGewerk?.value || "").trim(),
      role_code: (this.localFirmSelRole?.value || "60").toString(),
      notes: (this.localFirmTaNotes?.value || "").trim(),
    };

    let success = false;
    let setupChanged = false;
    let reloadFirmsAfter = false;
    let reloadGlobalAfter = false;
    let reloadPersonsAfter = false;
    this.savingFirm = true;
    this._setMsg("Speichere Firma...");
    this._setLocalFirmCreateError("");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();
    this._applyLocalCreateModalState();
    try {
      if (this.localFirmModalMode === "edit" && this.localFirmEditId) {
        const res = await window.bbmDb.projectFirmsUpdate({
          projectFirmId: this.localFirmEditId,
          patch: {
            short: payload.short,
            name: payload.name,
            name2: payload.name2,
            street: payload.street,
            zip: payload.zip,
            city: payload.city,
            phone: payload.phone,
            email: payload.email,
            gewerk: payload.gewerk,
            role_code: payload.role_code,
            notes: payload.notes,
          },
        });
        if (!res?.ok) {
          this._setLocalFirmCreateError(res?.error || "Fehler beim Speichern.");
          return;
        }
        reloadFirmsAfter = true;
        reloadPersonsAfter = true;
        this.firmMode = "edit";
        this._selectFirm(this.localFirmEditId);
        this._closeLocalFirmCreateModal();
        this._setMsg("Firma wurde gespeichert.");
      } else {
        const res = await window.bbmDb.projectFirmsCreate(payload);
        if (!res?.ok) {
          this._setLocalFirmCreateError(res?.error || "Fehler beim Anlegen.");
          return;
        }
        reloadFirmsAfter = true;

        const createdId = res?.firm?.id || null;
        if (createdId) {
          const createdFirm = {
            id: createdId,
            short: payload.short,
            name: payload.name,
            name2: payload.name2,
            street: payload.street,
            zip: payload.zip,
            city: payload.city,
            phone: payload.phone,
            email: payload.email,
            gewerk: payload.gewerk,
            role_code: payload.role_code,
            notes: payload.notes,
          };
          this.firms = [...(this.firms || []), createdFirm];
          this.firmMode = "edit";
          this._selectFirm(createdId);
          reloadPersonsAfter = true;
        }

        this._closeLocalFirmCreateModal();
        this._setMsg("Firma wurde angelegt.");
      }
      reloadGlobalAfter = true;
      setupChanged = true;
      success = true;
      this._renderFirmsOnly();
      this._renderPersonsOnly();
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility();
    } finally {
      this.savingFirm = false;
      if (!success) this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._applyGlobalAssignState();
      this._applyLocalCreateModalState();
      if (setupChanged) this._notifyPoolDataChanged("local-firm-saved");
    }

    if (reloadFirmsAfter || reloadGlobalAfter || reloadPersonsAfter) {
      fireAndForget(
        async () => {
          if (reloadFirmsAfter) await this.reloadFirms();
          if (reloadPersonsAfter && this.selectedFirmId) await this._reloadPersons();
          if (reloadGlobalAfter) await this.reloadGlobalAssignments();
        },
        "ProjectFirmsView reload after saveLocalFirmModal"
      );
    }
  }

  async _saveLocalFirmFromEditor(firmId, data) {
    this._clearStaleBusyState();
    if (this._isReadOnly()) return;
    if (this.savingFirm) return;
    this._ensureProjectId();
    if (!this.projectId || !firmId) return;

    const name = String(data?.name || "").trim();
    if (!name) {
      alert("Name 1 ist Pflicht.");
      return;
    }

    if (this.isNewUi) {
      const duplicate = this._findLocalFirmNameDuplicate(name, { excludeId: firmId });
      if (duplicate) {
        alert("Firma bereits vorhanden (Duplikat Name).");
        return;
      }
    }

    const payload = {
      short: String(data?.short || "").trim(),
      name,
      name2: String(data?.name2 || "").trim(),
      street: String(data?.street || "").trim(),
      zip: String(data?.zip || "").trim(),
      city: String(data?.city || "").trim(),
      phone: String(data?.phone || "").trim(),
      email: String(data?.email || "").trim(),
      gewerk: String(data?.gewerk || "").trim(),
      role_code: String(data?.role_code || "60").toString(),
      notes: String(data?.notes || "").trim(),
    };

    let success = false;
    let setupChanged = false;
    let reloadFirmsAfter = false;
    let reloadGlobalAfter = false;
    let reloadPersonsAfter = false;
    this.savingFirm = true;
    this._setMsg("Speichere Firma...");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();
    this._applyLocalCreateModalState();
    try {
      const res = await window.bbmDb.projectFirmsUpdate({
        projectFirmId: firmId,
        patch: {
          short: payload.short,
          name: payload.name,
          name2: payload.name2,
          street: payload.street,
          zip: payload.zip,
          city: payload.city,
          phone: payload.phone,
          email: payload.email,
          gewerk: payload.gewerk,
          role_code: payload.role_code,
          notes: payload.notes,
        },
      });
      if (!res?.ok) {
        alert(res?.error || "Fehler beim Speichern.");
        return;
      }
      reloadFirmsAfter = true;
      reloadPersonsAfter = true;
      this.firmMode = "edit";
      this._selectFirm(firmId);
      this._setMsg("Firma wurde gespeichert.");
      reloadGlobalAfter = true;
      setupChanged = true;
      success = true;
      this._renderFirmsOnly();
      this._renderSelectedFirmDetails();
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility();
    } catch (err) {
      console.error("[ProjectFirmsView] _saveLocalFirmFromEditor failed:", err);
      alert(err?.message || "Fehler beim Speichern.");
    } finally {
      this.savingFirm = false;
      if (!success) this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._applyGlobalAssignState();
      this._applyLocalCreateModalState();
      if (setupChanged) this._notifyPoolDataChanged("local-firm-saved");
    }

    if (reloadFirmsAfter || reloadPersonsAfter || reloadGlobalAfter) {
      fireAndForget(
        async () => {
          if (reloadFirmsAfter) await this.reloadFirms();
          if (reloadPersonsAfter && this.selectedFirmId) await this._reloadPersons();
          if (reloadGlobalAfter) await this.reloadGlobalAssignments();
        },
        "ProjectFirmsView reload after saveLocalFirmFromEditor"
      );
    }
  }

  async _saveLocalPersonModal() {
    if (this._isReadOnly()) return;
    if (this.savingPerson) return;
    if (!this._hasFirmSelectedSaved()) {
      this._setLocalPersonCreateError("Bitte zuerst eine Firma auswaehlen.");
      return;
    }

    const firstName = (this.localPersonInpFirstName?.value || "").trim();
    const lastName = (this.localPersonInpLastName?.value || "").trim();
    if (!firstName && !lastName) {
      this._setLocalPersonCreateError("Vorname oder Nachname ist Pflicht.");
      this.localPersonInpFirstName?.focus();
      return;
    }

    let success = false;
    let setupChanged = false;
    let reloadPersonsAfter = false;
    let reloadFirmsAfter = false;
    let reloadGlobalAfter = false;
    this.savingPerson = true;
    this._setMsg("Speichere Mitarbeiter...");
    this._setLocalPersonCreateError("");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();
    this._applyLocalCreateModalState();
    try {
      if (this.localPersonModalMode === "edit" && this.localPersonEditId) {
        const funktionRolle = (this.localPersonInpFunktion?.value || this.localPersonInpRolle?.value || "").trim();
        const res = await window.bbmDb.projectPersonsUpdate({
          projectPersonId: this.localPersonEditId,
          patch: {
            first_name: firstName,
            last_name: lastName,
            funktion: funktionRolle,
            phone: (this.localPersonInpPhone?.value || "").trim(),
            email: (this.localPersonInpEmail?.value || "").trim(),
            rolle: funktionRolle,
            notes: (this.localPersonTaNotes?.value || "").trim(),
          },
        });
        if (!res?.ok) {
          this._setLocalPersonCreateError(res?.error || "Fehler beim Speichern.");
          return;
        }
        reloadPersonsAfter = true;
        this._closeLocalPersonCreateModal();
        this._setMsg("Mitarbeiter wurde gespeichert.");
      } else {
        const funktionRolle = (this.localPersonInpFunktion?.value || this.localPersonInpRolle?.value || "").trim();
        const isAssignedGlobalFirm = this._selectedFirmIsAssignedGlobal();
        const res = isAssignedGlobalFirm
          ? await window.bbmDb.personsCreate({
              firmId: this.selectedFirmId,
              firstName,
              lastName,
              funktion: funktionRolle,
              phone: (this.localPersonInpPhone?.value || "").trim(),
              email: (this.localPersonInpEmail?.value || "").trim(),
              rolle: funktionRolle,
              notes: (this.localPersonTaNotes?.value || "").trim(),
            })
          : await window.bbmDb.projectPersonsCreate({
              projectFirmId: this.selectedFirmId,
              firstName,
              lastName,
              funktion: funktionRolle,
              phone: (this.localPersonInpPhone?.value || "").trim(),
              email: (this.localPersonInpEmail?.value || "").trim(),
              rolle: funktionRolle,
              notes: (this.localPersonTaNotes?.value || "").trim(),
            });
        if (!res?.ok) {
          this._setLocalPersonCreateError(res?.error || "Fehler beim Anlegen.");
          return;
        }
        if (isAssignedGlobalFirm && res?.person?.id) {
          await this._setPersonActive(res.person, 0);
        }

        reloadPersonsAfter = true;
        this._closeLocalPersonCreateModal();
        this._setMsg("Mitarbeiter wurde angelegt.");
      }
      reloadFirmsAfter = true;
      reloadGlobalAfter = true;
      setupChanged = true;
      success = true;
      this._renderPersonsOnly();
      this._applyPersonFormState();
      this._updateVisibility();
    } finally {
      this.savingPerson = false;
      if (!success) this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._applyGlobalAssignState();
      this._applyLocalCreateModalState();
      if (setupChanged) this._notifyPoolDataChanged("local-person-saved");
    }

    if (reloadPersonsAfter || reloadFirmsAfter || reloadGlobalAfter) {
      fireAndForget(
        async () => {
          if (reloadPersonsAfter && this.selectedFirmId) await this._reloadPersons();
          if (reloadFirmsAfter) await this.reloadFirms();
          if (reloadGlobalAfter) await this.reloadGlobalAssignments();
        },
        "ProjectFirmsView reload after saveLocalPersonModal"
      );
    }
  }

  async _saveLocalPersonFromEditor(personId, data) {
    if (this._isReadOnly()) return;
    if (this.savingPerson) return;
    if (!this._hasFirmSelectedSaved()) return;
    if (!personId) return;

    const firstName = String(data?.firstName || "").trim();
    const lastName = String(data?.lastName || "").trim();
    if (!firstName && !lastName) {
      alert("Vorname oder Nachname ist Pflicht.");
      return;
    }

    let success = false;
    let setupChanged = false;
    let reloadPersonsAfter = false;
    let reloadFirmsAfter = false;
    let reloadGlobalAfter = false;
    this.savingPerson = true;
    this._setMsg("Speichere Mitarbeiter...");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();
    this._applyLocalCreateModalState();
    try {
      const res = await window.bbmDb.projectPersonsUpdate({
        projectPersonId: personId,
        patch: {
          first_name: firstName,
          last_name: lastName,
          funktion: String(data?.funktion || "").trim(),
          phone: String(data?.phone || "").trim(),
          email: String(data?.email || "").trim(),
          rolle: String(data?.rolle || "").trim(),
          notes: String(data?.notes || "").trim(),
        },
      });
      if (!res?.ok) {
        alert(res?.error || "Fehler beim Speichern.");
        return;
      }
      reloadPersonsAfter = true;
      reloadFirmsAfter = true;
      reloadGlobalAfter = true;
      setupChanged = true;
      success = true;
      this._renderPersonsOnly();
      this._applyPersonFormState();
      this._updateVisibility();
      this._setMsg("Mitarbeiter wurde gespeichert.");
    } finally {
      this.savingPerson = false;
      if (!success) this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._applyGlobalAssignState();
      this._applyLocalCreateModalState();
      if (setupChanged) this._notifyPoolDataChanged("local-person-saved");
    }

    if (reloadPersonsAfter || reloadFirmsAfter || reloadGlobalAfter) {
      fireAndForget(
        async () => {
          if (reloadPersonsAfter && this.selectedFirmId) await this._reloadPersons();
          if (reloadFirmsAfter) await this.reloadFirms();
          if (reloadGlobalAfter) await this.reloadGlobalAssignments();
        },
        "ProjectFirmsView reload after saveLocalPersonFromEditor"
      );
    }
  }

  async _deleteLocalPersonFromModal() {
    if (this._isReadOnly()) return;
    if (this.savingPerson) return;
    if (this.localPersonModalMode !== "edit" || !this.localPersonEditId) return;

    const personId = this.localPersonEditId;
    this.savingPerson = true;
    let setupChanged = false;
    let reloadPersonsAfter = false;
    let reloadFirmsAfter = false;
    let reloadGlobalAfter = false;
    this._setLocalPersonCreateError("");
    this._setMsg("Loesche Mitarbeiter...");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();
    this._applyLocalCreateModalState();
    try {
      const res = await window.bbmDb.projectPersonsDelete(personId);
      if (!res?.ok) {
        this._setLocalPersonCreateError(res?.error || "Loeschen fehlgeschlagen.");
        return;
      }
      this.persons = (this.persons || []).filter((p) => p.id !== personId);
      this._renderPersonsOnly();
      reloadPersonsAfter = true;
      reloadFirmsAfter = true;
      reloadGlobalAfter = true;
      setupChanged = true;
      this._closeLocalPersonCreateModal();
      this._setMsg("Mitarbeiter wurde geloescht.");
      this._applyPersonFormState();
      this._updateVisibility();
    } finally {
      this.savingPerson = false;
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._applyGlobalAssignState();
      this._applyLocalCreateModalState();
      if (setupChanged) this._notifyPoolDataChanged("local-person-deleted");
    }

    if (reloadPersonsAfter || reloadFirmsAfter || reloadGlobalAfter) {
      fireAndForget(
        async () => {
          if (reloadPersonsAfter && this.selectedFirmId) await this._reloadPersons();
          if (reloadFirmsAfter) await this.reloadFirms();
          if (reloadGlobalAfter) await this.reloadGlobalAssignments();
        },
        "ProjectFirmsView reload after deleteLocalPersonModal"
      );
    }
  }

  async _deleteLocalFirmFromModal() {
    if (this._isReadOnly()) return;
    if (this.savingFirm) return;
    if (this.localFirmModalMode !== "edit" || !this.localFirmEditId) return;
    if (Array.isArray(this.persons) && this.persons.length > 0) {
      this._setLocalFirmCreateError(
        this.isNewUi
          ? "Loeschen nicht moeglich: zuerst zugeordnete Mitarbeiter entfernen."
          : "Loeschen nicht moeglich: Firma hat noch aktive Mitarbeiter."
      );
      return;
    }

    const firmId = this.localFirmEditId;
    this.savingFirm = true;
    let setupChanged = false;
    let reloadFirmsAfter = false;
    let reloadGlobalAfter = false;
    this._setLocalFirmCreateError("");
    this._setMsg("Loesche Firma...");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();
    this._applyLocalCreateModalState();
    try {
      const res = await window.bbmDb.projectFirmsDelete(firmId);
      if (!res?.ok) {
        this._setLocalFirmCreateError(res?.error || "Loeschen fehlgeschlagen.");
        return;
      }

      this.firms = (this.firms || []).filter((f) => f.id !== firmId);
      this._closeLocalFirmCreateModal();
      this._closeFirmEditor();
      this._selectFirm(null);
      this.persons = [];

      this._renderFirmsOnly();
      this._renderPersonsOnly();

      reloadFirmsAfter = true;
      reloadGlobalAfter = true;
      this._setMsg("Firma wurde geloescht.");
      setupChanged = true;
    } finally {
      this.savingFirm = false;
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._applyGlobalAssignState();
      this._applyLocalCreateModalState();
      this._updateVisibility();
      if (setupChanged) this._notifyPoolDataChanged("local-firm-deleted");
    }

    if (reloadFirmsAfter || reloadGlobalAfter) {
      fireAndForget(
        async () => {
          if (reloadFirmsAfter) await this.reloadFirms();
          if (reloadGlobalAfter) await this.reloadGlobalAssignments();
        },
        "ProjectFirmsView reload after deleteLocalFirmModal"
      );
    }
  }
  // ------------------------------------------------------------
  // Actions (lokal)
  // ------------------------------------------------------------
  async _saveFirm() {
    if (this._isReadOnly()) return;
    if (this.savingFirm) return;

    this._ensureProjectId();
    if (!this.projectId) {
      alert("Bitte zuerst ein Projekt auswÃ¤hlen.");
      return;
    }

    const data = this._getFirmFormData();
    if (!data.name) {
      alert("Name 1 ist Pflicht.");
      return;
    }
    if (this.isNewUi) {
      const duplicate = this._findLocalFirmNameDuplicate(data.name, {
        excludeId: this.firmMode === "edit" ? this.selectedFirmId : null,
      });
      if (duplicate) {
        alert("Firma bereits vorhanden (Duplikat Name).");
        return;
      }
    }

    this.savingFirm = true;
    let setupChanged = false;
    let reloadFirmsAfter = false;
    let reloadGlobalAfter = false;
    this._setMsg("Speichereâ€¦");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();

    try {
      if (this.firmMode === "create") {
        const res = await window.bbmDb.projectFirmsCreate({
          projectId: this.projectId,
          short: data.short,
          name: data.name,
          name2: data.name2,
          street: data.street,
          zip: data.zip,
          city: data.city,
          phone: data.phone,
          email: data.email,
          gewerk: data.gewerk,
          role_code: data.role_code,
          notes: data.notes,
        });
        if (!res?.ok) {
          alert(res?.error || "Fehler beim Anlegen");
          return;
        }

        this._closeFirmEditor();
        reloadFirmsAfter = true;
      } else if (this.firmMode === "edit" && this.selectedFirmId) {
        const res = await window.bbmDb.projectFirmsUpdate({
          projectFirmId: this.selectedFirmId,
          patch: {
            short: data.short,
            name: data.name,
            name2: data.name2,
            street: data.street,
            zip: data.zip,
            city: data.city,
            phone: data.phone,
            email: data.email,
            gewerk: data.gewerk,
            role_code: data.role_code,
            notes: data.notes,
          },
        });
        if (!res?.ok) {
          alert(res?.error || "Fehler beim Speichern");
          return;
        }

        this._closeFirmEditor();
        reloadFirmsAfter = true;
      }
      reloadGlobalAfter = true;
      setupChanged = true;
    } finally {
      this.savingFirm = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._renderFirmsOnly();
      this._renderPersonsOnly();
      this._updateVisibility();
      this._applyGlobalAssignState();
      if (setupChanged) this._notifyPoolDataChanged("firm-saved");
    }

    if (reloadFirmsAfter || reloadGlobalAfter) {
      fireAndForget(
        async () => {
          if (reloadFirmsAfter) await this.reloadFirms();
          if (reloadGlobalAfter) await this.reloadGlobalAssignments();
        },
        "ProjectFirmsView reload after saveFirm"
      );
    }
  }

  async _deleteFirm() {
    if (this._isReadOnly()) return;
    if (this.savingFirm) return;
    if (this.firmMode !== "edit" || !this.selectedFirmId) return;
    const deleteAction = this._getSelectedFirmDeleteAction();
    if (!deleteAction.isAssignedGlobalFirm && Array.isArray(this.persons) && this.persons.length > 0) {
      alert(
        this.isNewUi
          ? "Loeschen nicht moeglich: zuerst zugeordnete Mitarbeiter entfernen."
          : "Loeschen nicht moeglich: Firma hat noch aktive Mitarbeiter."
      );
      return;
    }

    this.savingFirm = true;
    let setupChanged = false;
    let reloadFirmsAfter = false;
    let reloadGlobalAfter = false;
    this._setMsg(deleteAction.busyMessage);
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();

    try {
      const firmId = this.selectedFirmId;
      const res = deleteAction.isAssignedGlobalFirm
        ? await window.bbmDb.projectFirmsUnassignGlobalFirm({ projectId: this.projectId, firmId })
        : await window.bbmDb.projectFirmsDelete(firmId);
      if (!res?.ok) {
        alert(res?.error || deleteAction.errorMessage);
        return;
      }

      this.firms = (this.firms || []).filter((f) => f.id !== firmId);
      this._closeFirmEditor();
      this._selectFirm(null);
      this.persons = [];

      this._renderFirmsOnly();
      this._renderPersonsOnly();

      reloadFirmsAfter = true;
      reloadGlobalAfter = true;
      setupChanged = true;
    } finally {
      this.savingFirm = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility();
      this._applyGlobalAssignState();
      if (setupChanged) this._notifyPoolDataChanged("firm-deleted");
    }

    if (reloadFirmsAfter || reloadGlobalAfter) {
      fireAndForget(
        async () => {
          if (reloadFirmsAfter) await this.reloadFirms();
          if (reloadGlobalAfter) await this.reloadGlobalAssignments();
        },
        "ProjectFirmsView reload after deleteFirm"
      );
    }
  }
  async _savePerson() {
    if (this._isReadOnly()) return;
    if (this.savingPerson) return;
    if (!this._hasFirmSelectedSaved()) return;
    if (this.personMode !== "create" && this.personMode !== "edit") return;

    const data = this._getPersonFormData();
    if (!data.firstName && !data.lastName) {
      alert("Name ist Pflicht.");
      return;
    }

    this.savingPerson = true;
    let setupChanged = false;
    let reloadPersonsAfter = false;
    let reloadFirmsAfter = false;
    let reloadGlobalAfter = false;
    this._setMsg("Speichere Mitarbeiterâ€¦");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();

    try {
      if (this.personMode === "create") {
        const isAssignedGlobalFirm = this._selectedFirmIsAssignedGlobal();
        const res = isAssignedGlobalFirm
          ? await window.bbmDb.personsCreate({
              firmId: this.selectedFirmId,
              firstName: data.firstName,
              lastName: data.lastName,
              funktion: data.funktion,
              email: data.email,
              phone: data.phone,
              rolle: data.rolle,
              notes: data.notes,
            })
          : await window.bbmDb.projectPersonsCreate({
              projectFirmId: this.selectedFirmId,
              firstName: data.firstName,
              lastName: data.lastName,
              funktion: data.funktion,
              email: data.email,
              phone: data.phone,
              rolle: data.rolle,
              notes: data.notes,
            });

        if (!res?.ok) {
          alert(res?.error || "Fehler beim Anlegen");
          return;
        }
        if (isAssignedGlobalFirm && res?.person?.id) {
          await this._setPersonActive(res.person, 0);
        }

        this.personMode = "none";
        this.editPersonId = null;

        reloadPersonsAfter = true;
      } else if (this.personMode === "edit" && this.editPersonId) {
        const res = await window.bbmDb.projectPersonsUpdate({
          projectPersonId: this.editPersonId,
          patch: {
            first_name: data.firstName,
            last_name: data.lastName,
            funktion: data.funktion,
            email: data.email,
            phone: data.phone,
            rolle: data.rolle,
            notes: data.notes,
          },
        });

        if (!res?.ok) {
          alert(res?.error || "Fehler beim Speichern");
          return;
        }

        this.personMode = "none";
        this.editPersonId = null;

        reloadPersonsAfter = true;
      }
      reloadFirmsAfter = true;
      reloadGlobalAfter = true;
      setupChanged = true;
    } finally {
      this.savingPerson = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility();
      this._applyGlobalAssignState();
      if (setupChanged) this._notifyPoolDataChanged("person-saved");
    }

    if (reloadPersonsAfter || reloadFirmsAfter || reloadGlobalAfter) {
      fireAndForget(
        async () => {
          if (reloadPersonsAfter && this.selectedFirmId) await this._reloadPersons();
          if (reloadFirmsAfter) await this.reloadFirms();
          if (reloadGlobalAfter) await this.reloadGlobalAssignments();
        },
        "ProjectFirmsView reload after savePerson"
      );
    }
  }

  async _deletePerson(projectPersonId) {
    if (this._isReadOnly()) return;
    if (this.savingPerson) return;
    if (!this._hasFirmSelectedSaved()) return;
    if (!projectPersonId) return;

    this.savingPerson = true;
    let setupChanged = false;
    let reloadPersonsAfter = false;
    let reloadFirmsAfter = false;
    let reloadGlobalAfter = false;
    this._setMsg("Loesche Mitarbeiter...");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();

    try {
      const res = await window.bbmDb.projectPersonsDelete(projectPersonId);
      if (!res?.ok) {
        alert(res?.error || "Loeschen fehlgeschlagen");
        return;
      }

      this.persons = (this.persons || []).filter((p) => p.id !== projectPersonId);

      if (this.personMode === "edit" && this._sameId(this.editPersonId, projectPersonId)) {
        this.personMode = "none";
        this.editPersonId = null;
      }

      this._renderPersonsOnly();

      reloadPersonsAfter = true;
      reloadFirmsAfter = true;
      reloadGlobalAfter = true;
      setupChanged = true;
    } finally {
      this.savingPerson = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility();
      this._applyGlobalAssignState();
      if (setupChanged) this._notifyPoolDataChanged("person-deleted");
    }

    if (reloadPersonsAfter || reloadFirmsAfter || reloadGlobalAfter) {
      fireAndForget(
        async () => {
          if (reloadPersonsAfter && this.selectedFirmId) await this._reloadPersons();
          if (reloadFirmsAfter) await this.reloadFirms();
          if (reloadGlobalAfter) await this.reloadGlobalAssignments();
        },
        "ProjectFirmsView reload after deletePerson"
      );
    }
  }
  // ------------------------------------------------------------
  // Global-Firmen ? Projekt: Daten laden (Hauptscreen rechts)
  // ------------------------------------------------------------
  async reloadGlobalAssignments() {
    this._ensureProjectId();

    if (!this.projectId) {
      this.globalFirms = [];
      this.assignedGlobalFirms = [];
      this._renderAssignedGlobalFirmsOnly();
      this._applyGlobalAssignState();
      return;
    }

    // 1) alle globalen Firmen
    const resF = await window.bbmDb.firmsListGlobal();
    if (resF?.ok) {
      const list = resF.list || [];
      list.sort((a, b) => {
        const as = this._firmShortText(a).toLowerCase();
        const bs = this._firmShortText(b).toLowerCase();
        if (as < bs) return -1;
        if (as > bs) return 1;
        return 0;
      });
      this.globalFirms = list;
    } else {
      this.globalFirms = [];
    }

    // 2) zugeordnet (aktuell wird dafÃ¼r candidates-API verwendet)
    const resC = await window.bbmDb.projectFirmsListFirmCandidatesByProject(this.projectId);
    const assignedIds = new Set();
    let fallbackAssigned = [];
    const activeById = new Map();

    if (resC?.ok) {
      const list = (resC.list || []).filter((x) => x.kind === "global_firm");
      for (const x of list) {
        if (x?.id) {
          assignedIds.add(x.id);
          activeById.set(x.id, x?.is_active ?? x?.isActive);
        }
      }
      fallbackAssigned = list;
    }

    // 3) Display-Liste bauen (mit Gewerk, wenn vorhanden)
    if (this.globalFirms && this.globalFirms.length) {
      const assigned = [];
      for (const gf of this.globalFirms) {
        if (assignedIds.has(gf.id)) {
          assigned.push({
            ...gf,
            is_active: activeById.has(gf.id) ? activeById.get(gf.id) : gf?.is_active,
          });
        }
      }

      // falls IDs existieren, die in globalFirms nicht enthalten sind (sollte selten sein)
      for (const x of fallbackAssigned) {
        if (!x?.id) continue;
        if (assigned.some((a) => a.id === x.id)) continue;
        assigned.push({
          id: x.id,
          short: x.short ?? null,
          name: x.name ?? null,
          gewerk: null,
        });
      }

      this.assignedGlobalFirms = assigned.map((firm) => ({
        ...firm,
        __firmSource: "global_assigned",
      }));
    } else {
      // fallback: nur candidates
      this.assignedGlobalFirms = (fallbackAssigned || []).map((x) => ({
        id: x.id,
        short: x.short ?? null,
        name: x.name ?? null,
        gewerk: null,
        is_active: x?.is_active ?? x?.isActive,
        __firmSource: "global_assigned",
      }));
    }

    const localFirms = (this.firms || []).filter((firm) => !this._isAssignedGlobalFirm(firm));
    const visibleFirms = [...localFirms];
    for (const firm of this.assignedGlobalFirms || []) {
      if (visibleFirms.some((entry) => this._sameId(entry?.id, firm?.id))) continue;
      visibleFirms.push(firm);
    }
    this.firms = visibleFirms;
    if (this.selectedFirmId && this.firmMode === "edit") {
      this.selectedFirm = this.firms.find((firm) => this._sameId(firm?.id, this.selectedFirmId)) || null;
    }

    this._renderFirmsOnly();
    this._renderAssignedGlobalFirmsOnly();
    this._applyGlobalAssignState();
  }

  _renderAssignedGlobalFirmsOnly() {
    const tb = this.globalAssignedBodyEl;
    if (!tb) return;

    tb.innerHTML = "";

    for (const f of this.assignedGlobalFirms || []) {
      const tr = document.createElement("tr");

      const tdShort = document.createElement("td");
      tdShort.style.padding = "6px";
      tdShort.style.borderBottom = "1px solid #eee";
      tdShort.textContent = this._firmShortText(f);

      const tdGewerk = document.createElement("td");
      tdGewerk.style.padding = "6px";
      tdGewerk.style.borderBottom = "1px solid #eee";
      tdGewerk.textContent = this._firmGewerkText(f);

      tr.append(tdShort, tdGewerk);
      tb.appendChild(tr);
    }

    if (!(this.assignedGlobalFirms || []).length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 2;
      td.style.padding = "10px 6px";
      td.style.fontSize = "12px";
      td.style.opacity = "0.75";
      td.textContent = "Keine Firmen aus der globalen Liste hinzugefÃ¼gt.";
      tr.appendChild(td);
      tb.appendChild(tr);
    }
  }

  _applyGlobalAssignState() {
    const isSaving = !!this.savingFirm || !!this.savingPerson || !!this.savingGlobalAssign;
    this._ensureProjectId();
    const hasProject = !!this.projectId;
    const ro = this._isReadOnly();

    if (this.btnGlobalAssign) {
      const canAssign = hasProject && !ro && !isSaving;
      this.btnGlobalAssign.disabled = !canAssign;
      this.btnGlobalAssign.style.opacity = canAssign ? "1" : "0.55";
    }

    // Modal Controls (wenn offen)
    const modalOpen = !!this.globalAssignOpen && !!this.globalAssignOverlayEl;
    if (modalOpen) {
      const canInteract = !isSaving && !ro;


      if (this.globalAssignBtnSaveEl) {
        this.globalAssignBtnSaveEl.disabled = !canInteract;
        this.globalAssignBtnSaveEl.style.opacity = canInteract ? "1" : "0.55";
      }

      if (this.globalAssignBtnCancelEl) this.globalAssignBtnCancelEl.disabled = isSaving;
      if (this.globalAssignBtnCloseEl) this.globalAssignBtnCloseEl.disabled = isSaving;
    }

    this._applyLocalCreateModalState();
  }

  // ------------------------------------------------------------
  // Global-Firmen ? Projekt: Modal (Dual-List)
  // ------------------------------------------------------------
  async _openGlobalAssignModal() {
    if (this._isReadOnly()) return;
    if (this.savingGlobalAssign || this.savingFirm || this.savingPerson) return;

    this._ensureProjectId();
    if (!this.projectId) {
      alert("Bitte zuerst ein Projekt auswÃ¤hlen.");
      return;
    }

    this.globalAssignOpen = true;
    this.globalAssignErr = "";

    if (this.globalAssignOverlayEl) {
      this.globalAssignOverlayEl.style.display = "flex";
      try {
        this.globalAssignOverlayEl.focus();
      } catch (_e) {
        // ignore
      }
    }

    await this._loadGlobalAssignData();
    this._applyGlobalAssignState();
  }

  _closeGlobalAssignModal() {
    // absichtlich OHNE "wenn saving -> return", damit "Speichern" den Dialog sicher schlieÃŸen kann
    this.globalAssignOpen = false;
    this.globalAssignErr = "";
    this.globalAssignAll = [];
    this.globalAssignSelectedIds = new Set();
    this.globalAssignInitialIds = new Set();

    if (this.globalAssignOverlayEl) this.globalAssignOverlayEl.style.display = "none";
    this._setGlobalAssignError("");
    this._applyGlobalAssignState();
  }

  _setGlobalAssignError(text) {
    this.globalAssignErr = text || "";
    if (!this.globalAssignErrEl) return;
    if (!this.globalAssignErr) {
      this.globalAssignErrEl.style.display = "none";
      this.globalAssignErrEl.textContent = "";
    } else {
      this.globalAssignErrEl.style.display = "block";
      this.globalAssignErrEl.textContent = this.globalAssignErr;
    }
  }

  async _loadGlobalAssignData() {
    this._setGlobalAssignError("");

    // 1) alle globalen Firmen
    const resF = await window.bbmDb.firmsListGlobal();
    if (!resF?.ok) {
      this.globalAssignAll = [];
      this._setGlobalAssignError(resF?.error || "Fehler beim Laden der globalen Firmen");
      this._renderGlobalAssignLists();
      return;
    }

    const all = resF.list || [];
    all.sort((a, b) => {
      const as = this._firmShortText(a).toLowerCase();
      const bs = this._firmShortText(b).toLowerCase();
      if (as < bs) return -1;
      if (as > bs) return 1;
      return 0;
    });

    this.globalAssignAll = all;

    // 2) zugeordnet (aktuell via candidates)
    const resC = await window.bbmDb.projectFirmsListFirmCandidatesByProject(this.projectId);
    const assignedIds = new Set();

    if (resC?.ok) {
      const list = (resC.list || []).filter((x) => x.kind === "global_firm");
      for (const x of list) if (x?.id) assignedIds.add(x.id);
    } else {
      // nicht hart abbrechen: Modal kann trotzdem offen bleiben, aber ohne initiale Selektion
      this._setGlobalAssignError(resC?.error || "Fehler beim Laden der Zuordnungen");
    }

    // IDs nur Ã¼bernehmen, die auch in 'all' existieren (firmsListGlobal filtert removed_at)
    const allIds = new Set(all.map((x) => x.id));
    const filtered = new Set();
    for (const id of assignedIds) if (allIds.has(id)) filtered.add(id);

    this.globalAssignInitialIds = new Set([...filtered]);
    this.globalAssignSelectedIds = new Set([...filtered]);

    this._renderGlobalAssignLists();
  }

  _renderGlobalAssignLists() {
    if (!this.globalAssignLeftListEl || !this.globalAssignRightListEl) return;

    const selectedIds = this.globalAssignSelectedIds || new Set();
    const all = this.globalAssignAll || [];

    const left = [];
    const right = [];

    for (const f of all) {
      const isSel = selectedIds.has(f.id);

      if (isSel) {
        right.push(f);
      } else {
        left.push(f);
      }
    }

    const renderList = (el, items, onDblClick) => {
      el.innerHTML = "";

      for (const f of items) {
        const row = document.createElement("div");
        row.style.padding = "8px";
        row.style.borderRadius = "8px";
        row.style.cursor = this._isReadOnly() ? "default" : "pointer";
        row.style.userSelect = "none";
        row.style.border = "1px solid rgba(0,0,0,0.08)";
        row.style.marginBottom = "6px";
        row.style.background = "#fff";

        const t1 = document.createElement("div");
        t1.textContent = this._firmShortText(f);
        t1.style.fontWeight = "bold";

        const t2 = document.createElement("div");
        t2.textContent = this._firmGewerkText(f) || "";
        t2.style.fontSize = "12px";
        t2.style.opacity = "0.8";

        row.append(t1, t2);

        row.ondblclick = () => {
          if (this._isReadOnly()) return;
          if (this.savingGlobalAssign || this.savingFirm || this.savingPerson) return;
          onDblClick(f);
        };

        el.appendChild(row);
      }

      if (!items.length) {
        const empty = document.createElement("div");
        empty.style.padding = "10px";
        empty.style.fontSize = "12px";
        empty.style.opacity = "0.7";
        empty.textContent = "Keine EintrÃ¤ge";
        el.appendChild(empty);
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

    this._applyGlobalAssignState();
  }

  async _saveGlobalAssignModal() {
    if (this._isReadOnly()) return;
    if (this.savingGlobalAssign || this.savingFirm || this.savingPerson) return;

    this._ensureProjectId();
    if (!this.projectId) {
      // Modal soll trotzdem schlieÃŸen (User-Regel), aber wir kÃ¶nnen nicht speichern
      this._closeGlobalAssignModal();
      alert("Projekt-Kontext fehlt. Bitte Projekt auswÃ¤hlen.");
      return;
    }

    const projectId = this.projectId;

    const initial = this.globalAssignInitialIds || new Set();
    const current = this.globalAssignSelectedIds || new Set();

    let toAssign = [];
    let toUnassign = [];

    for (const id of current) if (!initial.has(id)) toAssign.push(id);
    for (const id of initial) if (!current.has(id)) toUnassign.push(id);

    // ? User-Regel: Modal sofort schlieÃŸen bei Klick auf Speichern
    this._closeGlobalAssignModal();

    this.savingGlobalAssign = true;
    let hasSaveError = false;
    let setupChanged = false;
    this._setMsg("Speichere Zuordnungâ€¦");
    this._applyFirmFormState();
    this._applyPersonFormState();
    this._applyGlobalAssignState();

    try {
      const latestAssigned = new Set();
      if (this.isNewUi) {
        const latestRes = await window.bbmDb.projectFirmsListFirmCandidatesByProject(projectId);
        if (latestRes?.ok) {
          for (const item of latestRes.list || []) {
            if (String(item?.kind || "") !== "global_firm") continue;
            if (item?.id) latestAssigned.add(String(item.id));
          }
        }
      }

      const duplicateAssign = [];
      if (latestAssigned.size) {
        toAssign = toAssign.filter((firmId) => {
          const exists = latestAssigned.has(String(firmId));
          if (exists) duplicateAssign.push(firmId);
          return !exists;
        });
      }

      for (const firmId of toAssign) {
        const res = await window.bbmDb.projectFirmsAssignGlobalFirm({ projectId, firmId });
        if (!res?.ok) throw new Error(res?.error || "Zuordnung fehlgeschlagen");
        setupChanged = true;
      }

      if (toAssign.length) {
        const api = window.bbmDb || {};
        if (
          typeof api.projectCandidatesList === "function" &&
          typeof api.projectCandidatesSet === "function" &&
          typeof api.personsListByFirm === "function"
        ) {
          const existingCandidatesRes = await api.projectCandidatesList({ projectId });
          const merged = new Map();

          if (existingCandidatesRes?.ok) {
            for (const item of existingCandidatesRes.items || []) {
              const kind = String(item?.kind || "").trim();
              const personId = String(item?.personId ?? item?.person_id ?? "").trim();
              if (!kind || !personId) continue;
              merged.set(`${kind}::${personId}`, {
                kind,
                personId,
                isActive: Number(item?.is_active ?? item?.isActive ?? 0) === 1 ? 1 : 0,
              });
            }
          }

          for (const firmId of toAssign) {
            const personsRes = await api.personsListByFirm(firmId);
            if (!personsRes?.ok) continue;
            for (const person of personsRes.list || []) {
              const personId = String(person?.id || "").trim();
              if (!personId) continue;
              const key = `global_person::${personId}`;
              if (merged.has(key)) continue;
              merged.set(key, {
                kind: "global_person",
                personId,
                isActive: 0,
              });
            }
          }

          const setRes = await api.projectCandidatesSet({
            projectId,
            items: [...merged.values()],
          });
          if (!setRes?.ok) {
            throw new Error(setRes?.error || "Mitarbeiter konnten nicht uebernommen werden");
          }
        }
      }


      for (const firmId of toUnassign) {
        const res = await window.bbmDb.projectFirmsUnassignGlobalFirm({ projectId, firmId });
        if (!res?.ok) throw new Error(res?.error || "Entfernen fehlgeschlagen");
        setupChanged = true;
      }

      if (duplicateAssign.length) {
        alert("Stammfirma bereits zugeordnet.");
      }
    } catch (e) {
      hasSaveError = true;
      alert(e?.message || "Fehler beim Speichern der Zuordnung");
    } finally {
      this.savingGlobalAssign = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._applyGlobalAssignState();
      await this.reloadFirms();
      await this.reloadGlobalAssignments();
      if (setupChanged) this._notifyPoolDataChanged("global-assignments-saved");
    }
  }
}
