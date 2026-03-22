// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.1
// src/renderer/views/FirmsView.js

import { applyPopupButtonStyle } from "../ui/popupButtonStyles.js";
import { OVERLAY, OVERLAY_TOP } from "../ui/zIndex.js";
import { fireAndForget } from "../utils/async.js";
//
// GLOBAL Firmen (Stamm) + GLOBAL Mitarbeiter (Persons) je Firma
// UI-Flow (verbindlich):
// - Start: Firmenliste + "Neue Firma"
// - Klick Firma: Firm-Editbox sichtbar, darunter MA-Liste + "Neuer MA"
// - Klick MA / Neuer MA: MA-Editbox sichtbar UND Firm-Editbox (Firmenfelder) muss Schließen
// - MA-Editbox zu => Firm-Editbox wieder sichtbar
//
// Zusätzlich (verbindlich):
// - In MA-Zeilen gibt es KEIN Edit/Delete mehr (nur Zeilen-Klick)
// - MA-Delete nur in MA-Editbox
// - Buttontext: "Speichern" (statt "Mitarbeiter speichern")
// - Firm "Speichern" schließt die Editbox (zurück zur Liste)
//
// Preload APIs:
// - firmsListGlobal / firmsCreateGlobal / firmsUpdateGlobal / firmsDeleteGlobal / firmsMarkTrashed
// - personsListByFirm / personsCreate / personsUpdate / personsDelete / personsMarkTrashed
//
export default class FirmsView {
  constructor({
    router,
    importContext = "stamm",
    getImportProjectId = null,
    getImportProjectFirmId = null,
    lockPersonImportFirmSelection = false,
    onImportRefresh = null,
  } = {}) {
    this.router = router;

    this.root = null;

    // state
    this.firms = [];
    this.selectedFirmId = null;
    this.selectedFirm = null;

    this.persons = [];

    // modes
    this.firmMode = "none"; // "none" | "create" | "edit"
    this.personMode = "none"; // "none" | "create" | "edit"
    this.editPersonId = null; // nur wenn personMode === "edit"

    // busy
    this.savingFirm = false;
    this.savingPerson = false;

    // ui refs
    this.msgEl = null;

    // firms list
    this.tableBodyEl = null;
    this.btnNewFirm = null;
    this.btnImportCsv = null;
    this.btnImportPersonsCsv = null;

    // firm editor containers
    this.editWrapEl = null;
    this.firmGridEl = null;

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
    this.personsWrapEl = null;
    this.personTableBodyEl = null;
    this.btnNewPerson = null;

    // person form container
    this.personFormEl = null;

    // person inputs
    this.inpFirstName = null;
    this.inpLastName = null;
    this.inpFunktion = null;
    this.inpPhone = null;
    this.inpEmail = null;
    this.inpRolle = null;
    this.taPersonNotes = null;

    this.btnSavePerson = null;
    this.btnDeletePerson = null;

    this.roleOrder = this._defaultRoleOrder();
    this.roleLabels = this._defaultRoleLabels();

    // CSV Import staging modal
    this.importModalRoot = null;
    this.importDropEl = null;
    this.importFileNameEl = null;
    this.importListBodyEl = null;
    this.importDetailWrapEl = null;
    this.importRawEl = null;
    this.importSummaryEl = null;
    this.importSelectedRowId = null;
    this.importItems = [];
    this.importSourceFilePath = "";
    this.importLoading = false;
    this.importDetailOverlay = null;

    // CSV Personen Import staging modal
    this.personImportModalRoot = null;
    this.personImportDropEl = null;
    this.personImportFileNameEl = null;
    this.personImportListBodyEl = null;
    this.personImportHeadFirstNameEl = null;
    this.personImportHeadLastNameEl = null;
    this.personImportDetailWrapEl = null;
    this.personImportRawEl = null;
    this.personImportCompareEl = null;
    this.personImportSummaryEl = null;
    this.personImportSelectedRowId = null;
    this.personImportItems = [];
    this.personImportFirms = [];
    this.personImportLoading = false;

    this.personImportFirmListBtn = null;
    this.personImportFirmListPanel = null;
    this.personImportFirmListDocHandler = null;

    this.personImportNewFirmOverlay = null;
    this.personImportNewFirmItem = null;
    this.personImportNewFirmSaving = false;
    this.personImportDetailOverlay = null;

    this.firmPopupOverlay = null;
    this.firmPopupBodyEl = null;

    this.personPopupOverlay = null;
    this.personPopupBodyEl = null;
    this.personPopupTitleEl = null;

    this.detailTitleEl = null;
    this.detailBodyEl = null;

    this._importMenuDocHandler = null;
    this._importMenuContainer = null;
    this._importMenuElement = null;

    this.importContext = String(importContext || "stamm").trim().toLowerCase();
    this.getImportProjectId = typeof getImportProjectId === "function" ? getImportProjectId : null;
    this.getImportProjectFirmId =
      typeof getImportProjectFirmId === "function" ? getImportProjectFirmId : null;
    this.lockPersonImportFirmSelection = !!lockPersonImportFirmSelection;
    this.onImportRefresh = typeof onImportRefresh === "function" ? onImportRefresh : null;
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

    const msg = document.createElement("div");
    msg.style.marginLeft = "auto";
    msg.style.fontSize = "12px";
    msg.style.opacity = "0.85";

    head.append(title, msg);

    const buttonBar = document.createElement("div");
    buttonBar.style.display = "flex";
    buttonBar.style.alignItems = "center";
    buttonBar.style.gap = "8px";
    buttonBar.style.flexWrap = "wrap";

    // ---- Firms list ----
    const listWrap = document.createElement("div");
    listWrap.style.border = "1px solid #ddd";
    listWrap.style.borderRadius = "8px";
    listWrap.style.padding = "10px";
    listWrap.style.background = "#fafafa";
    listWrap.style.display = "flex";
    listWrap.style.flexDirection = "column";
    listWrap.style.overflow = "hidden";
    listWrap.style.maxHeight = "calc(100vh - 220px)";
    const listHead = document.createElement("div");
    listHead.style.display = "flex";
    listHead.style.alignItems = "center";
    listHead.style.marginBottom = "8px";
    const listTitle = document.createElement("div");
    listTitle.textContent = "Firmenliste";
    listTitle.style.fontWeight = "600";
    listHead.append(listTitle);

    const btnNewFirm = document.createElement("button");
    btnNewFirm.textContent = "Neue Firma";
    btnNewFirm.onclick = async () => {
      await this._openFirmEditor({ mode: "create" });
    };

    const btnImportCsv = document.createElement("button");
    btnImportCsv.textContent = "Import (CSV)";
    btnImportCsv.onclick = async () => {
      if (this.savingFirm || this.savingPerson) return;
      this._openImportModal();
    };

    const btnImportPersonsCsv = document.createElement("button");
    btnImportPersonsCsv.textContent = "Import Kontakt (CSV)";
    btnImportPersonsCsv.onclick = async () => {
      if (this.savingFirm || this.savingPerson) return;
      this._openPersonImportModal();
    };

    buttonBar.append(btnNewFirm, btnImportCsv);

    const firmsTable = document.createElement("table");
    firmsTable.style.width = "100%";
    firmsTable.style.borderCollapse = "collapse";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Name</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;width:140px;">Kurzbez.</th>
      </tr>
    `;

    const tbody = document.createElement("tbody");
    firmsTable.append(thead, tbody);
    const tableContainer = document.createElement("div");
    tableContainer.style.flex = "1";
    tableContainer.style.minHeight = "0";
    tableContainer.style.overflowY = "auto";
    tableContainer.appendChild(firmsTable);
    listWrap.append(listHead, tableContainer);

    const listColumn = document.createElement("div");
    listColumn.style.flex = "1 1 0";
    listColumn.style.minWidth = "0";
    listColumn.style.minHeight = "0";
    listColumn.style.display = "flex";
    listColumn.style.flexDirection = "column";
    listColumn.append(listWrap);

    const detailColumn = document.createElement("div");
    detailColumn.style.flex = "1 1 0";
    detailColumn.style.minWidth = "0";
    detailColumn.style.minHeight = "0";
    detailColumn.style.display = "flex";
    detailColumn.style.flexDirection = "column";
    detailColumn.style.gap = "12px";

    const detailCard = document.createElement("div");
    detailCard.style.border = "1px solid #ddd";
    detailCard.style.borderRadius = "12px";
    detailCard.style.background = "#fff";
    detailCard.style.padding = "16px";
    detailCard.style.boxShadow = "0 3px 12px rgba(0,0,0,0.08)";
    detailCard.style.display = "flex";
    detailCard.style.flexDirection = "column";
    detailCard.style.gap = "6px";
    detailCard.style.maxHeight = "220px";
    detailCard.style.minHeight = "180px";
    detailCard.style.overflow = "hidden";

    let personsWrap = null;

    const detailTitle = document.createElement("div");
    detailTitle.textContent = "Ausgewählte Firma";
    detailTitle.style.fontWeight = "700";
    detailTitle.style.fontSize = "16px";

    const detailBody = document.createElement("div");
    detailBody.style.flex = "1";
    detailBody.style.display = "flex";
    detailBody.style.flexDirection = "column";
    detailBody.style.gap = "6px";
    detailBody.style.fontSize = "14px";
    detailBody.style.color = "#1a1a1a";
    detailBody.style.opacity = "0.9";
    detailBody.style.overflow = "hidden";

    const detailPlaceholder = document.createElement("div");
    detailPlaceholder.textContent =
      "Klicke auf eine Firma (einfach) zum Auswählen, Doppelklick zum Bearbeiten.";
    detailBody.append(detailPlaceholder);
    detailCard.append(detailTitle, detailBody);

    const personsContainer = document.createElement("div");
    personsContainer.style.display = "flex";
    personsContainer.style.flexDirection = "column";
    personsContainer.style.flex = "1";
    personsContainer.style.gap = "10px";
    personsContainer.style.overflow = "hidden";

    detailColumn.append(detailCard, personsContainer);

    const main = document.createElement("div");
    main.style.display = "flex";
    main.style.flex = "1";
    main.style.gap = "18px";
    main.style.minHeight = "0";
    main.style.alignItems = "stretch";
    main.append(listColumn, detailColumn);

    // ---- Firm edit wrapper (hidden until select/create) ----
    const editWrap = document.createElement("div");
    editWrap.style.marginTop = "8px";
    editWrap.style.border = "1px solid #ddd";
    editWrap.style.borderRadius = "8px";
    editWrap.style.padding = "6px 8px 10px";
    editWrap.style.background = "#fff";
    editWrap.style.display = "none";

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
    const mkFirmInp = (ph) => {
      const field = mkInp(ph);
      field.size = 50;
      field.style.minWidth = "420px";
      field.style.maxWidth = "520px";
      field.style.boxSizing = "border-box";
      return field;
    };
    const mkGewerkInput = (listId) => {
      const field = mkFirmInp("Funktion / Gewerk?");
      field.setAttribute("list", listId);
      const datalist = document.createElement("datalist");
      datalist.id = listId;
      ["Rohbau", "HLS", "Elektro", "Trockenbau", "Gala-Bau", "Erdarbeiten", "Abbruch"].forEach(
        (label) => {
          const opt = document.createElement("option");
          opt.value = label;
          datalist.appendChild(opt);
        }
      );
      return { field, datalist };
    };

    // Firm grid (this closes when person edit opens)
    const firmGrid = document.createElement("div");
    firmGrid.style.display = "grid";
    firmGrid.style.gridTemplateColumns = "120px minmax(0, 1fr)";
    firmGrid.style.gap = "6px 12px";
    firmGrid.style.alignItems = "center";
    firmGrid.style.marginBottom = "8px";

    const inpFirmName1 = mkFirmInp("Name 1…");
    const inpFirmName2 = mkFirmInp("Name 2…");
    const inpFirmShort = mkFirmInp("verantw. im Projekt");
    const inpFirmStreet = mkFirmInp("Straße / HsNr…");
    const inpFirmZip = mkFirmInp("PLZ…");
    const inpFirmCity = mkFirmInp("Ort…");
    const inpFirmPhone = mkFirmInp("Telefon…");

    const inpFirmEmail = document.createElement("input");
    inpFirmEmail.type = "email";
    inpFirmEmail.placeholder = "E-Mail…";
    inpFirmEmail.style.width = "100%";
    inpFirmEmail.size = 50;
    inpFirmEmail.style.minWidth = "420px";
    inpFirmEmail.style.boxSizing = "border-box";

    const gewerkInput = mkGewerkInput("firm-gewerk-options-global");
    const inpFirmGewerk = gewerkInput.field;

    const selFirmRole = document.createElement("select");
    selFirmRole.style.width = "100%";
    selFirmRole.style.minWidth = "420px";
    selFirmRole.style.boxSizing = "border-box";
    this._renderRoleOptions(selFirmRole);

const taFirmNotes = document.createElement("textarea");
    taFirmNotes.placeholder = "Notizen…";
    taFirmNotes.rows = 3;
    taFirmNotes.style.width = "100%";
    taFirmNotes.style.minWidth = "420px";
    taFirmNotes.style.boxSizing = "border-box";

    firmGrid.append(
      mkLbl("Name 1"), inpFirmName1,
      mkLbl("Name 2"), inpFirmName2,
      mkLbl("Kurzbez."), inpFirmShort,
      mkLbl("Str. / HsNr."), inpFirmStreet,
      mkLbl("PLZ"), inpFirmZip,
      mkLbl("Ort"), inpFirmCity,
      mkLbl("Telefon"), inpFirmPhone,
      mkLbl("E-Mail"), inpFirmEmail,
      mkLbl("Funktion/Gewerk"), inpFirmGewerk,
      mkLbl("Kategorie"), selFirmRole,
      mkLbl("Notizen"), taFirmNotes
    );

    const btnSaveFirm = document.createElement("button");
    btnSaveFirm.textContent = "Speichern";
    applyPopupButtonStyle(btnSaveFirm, { variant: "neutral" });
    btnSaveFirm.onclick = async () => {
      await this._saveFirm();
    };

    const btnDeleteFirm = document.createElement("button");
    btnDeleteFirm.textContent = "Papierkorb";
    btnDeleteFirm.title = "In Papierkorb";
    btnDeleteFirm.style.background = "#c62828";
    btnDeleteFirm.style.color = "#ffffff";
    btnDeleteFirm.style.border = "1px solid rgba(0,0,0,0.25)";
    btnDeleteFirm.style.borderRadius = "6px";
    btnDeleteFirm.style.padding = "6px 10px";
    btnDeleteFirm.onclick = async () => {
      await this._deleteFirm();
    };

    // ---- Persons ----
    personsWrap = document.createElement("div");
    personsWrap.style.display = "flex";
    personsWrap.style.flexDirection = "column";
    personsWrap.style.flex = "1";
    personsWrap.style.minHeight = "0";
    personsWrap.style.overflow = "hidden";

    const personsTitle = document.createElement("div");
    personsTitle.textContent = "Mitarbeiter (Stamm)";
    personsTitle.style.fontWeight = "700";
    personsTitle.style.margin = "0";

    const personsHead = document.createElement("div");
    personsHead.style.display = "flex";
    personsHead.style.gap = "8px";
    personsHead.style.alignItems = "center";
    personsHead.style.margin = "0";

    const btnNewPerson = document.createElement("button");
    btnNewPerson.textContent = "Neuer Mitarbeiter";
    btnNewPerson.onclick = async () => {
      if (!this._hasFirmSelectedSaved()) return;
      await this._openPersonEditor({ mode: "create" });
    };

    personsHead.append(btnNewPerson, btnImportPersonsCsv);

    const personsTable = document.createElement("table");
    personsTable.style.width = "100%";
    personsTable.style.borderCollapse = "collapse";

    const personsThead = document.createElement("thead");
    personsThead.innerHTML = `
      <tr>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Name</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Funktion/Rolle</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">E-Mail</th>
        <th style="text-align:left;padding:6px;border-bottom:1px solid #ddd;">Telefon</th>
      </tr>
    `;

    const personsTbody = document.createElement("tbody");
    personsTable.append(personsThead, personsTbody);

    const personsTableWrap = document.createElement("div");
    personsTableWrap.style.flex = "1";
    personsTableWrap.style.minHeight = "0";
    personsTableWrap.style.overflowY = "auto";
    personsTableWrap.appendChild(personsTable);

    // Person form (hidden until create/edit)
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

    const inpFirstName = mkInp("Vorname…");
    const inpLastName = mkInp("Nachname…");
    const inpFunktionRole = mkInp("Funktion/Rolle…");

    const inpEmail = document.createElement("input");
    inpEmail.type = "email";
    inpEmail.placeholder = "E-Mail…";
    inpEmail.style.width = "100%";

    const inpPhone = mkInp("Telefon…");

    const taPersonNotes = document.createElement("textarea");
    taPersonNotes.placeholder = "Notizen…";
    taPersonNotes.rows = 3;
    taPersonNotes.style.width = "100%";

    pGrid.append(
      mkLbl("Vorname"), inpFirstName,
      mkLbl("Nachname"), inpLastName,
      mkLbl("Funktion/Rolle"), inpFunktionRole,
      mkLbl("E-Mail"), inpEmail,
      mkLbl("Telefon"), inpPhone,
      mkLbl("Notizen"), taPersonNotes
    );

    const btnSavePerson = document.createElement("button");
    btnSavePerson.textContent = "Speichern";
    applyPopupButtonStyle(btnSavePerson, { variant: "neutral" });
    btnSavePerson.onclick = async () => {
      await this._savePerson();
    };

    const btnDeletePerson = document.createElement("button");
    btnDeletePerson.textContent = "Papierkorb";
    btnDeletePerson.title = "In Papierkorb";
    btnDeletePerson.style.background = "#c62828";
    btnDeletePerson.style.color = "#ffffff";
    btnDeletePerson.style.border = "1px solid rgba(0,0,0,0.25)";
    btnDeletePerson.style.borderRadius = "6px";
    btnDeletePerson.style.padding = "6px 10px";
    btnDeletePerson.onclick = async () => {
      if (!this.editPersonId) return;
      await this._deletePerson(this.editPersonId);
    };

    personForm.append(pGrid);

    personsWrap.append(personsTitle, personsHead, personsTableWrap);

    personsContainer.append(personsWrap);

    editWrap.append(firmGrid, gewerkInput.datalist);

    root.append(head, buttonBar, main);

    // refs
    this.root = root;
    this.msgEl = msg;

    this.btnNewFirm = btnNewFirm;
    this.btnImportCsv = btnImportCsv;
    this.btnImportPersonsCsv = btnImportPersonsCsv;
    this.tableBodyEl = tbody;

    this.editWrapEl = editWrap;
    this.firmGridEl = firmGrid;

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
    this.btnDeleteFirm = btnDeleteFirm;

    this.personsWrapEl = personsWrap;
    this.personTableBodyEl = personsTbody;
    this.btnNewPerson = btnNewPerson;

    this.personFormEl = personForm;

    this.inpFirstName = inpFirstName;
    this.inpLastName = inpLastName;
    this.inpFunktion = inpFunktionRole;
    this.inpEmail = inpEmail;
    this.inpPhone = inpPhone;
    this.inpRolle = inpFunktionRole;
    this.taPersonNotes = taPersonNotes;

    this.btnSavePerson = btnSavePerson;
    this.btnDeletePerson = btnDeletePerson;

    this.detailTitleEl = detailTitle;
    this.detailBodyEl = detailBody;

    this._ensureFirmPopup();
    this._ensurePersonPopup();

    return root;
  }

  async load() {
    await this._loadRoleMeta();
    await this.reloadFirms();
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  _setMsg(text) {
    if (!this.msgEl) return;
    this.msgEl.textContent = text || "";
  }

  _hasFirmSelectedSaved() {
    return !!this.selectedFirmId;
  }

  _personIdKey(id) {
    if (id === null || id === undefined || id === "") return "";
    return String(id);
  }

  _sameId(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return false;
    return String(a) === String(b);
  }

  _clearStaleBusyState() {
    const importBusy = !!this.importLoading || !!this.personImportLoading || !!this.personImportNewFirmSaving;
    const editorVisible =
      (!!this.firmPopupOverlay && this.firmPopupOverlay.style.display !== "none") ||
      (!!this.personPopupOverlay && this.personPopupOverlay.style.display !== "none");
    const overlays = [
      this.importModalRoot,
      this.personImportModalRoot,
      this.personImportNewFirmOverlay,
      this.personImportDetailOverlay,
      this.importDetailOverlay,
    ];
    const importUiVisible = overlays.some((overlay) => {
      if (!overlay) return false;
      return overlay.style.display !== "none";
    });
    if (importBusy || importUiVisible || editorVisible) return;
    if (!this.savingFirm && !this.savingPerson) return;
    this.savingFirm = false;
    this.savingPerson = false;
    this._setMsg("");
    this._applyFirmFormState();
    this._applyPersonFormState();
  }

  _hasFirmSelected() {
    return !!this.selectedFirmId;
  }

  _selectFirm(firmId) {
    this.selectedFirmId = firmId || null;
    this.selectedFirm = this.firms.find((f) => this._sameId(f?.id, this.selectedFirmId)) || null;
    this._renderFirmDetails();
  }

  _renderFirmDetails() {
    if (!this.detailBodyEl) return;
    this.detailBodyEl.innerHTML = "";
    if (!this.selectedFirm) {
      const placeholder = document.createElement("div");
      placeholder.textContent = "Klicke auf eine Firma, um die Übersicht zu sehen.";
      this.detailBodyEl.appendChild(placeholder);
      return;
    }

    const mkRow = (label, value) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "6px";
      row.style.alignItems = "center";
      const lbl = document.createElement("span");
      lbl.textContent = `${label}:`;
      lbl.style.fontWeight = "600";
      const val = document.createElement("span");
      val.textContent = value || "-";
      row.append(lbl, val);
      return row;
    };

    const firm = this.selectedFirm;
    const address = [
      firm.street,
      [firm.zip, firm.city].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(" · ");

    const roleLabel = this.roleLabels?.[firm.role_code] || "Kategorie";

    this.detailBodyEl.append(
      mkRow("Name", firm.name || "(kein Name)"),
      mkRow("Kurzbez.", firm.short || "-"),
      mkRow("Adresse", address || "-"),
      mkRow("Telefon", firm.phone || "-"),
      mkRow("E-Mail", firm.email || "-"),
      mkRow("Kategorie", roleLabel)
    );

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.alignItems = "center";
    actions.style.gap = "8px";
    actions.style.marginTop = "12px";

    const btnEdit = document.createElement("button");
    btnEdit.textContent = "Bearbeiten";
    btnEdit.onclick = async () => {
      await this._openFirmEditor({ mode: "edit", firmId: firm.id });
    };

    const btnDelete = document.createElement("button");
    btnDelete.textContent = "Papierkorb";
    btnDelete.title = "In Papierkorb";
    btnDelete.style.background = "#c62828";
    btnDelete.style.color = "white";
    btnDelete.style.border = "1px solid rgba(0,0,0,0.25)";
    btnDelete.style.borderRadius = "6px";
    btnDelete.style.padding = "6px 10px";
    btnDelete.onclick = async () => {
      if (!this.selectedFirmId) return;
      await this._deleteFirm(this.selectedFirmId);
    };

    if (!this.selectedFirmId) {
      btnDelete.disabled = true;
      btnDelete.style.opacity = "0.55";
    }

    actions.append(btnEdit, btnDelete);
    this.detailBodyEl.append(actions);
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
    this._hidePersonPopup();
    this._hideFirmPopup();
    this._updateVisibility();
  }

  async _openEditorWindow(payload, onSaved, onDeleted) {
    if (typeof window.bbmDb?.editorOpen !== "function") return false;
    let res = null;
    try {
      res = await window.bbmDb.editorOpen(payload);
    } catch (err) {
      console.error("[FirmsView] editorOpen failed:", err);
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
      console.error("[FirmsView] editor callback failed:", err);
      const msg = String(err?.message || "").trim();
      alert(msg ? `Speichern aus dem Editor fehlgeschlagen:\n${msg}` : "Speichern aus dem Editor fehlgeschlagen.");
    }
    return true;
  }

  async _openFirmEditor({ mode = "edit", firmId = null } = {}) {
    this._clearStaleBusyState();
    this._releaseImportUiLock();
    if (mode === "edit") {
      const targetId = firmId || this.selectedFirmId;
      if (targetId) {
        const firm =
          (this.firms || []).find((f) => this._sameId(f?.id, targetId)) ||
          this.selectedFirm ||
          null;
        const usedEditor = await this._openEditorWindow(
          {
            kind: "firm",
            title: "Firma bearbeiten",
            firm: {
              id: targetId,
              short: firm?.short || "",
              name: firm?.name || "",
              name2: firm?.name2 || "",
              street: firm?.street || "",
              zip: firm?.zip || "",
              city: firm?.city || "",
              phone: firm?.phone || "",
              email: firm?.email || "",
              gewerk: firm?.gewerk || "",
              role_code: firm?.role_code || "",
              notes: firm?.notes || "",
            },
          },
          async (data) => {
            await this._saveFirmFromEditor(targetId, data);
          }
        );
        if (usedEditor) return;
      }
    }
    if (this.savingFirm || this.savingPerson) return;
    if (mode === "create") {
      this._beginCreateFirm();
      this.persons = [];
    } else {
      this.firmMode = "edit";
      const targetId = firmId || this.selectedFirmId;
      if (!targetId) return;
      this._selectFirm(targetId);
      this.personMode = "none";
      this.editPersonId = null;
    }

    this._applyFirmFormState();
    this._renderFirmsOnly();
    this._renderFirmDetails();
    this._showFirmPopup();

    if (mode === "edit") {
      await this._reloadPersons();
    } else {
      this.persons = [];
    }

    this._renderPersonsOnly();
    this._applyPersonFormState();
    this.inpFirmName1?.focus();
  }

  async _openPersonEditor({ mode = "create", personId = null } = {}) {
    this._clearStaleBusyState();
    this._releaseImportUiLock();
    if (this.savingPerson || this.savingFirm) return;
    if (!this._hasFirmSelectedSaved()) return;
    if (mode === "edit" && personId !== null && personId !== undefined) {
      const targetId = String(personId);
      const hasPerson = (this.persons || []).some((p) => String(p?.id) === targetId);
      if (!hasPerson) {
        await this._reloadPersons();
      }
    }
    this.personMode = mode;
    this.editPersonId = mode === "edit" ? this._personIdKey(personId) : null;
    this._applyPersonFormState();
    this._showPersonPopup();
    this.inpFirstName?.focus();
  }

  _updateVisibility() {
    const showFirm = this.firmMode === "create" || this.firmMode === "edit";
    if (showFirm) {
      this._showFirmPopup();
    } else {
      this._hideFirmPopup();
    }

    const showPerson =
      this._hasFirmSelectedSaved() &&
      (this.personMode === "create" || this.personMode === "edit");
    if (showPerson) {
      this._showPersonPopup();
    } else {
      this._hidePersonPopup();
    }
  }

  _ensureFirmPopup() {
    if (this.firmPopupOverlay) return;
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = String(OVERLAY);
    overlay.tabIndex = -1;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this._closeFirmEditor();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this._closeFirmEditor();
    });

    const modal = document.createElement("div");
    modal.style.width = "min(640px, calc(100vw - 32px))";
    modal.style.maxWidth = "640px";
    modal.style.maxHeight = "calc(100vh - 32px)";
    modal.style.background = "#fff";
    modal.style.borderRadius = "12px";
    modal.style.boxShadow = "0 20px 50px rgba(0,0,0,0.3)";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.overflow = "hidden";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "10px 14px";
    header.style.borderBottom = "1px solid #eee";
    header.style.gap = "8px";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.fontSize = "16px";
    title.textContent = "Firma bearbeiten";

    const btnClose = document.createElement("button");
    btnClose.textContent = "Schließen";
    applyPopupButtonStyle(btnClose, { variant: "neutral" });
    btnClose.onclick = () => this._closeFirmEditor();

    const headerActions = document.createElement("div");
    headerActions.style.display = "flex";
    headerActions.style.alignItems = "center";
    headerActions.style.gap = "8px";
    if (this.btnSaveFirm) headerActions.append(this.btnSaveFirm);
    if (this.btnDeleteFirm) headerActions.append(this.btnDeleteFirm);
    headerActions.append(btnClose);

    header.append(title, headerActions);

    const body = document.createElement("div");
    body.style.flex = "1";
    body.style.overflowY = "auto";
    body.style.padding = "0 12px 16px";

    modal.append(header, body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.firmPopupOverlay = overlay;
    this.firmPopupBodyEl = body;
  }

  _showFirmPopup() {
    this._ensureFirmPopup();
    if (!this.firmPopupOverlay) return;
    if (this.firmPopupBodyEl && this.editWrapEl && this.editWrapEl.parentElement !== this.firmPopupBodyEl) {
      this.firmPopupBodyEl.appendChild(this.editWrapEl);
    }
    if (this.editWrapEl) {
      this.editWrapEl.style.display = "flex";
    }
    this.firmPopupOverlay.style.pointerEvents = "auto";
    this.firmPopupOverlay.style.display = "flex";
    try {
      this.firmPopupOverlay.focus();
    } catch (_e) {
      // ignore
    }
  }

  _hideFirmPopup() {
    if (this.firmPopupOverlay) {
      this.firmPopupOverlay.style.display = "none";
      this.firmPopupOverlay.style.pointerEvents = "none";
    }
    if (this.editWrapEl) {
      this.editWrapEl.style.display = "none";
    }
  }

  _ensurePersonPopup() {
    if (this.personPopupOverlay) return;
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = String(OVERLAY_TOP);
    overlay.tabIndex = -1;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this._closePersonEditor();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this._closePersonEditor();
    });

    const modal = document.createElement("div");
    modal.style.width = "min(520px, calc(100vw - 32px))";
    modal.style.background = "#fff";
    modal.style.borderRadius = "10px";
    modal.style.boxShadow = "0 12px 30px rgba(0,0,0,0.25)";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.overflow = "hidden";
    modal.style.maxHeight = "calc(100vh - 32px)";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "12px 16px";
    header.style.borderBottom = "1px solid #eee";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.textContent = "Mitarbeiter bearbeiten";

    const btnClose = document.createElement("button");
    btnClose.textContent = "Schließen";
    applyPopupButtonStyle(btnClose, { variant: "neutral" });
    btnClose.onclick = () => this._closePersonEditor();

    const headerActions = document.createElement("div");
    headerActions.style.display = "flex";
    headerActions.style.gap = "8px";
    headerActions.style.alignItems = "center";
    if (this.btnSavePerson) headerActions.append(this.btnSavePerson);
    if (this.btnDeletePerson) headerActions.append(this.btnDeletePerson);
    headerActions.append(btnClose);

    header.append(title, headerActions);

    const body = document.createElement("div");
    body.style.flex = "1";
    body.style.overflowY = "auto";
    body.style.padding = "0 16px 16px";

    modal.append(header, body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.personPopupOverlay = overlay;
    this.personPopupBodyEl = body;
    this.personPopupTitleEl = title;
  }

  _showPersonPopup() {
    this._ensurePersonPopup();
    if (!this.personPopupOverlay) return;
    if (this.personPopupBodyEl && this.personFormEl && this.personFormEl.parentElement !== this.personPopupBodyEl) {
      this.personPopupBodyEl.appendChild(this.personFormEl);
    }
    if (this.personFormEl) {
      this.personFormEl.style.display = "block";
    }
    if (this.personPopupTitleEl) {
      this.personPopupTitleEl.textContent =
        this.personMode === "create" ? "Neuer Mitarbeiter" : "Mitarbeiter bearbeiten";
    }
    this.personPopupOverlay.style.pointerEvents = "auto";
    this.personPopupOverlay.style.display = "flex";
    try {
      this.personPopupOverlay.focus();
    } catch (_e) {
      // ignore
    }
  }

  _hidePersonPopup() {
    if (this.personPopupOverlay) {
      this.personPopupOverlay.style.display = "none";
      this.personPopupOverlay.style.pointerEvents = "none";
      this.personPopupOverlay.remove();
      this.personPopupOverlay = null;
      this.personPopupBodyEl = null;
      this.personPopupTitleEl = null;
    }
  }

  _getImportContextPayload() {
    const ctx = String(this.importContext || "stamm").trim().toLowerCase();
    const isProject = ctx === "projekt" || ctx === "project";
    const personImportFirmId = this._getProjectFirmIdForPersonImport();
    if (!isProject) {
      return personImportFirmId ? { context: "stamm", personImportFirmId } : { context: "stamm" };
    }

    let projectId = "";
    if (typeof this.getImportProjectId === "function") {
      try {
        projectId = String(this.getImportProjectId() || "").trim();
      } catch (_e) {
        projectId = "";
      }
    }
    if (!projectId) {
      projectId = String(this.router?.currentProjectId || "").trim();
    }

    return personImportFirmId
      ? { context: "projekt", projectId, personImportFirmId }
      : { context: "projekt", projectId };
  }

  _getProjectFirmIdForPersonImport() {
    if (typeof this.getImportProjectFirmId !== "function") return "";
    try {
      return String(this.getImportProjectFirmId() || "").trim();
    } catch (_e) {
      return "";
    }
  }

  _resolveProjectFirmFallback() {
    const firmId = this._getProjectFirmIdForPersonImport();
    if (!firmId) return null;
    return (this.personImportFirms || []).find((f) => String(f.id || "") === firmId) || null;
  }

  async _refreshAfterImport() {
    if (typeof this.onImportRefresh === "function") {
      await this.onImportRefresh();
      return;
    }
    if (typeof this.reloadFirms === "function") {
      await this.reloadFirms();
    }
  }

  async _createImportFirm(data) {
    const api = window.bbmDb || {};
    const payload = this._getImportContextPayload();

    if (payload.context === "projekt") {
      if (!payload.projectId) {
        return { ok: false, error: "Bitte zuerst ein Projekt auswählen." };
      }
      if (typeof api.projectFirmsCreate !== "function") {
        return { ok: false, error: "Projekt-Firmenanlage ist nicht verfügbar (Preload/IPC fehlt)." };
      }
      const res = await api.projectFirmsCreate({
        projectId: payload.projectId,
        ...data,
      });
      if (!res?.ok) return { ok: false, error: res?.error || "Firma konnte nicht angelegt werden." };
      return { ok: true, firm: res.firm || null };
    }

    if (typeof api.firmsCreateGlobal !== "function") {
      return { ok: false, error: "Firmenanlage ist nicht verfügbar (Preload/IPC fehlt)." };
    }
    const res = await api.firmsCreateGlobal(data);
    if (!res?.ok) return { ok: false, error: res?.error || "Firma konnte nicht angelegt werden." };
    return { ok: true, firm: res.firm || null };
  }

  _releaseImportUiLock() {
    this.importLoading = false;
    this.personImportLoading = false;
    this.personImportNewFirmSaving = false;
    this.savingFirm = false;
    this.savingPerson = false;

    const overlays = [
      this.importModalRoot,
      this.personImportModalRoot,
      this.personImportNewFirmOverlay,
      this.personImportDetailOverlay,
    ];
    for (const overlay of overlays) {
      if (!overlay) continue;
      overlay.style.display = "none";
      overlay.style.pointerEvents = "none";
    }

    this._applyFirmFormState();
    this._applyPersonFormState();
    this._updateVisibility();
    this._setMsg("");
  }

  _closePersonEditor() {
    this.personMode = "none";
    this.editPersonId = null;
    this._hidePersonPopup();
    this._updateVisibility();
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

  // ------------------------------------------------------------
  // Data loading
  // ------------------------------------------------------------
  async reloadFirms() {
    this._setMsg("");

    const res = await window.bbmDb.firmsListGlobal();
    if (!res?.ok) {
      this._setMsg(res?.error || "Fehler beim Laden der Firmen");

      this.firms = [];
      this._closeFirmEditor();
      this._selectFirm(null);
      this.persons = [];

      this._renderFirmsOnly();
      this._renderPersonsOnly();
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility();
      return;
    }

    this.firms = res.list || [];

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
  }

  async _reloadPersons() {
    this.persons = [];
    this.personMode = "none";
    this.editPersonId = null;

    if (!this.selectedFirmId) {
      this._renderPersonsOnly();
      return;
    }

    const res = await window.bbmDb.personsListByFirm(this.selectedFirmId);
    if (!res?.ok) {
      this._setMsg(res?.error || "Fehler beim Laden der Mitarbeiter");
      this.persons = [];
      this._renderPersonsOnly();
      return;
    }

    this.persons = res.list || [];
    this._renderPersonsOnly();
  }

  // ------------------------------------------------------------
  // Render lists
  // ------------------------------------------------------------
  _renderFirmsOnly() {
    const tb = this.tableBodyEl;
    if (!tb) return;

    tb.innerHTML = "";

    for (const f of this.firms) {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";

      const isSel = this._sameId(f?.id, this.selectedFirmId);
      tr.style.background = isSel ? "#dff0ff" : "transparent";

      const tdShort = document.createElement("td");
      tdShort.style.padding = "6px";
      tdShort.style.borderBottom = "1px solid #eee";
      tdShort.textContent = f.short || "";

      const tdName = document.createElement("td");
      tdName.style.padding = "6px";
      tdName.style.borderBottom = "1px solid #eee";
      tdName.textContent = f.name || "";

      tr.append(tdName, tdShort);

      const handleRowClick = async (event) => {
        if (event?.detail > 1) return;
        this._clearStaleBusyState();
        if (this.savingFirm || this.savingPerson) return;

        this.firmMode = "none";
        this.personMode = "none";
        this.editPersonId = null;
        this._hideFirmPopup();
        this._hidePersonPopup();
        this._selectFirm(f.id);
        await this._reloadPersons();
        this._renderFirmsOnly();
      };

      tr.addEventListener("click", handleRowClick);
      tr.addEventListener("dblclick", async (event) => {
        event.stopPropagation();
        this._selectFirm(f.id);
        await this._openFirmEditor({ mode: "edit", firmId: f.id });
      });

      tb.appendChild(tr);
    }
  }

  _renderPersonsOnly() {
    const tb = this.personTableBodyEl;
    if (!tb) return;

    tb.innerHTML = "";

    if (this.btnNewPerson) {
      const canNewPerson = !this.savingFirm && !this.savingPerson && this._hasFirmSelectedSaved();
      this.btnNewPerson.disabled = !canNewPerson;
      this.btnNewPerson.style.opacity = canNewPerson ? "1" : "0.55";
    }

    if (!this._hasFirmSelected()) {
      const empty = document.createElement("tr");
      empty.style.background = "transparent";
      empty.innerHTML = `<td colspan="4" style="padding:12px;font-size:13px;opacity:0.7;">Keine Firma ausgewählt</td>`;
      tb.appendChild(empty);
      return;
    }

    for (const p of this.persons) {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";

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

      tr.append(tdName, tdRole, tdEmail, tdPhone);

      const isPersonSel =
        this.personMode === "edit" &&
        this._personIdKey(this.editPersonId) === this._personIdKey(p.id);
      tr.style.background = isPersonSel ? "#f0f7ff" : "transparent";

      tr.onclick = async (event) => {
        if (event?.detail > 1) return;
        await this._openPersonEditor({ mode: "edit", personId: p.id });
      };

      tb.appendChild(tr);
    }

    if (!this.persons.length) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `<td colspan="4" style="padding:12px;font-size:13px;opacity:0.7;">Keine Mitarbeiter vorhanden</td>`;
      tb.appendChild(emptyRow);
    }
  }

  // ------------------------------------------------------------
  // Apply form state
  // ------------------------------------------------------------
  _applyFirmFormState() {
    const isSaving = !!this.savingFirm || !!this.savingPerson;
    const hasEditor = this.firmMode === "create" || this.firmMode === "edit";
    const firm = this.selectedFirm;

    if (!hasEditor) return;

    const setInp = (el, val) => {
      if (!el) return;
      el.disabled = isSaving;
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
      this.selFirmRole.disabled = isSaving;
    }

    if (this.taFirmNotes) {
      this.taFirmNotes.disabled = isSaving;
      this.taFirmNotes.value = firm ? firm.notes || "" : "";
    }

    if (this.btnSaveFirm) this.btnSaveFirm.disabled = isSaving;

    if (this.btnDeleteFirm) {
      const canDelete = !isSaving && this.firmMode === "edit" && !!this.selectedFirmId;
      this.btnDeleteFirm.disabled = !canDelete;
      this.btnDeleteFirm.style.opacity = canDelete ? "1" : "0.55";
    }


    if (this.btnNewPerson) {
      const canNewPerson = !isSaving && this._hasFirmSelectedSaved();
      this.btnNewPerson.disabled = !canNewPerson;
      this.btnNewPerson.style.opacity = canNewPerson ? "1" : "0.55";
    }
  }

  _applyPersonFormState() {
    const hasFirm = this._hasFirmSelectedSaved();
    const isSaving = !!this.savingPerson || !!this.savingFirm;

    const currentEditId =
      this.editPersonId === null || this.editPersonId === undefined ? null : String(this.editPersonId);
    const editing =
      this.personMode === "edit" && currentEditId
        ? this.persons.find((x) => String(x?.id) === currentEditId) || null
        : null;

    const show = hasFirm && (this.personMode === "create" || this.personMode === "edit");
    if (this.personFormEl) {
      this.personFormEl.style.display = show ? "block" : "none";
    }
    if (show) {
      this._showPersonPopup();
    } else {
      this._hidePersonPopup();
    }

    const setVal = (el, v) => {
      if (!el) return;
      el.value = v || "";
      el.disabled = isSaving || !show;
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
      this.taPersonNotes.disabled = isSaving || !show;
    }

    if (this.btnSavePerson) this.btnSavePerson.disabled = isSaving || !show;

    if (this.btnDeletePerson) {
      const canDelete = !isSaving && show && this.personMode === "edit" && !!this.editPersonId;
      this.btnDeletePerson.disabled = !canDelete;
      this.btnDeletePerson.style.opacity = canDelete ? "1" : "0.55";
      this.btnDeletePerson.style.display = show ? "inline-block" : "none";
      this.btnDeletePerson.title = canDelete ? "In Papierkorb" : "Nur beim Bearbeiten möglich";
    }
  }

  // ------------------------------------------------------------
  // CSV Import (Staging)
  // ------------------------------------------------------------
  _importStatusText(item) {
    if (!item) return "Übersprungen";
    if (Number(item.take || 0) !== 1) return "Übersprungen";
    const base = String(item.status_base || "").toLowerCase();
    if (base.includes("exist") || base.includes("vorhanden")) {
      return "Vorhanden (wird ergänzt)";
    }
    return "Neu (wird angelegt)";
  }

  _getSelectedImportItem() {
    if (!this.importSelectedRowId) return null;
    return (this.importItems || []).find((x) => x.row_id === this.importSelectedRowId) || null;
  }

  _ensureImportModal() {
    if (this.importModalRoot) return;

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(0,0,0,0.25)";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = String(OVERLAY);
    overlay.tabIndex = -1;
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) this._closeImportModal();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this._closeImportModal();
    });

    const modal = document.createElement("div");
    modal.style.width = "min(1220px, calc(100vw - 28px))";
    modal.style.height = "min(86vh, 880px)";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.background = "#fff";
    modal.style.border = "1px solid #ddd";
    modal.style.borderRadius = "12px";
    modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
    modal.style.overflow = "hidden";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";
    head.style.padding = "12px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.textContent = "Firmen importieren";
    title.style.fontWeight = "800";
    title.style.fontSize = "16px";

    const fileNameEl = document.createElement("div");
    fileNameEl.style.marginLeft = "auto";
    fileNameEl.style.fontSize = "12px";
    fileNameEl.style.opacity = "0.8";
    fileNameEl.textContent = "";

    head.append(title, fileNameEl);

    const body = document.createElement("div");
    body.style.display = "grid";
    body.style.gridTemplateColumns = "1fr";
    body.style.gap = "10px";
    body.style.padding = "10px";
    body.style.overflow = "hidden";
    body.style.flex = "1 1 auto";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.flexDirection = "column";
    left.style.gap = "10px";
    left.style.minWidth = "0";

    const drop = document.createElement("div");
    drop.style.border = "1px dashed #9eb6d8";
    drop.style.borderRadius = "10px";
    drop.style.padding = "12px";
    drop.style.background = "#f7fbff";
    drop.style.display = "flex";
    drop.style.alignItems = "center";
    drop.style.justifyContent = "space-between";
    drop.style.gap = "12px";

    const dropText = document.createElement("div");
    dropText.textContent = "CSV hier ablegen";
    dropText.style.fontWeight = "600";

    const dropBtn = document.createElement("button");
    dropBtn.textContent = "Datei auswählen…";
    dropBtn.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.selectCsvFile !== "function") {
        alert("Dateiauswahl ist nicht verfügbar (Preload/IPC fehlt).");
        return;
      }
      const res = await api.selectCsvFile({ title: "Outlook CSV auswählen" });
      if (!res?.ok) {
        alert(res?.error || "Dateiauswahl fehlgeschlagen");
        return;
      }
      if (res.canceled || !(res.filePaths || [])[0]) return;
      await this._loadImportCsvFile(res.filePaths[0]);
    };

    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.style.background = "#eaf3ff";
    });
    drop.addEventListener("dragleave", () => {
      drop.style.background = "#f7fbff";
    });
    drop.addEventListener("drop", async (e) => {
      e.preventDefault();
      drop.style.background = "#f7fbff";
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      const p = String(files[0].path || "").trim();
      if (!p) {
        alert("Datei-Pfad konnte nicht gelesen werden.");
        return;
      }
      await this._loadImportCsvFile(p);
    });

    drop.append(dropText, dropBtn);

    const tableWrap = document.createElement("div");
    tableWrap.style.border = "1px solid #ddd";
    tableWrap.style.borderRadius = "10px";
    tableWrap.style.background = "#fff";
    tableWrap.style.display = "flex";
    tableWrap.style.flexDirection = "column";
    tableWrap.style.flex = "1 1 0";
    tableWrap.style.maxHeight = "55vh";
    tableWrap.style.overflowY = "auto";
    tableWrap.style.minHeight = "220px";

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.tableLayout = "fixed";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th style="padding:6px;border-bottom:1px solid #ddd;width:34px;">✓</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;">Firmenname</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;">Straße/HsNr</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;width:78px;">PLZ</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;">Ort</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;">Telefon</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;">E-Mail</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;width:110px;">Abgleich</th>
      </tr>
    `;

    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    tableWrap.appendChild(table);

    const hint = document.createElement("div");
    hint.textContent = "mit doppelklich Firma wählen";
    hint.style.color = "blue";
    hint.style.fontWeight = "600";
    hint.style.fontSize = "18px";

    left.append(drop, hint, tableWrap);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.flexDirection = "column";
    right.style.gap = "10px";
    right.style.minWidth = "0";
    right.style.display = "none";

    const detail = document.createElement("div");
    detail.style.border = "1px solid #ddd";
    detail.style.borderRadius = "10px";
    detail.style.padding = "10px";
    detail.style.background = "#fff";
    detail.style.overflow = "auto";

    const detailTitle = document.createElement("div");
    detailTitle.textContent = "Details";
    detailTitle.style.fontWeight = "700";
    detailTitle.style.marginBottom = "8px";
    detail.appendChild(detailTitle);

    const mkRow = (label, input) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "112px 1fr";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.marginBottom = "6px";
      const l = document.createElement("div");
      l.textContent = label;
      row.append(l, input);
      return row;
    };

    const makeInput = () => {
      const i = document.createElement("input");
      i.type = "text";
      i.style.width = "100%";
      return i;
    };

    const dTake = document.createElement("input");
    dTake.type = "checkbox";
    const dShort = makeInput();
    const dName1 = makeInput();
    const dName2 = makeInput();
    const dStreet = makeInput();
    const dZip = makeInput();
    const dCity = makeInput();
    const dPhone = makeInput();
    const dEmail = makeInput();
    const dGewerk = makeInput();
    const dNotes = document.createElement("textarea");
    dNotes.rows = 4;
    dNotes.style.width = "100%";
    dNotes.style.resize = "vertical";

    const rawLabel = document.createElement("div");
    rawLabel.textContent = "Quelle (CSV) – Rohdaten";
    rawLabel.style.fontWeight = "700";
    rawLabel.style.marginTop = "12px";

    const rawHint = document.createElement("div");
    rawHint.textContent =
      "Hilft bei fehlerhaften/unklaren Adress- oder Kontaktfeldern. Nur Kontrolle, wird nicht gespeichert.";
    rawHint.style.fontSize = "12px";
    rawHint.style.opacity = "0.8";
    rawHint.style.marginTop = "4px";

    const rawTa = document.createElement("textarea");
    rawTa.readOnly = true;
    rawTa.rows = 9;
    rawTa.style.width = "100%";
    rawTa.style.resize = "vertical";
    rawTa.style.background = "#fafafa";

    const rawDetails = document.createElement("details");
    rawDetails.style.marginTop = "4px";

    const rawSummary = document.createElement("summary");
    rawSummary.textContent = "Rohdaten anzeigen";
    rawSummary.style.cursor = "pointer";
    rawSummary.style.margin = "0";
    rawSummary.style.fontWeight = "600";

    rawDetails.append(rawSummary, rawTa);

    detail.append(
      mkRow("Übernehmen", dTake),
      mkRow("Kurzbez.", dShort),
      mkRow("Name 1", dName1),
      mkRow("Name 2", dName2),
      mkRow("Straße/HsNr", dStreet),
      mkRow("PLZ", dZip),
      mkRow("Ort", dCity),
      mkRow("Telefon", dPhone),
      mkRow("E-Mail", dEmail),
      mkRow("Funktion/Gewerk", dGewerk),
      mkRow("Notizen", dNotes),
      rawLabel,
      rawHint,
      rawDetails
    );

    const statusLegend = document.createElement("div");
    statusLegend.style.fontSize = "12px";
    statusLegend.style.opacity = "0.82";
    statusLegend.textContent =
      "Abgleich: 'Neu (wird angelegt)' = die Firma wird neu angelegt; 'Vorhanden (wird ergänzt)' = bestehender Eintrag wird ergänzt.";

    const sum = document.createElement("div");
    sum.style.fontSize = "12px";
    sum.style.opacity = "0.82";

    right.append(detail, statusLegend, sum);

    body.append(left, right);

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.alignItems = "center";
    footer.style.gap = "8px";
    footer.style.padding = "12px";
    footer.style.borderTop = "1px solid #e2e8f0";

    const spacer = document.createElement("div");
    spacer.style.marginLeft = "auto";

    const btnImport = document.createElement("button");
    btnImport.textContent = "Importieren";
    btnImport.onclick = async () => {
      if (this.savingFirm || this.savingPerson) return;
      const api = window.bbmDb || {};
      if (typeof api.firmsImportApplyStaging !== "function") {
        alert("Import ist nicht verfügbar (Preload/IPC fehlt).");
        return;
      }
      this.savingFirm = true;
      this.savingPerson = true;
      this._applyFirmFormState();
      this._applyPersonFormState();
      try {
        const ctxPayload = this._getImportContextPayload();
        if (ctxPayload.context === "projekt" && !ctxPayload.projectId) {
          alert("Bitte zuerst ein Projekt auswählen.");
          return;
        }
        const res = await api.firmsImportApplyStaging({
          items: this.importItems || [],
          filePath: this.importSourceFilePath,
          includePersonsFromCsv: 1,
          ...ctxPayload,
        });
        if (!res?.ok) {
          alert(res?.error || "Import fehlgeschlagen");
          return;
        }
        const s = res.summary || {};
        const p = res.personsSummary || null;
        let msg =
          `Import Firmen abgeschlossen:\n` +
          `${s.created || 0} neu\n` +
          `${s.merged || 0} gemerged\n` +
          `${s.skipped || 0} übersprungen`;
        if (p) {
          msg +=
            `\n\nImport Kontakte (gleiche CSV):\n` +
            `${p.created || 0} neu\n` +
            `${p.merged || 0} überschrieben\n` +
            `${p.skipped || 0} übersprungen\n` +
            `${p.missingFirm || 0} ohne gültige Firma\n` +
            `${p.duplicate || 0} Dubletten erkannt`;
          if (Number(p.autoSkippedConflicts || 0) > 0) {
            msg += `\n${p.autoSkippedConflicts} Dubletten automatisch nicht überschrieben`;
          }
        }
        alert(msg);
        this._closeImportModal();
        await this._refreshAfterImport();
      } finally {
        this.savingFirm = false;
        this.savingPerson = false;
        this._applyFirmFormState();
        this._applyPersonFormState();
      }
    };

    const btnClose = document.createElement("button");
    btnClose.textContent = "Schließen";
    btnClose.onclick = () => this._closeImportModal();

    footer.append(spacer, btnImport, btnClose);
    modal.append(head, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const bindDetailInput = (el, key, { rerenderRows = false } = {}) => {
      el.addEventListener("input", () => {
        const item = this._getSelectedImportItem();
        if (!item) return;
        item[key] = String(el.value || "");
        if (rerenderRows) this._renderImportRows();
      });
    };
    dTake.addEventListener("change", () => {
      const item = this._getSelectedImportItem();
      if (!item) return;
      item.take = dTake.checked ? 1 : 0;
      this._renderImportRows();
      this._renderImportDetail();
    });
    bindDetailInput(dShort, "short");
    bindDetailInput(dName1, "name1", { rerenderRows: true });
    bindDetailInput(dName2, "name2");
    bindDetailInput(dStreet, "street");
    bindDetailInput(dZip, "zip");
    bindDetailInput(dCity, "city");
    bindDetailInput(dPhone, "phone");
    bindDetailInput(dEmail, "email");
    bindDetailInput(dGewerk, "gewerk");
    bindDetailInput(dNotes, "notes");

    this.importModalRoot = overlay;
    this.importDropEl = drop;
    this.importFileNameEl = fileNameEl;
    this.importListBodyEl = tbody;
    this.importDetailWrapEl = {
      take: dTake,
      short: dShort,
      name1: dName1,
      name2: dName2,
      street: dStreet,
      zip: dZip,
      city: dCity,
      phone: dPhone,
      email: dEmail,
      gewerk: dGewerk,
      notes: dNotes,
    };
    this.importRawEl = rawTa;
    this.importSummaryEl = sum;
  }

  _openImportModal() {
    this._closeImportDetailPopup();
    this._ensureImportModal();
    this.importItems = [];
    this.importSourceFilePath = "";
    this.importSelectedRowId = null;
    if (this.importFileNameEl) this.importFileNameEl.textContent = "";
    this._renderImportRows();
    this._renderImportDetail();
    if (this.importModalRoot) {
      this.importModalRoot.style.pointerEvents = "auto";
      this.importModalRoot.style.display = "flex";
      try {
        this.importModalRoot.focus();
      } catch (_e) {
        // ignore
      }
    }
  }

  _closeImportModal() {
    this._closeImportDetailPopup();
    if (this.importModalRoot) {
      try {
        this.importModalRoot.remove();
      } catch (_) {}
    }
    this.importModalRoot = null;
    this.importDropEl = null;
    this.importFileNameEl = null;
    this.importListBodyEl = null;
    this.importDetailWrapEl = null;
    this.importRawEl = null;
    this.importSummaryEl = null;
    this.importSelectedRowId = null;
    this.importItems = [];
    this.importSourceFilePath = "";
    this._releaseImportUiLock();
  }

  async _loadImportCsvFile(filePath) {
    const api = window.bbmDb || {};
    if (typeof api.firmsImportParseCsv !== "function") {
      alert("CSV-Import ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }

    this.importLoading = true;
    try {
      const ctxPayload = this._getImportContextPayload();
      if (ctxPayload.context === "projekt" && !ctxPayload.projectId) {
        alert("Bitte zuerst ein Projekt auswählen.");
        return;
      }
      const res = await api.firmsImportParseCsv({ filePath, ...ctxPayload });
      if (!res?.ok) {
        alert(res?.error || "CSV konnte nicht gelesen werden.");
        return;
      }
      this.importItems = Array.isArray(res.items) ? res.items : [];
      this.importSourceFilePath = String(res.filePath || filePath || "");
      for (const it of this.importItems) {
        it.take = 0;
      }
      this.importSelectedRowId = this.importItems[0]?.row_id || null;
      if (this.importFileNameEl) this.importFileNameEl.textContent = filePath;
      if (this.importSummaryEl) {
        this.importSummaryEl.textContent = `${res.rowsCount || 0} Kontakte gelesen, ${this.importItems.length} Firmen erkannt, ${res.ignoredWithoutCompany || 0} ohne Firma ignoriert.`;
      }
      this._renderImportRows();
      this._renderImportDetail();
    } finally {
      this.importLoading = false;
    }
  }

  _renderImportRows() {
    const tbody = this.importListBodyEl;
    if (!tbody) return;
    tbody.innerHTML = "";

    const mkInput = (item, key, width) => {
      const i = document.createElement("input");
      i.type = "text";
      i.value = String(item?.[key] || "");
      i.style.width = width || "100%";
      i.style.boxSizing = "border-box";
      i.style.border = "none";
      i.style.background = "transparent";
      i.style.outline = "none";
      i.addEventListener("input", () => {
        item[key] = String(i.value || "");
        if (this.importSelectedRowId === item.row_id) this._renderImportDetail();
      });
      i.addEventListener("mousedown", (e) => e.stopPropagation());
      return i;
    };

    for (const item of this.importItems || []) {
      const tr = document.createElement("tr");
      const sel = item.row_id === this.importSelectedRowId;
      tr.style.background = sel ? "#e8f1ff" : "";
      tr.style.cursor = "pointer";
      tr.onclick = () => {
        this.importSelectedRowId = item.row_id;
        this._renderImportRows();
        this._renderImportDetail();
      };
      tr.ondblclick = () => {
        if (this.importSelectedRowId !== item.row_id) {
          this.importSelectedRowId = item.row_id;
          this._renderImportRows();
          this._renderImportDetail();
        }
        this._openImportDetailPopup(item);
      };

      const tdTake = document.createElement("td");
      tdTake.style.padding = "4px";
      tdTake.style.borderBottom = "1px solid #eee";
      tdTake.style.textAlign = "center";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = Number(item.take || 0) === 1;
      chk.addEventListener("change", () => {
        item.take = chk.checked ? 1 : 0;
        this._renderImportRows();
        this._renderImportDetail();
      });
      chk.addEventListener("mousedown", (e) => e.stopPropagation());
      chk.addEventListener("click", (e) => e.stopPropagation());
      chk.addEventListener("dblclick", (e) => e.stopPropagation());
      tdTake.appendChild(chk);

      const mkCell = (el) => {
        const td = document.createElement("td");
        td.style.padding = "4px";
        td.style.borderBottom = "1px solid #eee";
        td.appendChild(el);
        return td;
      };

      const status = document.createElement("div");
      status.textContent = this._importStatusText(item);
      status.style.fontSize = "12px";
      status.style.opacity = "0.9";

      tr.append(
        tdTake,
        mkCell(mkInput(item, "name1")),
        mkCell(mkInput(item, "street")),
        mkCell(mkInput(item, "zip")),
        mkCell(mkInput(item, "city")),
        mkCell(mkInput(item, "phone")),
        mkCell(mkInput(item, "email")),
        mkCell(status)
      );
      tbody.appendChild(tr);
    }
  }

  _renderImportDetail() {
    const detail = this.importDetailWrapEl;
    if (!detail) return;
    const item = this._getSelectedImportItem();
    const setVal = (el, val, dis = false) => {
      if (!el) return;
      el.value = val || "";
      el.disabled = !!dis;
    };

    if (!item) {
      if (detail.take) {
        detail.take.checked = false;
        detail.take.disabled = true;
      }
      setVal(detail.short, "", true);
      setVal(detail.name1, "", true);
      setVal(detail.name2, "", true);
      setVal(detail.street, "", true);
      setVal(detail.zip, "", true);
      setVal(detail.city, "", true);
      setVal(detail.phone, "", true);
      setVal(detail.email, "", true);
      setVal(detail.gewerk, "", true);
      setVal(detail.notes, "", true);
      if (this.importRawEl) this.importRawEl.value = "";
      return;
    }

    if (detail.take) {
      detail.take.checked = Number(item.take || 0) === 1;
      detail.take.disabled = false;
    }
    setVal(detail.short, item.short || "");
    setVal(detail.name1, item.name1 || "");
    setVal(detail.name2, item.name2 || "");
    setVal(detail.street, item.street || "");
    setVal(detail.zip, item.zip || "");
    setVal(detail.city, item.city || "");
    setVal(detail.phone, item.phone || "");
    setVal(detail.email, item.email || "");
    setVal(detail.gewerk, item.gewerk || "");
    setVal(detail.notes, item.notes || "");
    if (this.importRawEl) this.importRawEl.value = String(item.address_raw || "");
  }

  _openImportDetailPopup(item) {
    if (!item) return;
    this._closeImportDetailPopup();

    const draft = {
      take: Number(item.take || 0) === 1 ? 1 : 0,
      short: String(item.short || ""),
      name1: String(item.name1 || ""),
      name2: String(item.name2 || ""),
      street: String(item.street || ""),
      zip: String(item.zip || ""),
      city: String(item.city || ""),
      phone: String(item.phone || ""),
      email: String(item.email || ""),
      gewerk: String(item.gewerk || ""),
      notes: String(item.notes || ""),
      raw_data: String(item.address_raw || item.raw_data || ""),
    };

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.32)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = String(OVERLAY_TOP);
    overlay.tabIndex = -1;
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) this._closeImportDetailPopup();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this._closeImportDetailPopup();
    });

    const modal = document.createElement("div");
    modal.style.width = "min(900px, calc(100vw - 32px))";
    modal.style.maxHeight = "min(80vh, calc(100vh - 32px))";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.overflow = "hidden";
    modal.style.background = "#fff";
    modal.style.border = "1px solid #ddd";
    modal.style.borderRadius = "12px";
    modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
    modal.style.padding = "0";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.justifyContent = "space-between";
    head.style.gap = "10px";
    head.style.padding = "12px 14px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.textContent = "Firma bearbeiten";
    title.style.fontWeight = "700";
    title.style.fontSize = "16px";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "X";
    applyPopupButtonStyle(btnClose, { variant: "neutral" });
    btnClose.onclick = () => this._closeImportDetailPopup();
    head.append(title, btnClose);

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.minHeight = "0";
    body.style.padding = "12px 14px";
    body.style.display = "grid";
    body.style.gridTemplateColumns = "1fr 1fr";
    body.style.gap = "12px";
    body.style.overflow = "hidden";

    const leftCard = document.createElement("div");
    leftCard.style.display = "flex";
    leftCard.style.flexDirection = "column";
    leftCard.style.gap = "6px";
    leftCard.style.minHeight = "0";
    leftCard.style.overflowY = "auto";

    const mkRow = (label, input) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "120px 1fr";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.marginBottom = "4px";
      const lbl = document.createElement("div");
      lbl.textContent = label;
      row.append(lbl, input);
      return row;
    };

    const mkInput = (value = "") => {
      const input = document.createElement("input");
      input.type = "text";
      input.style.width = "100%";
      input.value = value;
      return input;
    };

    const inpShort = mkInput(draft.short);
    inpShort.placeholder = "verantw. im Projekt";
    const inpName1 = mkInput(draft.name1);
    const inpName2 = mkInput(draft.name2);
    const inpStreet = mkInput(draft.street);
    const inpZip = mkInput(draft.zip);
    const inpCity = mkInput(draft.city);
    const inpPhone = mkInput(draft.phone);
    const inpEmail = mkInput(draft.email);
    const inpGewerk = mkInput(draft.gewerk);
    const taNotes = document.createElement("textarea");
    taNotes.rows = 3;
    taNotes.style.width = "100%";
    taNotes.style.resize = "vertical";
    taNotes.value = draft.notes;

    const bindInput = (element, key) => {
      element.addEventListener("input", () => {
        draft[key] = String(element.value || "");
      });
    };
    bindInput(inpShort, "short");
    bindInput(inpName1, "name1");
    bindInput(inpName2, "name2");
    bindInput(inpStreet, "street");
    bindInput(inpZip, "zip");
    bindInput(inpCity, "city");
    bindInput(inpPhone, "phone");
    bindInput(inpEmail, "email");
    bindInput(inpGewerk, "gewerk");
    bindInput(taNotes, "notes");

    const statusMeta = document.createElement("div");
    statusMeta.textContent = `Abgleich: ${this._importStatusText(item)}`;
    statusMeta.style.fontSize = "12px";
    statusMeta.style.opacity = "0.8";
    statusMeta.style.marginTop = "4px";

    leftCard.append(
      mkRow("Kurzbez.", inpShort),
      mkRow("Name 1", inpName1),
      mkRow("Name 2", inpName2),
      mkRow("Straße/HsNr", inpStreet),
      mkRow("PLZ", inpZip),
      mkRow("Ort", inpCity),
      mkRow("Telefon", inpPhone),
      mkRow("E-Mail", inpEmail),
      mkRow("Funktion/Gewerk", inpGewerk),
      mkRow("Notizen", taNotes),
      statusMeta
    );

    const rightCard = document.createElement("div");
    rightCard.style.display = "flex";
    rightCard.style.flexDirection = "column";
    rightCard.style.gap = "6px";
    rightCard.style.minHeight = "0";
    rightCard.style.overflow = "auto";

    const rawLabel = document.createElement("div");
    rawLabel.textContent = "Quelle (CSV) – Rohdaten";
    rawLabel.style.fontWeight = "600";
    rawLabel.style.marginBottom = "4px";

    const rawTa = document.createElement("textarea");
    rawTa.readOnly = true;
    rawTa.value = draft.raw_data;
    rawTa.style.width = "100%";
    rawTa.style.resize = "vertical";
    rawTa.style.flex = "1 1 auto";
    rawTa.style.minHeight = "120px";
    rawTa.style.maxHeight = "360px";
    rawTa.style.background = "#f7f9fc";

    rightCard.append(rawLabel, rawTa);

    body.append(leftCard, rightCard);

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.borderTop = "1px solid #e2e8f0";
    footer.style.padding = "10px 14px";

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel, { variant: "neutral" });
    btnCancel.onclick = () => this._closeImportDetailPopup();

    const btnSave = document.createElement("button");
    btnSave.textContent = "Speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });
    btnSave.onclick = () => {
      this._applyImportDetailDraft(item, draft);
      this._closeImportDetailPopup();
    };

    footer.append(btnCancel, btnSave);
    modal.append(head, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    try {
      overlay.focus();
    } catch (_e) {
      // ignore
    }

    this.importDetailOverlay = overlay;
  }

  _closeImportDetailPopup() {
    if (this.importDetailOverlay) {
      try {
        this.importDetailOverlay.remove();
      } catch (_) {}
    }
    this.importDetailOverlay = null;
  }

  _applyImportDetailDraft(item, draft) {
    if (!item || !draft) return;
    const scrollHost = this.importListBodyEl?.parentElement || null;
    const scrollTop = scrollHost ? scrollHost.scrollTop : 0;

    draft.take = 1;
    item.take = 1;

    const fields = [
      "short",
      "name1",
      "name2",
      "street",
      "zip",
      "city",
      "phone",
      "email",
      "gewerk",
      "notes",
    ];
    for (const key of fields) {
      const nextVal = String(draft[key] || "");
      if (String(item[key] || "") !== nextVal) {
        item[key] = nextVal;
      }
    }

    this.importSelectedRowId = item.row_id;
    this._renderImportRows();
    this._renderImportDetail();
    if (scrollHost) scrollHost.scrollTop = scrollTop;
  }

  _isPersonImportConflictItem(item) {
    if (!item) return false;
    const existingId = String(item.existing_person_id || "").trim();
    if (existingId) return true;
    const conflictState = String(item.conflict_state || "").trim().toLowerCase();
    if (conflictState === "needs_decision") return true;
    const base = String(item.status_base || "").toLowerCase();
    return base.includes("exist") || base.includes("vorhanden");
  }

  _personImportConflictAction(item) {
    const raw = String(item?.conflict_action || "").trim().toLowerCase();
    if (raw === "overwrite") return "overwrite";
    if (raw === "skip") return "skip";
    return "";
  }

  _personImportNeedsDecision(item) {
    if (!item) return false;
    if (Number(item.take || 0) !== 1) return false;
    return this._isPersonImportConflictItem(item) && !this._personImportConflictAction(item);
  }

  _buildPersonImportCompareText(item) {
    if (!this._isPersonImportConflictItem(item)) return "";
    const oldRow = item?.existing_person || {};
    const newRow = item || {};
    const line = (label, oldVal, newVal) =>
      `${label}: Alt="${String(oldVal || "")}" | Neu="${String(newVal || "")}"`;
    return [
      "Dublette erkannt - Vergleich",
      line("Vorname", oldRow.first_name, newRow.first_name),
      line("Nachname", oldRow.last_name, newRow.last_name),
      line("E-Mail", oldRow.email, newRow.email),
      line("Telefon", oldRow.phone, newRow.phone),
      line("Funktion", oldRow.funktion, newRow.funktion),
      line("Rolle", oldRow.rolle, newRow.rolle),
      line("Notizen", oldRow.notes, newRow.notes),
    ].join("\n");
  }

  _personImportStatusText(item) {
    if (!item) return "Übersprungen";
    if (!String(item.firm_id || "").trim()) {
      const baseNoFirm = String(item.status_base || "").toLowerCase();
      if (baseNoFirm.includes("ungekl")) return "Firma ungeklärt";
      return "Firma fehlt";
    }
    if (Number(item.take || 0) !== 1) return "Übersprungen";
    if (this._isPersonImportConflictItem(item)) {
      const action = this._personImportConflictAction(item);
      if (action === "overwrite") return "Vorhanden (wird überschrieben)";
      if (action === "skip") return "Vorhanden (wird übersprungen)";
      return "Dublette prüfen";
    }
    return "Neu (wird angelegt)";
  }

  _getSelectedPersonImportItem() {
    if (!this.personImportSelectedRowId) return null;
    return (
      (this.personImportItems || []).find((x) => x.row_id === this.personImportSelectedRowId) || null
    );
  }

  _markPersonImportDirty(item, key) {
    if (!item) return;
    if (!item.dirty_fields || typeof item.dirty_fields !== "object") item.dirty_fields = {};
    item.dirty_fields[key] = 1;
  }

  _setPersonImportTakeByRules(item) {
    if (!item) return;
    const hasFirm = !!String(item.firm_id || "").trim();
    const hasName = !!String(item.first_name || "").trim() || !!String(item.last_name || "").trim();
    const next = hasFirm && hasName ? 1 : 0;
    if (Number(item.auto_take ?? 1) === 1) {
      item.take = next;
    }
  }

  _clearPersonImportConflict(item) {
    if (!item) return;
    item.existing_person_id = "";
    item.existing_person = null;
    item.match_mode = "";
    item.conflict_state = "none";
    item.conflict_action = "";
  }

  _recalcPersonImportStatus(item) {
    if (!item) return;
    const hasFirm = !!String(item.firm_id || "").trim();
    if (!hasFirm) {
      const base = String(item.status_base || "").toLowerCase();
      if (base.includes("ungekl")) {
        item.status_base = "Firma ungeklärt";
      } else {
        item.status_base = "Firma fehlt";
      }
      return;
    }
    const base = String(item.status_base || "").trim().toLowerCase();
    if (base === "firma fehlt" || base.includes("ungekl")) {
      item.status_base = this._isPersonImportConflictItem(item) ? "Existiert" : "Neu";
    }
  }

  _createPersonImportFirmSelect(item) {
    const sel = document.createElement("select");
    sel.style.width = "100%";
    const options = [{ id: "", name: "-- Firma wählen --" }, ...(this.personImportFirms || [])];
    for (const f of options) {
      const o = document.createElement("option");
      o.value = f.id;
      o.textContent = f.name;
      sel.appendChild(o);
    }
    if (!this.lockPersonImportFirmSelection) {
      const newFirmOption = document.createElement("option");
      newFirmOption.value = "__new__";
      newFirmOption.textContent = "+ Firma neu…";
      sel.appendChild(newFirmOption);
    }
    sel.value = String(item?.firm_id || "");
    sel.disabled = this.lockPersonImportFirmSelection;
    sel.addEventListener("change", async () => {
      const next = String(sel.value || "");
      if (next === "__new__") {
        sel.value = item?.firm_id || "";
        await this._openPersonImportNewFirmPopup(item);
        return;
      }
      const id = String(sel.value || "");
      item.firm_id = id;
      const firm = (this.personImportFirms || []).find((f) => f.id === id) || null;
      item.firm_name = firm?.name || "";
      this._markPersonImportDirty(item, "firm_id");
      this._setPersonImportTakeByRules(item);
      this._recalcPersonImportStatus(item);
      this._renderPersonImportRows();
      this._renderPersonImportDetail();
    });
    sel.addEventListener("mousedown", (e) => e.stopPropagation());
    return sel;
  }

  async _openPersonImportNewFirmPopup(item) {
    if (!item) return;
    this._closePersonImportNewFirmPopup();
    this.personImportNewFirmItem = item;

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.35)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = String(OVERLAY_TOP);
    overlay.tabIndex = -1;
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) this._closePersonImportNewFirmPopup();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this._closePersonImportNewFirmPopup();
    });

    const modal = document.createElement("div");
    modal.style.width = "min(420px, calc(100vw - 32px))";
    modal.style.maxHeight = "calc(100vh - 32px)";
    modal.style.background = "#fff";
    modal.style.borderRadius = "12px";
    modal.style.border = "1px solid rgba(0,0,0,0.15)";
    modal.style.boxShadow = "0 18px 30px rgba(0,0,0,0.25)";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.overflow = "hidden";
    modal.style.padding = "0";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.gap = "10px";
    header.style.padding = "12px 14px";
    header.style.borderBottom = "1px solid #e2e8f0";

    const heading = document.createElement("div");
    heading.textContent = "Firma neu";
    heading.style.fontWeight = "700";
    heading.style.fontSize = "18px";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "X";
    applyPopupButtonStyle(btnClose);
    btnClose.onclick = () => this._closePersonImportNewFirmPopup();
    header.append(heading, btnClose);

    const hint = document.createElement("div");
    hint.textContent =
      "Nur Firmenname ist Pflicht. Die Firma wird angelegt und kann später detailliert bearbeitet werden.";
    hint.style.fontSize = "12px";
    hint.style.opacity = "0.7";

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.minHeight = "0";
    body.style.overflow = "auto";
    body.style.padding = "14px";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "10px";

    const inpName = document.createElement("input");
    inpName.type = "text";
    inpName.placeholder = "Firmenname";
    inpName.style.width = "100%";

    const inpCity = document.createElement("input");
    inpCity.type = "text";
    inpCity.placeholder = "Ort (optional)";
    inpCity.style.width = "100%";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    actions.style.borderTop = "1px solid #e2e8f0";
    actions.style.padding = "10px 14px";

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel, { variant: "neutral" });
    btnCancel.onclick = () => this._closePersonImportNewFirmPopup();

    const btnSave = document.createElement("button");
    btnSave.textContent = "Firma speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });
    btnSave.onclick = async () => {
      await this._savePersonImportNewFirm({
        name: inpName.value,
        city: inpCity.value,
      });
    };

    actions.append(btnCancel, btnSave);
    body.append(hint, inpName, inpCity);
    modal.append(header, body, actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.personImportNewFirmOverlay = overlay;
    try {
      overlay.focus();
    } catch (_e) {
      // ignore
    }
    inpName.focus();
  }

  _closePersonImportNewFirmPopup() {
    if (this.personImportNewFirmOverlay) {
      try {
        this.personImportNewFirmOverlay.remove();
      } catch (_) {}
    }
    this.personImportNewFirmOverlay = null;
    this.personImportNewFirmItem = null;
  }

  async _savePersonImportNewFirm({ name, city }) {
    if (this.personImportNewFirmSaving) return;
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      alert("Firmenname ist Pflicht.");
      return;
    }

    this.personImportNewFirmSaving = true;
    try {
      const createRes = await this._createImportFirm({
        name: trimmed,
        short: trimmed,
        city: String(city || "").trim(),
      });
      if (!createRes?.ok) {
        alert(createRes?.error || "Firma konnte nicht angelegt werden.");
        return;
      }
      const firm = createRes.firm || null;
      if (firm) {
        this.personImportFirms = [...(this.personImportFirms || []), firm];
        const item = this.personImportNewFirmItem;
        if (item) {
          item.firm_id = firm.id;
          item.firm_name = firm.name || "";
          item.take = 1;
          item.auto_take = 0;
          this._markPersonImportDirty(item, "firm_id");
          this._setPersonImportTakeByRules(item);
          this._recalcPersonImportStatus(item);
          this._renderPersonImportRows();
          this._renderPersonImportDetail();
        }
        this._renderPersonImportFirmList();
      }
      await this._refreshAfterImport();
      this._closePersonImportNewFirmPopup();
    } finally {
      this.personImportNewFirmSaving = false;
    }
  }

  _ensurePersonImportModal() {
    if (this.personImportModalRoot) return;

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(0,0,0,0.25)";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = String(OVERLAY);
    overlay.tabIndex = -1;
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) this._closePersonImportModal();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this._closePersonImportModal();
    });

    const modal = document.createElement("div");
    modal.style.width = "min(1260px, calc(100vw - 28px))";
    modal.style.height = "min(86vh, 880px)";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.background = "#fff";
    modal.style.border = "1px solid #ddd";
    modal.style.borderRadius = "12px";
    modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
    modal.style.overflow = "hidden";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";
    head.style.padding = "12px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.textContent = "Import Kontakte (CSV)";
    title.style.fontWeight = "800";
    title.style.fontSize = "16px";

    const fileNameEl = document.createElement("div");
    fileNameEl.style.marginLeft = "auto";
    fileNameEl.style.fontSize = "12px";
    fileNameEl.style.opacity = "0.8";
    fileNameEl.textContent = "";

    head.append(title, fileNameEl);

    const body = document.createElement("div");
    body.style.display = "grid";
    body.style.gridTemplateColumns = "1fr";
    body.style.gap = "10px";
    body.style.padding = "10px";
    body.style.overflow = "hidden";
    body.style.flex = "1 1 auto";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.flexDirection = "column";
    left.style.gap = "10px";
    left.style.minWidth = "0";

    const drop = document.createElement("div");
    drop.style.border = "1px dashed #9eb6d8";
    drop.style.borderRadius = "10px";
    drop.style.padding = "12px";
    drop.style.background = "#f7fbff";
    drop.style.display = "flex";
    drop.style.alignItems = "center";
    drop.style.justifyContent = "space-between";
    drop.style.gap = "12px";

    const dropText = document.createElement("div");
    dropText.textContent = "CSV hier ablegen";
    dropText.style.fontWeight = "600";

    const dropBtn = document.createElement("button");
    dropBtn.textContent = "Datei auswählen…";
    dropBtn.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.selectCsvFile !== "function") {
        alert("Dateiauswahl ist nicht verfügbar (Preload/IPC fehlt).");
        return;
      }
      const res = await api.selectCsvFile({ title: "Outlook CSV auswählen" });
      if (!res?.ok) {
        alert(res?.error || "Dateiauswahl fehlgeschlagen");
        return;
      }
      if (res.canceled || !(res.filePaths || [])[0]) return;
      await this._loadPersonImportCsvFile(res.filePaths[0]);
    };

    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.style.background = "#eaf3ff";
    });
    drop.addEventListener("dragleave", () => {
      drop.style.background = "#f7fbff";
    });
    drop.addEventListener("drop", async (e) => {
      e.preventDefault();
      drop.style.background = "#f7fbff";
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      const p = String(files[0].path || "").trim();
      if (!p) {
        alert("Datei-Pfad konnte nicht gelesen werden.");
        return;
      }
      await this._loadPersonImportCsvFile(p);
    });

    drop.append(dropText, dropBtn);

    const listHint = document.createElement("div");
    listHint.textContent = "mit doppelklick Kontakt wählen";
    listHint.style.color = "blue";
    listHint.style.fontSize = "16px";
    listHint.style.fontWeight = "600";

    const tableWrap = document.createElement("div");
    tableWrap.style.border = "1px solid #ddd";
    tableWrap.style.borderRadius = "10px";
    tableWrap.style.background = "#fff";
    tableWrap.style.display = "flex";
    tableWrap.style.flexDirection = "column";
    tableWrap.style.flex = "1 1 0";
    tableWrap.style.maxHeight = "55vh";
    tableWrap.style.overflowY = "auto";
    tableWrap.style.overflowX = "auto";
    tableWrap.style.minHeight = "220px";

    const table = document.createElement("table");
    table.style.width = "max-content";
    table.style.minWidth = "100%";
    table.style.borderCollapse = "collapse";
    table.style.tableLayout = "auto";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th style="padding:6px;border-bottom:1px solid #ddd;width:34px;">✓</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;">Vorname</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;">Nachname</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;">Firma</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;">E-Mail</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;">Telefon</th>
        <th style="padding:6px;border-bottom:1px solid #ddd;width:120px;">Abgleich</th>
      </tr>
    `;
    const headerCells = thead.querySelectorAll("th");
    const firstNameHead = headerCells[1] || null;
    const lastNameHead = headerCells[2] || null;

    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    tableWrap.appendChild(table);

    left.append(drop, listHint, tableWrap);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.flexDirection = "column";
    right.style.gap = "10px";
    right.style.minWidth = "0";

    const detail = document.createElement("div");
    detail.style.border = "1px solid #ddd";
    detail.style.borderRadius = "10px";
    detail.style.padding = "10px";
    detail.style.background = "#fff";
    detail.style.overflow = "auto";

    const detailTitle = document.createElement("div");
    detailTitle.textContent = "Details";
    detailTitle.style.fontWeight = "700";
    detailTitle.style.marginBottom = "8px";
    detail.appendChild(detailTitle);

    const mkRow = (label, input) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "112px 1fr";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.marginBottom = "6px";
      const l = document.createElement("div");
      l.textContent = label;
      row.append(l, input);
      return row;
    };

    const makeInput = () => {
      const i = document.createElement("input");
      i.type = "text";
      i.style.width = "100%";
      return i;
    };

    const dTake = document.createElement("input");
    dTake.type = "checkbox";
    const dFirm = document.createElement("select");
    dFirm.style.width = "100%";
    const dFirstName = makeInput();
    const dLastName = makeInput();
    const dEmail = makeInput();
    const dPhone = makeInput();
    const dFunktion = makeInput();
    const dRolle = makeInput();
    const dNotes = document.createElement("textarea");
    dNotes.rows = 4;
    dNotes.style.width = "100%";
    dNotes.style.resize = "vertical";
    const dConflictAction = document.createElement("select");
    dConflictAction.style.width = "100%";

    const compareLabel = document.createElement("div");
    compareLabel.textContent = "Dublettenvergleich (Alt/Neu)";
    compareLabel.style.fontWeight = "700";
    compareLabel.style.marginTop = "10px";

    const compareTa = document.createElement("textarea");
    compareTa.readOnly = true;
    compareTa.rows = 6;
    compareTa.style.width = "100%";
    compareTa.style.resize = "vertical";
    compareTa.style.background = "#fafafa";

    const rawLabel = document.createElement("div");
    rawLabel.textContent = "Quelle (CSV) – Rohdaten";
    rawLabel.style.fontWeight = "700";
    rawLabel.style.marginTop = "12px";

    const rawHint = document.createElement("div");
    rawHint.textContent =
      "Hilft bei widersprüchlichen Kontaktfeldern. Nur Kontrolle, wird nicht übernommen.";
    rawHint.style.fontSize = "12px";
    rawHint.style.opacity = "0.8";
    rawHint.style.marginTop = "4px";

    const rawTa = document.createElement("textarea");
    rawTa.readOnly = true;
    rawTa.rows = 9;
    rawTa.style.width = "100%";
    rawTa.style.resize = "vertical";
    rawTa.style.background = "#fafafa";

    const rawDetails = document.createElement("details");
    rawDetails.style.marginTop = "4px";

    const rawSummary = document.createElement("summary");
    rawSummary.textContent = "Rohdaten anzeigen";
    rawSummary.style.cursor = "pointer";
    rawSummary.style.margin = "0";
    rawSummary.style.fontWeight = "600";

    rawDetails.append(rawSummary, rawTa);

    detail.append(
      mkRow("Übernehmen", dTake),
      mkRow("Firma", dFirm),
      mkRow("Vorname", dFirstName),
      mkRow("Nachname", dLastName),
      mkRow("E-Mail", dEmail),
      mkRow("Telefon", dPhone),
      mkRow("Funktion", dFunktion),
      mkRow("Rolle", dRolle),
      mkRow("Notizen", dNotes),
      mkRow("Dublette", dConflictAction),
      compareLabel,
      compareTa,
      rawLabel,
      rawHint,
      rawDetails
    );

    const firmPickerWrap = document.createElement("div");
    firmPickerWrap.style.display = "flex";
    firmPickerWrap.style.flexDirection = "column";
    firmPickerWrap.style.gap = "6px";
    firmPickerWrap.style.marginTop = "6px";

    const firmPickerLabel = document.createElement("div");
    firmPickerLabel.textContent = "Firmen-Auswahl (Doppelklick übernimmt)";
    firmPickerLabel.style.fontSize = "12px";
    firmPickerLabel.style.opacity = "0.75";

    const firmPickerBtn = document.createElement("button");
    firmPickerBtn.textContent = "Firmenliste anzeigen";
    firmPickerBtn.onclick = (event) => {
      event.stopPropagation();
      this._togglePersonImportFirmList();
    };

    const firmListPanel = document.createElement("div");
    firmListPanel.style.border = "1px solid rgba(0,0,0,0.1)";
    firmListPanel.style.borderRadius = "8px";
    firmListPanel.style.maxHeight = "180px";
    firmListPanel.style.overflowY = "auto";
    firmListPanel.style.background = "#fff";
    firmListPanel.style.display = "none";
    firmListPanel.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";

    firmPickerWrap.append(firmPickerLabel, firmPickerBtn, firmListPanel);

    const statusLegend = document.createElement("div");
    statusLegend.style.fontSize = "12px";
    statusLegend.style.opacity = "0.82";
    statusLegend.textContent =
      "Abgleich: Dubletten brauchen eine Entscheidung ('Überschreiben' oder 'Nicht überschreiben').";

    const sum = document.createElement("div");
    sum.style.fontSize = "12px";
    sum.style.opacity = "0.82";

    right.append(detail, firmPickerWrap, statusLegend, sum);

    this.personImportFirmListBtn = firmPickerBtn;
    this.personImportFirmListPanel = firmListPanel;
    body.append(left);

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.alignItems = "center";
    footer.style.gap = "8px";
    footer.style.padding = "12px";
    footer.style.borderTop = "1px solid #e2e8f0";

    const spacer = document.createElement("div");
    spacer.style.marginLeft = "auto";

    const btnImport = document.createElement("button");
    btnImport.textContent = "Importieren";
    btnImport.onclick = async () => {
      if (this.savingFirm || this.savingPerson) return;
      const api = window.bbmDb || {};
      if (typeof api.personsImportApplyStaging !== "function") {
        alert("Import ist nicht verfügbar (Preload/IPC fehlt).");
        return;
      }
      this.savingFirm = true;
      this.savingPerson = true;
      this._applyFirmFormState();
      this._applyPersonFormState();
      try {
        const activeItems = (this.personImportItems || []).filter((it) => Number(it?.take || 0) === 1);
        const unresolved = activeItems.filter((it) => this._personImportNeedsDecision(it));
        if (unresolved.length > 0) {
          this.personImportSelectedRowId = unresolved[0].row_id;
          this._renderPersonImportRows();
          this._renderPersonImportDetail();
          alert(
            `Bitte Dubletten prüfen: ${unresolved.length} Kontakt(e) benötigen eine Entscheidung (Überschreiben/Nicht überschreiben).`
          );
          return;
        }
        const ctxPayload = this._getImportContextPayload();
        if (ctxPayload.context === "projekt" && !ctxPayload.projectId) {
          alert("Bitte zuerst ein Projekt auswählen.");
          return;
        }
        const res = await api.personsImportApplyStaging({
          items: activeItems,
          ...ctxPayload,
        });
        if (!res?.ok) {
          alert(res?.error || "Import fehlgeschlagen");
          return;
        }
        const s = res.summary || {};
        alert(
          `Import abgeschlossen:\n${s.created || 0} neu\n${s.merged || 0} gemerged\n${s.skipped || 0} übersprungen`
        );
        this._closePersonImportModal();
        await this._refreshAfterImport();
      } finally {
        this.savingFirm = false;
        this.savingPerson = false;
        this._applyFirmFormState();
        this._applyPersonFormState();
      }
    };

    const btnClose = document.createElement("button");
    btnClose.textContent = "Schließen";
    btnClose.onclick = () => this._closePersonImportModal();

    footer.append(spacer, btnImport, btnClose);
    modal.append(head, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const bindDetailInput = (el, key, { rerenderRows = false } = {}) => {
      el.addEventListener("input", () => {
        const item = this._getSelectedPersonImportItem();
        if (!item) return;
        item[key] = String(el.value || "");
        this._markPersonImportDirty(item, key);
        this._setPersonImportTakeByRules(item);
        this._recalcPersonImportStatus(item);
        if (rerenderRows) this._renderPersonImportRows();
      });
    };

    dTake.addEventListener("change", () => {
      const item = this._getSelectedPersonImportItem();
      if (!item) return;
      item.auto_take = 0;
      item.take = dTake.checked ? 1 : 0;
      this._renderPersonImportRows();
      this._renderPersonImportDetail();
    });

    dFirm.addEventListener("change", async () => {
      const item = this._getSelectedPersonImportItem();
      if (!item) return;
      const prevFirmId = String(item.firm_id || "");
      const id = String(dFirm.value || "");
      if (id === "__new__") {
        dFirm.value = item.firm_id || "";
        await this._openPersonImportNewFirmPopup(item);
        return;
      }
      item.firm_id = id;
      const firm = (this.personImportFirms || []).find((f) => f.id === id) || null;
      item.firm_name = firm?.name || "";
      if (prevFirmId !== id) {
        this._clearPersonImportConflict(item);
        item.status_base = id ? "Neu" : "Firma fehlt";
      }
      this._markPersonImportDirty(item, "firm_id");
      this._setPersonImportTakeByRules(item);
      this._recalcPersonImportStatus(item);
      this._renderPersonImportRows();
      this._renderPersonImportDetail();
    });

    bindDetailInput(dFirstName, "first_name", { rerenderRows: true });
    bindDetailInput(dLastName, "last_name", { rerenderRows: true });
    bindDetailInput(dEmail, "email");
    bindDetailInput(dPhone, "phone");
    bindDetailInput(dFunktion, "funktion");
    bindDetailInput(dRolle, "rolle");
    bindDetailInput(dNotes, "notes");
    dConflictAction.addEventListener("change", () => {
      const item = this._getSelectedPersonImportItem();
      if (!item) return;
      item.conflict_action = String(dConflictAction.value || "");
      this._renderPersonImportRows();
      this._renderPersonImportDetail();
    });

    this.personImportModalRoot = overlay;
    this.personImportDropEl = drop;
    this.personImportFileNameEl = fileNameEl;
    this.personImportListBodyEl = tbody;
    this.personImportHeadFirstNameEl = firstNameHead;
    this.personImportHeadLastNameEl = lastNameHead;
    this.personImportDetailWrapEl = {
      take: dTake,
      firm: dFirm,
      first_name: dFirstName,
      last_name: dLastName,
      email: dEmail,
      phone: dPhone,
      funktion: dFunktion,
      rolle: dRolle,
      notes: dNotes,
      conflict_action: dConflictAction,
    };
    this.personImportRawEl = rawTa;
    this.personImportCompareEl = compareTa;
    this.personImportSummaryEl = sum;

    this._renderPersonImportFirmList();
  }

  _openPersonImportModal() {
    this._ensurePersonImportModal();
    this._closePersonImportDetailPopup();
    this._closePersonImportNewFirmPopup();
    this.personImportItems = [];
    this.personImportFirms = [];
    this.personImportSelectedRowId = null;
    if (this.personImportFileNameEl) this.personImportFileNameEl.textContent = "";
    this._renderPersonImportRows();
    this._renderPersonImportDetail();
    if (this.personImportModalRoot) {
      this.personImportModalRoot.style.pointerEvents = "auto";
      this.personImportModalRoot.style.display = "flex";
      try {
        this.personImportModalRoot.focus();
      } catch (_e) {
        // ignore
      }
    }
  }

  _closePersonImportModal() {
    this._closePersonImportDetailPopup();
    this._closePersonImportNewFirmPopup();
    this._closePersonImportFirmList();
    if (this.personImportModalRoot) {
      try {
        this.personImportModalRoot.remove();
      } catch (_) {}
    }
    this.personImportModalRoot = null;
    this.personImportDropEl = null;
    this.personImportFileNameEl = null;
    this.personImportListBodyEl = null;
    this.personImportHeadFirstNameEl = null;
    this.personImportHeadLastNameEl = null;
    this.personImportDetailWrapEl = null;
    this.personImportRawEl = null;
    this.personImportCompareEl = null;
    this.personImportSummaryEl = null;
    this.personImportSelectedRowId = null;
    this.personImportItems = [];
    this.personImportFirms = [];
    this.personImportFirmListBtn = null;
    this.personImportFirmListPanel = null;
    this._releaseImportUiLock();
  }

  async _loadPersonImportCsvFile(filePath) {
    const api = window.bbmDb || {};
    if (typeof api.personsImportParseCsv !== "function") {
      alert("CSV-Import ist nicht verfügbar (Preload/IPC fehlt).");
      return;
    }

    this.personImportLoading = true;
    try {
      const ctxPayload = this._getImportContextPayload();
      if (ctxPayload.context === "projekt" && !ctxPayload.projectId) {
        alert("Bitte zuerst ein Projekt auswählen.");
        return;
      }
      const res = await api.personsImportParseCsv({ filePath, ...ctxPayload });
      if (!res?.ok) {
        alert(res?.error || "CSV konnte nicht gelesen werden.");
        return;
      }
      this.personImportFirms = Array.isArray(res.firms) ? res.firms : [];
      this.personImportItems = Array.isArray(res.items) ? res.items : [];
      this._renderPersonImportFirmList();
      const fallbackFirm = this._resolveProjectFirmFallback();
      const hasFallbackFirm = Boolean(fallbackFirm);
      for (const it of this.personImportItems) {
        if (!it.dirty_fields || typeof it.dirty_fields !== "object") it.dirty_fields = {};
        if (!it.existing_person || typeof it.existing_person !== "object") it.existing_person = null;
        it.existing_person_id = String(it.existing_person_id || "");
        it.conflict_state = String(it.conflict_state || "");
        const action = String(it.conflict_action || "").toLowerCase();
        it.conflict_action = action === "overwrite" || action === "skip" ? action : "";
        if (hasFallbackFirm && !String(it.firm_id || "").trim()) {
          it.firm_id = fallbackFirm.id;
          it.firm_name = fallbackFirm.name || "";
          this._recalcPersonImportStatus(it);
        }
        it.auto_take = 0;
        it.take = 0;
      }
      this.personImportSelectedRowId = this.personImportItems[0]?.row_id || null;
      if (this.personImportFileNameEl) this.personImportFileNameEl.textContent = filePath;
      if (this.personImportSummaryEl) {
        this.personImportSummaryEl.textContent =
          `${res.rowsCount || 0} Kontakte gelesen, ` +
          `${this.personImportItems.length} Personen erkannt, ` +
          `${res.missingFirm || 0} ohne gültige Firma, ` +
          `${res.ambiguousFirm || 0} mit unklarer Firma, ` +
          `${res.missingName || 0} ohne Namen, ` +
          `${res.duplicate || 0} Dubletten.`;
      }
      this._renderPersonImportRows();
      this._renderPersonImportDetail();
    } finally {
      this.personImportLoading = false;
    }
  }

  _renderPersonImportRows() {
    const tbody = this.personImportListBodyEl;
    if (!tbody) return;
    tbody.innerHTML = "";
    this._updatePersonImportNameMaxLengthHeaders();

    const mkInput = (item, key, { clip = true } = {}) => {
      const val = document.createElement("div");
      val.textContent = String(item?.[key] || "");
      val.style.whiteSpace = "nowrap";
      if (clip) {
        val.style.overflow = "hidden";
        val.style.textOverflow = "ellipsis";
      }
      return val;
    };

    for (const item of this.personImportItems || []) {
      const tr = document.createElement("tr");
      const sel = item.row_id === this.personImportSelectedRowId;
      tr.style.background = sel ? "#e8f1ff" : "";
      tr.style.cursor = "pointer";
      tr.onclick = () => {
        this.personImportSelectedRowId = item.row_id;
        for (const row of tbody.children) row.style.background = "";
        tr.style.background = "#e8f1ff";
      };
      tr.ondblclick = () => {
        this.personImportSelectedRowId = item.row_id;
        this._openPersonImportDetailPopup(item);
      };

      const tdTake = document.createElement("td");
      tdTake.style.padding = "4px";
      tdTake.style.borderBottom = "1px solid #eee";
      tdTake.style.textAlign = "center";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = Number(item.take || 0) === 1;
      chk.addEventListener("click", (e) => e.stopPropagation());
      chk.addEventListener("change", () => {
        item.auto_take = 0;
        item.take = chk.checked ? 1 : 0;
        this._renderPersonImportRows();
        this._renderPersonImportDetail();
      });
      chk.addEventListener("mousedown", (e) => e.stopPropagation());
      tdTake.appendChild(chk);

      const mkCell = (el) => {
        const td = document.createElement("td");
        td.style.padding = "4px";
        td.style.borderBottom = "1px solid #eee";
        td.appendChild(el);
        return td;
      };

      const status = document.createElement("div");
      status.textContent = this._personImportStatusText(item);
      status.style.fontSize = "12px";
      status.style.opacity = "0.9";

      tr.append(
        tdTake,
        mkCell(mkInput(item, "first_name", { clip: false })),
        mkCell(mkInput(item, "last_name", { clip: false })),
        mkCell(mkInput(item, "firm_name")),
        mkCell(mkInput(item, "email")),
        mkCell(mkInput(item, "phone")),
        mkCell(status)
      );
      tbody.appendChild(tr);
    }
  }

  _updatePersonImportNameMaxLengthHeaders() {
    const firstHead = this.personImportHeadFirstNameEl;
    const lastHead = this.personImportHeadLastNameEl;
    if (!firstHead || !lastHead) return;

    let maxFirst = 0;
    let maxLast = 0;
    for (const item of this.personImportItems || []) {
      const f = String(item?.first_name || "");
      const l = String(item?.last_name || "");
      if (f.length > maxFirst) maxFirst = f.length;
      if (l.length > maxLast) maxLast = l.length;
    }

    const firstWidth = Math.max(8, Math.ceil(maxFirst / 2));
    const lastWidth = Math.max(8, Math.ceil(maxLast / 2));
    firstHead.style.width = `${firstWidth}ch`;
    lastHead.style.width = `${lastWidth}ch`;
    firstHead.style.whiteSpace = "nowrap";
    lastHead.style.whiteSpace = "nowrap";
    firstHead.textContent = "Vorname";
    lastHead.textContent = "Nachname";
  }

  _renderPersonImportDetail() {
    const detail = this.personImportDetailWrapEl;
    if (!detail) return;
    const item = this._getSelectedPersonImportItem();

    const setVal = (el, val, dis = false) => {
      if (!el) return;
      el.value = val || "";
      el.disabled = !!dis;
    };

    if (!item) {
      if (detail.take) {
        detail.take.checked = false;
        detail.take.disabled = true;
      }
      if (detail.firm) {
        detail.firm.innerHTML = "";
        detail.firm.disabled = true;
      }
      setVal(detail.first_name, "", true);
      setVal(detail.last_name, "", true);
      setVal(detail.email, "", true);
      setVal(detail.phone, "", true);
      setVal(detail.funktion, "", true);
      setVal(detail.rolle, "", true);
      setVal(detail.notes, "", true);
      if (detail.conflict_action) {
        detail.conflict_action.innerHTML = "";
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Keine Dublette";
        detail.conflict_action.appendChild(opt);
        detail.conflict_action.disabled = true;
      }
      if (this.personImportRawEl) this.personImportRawEl.value = "";
      if (this.personImportCompareEl) this.personImportCompareEl.value = "";
      return;
    }

    if (detail.take) {
      detail.take.checked = Number(item.take || 0) === 1;
      detail.take.disabled = false;
    }

    if (detail.firm) {
      detail.firm.innerHTML = "";
      const options = [{ id: "", name: "-- Firma wählen --" }, ...(this.personImportFirms || [])];
      for (const f of options) {
        const o = document.createElement("option");
        o.value = f.id;
        o.textContent = f.name;
        detail.firm.appendChild(o);
      }
      if (!this.lockPersonImportFirmSelection) {
        const newFirmOption = document.createElement("option");
        newFirmOption.value = "__new__";
        newFirmOption.textContent = "+ Firma neu…";
        detail.firm.appendChild(newFirmOption);
      }
      detail.firm.value = String(item.firm_id || "");
      detail.firm.disabled = this.lockPersonImportFirmSelection;
    }

    setVal(detail.first_name, item.first_name || "");
    setVal(detail.last_name, item.last_name || "");
    setVal(detail.email, item.email || "");
    setVal(detail.phone, item.phone || "");
    setVal(detail.funktion, item.funktion || "");
    setVal(detail.rolle, item.rolle || "");
    setVal(detail.notes, item.notes || "");

    if (detail.conflict_action) {
      detail.conflict_action.innerHTML = "";
      if (this._isPersonImportConflictItem(item)) {
        const options = [
          { value: "", label: "-- Entscheidung wählen --" },
          { value: "overwrite", label: "Überschreiben" },
          { value: "skip", label: "Nicht überschreiben" },
        ];
        for (const entry of options) {
          const opt = document.createElement("option");
          opt.value = entry.value;
          opt.textContent = entry.label;
          detail.conflict_action.appendChild(opt);
        }
        detail.conflict_action.value = this._personImportConflictAction(item);
        detail.conflict_action.disabled = Number(item.take || 0) !== 1;
      } else {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Keine Dublette";
        detail.conflict_action.appendChild(opt);
        detail.conflict_action.value = "";
        detail.conflict_action.disabled = true;
      }
    }

    if (this.personImportRawEl) this.personImportRawEl.value = String(item.raw_data || "");
    if (this.personImportCompareEl) {
      this.personImportCompareEl.value = this._buildPersonImportCompareText(item);
    }
  }

  _openPersonImportDetailPopup(item) {
    if (!item) return;
    this._closePersonImportDetailPopup();

    const draft = {
      take: Number(item.take || 0) === 1 ? 1 : 0,
      firm_id: String(item.firm_id || ""),
      firm_name: String(item.firm_name || ""),
      first_name: String(item.first_name || ""),
      last_name: String(item.last_name || ""),
      email: String(item.email || ""),
      phone: String(item.phone || ""),
      funktion: String(item.funktion || ""),
      rolle: String(item.rolle || ""),
      notes: String(item.notes || ""),
    };

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.28)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = String(OVERLAY_TOP);
    overlay.tabIndex = -1;
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) this._closePersonImportDetailPopup();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this._closePersonImportDetailPopup();
    });

    const modal = document.createElement("div");
    modal.style.width = "min(1100px, calc(100vw - 28px))";
    modal.style.height = "min(80vh, 760px)";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.overflow = "hidden";
    modal.style.background = "#fff";
    modal.style.border = "1px solid #ddd";
    modal.style.borderRadius = "12px";
    modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
    modal.style.padding = "0";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.justifyContent = "space-between";
    head.style.gap = "10px";
    head.style.padding = "12px 14px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const headTitle = document.createElement("div");
    headTitle.textContent = "Mitarbeiter zuordnen";
    headTitle.style.fontWeight = "700";
    headTitle.style.fontSize = "16px";

    const headClose = document.createElement("button");
    headClose.type = "button";
    headClose.textContent = "X";
    applyPopupButtonStyle(headClose, { variant: "neutral" });
    headClose.onclick = () => this._closePersonImportDetailPopup();
    head.append(headTitle, headClose);

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.minHeight = "0";
    body.style.padding = "10px";
    body.style.display = "grid";
    body.style.gridTemplateColumns = "1.35fr 1fr";
    body.style.gap = "10px";
    body.style.overflow = "hidden";

    const leftCard = document.createElement("div");
    leftCard.style.border = "1px solid #ddd";
    leftCard.style.borderRadius = "10px";
    leftCard.style.padding = "10px";
    leftCard.style.overflow = "auto";
    leftCard.style.display = "flex";
    leftCard.style.flexDirection = "column";

    const rightCard = document.createElement("div");
    rightCard.style.border = "1px solid #ddd";
    rightCard.style.borderRadius = "10px";
    rightCard.style.padding = "10px";
    rightCard.style.overflow = "hidden";
    rightCard.style.display = "flex";
    rightCard.style.flexDirection = "column";
    rightCard.style.gap = "8px";

    const leftTitle = document.createElement("div");
    leftTitle.textContent = "Zuordnung Firma";
    leftTitle.style.fontWeight = "700";
    leftTitle.style.marginBottom = "8px";

    const mkRow = (label, input) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "112px 1fr";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.marginBottom = "6px";
      const l = document.createElement("div");
      l.textContent = label;
      row.append(l, input);
      return row;
    };

    const mkInput = (value = "") => {
      const input = document.createElement("input");
      input.type = "text";
      input.style.width = "100%";
      input.value = value;
      return input;
    };

    const inpFirstName = mkInput(draft.first_name);
    const inpLastName = mkInput(draft.last_name);
    const inpEmail = mkInput(draft.email);
    const inpPhone = mkInput(draft.phone);
    const inpFunktion = mkInput(draft.funktion);
    const inpRolle = mkInput(draft.rolle);
    const inpNotes = document.createElement("textarea");
    inpNotes.rows = 4;
    inpNotes.style.width = "100%";
    inpNotes.style.resize = "vertical";
    inpNotes.value = draft.notes;

    inpFirstName.addEventListener("input", () => { draft.first_name = String(inpFirstName.value || ""); });
    inpLastName.addEventListener("input", () => { draft.last_name = String(inpLastName.value || ""); });
    inpEmail.addEventListener("input", () => { draft.email = String(inpEmail.value || ""); });
    inpPhone.addEventListener("input", () => { draft.phone = String(inpPhone.value || ""); });
    inpFunktion.addEventListener("input", () => { draft.funktion = String(inpFunktion.value || ""); });
    inpRolle.addEventListener("input", () => { draft.rolle = String(inpRolle.value || ""); });
    inpNotes.addEventListener("input", () => { draft.notes = String(inpNotes.value || ""); });

    const assignedEl = document.createElement("div");
    assignedEl.style.fontSize = "16pt";
    assignedEl.style.fontWeight = "400";
    assignedEl.style.marginLeft = "120px";

    const setAssignedText = () => {
      assignedEl.textContent = draft.firm_name ? `Zugeordnet: ${draft.firm_name}` : "Zugeordnet: keine Firma";
      assignedEl.style.color = draft.firm_name ? "blue" : "#c62828";
    };

    const rawLabel = document.createElement("div");
    rawLabel.textContent = "Rohdaten";
    rawLabel.style.fontWeight = "700";
    rawLabel.style.marginTop = "10px";
    rawLabel.style.marginLeft = "120px";

    const rawTa = document.createElement("textarea");
    rawTa.readOnly = true;
    rawTa.rows = 12;
    rawTa.style.width = "calc(100% - 120px)";
    rawTa.style.marginLeft = "120px";
    rawTa.style.boxSizing = "border-box";
    rawTa.style.flex = "0 0 auto";
    rawTa.style.minHeight = "0";
    rawTa.style.resize = "vertical";
    rawTa.style.background = "#fafafa";
    rawTa.value = String(item.raw_data || "");

    leftCard.append(
      leftTitle,
      mkRow("Vorname", inpFirstName),
      mkRow("Nachname", inpLastName),
      mkRow("E-Mail", inpEmail),
      mkRow("Telefon", inpPhone),
      mkRow("Funktion", inpFunktion),
      mkRow("Rolle", inpRolle),
      mkRow("Notizen", inpNotes),
      assignedEl,
      rawLabel,
      rawTa
    );

    const rightTitle = document.createElement("div");
    rightTitle.textContent = "Firmenliste";
    rightTitle.style.fontWeight = "700";

    const rightHint = document.createElement("div");
    rightHint.textContent = "Doppelklick auf eine Firma uebernimmt die Zuordnung.";
    rightHint.style.fontSize = "12px";
    rightHint.style.opacity = "0.78";

    const btnNewFirm = document.createElement("button");
    btnNewFirm.textContent = "Neue Firma";
    applyPopupButtonStyle(btnNewFirm, { variant: "neutral" });
    btnNewFirm.style.alignSelf = "flex-start";

    const firmList = document.createElement("div");
    firmList.style.border = "1px solid #e5e7eb";
    firmList.style.borderRadius = "8px";
    firmList.style.flex = "1 1 auto";
    firmList.style.overflowY = "auto";
    firmList.style.background = "#fff";

    let createFirmOverlay = null;
    const closeCreateFirmPopup = () => {
      if (!createFirmOverlay) return;
      try {
        createFirmOverlay.remove();
      } catch (_) {}
      createFirmOverlay = null;
    };

    const openCreateFirmPopup = () => {
      if (createFirmOverlay) return;

      const createOverlay = document.createElement("div");
      createOverlay.style.position = "fixed";
      createOverlay.style.inset = "0";
      createOverlay.style.background = "rgba(0,0,0,0.35)";
      createOverlay.style.display = "flex";
      createOverlay.style.alignItems = "center";
      createOverlay.style.justifyContent = "center";
      createOverlay.style.zIndex = String(OVERLAY_TOP);
      createOverlay.tabIndex = -1;
      createOverlay.addEventListener("mousedown", (event) => {
        if (event.target === createOverlay) closeCreateFirmPopup();
      });
      createOverlay.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        closeCreateFirmPopup();
      });

      const createModal = document.createElement("div");
      createModal.style.width = "min(640px, calc(100vw - 32px))";
      createModal.style.maxHeight = "calc(100vh - 32px)";
      createModal.style.background = "#fff";
      createModal.style.borderRadius = "12px";
      createModal.style.boxShadow = "0 20px 50px rgba(0,0,0,0.3)";
      createModal.style.display = "flex";
      createModal.style.flexDirection = "column";
      createModal.style.overflow = "hidden";

      const createHeader = document.createElement("div");
      createHeader.style.display = "flex";
      createHeader.style.alignItems = "center";
      createHeader.style.justifyContent = "space-between";
      createHeader.style.padding = "10px 14px";
      createHeader.style.borderBottom = "1px solid #eee";
      createHeader.style.gap = "8px";

      const createTitle = document.createElement("div");
      createTitle.style.fontWeight = "700";
      createTitle.style.fontSize = "16px";
      createTitle.textContent = "Firma anlegen";

      const btnCreateClose = document.createElement("button");
      btnCreateClose.textContent = "Schließen";
      applyPopupButtonStyle(btnCreateClose, { variant: "neutral" });
      btnCreateClose.onclick = () => closeCreateFirmPopup();

      createHeader.append(createTitle, btnCreateClose);

      const createBody = document.createElement("div");
      createBody.style.padding = "12px";
      createBody.style.display = "grid";
      createBody.style.gridTemplateColumns = "130px 1fr";
      createBody.style.gap = "8px";
      createBody.style.overflowY = "auto";

      const mkCreateInput = (labelText) => {
        const label = document.createElement("div");
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = "text";
        input.style.width = "100%";
        return { label, input };
      };

      const fShort = mkCreateInput("Kurzbez.");
      const fName = mkCreateInput("Name 1 *");
      const fName2 = mkCreateInput("Name 2");
      const fStreet = mkCreateInput("Straße");
      const fZip = mkCreateInput("PLZ");
      const fCity = mkCreateInput("Ort");
      const fPhone = mkCreateInput("Telefon");
      const fEmail = mkCreateInput("E-Mail");
      const fGewerk = mkCreateInput("Gewerk");

      const notesLabel = document.createElement("div");
      notesLabel.textContent = "Notizen";
      const notesInput = document.createElement("textarea");
      notesInput.rows = 4;
      notesInput.style.width = "100%";
      notesInput.style.resize = "vertical";

      createBody.append(
        fShort.label, fShort.input,
        fName.label, fName.input,
        fName2.label, fName2.input,
        fStreet.label, fStreet.input,
        fZip.label, fZip.input,
        fCity.label, fCity.input,
        fPhone.label, fPhone.input,
        fEmail.label, fEmail.input,
        fGewerk.label, fGewerk.input,
        notesLabel, notesInput
      );

      const createFooter = document.createElement("div");
      createFooter.style.display = "flex";
      createFooter.style.justifyContent = "flex-end";
      createFooter.style.gap = "8px";
      createFooter.style.padding = "10px 14px";
      createFooter.style.borderTop = "1px solid #eee";

      const btnCreateCancel = document.createElement("button");
      btnCreateCancel.textContent = "Abbrechen";
      applyPopupButtonStyle(btnCreateCancel, { variant: "neutral" });
      btnCreateCancel.onclick = () => closeCreateFirmPopup();

      const btnCreateSave = document.createElement("button");
      btnCreateSave.textContent = "Speichern";
      applyPopupButtonStyle(btnCreateSave, { variant: "primary" });
      btnCreateSave.onclick = async () => {
        const name = String(fName.input.value || "").trim();
        if (!name) {
          alert("Name 1 ist Pflicht.");
          return;
        }
        const createRes = await this._createImportFirm({
          short: String(fShort.input.value || "").trim() || name,
          name,
          name2: String(fName2.input.value || "").trim(),
          street: String(fStreet.input.value || "").trim(),
          zip: String(fZip.input.value || "").trim(),
          city: String(fCity.input.value || "").trim(),
          phone: String(fPhone.input.value || "").trim(),
          email: String(fEmail.input.value || "").trim(),
          gewerk: String(fGewerk.input.value || "").trim(),
          notes: String(notesInput.value || "").trim(),
        });
        if (!createRes?.ok) {
          alert(createRes?.error || "Firma konnte nicht angelegt werden.");
          return;
        }
        const firm = createRes.firm || null;
        if (firm) {
          this.personImportFirms = [...(this.personImportFirms || []), firm];
          draft.firm_id = String(firm.id || "");
          draft.firm_name = String(firm.name || firm.short || "");
          setAssignedText();
          renderFirmList();
          this._renderPersonImportFirmList();
        }
        closeCreateFirmPopup();
      };

      createFooter.append(btnCreateCancel, btnCreateSave);
      createModal.append(createHeader, createBody, createFooter);
      createOverlay.appendChild(createModal);
      overlay.appendChild(createOverlay);
      createFirmOverlay = createOverlay;
      try {
        createOverlay.focus();
      } catch (_e) {
        // ignore
      }
      fName.input.focus();
    };

    const renderFirmList = () => {
      firmList.innerHTML = "";
      const firms = this.personImportFirms || [];
      for (const firm of firms) {
        const row = document.createElement("div");
        row.textContent = firm.name || firm.short || "(ohne Name)";
        row.style.padding = "8px 10px";
        row.style.cursor = "pointer";
        row.style.borderBottom = "1px solid #eef2f7";
        row.style.background = String(firm.id) === String(draft.firm_id) ? "#e8f1ff" : "transparent";
        row.addEventListener("dblclick", () => {
          draft.firm_id = String(firm.id || "");
          draft.firm_name = String(firm.name || firm.short || "");
          setAssignedText();
          renderFirmList();
        });
        firmList.appendChild(row);
      }
    };

    btnNewFirm.onclick = () => openCreateFirmPopup();
    setAssignedText();
    renderFirmList();
    rightCard.append(rightTitle, rightHint, btnNewFirm, firmList);

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.borderTop = "1px solid #e5e7eb";
    footer.style.padding = "10px 14px";

    const btnCancel = document.createElement("button");
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel, { variant: "neutral" });
    btnCancel.onclick = () => this._closePersonImportDetailPopup();

    const btnApply = document.createElement("button");
    btnApply.textContent = "Übernehmen";
    applyPopupButtonStyle(btnApply, { variant: "primary" });
    btnApply.onclick = () => {
      this._applyPersonImportDetailDraft(item, draft);
      this._closePersonImportDetailPopup();
    };

    footer.append(btnCancel, btnApply);
    body.append(leftCard, rightCard);
    modal.append(head, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    try {
      overlay.focus();
    } catch (_e) {
      // ignore
    }

    const syncRawHeightToFirmList = () => {
      const h = Math.round(firmList.getBoundingClientRect().height || 0);
      if (h > 0) {
        rawTa.style.height = `${h}px`;
        rawTa.style.minHeight = `${h}px`;
        rawTa.style.maxHeight = `${h}px`;
      }
    };
    requestAnimationFrame(syncRawHeightToFirmList);

    this.personImportDetailOverlay = overlay;
  }

  _closePersonImportDetailPopup() {
    if (this.personImportDetailOverlay) {
      try {
        this.personImportDetailOverlay.remove();
      } catch (_) {}
    }
    this.personImportDetailOverlay = null;
  }

  _applyPersonImportDetailDraft(item, draft) {
    if (!item || !draft) return;
    const scrollHost = this.personImportListBodyEl?.parentElement || null;
    const scrollTop = scrollHost ? scrollHost.scrollTop : 0;

    item.auto_take = 0;
    item.take = 1;

    const applyField = (key) => {
      const nextVal = String(draft[key] || "");
      if (String(item[key] || "") === nextVal) return;
      item[key] = nextVal;
      this._markPersonImportDirty(item, key);
    };

    applyField("first_name");
    applyField("last_name");
    applyField("email");
    applyField("phone");
    applyField("funktion");
    applyField("rolle");
    applyField("notes");

    const nextFirmId = String(draft.firm_id || "");
    if (String(item.firm_id || "") !== nextFirmId) {
      item.firm_id = nextFirmId;
      item.firm_name = String(draft.firm_name || "");
      this._clearPersonImportConflict(item);
      item.status_base = nextFirmId ? "Neu" : "Firma fehlt";
      this._markPersonImportDirty(item, "firm_id");
    }

    this._setPersonImportTakeByRules(item);
    this._recalcPersonImportStatus(item);
    this.personImportSelectedRowId = item.row_id;
    this._renderPersonImportRows();
    this._renderPersonImportDetail();
    if (scrollHost) scrollHost.scrollTop = scrollTop;
  }

  _togglePersonImportFirmList() {
    if (!this.personImportFirmListPanel || !this.personImportFirmListBtn) return;
    const isOpen = this.personImportFirmListPanel.style.display !== "none";
    if (isOpen) {
      this._closePersonImportFirmList();
      return;
    }
    this._renderPersonImportFirmList();
    this.personImportFirmListPanel.style.display = "block";
    this.personImportFirmListDocHandler = (event) => {
      if (
        !this.personImportFirmListPanel ||
        this.personImportFirmListPanel.contains(event.target) ||
        (this.personImportFirmListBtn && this.personImportFirmListBtn.contains(event.target))
      ) {
        return;
      }
      this._closePersonImportFirmList();
    };
    document.addEventListener("mousedown", this.personImportFirmListDocHandler);
  }

  _closePersonImportFirmList() {
    if (this.personImportFirmListPanel) {
      this.personImportFirmListPanel.style.display = "none";
    }
    if (this.personImportFirmListDocHandler) {
      document.removeEventListener("mousedown", this.personImportFirmListDocHandler);
      this.personImportFirmListDocHandler = null;
    }
  }

  _renderPersonImportFirmList() {
    const panel = this.personImportFirmListPanel;
    if (!panel) return;
    panel.innerHTML = "";
    const firms = this.personImportFirms || [];
    const selectedItem = this._getSelectedPersonImportItem();
    const selectedId = selectedItem ? String(selectedItem.firm_id || "") : "";

    if (!firms.length) {
      const empty = document.createElement("div");
      empty.textContent = "Keine Firmen verfügbar.";
      empty.style.padding = "8px 12px";
      empty.style.opacity = "0.6";
      panel.appendChild(empty);
    } else {
      for (const firm of firms) {
        const entry = document.createElement("div");
        entry.textContent = firm.name || firm.short || "(ohne Name)";
        entry.style.padding = "8px 10px";
        entry.style.cursor = "pointer";
        entry.style.borderBottom = "1px solid #e9edf3";
        entry.style.userSelect = "none";
        entry.style.background =
          selectedId && String(firm.id) === selectedId ? "#e8f4ff" : "transparent";
        entry.addEventListener("dblclick", async () => {
          await this._applyPersonImportFirmSelection(firm);
        });
        entry.addEventListener("click", (event) => event.stopPropagation());
        panel.appendChild(entry);
      }
    }

    if (!this.lockPersonImportFirmSelection) {
      const newFirmRow = document.createElement("div");
      newFirmRow.textContent = "+ Firma neu…";
      newFirmRow.style.padding = "8px 10px";
      newFirmRow.style.cursor = "pointer";
      newFirmRow.style.fontWeight = "600";
      newFirmRow.style.borderTop = firms.length ? "1px solid #e9edf3" : "none";
      newFirmRow.style.marginTop = firms.length ? "4px" : "0";
      newFirmRow.addEventListener("dblclick", async () => {
        const item = this._getSelectedPersonImportItem();
        if (!item) return;
        await this._openPersonImportNewFirmPopup(item);
        this._closePersonImportFirmList();
      });
      newFirmRow.addEventListener("click", (event) => event.stopPropagation());
      panel.appendChild(newFirmRow);
    }
  }

  async _applyPersonImportFirmSelection(firm) {
    const item = this._getSelectedPersonImportItem();
    if (!item || !firm) return;
    item.firm_id = firm.id;
    item.firm_name = firm.name || "";
    this._markPersonImportDirty(item, "firm_id");
    this._setPersonImportTakeByRules(item);
    this._recalcPersonImportStatus(item);
    this._renderPersonImportRows();
    this._renderPersonImportDetail();
    this._closePersonImportFirmList();
  }

  // ------------------------------------------------------------
  // Actions: Firm
  // ------------------------------------------------------------
  async _saveFirm() {
    if (this.savingFirm) return;

    const data = this._getFirmFormData();
    if (!data.name) {
      alert("Name 1 ist Pflicht.");
      return;
    }

    this.savingFirm = true;
    this._setMsg("Speichere…");
    this._applyFirmFormState();
    this._applyPersonFormState();

    try {
      if (this.firmMode === "create") {
        const res = await window.bbmDb.firmsCreateGlobal({
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

        const id = res?.firm?.id || null;
        this._selectFirm(id);
        this.selectedFirm = res?.firm || this.selectedFirm;

        // Speichern schließt Editbox
        this._closeFirmEditor();

      try {
        await this.reloadFirms();
      } catch (reloadError) {
        console.warn('Firms reload after save failed:', reloadError);
      }
      if (this.selectedFirmId) {
        this.selectedFirm =
          (this.firms || []).find((f) => this._sameId(f?.id, this.selectedFirmId)) || null;
      } else {
        this.selectedFirm = null;
      }
      this._renderFirmsOnly();
      this._renderFirmDetails();
      } else if (this.firmMode === "edit" && this.selectedFirmId) {
        const res = await window.bbmDb.firmsUpdateGlobal({
          firmId: this.selectedFirmId,
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

        const updatedFirm = {
          ...(this.selectedFirm || {}),
          id: this.selectedFirmId,
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
        };
        this.firms = (this.firms || []).map((f) =>
          this._sameId(f?.id, this.selectedFirmId) ? updatedFirm : f
        );
        this.selectedFirm = updatedFirm;
        this._renderFirmsOnly();
        this._renderFirmDetails();

        // Speichern schließt Editbox
        this._closeFirmEditor();

        try {
          await this.reloadFirms();
        } catch (reloadError) {
          console.warn("Firms reload after save failed:", reloadError);
        }
        this.selectedFirm =
          (this.firms || []).find((f) => this._sameId(f?.id, this.selectedFirmId)) || null;
        this._renderFirmsOnly();
        this._renderFirmDetails();
      }
    } finally {
      this.savingFirm = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._renderFirmsOnly();
      this._renderPersonsOnly();
      this._updateVisibility();
    }
  }

  async _saveFirmFromEditor(firmId, data) {
    this._clearStaleBusyState();
    if (this.savingFirm) return;
    const name = String(data?.name || "").trim();
    if (!name) {
      alert("Name 1 ist Pflicht.");
      return;
    }

    const patch = {
      short: String(data?.short || "").trim(),
      name,
      name2: String(data?.name2 || "").trim(),
      street: String(data?.street || "").trim(),
      zip: String(data?.zip || "").trim(),
      city: String(data?.city || "").trim(),
      phone: String(data?.phone || "").trim(),
      email: String(data?.email || "").trim(),
      gewerk: String(data?.gewerk || "").trim(),
      role_code: String(data?.role_code || "").trim(),
      notes: String(data?.notes || "").trim(),
    };

    this.savingFirm = true;
    this._setMsg("Speichere…");
    this._applyFirmFormState();
    this._applyPersonFormState();

    try {
      const res = await window.bbmDb.firmsUpdateGlobal({
        firmId,
        patch,
      });
      if (!res?.ok) {
        alert(res?.error || "Fehler beim Speichern");
        return;
      }

      const updatedFirm = {
        ...(this.selectedFirm || {}),
        id: firmId,
        ...patch,
      };
      this.firms = (this.firms || []).map((f) => (this._sameId(f?.id, firmId) ? updatedFirm : f));
      this.selectedFirmId = firmId;
      this.selectedFirm = updatedFirm;
      this._renderFirmsOnly();
      this._renderFirmDetails();

      try {
        await this.reloadFirms();
      } catch (reloadError) {
        console.warn("Firms reload after save failed:", reloadError);
      }
      this.selectedFirm = (this.firms || []).find((f) => this._sameId(f?.id, firmId)) || null;
      this._renderFirmsOnly();
      this._renderFirmDetails();
    } catch (err) {
      console.error("[FirmsView] _saveFirmFromEditor failed:", err);
      alert(err?.message || "Fehler beim Speichern");
    } finally {
      this.savingFirm = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._renderFirmsOnly();
      this._renderPersonsOnly();
      this._updateVisibility();
    }
  }

  async _deleteFirm(firmId = null) {
    if (this.savingFirm) return;
    const targetFirmId = firmId || this.selectedFirmId;
    if (!targetFirmId) return;

    this.savingFirm = true;
    this._setMsg("Verschiebe in Papierkorb…");
    this._applyFirmFormState();
    this._applyPersonFormState();

    let reloadAfterDelete = false;
    try {
      const deleteCall =
        typeof window.bbmDb?.firmsMarkTrashed === "function"
          ? window.bbmDb.firmsMarkTrashed(targetFirmId)
          : window.bbmDb.firmsDeleteGlobal(targetFirmId);
      const res = await deleteCall;
      if (!res?.ok) {
        alert(res?.error || "Papierkorb fehlgeschlagen");
        return;
      }

      this.firms = (this.firms || []).filter((f) => !this._sameId(f?.id, targetFirmId));
      this.firmMode = "none";
      this.selectedFirmId = null;
      this.selectedFirm = null;
      this.persons = [];
      this.personMode = "none";
      this.editPersonId = null;
      this._hidePersonPopup();
      this._hideFirmPopup();

      reloadAfterDelete = true;
      this._selectFirm(null);
      this._renderFirmsOnly();
      this._renderPersonsOnly();
      this._renderFirmDetails();
    } finally {
      this.savingFirm = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility();
    }

    if (reloadAfterDelete) {
      fireAndForget(() => this.reloadFirms(), "FirmsView reload after deleteFirm");
    }
  }

  // ------------------------------------------------------------
  // Actions: Person
  // ------------------------------------------------------------
  async _savePerson() {
    if (this.savingPerson) return;
    if (!this._hasFirmSelectedSaved()) return;
    if (this.personMode !== "create" && this.personMode !== "edit") return;

    const data = this._getPersonFormData();
    if (!data.firstName && !data.lastName) {
      alert("Name ist Pflicht.");
      return;
    }

    this.savingPerson = true;
    this._setMsg("Speichere Mitarbeiter…");
    this._applyFirmFormState();
    this._applyPersonFormState();

    let reloadPersonsAfter = false;
    try {
      if (this.personMode === "create") {
        const res = await window.bbmDb.personsCreate({
          firmId: this.selectedFirmId,
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

        // Form zu (damit Firmenfelder wieder sichtbar)
        this.personMode = "none";
        this.editPersonId = null;

        if (res?.person) {
          this.persons = [...(this.persons || []), res.person];
          this._renderPersonsOnly();
        }

        reloadPersonsAfter = true;
      } else if (this.personMode === "edit" && this.editPersonId) {
        const res = await window.bbmDb.personsUpdate({
          personId: this.editPersonId,
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

        // Form zu
        this.personMode = "none";
        this.editPersonId = null;

        reloadPersonsAfter = true;
      }
    } finally {
      this.savingPerson = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility(); // => Firm-Editbox wieder auf
    }

    if (reloadPersonsAfter) {
      fireAndForget(() => this._reloadPersons(), "FirmsView reload persons after save");
    }
  }

  async _savePersonFromEditor(personId, data) {
    if (this.savingPerson) return;
    if (!this._hasFirmSelectedSaved()) return;
    const firstName = String(data?.firstName || "").trim();
    const lastName = String(data?.lastName || "").trim();
    if (!firstName && !lastName) {
      alert("Name ist Pflicht.");
      return;
    }

    this.savingPerson = true;
    this._setMsg("Speichere Mitarbeiter…");
    this._applyFirmFormState();
    this._applyPersonFormState();

    let reloadPersonsAfter = false;
    try {
      const res = await window.bbmDb.personsUpdate({
        personId,
        patch: {
          first_name: firstName,
          last_name: lastName,
          funktion: String(data?.funktion || "").trim(),
          email: String(data?.email || "").trim(),
          phone: String(data?.phone || "").trim(),
          rolle: String(data?.rolle || "").trim(),
          notes: String(data?.notes || "").trim(),
        },
      });

      if (!res?.ok) {
        alert(res?.error || "Fehler beim Speichern");
        return;
      }

      this.personMode = "none";
      this.editPersonId = null;
      reloadPersonsAfter = true;
    } finally {
      this.savingPerson = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility();
    }

    if (reloadPersonsAfter) {
      fireAndForget(() => this._reloadPersons(), "FirmsView reload persons after save (editor)");
    }
  }

  async _deletePerson(personId) {
    if (this.savingPerson) return;
    if (!this._hasFirmSelectedSaved()) return;
    const targetPersonId = this._personIdKey(personId);
    if (!targetPersonId) return;

    this.savingPerson = true;
    this._setMsg("Verschiebe Mitarbeiter in Papierkorb…");
    this._applyFirmFormState();
    this._applyPersonFormState();

    let reloadPersonsAfterDelete = false;
    try {
      const deleteCall =
        typeof window.bbmDb?.personsMarkTrashed === "function"
          ? window.bbmDb.personsMarkTrashed(targetPersonId)
          : window.bbmDb.personsDelete(targetPersonId);
      const res = await deleteCall;
      if (!res?.ok) {
        alert(res?.error || "Papierkorb fehlgeschlagen");
        return;
      }

      this.persons = (this.persons || []).filter(
        (p) => this._personIdKey(p?.id) !== targetPersonId
      );

      // Editbox Schließen
      this.personMode = "none";
      this.editPersonId = null;
      this._hidePersonPopup();

      this._renderPersonsOnly();
      reloadPersonsAfterDelete = true;

    } finally {
      this.savingPerson = false;
      this._setMsg("");
      this._applyFirmFormState();
      this._applyPersonFormState();
      this._updateVisibility();
    }

    if (reloadPersonsAfterDelete) {
      fireAndForget(() => this._reloadPersons(), "FirmsView reload persons after delete");
    }
  }
}
