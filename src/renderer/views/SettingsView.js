// src/renderer/views/SettingsView.js
//
// Nutzerdaten werden in DB + appSettings gepflegt (DB ist Quelle beim Laden).
// Persistenz: ueber window.bbmDb.userProfileGet/userProfileUpsert + appSettingsGetMany/appSettingsSetMany.

import { applyPopupButtonStyle, applyPopupCardStyle } from "../ui/popupButtonStyles.js";
import { createPopupOverlay, registerPopupCloseHandlers } from "../ui/popupCommon.js";
import { OVERLAY_TOP } from "../ui/zIndex.js";
import {
  DEFAULT_THEME_SETTINGS,
  applyThemeForSettings,
  normalizeThemeSettings,
  parseCssColor,
} from "../theme/themes.js";

const DEFAULT_V2_PRE_REMARKS_TEXT =
  "folgende Punkte gelten als fest vereinbart, Diesen Text anpassen unter Einstellungen - Druckeinstellungen - Vorbemergung";
const DEFAULT_V2_PRE_REMARKS_ENABLED = true;
const PRINT_DEFAULTS_FIELD_GROUPS = [
  {
    title: "Nutzerdaten",
    fields: [
      { key: "user_name", label: "Nutzername" },
      { key: "user_company", label: "Firma" },
      { key: "user_name1", label: "Name 1" },
      { key: "user_name2", label: "Name 2" },
      { key: "user_street", label: "Strasse" },
      { key: "user_zip", label: "PLZ" },
      { key: "user_city", label: "Ort" },
    ],
  },
  {
    title: "Druckeinstellungen",
    fields: [
      { key: "pdf.protocolTitle", label: "Protokolltitel" },
      { key: "pdf.preRemarks", label: "Vorbemerkung", multiline: true },
      { key: "print.preRemarks.enabled", label: "Vorbemerkung drucken (true/false)" },
      { key: "pdf.footerPlace", label: "Footer Ort" },
      { key: "pdf.footerDate", label: "Footer Datum" },
      { key: "pdf.footerName1", label: "Footer Name 1" },
      { key: "pdf.footerName2", label: "Footer Name 2" },
      { key: "pdf.footerRecorder", label: "Footer Protokollfuehrer" },
      { key: "pdf.footerStreet", label: "Footer Strasse" },
      { key: "pdf.footerZip", label: "Footer PLZ" },
      { key: "pdf.footerCity", label: "Footer Ort" },
      { key: "pdf.footerUseUserData", label: "Footer nutzt Nutzerdaten (true/false)" },
      { key: "print.v2.pagePadTopMm", label: "Rand oben (mm)" },
      { key: "print.v2.pagePadLeftMm", label: "Rand links (mm)" },
      { key: "print.v2.pagePadRightMm", label: "Rand rechts (mm)" },
      { key: "print.v2.pagePadBottomMm", label: "Rand unten (mm)" },
      { key: "print.v2.footerReserveMm", label: "Footer-Reserve (mm)" },
    ],
  },
];
const PRINT_LAYOUT_TOUCHED_KEYS = [
  "print.v2.pagePadLeftMm",
  "print.v2.pagePadRightMm",
  "print.v2.pagePadTopMm",
  "print.v2.pagePadBottomMm",
  "print.v2.footerReserveMm",
];
const THEME_DEFAULT_KEYS = [
  "defaults.ui.themeHeaderBaseColor",
  "defaults.ui.themeSidebarBaseColor",
  "defaults.ui.themeMainBaseColor",
  "defaults.ui.themeHeaderTone",
  "defaults.ui.themeSidebarTone",
  "defaults.ui.themeMainTone",
];

export default class SettingsView {
  constructor({ router } = {}) {
    this.router = router || null;

    this.root = null;
    this.msgEl = null;

    this.inpName = null;
    this.inpCompany = null;
    this.userName = "";
    this.userCompany = "";
    this.inpUserName1 = null;
    this.inpUserName2 = null;
    this.inpUserStreet = null;
    this.inpUserZip = null;
    this.inpUserCity = null;
    this.inpLogoSize = null;
    this.inpLogoPadLeft = null;
    this.inpLogoPadTop = null;
    this.inpLogoPadRight = null;
    this.inpLogoPosition = null;
    this.inpLogoEnabled = null;
    this.inpThemeHeaderTone = null;
    this.inpThemeSidebarTone = null;
    this.inpThemeMainTone = null;
    this.inpThemeHeaderBaseColor = null; // mapped to color picker value
    this.inpThemeSidebarBaseColor = null; // mapped to color picker value
    this.inpThemeMainBaseColor = null; // mapped to color picker value
    this.inpThemeHeaderName = null;
    this.inpThemeSidebarName = null;
    this.inpThemeMainName = null;
    this.inpThemeHeaderR = null;
    this.inpThemeHeaderG = null;
    this.inpThemeHeaderB = null;
    this.inpThemeSidebarR = null;
    this.inpThemeSidebarG = null;
    this.inpThemeSidebarB = null;
    this.inpThemeMainR = null;
    this.inpThemeMainG = null;
    this.inpThemeMainB = null;
    this.inpThemeHeaderDefault = null;
    this.inpThemeSidebarDefault = null;
    this.inpThemeMainDefault = null;
    this.inpThemeGlobalDefault = null;
    this.lblThemeHeaderTone = null;
    this.lblThemeSidebarTone = null;
    this.lblThemeMainTone = null;
    this.previewThemeHeaderColor = null; // kept for compatibility, not rendered
    this.previewThemeSidebarColor = null; // kept for compatibility, not rendered
    this.previewThemeMainColor = null; // kept for compatibility, not rendered
    this.pickThemeHeaderColor = null;
    this.pickThemeSidebarColor = null;
    this.pickThemeMainColor = null;
    this.lblThemeHeaderColorValue = null;
    this.lblThemeSidebarColorValue = null;
    this.lblThemeMainColorValue = null;
    this.errThemeHeaderColor = null;
    this.errThemeSidebarColor = null;
    this.errThemeMainColor = null;
    this.inpThemeHeaderHex = null;
    this.inpThemeSidebarHex = null;
    this.inpThemeMainHex = null;
    this.selThemeHeaderModel = null;
    this.selThemeSidebarModel = null;
    this.selThemeMainModel = null;
    this.canvasThemeHeaderSv = null;
    this.canvasThemeSidebarSv = null;
    this.canvasThemeMainSv = null;
    this.canvasThemeHeaderHue = null;
    this.canvasThemeSidebarHue = null;
    this.canvasThemeMainHue = null;
    this.cursorThemeHeaderSv = null;
    this.cursorThemeSidebarSv = null;
    this.cursorThemeMainSv = null;
    this.cursorThemeHeaderHue = null;
    this.cursorThemeSidebarHue = null;
    this.cursorThemeMainHue = null;
    this._themePickerState = {
      header: { h: 0, s: 0, v: 1 },
      sidebar: { h: 0, s: 0, v: 1 },
      main: { h: 0, s: 0, v: 1 },
    };
    this.inpSecurityPinEnabled = null;
    this.inpSecurityCurrentPin = null;
    this.inpSecurityNewPin = null;
    this.inpSecurityConfirmPin = null;
    this.btnSecurityPinSave = null;
    this.btnSecurityPinDisable = null;
    this._securityPinEnabled = false;
    this._securityPinSaving = false;

    this.inpPdfLogoEnabled = null;
    this.inpPdfLogoFile = null;
    this.imgPdfLogoPreview = null;
    this.pdfLogoDummyEl = null; // <-- Dummy-Platzhalter (graues Feld)
    this.btnPdfLogoRemove = null;
    this.pdfLogoPathEl = null;
    this.inpPdfLogoWidth = null;
    this.inpPdfLogoTop = null;
    this.inpPdfLogoRight = null;
    this.pdfLogoQualityEl = null;
    this._pdfLogoFilePath = "";
    this.inpPdfProtocolTitle = null;
    this.inpPdfTrafficLightAll = null;
    this.inpPdfFooterPlace = null;
    this.inpPdfFooterDate = null;
    this.inpPdfFooterName1 = null;
    this.inpPdfFooterName2 = null;
    this.inpPdfFooterRecorder = null;
    this.inpPdfFooterStreet = null;
    this.inpPdfFooterZip = null;
    this.inpPdfFooterCity = null;
    this.inpPdfProtocolsDir = null;
    this.inpPdfPreRemarks = null;
    this.btnPdfProtocolsBrowse = null;
    this.inpPdfFooterUseUserData = null;
    this.pdfFooterUseUserData = false;
    this.pdfPreRemarks = DEFAULT_V2_PRE_REMARKS_TEXT;
    this.pdfPreRemarksEnabled = DEFAULT_V2_PRE_REMARKS_ENABLED;
    this.btnPdfSettingsSave = null;
    this.btnPdfFooterUseUserData = null;
    this._pdfLogoDataUrl = "";
    this._pdfLogoPx = null;
    this.printLogoEnabledInputs = [null, null, null];
    this.printLogoFileInputs = [null, null, null];
    this.printLogoPreviewImgs = [null, null, null];
    this.printLogoPreviewFrames = [null, null, null];
    this.printLogoPlaceholderEls = [null, null, null];
    this.printLogoRemoveBtns = [null, null, null];
    this.printLogoSizeSelects = [null, null, null];
    this.printLogoAlignChecks = [null, null, null];
    this.printLogoVAlignChecks = [null, null, null];
    this.inpPrintHeaderAdaptive = null;
    this._printLogoDataUrls = ["", "", ""];
    this._printLogoSaving = false;

    this.btnSave = null;
    this.btnArchive = null;
    this.saving = false;
    this._logoSaving = false;
    this._logoSaveTimer = null;
    this._themeSaving = false;
    this._themeSaveTimer = null;
    this._themeSaveMode = "user";
    this._themeRuntimeDefaults = { ...DEFAULT_THEME_SETTINGS };
    this._themeLastValid = {
      header: this._themeAreaDefaultRgb("header"),
      sidebar: this._themeAreaDefaultRgb("sidebar"),
      main: this._themeAreaDefaultRgb("main"),
    };
    this._pdfLogoSaving = false;
    this._pdfLogoSaveTimer = null;
    this._pdfSettingsSaving = false;
    this._pdfSettingsSaveTimer = null;
    this._pdfLogoLoadToken = 0;

    this.roleOrder = [];
    this.roleLabels = {};
    this.roleListEl = null;
    this.btnAddRole = null;
    this.inpAddRole = null;
    this.btnRoleMove = null;
    this.btnRoleDelete = null;
    this.btnRoleRename = null;
    this.roleMoveHintEl = null;
    this.roleSelectedCode = null;
    this.roleMoveModeActive = false;
    this._roleMoveMouseDownHandler = null;
    this._roleMoveKeyDownHandler = null;
    this.roleRenameCode = null;
    this.roleRenameInputEl = null;
    this._roleSelectionAfterReload = null;

    this.deleteConfirmOverlayEl = null;
    this.deleteConfirmMsgEl = null;
    this.deleteConfirmOkBtn = null;
    this.deleteConfirmCancelBtn = null;
    this._deleteConfirmResolve = null;

    this.renameOverlayEl = null;
    this.renameInputEl = null;
    this.renameOkBtn = null;
    this.renameCancelBtn = null;
    this._renameResolve = null;

    this.settingsModalOverlayEl = null;
    this.settingsModalEl = null;
    this.settingsModalTitleEl = null;
    this.settingsModalBodyEl = null;
    this.settingsModalCloseBtn = null;
    this.settingsModalFooterEl = null;
    this.settingsModalSaveBtn = null;
    this._settingsModalSaveFn = null;
    this._settingsModalCloseOnly = false;
    this._settingsModalOpen = false;
    this._bodyLockCount = 0;
    this._bodyOverflowBackup = null;
    this.devUnlocked = false;
    this._devUnlockHandler = null;
    this._devUnlockMsgTimer = null;
    this._devPopupOpen = false;
  }

  _formatLicenseReason(reason, fallbackError = "") {
    const code = String(reason || "").trim().toUpperCase();
    if (code === "NO_LICENSE") return "Keine Lizenz installiert";
    if (code === "LICENSE_EXPIRED") return "Lizenz abgelaufen";
    if (code === "INVALID_FORMAT") return "Ungueltige Lizenzdatei";
    if (code === "INVALID_SIGNATURE") return "Lizenzdatei konnte nicht verifiziert werden";
    if (code === "WRONG_PRODUCT") return "Lizenz gehoert zu einem anderen Produkt";
    if (code === "WRONG_MACHINE") return "Lizenz gehoert zu einem anderen Rechner";
    if (code === "PUBLIC_KEY_MISSING") return "Oeffentlicher Lizenzschluessel fehlt";
    if (code === "PUBLIC_KEY_INVALID") return "Oeffentlicher Lizenzschluessel ist ungueltig";
    return String(fallbackError || "Lizenzstatus konnte nicht geladen werden.");
  }

  _formatLicenseDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "-";
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return raw;
    try {
      return new Intl.DateTimeFormat("de-DE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(dt);
    } catch (_e) {
      return raw;
    }
  }

  _formatLicenseWarning(res, fallbackReason = "") {
    if (res?.expired) return "Lizenz ist abgelaufen";

    const daysRemaining = Number(res?.daysRemaining);
    if (res?.expiresSoon && Number.isFinite(daysRemaining)) {
      if (daysRemaining <= 0) return "Lizenz laeuft heute ab";
      if (daysRemaining === 1) return "Lizenz laeuft in 1 Tag ab";
      return `Lizenz laeuft in ${daysRemaining} Tagen ab`;
    }

    return this._formatLicenseReason(res?.reason, fallbackReason);
  }

  _formatLicenseBinding(binding) {
    const code = String(binding || "").trim().toLowerCase() || "none";
    if (code === "machine") return "Vollversion (rechnergebunden)";
    return "Soft-Lizenz";
  }

  _formatLicenseGenerationError(raw) {
    const code = String(raw || "").trim().toUpperCase();
    if (code === "LICENSE_GENERATION_NOT_ALLOWED") return "Lizenz-Erstellung ist nur im Entwicklungsbereich verfuegbar.";
    if (code === "LICENSE_TOOL_NOT_FOUND") return "C:\\license-tool wurde nicht gefunden.";
    if (code === "LICENSE_TOOL_SCRIPT_MISSING") return "generate-license.cjs wurde im license-tool nicht gefunden.";
    if (code === "PRIVATE_KEY_MISSING") return "private_key.pem fehlt im license-tool.";
    if (code === "INVALID_FORMAT") return "Die geladene Lizenzdatei ist beschaedigt oder hat kein gueltiges Format.";
    if (code === "CUSTOMER_NAME_REQUIRED") return "Bitte Kunde / Firma angeben.";
    if (code === "LICENSE_ID_REQUIRED") return "Bitte eine Lizenznummer angeben.";
    if (code === "VALID_FROM_REQUIRED") return "Bitte ein gueltiges Startdatum setzen.";
    if (code === "VALID_UNTIL_REQUIRED") return "Bitte ein gueltiges Enddatum oder Nutzungstage setzen.";
    if (code === "VALID_UNTIL_BEFORE_VALID_FROM") return "Das Enddatum darf nicht vor dem Startdatum liegen.";
    if (code === "BINDING_INVALID") return "Bitte einen gueltigen Lizenzmodus auswaehlen.";
    if (code === "MACHINE_ID_REQUIRED_FOR_BINDING") return "Fuer Vollversion ist eine gueltige Machine-ID erforderlich.";
    if (code === "MAX_DEVICES_INVALID") return "Max. Geraete muss mindestens 1 sein.";
    if (code === "FEATURES_REQUIRED") return "Bitte mindestens ein Feature auswaehlen.";
    if (code === "OUTPUT_FILE_NOT_FOUND") return "Die erzeugte Lizenzdatei wurde im Ausgabeordner nicht gefunden.";
    if (code === "GENERATOR_TIMEOUT") return "Lizenz-Generator hat zu lange gebraucht. Bitte Vorgang erneut starten.";
    if (code === "GENERATOR_FAILED") return "Das externe license-tool hat einen Fehler gemeldet.";
    return String(raw || "Lizenz konnte nicht erzeugt werden.");
  }

  _createLicenseSettingsContent() {
    const api = window.bbmDb || {};

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "10px";
    wrap.style.minWidth = "min(580px, calc(100vw - 80px))";
    wrap.style.maxWidth = "700px";

    const statusCard = document.createElement("div");
    applyPopupCardStyle(statusCard);
    statusCard.style.padding = "6px 8px";
    statusCard.style.display = "grid";
    statusCard.style.gap = "6px";

    const statusRow = document.createElement("div");
    statusRow.style.display = "flex";
    statusRow.style.alignItems = "center";
    statusRow.style.justifyContent = "space-between";
    statusRow.style.gap = "8px";
    statusRow.style.flexWrap = "wrap";

    const statusLabel = document.createElement("div");
    statusLabel.style.fontWeight = "800";
    statusLabel.style.fontSize = "12px";
    statusLabel.textContent = "Lizenzstatus wird geladen ...";

    const statusHint = document.createElement("div");
    statusHint.style.fontSize = "10px";
    statusHint.style.opacity = "0.8";
    statusHint.textContent = "";

    statusRow.append(statusLabel, statusHint);

    const messageEl = document.createElement("div");
    messageEl.style.fontSize = "11px";
    messageEl.style.minHeight = "14px";
    messageEl.style.color = "#475569";

    const licenseBanner = document.createElement("div");
    licenseBanner.style.padding = "6px 8px";
    licenseBanner.style.borderRadius = "8px";
    licenseBanner.style.background = "#f8fafc";
    licenseBanner.style.border = "1px solid rgba(0,0,0,0.08)";
    licenseBanner.style.fontSize = "11px";
    licenseBanner.style.fontWeight = "700";
    licenseBanner.style.color = "#0f172a";
    licenseBanner.style.wordBreak = "break-word";
    licenseBanner.textContent = "\u00A9 BBM 2026 - v- | Keine gueltige Lizenz";

    const infoGrid = document.createElement("div");
    infoGrid.style.display = "grid";
    infoGrid.style.gridTemplateColumns = "minmax(130px, 180px) 1fr";
    infoGrid.style.gap = "4px 8px";

    const makeRow = (label, valueNode) => {
      const labelEl = document.createElement("div");
      labelEl.textContent = label;
      labelEl.style.fontWeight = "700";
      labelEl.style.fontSize = "11px";
      labelEl.style.color = "#334155";

      const valueEl =
        valueNode instanceof HTMLElement ? valueNode : document.createElement("div");
      if (!(valueNode instanceof HTMLElement)) {
        valueEl.textContent = String(valueNode || "-");
      }
      valueEl.style.fontSize = "11px";
      valueEl.style.minWidth = "0";
      valueEl.style.wordBreak = "break-word";
      return [labelEl, valueEl];
    };

    const valueStatus = document.createElement("div");
    const valueCustomer = document.createElement("div");
    const valueLicenseId = document.createElement("div");
    const valueEdition = document.createElement("div");
    const valueBinding = document.createElement("div");
    const valueValidUntil = document.createElement("div");
    const valueDaysRemaining = document.createElement("div");
    const valueFeatures = document.createElement("div");
    const valueMachineId = document.createElement("div");
    const valueAppVersion = document.createElement("div");
    const valueReason = document.createElement("div");
    valueReason.style.fontSize = "11px";
    valueReason.style.opacity = "0.8";

    [
      makeRow("Status", valueStatus),
      makeRow("Kunde", valueCustomer),
      makeRow("Lizenz-ID", valueLicenseId),
      makeRow("Edition", valueEdition),
      makeRow("Modus", valueBinding),
      makeRow("Gueltig bis", valueValidUntil),
      makeRow("Resttage", valueDaysRemaining),
      makeRow("Machine-ID", valueMachineId),
      makeRow("App-Version", valueAppVersion),
      makeRow("Aktivierte Features", valueFeatures),
      makeRow("Hinweis", valueReason),
    ].forEach(([labelEl, valueEl]) => infoGrid.append(labelEl, valueEl));

    const diagnosticsCard = document.createElement("div");
    applyPopupCardStyle(diagnosticsCard);
    diagnosticsCard.style.padding = "6px 8px";
    diagnosticsCard.style.display = "grid";
    diagnosticsCard.style.gap = "6px";

    const diagnosticsHead = document.createElement("div");
    diagnosticsHead.style.display = "flex";
    diagnosticsHead.style.alignItems = "center";
    diagnosticsHead.style.justifyContent = "space-between";
    diagnosticsHead.style.gap = "8px";
    diagnosticsHead.style.flexWrap = "wrap";

    const diagnosticsTitle = document.createElement("div");
    diagnosticsTitle.textContent = "Support-Diagnose";
    diagnosticsTitle.style.fontWeight = "800";

    const btnCopyDiagnostics = document.createElement("button");
    btnCopyDiagnostics.type = "button";
    btnCopyDiagnostics.textContent = "Diagnose kopieren";
    applyPopupButtonStyle(btnCopyDiagnostics);

    diagnosticsHead.append(diagnosticsTitle, btnCopyDiagnostics);

    const diagnosticsHelp = document.createElement("div");
    diagnosticsHelp.textContent = "Kompakter Textblock fuer Supportfaelle.";
    diagnosticsHelp.style.fontSize = "11px";
    diagnosticsHelp.style.opacity = "0.78";

    const diagnosticsPre = document.createElement("pre");
    diagnosticsPre.style.margin = "0";
    diagnosticsPre.style.padding = "8px";
    diagnosticsPre.style.borderRadius = "8px";
    diagnosticsPre.style.background = "#f8fafc";
    diagnosticsPre.style.border = "1px solid rgba(0,0,0,0.08)";
    diagnosticsPre.style.fontSize = "10px";
    diagnosticsPre.style.lineHeight = "1.35";
    diagnosticsPre.style.whiteSpace = "pre-wrap";
    diagnosticsPre.style.wordBreak = "break-word";
    diagnosticsPre.textContent = "Diagnosedaten werden geladen ...";

    diagnosticsCard.append(diagnosticsHead, diagnosticsHelp, diagnosticsPre);

    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.gap = "8px";
    buttonRow.style.flexWrap = "wrap";

    const btnImport = document.createElement("button");
    btnImport.type = "button";
    btnImport.textContent = "Lizenz importieren";
    applyPopupButtonStyle(btnImport, { variant: "primary" });

    const btnReload = document.createElement("button");
    btnReload.type = "button";
    btnReload.textContent = "Status aktualisieren";
    applyPopupButtonStyle(btnReload);

    const btnCreateRequest = document.createElement("button");
    btnCreateRequest.type = "button";
    btnCreateRequest.textContent = "Lizenzanforderung erzeugen";
    applyPopupButtonStyle(btnCreateRequest);

    const requestHint = document.createElement("div");
    requestHint.style.fontSize = "11px";
    requestHint.style.opacity = "0.8";
    requestHint.textContent = "Soft-Lizenz: direkt importierbar. Vollversion: zuerst auf dem Zielrechner eine Lizenzanforderung erzeugen und danach die passende Lizenz importieren.";

    buttonRow.append(btnImport, btnReload, btnCreateRequest);
    statusCard.append(statusRow, messageEl, licenseBanner, infoGrid, requestHint, buttonRow);
    wrap.append(statusCard, diagnosticsCard);

    const setBusy = (busy) => {
      const isBusy = !!busy;
      btnImport.disabled = isBusy;
      btnReload.disabled = isBusy;
      btnCreateRequest.disabled = isBusy;
      btnCopyDiagnostics.disabled = isBusy;
    };

    const setMessage = (text, isError = false) => {
      messageEl.textContent = String(text || "");
      messageEl.style.color = isError ? "#b91c1c" : "#475569";
    };

    const renderStatus = (res, fallbackError = "") => {
      const valid = !!res?.valid;
      const reason = String(res?.reason || "").trim();
      const features = Array.isArray(res?.features) ? res.features : [];
      const reasonText = this._formatLicenseReason(reason, fallbackError);
      const warningText = this._formatLicenseWarning(res, fallbackError);
      const daysRemaining = Number(res?.daysRemaining);
      const isExpired = !!res?.expired || reason === "LICENSE_EXPIRED";
      const isExpiringSoon = !!res?.expiresSoon && !isExpired;
      const accentColor = isExpired ? "#b91c1c" : isExpiringSoon ? "#b45309" : valid ? "#166534" : "#b91c1c";

      statusLabel.textContent = valid ? "Lizenz gueltig" : "Lizenz ungueltig";
      statusLabel.style.color = accentColor;
      statusHint.textContent = valid
        ? isExpiringSoon
          ? warningText
          : "Offline-Lizenz aktiv"
        : warningText;
      statusHint.style.color = accentColor;

      valueStatus.textContent = valid ? (isExpiringSoon ? "gueltig, Warnung" : "gueltig") : "ungueltig";
      valueStatus.style.color = accentColor;
      valueStatus.style.fontWeight = "700";
      valueCustomer.textContent = String(res?.customerName || "").trim() || "-";
      valueLicenseId.textContent = String(res?.licenseId || "").trim() || "-";
      valueEdition.textContent = String(res?.edition || "").trim() || "-";
      valueBinding.textContent = this._formatLicenseBinding(res?.binding);
      valueValidUntil.textContent = this._formatLicenseDate(res?.validUntil);
      valueDaysRemaining.textContent = Number.isFinite(daysRemaining) ? String(daysRemaining) : "-";
      valueMachineId.textContent = String(res?.machineId || "").trim() || "-";
      valueAppVersion.textContent = String(res?.appVersion || "").trim() || "-";
      valueFeatures.textContent = features.length ? features.join(", ") : "-";
      valueReason.textContent = valid ? (isExpiringSoon ? warningText : "Keine Warnung") : reasonText;
      diagnosticsPre.textContent = String(res?.diagnosticsText || "").trim() || "Keine Diagnosedaten verfuegbar.";
      const versionLabel = String(res?.appVersion || "").trim() || "-";
      const customerLabel = String(res?.customerName || "").trim();
      licenseBanner.textContent = valid && customerLabel
        ? `\u00A9 BBM 2026 - v${versionLabel} | Lizenziert fuer: ${customerLabel}`
        : `\u00A9 BBM 2026 - v${versionLabel} | Keine gueltige Lizenz`;

      if (!valid && reason === "NO_LICENSE") {
        setMessage("Es ist aktuell keine Lizenz installiert. Bitte eine .bbmlic-Datei importieren.", false);
      } else if (isExpired) {
        setMessage("Lizenz ist abgelaufen.", true);
      } else if (valid && isExpiringSoon) {
        setMessage(warningText, true);
      } else if (!valid) {
        setMessage(reasonText, true);
      } else {
        setMessage("Lizenzstatus erfolgreich geladen.", false);
      }
    };

    const loadStatus = async () => {
      if (typeof api.licenseGetStatus !== "function") {
        renderStatus({ valid: false, reason: "INVALID_FORMAT" }, "Lizenz-IPC ist nicht verfuegbar.");
        setMessage("Lizenzstatus kann in dieser App-Version nicht geladen werden.", true);
        return;
      }

      setBusy(true);
      setMessage("Lizenzstatus wird geladen ...", false);
      try {
        const res = await api.licenseGetStatus();
        if (!res?.ok) {
          renderStatus(res || {}, res?.error || "Lizenzstatus konnte nicht geladen werden.");
          return;
        }
        renderStatus(res);
      } catch (err) {
        renderStatus({}, err?.message || "Lizenzstatus konnte nicht geladen werden.");
      } finally {
        setBusy(false);
      }
    };

    const loadDiagnostics = async () => {
      if (typeof api.licenseGetDiagnostics !== "function") return;
      try {
        const res = await api.licenseGetDiagnostics();
        diagnosticsPre.textContent =
          String(res?.diagnosticsText || "").trim() || "Keine Diagnosedaten verfuegbar.";
      } catch (_err) {
        diagnosticsPre.textContent = "Diagnosedaten konnten nicht geladen werden.";
      }
    };

    const copyText = async (text) => {
      const value = String(text || "").trim();
      if (!value) return false;

      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          return true;
        }
      } catch (_e) {
        // fallback below
      }

      const helper = document.createElement("textarea");
      helper.value = value;
      helper.setAttribute("readonly", "readonly");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      helper.style.pointerEvents = "none";
      document.body.appendChild(helper);
      helper.select();
      helper.setSelectionRange(0, helper.value.length);
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (_e) {
        ok = false;
      } finally {
        helper.remove();
      }
      return ok;
    };

    btnImport.onclick = async () => {
      if (typeof api.licenseImport !== "function") {
        setMessage("Lizenzimport ist in dieser App-Version nicht verfuegbar.", true);
        return;
      }

      setBusy(true);
      setMessage("Lizenzdatei wird importiert ...", false);
      try {
        const res = await api.licenseImport({});
        if (res?.canceled) {
          setMessage("Lizenzimport abgebrochen.", false);
          return;
        }
        if (!res?.ok) {
          renderStatus(res || {}, res?.error || "Lizenz konnte nicht importiert werden.");
          await loadDiagnostics();
          return;
        }
        renderStatus(res);
        setMessage("Lizenz erfolgreich importiert.", false);
        await loadStatus();
        await loadDiagnostics();
      } catch (err) {
        renderStatus({}, err?.message || "Lizenz konnte nicht importiert werden.");
        await loadDiagnostics();
      } finally {
        setBusy(false);
      }
    };

    btnCreateRequest.onclick = async () => {
      if (typeof api.licenseCreateRequest !== "function") {
        setMessage("Lizenzanforderung ist in dieser App-Version nicht verfuegbar.", true);
        return;
      }
      setBusy(true);
      setMessage("Lizenzanforderung wird erzeugt ...", false);
      try {
        const customerHint = String(valueCustomer.textContent || "").trim();
        const res = await api.licenseCreateRequest({ product: "bbm-protokoll", customerHint });
        if (res?.canceled) {
          setMessage("Lizenzanforderung abgebrochen.", false);
          return;
        }
        if (!res?.ok) {
          setMessage(this._formatLicenseGenerationError(res?.error), true);
          return;
        }
        setMessage(`Lizenzanforderung gespeichert: ${res?.filePath || "-"}`, false);
      } catch (err) {
        setMessage(this._formatLicenseGenerationError(err?.message || err), true);
      } finally {
        setBusy(false);
      }
    };

    btnReload.onclick = async () => {
      await loadStatus();
      await loadDiagnostics();
    };

    btnCopyDiagnostics.onclick = async () => {
      const text = diagnosticsPre.textContent || "";
      const copied = await copyText(text);
      setMessage(copied ? "Diagnose in die Zwischenablage kopiert." : "Diagnose konnte nicht kopiert werden.", !copied);
    };

    void Promise.all([loadStatus(), loadDiagnostics()]);
    return wrap;
  }

  render() {
    const root = document.createElement("div");
    root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== "Escape") return;

      // Enter in Textarea soll einen Zeilenumbruch erzeugen (kein globales Save/Close)
      const tag = (e.target?.tagName || "").toString().toUpperCase();
      if (e.key === "Enter" && tag === "TEXTAREA") return;

      const delOpen = this.deleteConfirmOverlayEl?.style?.display === "flex";
      const renOpen = this.renameOverlayEl?.style?.display === "flex";
      const settingsOpen = this._settingsModalOpen;
      if (!delOpen && !renOpen && !settingsOpen) return;

      if (delOpen) {
        e.preventDefault();
        this._resolveDeleteConfirm(e.key === "Enter");
        return;
      }
      if (renOpen) {
        e.preventDefault();
        this._resolveRename(e.key === "Enter");
        return;
      }
      if (e.key === "Escape" && settingsOpen) {
        e.preventDefault();
        this._closeSettingsModal();
      }
    });

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";
    head.style.marginBottom = "10px";

    const title = document.createElement("h2");
    title.textContent = "Einstellungen";
    title.style.margin = "0";

    const hasActiveProject = !!this.router?.currentProjectId;
    let btnBackToProject = null;
    if (hasActiveProject) {
      btnBackToProject = document.createElement("button");
      btnBackToProject.type = "button";
      btnBackToProject.textContent = "Zurück zum Protokoll";
      applyPopupButtonStyle(btnBackToProject, { variant: "neutral" });
      btnBackToProject.onclick = async () => {
        const projectId = this.router?.currentProjectId || null;
        const meetingId = this.router?.currentMeetingId || null;
        if (!projectId) return;
        if (meetingId && typeof this.router?.showTops === "function") {
          await this.router.showTops(meetingId, projectId);
          return;
        }
        if (typeof this.router?.showMeetings === "function") {
          await this.router.showMeetings(projectId);
        }
      };
    }

    const msg = document.createElement("div");
    msg.style.marginLeft = "auto";
    msg.style.fontSize = "12px";
    msg.style.opacity = "0.85";

    if (btnBackToProject) head.append(title, btnBackToProject, msg);
    else head.append(title, msg);

    const tiles = document.createElement("div");
    tiles.style.display = "grid";
    tiles.style.gridTemplateColumns = "repeat(auto-fill, minmax(220px, 1fr))";
    tiles.style.gap = "10px";
    tiles.style.marginBottom = "12px";
    tiles.style.maxWidth = "720px";

    const mkTile = ({ titleText, subText, onClick }) => {
      const t = document.createElement("div");
      t.style.border = "1px solid #ddd";
      t.style.borderRadius = "10px";
      t.style.background = "#fff";
      t.style.padding = "12px";
      t.style.cursor = "pointer";
      t.style.userSelect = "none";

      const tt = document.createElement("div");
      tt.textContent = titleText;
      tt.style.fontWeight = "900";
      tt.style.fontSize = "16px";
      tt.style.marginBottom = "6px";

      const st = document.createElement("div");
      st.textContent = subText || "";
      st.style.opacity = "0.8";
      st.style.fontSize = "12px";

      t.append(tt, st);

      t.onmouseenter = () => {
        if (this.saving) return;
        t.style.borderColor = "#7aa7ff";
      };
      t.onmouseleave = () => {
        t.style.borderColor = "#ddd";
      };

      t.addEventListener("click", async () => {
        if (this.saving) return;
        await onClick?.();
      });

      t.tabIndex = 0;
      t.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (this.saving) return;
        await onClick?.();
      });

      return t;
    };

    const tileArchive = mkTile({
      titleText: "Archiv",
      subText: "Archivierte Projekte anzeigen",
      onClick: async () => {
        if (!this.router || typeof this.router.showArchive !== "function") {
          alert("Router.showArchive ist nicht verfuegbar.");
          return;
        }
        await this.router.showArchive();
      },
    });

    tiles.append(tileArchive);

    const creditLine = document.createElement("div");
    creditLine.style.marginTop = "4px";
    creditLine.style.fontSize = "12px";
    creditLine.style.opacity = "0.75";
    creditLine.style.maxWidth = "720px";
    creditLine.style.textAlign = "left";
    creditLine.style.justifySelf = "start";
    creditLine.textContent = "Entwickelt von Steffen Bandholt - ";
    const creditMail = document.createElement("a");
    creditMail.href = "mailto:info@bandholt.de";
    creditMail.textContent = "info@bandholt.de";
    creditLine.appendChild(creditMail);


    const mkRow = (labelContent, inputEl) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "160px 1fr";
      row.style.gap = "10px";
      row.style.alignItems = "center";
      row.style.marginBottom = "8px";

      const lbl = document.createElement("div");
      if (labelContent instanceof Node) {
        lbl.appendChild(labelContent);
      } else {
        lbl.textContent = labelContent;
      }

      row.append(lbl, inputEl);
      return row;
    };

    const mkSectionTile = (titleText) => {
      const tile = document.createElement("div");
      tile.style.border = "1px solid #ddd";
      tile.style.borderRadius = "10px";
      tile.style.background = "#fff";
      tile.style.padding = "12px";

      const titleEl = document.createElement("div");
      titleEl.textContent = titleText;
      titleEl.style.fontWeight = "900";
      titleEl.style.fontSize = "16px";
      titleEl.style.marginBottom = "10px";

      const body = document.createElement("div");
      body.style.display = "grid";
      body.style.gap = "10px";

      tile.append(titleEl, body);
      return { tile, body };
    };

    const userBox = document.createElement("div");
    applyPopupCardStyle(userBox);
    userBox.style.padding = "10px";
    userBox.style.maxWidth = "360px";
    userBox.style.width = "100%";
    userBox.style.marginTop = "0";
    const userTitle = document.createElement("div");
    userTitle.textContent = "Nutzerdaten";
    userTitle.style.fontWeight = "bold";
    userTitle.style.marginBottom = "6px";

    const inpUserName1 = document.createElement("input");
    inpUserName1.type = "text";
    inpUserName1.placeholder = "Name 1";
    inpUserName1.style.width = "100%";

    const inpUserName2 = document.createElement("input");
    inpUserName2.type = "text";
    inpUserName2.placeholder = "Name 2";
    inpUserName2.style.width = "100%";

    const inpUserStreet = document.createElement("input");
    inpUserStreet.type = "text";
    inpUserStreet.placeholder = "Stra?e / Hsnr";
    inpUserStreet.style.width = "100%";

    const inpUserZip = document.createElement("input");
    inpUserZip.type = "text";
    inpUserZip.inputMode = "numeric";
    inpUserZip.placeholder = "PLZ";
    inpUserZip.maxLength = 5;
    inpUserZip.style.width = "120px";
    inpUserZip.style.maxWidth = "120px";
    inpUserZip.style.justifySelf = "start";

    const inpUserCity = document.createElement("input");
    inpUserCity.type = "text";
    inpUserCity.placeholder = "Ort";
    inpUserCity.style.width = "100%";

    const userRowName1 = mkRow("Name 1", inpUserName1);
    userRowName1.style.gridTemplateColumns = "120px minmax(0, 1fr)";
    userRowName1.style.gap = "8px";
    const userRowName2 = mkRow("Name 2", inpUserName2);
    userRowName2.style.gridTemplateColumns = "120px minmax(0, 1fr)";
    userRowName2.style.gap = "8px";
    const userRowStreet = mkRow("Stra?e / Hsnr", inpUserStreet);
    userRowStreet.style.gridTemplateColumns = "120px minmax(0, 1fr)";
    userRowStreet.style.gap = "8px";
    const userRowZip = mkRow("PLZ", inpUserZip);
    userRowZip.style.gridTemplateColumns = "120px minmax(0, 1fr)";
    userRowZip.style.gap = "8px";
    const userRowCity = mkRow("Ort", inpUserCity);
    userRowCity.style.gridTemplateColumns = "120px minmax(0, 1fr)";
    userRowCity.style.gap = "8px";

    userBox.append(userTitle, userRowName1, userRowName2, userRowStreet, userRowZip, userRowCity);

    const logoBox = document.createElement("div");    applyPopupCardStyle(logoBox);    logoBox.style.padding = "10px";    logoBox.style.maxWidth = "720px";    logoBox.style.marginTop = "10px";
    const logoTitle = document.createElement("div");
    logoTitle.textContent = "Header-Logo";
    logoTitle.style.fontWeight = "bold";
    logoTitle.style.marginBottom = "6px";

    const inpLogoSize = document.createElement("input");
    inpLogoSize.type = "number";
    inpLogoSize.min = "12";
    inpLogoSize.max = "48";
    inpLogoSize.step = "1";
    inpLogoSize.style.width = "100%";
    inpLogoSize.addEventListener("input", () => this._scheduleLogoSave());

    const inpLogoPadLeft = document.createElement("input");
    inpLogoPadLeft.type = "number";
    inpLogoPadLeft.min = "0";
    inpLogoPadLeft.max = "40";
    inpLogoPadLeft.step = "1";
    inpLogoPadLeft.style.width = "100%";
    inpLogoPadLeft.addEventListener("input", () => this._scheduleLogoSave());

    const inpLogoPadTop = document.createElement("input");
    inpLogoPadTop.type = "number";
    inpLogoPadTop.min = "0";
    inpLogoPadTop.max = "20";
    inpLogoPadTop.step = "1";
    inpLogoPadTop.style.width = "100%";
    inpLogoPadTop.addEventListener("input", () => this._scheduleLogoSave());

    const inpLogoPadRight = document.createElement("input");
    inpLogoPadRight.type = "number";
    inpLogoPadRight.min = "0";
    inpLogoPadRight.max = "80";
    inpLogoPadRight.step = "1";
    inpLogoPadRight.style.width = "100%";
    inpLogoPadRight.addEventListener("input", () => this._scheduleLogoSave());

    const inpLogoPosition = document.createElement("select");
    inpLogoPosition.style.width = "100%";
    const optLogoPosLeft = document.createElement("option");
    optLogoPosLeft.value = "left";
    optLogoPosLeft.textContent = "Links";
    const optLogoPosRight = document.createElement("option");
    optLogoPosRight.value = "right";
    optLogoPosRight.textContent = "Rechts";
    inpLogoPosition.append(optLogoPosLeft, optLogoPosRight);
    inpLogoPosition.addEventListener("change", () => this._scheduleLogoSave());

    const inpLogoEnabled = document.createElement("input");
    inpLogoEnabled.type = "checkbox";
    inpLogoEnabled.addEventListener("change", () => this._scheduleLogoSave());
    const logoEnabledWrap = document.createElement("div");
    logoEnabledWrap.style.display = "flex";
    logoEnabledWrap.style.alignItems = "center";
    logoEnabledWrap.append(inpLogoEnabled);

    logoBox.append(
      logoTitle,
      mkRow("Logo-Hoehe (px)", inpLogoSize),
      mkRow("Abstand links (px)", inpLogoPadLeft),
      mkRow("Abstand oben (px)", inpLogoPadTop),
      mkRow("Abstand rechts (px)", inpLogoPadRight),
      mkRow("Position", inpLogoPosition),
      mkRow("Logo anzeigen", logoEnabledWrap)
    );

    const TOPS_TITLE_KEY = "tops.titleMax";
    const TOPS_LONG_KEY = "tops.longMax";
    const TRIAL_DAYS_KEY = "trial.daysLimit";
    const TRIAL_ENABLED_KEY = "trial.enabled";
    const TOPS_FONT_LIST_KEY = "tops.fontscale.list";
    const TOPS_FONT_EDIT_KEY = "tops.fontscale.editbox";
    const AUDIO_WHISPER_QUALITY_KEY = "audio.whisper.quality";
    const PRINT_V2_PAD_LEFT_KEY = "print.v2.pagePadLeftMm";
    const PRINT_V2_PAD_RIGHT_KEY = "print.v2.pagePadRightMm";
    const PRINT_V2_PAD_TOP_KEY = "print.v2.pagePadTopMm";
    const PRINT_V2_PAD_BOTTOM_KEY = "print.v2.pagePadBottomMm";
    const PRINT_V2_FOOTER_RESERVE_KEY = "print.v2.footerReserveMm";

    const topsLimitBox = document.createElement("div");
    applyPopupCardStyle(topsLimitBox);
    topsLimitBox.style.padding = "8px 10px";
    topsLimitBox.style.maxWidth = "720px";
    topsLimitBox.style.marginTop = "10px";
    const topsLimitTitle = document.createElement("div");
    topsLimitTitle.textContent = "Einstellung TOP-Liste";
    topsLimitTitle.style.fontWeight = "bold";
    topsLimitTitle.style.marginBottom = "6px";

    const inpTopsTitleMax = document.createElement("input");
    inpTopsTitleMax.type = "number";
    inpTopsTitleMax.min = "1";
    inpTopsTitleMax.step = "1";
    inpTopsTitleMax.style.width = "100%";

    const inpTopsLongMax = document.createElement("input");
    inpTopsLongMax.type = "number";
    inpTopsLongMax.min = "1";
    inpTopsLongMax.step = "1";
    inpTopsLongMax.style.width = "100%";


    const topsLimitMsg = document.createElement("div");
    topsLimitMsg.style.fontSize = "12px";
    topsLimitMsg.style.opacity = "0.75";
    topsLimitMsg.style.marginTop = "4px";

    let topsLimitMsgTimer = null;
    const setTopsLimitMsg = (txt) => {
      topsLimitMsg.textContent = txt || "";
      if (topsLimitMsgTimer) clearTimeout(topsLimitMsgTimer);
      if (txt) {
        topsLimitMsgTimer = setTimeout(() => {
          topsLimitMsg.textContent = "";
        }, 900);
      }
    };

    const clampInt = (val, min, max, fallback) => {
      const n = Math.floor(Number(val));
      if (!Number.isFinite(n) || n <= 0) return fallback;
      return Math.max(min, Math.min(max, n));
    };

    const isValidInt = (val) => {
      const n = Math.floor(Number(val));
      return Number.isFinite(n) && n > 0;
    };

    const clampNonNegativeInt = (val, min, max, fallback) => {
      const n = Math.floor(Number(val));
      if (!Number.isFinite(n) || n < 0) return fallback;
      return Math.max(min, Math.min(max, n));
    };

    const isValidNonNegativeInt = (val) => {
      const n = Math.floor(Number(val));
      return Number.isFinite(n) && n >= 0;
    };

    const loadTopLimitSettings = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsGetMany !== "function") {
        topsLimitMsg.textContent = "Settings-API fehlt (IPC noch nicht aktiv).";
        inpTopsTitleMax.value = "100";
        inpTopsLongMax.value = "500";
        return;
      }
      const res = await api.appSettingsGetMany([TOPS_TITLE_KEY, TOPS_LONG_KEY]);
      if (!res?.ok) {
        topsLimitMsg.textContent = res?.error || "Fehler beim Laden der TOP-Grenzen";
        inpTopsTitleMax.value = "100";
        inpTopsLongMax.value = "500";
        return;
      }
      const data = res.data || {};
      const titleMax = clampInt(data[TOPS_TITLE_KEY], 1, 5000, 100);
      const longMax = clampInt(data[TOPS_LONG_KEY], 1, 20000, 500);
      inpTopsTitleMax.value = String(titleMax);
      inpTopsLongMax.value = String(longMax);
      topsLimitMsg.textContent = "";
    };

    const saveTopLimitSettings = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsSetMany !== "function") {
        topsLimitMsg.textContent = "Settings-API fehlt (IPC noch nicht aktiv).";
        return false;
      }
      const titleValid = isValidInt(inpTopsTitleMax.value);
      const longValid = isValidInt(inpTopsLongMax.value);
      const titleMax = clampInt(inpTopsTitleMax.value, 1, 5000, 100);
      const longMax = clampInt(inpTopsLongMax.value, 1, 20000, 500);
      inpTopsTitleMax.value = String(titleMax);
      inpTopsLongMax.value = String(longMax);

      const res = await api.appSettingsSetMany({
        [TOPS_TITLE_KEY]: String(titleMax),
        [TOPS_LONG_KEY]: String(longMax),
      });
      if (!res?.ok) {
        topsLimitMsg.textContent = res?.error || "Speichern fehlgeschlagen";
        return false;
      }
      if (!titleValid || !longValid) {
        setTopsLimitMsg("Ungültiger Wert – Standard wurde verwendet.");
      } else {
        setTopsLimitMsg("Gespeichert");
      }
      window.dispatchEvent(new Event("bbm:tops-limits-changed"));
      return true;
    };

    inpTopsTitleMax.addEventListener("change", () => saveTopLimitSettings());
    inpTopsLongMax.addEventListener("change", () => saveTopLimitSettings());

    const topsRowShort = mkRow("Kurztext max", inpTopsTitleMax);
    topsRowShort.style.marginBottom = "6px";
    const topsRowLong = mkRow("Langtext max", inpTopsLongMax);
    topsRowLong.style.marginBottom = "4px";
    topsLimitBox.append(topsLimitTitle, topsRowShort, topsRowLong, topsLimitMsg);

    const trialBox = document.createElement("div");
    applyPopupCardStyle(trialBox);
    trialBox.style.padding = "8px 10px";
    trialBox.style.maxWidth = "720px";
    trialBox.style.marginTop = "0";
    trialBox.style.boxSizing = "border-box";

    const trialTitle = document.createElement("div");
    trialTitle.textContent = "Testversion";
    trialTitle.style.fontWeight = "bold";
    trialTitle.style.marginBottom = "6px";

    const trialEnabled = document.createElement("input");
    trialEnabled.type = "checkbox";
    trialEnabled.checked = false;

    const trialEnabledWrap = document.createElement("div");
    trialEnabledWrap.style.display = "flex";
    trialEnabledWrap.style.alignItems = "center";
    trialEnabledWrap.style.gap = "8px";

    const trialEnabledLabel = document.createElement("div");
    trialEnabledLabel.textContent = "Nutzungstage-Limit aktiv";
    trialEnabledWrap.append(trialEnabled, trialEnabledLabel);

    const inpTrialDays = document.createElement("input");
    inpTrialDays.type = "number";
    inpTrialDays.min = "0";
    inpTrialDays.step = "1";
    inpTrialDays.style.width = "100%";

    const trialStatus = document.createElement("div");
    trialStatus.style.fontSize = "12px";
    trialStatus.style.opacity = "0.75";
    trialStatus.style.marginTop = "4px";

    const loadTrialSettings = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsGetMany !== "function") {
        trialEnabled.checked = false;
        inpTrialDays.value = "0";
        inpTrialDays.disabled = true;
        inpTrialDays.style.opacity = "0.55";
        return;
      }
      const res = await api.appSettingsGetMany([TRIAL_ENABLED_KEY, TRIAL_DAYS_KEY]);
      if (!res?.ok) {
        trialEnabled.checked = false;
        inpTrialDays.value = "0";
        inpTrialDays.disabled = true;
        inpTrialDays.style.opacity = "0.55";
        return;
      }
      const data = res.data || {};
      const enabledRaw = String(data[TRIAL_ENABLED_KEY] || "").trim().toLowerCase();
      const enabled = enabledRaw === "1" || enabledRaw === "true" || enabledRaw === "yes" || enabledRaw === "on";
      const trialDays = clampNonNegativeInt(data[TRIAL_DAYS_KEY], 0, 3650, 0);
      trialEnabled.checked = enabled;
      inpTrialDays.value = String(trialDays);
      inpTrialDays.disabled = !enabled;
      inpTrialDays.style.opacity = enabled ? "1" : "0.55";
      trialStatus.textContent = "";
    };

    const saveTrialSettings = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsSetMany !== "function") {
        trialStatus.textContent = "Settings-API fehlt (IPC noch nicht aktiv).";
        return false;
      }
      const valid = isValidNonNegativeInt(inpTrialDays.value);
      const trialDays = clampNonNegativeInt(inpTrialDays.value, 0, 3650, 0);
      inpTrialDays.value = String(trialDays);
      const res = await api.appSettingsSetMany({
        [TRIAL_ENABLED_KEY]: trialEnabled.checked ? "1" : "0",
        [TRIAL_DAYS_KEY]: String(trialDays),
      });
      if (!res?.ok) {
        trialStatus.textContent = res?.error || "Speichern fehlgeschlagen";
        return false;
      }
      trialStatus.textContent = valid ? "Gespeichert" : "Ung?ltiger Wert ? Standard wurde verwendet.";
      return true;
    };

    trialEnabled.addEventListener("change", async () => {
      inpTrialDays.disabled = !trialEnabled.checked;
      inpTrialDays.style.opacity = trialEnabled.checked ? "1" : "0.55";
      await saveTrialSettings();
    });
    inpTrialDays.addEventListener("change", async () => {
      if (!trialEnabled.checked) return;
      await saveTrialSettings();
    });

    const trialRowDays = mkRow("Nutzungstage (0 = aus)", inpTrialDays);
    trialRowDays.style.marginBottom = "4px";

    trialBox.append(trialTitle, trialEnabledWrap, trialRowDays, trialStatus);


    const printV2LayoutBox = document.createElement("div");
    applyPopupCardStyle(printV2LayoutBox);
    printV2LayoutBox.style.padding = "8px 10px";
    printV2LayoutBox.style.width = "320px";
    printV2LayoutBox.style.maxWidth = "320px";
    printV2LayoutBox.style.minWidth = "260px";
    printV2LayoutBox.style.marginTop = "0";
    printV2LayoutBox.style.boxSizing = "border-box";

    const printV2LayoutHint = document.createElement("div");
    printV2LayoutHint.textContent = "Seitenraender + Footer-Reserve in mm.";

    const DEFAULT_PRINT_LAYOUT = { topMm: 3, leftMm: 19, rightMm: 15 };
    const DEFAULT_PRINT_FOOTER_RESERVE = 12;
    printV2LayoutHint.style.fontSize = "12px";
    printV2LayoutHint.style.opacity = "0.75";
    printV2LayoutHint.style.marginBottom = "6px";

    const printV2LayoutDefaultsInfo = document.createElement("div");
    printV2LayoutDefaultsInfo.textContent =
      `Default: oben ${DEFAULT_PRINT_LAYOUT.topMm} mm, links ${DEFAULT_PRINT_LAYOUT.leftMm} mm, rechts ${DEFAULT_PRINT_LAYOUT.rightMm} mm, Footer-Reserve ${DEFAULT_PRINT_FOOTER_RESERVE} mm`;
    printV2LayoutDefaultsInfo.style.fontSize = "12px";
    printV2LayoutDefaultsInfo.style.opacity = "0.75";
    printV2LayoutDefaultsInfo.style.marginBottom = "6px";

    const mkLayoutInput = () => {
      const input = document.createElement("input");
      input.type = "number";
      input.style.width = "2cm";
      input.style.padding = "4px";
      input.style.boxSizing = "border-box";
      input.style.marginRight = "4px";
      return input;
    };

    const inpPrintV2PadLeft = mkLayoutInput();
    inpPrintV2PadLeft.min = "0";
    inpPrintV2PadLeft.max = "30";
    inpPrintV2PadLeft.step = "0.5";

    const inpPrintV2PadRight = mkLayoutInput();
    inpPrintV2PadRight.min = "0";
    inpPrintV2PadRight.max = "30";
    inpPrintV2PadRight.step = "0.5";

    const inpPrintV2PadTop = mkLayoutInput();
    inpPrintV2PadTop.min = "0";
    inpPrintV2PadTop.max = "40";
    inpPrintV2PadTop.step = "0.5";

    const inpPrintV2PadBottom = mkLayoutInput();
    inpPrintV2PadBottom.min = "0";
    inpPrintV2PadBottom.max = "40";
    inpPrintV2PadBottom.step = "0.5";

    const inpPrintV2FooterReserve = mkLayoutInput();
    inpPrintV2FooterReserve.min = "0";
    inpPrintV2FooterReserve.max = "30";
    inpPrintV2FooterReserve.step = "0.5";

    const printV2LayoutMsg = document.createElement("div");
    printV2LayoutMsg.style.fontSize = "12px";
    printV2LayoutMsg.style.opacity = "0.75";
    printV2LayoutMsg.style.marginTop = "4px";

    const clampMm = (val, min, max, fallback) => {
      const n = Number(val);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
    };

    const loadPrintV2LayoutSettings = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsGetMany !== "function") {
        printV2LayoutMsg.textContent = "Settings-API fehlt (IPC noch nicht aktiv).";
        return;
      }
      const res = await api.appSettingsGetMany([
        PRINT_V2_PAD_LEFT_KEY,
        PRINT_V2_PAD_RIGHT_KEY,
        PRINT_V2_PAD_TOP_KEY,
        PRINT_V2_PAD_BOTTOM_KEY,
        PRINT_V2_FOOTER_RESERVE_KEY,
      ]);
      if (!res?.ok) {
        printV2LayoutMsg.textContent = res?.error || "Fehler beim Laden der Druck-Raender";
        return;
      }
      const data = res.data || {};
      inpPrintV2PadLeft.value = String(
        clampMm(data[PRINT_V2_PAD_LEFT_KEY], 0, 30, DEFAULT_PRINT_LAYOUT.leftMm)
      );
      inpPrintV2PadRight.value = String(
        clampMm(data[PRINT_V2_PAD_RIGHT_KEY], 0, 30, DEFAULT_PRINT_LAYOUT.rightMm)
      );
      inpPrintV2PadTop.value = String(
        clampMm(data[PRINT_V2_PAD_TOP_KEY], 0, 40, DEFAULT_PRINT_LAYOUT.topMm)
      );
      inpPrintV2PadBottom.value = String(clampMm(data[PRINT_V2_PAD_BOTTOM_KEY], 0, 40, 18));
      inpPrintV2FooterReserve.value = String(
        clampMm(data[PRINT_V2_FOOTER_RESERVE_KEY], 0, 30, DEFAULT_PRINT_FOOTER_RESERVE)
      );
      printV2LayoutMsg.textContent = "";
    };

    const savePrintV2LayoutSettings = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsSetMany !== "function") {
        printV2LayoutMsg.textContent = "Settings-API fehlt (IPC noch nicht aktiv).";
        return false;
      }
      const padLeft = clampMm(inpPrintV2PadLeft.value, 0, 30, DEFAULT_PRINT_LAYOUT.leftMm);
      const padRight = clampMm(inpPrintV2PadRight.value, 0, 30, DEFAULT_PRINT_LAYOUT.rightMm);
      const padTop = clampMm(inpPrintV2PadTop.value, 0, 40, DEFAULT_PRINT_LAYOUT.topMm);
      const padBottom = clampMm(inpPrintV2PadBottom.value, 0, 40, 18);
      const footerReserve = clampMm(
        inpPrintV2FooterReserve.value,
        0,
        30,
        DEFAULT_PRINT_FOOTER_RESERVE
      );
      inpPrintV2PadLeft.value = String(padLeft);
      inpPrintV2PadRight.value = String(padRight);
      inpPrintV2PadTop.value = String(padTop);
      inpPrintV2PadBottom.value = String(padBottom);
      inpPrintV2FooterReserve.value = String(footerReserve);
      const payload = {
        [PRINT_V2_PAD_LEFT_KEY]: String(padLeft),
        [PRINT_V2_PAD_RIGHT_KEY]: String(padRight),
        [PRINT_V2_PAD_TOP_KEY]: String(padTop),
        [PRINT_V2_PAD_BOTTOM_KEY]: String(padBottom),
        [PRINT_V2_FOOTER_RESERVE_KEY]: String(footerReserve),
        ...this._buildTouchedPayloadForKeys(PRINT_LAYOUT_TOUCHED_KEYS),
      };
      const res = await api.appSettingsSetMany(payload);
      if (!res?.ok) {
        printV2LayoutMsg.textContent = res?.error || "Speichern fehlgeschlagen";
        return false;
      }
      printV2LayoutMsg.textContent = "Gespeichert";
      return true;
    };

    inpPrintV2PadLeft.addEventListener("change", () => savePrintV2LayoutSettings());
    inpPrintV2PadRight.addEventListener("change", () => savePrintV2LayoutSettings());
    inpPrintV2PadTop.addEventListener("change", () => savePrintV2LayoutSettings());
    inpPrintV2PadBottom.addEventListener("change", () => savePrintV2LayoutSettings());
    inpPrintV2FooterReserve.addEventListener("change", () => savePrintV2LayoutSettings());

    const btnDefaultLayout = document.createElement("button");
    btnDefaultLayout.type = "button";
    btnDefaultLayout.textContent = "default";
    applyPopupButtonStyle(btnDefaultLayout);
    btnDefaultLayout.style.marginTop = "4px";
    btnDefaultLayout.onclick = async () => {
      inpPrintV2PadLeft.value = String(DEFAULT_PRINT_LAYOUT.leftMm);
      inpPrintV2PadRight.value = String(DEFAULT_PRINT_LAYOUT.rightMm);
      inpPrintV2PadTop.value = String(DEFAULT_PRINT_LAYOUT.topMm);
      inpPrintV2FooterReserve.value = String(DEFAULT_PRINT_FOOTER_RESERVE);
      await savePrintV2LayoutSettings();
    };

    const actionsRow = document.createElement("div");
    actionsRow.style.display = "flex";
    actionsRow.style.justifyContent = "flex-end";
    actionsRow.style.gap = "4px";
    actionsRow.appendChild(btnDefaultLayout);

    printV2LayoutBox.append(
      printV2LayoutHint,
      printV2LayoutDefaultsInfo,
      mkRow("Rand links (mm)", inpPrintV2PadLeft),
      mkRow("Rand rechts (mm)", inpPrintV2PadRight),
      mkRow("Rand oben (mm)", inpPrintV2PadTop),
      mkRow("Rand unten (mm)", inpPrintV2PadBottom),
      mkRow("Footer-Reserve (mm)", inpPrintV2FooterReserve),
      actionsRow,
      printV2LayoutMsg
    );

    const fontScaleBox = document.createElement("div");
    applyPopupCardStyle(fontScaleBox);
    fontScaleBox.style.padding = "8px 10px";
    fontScaleBox.style.maxWidth = "720px";
    fontScaleBox.style.marginTop = "0";
    fontScaleBox.style.width = "calc(100% - 1cm)";
    fontScaleBox.style.justifySelf = "end";
    fontScaleBox.style.marginLeft = "auto";

    const fontScaleTitle = document.createElement("div");
    fontScaleTitle.textContent = "Top-Liste (Schriftgrößen)";
    fontScaleTitle.style.fontWeight = "bold";
    fontScaleTitle.style.marginBottom = "6px";

    const fontScaleMsg = document.createElement("div");
    fontScaleMsg.style.fontSize = "12px";
    fontScaleMsg.style.opacity = "0.75";
    fontScaleMsg.style.marginTop = "4px";

    let fontScaleMsgTimer = null;
    const setFontScaleMsg = (txt) => {
      fontScaleMsg.textContent = txt || "";
      if (fontScaleMsgTimer) clearTimeout(fontScaleMsgTimer);
      if (txt) {
        fontScaleMsgTimer = setTimeout(() => {
          fontScaleMsg.textContent = "";
        }, 900);
      }
    };

    let listScale = "medium";
    let editScale = "small";

    const mkScaleGroup = (labelText, buttons) => {
      const wrap = document.createElement("div");
      wrap.style.display = "grid";
      wrap.style.gridTemplateColumns = "140px 1fr";
      wrap.style.alignItems = "center";
      wrap.style.gap = "8px";

      const lab = document.createElement("div");
      lab.textContent = labelText;
      lab.style.fontWeight = "600";

      const btnRow = document.createElement("div");
      btnRow.style.display = "flex";
      btnRow.style.gap = "8px";
      for (const b of buttons) btnRow.append(b);

      wrap.append(lab, btnRow);
      return wrap;
    };

    const applyScaleBtnBase = (btn) => {
      btn.type = "button";
      btn.style.padding = "5px 8px";
      btn.style.borderRadius = "8px";
      btn.style.border = "1px solid rgba(0,0,0,0.18)";
      btn.style.cursor = "pointer";
      btn.style.minHeight = "24px";
      btn.style.boxShadow = "none";
      btn.style.transition = "background 120ms ease, box-shadow 120ms ease, border-color 120ms ease";
    };

    const setScaleBtnActive = (btn, active) => {
      btn.style.background = active ? "#ef6c00" : "#f7f7f7";
      btn.style.color = active ? "#fff" : "#1f1f1f";
      btn.style.borderColor = active ? "rgba(239,108,0,0.7)" : "rgba(0,0,0,0.18)";
      btn.style.boxShadow = active ? "0 1px 0 rgba(0,0,0,0.12)" : "none";
    };

    const btnListSmall = document.createElement("button");
    btnListSmall.textContent = "klein";
    applyScaleBtnBase(btnListSmall);
    const btnListMedium = document.createElement("button");
    btnListMedium.textContent = "mittel";
    applyScaleBtnBase(btnListMedium);
    const btnListLarge = document.createElement("button");
    btnListLarge.textContent = "groß";
    applyScaleBtnBase(btnListLarge);

    const btnEditSmall = document.createElement("button");
    btnEditSmall.textContent = "klein";
    applyScaleBtnBase(btnEditSmall);
    const btnEditLarge = document.createElement("button");
    btnEditLarge.textContent = "groß";
    applyScaleBtnBase(btnEditLarge);

    const applyFontScaleUi = () => {
      setScaleBtnActive(btnListSmall, listScale === "small");
      setScaleBtnActive(btnListMedium, listScale === "medium");
      setScaleBtnActive(btnListLarge, listScale === "large");
      setScaleBtnActive(btnEditSmall, editScale === "small");
      setScaleBtnActive(btnEditLarge, editScale === "large");
    };

    const loadFontScaleSettings = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsGetMany !== "function") {
        fontScaleMsg.textContent = "Settings-API fehlt (IPC noch nicht aktiv).";
        applyFontScaleUi();
        return;
      }
      const res = await api.appSettingsGetMany([TOPS_FONT_LIST_KEY, TOPS_FONT_EDIT_KEY]);
      if (!res?.ok) {
        fontScaleMsg.textContent = res?.error || "Fehler beim Laden der Schriftgrößen";
        applyFontScaleUi();
        return;
      }
      const data = res.data || {};
      const listRaw = String(data[TOPS_FONT_LIST_KEY] || "").trim().toLowerCase();
      const editRaw = String(data[TOPS_FONT_EDIT_KEY] || "").trim().toLowerCase();
      listScale = ["small", "medium", "large"].includes(listRaw) ? listRaw : "medium";
      editScale = ["small", "large"].includes(editRaw) ? editRaw : "small";
      fontScaleMsg.textContent = "";
      applyFontScaleUi();
    };

    const saveFontScaleSettings = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsSetMany !== "function") {
        fontScaleMsg.textContent = "Settings-API fehlt (IPC noch nicht aktiv).";
        return false;
      }
      const res = await api.appSettingsSetMany({
        [TOPS_FONT_LIST_KEY]: listScale,
        [TOPS_FONT_EDIT_KEY]: editScale,
      });
      if (!res?.ok) {
        fontScaleMsg.textContent = res?.error || "Speichern fehlgeschlagen";
        return false;
      }
      setFontScaleMsg("Gespeichert");
      window.dispatchEvent(new Event("bbm:tops-fontscale-changed"));
      return true;
    };

    btnListSmall.onclick = async () => {
      listScale = "small";
      applyFontScaleUi();
      await saveFontScaleSettings();
    };
    btnListMedium.onclick = async () => {
      listScale = "medium";
      applyFontScaleUi();
      await saveFontScaleSettings();
    };
    btnListLarge.onclick = async () => {
      listScale = "large";
      applyFontScaleUi();
      await saveFontScaleSettings();
    };

    btnEditSmall.onclick = async () => {
      editScale = "small";
      applyFontScaleUi();
      await saveFontScaleSettings();
    };
    btnEditLarge.onclick = async () => {
      editScale = "large";
      applyFontScaleUi();
      await saveFontScaleSettings();
    };

    const rowList = mkScaleGroup("Top-Liste", [btnListSmall, btnListMedium, btnListLarge]);
    const rowEdit = mkScaleGroup("Editbox", [btnEditSmall, btnEditLarge]);
    rowList.style.marginBottom = "8px";

    fontScaleBox.append(fontScaleTitle, rowList, rowEdit, fontScaleMsg);

    const whisperBox = document.createElement("div");
    applyPopupCardStyle(whisperBox);
    whisperBox.style.padding = "6px 8px";
    whisperBox.style.maxWidth = "680px";
    whisperBox.style.marginTop = "0";
    whisperBox.style.width = "calc(100% - 8mm)";
    whisperBox.style.justifySelf = "end";
    whisperBox.style.marginLeft = "auto";

    const whisperTitle = document.createElement("div");
    whisperTitle.textContent = "Spracherkennung (Qualit?t)";
    whisperTitle.style.fontWeight = "bold";
    whisperTitle.style.marginBottom = "4px";
    whisperTitle.style.fontSize = "13px";

    const whisperMsg = document.createElement("div");
    whisperMsg.style.fontSize = "11px";
    whisperMsg.style.opacity = "0.75";
    whisperMsg.style.marginTop = "2px";

    let whisperQuality = "fast";
    let whisperModels = {
      fast: { available: true },
      balanced: { available: true },
      best: { available: true },
      large: { available: true },
    };

    let allowLarge = true;


    const btnWhisperFast = document.createElement("button");
    btnWhisperFast.textContent = "Schnell";
    applyScaleBtnBase(btnWhisperFast);
    const btnWhisperBalanced = document.createElement("button");
    btnWhisperBalanced.textContent = "Ausgewogen";
    applyScaleBtnBase(btnWhisperBalanced);
    const btnWhisperBest = document.createElement("button");
    btnWhisperBest.textContent = "Beste Qualit?t";
    applyScaleBtnBase(btnWhisperBest);
    const btnWhisperLarge = document.createElement("button");
    btnWhisperLarge.textContent = "Large";
    applyScaleBtnBase(btnWhisperLarge);

    const setWhisperBtnEnabled = (btn, enabled) => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? "1" : "0.55";
      btn.style.cursor = enabled ? "pointer" : "default";
      btn.title = enabled ? "" : "Modell nicht installiert";
    };

    const applyWhisperUi = () => {
      const fastAvailable = !!whisperModels.fast?.available;
      const balancedAvailable = !!whisperModels.balanced?.available;
      const bestAvailable = !!whisperModels.best?.available;
      const largeAvailable = !!whisperModels.large?.available;

      setScaleBtnActive(btnWhisperFast, whisperQuality === "fast" && fastAvailable);
      setScaleBtnActive(btnWhisperBalanced, whisperQuality === "balanced" && balancedAvailable);
      setScaleBtnActive(btnWhisperBest, whisperQuality === "best" && bestAvailable);
      setScaleBtnActive(btnWhisperLarge, whisperQuality === "large" && largeAvailable);
      setWhisperBtnEnabled(btnWhisperFast, fastAvailable);
      setWhisperBtnEnabled(btnWhisperBalanced, balancedAvailable);
      setWhisperBtnEnabled(btnWhisperBest, bestAvailable);
      setWhisperBtnEnabled(btnWhisperLarge, largeAvailable);
      const current = whisperModels[whisperQuality];
      if (current && current.available) {
        whisperMsg.textContent = "";
      } else {
        whisperMsg.textContent =
          (current && current.missingReason) || "Modell nicht installiert.";
      }
    };

    const loadWhisperQualitySettings = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsGetMany === "function") {
        const res = await api.appSettingsGetMany([AUDIO_WHISPER_QUALITY_KEY]);
        if (res?.ok) {
          const raw = String(res.data?.[AUDIO_WHISPER_QUALITY_KEY] || "").trim().toLowerCase();
          whisperQuality = ["fast", "balanced", "best", "large"].includes(raw) ? raw : "fast";
        }
      }
      if (typeof api.audioWhisperModelsStatus === "function") {
        const res = await api.audioWhisperModelsStatus();
        if (res?.ok && res.models) whisperModels = res.models;
      }
      applyWhisperUi();
    };

    const saveWhisperQualitySettings = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsSetMany !== "function") {
        whisperMsg.textContent = "Settings-API fehlt (IPC noch nicht aktiv).";
        return false;
      }
      const res = await api.appSettingsSetMany({
        [AUDIO_WHISPER_QUALITY_KEY]: whisperQuality,
      });
      if (!res?.ok) {
        whisperMsg.textContent = res?.error || "Speichern fehlgeschlagen";
        return false;
      }
      whisperMsg.textContent = "Gespeichert";
      setTimeout(() => {
        if (whisperMsg.textContent === "Gespeichert") whisperMsg.textContent = "";
      }, 900);
      return true;
    };

    btnWhisperFast.onclick = async () => {
      if (!whisperModels.fast?.available) return;
      whisperQuality = "fast";
      applyWhisperUi();
      await saveWhisperQualitySettings();
    };
    btnWhisperBalanced.onclick = async () => {
      if (!whisperModels.balanced?.available) return;
      whisperQuality = "balanced";
      applyWhisperUi();
      await saveWhisperQualitySettings();
    };
    btnWhisperBest.onclick = async () => {
      if (!whisperModels.best?.available) return;
      whisperQuality = "best";
      applyWhisperUi();
      await saveWhisperQualitySettings();
    };
    btnWhisperLarge.onclick = async () => {
      if (!whisperModels.large?.available) return;
      whisperQuality = "large";
      applyWhisperUi();
      await saveWhisperQualitySettings();
    };

    const whisperRow = mkScaleGroup("Modell", [btnWhisperFast, btnWhisperBalanced, btnWhisperBest, btnWhisperLarge]);
    whisperBox.append(whisperTitle, whisperRow, whisperMsg);

    const devTopCardsRow = document.createElement("div");
    devTopCardsRow.style.display = "grid";
    devTopCardsRow.style.gridTemplateColumns = "minmax(0, 1fr) minmax(0, 1fr)";
    devTopCardsRow.style.gap = "12px";
    devTopCardsRow.style.alignItems = "start";
    devTopCardsRow.style.width = "100%";
    devTopCardsRow.style.maxWidth = "720px";
    devTopCardsRow.style.marginTop = "10px";

    topsLimitBox.style.maxWidth = "none";
    topsLimitBox.style.width = "100%";
    topsLimitBox.style.marginTop = "0";
    topsLimitBox.style.boxSizing = "border-box";
    topsLimitBox.style.alignSelf = "start";

    const devRightCol = document.createElement("div");
    devRightCol.style.display = "grid";
    devRightCol.style.gridTemplateColumns = "1fr";
    devRightCol.style.gap = "10px";
    devRightCol.style.alignContent = "start";
    const versionBox = document.createElement("div");
    applyPopupCardStyle(versionBox);
    versionBox.style.padding = "8px 10px";
    versionBox.style.maxWidth = "720px";
    versionBox.style.marginTop = "0";
    versionBox.style.display = "none";

    const versionTitle = document.createElement("div");
    versionTitle.textContent = "Versionierung";
    versionTitle.style.fontWeight = "bold";
    versionTitle.style.marginBottom = "6px";

    const versionHint = document.createElement("div");
    versionHint.textContent = "SemVer fuer den naechsten Build aus package.json.";

    // Build-Kanal (STABLE/DEV) fuer `npm run dist`
    const buildChannelBox = document.createElement("div");
    buildChannelBox.style.display = "grid";
    buildChannelBox.style.gridTemplateColumns = "1fr";
    buildChannelBox.style.gap = "6px";
    buildChannelBox.style.padding = "8px 10px";
    buildChannelBox.style.border = "1px solid var(--card-border)";
    buildChannelBox.style.borderRadius = "8px";
    buildChannelBox.style.background = "var(--card-bg)";

    const buildChannelTitle = document.createElement("div");
    buildChannelTitle.textContent = "Build-Kanal (npm run dist)";
    buildChannelTitle.style.fontWeight = "700";

    const buildChannelHint = document.createElement("div");
    buildChannelHint.style.fontSize = "12px";
    buildChannelHint.style.opacity = "0.8";
    buildChannelHint.textContent = "Damit du es mit Augen siehst: DEV baut BBM-DEV-... und zeigt DEV-Badge in der App.";

    const buildChannelRow = document.createElement("div");
    buildChannelRow.style.display = "flex";
    buildChannelRow.style.alignItems = "center";
    buildChannelRow.style.gap = "12px";
    buildChannelRow.style.flexWrap = "wrap";

    const mkRadio = (label, value) => {
      const wrap = document.createElement("label");
      wrap.style.display = "inline-flex";
      wrap.style.alignItems = "center";
      wrap.style.gap = "6px";
      wrap.style.cursor = "pointer";
      wrap.style.userSelect = "none";
      const inp = document.createElement("input");
      inp.type = "radio";
      inp.name = "bbmBuildChannel";
      inp.value = value;
      const txt = document.createElement("span");
      txt.textContent = label;
      txt.style.fontSize = "13px";
      txt.style.fontWeight = "600";
      wrap.append(inp, txt);
      return { wrap, inp };
    };

    const radioStable = mkRadio("STABLE", "stable");
    const radioDev = mkRadio("DEV", "dev");
    buildChannelRow.append(radioStable.wrap, radioDev.wrap);

    const buildChannelStatus = document.createElement("div");
    buildChannelStatus.style.fontSize = "12px";
    buildChannelStatus.style.opacity = "0.9";
    buildChannelStatus.textContent = "Lade...";

    buildChannelBox.append(buildChannelTitle, buildChannelHint, buildChannelRow, buildChannelStatus);

    let buildChannelCurrent = "stable";

    const setBuildChannelUi = (ch, repoVersionForPreview = "") => {
      const next = String(ch || "stable").trim().toLowerCase() === "dev" ? "dev" : "stable";
      buildChannelCurrent = next;
      radioStable.inp.checked = next === "stable";
      radioDev.inp.checked = next === "dev";
      const v = String(repoVersionForPreview || versionRepoCurrent || "").trim();
      const fileName = next === "dev"
        ? `BBM-DEV-${v || "X.Y.Z"}-Setup.exe`
        : `BBM-${v || "X.Y.Z"}-Setup.exe`;
      buildChannelStatus.textContent = `npm run dist baut: ${next === "dev" ? "DEV" : "STABLE"}  ->  ${fileName}`;
    };

    const loadBuildChannel = async () => {
      const api = window.bbmDb || {};
      if (typeof api.devBuildChannelGet !== "function") {
        // fallback: ENV/IPC app:getBuildChannel, aber hier im Dev-Popup lieber klar sagen
        buildChannelStatus.textContent = "Build-Kanal: nicht verfuegbar (devBuildChannelGet fehlt).";
        return false;
      }
      try {
        const res = await api.devBuildChannelGet();
        if (!res?.ok) {
          buildChannelStatus.textContent = res?.error || "Build-Kanal konnte nicht geladen werden.";
          return false;
        }
        setBuildChannelUi(res.channel, versionRepoCurrent);
        return true;
      } catch (_e) {
        buildChannelStatus.textContent = "Build-Kanal konnte nicht geladen werden.";
        return false;
      }
    };

    const saveBuildChannel = async (next) => {
      const api = window.bbmDb || {};
      if (typeof api.devBuildChannelSet !== "function") {
        alert("Build-Kanal speichern: nicht verfuegbar (devBuildChannelSet fehlt).");
        return false;
      }
      try {
        const res = await api.devBuildChannelSet({ channel: next });
        if (!res?.ok) {
          alert(res?.error || "Build-Kanal konnte nicht gespeichert werden.");
          return false;
        }
        setBuildChannelUi(res.channel, versionRepoCurrent);
        return true;
      } catch (_e) {
        alert("Build-Kanal konnte nicht gespeichert werden.");
        return false;
      }
    };

    radioStable.inp.onchange = async () => {
      if (!radioStable.inp.checked) return;
      await saveBuildChannel("stable");
    };
    radioDev.inp.onchange = async () => {
      if (!radioDev.inp.checked) return;
      await saveBuildChannel("dev");
    };

    versionHint.style.fontSize = "12px";
    versionHint.style.opacity = "0.75";
    versionHint.style.marginBottom = "8px";

    const appVersionValue = document.createElement("div");
    appVersionValue.style.fontWeight = "600";
    appVersionValue.textContent = "-";

    const repoVersionValue = document.createElement("div");
    repoVersionValue.style.fontWeight = "600";
    repoVersionValue.textContent = "-";

    const badgesRow = document.createElement("div");
    badgesRow.style.display = "flex";
    badgesRow.style.flexWrap = "wrap";
    badgesRow.style.gap = "6px";

    const mkBadge = (label) => {
      const badge = document.createElement("span");
      badge.style.display = "inline-flex";
      badge.style.alignItems = "center";
      badge.style.gap = "4px";
      badge.style.padding = "2px 8px";
      badge.style.border = "1px solid #d6dbe3";
      badge.style.borderRadius = "999px";
      badge.style.fontSize = "12px";
      badge.style.background = "#fff";
      badge.textContent = label;
      return badge;
    };
    const badgeMajor = mkBadge("Major: -");
    const badgeMinor = mkBadge("Minor: -");
    const badgePatch = mkBadge("Patch: -");
    badgesRow.append(badgeMajor, badgeMinor, badgePatch);

    const releaseTypeSelect = document.createElement("select");
    releaseTypeSelect.style.width = "100%";
    const releaseOptions = [
      { value: "patch", label: "Fixes (Patch)" },
      { value: "minor", label: "Feature (Minor)" },
      { value: "major", label: "Breaking (Major)" },
    ];
    for (const opt of releaseOptions) {
      const node = document.createElement("option");
      node.value = opt.value;
      node.textContent = opt.label;
      releaseTypeSelect.appendChild(node);
    }

    const nextVersionValue = document.createElement("div");
    nextVersionValue.style.fontWeight = "700";
    nextVersionValue.textContent = "-";

    const versionButtons = document.createElement("div");
    versionButtons.style.display = "flex";
    versionButtons.style.justifyContent = "space-between";
    versionButtons.style.gap = "8px";
    versionButtons.style.flexWrap = "wrap";

    const btnVersionBump = document.createElement("button");
    btnVersionBump.type = "button";
    btnVersionBump.textContent = "Version hochschalten";
    applyPopupButtonStyle(btnVersionBump, { variant: "primary" });

    const btnVersionSet100 = document.createElement("button");
    btnVersionSet100.type = "button";
    btnVersionSet100.textContent = "Auf 1.0.0 setzen";
    applyPopupButtonStyle(btnVersionSet100);
    btnVersionSet100.style.display = "none";

    versionButtons.append(btnVersionBump, btnVersionSet100);

    const versionStatus = document.createElement("div");
    versionStatus.style.fontSize = "12px";
    versionStatus.style.minHeight = "16px";
    versionStatus.style.marginTop = "4px";
    versionStatus.style.color = "#4b5563";

    const versionRestartHint = document.createElement("div");
    versionRestartHint.style.fontSize = "12px";
    versionRestartHint.style.opacity = "0.8";
    versionRestartHint.style.marginTop = "2px";
    versionRestartHint.textContent = "";

    versionBox.append(
      versionTitle,
      versionHint,
      buildChannelBox,
      mkRow("Aktuelle App-Version (laufend)", appVersionValue),
      mkRow("Repo-Version (package.json)", repoVersionValue),
      mkRow("Major / Minor / Patch", badgesRow),
      mkRow("Release-Typ", releaseTypeSelect),
      mkRow("Naechste Version", nextVersionValue),
      versionButtons,
      versionStatus,
      versionRestartHint
    );

    let versionStatusTimer = null;
    let versionRepoCurrent = "";

    const setVersionStatus = (text, isError = false) => {
      if (versionStatusTimer) {
        clearTimeout(versionStatusTimer);
        versionStatusTimer = null;
      }
      versionStatus.textContent = String(text || "");
      versionStatus.style.color = isError ? "#b91c1c" : "#166534";
      if (text) {
        versionStatusTimer = setTimeout(() => {
          versionStatus.textContent = "";
          versionStatus.style.color = "#4b5563";
          versionStatusTimer = null;
        }, 4500);
      }
    };

    const parseSemverLocal = (value) => {
      const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value || "").trim());
      if (!m) return null;
      return {
        major: Number(m[1]),
        minor: Number(m[2]),
        patch: Number(m[3]),
      };
    };

    const formatSemverLocal = (parts) => `${parts.major}.${parts.minor}.${parts.patch}`;

    const bumpSemverLocal = (version, kind) => {
      const parsed = parseSemverLocal(version);
      if (!parsed) return "";
      if (kind === "major") return formatSemverLocal({ major: parsed.major + 1, minor: 0, patch: 0 });
      if (kind === "minor") return formatSemverLocal({ major: parsed.major, minor: parsed.minor + 1, patch: 0 });
      return formatSemverLocal({ major: parsed.major, minor: parsed.minor, patch: parsed.patch + 1 });
    };

    const updateVersionBadges = (version) => {
      const parsed = parseSemverLocal(version);
      if (!parsed) {
        badgeMajor.textContent = "Major: -";
        badgeMinor.textContent = "Minor: -";
        badgePatch.textContent = "Patch: -";
        return;
      }
      badgeMajor.textContent = `Major: ${parsed.major}`;
      badgeMinor.textContent = `Minor: ${parsed.minor}`;
      badgePatch.textContent = `Patch: ${parsed.patch}`;
    };

    const updateNextVersionPreview = () => {
      const next = bumpSemverLocal(versionRepoCurrent, releaseTypeSelect.value);
      nextVersionValue.textContent = next || "-";
      const parsed = parseSemverLocal(versionRepoCurrent);
      btnVersionSet100.style.display = parsed && parsed.major < 1 ? "inline-flex" : "none";
    };

    const setVersionBusy = (busy) => {
      const isBusy = !!busy;
      releaseTypeSelect.disabled = isBusy;
      btnVersionBump.disabled = isBusy;
      btnVersionSet100.disabled = isBusy;
    };

    const loadVersioningData = async () => {
      const api = window.bbmDb || {};
      if (typeof api.devVersionGet !== "function") {
        versionBox.style.display = "none";
        return false;
      }
      setVersionBusy(true);
      try {
        const res = await api.devVersionGet();
        if (!res?.ok) {
          setVersionStatus(res?.error || "Versionen konnten nicht geladen werden.", true);
          versionBox.style.display = "none";
          return false;
        }
        versionRepoCurrent = String(res.repoVersion || "").trim();
        await loadBuildChannel();
        appVersionValue.textContent = String(res.appVersion || "-");
        repoVersionValue.textContent = versionRepoCurrent || "-";
        updateVersionBadges(versionRepoCurrent);
        updateNextVersionPreview();
        versionRestartHint.textContent = "Hinweis: Laufende App-Version aktualisiert sich nach Neustart.";
        versionBox.style.display = "block";
        return true;
      } catch (err) {
        setVersionStatus(err?.message || "Versionen konnten nicht geladen werden.", true);
        versionBox.style.display = "none";
        return false;
      } finally {
        setVersionBusy(false);
      }
    };

    releaseTypeSelect.addEventListener("change", updateNextVersionPreview);

    btnVersionBump.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.devVersionBump !== "function") {
        setVersionStatus("Versionierung ist nicht verfuegbar.", true);
        return;
      }
      setVersionBusy(true);
      try {
        const res = await api.devVersionBump({ kind: releaseTypeSelect.value });
        if (!res?.ok) {
          setVersionStatus(res?.error || "Version konnte nicht hochgeschaltet werden.", true);
          return;
        }
        const reloadOk = await loadVersioningData();
        if (reloadOk) {
          setVersionStatus(`Repo-Version auf ${res.repoVersion} aktualisiert.`);
        }
      } catch (err) {
        setVersionStatus(err?.message || "Version konnte nicht hochgeschaltet werden.", true);
      } finally {
        setVersionBusy(false);
      }
    };

    btnVersionSet100.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.devVersionSet !== "function") {
        setVersionStatus("Versionierung ist nicht verfuegbar.", true);
        return;
      }
      setVersionBusy(true);
      try {
        const res = await api.devVersionSet({ version: "1.0.0" });
        if (!res?.ok) {
          setVersionStatus(res?.error || "Version 1.0.0 konnte nicht gesetzt werden.", true);
          return;
        }
        const reloadOk = await loadVersioningData();
        if (reloadOk) {
          setVersionStatus("Repo-Version auf 1.0.0 gesetzt.");
        }
      } catch (err) {
        setVersionStatus(err?.message || "Version 1.0.0 konnte nicht gesetzt werden.", true);
      } finally {
        setVersionBusy(false);
      }
    };

    const licenseGenBox = document.createElement("div");
    applyPopupCardStyle(licenseGenBox);
    licenseGenBox.style.padding = "8px 10px";
    licenseGenBox.style.display = "grid";
    licenseGenBox.style.gap = "8px";

    const licenseGenTitle = document.createElement("div");
    licenseGenTitle.textContent = "Lizenz verlaengern / bearbeiten";
    licenseGenTitle.style.fontWeight = "700";

    const licenseGenHint = document.createElement("div");
    licenseGenHint.textContent = "Nur fuer den internen Entwicklungsbereich. Bestehende .bbmlic laden, anpassen und ueber C:\\license-tool neu erzeugen.";
    licenseGenHint.style.fontSize = "12px";
    licenseGenHint.style.opacity = "0.8";

    const loadedLicenseInfo = document.createElement("div");
    loadedLicenseInfo.style.fontSize = "12px";
    loadedLicenseInfo.style.lineHeight = "1.35";
    loadedLicenseInfo.style.padding = "8px";
    loadedLicenseInfo.style.borderRadius = "8px";
    loadedLicenseInfo.style.background = "#f8fafc";
    loadedLicenseInfo.style.border = "1px solid rgba(0,0,0,0.08)";
    loadedLicenseInfo.textContent = "Keine bestehende Lizenz geladen.";

    const licenseTemplateWrap = document.createElement("div");
    licenseTemplateWrap.style.display = "flex";
    licenseTemplateWrap.style.flexWrap = "wrap";
    licenseTemplateWrap.style.gap = "8px";

    const licenseTemplateInfo = document.createElement("div");
    licenseTemplateInfo.style.fontSize = "12px";
    licenseTemplateInfo.style.lineHeight = "1.35";
    licenseTemplateInfo.style.padding = "8px";
    licenseTemplateInfo.style.borderRadius = "8px";
    licenseTemplateInfo.style.background = "#fff7ed";
    licenseTemplateInfo.style.border = "1px solid rgba(245, 158, 11, 0.35)";
    licenseTemplateInfo.textContent = "Keine Vorlage aktiv. Du kannst eine Schnellvorlage laden oder alle Felder frei setzen.";

    const inpLicenseProduct = document.createElement("input");
    inpLicenseProduct.type = "text";
    inpLicenseProduct.value = "bbm-protokoll";

    const inpLicenseCustomer = document.createElement("input");
    inpLicenseCustomer.type = "text";
    inpLicenseCustomer.placeholder = "Musterbau GmbH";

    const inpLicenseId = document.createElement("input");
    inpLicenseId.type = "text";
    inpLicenseId.placeholder = "BBM-TEST-0001";
    inpLicenseId.readOnly = false;
    inpLicenseId.disabled = false;

    const btnLicenseIdSuggest = document.createElement("button");
    btnLicenseIdSuggest.type = "button";
    btnLicenseIdSuggest.textContent = "Neue Nummer vorschlagen";
    applyPopupButtonStyle(btnLicenseIdSuggest);

    const makeLicenseIdSuggestion = () => {
      const year = new Date().getFullYear();
      return `BBM-${year}-0001`;
    };

    const ensureLicenseIdSuggestion = () => {
      const current = String(inpLicenseId.value || "").trim();
      if (current) return;
      inpLicenseId.value = makeLicenseIdSuggestion();
    };

    const inpLicenseEdition = document.createElement("input");
    inpLicenseEdition.type = "text";
    inpLicenseEdition.value = "test";

    const inpLicenseBinding = document.createElement("select");
    [
      ["Soft-Lizenz", "none"],
      ["Vollversion (rechnergebunden)", "machine"],
    ].forEach(([labelText, value]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = labelText;
      inpLicenseBinding.appendChild(option);
    });

    const bindingHint = document.createElement("div");
    bindingHint.style.fontSize = "12px";
    bindingHint.style.lineHeight = "1.35";
    bindingHint.style.color = "#475569";
    bindingHint.textContent = "Soft-Lizenz: keine Rechnerbindung. Vollversion: bindet die Lizenz an die aktuelle lokale Machine-ID.";

    const valueLicenseIssuedAt = document.createElement("div");
    valueLicenseIssuedAt.textContent = "-";
    valueLicenseIssuedAt.style.fontSize = "12px";
    valueLicenseIssuedAt.style.wordBreak = "break-word";

    const valueLicenseRequestMachineId = document.createElement("div");
    valueLicenseRequestMachineId.textContent = "-";
    valueLicenseRequestMachineId.style.fontSize = "12px";
    valueLicenseRequestMachineId.style.wordBreak = "break-word";

    const inpLicenseValidFrom = document.createElement("input");
    inpLicenseValidFrom.type = "date";
    inpLicenseValidFrom.value = new Date().toISOString().slice(0, 10);

    const inpLicenseDuration = document.createElement("input");
    inpLicenseDuration.type = "number";
    inpLicenseDuration.min = "1";
    inpLicenseDuration.step = "1";
    inpLicenseDuration.value = "365";

    const inpLicenseValidUntil = document.createElement("input");
    inpLicenseValidUntil.type = "date";

    const inpLicenseMaxDevices = document.createElement("input");
    inpLicenseMaxDevices.type = "number";
    inpLicenseMaxDevices.min = "1";
    inpLicenseMaxDevices.step = "1";
    inpLicenseMaxDevices.value = "1";

    const inpLicenseNotes = document.createElement("textarea");
    inpLicenseNotes.rows = 3;
    inpLicenseNotes.placeholder = "Interne Notizen zur Lizenz";
    inpLicenseNotes.style.width = "100%";
    inpLicenseNotes.style.boxSizing = "border-box";

    const featureWrap = document.createElement("div");
    featureWrap.style.display = "flex";
    featureWrap.style.flexWrap = "wrap";
    featureWrap.style.gap = "8px 12px";

    const featureInputs = ["app", "pdf", "export", "mail", "audio"].map((feature) => {
      const label = document.createElement("label");
      label.style.display = "inline-flex";
      label.style.alignItems = "center";
      label.style.gap = "6px";
      label.style.fontSize = "12px";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = feature;
      checkbox.checked = true;
      label.append(checkbox, document.createTextNode(feature));
      featureWrap.appendChild(label);
      return checkbox;
    });

    let activeLicenseTemplate = "";

    const setFeatureSelection = (selectedFeatures) => {
      const selected = new Set((Array.isArray(selectedFeatures) ? selectedFeatures : []).map((v) => String(v || "").trim()));
      featureInputs.forEach((inp) => {
        inp.checked = selected.has(inp.value);
      });
    };

    const calcValidUntil = () => {
      const validFrom = String(inpLicenseValidFrom.value || "").trim();
      const days = Number(inpLicenseDuration.value);
      if (!validFrom || !Number.isFinite(days) || days < 1) return;
      const dt = new Date(`${validFrom}T00:00:00Z`);
      if (Number.isNaN(dt.getTime())) return;
      dt.setUTCDate(dt.getUTCDate() + Math.floor(days));
      inpLicenseValidUntil.value = dt.toISOString().slice(0, 10);
    };
    calcValidUntil();
    inpLicenseValidFrom.addEventListener("change", calcValidUntil);
    inpLicenseDuration.addEventListener("input", calcValidUntil);

    const todayIso = () => new Date().toISOString().slice(0, 10);

    const applyLicenseTemplate = (templateKey) => {
      const templates = {
        test30: {
          label: "30 Tage Test",
          edition: "test",
          binding: "none",
          durationDays: "30",
          validFrom: todayIso(),
          maxDevices: "2",
          features: ["app", "pdf", "export", "mail"],
        },
        standard365: {
          label: "1 Jahr Standard",
          edition: "standard",
          binding: "none",
          durationDays: "365",
          validFrom: todayIso(),
          maxDevices: "1",
          features: ["app", "pdf", "export"],
        },
        pro365: {
          label: "1 Jahr Pro",
          edition: "pro",
          binding: "machine",
          durationDays: "365",
          validFrom: todayIso(),
          maxDevices: "1",
          features: ["app", "pdf", "export", "mail"],
        },
      };
      const tpl = templates[String(templateKey || "").trim()];
      if (!tpl) return;
      activeLicenseTemplate = tpl.label;
      inpLicenseProduct.value = "bbm-protokoll";
      inpLicenseEdition.value = tpl.edition;
      inpLicenseBinding.value = tpl.binding;
      inpLicenseDuration.value = tpl.durationDays;
      inpLicenseValidFrom.value = tpl.validFrom;
      inpLicenseMaxDevices.value = tpl.maxDevices;
      setFeatureSelection(tpl.features);
      calcValidUntil();
      licenseTemplateInfo.textContent = `Vorlage aktiv: ${tpl.label}. Felder sind vorbelegt und koennen danach weiterhin manuell angepasst werden.`;
      updateBindingHint();
      syncLoadedLicenseInfo();
      ensureLicenseIdSuggestion();
    };

    [
      ["30 Tage Test", "test30"],
      ["1 Jahr Standard", "standard365"],
      ["1 Jahr Pro", "pro365"],
    ].forEach(([labelText, key]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = labelText;
      applyPopupButtonStyle(btn);
      btn.onclick = () => applyLicenseTemplate(key);
      licenseTemplateWrap.appendChild(btn);
    });

    const licenseGenStatus = document.createElement("div");
    licenseGenStatus.style.fontSize = "12px";
    licenseGenStatus.style.minHeight = "16px";
    licenseGenStatus.style.color = "#4b5563";

    const licenseGenResult = document.createElement("div");
    licenseGenResult.style.fontSize = "12px";
    licenseGenResult.style.lineHeight = "1.35";
    licenseGenResult.style.whiteSpace = "pre-wrap";
    licenseGenResult.style.wordBreak = "break-word";
    licenseGenResult.style.padding = "8px";
    licenseGenResult.style.borderRadius = "8px";
    licenseGenResult.style.background = "#f8fafc";
    licenseGenResult.style.border = "1px solid rgba(0,0,0,0.08)";
    licenseGenResult.textContent = "Noch keine Lizenz erzeugt.";

    const licenseGenActions = document.createElement("div");
    licenseGenActions.style.display = "flex";
    licenseGenActions.style.flexWrap = "wrap";
    licenseGenActions.style.gap = "8px";

    const btnLicenseGenerate = document.createElement("button");
    btnLicenseGenerate.type = "button";
    btnLicenseGenerate.textContent = "Lizenz verlaengern";
    applyPopupButtonStyle(btnLicenseGenerate, { variant: "primary" });

    const btnLicenseLoad = document.createElement("button");
    btnLicenseLoad.type = "button";
    btnLicenseLoad.textContent = "Lizenz laden";
    applyPopupButtonStyle(btnLicenseLoad);

    const btnLicenseLoadRequest = document.createElement("button");
    btnLicenseLoadRequest.type = "button";
    btnLicenseLoadRequest.textContent = "Lizenzanforderung laden";
    applyPopupButtonStyle(btnLicenseLoadRequest);

    const btnLicenseOpenOutput = document.createElement("button");
    btnLicenseOpenOutput.type = "button";
    btnLicenseOpenOutput.textContent = "Ausgabeordner oeffnen";
    btnLicenseOpenOutput.disabled = true;
    applyPopupButtonStyle(btnLicenseOpenOutput);

    licenseGenActions.append(btnLicenseLoad, btnLicenseLoadRequest, btnLicenseGenerate, btnLicenseOpenOutput);

    let loadedLicenseMeta = null;
    let loadedRequestMeta = null;

    const updateBindingHint = () => {
      const isMachineBound = String(inpLicenseBinding.value || "").trim() === "machine";
      bindingHint.textContent = isMachineBound
        ? "Vollversion: Die Lizenz wird an die aktuelle lokale Machine-ID gebunden. Fuer fremde Zielrechner ist dafuer eine separate Machine-ID-Anforderung noetig."
        : "Soft-Lizenz: keine Rechnerbindung. Die Lizenz kann ohne Machine-ID verwendet und weitergegeben werden.";
    };
    updateBindingHint();

    const setLicenseGenBusy = (busy) => {
      const isBusy = !!busy;
      [
        inpLicenseProduct,
        inpLicenseCustomer,
        inpLicenseId,
        inpLicenseEdition,
        inpLicenseBinding,
        inpLicenseValidFrom,
        inpLicenseDuration,
        inpLicenseValidUntil,
        inpLicenseMaxDevices,
        inpLicenseNotes,
        ...featureInputs,
      ].forEach((el) => {
        if (el) el.disabled = isBusy;
      });
      btnLicenseLoad.disabled = isBusy;
      btnLicenseLoadRequest.disabled = isBusy;
      btnLicenseGenerate.disabled = isBusy;
      btnLicenseOpenOutput.disabled = isBusy || !btnLicenseOpenOutput.dataset.outputPath;
    };

    const syncLoadedLicenseInfo = () => {
      if (!loadedLicenseMeta) {
        loadedLicenseInfo.textContent = activeLicenseTemplate
          ? `Keine bestehende Lizenz geladen.\nAktive Vorlage: ${activeLicenseTemplate}${loadedRequestMeta?.machineId ? `\nGeladene Lizenzanforderung: ${loadedRequestMeta.machineId}` : ""}`
          : "Keine bestehende Lizenz geladen.";
        btnLicenseGenerate.textContent = "Lizenz erzeugen";
        return;
      }
      const currentLicenseId = String(inpLicenseId.value || "").trim();
      const originalLicenseId = String(loadedLicenseMeta.licenseId || "").trim();
      const sameId = currentLicenseId && originalLicenseId && currentLicenseId === originalLicenseId;
      loadedLicenseInfo.textContent = [
        `Geladen: ${loadedLicenseMeta.filePath || "-"}`,
        `Vorherige Lizenznummer: ${originalLicenseId || "-"}`,
        `IssuedAt: ${loadedLicenseMeta.issuedAt || "-"}`,
        `Modus: ${this._formatLicenseBinding(inpLicenseBinding.value)}`,
        `Lizenzanforderung: ${loadedRequestMeta?.machineId || "-"}`,
        sameId
          ? "Verlaengerung: Bestehende Lizenznummer wird weiterverwendet."
          : "Verlaengerung: Neue Lizenznummer eingetragen.",
      ].join("\n");
      btnLicenseGenerate.textContent = sameId ? "Lizenz verlaengern" : "Lizenz unter neuer Nummer erzeugen";
    };

    const applyLoadedLicense = (res) => {
      loadedLicenseMeta = {
        filePath: String(res?.filePath || "").trim(),
        licenseId: String(res?.licenseId || "").trim(),
        issuedAt: String(res?.issuedAt || "").trim(),
      };
      inpLicenseProduct.value = String(res?.product || "bbm-protokoll").trim() || "bbm-protokoll";
      inpLicenseCustomer.value = String(res?.customerName || "").trim();
      inpLicenseId.value = String(res?.licenseId || "").trim();
      inpLicenseEdition.value = String(res?.edition || "").trim() || "test";
      inpLicenseBinding.value = String(res?.binding || "none").trim() || "none";
      valueLicenseIssuedAt.textContent = String(res?.issuedAt || "").trim() || "-";
      inpLicenseValidFrom.value = String(res?.validFrom || "").trim();
      inpLicenseValidUntil.value = String(res?.validUntil || "").trim();
      inpLicenseMaxDevices.value = String(res?.maxDevices || 1).trim() || "1";
      inpLicenseNotes.value = String(res?.notes || "").trim();
      const loadedFeatures = Array.isArray(res?.features) ? res.features.map((v) => String(v || "").trim()) : [];
      setFeatureSelection(loadedFeatures);
      activeLicenseTemplate = "";
      licenseTemplateInfo.textContent = "Bestehende Lizenz geladen. Vorlagen koennen weiterhin genutzt werden, um Felder neu vorzubelegen.";
      updateBindingHint();
      syncLoadedLicenseInfo();
    };

    const applyLoadedRequest = (res) => {
      loadedRequestMeta = {
        filePath: String(res?.filePath || "").trim(),
        machineId: String(res?.machineId || "").trim(),
      };
      inpLicenseProduct.value = String(res?.product || "bbm-protokoll").trim() || "bbm-protokoll";
      inpLicenseBinding.value = "machine";
      valueLicenseRequestMachineId.textContent = loadedRequestMeta.machineId || "-";
      if (!String(inpLicenseCustomer.value || "").trim() && String(res?.customerHint || "").trim()) {
        inpLicenseCustomer.value = String(res?.customerHint || "").trim();
      }
      activeLicenseTemplate = "";
      licenseTemplateInfo.textContent = `Lizenzanforderung geladen: ${loadedRequestMeta.filePath || "-"}`;
      updateBindingHint();
      syncLoadedLicenseInfo();
    };

    const collectLicenseFormData = () => ({
      product: String(inpLicenseProduct.value || "").trim() || "bbm-protokoll",
      customerName: String(inpLicenseCustomer.value || "").trim(),
      licenseId: String(inpLicenseId.value || "").trim(),
      edition: String(inpLicenseEdition.value || "").trim() || "test",
      binding: String(inpLicenseBinding.value || "").trim() || "none",
      machineId:
        String(inpLicenseBinding.value || "").trim() === "machine"
          ? String(loadedRequestMeta?.machineId || "").trim()
          : "",
      validFrom: String(inpLicenseValidFrom.value || "").trim(),
      validUntil: String(inpLicenseValidUntil.value || "").trim(),
      durationDays: String(inpLicenseDuration.value || "").trim(),
      maxDevices: String(inpLicenseMaxDevices.value || "").trim(),
      features: featureInputs.filter((inp) => !!inp.checked).map((inp) => inp.value),
      notes: String(inpLicenseNotes.value || "").trim(),
    });

    inpLicenseId.addEventListener("input", syncLoadedLicenseInfo);
    inpLicenseBinding.addEventListener("change", () => {
      updateBindingHint();
      syncLoadedLicenseInfo();
    });

    btnLicenseLoad.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.licenseLoadForEdit !== "function") {
        licenseGenStatus.textContent = "Lizenz-Lade-IPC ist nicht verfuegbar.";
        licenseGenStatus.style.color = "#b91c1c";
        return;
      }
      setLicenseGenBusy(true);
      licenseGenStatus.textContent = "Bestehende Lizenz wird geladen ...";
      licenseGenStatus.style.color = "#4b5563";
      try {
        const res = await api.licenseLoadForEdit({});
        if (res?.canceled) {
          licenseGenStatus.textContent = "Lizenz laden abgebrochen.";
          licenseGenStatus.style.color = "#4b5563";
          return;
        }
        if (!res?.ok) {
          licenseGenStatus.textContent = this._formatLicenseGenerationError(res?.error);
          licenseGenStatus.style.color = "#b91c1c";
          return;
        }
        applyLoadedLicense(res);
        licenseGenStatus.textContent = "Bestehende Lizenzdaten geladen.";
        licenseGenStatus.style.color = "#166534";
      } catch (err) {
        licenseGenStatus.textContent = this._formatLicenseGenerationError(err?.message || err);
        licenseGenStatus.style.color = "#b91c1c";
      } finally {
        setLicenseGenBusy(false);
      }
    };

    btnLicenseLoadRequest.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.licenseLoadRequestForGenerate !== "function") {
        licenseGenStatus.textContent = "Lizenzanforderungs-IPC ist nicht verfuegbar.";
        licenseGenStatus.style.color = "#b91c1c";
        return;
      }
      setLicenseGenBusy(true);
      licenseGenStatus.textContent = "Lizenzanforderung wird geladen ...";
      licenseGenStatus.style.color = "#4b5563";
      try {
        const res = await api.licenseLoadRequestForGenerate({});
        if (res?.canceled) {
          licenseGenStatus.textContent = "Lizenzanforderung laden abgebrochen.";
          licenseGenStatus.style.color = "#4b5563";
          return;
        }
        if (!res?.ok) {
          licenseGenStatus.textContent = this._formatLicenseGenerationError(res?.error);
          licenseGenStatus.style.color = "#b91c1c";
          return;
        }
        applyLoadedRequest(res);
        licenseGenStatus.textContent = "Lizenzanforderung geladen.";
        licenseGenStatus.style.color = "#166534";
      } catch (err) {
        licenseGenStatus.textContent = this._formatLicenseGenerationError(err?.message || err);
        licenseGenStatus.style.color = "#b91c1c";
      } finally {
        setLicenseGenBusy(false);
      }
    };

    btnLicenseGenerate.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.licenseGenerate !== "function") {
        licenseGenStatus.textContent = "Lizenz-Generator-IPC ist nicht verfuegbar.";
        licenseGenStatus.style.color = "#b91c1c";
        return;
      }

      const currentLicenseId = String(inpLicenseId.value || "").trim();
      if (!currentLicenseId) {
        licenseGenStatus.textContent = "Bitte eine Lizenznummer angeben.";
        licenseGenStatus.style.color = "#b91c1c";
        try {
          inpLicenseId.focus();
        } catch {
          // ignore
        }
        return;
      }

      setLicenseGenBusy(true);
      licenseGenStatus.textContent = "Lizenz wird erzeugt ...";
      licenseGenStatus.style.color = "#4b5563";
      try {
        const currentLicenseId = String(inpLicenseId.value || "").trim();
        const originalLicenseId = String(loadedLicenseMeta?.licenseId || "").trim();
        const isRenewal = !!loadedLicenseMeta && currentLicenseId && originalLicenseId && currentLicenseId === originalLicenseId;
        const res = await api.licenseGenerate(collectLicenseFormData());
        if (!res?.ok) {
          licenseGenStatus.textContent = this._formatLicenseGenerationError(res?.error);
          licenseGenStatus.style.color = "#b91c1c";
          return;
        }
        btnLicenseOpenOutput.dataset.outputPath = String(res?.outputPath || "");
        btnLicenseOpenOutput.disabled = !btnLicenseOpenOutput.dataset.outputPath;
        licenseGenStatus.textContent = isRenewal ? "Lizenz erfolgreich verlaengert." : "Lizenzdatei erfolgreich erzeugt.";
        licenseGenStatus.style.color = "#166534";
        licenseGenResult.textContent = [
          `Datei: ${res?.outputPath || "-"}`,
          `Gueltig von: ${res?.validFrom || "-"}`,
          `Gueltig bis: ${res?.validUntil || "-"}`,
          `Modus: ${this._formatLicenseBinding(res?.binding)}`,
          `Kunde: ${res?.customerName || "-"}`,
          `Lizenznummer: ${res?.licenseId || "-"}`,
          `Machine-ID: ${res?.machineId || "-"}`,
          `Features: ${Array.isArray(res?.features) && res.features.length ? res.features.join(", ") : "-"}`,
        ].join("\n");
      } catch (err) {
        licenseGenStatus.textContent = this._formatLicenseGenerationError(err?.message || err);
        licenseGenStatus.style.color = "#b91c1c";
      } finally {
        setLicenseGenBusy(false);
      }
    };

    btnLicenseIdSuggest.onclick = () => {
      if (loadedLicenseMeta) return;
      inpLicenseId.value = makeLicenseIdSuggestion();
      syncLoadedLicenseInfo();
    };

    btnLicenseOpenOutput.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.licenseOpenOutputDir !== "function") return;
      const outputPath = String(btnLicenseOpenOutput.dataset.outputPath || "").trim();
      if (!outputPath) return;
      const res = await api.licenseOpenOutputDir({ outputPath });
      if (!res?.ok) {
        licenseGenStatus.textContent = res?.error || "Ausgabeordner konnte nicht geoeffnet werden.";
        licenseGenStatus.style.color = "#b91c1c";
        return;
      }
    };

    licenseGenBox.append(
      licenseGenTitle,
      licenseGenHint,
      mkRow("Schnellvorlagen", licenseTemplateWrap),
      licenseTemplateInfo,
      loadedLicenseInfo,
      mkRow("Produkt", inpLicenseProduct),
      mkRow("Kunde / Firma", inpLicenseCustomer),
      mkRow("Lizenznummer", inpLicenseId),
      mkRow("", btnLicenseIdSuggest),
      mkRow("Edition", inpLicenseEdition),
      mkRow("Lizenzmodus", inpLicenseBinding),
      bindingHint,
      mkRow("Machine-ID aus Lizenzanforderung", valueLicenseRequestMachineId),
      mkRow("IssuedAt (geladen)", valueLicenseIssuedAt),
      mkRow("Gueltig von", inpLicenseValidFrom),
      mkRow("Nutzungstage", inpLicenseDuration),
      mkRow("Gueltig bis", inpLicenseValidUntil),
      mkRow("Max. Geraete", inpLicenseMaxDevices),
      mkRow("Features", featureWrap),
      mkRow("Notizen", inpLicenseNotes),
      licenseGenActions,
      licenseGenStatus,
      licenseGenResult
    );

    ensureLicenseIdSuggestion();

    const devDefaultsBox = document.createElement("div");
    applyPopupCardStyle(devDefaultsBox);
    devDefaultsBox.style.padding = "8px 10px";
    devDefaultsBox.style.maxWidth = "720px";
    devDefaultsBox.style.marginTop = "0";
    devDefaultsBox.style.boxSizing = "border-box";

    const devDefaultsTitle = document.createElement("div");
    devDefaultsTitle.textContent = "Druck-Vorgaben";
    devDefaultsTitle.style.fontWeight = "bold";
    devDefaultsTitle.style.marginBottom = "6px";

    const devDefaultsHint = document.createElement("div");
    devDefaultsHint.textContent = "Defaultwerte fuer den Druck pflegen + Speicherorte anzeigen.";
    devDefaultsHint.style.fontSize = "12px";
    devDefaultsHint.style.opacity = "0.75";
    devDefaultsHint.style.marginBottom = "8px";

    const devDefaultsActions = document.createElement("div");
    devDefaultsActions.style.display = "flex";
    devDefaultsActions.style.gap = "8px";
    devDefaultsActions.style.flexWrap = "wrap";

    const btnOpenPrintDefaults = document.createElement("button");
    btnOpenPrintDefaults.type = "button";
    btnOpenPrintDefaults.textContent = "Druck-Vorgaben";
    applyPopupButtonStyle(btnOpenPrintDefaults);

    const btnOpenStoragePreview = document.createElement("button");
    btnOpenStoragePreview.type = "button";
    btnOpenStoragePreview.textContent = "Speicherorte";
    applyPopupButtonStyle(btnOpenStoragePreview);

    const btnOpenThemeDefaults = document.createElement("button");
    btnOpenThemeDefaults.type = "button";
    btnOpenThemeDefaults.textContent = "Start-Defaults Farbschema";
    applyPopupButtonStyle(btnOpenThemeDefaults);


    const devDefaultsStatus = document.createElement("div");
    devDefaultsStatus.style.fontSize = "12px";
    devDefaultsStatus.style.minHeight = "16px";
    devDefaultsStatus.style.marginTop = "6px";
    devDefaultsStatus.style.color = "#4b5563";

    let devDefaultsStatusTimer = null;
    const setDevDefaultsStatus = (text, isError = false) => {
      if (devDefaultsStatusTimer) {
        clearTimeout(devDefaultsStatusTimer);
        devDefaultsStatusTimer = null;
      }
      devDefaultsStatus.textContent = String(text || "");
      devDefaultsStatus.style.color = isError ? "#b91c1c" : "#166534";
      if (text) {
        devDefaultsStatusTimer = setTimeout(() => {
          devDefaultsStatus.textContent = "";
          devDefaultsStatus.style.color = "#4b5563";
          devDefaultsStatusTimer = null;
        }, 4500);
      }
    };

    const DEFAULT_PRINT_DEFAULTS = {
      "pdf.preRemarks": DEFAULT_V2_PRE_REMARKS_TEXT,
      "print.preRemarks.enabled": "true",
      "print.v2.pagePadTopMm": "3",
      "print.v2.pagePadLeftMm": "19",
      "print.v2.pagePadRightMm": "15",
      "print.v2.footerReserveMm": "12",
    };

    const allDefaultFields = PRINT_DEFAULTS_FIELD_GROUPS.flatMap((group) => group.fields || []);

    const openPrintDefaultsModal = async () => {
      const api = window.bbmDb || {};
      if (typeof api.appSettingsGetMany !== "function" || typeof api.appSettingsSetMany !== "function") {
        setDevDefaultsStatus("Settings-API fehlt.", true);
        return;
      }

      const root = document.createElement("div");
      root.style.display = "grid";
      root.style.gap = "10px";
      root.style.maxWidth = "920px";

      const valueRefs = {};
      const defaultKeys = [];
      for (const field of allDefaultFields) {
        const key = String(field?.key || "").trim();
        if (!key) continue;
        defaultKeys.push(`defaults.${key}`);
      }

      for (const group of PRINT_DEFAULTS_FIELD_GROUPS) {
        const groupBox = document.createElement("div");
        applyPopupCardStyle(groupBox);
        groupBox.style.padding = "8px 10px";
        groupBox.style.marginTop = "0";
        const groupTitle = document.createElement("div");
        groupTitle.textContent = String(group?.title || "");
        groupTitle.style.fontWeight = "700";
        groupTitle.style.marginBottom = "6px";
        groupBox.append(groupTitle);
        for (const field of group.fields || []) {
          const key = String(field?.key || "").trim();
          if (!key) continue;
          let input = null;
          if (field.multiline) {
            input = document.createElement("textarea");
            input.rows = 3;
            input.style.width = "100%";
            input.style.resize = "vertical";
            input.addEventListener("keydown", (e) => {
              if (e.key !== "Enter") return;
              // Enter im Defaults-Textarea immer als Zeilenumbruch behandeln.
              e.preventDefault();
              e.stopPropagation();
              const start = Number(input.selectionStart || 0);
              const end = Number(input.selectionEnd || start);
              const before = input.value.slice(0, start);
              const after = input.value.slice(end);
              input.value = `${before}\n${after}`;
              const nextPos = start + 1;
              input.selectionStart = nextPos;
              input.selectionEnd = nextPos;
            });
          } else {
            input = document.createElement("input");
            input.type = "text";
            input.style.width = "100%";
          }
          valueRefs[key] = input;
          groupBox.append(mkRow(field.label || key, input));
        }
        root.append(groupBox);
      }

      const footerRow = document.createElement("div");
      footerRow.style.display = "flex";
      footerRow.style.justifyContent = "space-between";
      footerRow.style.alignItems = "center";
      footerRow.style.gap = "8px";
      footerRow.style.flexWrap = "wrap";

      const localStatus = document.createElement("div");
      localStatus.style.fontSize = "12px";
      localStatus.style.minHeight = "16px";
      localStatus.style.color = "#4b5563";

      const btnResetDefaults = document.createElement("button");
      btnResetDefaults.type = "button";
      btnResetDefaults.textContent = "Defaults zuruecksetzen";
      applyPopupButtonStyle(btnResetDefaults);

      footerRow.append(localStatus, btnResetDefaults);
      root.append(footerRow);

      const setLocalStatus = (text, isError = false) => {
        localStatus.textContent = String(text || "");
        localStatus.style.color = isError ? "#b91c1c" : "#166534";
      };

      const loadDefaults = async () => {
        const res = await api.appSettingsGetMany(defaultKeys);
        if (!res?.ok) {
          setLocalStatus(res?.error || "Defaults konnten nicht geladen werden.", true);
          return;
        }
        const data = res.data || {};
        for (const field of allDefaultFields) {
          const key = String(field?.key || "").trim();
          if (!key) continue;
          const node = valueRefs[key];
          if (!node) continue;
          const raw = data[`defaults.${key}`];
          node.value = raw == null ? "" : String(raw);
        }
        setLocalStatus("");
      };

      const collectPayload = () => {
        const payload = {};
        for (const field of allDefaultFields) {
          const key = String(field?.key || "").trim();
          if (!key) continue;
          const node = valueRefs[key];
          if (!node) continue;
          payload[`defaults.${key}`] = String(node.value ?? "").trim();
        }
        return payload;
      };

      btnResetDefaults.onclick = async () => {
        for (const field of allDefaultFields) {
          const key = String(field?.key || "").trim();
          if (!key) continue;
          if (!valueRefs[key]) continue;
          valueRefs[key].value = Object.prototype.hasOwnProperty.call(DEFAULT_PRINT_DEFAULTS, key)
            ? String(DEFAULT_PRINT_DEFAULTS[key])
            : "";
        }
        const payload = collectPayload();
        const saveRes = await api.appSettingsSetMany(payload);
        if (!saveRes?.ok) {
          setLocalStatus(saveRes?.error || "Defaults konnten nicht gespeichert werden.", true);
          return;
        }
        setLocalStatus("Defaults zurueckgesetzt.");
      };

      this._openSettingsModal({
        title: "Druck-Vorgaben",
        content: [root],
        closeOnly: false,
        saveFn: async () => {
          const payload = collectPayload();
          const res = await api.appSettingsSetMany(payload);
          if (!res?.ok) {
            setLocalStatus(res?.error || "Speichern fehlgeschlagen.", true);
            return false;
          }
          setLocalStatus("Gespeichert.");
          return true;
        },
      });

      await loadDefaults();
    };

    const openStoragePreviewModal = async () => {
      const api = window.bbmDb || {};
      const previewApi =
        typeof api.devGetStoragePreview === "function"
          ? api.devGetStoragePreview
          : typeof api.projectsStoragePreview === "function"
            ? api.projectsStoragePreview
            : null;
      if (!previewApi) {
        setDevDefaultsStatus("Speicherorte-API fehlt.", true);
        return;
      }

      const box = document.createElement("div");
      applyPopupCardStyle(box);
      box.style.padding = "10px";
      box.style.marginTop = "0";
      box.style.display = "grid";
      box.style.gap = "8px";

      const hint = document.createElement("div");
      hint.style.fontSize = "12px";
      hint.style.opacity = "0.75";
      hint.textContent = "Nur Anzeige, keine finale Speicherlogik-Entscheidung.";

      const inpNumber = document.createElement("input");
      inpNumber.type = "text";
      inpNumber.style.width = "100%";
      const inpShort = document.createElement("input");
      inpShort.type = "text";
      inpShort.style.width = "100%";
      const inpName = document.createElement("input");
      inpName.type = "text";
      inpName.style.width = "100%";

      const mkPathOutput = () => {
        const output = document.createElement("input");
        output.type = "text";
        output.readOnly = true;
        output.style.width = "100%";
        return output;
      };
      const outProtocols = mkPathOutput();
      const outPreview = mkPathOutput();
      const outLists = mkPathOutput();
      const status = document.createElement("div");
      status.style.fontSize = "12px";
      status.style.minHeight = "16px";
      status.style.color = "#4b5563";

      box.append(
        hint,
        mkRow("Projekt-Nr (Vorschau)", inpNumber),
        mkRow("Kurzbez. (Vorschau)", inpShort),
        mkRow("Projektname (Fallback)", inpName),
        mkRow("Protokolle", outProtocols),
        mkRow("Vorabzug", outPreview),
        mkRow("Listen", outLists),
        status
      );

      const refreshPreview = async () => {
        const res = await previewApi({
          project_number: String(inpNumber.value || "").trim(),
          short: String(inpShort.value || "").trim(),
          name: String(inpName.value || "").trim(),
        });
        if (!res?.ok) {
          status.textContent = res?.error || "Speicherorte konnten nicht geladen werden.";
          status.style.color = "#b91c1c";
          return;
        }
        outProtocols.value = String(res.protocolsDir || "");
        outPreview.value = String(res.previewDir || "");
        outLists.value = String(res.listsDir || "");
        status.textContent = "";
        status.style.color = "#4b5563";
      };

      [inpNumber, inpShort, inpName].forEach((inp) => {
        inp.addEventListener("input", () => {
          refreshPreview();
        });
      });

      this._openSettingsModal({
        title: "Speicherorte",
        content: [box],
        closeOnly: true,
      });

      await refreshPreview();
    };

    btnOpenPrintDefaults.onclick = async () => {
      this._closeSettingsModal();
      await openPrintDefaultsModal();
    };
    btnOpenStoragePreview.onclick = async () => {
      this._closeSettingsModal();
      await openStoragePreviewModal();
    };
    btnOpenThemeDefaults.onclick = async () => {
      this._closeSettingsModal();
      await openThemeDefaultsPopup();
    };
    devDefaultsActions.append(
      btnOpenPrintDefaults,
      btnOpenStoragePreview,
      btnOpenThemeDefaults
    );
    devDefaultsBox.append(devDefaultsTitle, devDefaultsHint, devDefaultsActions, devDefaultsStatus);

    const dictionaryBox = document.createElement("div");
    applyPopupCardStyle(dictionaryBox);
    dictionaryBox.style.padding = "8px 10px";
    dictionaryBox.style.maxWidth = "720px";
    dictionaryBox.style.marginTop = "0";
    dictionaryBox.style.display = "grid";
    dictionaryBox.style.gap = "6px";

    const dictionaryTitle = document.createElement("div");
    dictionaryTitle.textContent = "Wörterbuch";
    dictionaryTitle.style.fontWeight = "700";

    const dictionaryHint = document.createElement("div");
    dictionaryHint.style.fontSize = "12px";
    dictionaryHint.style.opacity = "0.8";
    dictionaryHint.textContent = "Fachbegriffe aus Ordnern sammeln, gruppieren und prüfen.";

    const btnDictionaryOpen = document.createElement("button");
    btnDictionaryOpen.type = "button";
    btnDictionaryOpen.textContent = "Wörterbuch öffnen";
    applyPopupButtonStyle(btnDictionaryOpen);
    btnDictionaryOpen.onclick = async () => {
      await this._openDictionaryPopup();
    };

    dictionaryBox.append(dictionaryTitle, dictionaryHint, btnDictionaryOpen);

    const printBox = document.createElement("div");
    applyPopupCardStyle(printBox);
    printBox.style.padding = "8px 10px";
    printBox.style.maxWidth = "720px";
    printBox.style.marginTop = "0";
    printBox.style.display = "grid";
    printBox.style.gap = "6px";

    const printTitle = document.createElement("div");
    printTitle.textContent = "Druckvorgaben";
    printTitle.style.fontWeight = "700";

    const printHint = document.createElement("div");
    printHint.style.fontSize = "12px";
    printHint.style.opacity = "0.8";
    printHint.textContent = "PDF-Einstellungen & Kategorien";

    const btnPrintOpen = document.createElement("button");
    btnPrintOpen.type = "button";
    btnPrintOpen.textContent = "Druckvorgaben ?ffnen";
    applyPopupButtonStyle(btnPrintOpen);
    btnPrintOpen.onclick = () => {
      try {
        if (typeof tilePrint?.click === "function") {
          tilePrint.click();
        }
      } catch (_e) {}
    };

    printBox.append(printTitle, printHint, btnPrintOpen);

    const licenseBox = document.createElement("div");
    applyPopupCardStyle(licenseBox);
    licenseBox.style.padding = "8px 10px";
    licenseBox.style.maxWidth = "720px";
    licenseBox.style.marginTop = "0";
    licenseBox.style.display = "grid";
    licenseBox.style.gap = "6px";

    const licenseTitle = document.createElement("div");
    licenseTitle.textContent = "Lizenz";
    licenseTitle.style.fontWeight = "700";

    const licenseHint = document.createElement("div");
    licenseHint.style.fontSize = "12px";
    licenseHint.style.opacity = "0.8";
    licenseHint.textContent = "Lizenzstatus & Verwaltung";

    const btnLicenseOpen = document.createElement("button");
    btnLicenseOpen.type = "button";
    btnLicenseOpen.textContent = "Lizenz ?ffnen";
    applyPopupButtonStyle(btnLicenseOpen);
    btnLicenseOpen.onclick = async () => {
      const content = this._createLicenseSettingsContent();
      this._openSettingsModal({
        title: "Lizenz",
        content: [content],
        closeOnly: true,
      });
    };

    licenseBox.append(licenseTitle, licenseHint, btnLicenseOpen);

    devRightCol.append(licenseGenBox, devDefaultsBox, licenseBox, dictionaryBox, topsLimitBox, trialBox);
    devTopCardsRow.append(versionBox, devRightCol);

    const themeBox = document.createElement("div");
    applyPopupCardStyle(themeBox);
    themeBox.style.padding = "10px";
    themeBox.style.maxWidth = "920px";
    themeBox.style.marginTop = "0";

    const themeTitle = document.createElement("div");
    themeTitle.textContent = "Farben einstellen";
    themeTitle.style.fontWeight = "bold";
    themeTitle.style.marginBottom = "6px";
    const themeHint = document.createElement("div");
    themeHint.style.fontSize = "12px";
    themeHint.style.opacity = "0.8";
    themeHint.style.marginBottom = "8px";
    themeHint.textContent = "Header, Sidebar und Main jeweils mit Farbspektrum, Hue-Regler und RGB-Feldern.";

    const mkThemeAreaControls = () => {
      const outer = document.createElement("div");
      outer.style.display = "grid";
      outer.style.gridTemplateRows = "auto auto";
      outer.style.gap = "8px";

      const pickerRow = document.createElement("div");
      pickerRow.style.display = "flex";
      pickerRow.style.alignItems = "stretch";
      pickerRow.style.gap = "12px";
      pickerRow.style.flexWrap = "wrap";

      const svWrap = document.createElement("div");
      svWrap.style.position = "relative";
      svWrap.style.width = "220px";
      svWrap.style.height = "110px";
      svWrap.style.border = "1px solid #cbd5e1";
      svWrap.style.borderRadius = "6px";
      svWrap.style.overflow = "hidden";
      const svCanvas = document.createElement("canvas");
      svCanvas.width = 220;
      svCanvas.height = 110;
      svCanvas.style.width = "220px";
      svCanvas.style.height = "110px";
      svCanvas.style.display = "block";
      svCanvas.style.cursor = "crosshair";
      const svCursor = document.createElement("div");
      svCursor.style.position = "absolute";
      svCursor.style.width = "10px";
      svCursor.style.height = "10px";
      svCursor.style.border = "2px solid #fff";
      svCursor.style.borderRadius = "50%";
      svCursor.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.4)";
      svCursor.style.pointerEvents = "none";
      svCursor.style.transform = "translate(-5px, -5px)";
      svWrap.append(svCanvas, svCursor);

      const hueWrap = document.createElement("div");
      hueWrap.style.position = "relative";
      hueWrap.style.width = "22px";
      hueWrap.style.height = "110px";
      hueWrap.style.border = "1px solid #cbd5e1";
      hueWrap.style.borderRadius = "6px";
      hueWrap.style.overflow = "hidden";
      const hueCanvas = document.createElement("canvas");
      hueCanvas.width = 22;
      hueCanvas.height = 110;
      hueCanvas.style.width = "22px";
      hueCanvas.style.height = "110px";
      hueCanvas.style.display = "block";
      hueCanvas.style.cursor = "ns-resize";
      const hueCursor = document.createElement("div");
      hueCursor.style.position = "absolute";
      hueCursor.style.left = "0";
      hueCursor.style.width = "100%";
      hueCursor.style.height = "2px";
      hueCursor.style.background = "#fff";
      hueCursor.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.55)";
      hueCursor.style.pointerEvents = "none";
      hueCursor.style.transform = "translateY(-1px)";
      hueWrap.append(hueCanvas, hueCursor);

      const controls = document.createElement("div");
      controls.style.display = "grid";
      controls.style.gridTemplateRows = "auto auto auto";
      controls.style.gap = "8px";
      controls.style.minWidth = "310px";

      const topRow = document.createElement("div");
      topRow.style.display = "flex";
      topRow.style.alignItems = "center";
      topRow.style.gap = "8px";
      topRow.style.flexWrap = "wrap";

      const modelSel = document.createElement("select");
      modelSel.style.width = "90px";
      const modelOptRgb = document.createElement("option");
      modelOptRgb.value = "rgb";
      modelOptRgb.textContent = "RGB";
      modelSel.append(modelOptRgb);

      const mkRgbInput = (label) => {
        const wrap = document.createElement("label");
        wrap.style.display = "inline-flex";
        wrap.style.alignItems = "center";
        wrap.style.gap = "4px";
        wrap.style.fontSize = "12px";
        wrap.style.opacity = "0.95";
        const txt = document.createElement("span");
        txt.textContent = label;
        const inp = document.createElement("input");
        inp.type = "number";
        inp.min = "0";
        inp.max = "255";
        inp.step = "1";
        inp.inputMode = "numeric";
        inp.style.width = "64px";
        wrap.append(txt, inp);
        return { wrap, inp };
      };
      const rField = mkRgbInput("R");
      const gField = mkRgbInput("G");
      const bField = mkRgbInput("B");
      topRow.append(modelSel, rField.wrap, gField.wrap, bField.wrap);

      const hexRow = document.createElement("div");
      hexRow.style.display = "flex";
      hexRow.style.alignItems = "center";
      hexRow.style.gap = "8px";
      const hexLabel = document.createElement("span");
      hexLabel.textContent = "Hex";
      hexLabel.style.fontSize = "12px";
      const hexInp = document.createElement("input");
      hexInp.type = "text";
      hexInp.placeholder = "#RRGGBB";
      hexInp.maxLength = 7;
      hexInp.style.width = "110px";

      const colorValue = document.createElement("div");
      colorValue.style.fontFamily = "Calibri, Arial, sans-serif";
      colorValue.style.fontSize = "11px";
      colorValue.style.opacity = "0.85";
      colorValue.style.minWidth = "200px";
      colorValue.textContent = "rgb(255, 255, 255)";
      hexRow.append(hexLabel, hexInp, colorValue);

      const previewRow = document.createElement("div");
      previewRow.style.display = "flex";
      previewRow.style.alignItems = "center";
      previewRow.style.gap = "8px";
      const previewLabel = document.createElement("span");
      previewLabel.textContent = "Preview";
      previewLabel.style.fontSize = "12px";
      const preview = document.createElement("div");
      preview.style.width = "88px";
      preview.style.height = "28px";
      preview.style.border = "1px solid #cbd5e1";
      preview.style.borderRadius = "6px";
      preview.style.backgroundColor = "rgb(255, 255, 255)";
      previewRow.append(previewLabel, preview);

      controls.append(topRow, hexRow, previewRow);
      pickerRow.append(svWrap, hueWrap, controls);

      const err = document.createElement("div");
      err.style.fontSize = "12px";
      err.style.color = "#b91c1c";
      err.style.minHeight = "16px";

      outer.append(pickerRow, err);
      return {
        outer,
        modelSel,
        preview,
        colorValue,
        hexInp,
        rInp: rField.inp,
        gInp: gField.inp,
        bInp: bField.inp,
        svCanvas,
        hueCanvas,
        svCursor,
        hueCursor,
        err,
      };
    };

    const themeHeader = mkThemeAreaControls();
    const themeSidebar = mkThemeAreaControls();
    const themeMain = mkThemeAreaControls();

    const onThemeInput = () => {
      this._applyThemePreviewFromInputs();
      this._scheduleThemeSave();
    };

    const wireThemeArea = (area, controls) => {
      controls.modelSel.addEventListener("change", () => {
        controls.modelSel.value = "rgb";
      });
      controls.rInp.addEventListener("input", () => this._handleThemeRgbInput(area, "r"));
      controls.gInp.addEventListener("input", () => this._handleThemeRgbInput(area, "g"));
      controls.bInp.addEventListener("input", () => this._handleThemeRgbInput(area, "b"));
      controls.rInp.addEventListener("blur", () => this._normalizeThemeRgbInput(area, "r"));
      controls.gInp.addEventListener("blur", () => this._normalizeThemeRgbInput(area, "g"));
      controls.bInp.addEventListener("blur", () => this._normalizeThemeRgbInput(area, "b"));
      controls.hexInp.addEventListener("input", () => this._handleThemeHexInput(area, false));
      controls.hexInp.addEventListener("blur", () => this._handleThemeHexInput(area, true));
      this._bindThemeCanvasDrag(controls.svCanvas, (e) => this._handleThemeSvCanvasInput(area, e));
      this._bindThemeCanvasDrag(controls.hueCanvas, (e) => this._handleThemeHueCanvasInput(area, e));
    };
    wireThemeArea("header", themeHeader);
    wireThemeArea("sidebar", themeSidebar);
    wireThemeArea("main", themeMain);

    const themeDefaultsResetWrap = document.createElement("div");
    themeDefaultsResetWrap.style.display = "inline-flex";
    themeDefaultsResetWrap.style.alignItems = "center";
    themeDefaultsResetWrap.style.gap = "8px";
    const btnThemeResetDefaults = document.createElement("button");
    btnThemeResetDefaults.type = "button";
    btnThemeResetDefaults.textContent = "Werkseinstellungen setzen";
    applyPopupButtonStyle(btnThemeResetDefaults);
    const themeDefaultsResetHint = document.createElement("span");
    themeDefaultsResetHint.textContent = "setzt Header/Sidebar/Main auf Startwerte";
    themeDefaultsResetHint.style.fontSize = "12px";
    themeDefaultsResetHint.style.opacity = "0.8";
    themeDefaultsResetWrap.append(btnThemeResetDefaults, themeDefaultsResetHint);
    btnThemeResetDefaults.onclick = async () => {
      await this._applyThemeStartDefaultsToUser();
    };

    themeBox.append(
      themeTitle,
      themeHint,
      mkRow("Werkseinstellung", themeDefaultsResetWrap),
      mkRow("Header", themeHeader.outer),
      mkRow("Sidebar", themeSidebar.outer),
      mkRow("Main", themeMain.outer)
    );

    const securityBox = document.createElement("div");
    applyPopupCardStyle(securityBox);
    securityBox.style.padding = "10px";
    securityBox.style.maxWidth = "720px";
    securityBox.style.marginTop = "10px";

    const securityTitle = document.createElement("div");
    securityTitle.textContent = "Sicherheit";
    securityTitle.style.fontWeight = "bold";
    securityTitle.style.marginBottom = "6px";

    const securityHint = document.createElement("div");
    securityHint.style.fontSize = "12px";
    securityHint.style.opacity = "0.8";
    securityHint.style.marginBottom = "8px";
    securityHint.textContent = "Einstellungen mit 4-stelliger PIN (nur Zahlen) schuetzen.";

    const inpSecurityPinEnabled = document.createElement("input");
    inpSecurityPinEnabled.type = "checkbox";
    inpSecurityPinEnabled.disabled = true;
    const wrapSecurityPinEnabled = document.createElement("div");
    wrapSecurityPinEnabled.style.display = "flex";
    wrapSecurityPinEnabled.style.alignItems = "center";
    wrapSecurityPinEnabled.append(inpSecurityPinEnabled);

    const mkPinInput = (placeholder) => {
      const inp = document.createElement("input");
      inp.type = "password";
      inp.inputMode = "numeric";
      inp.maxLength = 4;
      inp.placeholder = placeholder;
      inp.style.width = "100%";
      inp.addEventListener("input", () => {
        inp.value = (inp.value || "").replace(/\D+/g, "").slice(0, 4);
      });
      return inp;
    };

    const inpSecurityCurrentPin = mkPinInput("Aktuelle PIN (4 Ziffern)");
    const inpSecurityNewPin = mkPinInput("Neue PIN (4 Ziffern)");
    const inpSecurityConfirmPin = mkPinInput("PIN wiederholen");

    const securityActions = document.createElement("div");
    securityActions.style.display = "flex";
    securityActions.style.gap = "8px";
    securityActions.style.justifyContent = "flex-end";

    const btnSecurityPinDisable = document.createElement("button");
    btnSecurityPinDisable.textContent = "PIN deaktivieren";
    applyPopupButtonStyle(btnSecurityPinDisable);
    btnSecurityPinDisable.onclick = async () => {
      await this._disableSecurityPin();
    };

    const btnSecurityPinSave = document.createElement("button");
    btnSecurityPinSave.textContent = "PIN speichern";
    applyPopupButtonStyle(btnSecurityPinSave, { variant: "primary" });
    btnSecurityPinSave.onclick = async () => {
      await this._saveSecurityPin();
    };

    securityActions.append(btnSecurityPinDisable, btnSecurityPinSave);
    securityBox.append(
      securityTitle,
      securityHint,
      mkRow("PIN aktiv", wrapSecurityPinEnabled),
      mkRow("Aktuelle PIN", inpSecurityCurrentPin),
      mkRow("Neue PIN", inpSecurityNewPin),
      mkRow("PIN wiederholen", inpSecurityConfirmPin),
      securityActions
    );

    const dbDiagBox = document.createElement("div");
    applyPopupCardStyle(dbDiagBox);
    dbDiagBox.style.padding = "10px";
    dbDiagBox.style.maxWidth = "720px";
    dbDiagBox.style.marginTop = "10px";

    const dbDiagTitle = document.createElement("div");
    dbDiagTitle.textContent = "DB-Diagnose";
    dbDiagTitle.style.fontWeight = "bold";
    dbDiagTitle.style.marginBottom = "6px";

    const dbDiagHint = document.createElement("div");
    dbDiagHint.style.fontSize = "12px";
    dbDiagHint.style.opacity = "0.8";
    dbDiagHint.style.marginBottom = "8px";
    dbDiagHint.textContent = "Aktiver DB-Pfad, Backup und Legacy-Dateien fuer Diagnose/Migration.";

    const dbDiagText = document.createElement("pre");
    dbDiagText.style.margin = "0";
    dbDiagText.style.whiteSpace = "pre-wrap";
    dbDiagText.style.fontSize = "12px";
    dbDiagText.style.lineHeight = "1.35";
    dbDiagText.style.fontFamily = "Calibri, Arial, sans-serif";
    dbDiagText.textContent = "Lade DB-Status...";

    const dbDiagActions = document.createElement("div");
    dbDiagActions.style.display = "flex";
    dbDiagActions.style.gap = "8px";
    dbDiagActions.style.flexWrap = "wrap";
    dbDiagActions.style.marginTop = "8px";

    const btnDbLegacyImport = document.createElement("button");
    btnDbLegacyImport.type = "button";
    btnDbLegacyImport.textContent = "Legacy uebernehmen";
    applyPopupButtonStyle(btnDbLegacyImport, { variant: "primary" });

    const btnDbOpenActive = document.createElement("button");
    btnDbOpenActive.type = "button";
    btnDbOpenActive.textContent = "Aktive DB oeffnen";
    applyPopupButtonStyle(btnDbOpenActive);

    const btnDbOpenLegacy = document.createElement("button");
    btnDbOpenLegacy.type = "button";
    btnDbOpenLegacy.textContent = "Legacy-Import oeffnen";
    applyPopupButtonStyle(btnDbOpenLegacy);

    dbDiagActions.append(btnDbLegacyImport, btnDbOpenActive, btnDbOpenLegacy);
    dbDiagBox.append(dbDiagTitle, dbDiagHint, dbDiagText, dbDiagActions);

    let lastDbDiag = null;

    const loadDbDiagnostics = async () => {
      const api = window.bbmDb || {};
      if (typeof api.dbDiagnosticsGet !== "function") {
        dbDiagText.textContent = "DB-Diagnose-API fehlt.";
        return;
      }
      const res = await api.dbDiagnosticsGet();
      if (!res?.ok) {
        dbDiagText.textContent = `Fehler: ${res?.error || "DB-Diagnose fehlgeschlagen"}`;
        return;
      }
      const d = res.data || {};
      lastDbDiag = d;
      const fmt = (s = {}) => {
        const exists = s.exists ? "ja" : "nein";
        const size = Number.isFinite(Number(s.size)) ? Number(s.size) : 0;
        return `${exists}, ${size} Bytes`;
      };
      dbDiagText.textContent = [
        `[db] using ${d.dbPath || "-"}`,
        `[db] backup ${d.backupPath || "-"} (${fmt(d.backup)})`,
        `[db] legacy ${d.legacyDbPath || "-"} (${fmt(d.legacy)})`,
        `[db] legacy-import ${d.legacyImportPath || "-"} (${fmt(d.legacyImport)})`,
        `[db] legacy-available ${d.legacyAvailable ? "ja" : "nein"}`,
        `[db] active-likely-empty ${d.activeLikelyEmpty ? "ja" : "nein"}`,
      ].join("\n");
    };

    btnDbLegacyImport.onclick = async () => {
      const api = window.bbmDb || {};
      const ok = window.confirm(
        "Legacy-Datenbank wirklich uebernehmen?\nDie aktive DB wird vorher gesichert."
      );
      if (!ok) return;
      if (typeof api.dbLegacyImport !== "function") {
        alert("Legacy-Import-API fehlt.");
        return;
      }
      const res = await api.dbLegacyImport();
      if (!res?.ok) {
        alert(res?.error || "Legacy-Import fehlgeschlagen.");
        return;
      }
      alert("Legacy-Datenbank wurde uebernommen. Einstellungen werden aktualisiert.");
      if (this.router && typeof this.router.ensureAppSettingsLoaded === "function") {
        await this.router.ensureAppSettingsLoaded({ force: true });
      }
      await this._reload();
      window.dispatchEvent(new Event("bbm:header-refresh"));
      await loadDbDiagnostics();
    };

    btnDbOpenActive.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.dbOpenFolder !== "function") {
        alert("Pfad-API fehlt.");
        return;
      }
      const res = await api.dbOpenFolder({ kind: "active" });
      if (!res?.ok) alert(res?.error || "Aktiven DB-Pfad konnte nicht geoeffnet werden.");
    };

    btnDbOpenLegacy.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.dbOpenFolder !== "function") {
        alert("Pfad-API fehlt.");
        return;
      }
      const hasLegacy = !!(lastDbDiag?.legacyAvailable);
      if (!hasLegacy) {
        alert("Keine Legacy-Datei verfuegbar.");
        return;
      }
      const res = await api.dbOpenFolder({ kind: "legacyImport" });
      if (!res?.ok) alert(res?.error || "Legacy-Import-Pfad konnte nicht geoeffnet werden.");
    };

    const pdfLogoBox = document.createElement("div");    applyPopupCardStyle(pdfLogoBox);    pdfLogoBox.style.padding = "10px";    pdfLogoBox.style.maxWidth = "720px";    pdfLogoBox.style.marginTop = "10px";
    const pdfLogoTitle = document.createElement("div");
    pdfLogoTitle.textContent = "PDF-Logo";
    pdfLogoTitle.style.fontWeight = "bold";
    pdfLogoTitle.style.marginBottom = "6px";

    const inpPdfLogoEnabled = document.createElement("input");
    inpPdfLogoEnabled.type = "checkbox";
    inpPdfLogoEnabled.addEventListener("change", () => this._schedulePdfLogoSave());

    const pdfLogoEnabledWrap = document.createElement("div");
    pdfLogoEnabledWrap.style.display = "flex";
    pdfLogoEnabledWrap.style.alignItems = "center";
    pdfLogoEnabledWrap.append(inpPdfLogoEnabled);

    const inpPdfLogoFile = document.createElement("input");
    inpPdfLogoFile.type = "file";
    inpPdfLogoFile.accept = "image/png,image/jpeg,image/bmp";
    inpPdfLogoFile.addEventListener("change", async () => {
      await this._handlePdfLogoFileInput();
    });

    const pdfLogoPreviewWrap = document.createElement("div");
    pdfLogoPreviewWrap.style.display = "flex";
    pdfLogoPreviewWrap.style.alignItems = "center";
    pdfLogoPreviewWrap.style.gap = "10px";

    // --- Dummy-Platzhalter (wenn kein Logo gesetzt) ---
    const pdfLogoDummy = document.createElement("div");
    pdfLogoDummy.style.width = "180px";
    pdfLogoDummy.style.height = "80px";
    pdfLogoDummy.style.border = "1px solid #ddd";
    pdfLogoDummy.style.borderRadius = "6px";
    pdfLogoDummy.style.background = "#f0f0f0";
    pdfLogoDummy.style.display = "flex";
    pdfLogoDummy.style.alignItems = "center";
    pdfLogoDummy.style.justifyContent = "center";
    pdfLogoDummy.style.color = "#666";
    pdfLogoDummy.style.fontSize = "12px";
    pdfLogoDummy.style.fontWeight = "700";
    pdfLogoDummy.style.textAlign = "center";
    pdfLogoDummy.style.padding = "6px";
    pdfLogoDummy.style.boxSizing = "border-box";
    pdfLogoDummy.textContent = "Hier den Text anpassen";

    const imgPdfLogoPreview = document.createElement("img");
    imgPdfLogoPreview.style.maxWidth = "180px";
    imgPdfLogoPreview.style.maxHeight = "80px";
    imgPdfLogoPreview.style.border = "1px solid #ddd";
    imgPdfLogoPreview.style.borderRadius = "6px";
    imgPdfLogoPreview.style.background = "#fafafa";
    imgPdfLogoPreview.style.display = "none";

    const btnPdfLogoRemove = document.createElement("button");
    btnPdfLogoRemove.textContent = "Logo entfernen";
    btnPdfLogoRemove.onclick = () => {
      this._setPdfLogoDataUrl("");
      this._setPdfLogoFilePath("");
    };

    pdfLogoPreviewWrap.append(pdfLogoDummy, imgPdfLogoPreview, btnPdfLogoRemove);

    const pdfLogoPath = document.createElement("input");
    pdfLogoPath.type = "text";
    pdfLogoPath.readOnly = true;
    pdfLogoPath.placeholder = "Kein Logo gewaehlt";
    pdfLogoPath.style.width = "100%";

    const inpPdfLogoWidth = document.createElement("input");
    inpPdfLogoWidth.type = "number";
    inpPdfLogoWidth.min = "10";
    inpPdfLogoWidth.max = "60";
    inpPdfLogoWidth.step = "1";
    inpPdfLogoWidth.style.width = "100%";
    inpPdfLogoWidth.addEventListener("input", () => {
      this._schedulePdfLogoSave();
      this._updatePdfLogoQuality();
    });

    const inpPdfLogoTop = document.createElement("input");
    inpPdfLogoTop.type = "number";
    inpPdfLogoTop.min = "0";
    inpPdfLogoTop.max = "30";
    inpPdfLogoTop.step = "1";
    inpPdfLogoTop.style.width = "100%";
    inpPdfLogoTop.addEventListener("input", () => {
      this._schedulePdfLogoSave();
      this._updatePdfLogoQuality();
    });

    const inpPdfLogoRight = document.createElement("input");
    inpPdfLogoRight.type = "number";
    inpPdfLogoRight.min = "0";
    inpPdfLogoRight.max = "30";
    inpPdfLogoRight.step = "1";
    inpPdfLogoRight.style.width = "100%";
    inpPdfLogoRight.addEventListener("input", () => {
      this._schedulePdfLogoSave();
      this._updatePdfLogoQuality();
    });

    const pdfLogoQuality = document.createElement("div");
    pdfLogoQuality.style.marginTop = "6px";
    pdfLogoQuality.style.fontSize = "12px";
    pdfLogoQuality.style.opacity = "0.85";

    pdfLogoBox.append(
      pdfLogoTitle,
      mkRow("Logo im PDF anzeigen", pdfLogoEnabledWrap),
      mkRow("Logo-Datei", inpPdfLogoFile),
      mkRow("Dateipfad", pdfLogoPath),
      mkRow("Vorschau", pdfLogoPreviewWrap),
      mkRow("Logo-Breite (mm)", inpPdfLogoWidth),
      mkRow("Abstand oben (mm)", inpPdfLogoTop),
      mkRow("Abstand rechts (mm)", inpPdfLogoRight),
      pdfLogoQuality
    );

    const pdfSettingsBox = document.createElement("div");    applyPopupCardStyle(pdfSettingsBox);    pdfSettingsBox.style.padding = "10px";    pdfSettingsBox.style.maxWidth = "720px";    pdfSettingsBox.style.marginTop = "10px";
    const pdfSettingsTitle = document.createElement("div");
    pdfSettingsTitle.textContent = "PDF-Einstellungen";
    pdfSettingsTitle.style.fontWeight = "bold";
    pdfSettingsTitle.style.marginBottom = "6px";

    const pdfHeaderTitle = document.createElement("div");
    pdfHeaderTitle.textContent = "Protokollkopf (PDF)";
    pdfHeaderTitle.style.fontWeight = "bold";
    pdfHeaderTitle.style.margin = "8px 0 6px";

    const inpPdfProtocolTitle = document.createElement("input");
    inpPdfProtocolTitle.type = "text";
    inpPdfProtocolTitle.placeholder = "Baubesprechung";
    inpPdfProtocolTitle.style.width = "100%";
    inpPdfProtocolTitle.addEventListener("input", () => this._schedulePdfSettingsSave());

    const inpPdfTrafficLightAll = document.createElement("input");
    inpPdfTrafficLightAll.type = "checkbox";
    inpPdfTrafficLightAll.addEventListener("change", () => this._schedulePdfSettingsSave());

    const inpPdfProtocolsDir = document.createElement("input");
    inpPdfProtocolsDir.type = "text";
    inpPdfProtocolsDir.readOnly = true;
    inpPdfProtocolsDir.placeholder = "Noch kein Speicherort ausgewaehlt";
    inpPdfProtocolsDir.style.width = "100%";

    const btnPdfProtocolsBrowse = document.createElement("button");
    btnPdfProtocolsBrowse.textContent = "Durchsuchen...";
    btnPdfProtocolsBrowse.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.selectDirectory !== "function") {
        alert("Dialog-API fehlt (IPC noch nicht aktiv).");
        return;
      }

      const res = await api.selectDirectory({ title: "Speicherort Protokolle" });
      if (!res?.ok) {
        alert(res?.error || "Ordnerauswahl fehlgeschlagen");
        return;
      }
      if (res.canceled) return;
      const dir = Array.isArray(res.filePaths) ? res.filePaths[0] : "";
      if (!dir) return;
      inpPdfProtocolsDir.value = dir;
      await this._savePdfSettings();
    };

    const protocolsRow = document.createElement("div");
    protocolsRow.style.display = "flex";
    protocolsRow.style.gap = "8px";
    protocolsRow.style.alignItems = "center";
    protocolsRow.append(inpPdfProtocolsDir, btnPdfProtocolsBrowse);

    const pdfFooterTitle = document.createElement("div");
    pdfFooterTitle.textContent = "Protokoll-Fuss (PDF)";
    pdfFooterTitle.style.fontWeight = "bold";
    pdfFooterTitle.style.margin = "10px 0 6px";

    const pdfFooterCaption = document.createElement("div");
    pdfFooterCaption.textContent = "Aufgestellt:";
    pdfFooterCaption.style.fontWeight = "600";
    pdfFooterCaption.style.marginBottom = "6px";

    const btnPdfFooterUseUserData = document.createElement("button");
    btnPdfFooterUseUserData.textContent = "Uebernehmen";
    applyPopupButtonStyle(btnPdfFooterUseUserData);
    btnPdfFooterUseUserData.onclick = async () => {
      this.pdfFooterUseUserData = true;
      this._applyPdfSettingsInputs({
        protocolTitle: this.inpPdfProtocolTitle?.value || "",
        trafficLightAllEnabled: this.inpPdfTrafficLightAll?.checked || false,
        footerUseUserData: this.pdfFooterUseUserData,
        footerPlace: "",
        footerDate: "",
        footerName1: "",
        footerName2: "",
        footerRecorder: "",
        footerStreet: "",
        footerZip: "",
        footerCity: "",
      });
      this._applyPdfFooterUserDefaultsFromUser();
      this._applyPdfFooterPlaceDateDefaults({
        city: this.inpUserCity?.value ?? this.userCity ?? "",
      });
      this._schedulePdfSettingsSave();
    };

    const inpPdfFooterPlace = document.createElement("input");
    inpPdfFooterPlace.type = "text";
    inpPdfFooterPlace.placeholder = "Ort";
    inpPdfFooterPlace.style.width = "100%";
    inpPdfFooterPlace.addEventListener("input", () => this._schedulePdfSettingsSave());

    const inpPdfFooterDate = document.createElement("input");
    inpPdfFooterDate.type = "text";
    inpPdfFooterDate.placeholder = "Datum";
    inpPdfFooterDate.style.width = "100%";
    inpPdfFooterDate.addEventListener("input", () => this._schedulePdfSettingsSave());

    const inpPdfFooterName1 = document.createElement("input");
    inpPdfFooterName1.type = "text";
    inpPdfFooterName1.placeholder = "Name1";
    inpPdfFooterName1.style.width = "100%";
    inpPdfFooterName1.addEventListener("input", () => this._schedulePdfSettingsSave());

    const inpPdfFooterName2 = document.createElement("input");
    inpPdfFooterName2.type = "text";
    inpPdfFooterName2.placeholder = "Name2";
    inpPdfFooterName2.style.width = "100%";
    inpPdfFooterName2.addEventListener("input", () => this._schedulePdfSettingsSave());

    const inpPdfFooterRecorder = document.createElement("input");
    inpPdfFooterRecorder.type = "text";
    inpPdfFooterRecorder.placeholder = "Protokollfuehrer";
    inpPdfFooterRecorder.style.width = "100%";
    inpPdfFooterRecorder.addEventListener("input", () => this._schedulePdfSettingsSave());

    const inpPdfFooterStreet = document.createElement("input");
    inpPdfFooterStreet.type = "text";
    inpPdfFooterStreet.placeholder = "Str./HsNr.";
    inpPdfFooterStreet.style.width = "100%";
    inpPdfFooterStreet.addEventListener("input", () => this._schedulePdfSettingsSave());

    const inpPdfFooterZip = document.createElement("input");
    inpPdfFooterZip.type = "text";
    inpPdfFooterZip.inputMode = "numeric";
    inpPdfFooterZip.placeholder = "PLZ";
    inpPdfFooterZip.style.width = "100%";
    inpPdfFooterZip.addEventListener("input", () => this._schedulePdfSettingsSave());

    const inpPdfFooterCity = document.createElement("input");
    inpPdfFooterCity.type = "text";
    inpPdfFooterCity.placeholder = "Ort";
    inpPdfFooterCity.style.width = "100%";
    inpPdfFooterCity.addEventListener("input", () => this._schedulePdfSettingsSave());

    pdfSettingsBox.append(
      pdfSettingsTitle,
      mkRow("Speicherort Protokolle", protocolsRow),
      pdfHeaderTitle,
      mkRow("Name des Protokolls", inpPdfProtocolTitle),
      pdfFooterTitle,
      pdfFooterCaption,
      mkRow("Nutzerdaten uebernehmen", btnPdfFooterUseUserData),
      mkRow("Ort (Ort, Datum)", inpPdfFooterPlace),
      mkRow("Datum", inpPdfFooterDate),
      mkRow("Name1", inpPdfFooterName1),
      mkRow("Name2", inpPdfFooterName2),
      mkRow("Protokollfuehrer", inpPdfFooterRecorder),
      mkRow("Str./HsNr.", inpPdfFooterStreet),
      mkRow("PLZ", inpPdfFooterZip),
      mkRow("Ort (Adresse)", inpPdfFooterCity)
    );

    const logosBox = document.createElement("div");
    applyPopupCardStyle(logosBox);
    logosBox.style.padding = "10px";
    logosBox.style.marginTop = "10px";
    logosBox.style.display = "inline-block";
    logosBox.style.width = "fit-content";
    logosBox.style.maxWidth = "100%";

    const logosHead = document.createElement("div");
    logosHead.style.display = "flex";
    logosHead.style.alignItems = "center";
    logosHead.style.justifyContent = "space-between";
    logosHead.style.gap = "10px";
    logosHead.style.marginBottom = "6px";

    const logosTitle = document.createElement("div");
    logosTitle.textContent = "Logos";
    logosTitle.style.fontWeight = "bold";

    const headerAdaptiveWrap = document.createElement("label");
    headerAdaptiveWrap.style.display = "inline-flex";
    headerAdaptiveWrap.style.alignItems = "center";
    headerAdaptiveWrap.style.gap = "6px";
    headerAdaptiveWrap.style.fontSize = "12px";
    const inpPrintHeaderAdaptive = document.createElement("input");
    inpPrintHeaderAdaptive.type = "checkbox";
    inpPrintHeaderAdaptive.checked = false;
    inpPrintHeaderAdaptive.addEventListener("change", () => {
      this._savePrintLogoSettings();
    });
    this.inpPrintHeaderAdaptive = inpPrintHeaderAdaptive;
    const headerAdaptiveLabel = document.createElement("span");
    headerAdaptiveLabel.textContent = "Kopfzeile anpassen";
    headerAdaptiveWrap.append(inpPrintHeaderAdaptive, headerAdaptiveLabel);
    logosHead.append(logosTitle, headerAdaptiveWrap);

    const logosScroller = document.createElement("div");
    logosScroller.style.width = "100%";
    logosScroller.style.maxWidth = "100%";
    logosScroller.style.overflowX = "auto";

    const logosGrid = document.createElement("div");
    logosGrid.style.display = "grid";
    logosGrid.style.gridTemplateColumns = "repeat(3, minmax(280px, 1fr))";
    logosGrid.style.gap = "12px";
    logosGrid.style.alignItems = "start";
    logosGrid.style.maxWidth = "100%";
    logosGrid.style.minWidth = "860px";
    logosGrid.style.overflow = "hidden";

    const buildPrintLogoSlot = (slotIndex) => {
      const idx = slotIndex + 1;
      const slotWrap = document.createElement("div");
      slotWrap.style.border = "1px solid #e2e8f0";
      slotWrap.style.borderRadius = "8px";
      slotWrap.style.padding = "10px";
      slotWrap.style.display = "grid";
      // Platz fuer Vorschau + vertikale Ausrichtung rechts daneben, damit nichts in die zweite Spalte ueberlappt.
      slotWrap.style.gridTemplateColumns = "172px minmax(0, 1fr)";
      slotWrap.style.gap = "10px";
      slotWrap.style.alignItems = "start";
      slotWrap.style.boxSizing = "border-box";
      slotWrap.style.minWidth = "320px";

      const previewCol = document.createElement("div");
      previewCol.style.display = "grid";
      previewCol.style.gap = "8px";

      const slotTitle = document.createElement("div");
      slotTitle.textContent = "Logo " + idx;
      slotTitle.style.fontWeight = "600";

      const previewFrame = document.createElement("div");
      previewFrame.style.width = "132px";
      previewFrame.style.height = "78px";
      previewFrame.style.border = "1px solid #ddd";
      previewFrame.style.borderRadius = "6px";
      previewFrame.style.background = "#f5f5f5";
      previewFrame.style.display = "flex";
      previewFrame.style.alignItems = "flex-end";
      previewFrame.style.justifyContent = "center";
      previewFrame.style.overflow = "hidden";
      previewFrame.style.cursor = "pointer";
      this.printLogoPreviewFrames[slotIndex] = previewFrame;

      const placeholder = document.createElement("div");
      placeholder.style.width = "100%";
      placeholder.style.height = "100%";
      placeholder.style.display = "flex";
      placeholder.style.alignItems = "center";
      placeholder.style.justifyContent = "center";
      placeholder.style.fontSize = "11px";
      placeholder.style.color = "#666";
      placeholder.style.textAlign = "center";
      placeholder.style.padding = "4px";
      placeholder.textContent = "Logo waehlen";
      this.printLogoPlaceholderEls[slotIndex] = placeholder;

      const img = document.createElement("img");
      img.style.width = "auto";
      img.style.height = "auto";
      img.style.maxWidth = "100%";
      img.style.objectFit = "contain";
      img.style.display = "none";
      this.printLogoPreviewImgs[slotIndex] = img;

      previewFrame.append(placeholder, img);
      const previewTopRow = document.createElement("div");
      previewTopRow.style.display = "flex";
      previewTopRow.style.alignItems = "center";
      previewTopRow.style.gap = "8px";

      const alignWrap = document.createElement("div");
      alignWrap.style.display = "grid";
      alignWrap.style.gap = "4px";
      alignWrap.style.justifyItems = "center";

      const alignTitle = document.createElement("div");
      alignTitle.textContent = "Orientierung";
      alignTitle.style.fontSize = "12px";
      alignTitle.style.opacity = "0.85";

      const alignChecks = document.createElement("div");
      alignChecks.style.display = "flex";
      alignChecks.style.gap = "10px";
      alignChecks.style.alignItems = "center";
      alignChecks.style.justifyContent = "center";

      const mkAlignCheck = (alignValue) => {
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = alignValue === "center";
        chk.addEventListener("change", () => {
          if (!chk.checked) {
            chk.checked = true;
            return;
          }
          this._applyPrintLogoAlign(slotIndex, alignValue);
          this._savePrintLogoSettings();
        });
        return chk;
      };

      const alignLeft = mkAlignCheck("left");
      const alignCenter = mkAlignCheck("center");
      const alignRight = mkAlignCheck("right");
      this.printLogoAlignChecks[slotIndex] = {
        left: alignLeft,
        center: alignCenter,
        right: alignRight,
      };
      alignChecks.append(alignLeft, alignCenter, alignRight);
      alignWrap.append(alignTitle, alignChecks);

      const vAlignChecks = document.createElement("div");
      vAlignChecks.style.display = "grid";
      vAlignChecks.style.gap = "8px";
      vAlignChecks.style.alignItems = "center";
      vAlignChecks.style.justifyItems = "center";

      const mkVAlignCheck = (alignValue) => {
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = alignValue === "middle";
        chk.addEventListener("change", () => {
          if (!chk.checked) {
            chk.checked = true;
            return;
          }
          this._applyPrintLogoVAlign(slotIndex, alignValue);
          this._savePrintLogoSettings();
        });
        return chk;
      };
      const vAlignTop = mkVAlignCheck("top");
      const vAlignMiddle = mkVAlignCheck("middle");
      const vAlignBottom = mkVAlignCheck("bottom");
      this.printLogoVAlignChecks[slotIndex] = {
        top: vAlignTop,
        middle: vAlignMiddle,
        bottom: vAlignBottom,
      };
      vAlignChecks.append(vAlignTop, vAlignMiddle, vAlignBottom);

      previewTopRow.append(previewFrame, vAlignChecks);
      previewCol.append(slotTitle, previewTopRow, alignWrap);

      const controlsCol = document.createElement("div");
      controlsCol.style.display = "grid";
      controlsCol.style.gap = "8px";
      controlsCol.style.minWidth = "0";

      const mkControlRow = (labelText, controlEl) => {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "72px minmax(0, 1fr)";
        row.style.gap = "8px";
        row.style.alignItems = "center";

        const label = document.createElement("div");
        label.textContent = labelText;
        label.style.fontSize = "12px";
        label.style.whiteSpace = "nowrap";

        row.append(label, controlEl);
        return row;
      };

      const inpEnabled = document.createElement("input");
      inpEnabled.type = "checkbox";
      this.printLogoEnabledInputs[slotIndex] = inpEnabled;

      const sizeSelect = document.createElement("select");
      sizeSelect.style.minWidth = "82px";
      sizeSelect.style.width = "82px";
      for (const opt of [
        { value: "small", label: "Klein" },
        { value: "medium", label: "Mittel" },
        { value: "large", label: "Gross" },
      ]) {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        sizeSelect.appendChild(option);
      }
      sizeSelect.value = "medium";
      sizeSelect.addEventListener("change", () => {
        this._applyPrintLogoSize(slotIndex, sizeSelect.value);
      });
      this.printLogoSizeSelects[slotIndex] = sizeSelect;

      const fileRow = document.createElement("div");
      fileRow.style.display = "flex";
      fileRow.style.flexWrap = "wrap";
      fileRow.style.gap = "8px";
      fileRow.style.alignItems = "center";

      const inpFile = document.createElement("input");
      inpFile.type = "file";
      inpFile.accept = "image/png,image/jpeg,image/jpg";
      inpFile.style.display = "none";
      inpFile.addEventListener("change", async () => {
        await this._handlePrintLogoFileInput(slotIndex);
      });
      this.printLogoFileInputs[slotIndex] = inpFile;
      previewFrame.onclick = () => {
        if (inpFile.disabled) return;
        inpFile.click();
      };

      const btnRemove = document.createElement("button");
      btnRemove.textContent = "Entfernen";
      applyPopupButtonStyle(btnRemove);
      btnRemove.style.fontSize = "11px";
      btnRemove.style.padding = "3px 6px";
      btnRemove.style.minHeight = "16px";
      btnRemove.style.alignSelf = "flex-start";
      btnRemove.onclick = () => {
        this._setPrintLogoDataUrl(slotIndex, "");
        if (this.printLogoEnabledInputs[slotIndex]) {
          this.printLogoEnabledInputs[slotIndex].checked = false;
        }
      };
      this.printLogoRemoveBtns[slotIndex] = btnRemove;
      fileRow.append(inpFile);

      const enabledRow = document.createElement("div");
      enabledRow.style.display = "inline-flex";
      enabledRow.style.alignItems = "center";
      enabledRow.style.gap = "8px";
      enabledRow.style.marginLeft = "10mm";
      const enabledLabel = document.createElement("span");
      enabledLabel.textContent = "Anzeigen";
      enabledLabel.style.fontSize = "12px";
      enabledRow.append(inpEnabled, enabledLabel);

      const sizeGroup = document.createElement("div");
      sizeGroup.style.display = "grid";
      sizeGroup.style.gap = "6px";
      sizeGroup.style.justifyItems = "start";
      sizeGroup.style.alignSelf = "end";
      sizeGroup.style.marginLeft = "10mm";
      sizeGroup.append(sizeSelect, btnRemove);

      controlsCol.append(
        enabledRow,
        fileRow,
        sizeGroup
      );

      slotWrap.append(previewCol, controlsCol);
      return slotWrap;
    };

    // Reihenfolge muss der PDF-Position entsprechen: links Logo 3, Mitte Logo 2, rechts Logo 1.
    logosGrid.append(
      buildPrintLogoSlot(2),
      buildPrintLogoSlot(1),
      buildPrintLogoSlot(0)
    );
    logosScroller.appendChild(logosGrid);
    logosBox.append(logosHead, logosScroller);
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.marginTop = "10px";

    const btnSave = document.createElement("button");
    btnSave.textContent = "Nutzerdaten speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });
    btnSave.onclick = async () => {
      await this._save();
    };

    actions.append(btnSave);


    userBox.append(actions);

    const rolesBox = document.createElement("div");    applyPopupCardStyle(rolesBox);    rolesBox.style.padding = "10px";    rolesBox.style.width = "600px";    rolesBox.style.maxWidth = "600px";    rolesBox.style.marginLeft = "0";    rolesBox.style.marginRight = "auto";    rolesBox.style.marginTop = "10px";    rolesBox.style.boxSizing = "border-box";
    const rolesHead = document.createElement("div");
    rolesHead.style.display = "flex";
    rolesHead.style.alignItems = "center";
    rolesHead.style.justifyContent = "space-between";
    rolesHead.style.gap = "8px";
    rolesHead.style.marginBottom = "6px";

    const rolesTitleWrap = document.createElement("div");
    rolesTitleWrap.style.display = "flex";
    rolesTitleWrap.style.alignItems = "center";
    rolesTitleWrap.style.gap = "8px";

    const rolesTitle = document.createElement("div");
    rolesTitle.textContent = "Firmenliste";
    rolesTitle.style.fontWeight = "bold";

    const roleMoveHint = document.createElement("div");
    roleMoveHint.textContent = "neue Position mit Pfeiltasten wählen";
    roleMoveHint.style.color = "#1e5fbf";
    roleMoveHint.style.fontSize = "16px";
    roleMoveHint.style.display = "none";
    roleMoveHint.style.whiteSpace = "nowrap";
    rolesTitleWrap.append(rolesTitle, roleMoveHint);

    const rolesHeadActions = document.createElement("div");
    rolesHeadActions.style.display = "flex";
    rolesHeadActions.style.gap = "6px";

    const btnRoleMove = document.createElement("button");
    btnRoleMove.textContent = "Schieben";
    applyPopupButtonStyle(btnRoleMove);
    btnRoleMove.onclick = () => this._toggleRoleMoveMode();

    const btnRoleDelete = document.createElement("button");
    btnRoleDelete.textContent = "Loeschen";
    applyPopupButtonStyle(btnRoleDelete, { variant: "danger" });
    btnRoleDelete.onclick = async () => {
      await this._deleteSelectedRole();
    };

    const btnRoleRename = document.createElement("button");
    btnRoleRename.textContent = "Umbenennen";
    applyPopupButtonStyle(btnRoleRename);
    btnRoleRename.onclick = () => this._startRenameSelectedRole();

    rolesHeadActions.append(btnRoleMove, btnRoleDelete, btnRoleRename);
    rolesHead.append(rolesTitleWrap, rolesHeadActions);

    const rolesHint = document.createElement("div");
    rolesHint.textContent = "Zeile markieren, Schieben aktivieren, dann mit Pfeilen verschieben. Enter beendet.";
    rolesHint.style.fontSize = "12px";
    rolesHint.style.opacity = "0.75";
    rolesHint.style.marginBottom = "8px";

    const rolesActions = document.createElement("div");
    rolesActions.style.display = "flex";
    rolesActions.style.gap = "8px";
    rolesActions.style.marginBottom = "8px";

    const inpAddRole = document.createElement("input");
    inpAddRole.type = "text";
    inpAddRole.placeholder = "Neue Kategorie...";
    inpAddRole.style.flex = "1";
    inpAddRole.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      await this._addRoleCategory();
    });

    const btnAddRole = document.createElement("button");
    btnAddRole.textContent = "Kategorie hinzufuegen";
    applyPopupButtonStyle(btnAddRole);
    btnAddRole.onclick = async () => {
      await this._addRoleCategory();
    };

    rolesActions.append(inpAddRole, btnAddRole);

    const roleList = document.createElement("div");
    roleList.tabIndex = 0;
    roleList.style.outline = "none";
    roleList.addEventListener("keydown", (e) => this._handleRoleKeyDown(e));
    rolesBox.append(rolesHead, rolesHint, rolesActions, roleList);

    const openThemePopup = () => {
      this._themeSaveMode = "user";
      this._openSettingsModal({
        title: "Farben einstellen",
        content: [themeBox],
        closeOnly: false,
        saveFn: async () => (await this._saveThemeSettings()) !== false,
      });
      this._applyThemePreviewFromInputs();
    };

    const openThemeDefaultsPopup = async () => {
      this._themeSaveMode = "startDefaults";
      await this._loadThemeStartDefaults();
      this._openSettingsModal({
        title: "Start-Defaults Farbschema",
        content: [themeBox],
        closeOnly: false,
        saveFn: async () => (await this._saveThemeStartDefaults()) !== false,
      });
      this._applyThemePreviewFromInputs();
    };

    const btnOpenThemePopup = document.createElement("button");
    btnOpenThemePopup.type = "button";
    btnOpenThemePopup.textContent = "Farbschema öffnen";
    btnOpenThemePopup.style.width = "100%";
    applyPopupButtonStyle(btnOpenThemePopup, { variant: "primary" });
    btnOpenThemePopup.onclick = () => openThemePopup();

    const themeBtnWrap = document.createElement("div");
    themeBtnWrap.style.width = "calc(100% - 1cm)";
    themeBtnWrap.style.marginLeft = "auto";
    themeBtnWrap.style.display = "flex";
    themeBtnWrap.style.justifyContent = "center";
    themeBtnWrap.append(btnOpenThemePopup);

    const userRightCol = document.createElement("div");
    userRightCol.style.display = "grid";
    userRightCol.style.gridTemplateColumns = "1fr";
    userRightCol.style.gap = "10px";
    userRightCol.style.alignContent = "start";
    userRightCol.append(fontScaleBox, themeBtnWrap);

    const userTopRow = document.createElement("div");
    userTopRow.style.display = "grid";
    userTopRow.style.gridTemplateColumns = "minmax(0, 360px) minmax(0, 360px)";
    userTopRow.style.gap = "14px";
    userTopRow.style.alignItems = "start";
    userTopRow.style.width = "100%";
    userTopRow.style.maxWidth = "720px";
    userTopRow.style.marginTop = "10px";
    userTopRow.append(userBox, userRightCol);

    const openSettingsModal = ({ title, content, saveFn, closeOnly = false }) => {
      this._openSettingsModal({
        title,
        content: Array.isArray(content) ? content : [content],
        saveFn,
        closeOnly,
      });
    };

    const tileUser = mkTile({
      titleText: "Nutzereinstellungen",
      subText: "Nutzerdaten",
      onClick: async () => {
        await loadFontScaleSettings();
        openSettingsModal({
          title: "Nutzereinstellungen",
          content: [userTopRow],
          closeOnly: false,
          saveFn: async () => (await this._save()) !== false,
        });
        setTimeout(() => {
          try {
            const h = Math.round(userBox.getBoundingClientRect().height || 0);
            if (h > 0) fontScaleBox.style.height = `${Math.max(1, Math.round(h * 0.5))}px`;
          } catch (_e) {
            // ignore
          }
        }, 0);
      },
    });

    const tilePrint = mkTile({
      titleText: "Druckeinstellungen",
      subText: "PDF-Einstellungen & Kategorien",
      onClick: async () => {
        const tabWrap = document.createElement("div");

        const tabHead = document.createElement("div");
        tabHead.style.display = "flex";
        tabHead.style.gap = "8px";
        tabHead.style.flexWrap = "wrap";
        tabHead.style.rowGap = "8px";
        tabHead.style.marginBottom = "10px";

        const tabBtnPdf = document.createElement("button");
        tabBtnPdf.textContent = "PDF-Einstellungen";

        const tabBtnLogos = document.createElement("button");
        tabBtnLogos.textContent = "Logos";

        const tabBtnRoles = document.createElement("button");
        tabBtnRoles.textContent = "Firmenliste";

        const tabBtnPreRemarks = document.createElement("button");
        tabBtnPreRemarks.textContent = "Vorbemerkung";

        const btnSeitenlayout = document.createElement("button");
        btnSeitenlayout.type = "button";
        btnSeitenlayout.textContent = "Seitenlayout";
        applyPopupButtonStyle(btnSeitenlayout);

        const btnEmails = document.createElement("button");
        btnEmails.type = "button";
        btnEmails.textContent = "E-Mails";
        applyPopupButtonStyle(btnEmails);

        const applyTabButtonBase = (btn) => {
          btn.style.padding = "6px 10px";
          btn.style.borderRadius = "8px";
          btn.style.border = "1px solid rgba(0,0,0,0.18)";
          btn.style.fontWeight = "600";
          btn.style.cursor = "pointer";
          btn.style.minHeight = "30px";
          btn.style.boxShadow = "none";
          btn.style.transition = "background 120ms ease, box-shadow 120ms ease, border-color 120ms ease";
        };

        const applyHover = (btn) => {
          btn.onmouseenter = () => {
            const activeBtn =
              activeTab === "pdf" ? tabBtnPdf : activeTab === "logos" ? tabBtnLogos : tabBtnRoles;
            if (btn === activeBtn) return;
            btn.style.background = "#f7f9fc";
            btn.style.boxShadow = "0 1px 0 rgba(0,0,0,0.08)";
          };
          btn.onmouseleave = () => {
            applyTabStyles();
          };
        };

        applyTabButtonBase(tabBtnPdf);
        applyTabButtonBase(tabBtnLogos);
        applyTabButtonBase(tabBtnRoles);
        applyTabButtonBase(tabBtnPreRemarks);
        applyTabButtonBase(btnSeitenlayout);
        applyTabButtonBase(btnEmails);
        applyHover(tabBtnPdf);
        applyHover(tabBtnLogos);
        applyHover(tabBtnRoles);
        applyHover(btnSeitenlayout);
        applyHover(btnEmails);
        applyHover(tabBtnPreRemarks);

        const tabBody = document.createElement("div");
        tabBody.style.display = "grid";
        tabBody.style.gap = "10px";

        let activeTab = "pdf";
        const syncPrintSettingsModalWidth = () => {
          if (!this.settingsModalEl) return;
          if (activeTab === "logos") {
            this.settingsModalEl.style.width = "min(1280px, 95vw)";
          } else {
            this.settingsModalEl.style.width = "min(760px, calc(100vw - 24px))";
          }
        };

        const applyTabStyles = () => {
          const isPdf = activeTab === "pdf";
          const isLogos = activeTab === "logos";
          const isRoles = activeTab === "roles";

          tabBtnPdf.style.background = isPdf ? "#1976d2" : "#fff";
          tabBtnPdf.style.color = isPdf ? "white" : "#1565c0";
          tabBtnPdf.style.borderColor = isPdf ? "rgba(25,118,210,0.65)" : "rgba(0,0,0,0.18)";
          tabBtnPdf.style.boxShadow = isPdf ? "0 1px 0 rgba(0,0,0,0.12)" : "none";

          tabBtnLogos.style.background = isLogos ? "#1976d2" : "#fff";
          tabBtnLogos.style.color = isLogos ? "white" : "#1565c0";
          tabBtnLogos.style.borderColor = isLogos ? "rgba(25,118,210,0.65)" : "rgba(0,0,0,0.18)";
          tabBtnLogos.style.boxShadow = isLogos ? "0 1px 0 rgba(0,0,0,0.12)" : "none";

          tabBtnRoles.style.background = isRoles ? "#1976d2" : "#fff";
          tabBtnRoles.style.color = isRoles ? "white" : "#1565c0";
          tabBtnRoles.style.borderColor = isRoles ? "rgba(25,118,210,0.65)" : "rgba(0,0,0,0.18)";
          tabBtnRoles.style.boxShadow = isRoles ? "0 1px 0 rgba(0,0,0,0.12)" : "none";

          tabBtnPreRemarks.style.background = "#fff";
          tabBtnPreRemarks.style.color = "#1565c0";
          tabBtnPreRemarks.style.borderColor = "rgba(0,0,0,0.18)";
          tabBtnPreRemarks.style.boxShadow = "none";
        };

        const openPrintLayoutModal = async () => {
          await loadPrintV2LayoutSettings();
          this._openSettingsModal({
            title: "Druck-Layout",
            content: [printV2LayoutBox],
            closeOnly: true,
          });
        };


        const openEmailsModal = async () => {
          const api = window.bbmDb || {};

          const SUBJECT_PLACEHOLDER =
            "{projectNumber} - {projectShortName}  |  {protocolTitle} #{meetingIndex} - {meetingDate}";
          const BODY_PLACEHOLDER =
            "Sehr geehrte Damen und Herren,\n" +
            "anbei erhalten Sie das neue Protokoll für das oben genannte Projekt mit der Bitte um Beachtung und Veranlassung.";

          // Gespeicherte Werte laden (falls vorhanden)
          let subjectValue = "";
          let bodyValue = "";
          if (typeof api.appSettingsGetMany === "function") {
            try {
              const res = await api.appSettingsGetMany(["email_subject", "email_body"]);
              if (res?.ok) {
                const data = res.data || {};
                const s = String(data.email_subject ?? "");
                const b = String(data.email_body ?? "");
                if (s.trim()) subjectValue = s;
                if (b.trim()) bodyValue = b;
              }
            } catch {
              // ignore
            }
          }

          const emailsBox = document.createElement("div");
          emailsBox.style.display = "grid";
          emailsBox.style.gap = "12px";
          emailsBox.style.padding = "6px";
          emailsBox.style.justifyItems = "start";
          emailsBox.style.fontFamily = "Calibri, Arial, sans-serif";

          // Betreff
          const subjectWrap = document.createElement("div");
          subjectWrap.style.display = "grid";
          subjectWrap.style.gap = "6px";

          const subjectLabel = document.createElement("div");
          subjectLabel.textContent = "Betreff";
          subjectLabel.style.fontWeight = "700";
          subjectLabel.style.color = "#1f2937";

          const inpSubject = document.createElement("input");
          inpSubject.type = "text";
          inpSubject.value = subjectValue; // leer, wenn nichts gespeichert -> Placeholder sichtbar
          inpSubject.placeholder = SUBJECT_PLACEHOLDER;
          inpSubject.style.width = "17cm";
          inpSubject.style.maxWidth = "100%";
          inpSubject.style.boxSizing = "border-box";
          inpSubject.style.padding = "8px 10px";
          inpSubject.style.borderRadius = "10px";
          inpSubject.style.border = "1px solid rgba(0,0,0,0.18)";
          inpSubject.style.outline = "none";
          inpSubject.style.fontFamily = "Calibri, Arial, sans-serif";

          // Controlled input: State nur lokal, keine Persistenz
          let subjectState = inpSubject.value || "";
          inpSubject.addEventListener("input", () => {
            subjectState = inpSubject.value || "";
          });

          const subjectHint = document.createElement("div");
          subjectHint.textContent =
            "Platzhalter: {projectNumber}, {projectShortName}, {protocolTitle}, {meetingIndex}, {meetingDate}";
          subjectHint.style.fontSize = "12px";
          subjectHint.style.opacity = "0.8";
          subjectHint.style.color = "#374151";

          subjectWrap.append(subjectLabel, inpSubject, subjectHint);

          // Body
          const bodyWrap = document.createElement("div");
          bodyWrap.style.display = "grid";
          bodyWrap.style.gap = "6px";

          const bodyLabelRow = document.createElement("div");
          bodyLabelRow.style.display = "flex";
          bodyLabelRow.style.alignItems = "center";
          bodyLabelRow.style.justifyContent = "space-between";
          bodyLabelRow.style.width = "17cm";
          bodyLabelRow.style.maxWidth = "100%";

          const bodyLabel = document.createElement("div");
          bodyLabel.textContent = "E-Mail Text";
          bodyLabel.style.fontWeight = "700";
          bodyLabel.style.color = "#1f2937";

          const remainingBadge = document.createElement("div");
          remainingBadge.style.fontSize = "12px";
          remainingBadge.style.opacity = "0.85";
          remainingBadge.style.userSelect = "none";

          const inpBody = document.createElement("textarea");
          inpBody.value = bodyValue; // leer, wenn nichts gespeichert -> Placeholder sichtbar
          inpBody.placeholder = BODY_PLACEHOLDER;
          inpBody.style.width = "17cm";
          inpBody.style.height = "6cm";
          inpBody.style.maxWidth = "100%";
          inpBody.style.boxSizing = "border-box";
          inpBody.style.padding = "8px 10px";
          inpBody.style.borderRadius = "10px";
          inpBody.style.border = "1px solid rgba(0,0,0,0.18)";
          inpBody.style.outline = "none";
          inpBody.style.resize = "none";
          inpBody.style.fontFamily = "Calibri, Arial, sans-serif";
          inpBody.maxLength = 300;

          let bodyState = inpBody.value || "";
          const syncRemaining = () => {
            const len = (inpBody.value || "").length;
            const rest = Math.max(0, 300 - len);
            remainingBadge.textContent = `${rest} Zeichen übrig`;
          };
          syncRemaining();

          inpBody.addEventListener("input", () => {
            // maxLength greift i. d. R. bereits, aber zur Sicherheit:
            if ((inpBody.value || "").length > 300) {
              inpBody.value = (inpBody.value || "").slice(0, 300);
            }
            bodyState = inpBody.value || "";
            syncRemaining();
          });

          bodyLabelRow.append(bodyLabel, remainingBadge);
          bodyWrap.append(bodyLabelRow, inpBody);

          emailsBox.append(subjectWrap, bodyWrap);

          this._openSettingsModal({
            title: "E-Mails",
            content: [emailsBox],
            closeOnly: false,
            saveFn: async () => {
              // Werte direkt aus den Feldern lesen (garantiert der aktuell sichtbare Text)
              const rawSubject = String(inpSubject?.value ?? "");
              const rawBody = String(inpBody?.value ?? "");
              const tSubject = rawSubject.trim();
              const tBody = rawBody.trim();

              // Wenn leer -> zurücksetzen auf "" (Placeholder erscheint wieder)
              const payload = {
                email_subject: tSubject ? rawSubject : "",
                email_body: tBody ? rawBody : "",
              };

              const saveApi = window.bbmDb || {};
              if (typeof saveApi.appSettingsSetMany !== "function") {
                alert("Settings-API fehlt (appSettingsSetMany).");
                return false;
              }

              const res = await saveApi.appSettingsSetMany(payload);
              if (!res?.ok) {
                alert(res?.error || "Speichern fehlgeschlagen.");
                return false;
              }

              // State aktualisieren (rein lokal)
              subjectState = rawSubject;
              bodyState = rawBody;
              return true;
            },
          });
        };

        const showTab = (next) => {
          activeTab = next;
          tabBody.innerHTML = "";
          if (activeTab === "pdf") {
            tabBody.append(pdfSettingsBox);
            this._settingsModalCloseOnly = false;
          } else if (activeTab === "logos") {
            tabBody.append(logosBox);
            this._settingsModalCloseOnly = false;
          } else {
            tabBody.append(rolesBox);
            this._settingsModalCloseOnly = false;
            if (this.roleListEl) {
              setTimeout(() => {
                try {
                  this.roleListEl.focus();
                } catch {
                  // ignore
                }
              }, 0);
            }
          }
          applyTabStyles();
          syncPrintSettingsModalWidth();
        };

        tabBtnPdf.onclick = () => showTab("pdf");
        tabBtnLogos.onclick = () => showTab("logos");
        tabBtnRoles.onclick = () => showTab("roles");
        tabBtnPreRemarks.onclick = async () => {
          const ok = await this._openPdfPreRemarksPopup();
          if (ok === true) this._setMsg("Vorbemerkung gespeichert");
        };

        tabHead.append(tabBtnPdf, tabBtnLogos, tabBtnRoles, tabBtnPreRemarks, btnSeitenlayout, btnEmails);
        btnSeitenlayout.onclick = async () => {
          this._closeSettingsModal();
          await openPrintLayoutModal();
        };

        btnEmails.onclick = async () => {
          this._closeSettingsModal();
          await openEmailsModal();
        };

        tabWrap.append(tabHead, tabBody);

        showTab("pdf");

        this._openSettingsModal({
          title: "Druckeinstellungen",
          content: [tabWrap],
          closeOnly: false,
          saveFn: async () => {
            if (activeTab === "roles") {
              return (await this._saveRoleMeta()) !== false;
            }
            if (activeTab === "logos") {
              return (await this._savePrintLogoSettings()) !== false;
            }
            return (await this._savePdfSettings()) !== false;
          },
        });
        syncPrintSettingsModalWidth();
      },
    });

    const tileLicense = mkTile({
      titleText: "Lizenz",
      subText: "Lizenzstatus & Verwaltung",
      onClick: async () => {
        const content = this._createLicenseSettingsContent();
        openSettingsModal({
          title: "Lizenz",
          content: [content],
          closeOnly: true,
        });
      },
    });

    const tileDev = mkTile({
      titleText: "Entwicklung",
      subText: "Versionierung, Farben einstellen, DB-Diagnose",
      onClick: async () => {
        const api = window.bbmDb || {};
        if (typeof api.appIsPackaged === "function") {
          const packagedRes = await api.appIsPackaged();
          if (packagedRes?.ok && packagedRes.isPackaged) {
            alert("Entwicklung ist nur in der Entwicklerversion verfuegbar.");
            return;
          }
        }
        this._devPopupOpen = true;
        await loadDbDiagnostics();
        await loadTopLimitSettings();
        await loadTrialSettings();
        await loadVersioningData();

        if (versionBox) {
          versionBox.style.display = "grid";
        }

        const devTabWrap = document.createElement("div");
        devTabWrap.style.display = "grid";
        devTabWrap.style.gap = "10px";
        devTabWrap.style.minWidth = "min(640px, calc(100vw - 80px))";
        devTabWrap.style.maxWidth = "920px";

        const devTabHead = document.createElement("div");
        devTabHead.style.display = "flex";
        devTabHead.style.gap = "8px";
        devTabHead.style.flexWrap = "wrap";
        devTabHead.style.rowGap = "8px";
        devTabHead.style.marginBottom = "8px";

        const devTabBody = document.createElement("div");
        devTabBody.style.display = "grid";
        devTabBody.style.gap = "10px";

        const tabVersion = document.createElement("div");
        tabVersion.style.display = "grid";
        tabVersion.style.gap = "10px";
        tabVersion.append(versionBox, buildChannelBox, devDefaultsBox, trialBox);

        const tabLicense = document.createElement("div");
        tabLicense.style.display = "grid";
        tabLicense.style.gap = "10px";
        tabLicense.append(licenseBox, licenseGenBox);

        const tabDb = document.createElement("div");
        tabDb.style.display = "grid";
        tabDb.style.gap = "10px";
        tabDb.append(dbDiagBox);

        const tabWhisper = document.createElement("div");
    tabWhisper.style.display = "grid";
    tabWhisper.style.gap = "10px";
    tabWhisper.append(whisperBox);

    const tabTools = document.createElement("div");
        tabTools.style.display = "grid";
        tabTools.style.gap = "10px";
        tabTools.append(dictionaryBox, printBox, topsLimitBox);

        const devTabs = [
          { key: "version", label: "Versionierung", el: tabVersion },
          { key: "license", label: "Lizenz / bearbeiten", el: tabLicense },
          { key: "db", label: "DB-Diagnose", el: tabDb },
          { key: "whisper", label: "Whisper Modelle", el: tabWhisper },
          { key: "tools", label: "W?rterbuch / Druck / TOP-Liste", el: tabTools },
        ];

        const tabButtons = new Map();
        let whisperLoaded = false;
        const setDevTab = (key) => {
          if (key === "whisper" && !whisperLoaded) {
            whisperLoaded = true;
            if (typeof loadWhisperQualitySettings === "function") {
              loadWhisperQualitySettings();
            }
          }
          devTabs.forEach((tab) => {
            const isActive = tab.key === key;
            tab.el.style.display = isActive ? "grid" : "none";
            const btn = tabButtons.get(tab.key);
            if (btn) {
              btn.disabled = isActive;
              btn.style.opacity = isActive ? "0.85" : "1";
            }
          });
        };

        const makeDevTabButton = (label, key) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = label;
          applyPopupButtonStyle(btn);
          btn.onclick = () => setDevTab(key);
          tabButtons.set(key, btn);
          return btn;
        };

        devTabHead.append(
          makeDevTabButton("Versionierung", "version"),
          makeDevTabButton("Lizenz / bearbeiten", "license"),
          makeDevTabButton("DB-Diagnose", "db"),
          makeDevTabButton("Whisper Modelle", "whisper"),
          makeDevTabButton("W?rterbuch / Druck / TOP-Liste", "tools")
        );

        devTabBody.append(tabVersion, tabLicense, tabDb, tabWhisper, tabTools);
        devTabWrap.append(devTabHead, devTabBody);
        setDevTab("version");

        this._openSettingsModal({
          title: "Entwicklung",
          content: [devTabWrap],
          closeOnly: false,
          saveFn: async () => {
            const okTops = (await saveTopLimitSettings()) !== false;
            const okTrial = (await saveTrialSettings()) !== false;
            return okTops && okTrial;
          },
        });
      },
    });

    tiles.append(tileUser, tilePrint, tileLicense);
    (async () => {
      const api = window.bbmDb || {};
      if (typeof api.appIsPackaged !== "function") {
        return;
      }
      const packagedRes = await api.appIsPackaged();
      if (packagedRes?.ok && packagedRes.isPackaged === false) {
        tiles.append(tileDev);
      }
    })();

    // Overlay im Body, damit kein Header-Stacking-Context stört
    const settingsOverlay = createPopupOverlay({ background: "rgba(0,0,0,0.35)" });
    settingsOverlay.style.alignItems = "center";
    settingsOverlay.style.justifyContent = "center";
    const closeSettingsOverlay = () => {
      if (this._settingsModalCloseOnly) {
        this._closeSettingsModal();
        return;
      }
      this._runSettingsModalSave({ closeOnSuccess: true });
    };
    registerPopupCloseHandlers(settingsOverlay, closeSettingsOverlay);

    const settingsModal = document.createElement("div");
    settingsModal.style.width = "min(980px, calc(100vw - 24px))";
    settingsModal.style.maxHeight = "calc(100vh - 24px)";
    settingsModal.style.display = "flex";
    settingsModal.style.flexDirection = "column";
    settingsModal.style.overflow = "hidden";
    settingsModal.style.background = "#fff";
    applyPopupCardStyle(settingsModal);
    settingsModal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
    settingsModal.style.padding = "0";
    settingsModal.style.fontFamily =
      'Calibri, Arial, sans-serif';
    settingsModal.tabIndex = -1;

    const settingsHead = document.createElement("div");
    settingsHead.style.display = "flex";
    settingsHead.style.alignItems = "center";
    settingsHead.style.justifyContent = "space-between";
    settingsHead.style.gap = "10px";
    settingsHead.style.padding = "12px";
    settingsHead.style.borderBottom = "1px solid #e2e8f0";

    const settingsTitle = document.createElement("div");
    settingsTitle.style.fontWeight = "bold";
    settingsTitle.textContent = "";

    const settingsClose = document.createElement("button");
    settingsClose.textContent = "X";
    applyPopupButtonStyle(settingsClose);
    settingsClose.onclick = async () => {
      if (this._settingsModalCloseOnly) {
        this._closeSettingsModal();
        return;
      }
      await this._runSettingsModalSave({ closeOnSuccess: true });
    };

    settingsHead.append(settingsTitle, settingsClose);

    const settingsBody = document.createElement("div");
    settingsBody.style.display = "grid";
    settingsBody.style.gap = "10px";
    settingsBody.style.flex = "1 1 auto";
    settingsBody.style.minHeight = "0";
    settingsBody.style.overflow = "auto";
    settingsBody.style.padding = "12px";

    const settingsFooter = document.createElement("div");
    settingsFooter.style.borderTop = "1px solid #e2e8f0";
    settingsFooter.style.padding = "10px 12px";

    const settingsFooterInner = document.createElement("div");
    settingsFooterInner.style.display = "flex";
    settingsFooterInner.style.justifyContent = "flex-end";
    settingsFooterInner.style.gap = "8px";
    settingsFooterInner.style.width = "100%";
    settingsFooterInner.style.maxWidth = "720px";

    const settingsSave = document.createElement("button");
    settingsSave.textContent = "Speichern";
    applyPopupButtonStyle(settingsSave, { variant: "primary" });
    settingsSave.onclick = async () => {
      if (this._settingsModalCloseOnly) {
        this._closeSettingsModal();
        return;
      }
      await this._runSettingsModalSave({ closeOnSuccess: true });
    };

    settingsFooterInner.append(settingsSave);
    settingsFooter.append(settingsFooterInner);

    settingsModal.append(settingsHead, settingsBody, settingsFooter);
    settingsOverlay.appendChild(settingsModal);

    const delOverlay = createPopupOverlay({ background: "rgba(0,0,0,0.35)" });
    delOverlay.style.alignItems = "center";
    delOverlay.style.justifyContent = "center";

    const delBox = document.createElement("div");
    delBox.style.width = "min(520px, calc(100vw - 24px))";
    delBox.style.background = "#fff";
    applyPopupCardStyle(delBox);    delBox.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";    delBox.style.padding = "12px";

    const delMsg = document.createElement("div");
    delMsg.style.marginBottom = "12px";

    const delActions = document.createElement("div");
    delActions.style.display = "flex";
    delActions.style.gap = "8px";
    delActions.style.justifyContent = "flex-end";

    const delCancel = document.createElement("button");
    delCancel.textContent = "Abbrechen";
    delCancel.onclick = () => {
      this._resolveDeleteConfirm(false);
    };

    const delOk = document.createElement("button");
    delOk.textContent = "Loeschen";
    delOk.style.background = "#c62828";
    delOk.style.color = "white";
    delOk.style.border = "1px solid rgba(0,0,0,0.25)";
    delOk.style.borderRadius = "6px";
    delOk.style.padding = "6px 10px";
    delOk.onclick = () => {
      this._resolveDeleteConfirm(true);
    };
    delOverlay.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._resolveDeleteConfirm(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this._resolveDeleteConfirm(false);
      }
    });

    delActions.append(delCancel, delOk);
    delBox.append(delMsg, delActions);
    delOverlay.append(delBox);

    const renameOverlay = createPopupOverlay({ background: "rgba(0,0,0,0.35)" });
    renameOverlay.style.alignItems = "center";
    renameOverlay.style.justifyContent = "center";
    renameOverlay.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._resolveRename(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this._resolveRename(false);
      }
    });

    const renameBox = document.createElement("div");
    renameBox.style.width = "min(520px, calc(100vw - 24px))";
    renameBox.style.background = "#fff";
    applyPopupCardStyle(renameBox);    renameBox.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";    renameBox.style.padding = "12px";

    const renameTitle = document.createElement("div");
    renameTitle.textContent = "Kategorie umbenennen";
    renameTitle.style.fontWeight = "bold";
    renameTitle.style.marginBottom = "8px";

    const renameInput = document.createElement("input");
    renameInput.type = "text";
    renameInput.style.width = "100%";
    renameInput.style.marginBottom = "12px";
    renameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._resolveRename(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this._resolveRename(false);
      }
    });

    const renameActions = document.createElement("div");
    renameActions.style.display = "flex";
    renameActions.style.gap = "8px";
    renameActions.style.justifyContent = "flex-end";

    const renameCancel = document.createElement("button");
    renameCancel.textContent = "Abbrechen";
    renameCancel.onclick = () => {
      this._resolveRename(false);
    };

    const renameOk = document.createElement("button");
    renameOk.textContent = "Speichern";
    renameOk.onclick = () => {
      this._resolveRename(true);
    };

    renameActions.append(renameCancel, renameOk);
    renameBox.append(renameTitle, renameInput, renameActions);
    renameOverlay.append(renameBox);

    root.append(
      head,
      tiles,
      creditLine
    );

    document.body.append(settingsOverlay, delOverlay, renameOverlay);

    this.root = root;
    this.msgEl = msg;
    this.inpUserName1 = inpUserName1;
    this.inpUserName2 = inpUserName2;
    this.inpUserStreet = inpUserStreet;
    this.inpUserZip = inpUserZip;
    this.inpUserCity = inpUserCity;
    this.inpLogoSize = inpLogoSize;
    this.inpLogoPadLeft = inpLogoPadLeft;
    this.inpLogoPadTop = inpLogoPadTop;
    this.inpLogoPadRight = inpLogoPadRight;
    this.inpLogoPosition = inpLogoPosition;
    this.inpLogoEnabled = inpLogoEnabled;
    this.inpThemeHeaderTone = null;
    this.inpThemeSidebarTone = null;
    this.inpThemeMainTone = null;
    this.inpThemeHeaderBaseColor = null;
    this.inpThemeSidebarBaseColor = null;
    this.inpThemeMainBaseColor = null;
    this.inpThemeHeaderName = null;
    this.inpThemeSidebarName = null;
    this.inpThemeMainName = null;
    this.inpThemeHeaderR = themeHeader.rInp;
    this.inpThemeHeaderG = themeHeader.gInp;
    this.inpThemeHeaderB = themeHeader.bInp;
    this.inpThemeSidebarR = themeSidebar.rInp;
    this.inpThemeSidebarG = themeSidebar.gInp;
    this.inpThemeSidebarB = themeSidebar.bInp;
    this.inpThemeMainR = themeMain.rInp;
    this.inpThemeMainG = themeMain.gInp;
    this.inpThemeMainB = themeMain.bInp;
    this.inpThemeHeaderDefault = null;
    this.inpThemeSidebarDefault = null;
    this.inpThemeMainDefault = null;
    this.inpThemeGlobalDefault = null;
    this.lblThemeHeaderTone = null;
    this.lblThemeSidebarTone = null;
    this.lblThemeMainTone = null;
    this.previewThemeHeaderColor = themeHeader.preview;
    this.previewThemeSidebarColor = themeSidebar.preview;
    this.previewThemeMainColor = themeMain.preview;
    this.pickThemeHeaderColor = null;
    this.pickThemeSidebarColor = null;
    this.pickThemeMainColor = null;
    this.lblThemeHeaderColorValue = themeHeader.colorValue;
    this.lblThemeSidebarColorValue = themeSidebar.colorValue;
    this.lblThemeMainColorValue = themeMain.colorValue;
    this.inpThemeHeaderHex = themeHeader.hexInp;
    this.inpThemeSidebarHex = themeSidebar.hexInp;
    this.inpThemeMainHex = themeMain.hexInp;
    this.selThemeHeaderModel = themeHeader.modelSel;
    this.selThemeSidebarModel = themeSidebar.modelSel;
    this.selThemeMainModel = themeMain.modelSel;
    this.canvasThemeHeaderSv = themeHeader.svCanvas;
    this.canvasThemeSidebarSv = themeSidebar.svCanvas;
    this.canvasThemeMainSv = themeMain.svCanvas;
    this.canvasThemeHeaderHue = themeHeader.hueCanvas;
    this.canvasThemeSidebarHue = themeSidebar.hueCanvas;
    this.canvasThemeMainHue = themeMain.hueCanvas;
    this.cursorThemeHeaderSv = themeHeader.svCursor;
    this.cursorThemeSidebarSv = themeSidebar.svCursor;
    this.cursorThemeMainSv = themeMain.svCursor;
    this.cursorThemeHeaderHue = themeHeader.hueCursor;
    this.cursorThemeSidebarHue = themeSidebar.hueCursor;
    this.cursorThemeMainHue = themeMain.hueCursor;
    this.errThemeHeaderColor = themeHeader.err;
    this.errThemeSidebarColor = themeSidebar.err;
    this.errThemeMainColor = themeMain.err;
    this.inpSecurityPinEnabled = inpSecurityPinEnabled;
    this.inpSecurityCurrentPin = inpSecurityCurrentPin;
    this.inpSecurityNewPin = inpSecurityNewPin;
    this.inpSecurityConfirmPin = inpSecurityConfirmPin;
    this.btnSecurityPinSave = btnSecurityPinSave;
    this.btnSecurityPinDisable = btnSecurityPinDisable;

    this.inpPdfLogoEnabled = inpPdfLogoEnabled;
    this.inpPdfLogoFile = inpPdfLogoFile;
    this.imgPdfLogoPreview = imgPdfLogoPreview;
    this.pdfLogoDummyEl = pdfLogoDummy; // <-- merken
    this.btnPdfLogoRemove = btnPdfLogoRemove;
    this.pdfLogoPathEl = pdfLogoPath;
    this.inpPdfLogoWidth = inpPdfLogoWidth;
    this.inpPdfLogoTop = inpPdfLogoTop;
    this.inpPdfLogoRight = inpPdfLogoRight;
    this.pdfLogoQualityEl = pdfLogoQuality;
    this.inpPdfProtocolTitle = inpPdfProtocolTitle;
    this.inpPdfTrafficLightAll = inpPdfTrafficLightAll;
    this.inpPdfProtocolsDir = inpPdfProtocolsDir;
    this.inpPdfFooterPlace = inpPdfFooterPlace;
    this.inpPdfFooterDate = inpPdfFooterDate;
    this.inpPdfFooterName1 = inpPdfFooterName1;
    this.inpPdfFooterName2 = inpPdfFooterName2;
    this.inpPdfFooterRecorder = inpPdfFooterRecorder;
    this.inpPdfFooterStreet = inpPdfFooterStreet;
    this.inpPdfFooterZip = inpPdfFooterZip;
    this.inpPdfFooterCity = inpPdfFooterCity;
    this.inpPdfPreRemarks = null;
    this.inpPdfFooterUseUserData = null;
    this.btnPdfFooterUseUserData = btnPdfFooterUseUserData;
    this.btnPdfProtocolsBrowse = btnPdfProtocolsBrowse;
    this.btnPdfSettingsSave = null;

    this.btnSave = btnSave;
    this.roleListEl = roleList;
    this.btnAddRole = btnAddRole;
    this.inpAddRole = inpAddRole;
    this.btnRoleMove = btnRoleMove;
    this.btnRoleDelete = btnRoleDelete;
    this.btnRoleRename = btnRoleRename;
    this.roleMoveHintEl = roleMoveHint;
    this.roleLabels = this._normalizeRoleLabels("");
    this.roleOrder = this._normalizeRoleOrder("", this.roleLabels);

    this.deleteConfirmOverlayEl = delOverlay;
    this.deleteConfirmMsgEl = delMsg;
    this.deleteConfirmOkBtn = delOk;
    this.deleteConfirmCancelBtn = delCancel;
    this.renameOverlayEl = renameOverlay;
    this.renameInputEl = renameInput;
    this.renameOkBtn = renameOk;
    this.renameCancelBtn = renameCancel;
    this.settingsModalOverlayEl = settingsOverlay;
    this.settingsModalEl = settingsModal;
    this.settingsModalTitleEl = settingsTitle;
    this.settingsModalBodyEl = settingsBody;
    this.settingsModalCloseBtn = settingsClose;
    this.settingsModalFooterEl = settingsFooter;
    this.settingsModalSaveBtn = settingsSave;
    this._renderRoleOrderList();

    return root;
  }

  async _openDictionaryPopup() {
    const api = window.bbmDb || {};
    if (typeof api.dictionaryListSuggestions !== "function") {
      alert("Wörterbuch ist nicht verfügbar (IPC fehlt).");
      return;
    }

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "10px";
    wrap.style.minWidth = "min(680px, calc(100vw - 60px))";
    wrap.style.maxWidth = "860px";

    const mkCard = () => {
      const card = document.createElement("div");
      applyPopupCardStyle(card);
      card.style.padding = "10px 12px";
      card.style.display = "grid";
      card.style.gap = "8px";
      return card;
    };

    const sourceCard = mkCard();
    const sourceTitle = document.createElement("div");
    sourceTitle.textContent = "Quelle wählen";
    sourceTitle.style.fontWeight = "800";

    const sourceRow = document.createElement("div");
    sourceRow.style.display = "flex";
    sourceRow.style.alignItems = "center";
    sourceRow.style.gap = "8px";
    sourceRow.style.flexWrap = "wrap";

    const btnPickFolder = document.createElement("button");
    btnPickFolder.type = "button";
    btnPickFolder.textContent = "Ordner auswählen";
    applyPopupButtonStyle(btnPickFolder, { variant: "primary" });

    const sourcePath = document.createElement("div");
    sourcePath.style.fontSize = "12px";
    sourcePath.style.padding = "6px 8px";
    sourcePath.style.borderRadius = "8px";
    sourcePath.style.background = "#f8fafc";
    sourcePath.style.border = "1px solid rgba(0,0,0,0.1)";
    sourcePath.style.flex = "1 1 auto";
    sourcePath.style.minWidth = "220px";
    sourcePath.textContent = "Kein Ordner ausgewählt";

    sourceRow.append(btnPickFolder, sourcePath);
    sourceCard.append(sourceTitle, sourceRow);

    const scanCard = mkCard();
    const scanTitle = document.createElement("div");
    scanTitle.textContent = "Suche / Analyse";
    scanTitle.style.fontWeight = "800";

    const scanRow = document.createElement("div");
    scanRow.style.display = "flex";
    scanRow.style.alignItems = "center";
    scanRow.style.gap = "8px";
    scanRow.style.flexWrap = "wrap";

    const btnScan = document.createElement("button");
    btnScan.type = "button";
    btnScan.textContent = "Suche starten";
    applyPopupButtonStyle(btnScan);

    const scanStatus = document.createElement("div");
    scanStatus.style.fontSize = "12px";
    scanStatus.style.opacity = "0.85";
    scanStatus.textContent = "";

    scanRow.append(btnScan, scanStatus);

    const progressList = document.createElement("div");
    progressList.style.display = "grid";
    progressList.style.gap = "4px";
    progressList.style.fontSize = "12px";

    const progressFiles = document.createElement("div");
    const progressCurrent = document.createElement("div");
    const progressTerms = document.createElement("div");
    const progressOk = document.createElement("div");
    const progressFail = document.createElement("div");
    progressFiles.textContent = "Dateien gefunden: -";
    progressCurrent.textContent = "Aktuelle Datei: -";
    progressTerms.textContent = "Vorschläge gesammelt: -";
    progressOk.textContent = "Erfolgreich verarbeitet: -";
    progressFail.textContent = "Fehlgeschlagen: -";
    progressList.append(progressFiles, progressCurrent, progressTerms, progressOk, progressFail);

    const errorList = document.createElement("div");
    errorList.style.display = "grid";
    errorList.style.gap = "4px";
    errorList.style.fontSize = "11px";
    errorList.style.color = "#b91c1c";

    scanCard.append(scanTitle, scanRow, progressList, errorList);

    const resultCard = mkCard();
    const resultTitle = document.createElement("div");
    resultTitle.textContent = "Ergebnisliste";
    resultTitle.style.fontWeight = "800";

    const resultHint = document.createElement("div");
    resultHint.style.fontSize = "12px";
    resultHint.style.opacity = "0.8";
    resultHint.textContent = "Keine automatische Übernahme – bitte einzeln prüfen.";

    const resultHead = document.createElement("div");
    resultHead.style.display = "grid";
    resultHead.style.gridTemplateColumns =
      "26px minmax(160px, 1.2fr) minmax(160px, 1fr) 80px minmax(160px, 1fr)";
    resultHead.style.gap = "6px";
    resultHead.style.fontSize = "10px";
    resultHead.style.fontWeight = "700";
    resultHead.style.textTransform = "uppercase";
    resultHead.style.color = "#475569";
    resultHead.style.borderBottom = "1px solid rgba(0,0,0,0.08)";
    resultHead.style.paddingBottom = "4px";
    resultHead.append(
      Object.assign(document.createElement("div"), { textContent: "" }),
      Object.assign(document.createElement("div"), { textContent: "Begriff" }),
      Object.assign(document.createElement("div"), { textContent: "Varianten" }),
      Object.assign(document.createElement("div"), { textContent: "Häufigkeit" }),
      Object.assign(document.createElement("div"), { textContent: "Quelle" })
    );

    const bulkActions = document.createElement("div");
    bulkActions.style.display = "flex";
    bulkActions.style.gap = "6px";
    bulkActions.style.flexWrap = "wrap";
    bulkActions.style.alignItems = "center";

    const btnSelectAll = document.createElement("button");
    btnSelectAll.type = "button";
    btnSelectAll.textContent = "Alle auswählen";
    applyPopupButtonStyle(btnSelectAll);
    btnSelectAll.style.fontSize = "11px";
    btnSelectAll.style.padding = "3px 8px";
    btnSelectAll.style.minHeight = "22px";

    const btnSelectNone = document.createElement("button");
    btnSelectNone.type = "button";
    btnSelectNone.textContent = "Alle abwählen";
    applyPopupButtonStyle(btnSelectNone);
    btnSelectNone.style.fontSize = "11px";
    btnSelectNone.style.padding = "3px 8px";
    btnSelectNone.style.minHeight = "22px";

    const btnBulkAccept = document.createElement("button");
    btnBulkAccept.type = "button";
    btnBulkAccept.textContent = "Ausgewählte übernehmen";
    applyPopupButtonStyle(btnBulkAccept, { variant: "primary" });
    btnBulkAccept.style.fontSize = "11px";
    btnBulkAccept.style.padding = "3px 8px";
    btnBulkAccept.style.minHeight = "22px";

    const btnBulkReject = document.createElement("button");
    btnBulkReject.type = "button";
    btnBulkReject.textContent = "Ausgewählte verwerfen";
    applyPopupButtonStyle(btnBulkReject);
    btnBulkReject.style.fontSize = "11px";
    btnBulkReject.style.padding = "3px 8px";
    btnBulkReject.style.minHeight = "22px";

    bulkActions.append(btnSelectAll, btnSelectNone, btnBulkAccept, btnBulkReject);

    const resultList = document.createElement("div");
    resultList.style.display = "grid";
    resultList.style.gap = "3px";

    resultCard.append(resultTitle, resultHint, bulkActions, resultHead, resultList);

    const acceptedCard = mkCard();
    const acceptedTitle = document.createElement("div");
    acceptedTitle.textContent = "Übernommene Wörter";
    acceptedTitle.style.fontWeight = "800";

    const acceptedList = document.createElement("div");
    acceptedList.style.display = "grid";
    acceptedList.style.gap = "6px";

    acceptedCard.append(acceptedTitle, acceptedList);

    wrap.append(sourceCard, scanCard, resultCard, acceptedCard);

    let selectedDir = "";
    let busy = false;
    let lastScanFileCount = 0;
    const selectedKeys = new Set();

    const setBusy = (isBusy) => {
      busy = !!isBusy;
      btnPickFolder.disabled = busy;
      btnScan.disabled = busy;
      btnPickFolder.style.opacity = busy ? "0.6" : "1";
      btnScan.style.opacity = busy ? "0.6" : "1";
      updateBulkButtons();
    };

    const setSourcePath = (value) => {
      selectedDir = String(value || "").trim();
      sourcePath.textContent = selectedDir || "Kein Ordner ausgewählt";
    };

    const setProgress = ({ total = "-", current = "-", terms = "-", ok = "-", fail = "-" } = {}) => {
      progressFiles.textContent = `Dateien gefunden: ${total}`;
      progressCurrent.textContent = `Aktuelle Datei: ${current}`;
      progressTerms.textContent = `Vorschläge gesammelt: ${terms}`;
      progressOk.textContent = `Erfolgreich verarbeitet: ${ok}`;
      progressFail.textContent = `Fehlgeschlagen: ${fail}`;
    };

    const parseVariants = (raw) => {
      try {
        const parsed = JSON.parse(raw || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const calcEditDistance = (a, b) => {
      const s = String(a || "");
      const t = String(b || "");
      if (!s) return t.length;
      if (!t) return s.length;
      const dp = Array.from({ length: s.length + 1 }, () => new Array(t.length + 1).fill(0));
      for (let i = 0; i <= s.length; i += 1) dp[i][0] = i;
      for (let j = 0; j <= t.length; j += 1) dp[0][j] = j;
      for (let i = 1; i <= s.length; i += 1) {
        for (let j = 1; j <= t.length; j += 1) {
          const cost = s[i - 1] === t[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + cost
          );
        }
      }
      return dp[s.length][t.length];
    };

    const pickGroupTerm = (entries) => {
      if (!entries.length) return "";
      let best = entries[0];
      for (const e of entries) {
        const count = Number(e.count || 0);
        const bestCount = Number(best.count || 0);
        if (count > bestCount) {
          best = e;
          continue;
        }
        if (count === bestCount && String(e.term || "").length < String(best.term || "").length) {
          best = e;
        }
      }
      return String(best.term || best.normKey || "").trim();
    };

    const groupCollectedTerms = (entries) => {
      const groups = [];
      const sorted = [...entries].sort((a, b) => String(a.normKey || "").length - String(b.normKey || "").length);

      const canJoinGroup = (entry, group) => {
        const a = String(entry.normKey || "");
        const b = String(group.baseNorm || "");
        if (!a || !b) return false;
        if (a === b) return true;
        if (a.startsWith(b) && b.length >= 5) return true;
        if (b.startsWith(a) && a.length >= 5) return true;
        if (Math.abs(a.length - b.length) <= 2 && a.length <= 8) {
          return calcEditDistance(a, b) <= 1;
        }
        if (Math.abs(a.length - b.length) <= 3 && a.length <= 10) {
          return calcEditDistance(a, b) <= 2;
        }
        return false;
      };

      for (const entry of sorted) {
        let target = null;
        for (const group of groups) {
          if (canJoinGroup(entry, group)) {
            target = group;
            break;
          }
        }
        if (!target) {
          target = {
            baseNorm: entry.normKey,
            entries: [],
            variants: new Set(),
            total: 0,
            sourcePath: entry.sourcePath,
            sourceExcerpt: entry.sourceExcerpt,
          };
          groups.push(target);
        }
        target.entries.push(entry);
        target.total += Number(entry.count || 0);
        for (const v of entry.variants || []) target.variants.add(v);
        if (!target.sourcePath) target.sourcePath = entry.sourcePath;
        if (!target.sourceExcerpt) target.sourceExcerpt = entry.sourceExcerpt;
      }

      return groups.map((group) => {
        const term = pickGroupTerm(group.entries);
        return {
          normKey: String(group.baseNorm || "").trim(),
          term: term || String(group.baseNorm || "").trim(),
          variants: Array.from(group.variants),
          frequency: group.total,
          sourcePath: group.sourcePath,
          sourceExcerpt: group.sourceExcerpt,
        };
      });
    };

    const updateBulkButtons = () => {
      const hasSelection = selectedKeys.size > 0;
      btnBulkAccept.disabled = busy || !hasSelection;
      btnBulkReject.disabled = busy || !hasSelection;
      btnSelectAll.disabled = busy;
      btnSelectNone.disabled = busy;
      btnBulkAccept.style.opacity = btnBulkAccept.disabled ? "0.6" : "1";
      btnBulkReject.style.opacity = btnBulkReject.disabled ? "0.6" : "1";
      btnSelectAll.style.opacity = btnSelectAll.disabled ? "0.6" : "1";
      btnSelectNone.style.opacity = btnSelectNone.disabled ? "0.6" : "1";
    };

    const renderSuggestions = (rows) => {
      resultList.innerHTML = "";
      selectedKeys.clear();
      const filtered = (rows || []).filter((r) => {
        const status = String(r?.status || "").trim().toLowerCase();
        return status === "pending" || status === "deferred";
      });
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.textContent = lastScanFileCount > 0
          ? "Dateien erkannt, aber noch keine extrahierbaren Texttreffer (z.B. nur PDFs)."
          : "Keine offenen Vorschläge.";
        empty.style.fontSize = "12px";
        empty.style.opacity = "0.75";
        resultList.append(empty);
        return;
      }
      for (const row of filtered) {
        const status = String(row?.status || "").trim().toLowerCase();
        const variants = parseVariants(row?.variants_json).slice(0, 6);
        const variantText = variants.join(", ");
        const frequency = Number(row?.frequency || 0);
        const sourceText = String(row?.source_path || "").trim();
        const excerptText = String(row?.source_excerpt || "").trim();

        const rowEl = document.createElement("div");
        rowEl.style.display = "grid";
        rowEl.style.gridTemplateColumns =
          "26px minmax(160px, 1.2fr) minmax(160px, 1fr) 70px minmax(160px, 1fr)";
        rowEl.style.gap = "6px";
        rowEl.style.alignItems = "center";
        rowEl.style.padding = "4px 2px";
        rowEl.style.borderBottom = "1px solid rgba(0,0,0,0.06)";

        const checkWrap = document.createElement("div");
        checkWrap.style.display = "flex";
        checkWrap.style.alignItems = "center";
        const check = document.createElement("input");
        check.type = "checkbox";
        check.dataset.key = String(row?.norm_key || "");
        checkWrap.append(check);

        const termEl = document.createElement("div");
        termEl.style.fontWeight = "700";
        termEl.style.fontSize = "12px";
        termEl.textContent = String(row?.term || row?.norm_key || "").trim();

        const variantsEl = document.createElement("div");
        variantsEl.style.fontSize = "11px";
        variantsEl.style.color = "#475569";
        variantsEl.textContent = variantText || "-";

        const freqEl = document.createElement("div");
        freqEl.style.fontVariantNumeric = "tabular-nums";
        freqEl.style.fontSize = "11px";
        freqEl.textContent = Number.isFinite(frequency) ? String(frequency) : "0";

        const sourceEl = document.createElement("div");
        sourceEl.style.fontSize = "10px";
        sourceEl.style.color = "#475569";
        const sourceName = sourceText ? sourceText.split(/[\\/]/).pop() : "-";
        sourceEl.textContent = sourceName || "-";
        if (excerptText) {
          const excerptEl = document.createElement("div");
          excerptEl.style.fontSize = "9px";
          excerptEl.style.opacity = "0.7";
          excerptEl.textContent = excerptText;
          sourceEl.append(excerptEl);
        }

        rowEl.append(checkWrap, termEl, variantsEl, freqEl, sourceEl);
        resultList.append(rowEl);

        check.onchange = () => {
          if (check.checked) {
            selectedKeys.add(String(row?.norm_key || ""));
          } else {
            selectedKeys.delete(String(row?.norm_key || ""));
          }
          updateBulkButtons();
        };

      }
      updateBulkButtons();
    };

    const renderTerms = (rows) => {
      acceptedList.innerHTML = "";
      if (!rows || !rows.length) {
        const empty = document.createElement("div");
        empty.textContent = "Noch keine übernommenen Wörter.";
        empty.style.fontSize = "12px";
        empty.style.opacity = "0.75";
        acceptedList.append(empty);
        return;
      }
      for (const row of rows) {
        const rowEl = document.createElement("div");
        rowEl.style.display = "grid";
        rowEl.style.gridTemplateColumns = "minmax(180px, 1fr) minmax(160px, 1fr) minmax(200px, 1fr)";
        rowEl.style.gap = "8px";
        rowEl.style.alignItems = "center";
        rowEl.style.padding = "6px 4px";
        rowEl.style.borderBottom = "1px solid rgba(0,0,0,0.06)";

        const termEl = document.createElement("div");
        termEl.style.fontWeight = "700";
        termEl.textContent = String(row?.term || row?.norm_key || "").trim();

        const variants = parseVariants(row?.variants_json).slice(0, 6);
        const variantsEl = document.createElement("div");
        variantsEl.style.fontSize = "12px";
        variantsEl.style.color = "#475569";
        variantsEl.textContent = variants.join(", ") || "-";

        const actionsEl = document.createElement("div");
        actionsEl.style.display = "flex";
        actionsEl.style.gap = "6px";
        actionsEl.style.flexWrap = "wrap";

        const isActive = Number(row?.is_active || 0) === 1;
        const btnToggle = document.createElement("button");
        btnToggle.type = "button";
        btnToggle.textContent = isActive ? "Deaktivieren" : "Aktivieren";
        applyPopupButtonStyle(btnToggle);

        const btnDelete = document.createElement("button");
        btnDelete.type = "button";
        btnDelete.textContent = "Löschen";
        btnDelete.style.background = "#c62828";
        btnDelete.style.color = "white";
        btnDelete.style.border = "1px solid rgba(0,0,0,0.25)";
        btnDelete.style.borderRadius = "6px";
        btnDelete.style.padding = "6px 10px";

        actionsEl.append(btnToggle, btnDelete);
        rowEl.append(termEl, variantsEl, actionsEl);
        acceptedList.append(rowEl);

        btnToggle.onclick = async () => {
          if (busy) return;
          const res = await api.dictionarySetTermActive({
            normKey: row?.norm_key,
            isActive: !isActive,
          });
          if (!res?.ok) {
            alert(res?.error || "Status konnte nicht geändert werden.");
            return;
          }
          await loadAllLists();
        };

        btnDelete.onclick = async () => {
          if (busy) return;
          const ok = confirm("Wort wirklich löschen?");
          if (!ok) return;
          const res = await api.dictionaryDeleteTerm({ normKey: row?.norm_key });
          if (!res?.ok) {
            alert(res?.error || "Löschen fehlgeschlagen.");
            return;
          }
          await loadAllLists();
        };
      }
    };

    const loadAllLists = async () => {
      const resSuggestions = await api.dictionaryListSuggestions();
      if (resSuggestions?.ok) {
        renderSuggestions(resSuggestions.suggestions || []);
      } else {
        renderSuggestions([]);
      }
      const resTerms = await api.dictionaryListTerms();
      if (resTerms?.ok) {
        renderTerms(resTerms.terms || []);
      } else {
        renderTerms([]);
      }
    };

    const runBulkUpdate = async (status) => {
      if (busy || selectedKeys.size === 0) return;
      setBusy(true);
      const keys = Array.from(selectedKeys);
      for (const normKey of keys) {
        const res = await api.dictionaryUpdateSuggestionStatus({ normKey, status });
        if (!res?.ok) {
          alert(res?.error || "Sammelaktion fehlgeschlagen.");
          break;
        }
      }
      await loadAllLists();
      setBusy(false);
    };

    btnSelectAll.onclick = () => {
      if (busy) return;
      const checks = resultList.querySelectorAll("input[type='checkbox']");
      checks.forEach((inp) => {
        inp.checked = true;
      });
      selectedKeys.clear();
      checks.forEach((inp) => {
        const key = String(inp.dataset.key || "").trim();
        if (key) selectedKeys.add(key);
      });
      updateBulkButtons();
    };

    btnSelectNone.onclick = () => {
      if (busy) return;
      const checks = resultList.querySelectorAll("input[type='checkbox']");
      checks.forEach((inp) => {
        inp.checked = false;
      });
      selectedKeys.clear();
      updateBulkButtons();
    };

    btnBulkAccept.onclick = async () => {
      await runBulkUpdate("accepted");
    };

    btnBulkReject.onclick = async () => {
      await runBulkUpdate("rejected");
    };

    btnPickFolder.onclick = async () => {
      if (busy) return;
      if (typeof api.selectDirectory !== "function") {
        alert("Ordnerauswahl ist nicht verfügbar.");
        return;
      }
      const res = await api.selectDirectory({ title: "Ordner für Wörterbuch wählen" });
      if (!res?.ok) {
        alert(res?.error || "Ordner konnte nicht geöffnet werden.");
        return;
      }
      if (res.canceled) return;
      const nextPath = Array.isArray(res.filePaths) ? res.filePaths[0] : "";
      if (nextPath) setSourcePath(nextPath);
    };

    btnScan.onclick = async () => {
      if (busy) return;
      if (!selectedDir) {
        alert("Bitte zuerst einen Ordner auswählen.");
        return;
      }
      if (typeof api.dictionaryListFiles !== "function" || typeof api.dictionaryExtractTermsFromFile !== "function") {
        alert("Wörterbuch-Scan ist nicht verfügbar.");
        return;
      }

      setBusy(true);
      scanStatus.textContent = "Suche läuft...";
      setProgress({ total: "-", current: "-", terms: "0", ok: "0", fail: "0" });
      errorList.innerHTML = "";

      const fileRes = await api.dictionaryListFiles({ dirPath: selectedDir });
      if (!fileRes?.ok) {
        scanStatus.textContent = fileRes?.error || "Ordner konnte nicht gelesen werden.";
        lastScanFileCount = 0;
        setBusy(false);
        return;
      }

      const files = Array.isArray(fileRes.files) ? fileRes.files : [];
      if (!files.length) {
        scanStatus.textContent = "Keine passenden Dateien gefunden.";
        setProgress({ total: "0", current: "-", terms: "0", ok: "0", fail: "0" });
        lastScanFileCount = 0;
        setBusy(false);
        return;
      }

      lastScanFileCount = files.length;
      const collected = new Map();
      let pdfNoTextCount = 0;
      let noTermsCount = 0;
      let errorCount = 0;
      let okCount = 0;
      setProgress({ total: files.length, current: "-", terms: "0", ok: "0", fail: "0" });

      for (let i = 0; i < files.length; i += 1) {
        const filePath = files[i];
        const fileName = filePath.split(/[\\/]/).pop();
        setProgress({
          total: files.length,
          current: fileName || filePath,
          terms: collected.size,
          ok: okCount,
          fail: errorCount,
        });
        const res = await api.dictionaryExtractTermsFromFile({ filePath });
        if (!res?.ok) {
          errorCount += 1;
          const msg = String(res?.error || "Unbekannter Fehler").trim();
          const item = document.createElement("div");
          item.textContent = `${fileName || filePath} ? ${msg}`;
          errorList.append(item);
        } else if (res?.note === "pdf_no_text") {
          pdfNoTextCount += 1;
          const item = document.createElement("div");
          item.textContent = `${fileName || filePath} ? kein Text extrahierbar`;
          errorList.append(item);
        } else if (res?.note === "no_terms") {
          noTermsCount += 1;
          const item = document.createElement("div");
          item.textContent = `${fileName || filePath} ? keine verwertbaren Begriffe`;
          errorList.append(item);
        } else {
          okCount += 1;
        }
        if (res?.ok && Array.isArray(res.terms)) {
          for (const term of res.terms) {
            const normKey = String(term?.normKey || "").trim();
            if (!normKey) continue;
            let entry = collected.get(normKey);
            if (!entry) {
              entry = {
                normKey,
                term: Array.isArray(term?.variants) && term.variants[0] ? term.variants[0] : normKey,
                count: 0,
                variants: new Set(),
                sourcePath: filePath,
                sourceExcerpt: String(term?.excerpt || "").trim(),
              };
              collected.set(normKey, entry);
            }
            entry.count += Number(term?.count || 0);
            const variants = Array.isArray(term?.variants) ? term.variants : [];
            for (const v of variants) {
              if (!v) continue;
              entry.variants.add(v);
            }
          }
        }
        setProgress({
          total: files.length,
          current: fileName || filePath,
          terms: collected.size,
          ok: okCount,
          fail: errorCount,
        });
      }

      const rawEntries = Array.from(collected.values());
      const payload = groupCollectedTerms(rawEntries);

      if (payload.length && typeof api.dictionaryApplyScanResults === "function") {
        const saveRes = await api.dictionaryApplyScanResults({ suggestions: payload });
        if (!saveRes?.ok) {
          scanStatus.textContent = saveRes?.error || "Speichern fehlgeschlagen.";
          setBusy(false);
          return;
        }
      }

      const summaryParts = [];
      if (pdfNoTextCount > 0) summaryParts.push(`PDFs ohne Text: ${pdfNoTextCount}`);
      if (noTermsCount > 0) summaryParts.push(`Dateien ohne Treffer: ${noTermsCount}`);
      if (errorCount > 0) summaryParts.push(`Fehler: ${errorCount}`);
      const summary = summaryParts.length ? ` (${summaryParts.join(", ")})` : "";
      scanStatus.textContent = `Suche abgeschlossen: ${payload.length} Vorschläge${summary}`;
      await loadAllLists();
      setBusy(false);
    };

    await loadAllLists();
    this._openSettingsModal({
      title: "Wörterbuch",
      content: [wrap],
      closeOnly: true,
    });
  }

  async load() {
    await this._reload();
  }

  _openSettingsModal({ title, content, saveFn, closeOnly = false } = {}) {
    if (!this.settingsModalOverlayEl || !this.settingsModalBodyEl || !this.settingsModalTitleEl) return;
    this.settingsModalTitleEl.textContent = (title || "").toString();
    if (this.settingsModalEl) {
      const titleNorm = String(title || "").trim().toLowerCase();
      const isCompactPopup =
        titleNorm === "nutzereinstellungen" ||
        titleNorm === "entwicklung" ||
        titleNorm === "woerterbuch" ||
        titleNorm === "wörterbuch";
      const isUserSettingsPopup = titleNorm === "nutzereinstellungen";
      const isPrintSettingsPopup = titleNorm === "druckeinstellungen";
      const isLayoutPopup = titleNorm === "druck-layout";
      if (isPrintSettingsPopup) {
        this.settingsModalEl.style.width = "min(760px, calc(100vw - 24px))";
      } else if (isLayoutPopup) {
        this.settingsModalEl.style.width = "min(344px, calc(100vw - 24px))";
      } else if (isCompactPopup) {
        this.settingsModalEl.style.width = "min(760px, calc(100vw - 24px))";
      } else {
        this.settingsModalEl.style.width = "min(980px, calc(100vw - 24px))";
      }
      const footerInner = this.settingsModalFooterEl?.firstElementChild;
      if (footerInner) {
        footerInner.style.maxWidth = isPrintSettingsPopup ? "600px" : "720px";
      }
    }
    this.settingsModalBodyEl.innerHTML = "";
    const nodes = Array.isArray(content) ? content : [content];
    for (const node of nodes) {
      if (node) this.settingsModalBodyEl.appendChild(node);
    }
    this._settingsModalSaveFn = typeof saveFn === "function" ? saveFn : null;
    this._settingsModalCloseOnly = !!closeOnly;
    if (this.settingsModalSaveBtn) {
      this.settingsModalSaveBtn.textContent = this._settingsModalCloseOnly ? "Schliessen" : "Speichern";
    }
    this._settingsModalOpen = true;
    this._lockBodyScroll();
    this.settingsModalOverlayEl.style.display = "flex";
    try {
      if (this.settingsModalEl) {
        this.settingsModalEl.focus();
      } else {
        this.settingsModalOverlayEl.focus();
      }
    } catch (_e) {
      // ignore
    }
  }

  async _runSettingsModalSave({ closeOnSuccess } = {}) {
    if (this.roleRenameCode) {
      const ok = this._commitRoleInlineRename({ commit: true });
      if (!ok) return false;
    }
    if (!this._settingsModalSaveFn) {
      if (closeOnSuccess) this._closeSettingsModal();
      return true;
    }

    try {
      const res = await this._settingsModalSaveFn();
      if (res === false) return false;
      if (closeOnSuccess) this._closeSettingsModal();
      return true;
    } catch (e) {
      console.error("Settings-Modal Save fehlgeschlagen:", e);
      return false;
    }
  }

  _closeSettingsModal() {
    if (!this.settingsModalOverlayEl || !this.settingsModalBodyEl) return;
    if (this.roleMoveModeActive) {
      this.roleMoveModeActive = false;
      this._detachRoleMoveMouseDown();
      this._detachRoleMoveKeyDown();
    }
    if (this._devPopupOpen) {
      this.devUnlocked = false;
      this._devPopupOpen = false;
    }
    this._settingsModalOpen = false;
    this.settingsModalOverlayEl.style.display = "none";
    this.settingsModalBodyEl.innerHTML = "";
    this._settingsModalSaveFn = null;
    this._settingsModalCloseOnly = false;
    this._unlockBodyScroll();
  }

  _lockBodyScroll() {
    if (this._bodyLockCount === 0) {
      this._bodyOverflowBackup = document.body.style.overflow || "";
      document.body.style.overflow = "hidden";
    }
    this._bodyLockCount += 1;
  }

  _unlockBodyScroll() {
    if (this._bodyLockCount > 0) {
      this._bodyLockCount -= 1;
    }
    if (this._bodyLockCount === 0) {
      document.body.style.overflow = this._bodyOverflowBackup || "";
      this._bodyOverflowBackup = null;
    }
  }

  _setMsg(t) {
    if (!this.msgEl) return;
    this.msgEl.textContent = t || "";
  }

  _applyState() {
    const busy = !!this.saving;
    const logoBusy = busy || this._logoSaving || this._pdfLogoSaving;
    const themeBusy = busy || this._themeSaving;
    const securityBusy = busy || this._securityPinSaving;
    const pdfSettingsBusy = busy || this._pdfSettingsSaving;
    const printLogosBusy = busy || this._printLogoSaving;
    if (this.inpName) this.inpName.disabled = busy;
    if (this.inpCompany) this.inpCompany.disabled = busy;
    if (this.inpUserName1) this.inpUserName1.disabled = busy;
    if (this.inpUserName2) this.inpUserName2.disabled = busy;
    if (this.inpUserStreet) this.inpUserStreet.disabled = busy;
    if (this.inpUserZip) this.inpUserZip.disabled = busy;
    if (this.inpUserCity) this.inpUserCity.disabled = busy;
    if (this.inpLogoSize) this.inpLogoSize.disabled = logoBusy;
    if (this.inpLogoPadLeft) this.inpLogoPadLeft.disabled = logoBusy;
    if (this.inpLogoPadTop) this.inpLogoPadTop.disabled = logoBusy;
    if (this.inpLogoPadRight) this.inpLogoPadRight.disabled = logoBusy;
    if (this.inpLogoPosition) this.inpLogoPosition.disabled = logoBusy;
    if (this.inpLogoEnabled) this.inpLogoEnabled.disabled = logoBusy;
    if (this.inpThemeHeaderR) this.inpThemeHeaderR.disabled = themeBusy;
    if (this.inpThemeHeaderG) this.inpThemeHeaderG.disabled = themeBusy;
    if (this.inpThemeHeaderB) this.inpThemeHeaderB.disabled = themeBusy;
    if (this.inpThemeSidebarR) this.inpThemeSidebarR.disabled = themeBusy;
    if (this.inpThemeSidebarG) this.inpThemeSidebarG.disabled = themeBusy;
    if (this.inpThemeSidebarB) this.inpThemeSidebarB.disabled = themeBusy;
    if (this.inpThemeMainR) this.inpThemeMainR.disabled = themeBusy;
    if (this.inpThemeMainG) this.inpThemeMainG.disabled = themeBusy;
    if (this.inpThemeMainB) this.inpThemeMainB.disabled = themeBusy;
    if (this.inpThemeHeaderHex) this.inpThemeHeaderHex.disabled = themeBusy;
    if (this.inpThemeSidebarHex) this.inpThemeSidebarHex.disabled = themeBusy;
    if (this.inpThemeMainHex) this.inpThemeMainHex.disabled = themeBusy;
    if (this.selThemeHeaderModel) this.selThemeHeaderModel.disabled = themeBusy;
    if (this.selThemeSidebarModel) this.selThemeSidebarModel.disabled = themeBusy;
    if (this.selThemeMainModel) this.selThemeMainModel.disabled = themeBusy;
    if (this.canvasThemeHeaderSv) this.canvasThemeHeaderSv.style.pointerEvents = themeBusy ? "none" : "auto";
    if (this.canvasThemeSidebarSv) this.canvasThemeSidebarSv.style.pointerEvents = themeBusy ? "none" : "auto";
    if (this.canvasThemeMainSv) this.canvasThemeMainSv.style.pointerEvents = themeBusy ? "none" : "auto";
    if (this.canvasThemeHeaderHue) this.canvasThemeHeaderHue.style.pointerEvents = themeBusy ? "none" : "auto";
    if (this.canvasThemeSidebarHue) this.canvasThemeSidebarHue.style.pointerEvents = themeBusy ? "none" : "auto";
    if (this.canvasThemeMainHue) this.canvasThemeMainHue.style.pointerEvents = themeBusy ? "none" : "auto";
    if (this.inpThemeGlobalDefault) this.inpThemeGlobalDefault.disabled = themeBusy;
    if (this.inpSecurityCurrentPin) this.inpSecurityCurrentPin.disabled = securityBusy;
    if (this.inpSecurityNewPin) this.inpSecurityNewPin.disabled = securityBusy;
    if (this.inpSecurityConfirmPin) this.inpSecurityConfirmPin.disabled = securityBusy;
    if (this.btnSecurityPinSave) this.btnSecurityPinSave.disabled = securityBusy;
    if (this.btnSecurityPinDisable) this.btnSecurityPinDisable.disabled = securityBusy || !this._securityPinEnabled;
    if (this.inpPdfLogoEnabled) this.inpPdfLogoEnabled.disabled = logoBusy;
    if (this.inpPdfLogoFile) this.inpPdfLogoFile.disabled = logoBusy;
    if (this.pdfLogoPathEl) this.pdfLogoPathEl.disabled = logoBusy;
    if (this.inpPdfLogoWidth) this.inpPdfLogoWidth.disabled = logoBusy;
    if (this.inpPdfLogoTop) this.inpPdfLogoTop.disabled = logoBusy;
    if (this.inpPdfLogoRight) this.inpPdfLogoRight.disabled = logoBusy;
    if (this.btnPdfLogoRemove) this.btnPdfLogoRemove.disabled = logoBusy;
    if (this.inpPdfProtocolTitle) this.inpPdfProtocolTitle.disabled = pdfSettingsBusy;
    if (this.inpPdfTrafficLightAll) this.inpPdfTrafficLightAll.disabled = pdfSettingsBusy;
    if (this.inpPdfProtocolsDir) this.inpPdfProtocolsDir.disabled = pdfSettingsBusy;
    if (this.inpPdfFooterPlace) this.inpPdfFooterPlace.disabled = pdfSettingsBusy;
    if (this.inpPdfFooterDate) this.inpPdfFooterDate.disabled = pdfSettingsBusy;
    if (this.inpPdfFooterName1) this.inpPdfFooterName1.disabled = pdfSettingsBusy;
    if (this.inpPdfFooterName2) this.inpPdfFooterName2.disabled = pdfSettingsBusy;
    if (this.inpPdfFooterRecorder) this.inpPdfFooterRecorder.disabled = pdfSettingsBusy;
    if (this.inpPdfFooterStreet) this.inpPdfFooterStreet.disabled = pdfSettingsBusy;
    if (this.inpPdfFooterZip) this.inpPdfFooterZip.disabled = pdfSettingsBusy;
    if (this.inpPdfFooterCity) this.inpPdfFooterCity.disabled = pdfSettingsBusy;
    if (this.btnPdfFooterUseUserData) this.btnPdfFooterUseUserData.disabled = pdfSettingsBusy;
    if (this.btnPdfProtocolsBrowse) this.btnPdfProtocolsBrowse.disabled = pdfSettingsBusy;
    if (this.btnPdfSettingsSave) this.btnPdfSettingsSave.disabled = pdfSettingsBusy;
    for (const inp of this.printLogoEnabledInputs || []) {
      if (inp) inp.disabled = printLogosBusy;
    }
    for (const inp of this.printLogoFileInputs || []) {
      if (inp) inp.disabled = printLogosBusy;
    }
    for (const btn of this.printLogoRemoveBtns || []) {
      if (btn) btn.disabled = printLogosBusy;
    }
    for (const sel of this.printLogoSizeSelects || []) {
      if (sel) sel.disabled = printLogosBusy;
    }
    if (this.inpPrintHeaderAdaptive) this.inpPrintHeaderAdaptive.disabled = printLogosBusy;
    for (const checks of this.printLogoAlignChecks || []) {
      if (!checks) continue;
      if (checks.left) checks.left.disabled = printLogosBusy;
      if (checks.center) checks.center.disabled = printLogosBusy;
      if (checks.right) checks.right.disabled = printLogosBusy;
    }
    for (const checks of this.printLogoVAlignChecks || []) {
      if (!checks) continue;
      if (checks.top) checks.top.disabled = printLogosBusy;
      if (checks.middle) checks.middle.disabled = printLogosBusy;
      if (checks.bottom) checks.bottom.disabled = printLogosBusy;
    }
    this._updateRoleActionsState();
    if (this.btnSave) this.btnSave.disabled = busy;
    // bewusst NICHT mehr disable'n (bekannter Delete-UI-Bug)
    if (this.btnAddRole) this.btnAddRole.disabled = false;
    if (this.inpAddRole) this.inpAddRole.disabled = false;
    this._renderRoleOrderList();
  }

  _normalizeUserText(value, maxLen = 80) {
    const v = String(value || "").trim();
    if (!v) return "";
    return v.length > maxLen ? v.slice(0, maxLen) : v;
  }

  _isTouchedTextValue(value) {
    return String(value ?? "").trim() !== "";
  }

  _buildTouchedPayloadFromValues(values = {}) {
    const payload = {};
    for (const [key, value] of Object.entries(values || {})) {
      if (!key) continue;
      if (!this._isTouchedTextValue(value)) continue;
      payload[`meta.touched.${key}`] = "1";
    }
    return payload;
  }

  _buildTouchedPayloadForKeys(keys = []) {
    const payload = {};
    for (const key of keys || []) {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey) continue;
      payload[`meta.touched.${normalizedKey}`] = "1";
    }
    return payload;
  }

  _normalizePdfPreRemarks(value) {
    const raw = String(value || "").replace(/\r\n?/g, "\n");
    const lines = raw.split("\n").slice(0, 5);
    const normalized = lines
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n")
      .trim();
    if (!normalized) return "";
    return normalized.length > 300 ? normalized.slice(0, 300) : normalized;
  }

  async _openPdfPreRemarksPopup() {
    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    const overlay = createPopupOverlay({ background: "rgba(0,0,0,0.35)", zIndex: OVERLAY_TOP });
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    const modal = document.createElement("div");
    applyPopupCardStyle(modal);
    modal.style.width = "min(740px, calc(100vw - 24px))";
    modal.style.maxHeight = "calc(100vh - 24px)";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.overflow = "hidden";
    modal.style.background = "#fff";
    modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
    modal.style.padding = "0";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.justifyContent = "space-between";
    head.style.gap = "10px";
    head.style.padding = "12px 14px";
    head.style.borderBottom = "1px solid #e2e8f0";

    const title = document.createElement("div");
    title.textContent = "Vorbemerkung";
    title.style.fontWeight = "800";
    title.style.fontSize = "16px";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "Schliessen";
    applyPopupButtonStyle(btnClose);

    head.append(title, btnClose);

    const body = document.createElement("div");
    body.style.padding = "14px";
    body.style.overflow = "auto";
    body.style.display = "grid";
    body.style.gap = "8px";

    const enabledWrap = document.createElement("label");
    enabledWrap.style.display = "inline-flex";
    enabledWrap.style.alignItems = "center";
    enabledWrap.style.gap = "8px";
    enabledWrap.style.fontSize = "13px";
    enabledWrap.style.userSelect = "none";

    const chkEnabled = document.createElement("input");
    chkEnabled.type = "checkbox";
    chkEnabled.checked = !!this.pdfPreRemarksEnabled;
    const enabledText = document.createElement("span");
    enabledText.textContent = "Vorbemerkung drucken";
    enabledWrap.append(chkEnabled, enabledText);

    const infoRow = document.createElement("div");
    infoRow.style.display = "flex";
    infoRow.style.justifyContent = "space-between";
    infoRow.style.alignItems = "center";
    infoRow.style.gap = "10px";

    const help = document.createElement("div");
    help.textContent = "(max 300 Zeichen in 5 Zeilen)";
    help.style.fontSize = "12px";
    help.style.opacity = "0.75";

    const badge = document.createElement("span");
    badge.style.fontSize = "12px";
    badge.style.opacity = "0.9";
    badge.title = "Restliche Zeichen";
    badge.style.padding = "1px 7px";
    badge.style.border = "1px solid #ddd";
    badge.style.borderRadius = "999px";
    badge.style.background = "#fff";
    badge.style.minWidth = "44px";
    badge.style.textAlign = "right";
    badge.style.fontVariantNumeric = "tabular-nums";

    infoRow.append(help, badge);

    const ta = document.createElement("textarea");
    ta.rows = 5;
    ta.maxLength = 300;
    ta.style.width = "100%";
    ta.style.resize = "vertical";
    ta.style.fontFamily = "Calibri, Arial, sans-serif";
    ta.style.fontSize = "11pt";
    ta.style.lineHeight = "1.35";
    ta.value = String(this.pdfPreRemarks || "");

    const normalizeLocal = () => {
      let v = String(ta.value || "").replace(/\r\n?/g, "\n");
      const lines = v.split("\n");
      if (lines.length > 5) v = lines.slice(0, 5).join("\n");
      if (v.length > 300) v = v.slice(0, 300);
      if (v !== ta.value) ta.value = v;
      badge.textContent = String(Math.max(0, 300 - ta.value.length));
    };
    normalizeLocal();
    ta.addEventListener("input", normalizeLocal);
    ta.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      // Enter erzeugt im Textfeld immer einen Zeilenumbruch (kein Weiterreichen an uebergeordnete Handler).
      e.preventDefault();
      e.stopPropagation();
      const start = Number(ta.selectionStart || 0);
      const end = Number(ta.selectionEnd || start);
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(end);
      ta.value = `${before}\n${after}`;
      const nextPos = start + 1;
      ta.selectionStart = nextPos;
      ta.selectionEnd = nextPos;
      normalizeLocal();
    });

    body.append(enabledWrap, infoRow, ta);

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.padding = "10px 14px";
    footer.style.borderTop = "1px solid #e2e8f0";

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel);

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.textContent = "Speichern";
    applyPopupButtonStyle(btnSave, { variant: "primary" });

    footer.append(btnCancel, btnSave);
    modal.append(head, body, footer);
    overlay.appendChild(modal);

    return new Promise((resolve) => {
      const close = (result) => {
        overlay.removeEventListener("mousedown", onOverlayDown);
        overlay.removeEventListener("keydown", onOverlayKeyDown);
        btnClose.removeEventListener("click", onCancel);
        btnCancel.removeEventListener("click", onCancel);
        btnSave.removeEventListener("click", onSave);
        try {
          overlay.remove();
        } catch {
          // ignore
        }
        resolve(result);
      };

      const onCancel = () => close(false);
      const onOverlayDown = (e) => {
        if (e.target !== overlay) return;
        onCancel();
      };
      const onOverlayKeyDown = (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        onCancel();
      };
      const onSave = async () => {
        normalizeLocal();
        const normalized = this._normalizePdfPreRemarks(ta.value);
        const payload = {
          "pdf.preRemarks": normalized,
          "print.preRemarks.enabled": chkEnabled.checked ? "true" : "false",
          ...this._buildTouchedPayloadFromValues({
            "pdf.preRemarks": normalized,
          }),
          ...this._buildTouchedPayloadForKeys(["print.preRemarks.enabled"]),
        };
        const res = await api.appSettingsSetMany(payload);
        if (!res?.ok) {
          alert(res?.error || "Speichern fehlgeschlagen");
          return;
        }
        this.pdfPreRemarks = normalized;
        this.pdfPreRemarksEnabled = !!chkEnabled.checked;
        if (this.router?.context) {
          this.router.context.settings = {
            ...(this.router.context.settings || {}),
            "pdf.preRemarks": normalized,
            "print.preRemarks.enabled": chkEnabled.checked ? "true" : "false",
          };
        }
        close(true);
      };

      overlay.addEventListener("mousedown", onOverlayDown);
      overlay.addEventListener("keydown", onOverlayKeyDown);
      btnClose.addEventListener("click", onCancel);
      btnCancel.addEventListener("click", onCancel);
      btnSave.addEventListener("click", onSave);

      document.body.appendChild(overlay);
      setTimeout(() => {
        try {
          ta.focus();
          ta.selectionStart = ta.value.length;
          ta.selectionEnd = ta.value.length;
        } catch {
          // ignore
        }
      }, 0);
    });
  }

  _normalizeUserZip(value, maxLen = 10) {
    const v = String(value || "").trim().replace(/\D+/g, "");
    if (!v) return "";
    const lim = Math.max(1, Number(maxLen) || 10);
    return v.length > lim ? v.slice(0, lim) : v;
  }

  _clampLogoNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const v = Math.round(n);
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  _logoDefaults() {
    return {
      size: 20,
      padLeft: 0,
      padTop: 0,
      padRight: 0,
      position: "left",
      enabled: true,
    };
  }

  _normalizeLogoPosition(value, fallback = "left") {
    const s = String(value || "").trim().toLowerCase();
    if (s === "right" || s === "rechts") return "right";
    if (s === "left" || s === "links") return "left";
    return fallback;
  }

  _getLogoInputValues() {
    const defaults = this._logoDefaults();
    const size = this._clampLogoNumber(this.inpLogoSize?.value, 12, 48, defaults.size);
    const padLeft = this._clampLogoNumber(
      this.inpLogoPadLeft?.value,
      0,
      40,
      defaults.padLeft
    );
    const padTop = this._clampLogoNumber(this.inpLogoPadTop?.value, 0, 20, defaults.padTop);
    const padRight = this._clampLogoNumber(
      this.inpLogoPadRight?.value,
      0,
      80,
      defaults.padRight
    );
    const position = this._normalizeLogoPosition(this.inpLogoPosition?.value, defaults.position);
    const enabled = !!this.inpLogoEnabled?.checked;
    return { size, padLeft, padTop, padRight, position, enabled };
  }

  _applyLogoInputs({ size, padLeft, padTop, padRight, position, enabled }) {
    if (this.inpLogoSize) this.inpLogoSize.value = String(size);
    if (this.inpLogoPadLeft) this.inpLogoPadLeft.value = String(padLeft);
    if (this.inpLogoPadTop) this.inpLogoPadTop.value = String(padTop);
    if (this.inpLogoPadRight) this.inpLogoPadRight.value = String(padRight);
    if (this.inpLogoPosition) this.inpLogoPosition.value = this._normalizeLogoPosition(position, "left");
    if (this.inpLogoEnabled) this.inpLogoEnabled.checked = !!enabled;
  }

  _scheduleLogoSave() {
    if (this._logoSaveTimer) {
      clearTimeout(this._logoSaveTimer);
      this._logoSaveTimer = null;
    }
    this._logoSaveTimer = setTimeout(() => {
      this._logoSaveTimer = null;
      this._saveLogoSettings();
    }, 200);
  }

  async _saveLogoSettings() {
    if (this._logoSaving) return false;

    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    const { size, padLeft, padTop, padRight, position, enabled } = this._getLogoInputValues();
    this._applyLogoInputs({ size, padLeft, padTop, padRight, position, enabled });

    this._logoSaving = true;
    try {
      const res = await api.appSettingsSetMany({
        "header.logoSizePx": size,
        "header.logoPadLeftPx": padLeft,
        "header.logoPadTopPx": padTop,
        "header.logoPadRightPx": padRight,
        "header.logoPosition": position,
        "header.logoEnabled": enabled ? "true" : "false",
      });
      if (!res?.ok) {
        alert(res?.error || "Speichern fehlgeschlagen");
        return false;
      }

      if (this.router?.context) {
        this.router.context.settings = {
          ...(this.router.context.settings || {}),
          "header.logoSizePx": size,
          "header.logoPadLeftPx": padLeft,
          "header.logoPadTopPx": padTop,
          "header.logoPadRightPx": padRight,
          "header.logoPosition": position,
          "header.logoEnabled": enabled ? "true" : "false",
        };
      }

      window.dispatchEvent(new Event("bbm:header-refresh"));
      return true;
    } catch (err) {
      console.error("[SettingsView] _saveLogoSettings failed", {
        message: err?.message || String(err),
        stack: err?.stack || null,
      });
      alert(err?.message || "Speichern fehlgeschlagen");
      return false;
    } finally {
      this._logoSaving = false;
    }
  }

  _themeDefaults() {
    return { ...(this._themeRuntimeDefaults || DEFAULT_THEME_SETTINGS) };
  }

  _setThemeRuntimeDefaults(values = {}) {
    const normalized = normalizeThemeSettings({
      ...DEFAULT_THEME_SETTINGS,
      ...values,
      headerUseDefault: false,
      sidebarUseDefault: false,
      mainUseDefault: false,
    });
    this._themeRuntimeDefaults = {
      ...DEFAULT_THEME_SETTINGS,
      headerBaseColor: normalized.headerBaseColor,
      sidebarBaseColor: normalized.sidebarBaseColor,
      mainBaseColor: normalized.mainBaseColor,
      headerTone: normalized.headerTone,
      sidebarTone: normalized.sidebarTone,
      mainTone: normalized.mainTone,
      headerUseDefault: false,
      sidebarUseDefault: false,
      mainUseDefault: false,
    };
  }

  _readThemeStartDefaultsFromData(data = {}) {
    const defaults = this._themeDefaults();
    return {
      headerBaseColor: String(
        data["defaults.ui.themeHeaderBaseColor"] || defaults.headerBaseColor || ""
      ).trim() || defaults.headerBaseColor,
      sidebarBaseColor: String(
        data["defaults.ui.themeSidebarBaseColor"] || defaults.sidebarBaseColor || ""
      ).trim() || defaults.sidebarBaseColor,
      mainBaseColor: String(
        data["defaults.ui.themeMainBaseColor"] || defaults.mainBaseColor || ""
      ).trim() || defaults.mainBaseColor,
      headerTone: this._clampThemeTone(data["defaults.ui.themeHeaderTone"], defaults.headerTone),
      sidebarTone: this._clampThemeTone(data["defaults.ui.themeSidebarTone"], defaults.sidebarTone),
      mainTone: this._clampThemeTone(data["defaults.ui.themeMainTone"], defaults.mainTone),
    };
  }

  _clampThemeTone(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (n < 0) return 0;
    if (n > 100) return 100;
    return Math.round(n);
  }

  _updateThemeToneLabels() {
    const mk = (n) => {
      const t = this._clampThemeTone(n, 0);
      if (t <= 10) return `${t} (Hell)`;
      if (t >= 90) return `${t} (Dunkel)`;
      return `${t}`;
    };
    if (this.lblThemeHeaderTone) this.lblThemeHeaderTone.textContent = mk(this.inpThemeHeaderTone?.value);
    if (this.lblThemeSidebarTone) this.lblThemeSidebarTone.textContent = mk(this.inpThemeSidebarTone?.value);
    if (this.lblThemeMainTone) this.lblThemeMainTone.textContent = mk(this.inpThemeMainTone?.value);
  }

  _setThemeColorError(area, text) {
    const msg = String(text || "");
    if (area === "header" && this.errThemeHeaderColor) this.errThemeHeaderColor.textContent = msg;
    if (area === "sidebar" && this.errThemeSidebarColor) this.errThemeSidebarColor.textContent = msg;
    if (area === "main" && this.errThemeMainColor) this.errThemeMainColor.textContent = msg;
  }

  _themeAreaDefaultHex(area) {
    const defaults = this._themeDefaults();
    if (area === "header") return defaults.headerBaseColor || DEFAULT_THEME_SETTINGS.headerBaseColor;
    if (area === "sidebar") return defaults.sidebarBaseColor || DEFAULT_THEME_SETTINGS.sidebarBaseColor;
    return defaults.mainBaseColor || DEFAULT_THEME_SETTINGS.mainBaseColor;
  }

  _themeHexToRgb(hex, fallback = { r: 255, g: 255, b: 255 }) {
    const fb =
      fallback && typeof fallback === "object" ? fallback : { r: 255, g: 255, b: 255 };
    const parsed = parseCssColor(hex);
    if (!parsed?.rgb) return fallback && typeof fallback === "object" ? { ...fallback } : null;
    return {
      r: this._clampThemeRgb(parsed.rgb.r, fb.r),
      g: this._clampThemeRgb(parsed.rgb.g, fb.g),
      b: this._clampThemeRgb(parsed.rgb.b, fb.b),
    };
  }

  _themeAreaDefaultRgb(area) {
    return this._themeHexToRgb(this._themeAreaDefaultHex(area));
  }

  _themeRgbToHex({ r, g, b }) {
    const toHex2 = (n) => this._clampThemeRgb(n, 0).toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  }

  _clampThemeRgb(value, fallback) {
    if (value == null || value === "") return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (n < 0) return 0;
    if (n > 255) return 255;
    return Math.round(n);
  }

  _clamp01(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  _clampHue(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    let h = n % 360;
    if (h < 0) h += 360;
    return h;
  }

  _themeRgbToHsv(rgb) {
    const r = this._clampThemeRgb(rgb?.r, 0) / 255;
    const g = this._clampThemeRgb(rgb?.g, 0) / 255;
    const b = this._clampThemeRgb(rgb?.b, 0) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    return { h, s, v };
  }

  _themeHsvToRgb(hsv) {
    const h = this._clampHue(hsv?.h, 0);
    const s = this._clamp01(hsv?.s, 0);
    const v = this._clamp01(hsv?.v, 1);
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let rp = 0;
    let gp = 0;
    let bp = 0;
    if (h < 60) [rp, gp, bp] = [c, x, 0];
    else if (h < 120) [rp, gp, bp] = [x, c, 0];
    else if (h < 180) [rp, gp, bp] = [0, c, x];
    else if (h < 240) [rp, gp, bp] = [0, x, c];
    else if (h < 300) [rp, gp, bp] = [x, 0, c];
    else [rp, gp, bp] = [c, 0, x];
    return {
      r: this._clampThemeRgb((rp + m) * 255, 0),
      g: this._clampThemeRgb((gp + m) * 255, 0),
      b: this._clampThemeRgb((bp + m) * 255, 0),
    };
  }

  _getThemeAreaInputs(area) {
    if (area === "header") {
      return {
        model: this.selThemeHeaderModel,
        r: this.inpThemeHeaderR,
        g: this.inpThemeHeaderG,
        b: this.inpThemeHeaderB,
        hex: this.inpThemeHeaderHex,
        svCanvas: this.canvasThemeHeaderSv,
        hueCanvas: this.canvasThemeHeaderHue,
        svCursor: this.cursorThemeHeaderSv,
        hueCursor: this.cursorThemeHeaderHue,
        preview: this.previewThemeHeaderColor,
        value: this.lblThemeHeaderColorValue,
      };
    }
    if (area === "sidebar") {
      return {
        model: this.selThemeSidebarModel,
        r: this.inpThemeSidebarR,
        g: this.inpThemeSidebarG,
        b: this.inpThemeSidebarB,
        hex: this.inpThemeSidebarHex,
        svCanvas: this.canvasThemeSidebarSv,
        hueCanvas: this.canvasThemeSidebarHue,
        svCursor: this.cursorThemeSidebarSv,
        hueCursor: this.cursorThemeSidebarHue,
        preview: this.previewThemeSidebarColor,
        value: this.lblThemeSidebarColorValue,
      };
    }
    return {
      model: this.selThemeMainModel,
      r: this.inpThemeMainR,
      g: this.inpThemeMainG,
      b: this.inpThemeMainB,
      hex: this.inpThemeMainHex,
      svCanvas: this.canvasThemeMainSv,
      hueCanvas: this.canvasThemeMainHue,
      svCursor: this.cursorThemeMainSv,
      hueCursor: this.cursorThemeMainHue,
      preview: this.previewThemeMainColor,
      value: this.lblThemeMainColorValue,
    };
  }

  _setThemeAreaRgbInputs(area, rgb) {
    const refs = this._getThemeAreaInputs(area);
    if (refs.r) refs.r.value = String(this._clampThemeRgb(rgb?.r, 0));
    if (refs.g) refs.g.value = String(this._clampThemeRgb(rgb?.g, 0));
    if (refs.b) refs.b.value = String(this._clampThemeRgb(rgb?.b, 0));
  }

  _readThemeAreaRgb(area, fallback) {
    const refs = this._getThemeAreaInputs(area);
    return {
      r: this._clampThemeRgb(refs.r?.value, fallback.r),
      g: this._clampThemeRgb(refs.g?.value, fallback.g),
      b: this._clampThemeRgb(refs.b?.value, fallback.b),
    };
  }

  _ensureThemeAreaEditableOnInput(area) {
    void area;
  }

  _bindThemeCanvasDrag(canvas, onInput) {
    if (!canvas || typeof onInput !== "function") return;
    canvas.addEventListener("pointerdown", (evDown) => {
      const id = evDown.pointerId;
      const step = (e) => onInput(e);
      step(evDown);
      const onMove = (e) => {
        if (e.pointerId !== id) return;
        step(e);
      };
      const onEnd = (e) => {
        if (e.pointerId !== id) return;
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onEnd);
        canvas.removeEventListener("pointercancel", onEnd);
      };
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onEnd);
      canvas.addEventListener("pointercancel", onEnd);
      if (typeof canvas.setPointerCapture === "function") canvas.setPointerCapture(id);
    });
  }

  _syncThemePickerStateFromRgb(area, rgb) {
    const hsv = this._themeRgbToHsv(rgb);
    this._themePickerState[area] = {
      h: this._clampHue(hsv.h, 0),
      s: this._clamp01(hsv.s, 0),
      v: this._clamp01(hsv.v, 1),
    };
  }

  _drawThemePicker(area) {
    const refs = this._getThemeAreaInputs(area);
    const st = this._themePickerState[area] || { h: 0, s: 0, v: 1 };
    const sv = refs.svCanvas;
    const hue = refs.hueCanvas;
    if (!sv || !hue) return;

    const svCtx = sv.getContext("2d");
    if (svCtx) {
      const w = sv.width;
      const h = sv.height;
      const pure = this._themeHsvToRgb({ h: st.h, s: 1, v: 1 });
      svCtx.fillStyle = `rgb(${pure.r},${pure.g},${pure.b})`;
      svCtx.fillRect(0, 0, w, h);
      const white = svCtx.createLinearGradient(0, 0, w, 0);
      white.addColorStop(0, "rgba(255,255,255,1)");
      white.addColorStop(1, "rgba(255,255,255,0)");
      svCtx.fillStyle = white;
      svCtx.fillRect(0, 0, w, h);
      const black = svCtx.createLinearGradient(0, 0, 0, h);
      black.addColorStop(0, "rgba(0,0,0,0)");
      black.addColorStop(1, "rgba(0,0,0,1)");
      svCtx.fillStyle = black;
      svCtx.fillRect(0, 0, w, h);
    }

    const hueCtx = hue.getContext("2d");
    if (hueCtx) {
      const grad = hueCtx.createLinearGradient(0, 0, 0, hue.height);
      grad.addColorStop(0.0, "#ff0000");
      grad.addColorStop(0.17, "#ffff00");
      grad.addColorStop(0.34, "#00ff00");
      grad.addColorStop(0.51, "#00ffff");
      grad.addColorStop(0.68, "#0000ff");
      grad.addColorStop(0.85, "#ff00ff");
      grad.addColorStop(1.0, "#ff0000");
      hueCtx.fillStyle = grad;
      hueCtx.fillRect(0, 0, hue.width, hue.height);
    }

    if (refs.svCursor) {
      refs.svCursor.style.left = `${Math.round(st.s * (sv.width - 1))}px`;
      refs.svCursor.style.top = `${Math.round((1 - st.v) * (sv.height - 1))}px`;
    }
    if (refs.hueCursor) {
      refs.hueCursor.style.top = `${Math.round((st.h / 360) * (hue.height - 1))}px`;
    }
  }

  _handleThemeSvCanvasInput(area, e) {
    this._ensureThemeAreaEditableOnInput(area);
    const refs = this._getThemeAreaInputs(area);
    const canvas = refs.svCanvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height);
    const s = rect.width <= 0 ? 0 : x / rect.width;
    const v = rect.height <= 0 ? 1 : 1 - y / rect.height;
    const st = this._themePickerState[area] || { h: 0, s: 0, v: 1 };
    this._themePickerState[area] = { ...st, s: this._clamp01(s, st.s), v: this._clamp01(v, st.v) };
    const rgb = this._themeHsvToRgb(this._themePickerState[area]);
    this._themeLastValid[area] = { ...rgb };
    this._setThemeAreaRgbInputs(area, rgb);
    if (refs.hex) refs.hex.value = this._themeRgbToHex(rgb);
    this._drawThemePicker(area);
    this._setThemeColorError(area, "");
    this._applyThemePreviewFromInputs();
    this._scheduleThemeSave();
  }

  _handleThemeHueCanvasInput(area, e) {
    this._ensureThemeAreaEditableOnInput(area);
    const refs = this._getThemeAreaInputs(area);
    const canvas = refs.hueCanvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height);
    const h = rect.height <= 0 ? 0 : (y / rect.height) * 360;
    const st = this._themePickerState[area] || { h: 0, s: 0, v: 1 };
    this._themePickerState[area] = { ...st, h: this._clampHue(h, st.h) };
    const rgb = this._themeHsvToRgb(this._themePickerState[area]);
    this._themeLastValid[area] = { ...rgb };
    this._setThemeAreaRgbInputs(area, rgb);
    if (refs.hex) refs.hex.value = this._themeRgbToHex(rgb);
    this._drawThemePicker(area);
    this._setThemeColorError(area, "");
    this._applyThemePreviewFromInputs();
    this._scheduleThemeSave();
  }

  _handleThemeHexInput(area, normalizeOnBlur) {
    this._ensureThemeAreaEditableOnInput(area);
    const refs = this._getThemeAreaInputs(area);
    const raw = String(refs.hex?.value || "").trim();
    const fallback = this._themeLastValid[area] || this._themeAreaDefaultRgb(area);
    const m = raw.match(/^#?([0-9a-fA-F]{6})$/);
    if (!m) {
      if (normalizeOnBlur && refs.hex) refs.hex.value = this._themeRgbToHex(fallback);
      if (!normalizeOnBlur) this._setThemeColorError(area, "Hex erwartet #RRGGBB.");
      return;
    }
    const rgb = this._themeHexToRgb(`#${m[1]}`, fallback);
    this._themeLastValid[area] = { ...rgb };
    this._setThemeAreaRgbInputs(area, rgb);
    if (refs.hex) refs.hex.value = this._themeRgbToHex(rgb);
    this._syncThemePickerStateFromRgb(area, rgb);
    this._drawThemePicker(area);
    this._setThemeColorError(area, "");
    this._applyThemePreviewFromInputs();
    this._scheduleThemeSave();
  }

  _parseThemeNameToRgb(rawName) {
    const raw = String(rawName || "").trim();
    if (!raw) return null;
    const direct = parseCssColor(raw);
    if (direct?.rgb) {
      return {
        r: this._clampThemeRgb(direct.rgb.r, 0),
        g: this._clampThemeRgb(direct.rgb.g, 0),
        b: this._clampThemeRgb(direct.rgb.b, 0),
      };
    }

    const aliases = {
      rose: "#FF007F",
      rosa: "#FFC0CB",
      weinrot: "#722F37",
      samtgruen: "#3E6B48",
      "samtgrün": "#3E6B48",
    };
    const aliasHex = aliases[raw.toLowerCase()] || null;
    if (!aliasHex) return null;
    return this._themeHexToRgb(aliasHex, null);
  }

  _handleThemeNameInput(area) {
    const refs = this._getThemeAreaInputs(area);
    this._ensureThemeAreaEditableOnInput(area);
    const rgb = this._parseThemeNameToRgb(refs.name?.value || "");
    if (rgb) {
      this._themeLastValid[area] = { ...rgb };
      this._setThemeAreaRgbInputs(area, this._themeLastValid[area]);
      this._setThemeColorError(area, "");
    }
    this._applyThemePreviewFromInputs();
    this._scheduleThemeSave();
  }

  _normalizeThemeRgbInput(area, channel) {
    const fallback = { ...(this._themeLastValid[area] || this._themeAreaDefaultRgb(area)) };
    const refs = this._getThemeAreaInputs(area);
    const inp = refs[channel];
    if (!inp) return;
    const next = this._clampThemeRgb(inp.value, fallback[channel]);
    inp.value = String(next);
    this._themeLastValid[area] = { ...fallback, [channel]: next };
    this._setThemeColorError(area, "");
    this._syncThemePickerStateFromRgb(area, this._themeLastValid[area]);
    this._drawThemePicker(area);
    this._applyThemePreviewFromInputs();
    this._scheduleThemeSave();
  }

  _handleThemeRgbInput(area, channel) {
    this._ensureThemeAreaEditableOnInput(area);
    const fallback = { ...(this._themeLastValid[area] || this._themeAreaDefaultRgb(area)) };
    const refs = this._getThemeAreaInputs(area);
    const inp = refs[channel];
    if (!inp) return;
    const parsed = this._clampThemeRgb(inp.value, null);
    if (parsed == null) {
      this._setThemeColorError(area, "RGB nur 0-255. Letzter gueltiger Wert bleibt aktiv.");
      this._applyThemePreviewFromInputs();
      return;
    }
    const clamped = this._clampThemeRgb(parsed, fallback[channel]);
    if (String(inp.value) !== String(clamped)) inp.value = String(clamped);
    this._themeLastValid[area] = { ...fallback, [channel]: clamped };
    this._setThemeColorError(area, "");
    this._syncThemePickerStateFromRgb(area, this._themeLastValid[area]);
    this._drawThemePicker(area);
    this._applyThemePreviewFromInputs();
    this._scheduleThemeSave();
  }

  _applyThemeDefaultForArea(area) {
    const rgb = this._themeAreaDefaultRgb(area);
    this._themeLastValid[area] = { ...rgb };
    this._setThemeAreaRgbInputs(area, rgb);
    this._setThemeColorError(area, "");
    this._syncThemePickerStateFromRgb(area, rgb);
    this._drawThemePicker(area);
    this._updateThemeColorPreview(area, rgb);
  }

  _updateThemeColorPreview(area, color) {
    let rgb = null;
    if (color && typeof color === "object") {
      rgb = {
        r: this._clampThemeRgb(color.r, 0),
        g: this._clampThemeRgb(color.g, 0),
        b: this._clampThemeRgb(color.b, 0),
      };
    } else {
      rgb = this._themeHexToRgb(color, this._themeAreaDefaultRgb(area));
    }
    const refs = this._getThemeAreaInputs(area);
    const hex = this._themeRgbToHex(rgb);
    const rgbText = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const text = `${hex} | ${rgbText}`;
    if (refs.preview) refs.preview.style.backgroundColor = rgbText;
    if (refs.value) refs.value.textContent = text;
    if (refs.hex) refs.hex.value = hex;
  }

  _getThemeInputValues() {
    const useDefaultGlobal = false;
    const collect = (area) => {
      const defRgb = this._themeAreaDefaultRgb(area);
      const last = this._themeLastValid[area] || defRgb;
      const rgb = useDefaultGlobal ? defRgb : this._readThemeAreaRgb(area, last);
      this._themeLastValid[area] = { ...rgb };
      this._setThemeAreaRgbInputs(area, rgb);
      return { rgb };
    };

    const header = collect("header");
    const sidebar = collect("sidebar");
    const main = collect("main");
    const normalized = normalizeThemeSettings({
      headerBaseColor: this._themeRgbToHex(header.rgb),
      sidebarBaseColor: this._themeRgbToHex(sidebar.rgb),
      mainBaseColor: this._themeRgbToHex(main.rgb),
      headerTone: 50,
      sidebarTone: 50,
      mainTone: 50,
      headerUseDefault: useDefaultGlobal,
      sidebarUseDefault: useDefaultGlobal,
      mainUseDefault: useDefaultGlobal,
    });
    return {
      ...normalized,
      headerColorName: "",
      sidebarColorName: "",
      mainColorName: "",
      headerR: header.rgb.r,
      headerG: header.rgb.g,
      headerB: header.rgb.b,
      sidebarR: sidebar.rgb.r,
      sidebarG: sidebar.rgb.g,
      sidebarB: sidebar.rgb.b,
      mainR: main.rgb.r,
      mainG: main.rgb.g,
      mainB: main.rgb.b,
    };
  }

  _applyThemeInputs(values = {}) {
    const v = normalizeThemeSettings(values);
    const headerUseDefault = !!v.headerUseDefault;
    const sidebarUseDefault = !!v.sidebarUseDefault;
    const mainUseDefault = !!v.mainUseDefault;
    const headerRgb = headerUseDefault
      ? this._themeAreaDefaultRgb("header")
      : this._themeHexToRgb(v.headerBaseColor, this._themeAreaDefaultRgb("header"));
    const sidebarRgb = sidebarUseDefault
      ? this._themeAreaDefaultRgb("sidebar")
      : this._themeHexToRgb(v.sidebarBaseColor, this._themeAreaDefaultRgb("sidebar"));
    const mainRgb = mainUseDefault
      ? this._themeAreaDefaultRgb("main")
      : this._themeHexToRgb(v.mainBaseColor, this._themeAreaDefaultRgb("main"));
    this._themeLastValid = {
      header: { ...headerRgb },
      sidebar: { ...sidebarRgb },
      main: { ...mainRgb },
    };
    // Werkseinstellung wird über den Reset-Button gesetzt, nicht über eine Checkbox.
    this._setThemeAreaRgbInputs("header", headerRgb);
    this._setThemeAreaRgbInputs("sidebar", sidebarRgb);
    this._setThemeAreaRgbInputs("main", mainRgb);
    this._syncThemePickerStateFromRgb("header", headerRgb);
    this._syncThemePickerStateFromRgb("sidebar", sidebarRgb);
    this._syncThemePickerStateFromRgb("main", mainRgb);
    this._drawThemePicker("header");
    this._drawThemePicker("sidebar");
    this._drawThemePicker("main");
    if (this.inpThemeHeaderR) this.inpThemeHeaderR.disabled = false;
    if (this.inpThemeHeaderG) this.inpThemeHeaderG.disabled = false;
    if (this.inpThemeHeaderB) this.inpThemeHeaderB.disabled = false;
    if (this.inpThemeSidebarR) this.inpThemeSidebarR.disabled = false;
    if (this.inpThemeSidebarG) this.inpThemeSidebarG.disabled = false;
    if (this.inpThemeSidebarB) this.inpThemeSidebarB.disabled = false;
    if (this.inpThemeMainR) this.inpThemeMainR.disabled = false;
    if (this.inpThemeMainG) this.inpThemeMainG.disabled = false;
    if (this.inpThemeMainB) this.inpThemeMainB.disabled = false;
    this._updateThemeColorPreview("header", headerRgb);
    this._updateThemeColorPreview("sidebar", sidebarRgb);
    this._updateThemeColorPreview("main", mainRgb);
    this._setThemeColorError("header", "");
    this._setThemeColorError("sidebar", "");
    this._setThemeColorError("main", "");
    if (this.selThemeHeaderModel) this.selThemeHeaderModel.value = "rgb";
    if (this.selThemeSidebarModel) this.selThemeSidebarModel.value = "rgb";
    if (this.selThemeMainModel) this.selThemeMainModel.value = "rgb";
  }

  _applyThemePreviewFromInputs() {
    const v = this._getThemeInputValues();
    this._updateThemeColorPreview("header", { r: v.headerR, g: v.headerG, b: v.headerB });
    this._updateThemeColorPreview("sidebar", { r: v.sidebarR, g: v.sidebarG, b: v.sidebarB });
    this._updateThemeColorPreview("main", { r: v.mainR, g: v.mainG, b: v.mainB });
    if (this.router?.context) {
      this.router.context.settings = {
        ...(this.router.context.settings || {}),
        "ui.themeHeaderBaseColor": v.headerBaseColor,
        "ui.themeSidebarBaseColor": v.sidebarBaseColor,
        "ui.themeMainBaseColor": v.mainBaseColor,
        "ui.themeHeaderTone": v.headerTone,
        "ui.themeSidebarTone": v.sidebarTone,
        "ui.themeMainTone": v.mainTone,
        "ui.themeHeaderUseDefault": v.headerUseDefault ? "true" : "false",
        "ui.themeSidebarUseDefault": v.sidebarUseDefault ? "true" : "false",
        "ui.themeMainUseDefault": v.mainUseDefault ? "true" : "false",
        "dev_color_default_enabled": v.headerUseDefault ? "true" : "false",
        "dev_color_header_default": v.headerUseDefault ? "true" : "false",
        "dev_color_header_name": v.headerColorName,
        "dev_color_header_r": v.headerR,
        "dev_color_header_g": v.headerG,
        "dev_color_header_b": v.headerB,
        "dev_color_sidebar_default": v.sidebarUseDefault ? "true" : "false",
        "dev_color_sidebar_name": v.sidebarColorName,
        "dev_color_sidebar_r": v.sidebarR,
        "dev_color_sidebar_g": v.sidebarG,
        "dev_color_sidebar_b": v.sidebarB,
        "dev_color_main_default": v.mainUseDefault ? "true" : "false",
        "dev_color_main_name": v.mainColorName,
        "dev_color_main_r": v.mainR,
        "dev_color_main_g": v.mainG,
        "dev_color_main_b": v.mainB,
      };
    }
    applyThemeForSettings(v);
    window.dispatchEvent(new Event("bbm:theme-refresh"));
  }

  _scheduleThemeSave() {
    if (this._themeSaveTimer) {
      clearTimeout(this._themeSaveTimer);
      this._themeSaveTimer = null;
    }
    this._themeSaveTimer = setTimeout(() => {
      this._themeSaveTimer = null;
      if (this._themeSaveMode === "startDefaults") {
        this._saveThemeStartDefaults();
      } else {
        this._saveThemeSettings();
      }
    }, 200);
  }

  async _saveThemeSettings() {
    if (this._themeSaving) return false;
    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    const v = this._getThemeInputValues();
    this._applyThemeInputs(v);

    this._themeSaving = true;
    try {
      const res = await api.appSettingsSetMany({
        "ui.themeHeaderBaseColor": v.headerBaseColor,
        "ui.themeSidebarBaseColor": v.sidebarBaseColor,
        "ui.themeMainBaseColor": v.mainBaseColor,
        "ui.themeHeaderTone": v.headerTone,
        "ui.themeSidebarTone": v.sidebarTone,
        "ui.themeMainTone": v.mainTone,
        "ui.themeHeaderUseDefault": v.headerUseDefault ? "true" : "false",
        "ui.themeSidebarUseDefault": v.sidebarUseDefault ? "true" : "false",
        "ui.themeMainUseDefault": v.mainUseDefault ? "true" : "false",
        "dev_color_default_enabled": v.headerUseDefault ? "true" : "false",
        "dev_color_header_default": v.headerUseDefault ? "true" : "false",
        "dev_color_header_name": v.headerColorName,
        "dev_color_header_r": v.headerR,
        "dev_color_header_g": v.headerG,
        "dev_color_header_b": v.headerB,
        "dev_color_sidebar_default": v.sidebarUseDefault ? "true" : "false",
        "dev_color_sidebar_name": v.sidebarColorName,
        "dev_color_sidebar_r": v.sidebarR,
        "dev_color_sidebar_g": v.sidebarG,
        "dev_color_sidebar_b": v.sidebarB,
        "dev_color_main_default": v.mainUseDefault ? "true" : "false",
        "dev_color_main_name": v.mainColorName,
        "dev_color_main_r": v.mainR,
        "dev_color_main_g": v.mainG,
        "dev_color_main_b": v.mainB,
      });
      if (!res?.ok) {
        alert(res?.error || "Speichern fehlgeschlagen");
        return false;
      }

      if (this.router?.context) {
        this.router.context.settings = {
          ...(this.router.context.settings || {}),
          "ui.themeHeaderBaseColor": v.headerBaseColor,
          "ui.themeSidebarBaseColor": v.sidebarBaseColor,
          "ui.themeMainBaseColor": v.mainBaseColor,
          "ui.themeHeaderTone": v.headerTone,
          "ui.themeSidebarTone": v.sidebarTone,
          "ui.themeMainTone": v.mainTone,
          "ui.themeHeaderUseDefault": v.headerUseDefault ? "true" : "false",
          "ui.themeSidebarUseDefault": v.sidebarUseDefault ? "true" : "false",
          "ui.themeMainUseDefault": v.mainUseDefault ? "true" : "false",
          "dev_color_default_enabled": v.headerUseDefault ? "true" : "false",
          "dev_color_header_default": v.headerUseDefault ? "true" : "false",
          "dev_color_header_name": v.headerColorName,
          "dev_color_header_r": v.headerR,
          "dev_color_header_g": v.headerG,
          "dev_color_header_b": v.headerB,
          "dev_color_sidebar_default": v.sidebarUseDefault ? "true" : "false",
          "dev_color_sidebar_name": v.sidebarColorName,
          "dev_color_sidebar_r": v.sidebarR,
          "dev_color_sidebar_g": v.sidebarG,
          "dev_color_sidebar_b": v.sidebarB,
          "dev_color_main_default": v.mainUseDefault ? "true" : "false",
          "dev_color_main_name": v.mainColorName,
          "dev_color_main_r": v.mainR,
          "dev_color_main_g": v.mainG,
          "dev_color_main_b": v.mainB,
        };
      }

      applyThemeForSettings(v);
      window.dispatchEvent(new Event("bbm:theme-refresh"));
      return true;
    } catch (err) {
      console.error("[SettingsView] _saveThemeSettings failed", {
        message: err?.message || String(err),
        stack: err?.stack || null,
      });
      alert(err?.message || "Speichern fehlgeschlagen");
      return false;
    } finally {
      this._themeSaving = false;
    }
  }

  async _loadThemeStartDefaults() {
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") {
      return false;
    }
    const res = await api.appSettingsGetMany(THEME_DEFAULT_KEYS);
    if (!res?.ok) return false;
    const startDefaults = this._readThemeStartDefaultsFromData(res.data || {});
    this._setThemeRuntimeDefaults(startDefaults);
    const themeSettings = normalizeThemeSettings({
      ...startDefaults,
      headerUseDefault: false,
      sidebarUseDefault: false,
      mainUseDefault: false,
      headerTone: 50,
      sidebarTone: 50,
      mainTone: 50,
    });
    this._applyThemeInputs(themeSettings);
    return true;
  }

  async _saveThemeStartDefaults() {
    if (this._themeSaving) return false;
    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    const v = this._getThemeInputValues();
    const payload = {
      "defaults.ui.themeHeaderBaseColor": v.headerBaseColor,
      "defaults.ui.themeSidebarBaseColor": v.sidebarBaseColor,
      "defaults.ui.themeMainBaseColor": v.mainBaseColor,
      "defaults.ui.themeHeaderTone": String(v.headerTone),
      "defaults.ui.themeSidebarTone": String(v.sidebarTone),
      "defaults.ui.themeMainTone": String(v.mainTone),
    };

    this._themeSaving = true;
    try {
      const res = await api.appSettingsSetMany(payload);
      if (!res?.ok) {
        alert(res?.error || "Speichern fehlgeschlagen");
        return false;
      }
      this._setThemeRuntimeDefaults({
        headerBaseColor: v.headerBaseColor,
        sidebarBaseColor: v.sidebarBaseColor,
        mainBaseColor: v.mainBaseColor,
        headerTone: v.headerTone,
        sidebarTone: v.sidebarTone,
        mainTone: v.mainTone,
      });

      if (this.router?.context) {
        this.router.context.settings = {
          ...(this.router.context.settings || {}),
          ...payload,
        };
      }

      applyThemeForSettings(this.router?.context?.settings || {});
      window.dispatchEvent(new Event("bbm:theme-refresh"));
      return true;
    } catch (err) {
      console.error("[SettingsView] _saveThemeStartDefaults failed", {
        message: err?.message || String(err),
        stack: err?.stack || null,
      });
      alert(err?.message || "Speichern fehlgeschlagen");
      return false;
    } finally {
      this._themeSaving = false;
    }
  }

  async _applyThemeStartDefaultsToUser() {
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function" || typeof api.appSettingsSetMany !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    const loadRes = await api.appSettingsGetMany(THEME_DEFAULT_KEYS);
    if (!loadRes?.ok) {
      alert(loadRes?.error || "Start-Defaults konnten nicht geladen werden.");
      return false;
    }
    const defaults = this._readThemeStartDefaultsFromData(loadRes.data || {});
    this._setThemeRuntimeDefaults(defaults);

    const payload = {
      "ui.themeHeaderBaseColor": defaults.headerBaseColor,
      "ui.themeSidebarBaseColor": defaults.sidebarBaseColor,
      "ui.themeMainBaseColor": defaults.mainBaseColor,
      "ui.themeHeaderTone": String(defaults.headerTone),
      "ui.themeSidebarTone": String(defaults.sidebarTone),
      "ui.themeMainTone": String(defaults.mainTone),
      "ui.themeHeaderUseDefault": "false",
      "ui.themeSidebarUseDefault": "false",
      "ui.themeMainUseDefault": "false",
      "dev_color_default_enabled": "false",
      "dev_color_header_default": "false",
      "dev_color_sidebar_default": "false",
      "dev_color_main_default": "false",
      "dev_color_header_r": String(this._themeHexToRgb(defaults.headerBaseColor, { r: 0, g: 0, b: 0 })?.r ?? 0),
      "dev_color_header_g": String(this._themeHexToRgb(defaults.headerBaseColor, { r: 0, g: 0, b: 0 })?.g ?? 0),
      "dev_color_header_b": String(this._themeHexToRgb(defaults.headerBaseColor, { r: 0, g: 0, b: 0 })?.b ?? 0),
      "dev_color_sidebar_r": String(this._themeHexToRgb(defaults.sidebarBaseColor, { r: 0, g: 0, b: 0 })?.r ?? 0),
      "dev_color_sidebar_g": String(this._themeHexToRgb(defaults.sidebarBaseColor, { r: 0, g: 0, b: 0 })?.g ?? 0),
      "dev_color_sidebar_b": String(this._themeHexToRgb(defaults.sidebarBaseColor, { r: 0, g: 0, b: 0 })?.b ?? 0),
      "dev_color_main_r": String(this._themeHexToRgb(defaults.mainBaseColor, { r: 0, g: 0, b: 0 })?.r ?? 0),
      "dev_color_main_g": String(this._themeHexToRgb(defaults.mainBaseColor, { r: 0, g: 0, b: 0 })?.g ?? 0),
      "dev_color_main_b": String(this._themeHexToRgb(defaults.mainBaseColor, { r: 0, g: 0, b: 0 })?.b ?? 0),
    };
    const saveRes = await api.appSettingsSetMany(payload);
    if (!saveRes?.ok) {
      alert(saveRes?.error || "Werkseinstellung konnte nicht aktiviert werden.");
      return false;
    }

    if (this.router?.context) {
      this.router.context.settings = {
        ...(this.router.context.settings || {}),
        ...payload,
        ...loadRes.data,
      };
    }
    this._applyThemeInputs({
      headerBaseColor: defaults.headerBaseColor,
      sidebarBaseColor: defaults.sidebarBaseColor,
      mainBaseColor: defaults.mainBaseColor,
      headerTone: defaults.headerTone,
      sidebarTone: defaults.sidebarTone,
      mainTone: defaults.mainTone,
      headerUseDefault: false,
      sidebarUseDefault: false,
      mainUseDefault: false,
    });
    applyThemeForSettings(this.router?.context?.settings || {});
    window.dispatchEvent(new Event("bbm:theme-refresh"));
    return true;
  }

  async _reloadSecurityPinState() {
    const api = window.bbmDb || {};
    if (typeof api.securitySettingsPinStatus !== "function") return;
    const res = await api.securitySettingsPinStatus();
    if (!res?.ok) return;
    this._securityPinEnabled = !!res.enabled;
    if (this.inpSecurityPinEnabled) this.inpSecurityPinEnabled.checked = this._securityPinEnabled;
    this._applyState();
  }

  async _saveSecurityPin() {
    const api = window.bbmDb || {};
    if (typeof api.securitySettingsPinSet !== "function") {
      alert("Security-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    const currentPin = (this.inpSecurityCurrentPin?.value || "").replace(/\D+/g, "").slice(0, 4);
    const newPin = (this.inpSecurityNewPin?.value || "").replace(/\D+/g, "").slice(0, 4);
    const confirmPin = (this.inpSecurityConfirmPin?.value || "").replace(/\D+/g, "").slice(0, 4);

    if (!/^\d{4}$/.test(newPin)) {
      alert("Neue PIN muss genau 4 Ziffern haben.");
      return false;
    }
    if (newPin !== confirmPin) {
      alert("PIN und Wiederholung stimmen nicht ueberein.");
      return false;
    }

    this._securityPinSaving = true;
    this._applyState();
    try {
      const res = await api.securitySettingsPinSet({ pin: newPin, currentPin });
      if (!res?.ok) {
        alert(res?.error || "PIN konnte nicht gespeichert werden.");
        return false;
      }
      if (this.inpSecurityCurrentPin) this.inpSecurityCurrentPin.value = "";
      if (this.inpSecurityNewPin) this.inpSecurityNewPin.value = "";
      if (this.inpSecurityConfirmPin) this.inpSecurityConfirmPin.value = "";
      await this._reloadSecurityPinState();
      this._setMsg("PIN gespeichert");
      return true;
    } finally {
      this._securityPinSaving = false;
      this._applyState();
    }
  }

  async _disableSecurityPin() {
    const api = window.bbmDb || {};
    if (typeof api.securitySettingsPinDisable !== "function") {
      alert("Security-API fehlt (IPC noch nicht aktiv).");
      return false;
    }
    const currentPin = (this.inpSecurityCurrentPin?.value || "").replace(/\D+/g, "").slice(0, 4);
    this._securityPinSaving = true;
    this._applyState();
    try {
      const res = await api.securitySettingsPinDisable({ currentPin });
      if (!res?.ok) {
        alert(res?.error || "PIN konnte nicht deaktiviert werden.");
        return false;
      }
      if (this.inpSecurityCurrentPin) this.inpSecurityCurrentPin.value = "";
      if (this.inpSecurityNewPin) this.inpSecurityNewPin.value = "";
      if (this.inpSecurityConfirmPin) this.inpSecurityConfirmPin.value = "";
      await this._reloadSecurityPinState();
      this._setMsg("PIN deaktiviert");
      return true;
    } finally {
      this._securityPinSaving = false;
      this._applyState();
    }
  }

  _pdfLogoDefaults() {
    return {
      enabled: true,
      widthMm: 35,
      topMm: 8,
      rightMm: 8,
    };
  }

  _parseBool(value, fallback) {
    if (value == null || value === "") return fallback;
    const s = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "ja", "on"].includes(s)) return true;
    if (["0", "false", "no", "nein", "off"].includes(s)) return false;
    return fallback;
  }

  _clampPdfLogoNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const v = Math.round(n);
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  _getPdfLogoInputValues() {
    const defaults = this._pdfLogoDefaults();
    const enabled = this._parseBool(this.inpPdfLogoEnabled?.checked, defaults.enabled);
    const widthMm = this._clampPdfLogoNumber(this.inpPdfLogoWidth?.value, 10, 60, defaults.widthMm);
    const topMm = this._clampPdfLogoNumber(this.inpPdfLogoTop?.value, 0, 30, defaults.topMm);
    const rightMm = this._clampPdfLogoNumber(
      this.inpPdfLogoRight?.value,
      0,
      30,
      defaults.rightMm
    );
    return { enabled, widthMm, topMm, rightMm };
  }

  _applyPdfLogoInputs({ enabled, widthMm, topMm, rightMm }) {
    if (this.inpPdfLogoEnabled) this.inpPdfLogoEnabled.checked = !!enabled;
    if (this.inpPdfLogoWidth) this.inpPdfLogoWidth.value = String(widthMm);
    if (this.inpPdfLogoTop) this.inpPdfLogoTop.value = String(topMm);
    if (this.inpPdfLogoRight) this.inpPdfLogoRight.value = String(rightMm);
  }

  _setPdfLogoFilePath(pathValue, { skipSave = false } = {}) {
    const next = String(pathValue || "");
    this._pdfLogoFilePath = next;
    if (this.pdfLogoPathEl) {
      this.pdfLogoPathEl.value = next;
      if (!next) this.pdfLogoPathEl.placeholder = "Kein Logo gewaehlt";
    }
    if (!skipSave) this._schedulePdfLogoSave();
  }

  _schedulePdfLogoSave() {
    if (this._pdfLogoSaveTimer) {
      clearTimeout(this._pdfLogoSaveTimer);
      this._pdfLogoSaveTimer = null;
    }
    this._pdfLogoSaveTimer = setTimeout(() => {
      this._pdfLogoSaveTimer = null;
      this._savePdfLogoSettings();
    }, 200);
  }

  async _savePdfLogoSettings() {
    if (this._pdfLogoSaving) return false;

    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    const { enabled, widthMm, topMm, rightMm } = this._getPdfLogoInputValues();
    this._applyPdfLogoInputs({ enabled, widthMm, topMm, rightMm });

    this._pdfLogoSaving = true;
    try {
      const res = await api.appSettingsSetMany({
        "pdf.userLogoEnabled": enabled ? "true" : "false",
        "pdf.userLogoWidthMm": widthMm,
        "pdf.userLogoTopMm": topMm,
        "pdf.userLogoRightMm": rightMm,
        "pdf.userLogoPngDataUrl": this._pdfLogoDataUrl || "",
        "pdf.userLogoFilePath": this._pdfLogoFilePath || "",
      });
      if (!res?.ok) {
        alert(res?.error || "Speichern fehlgeschlagen");
        return false;
      }

      if (this.router?.context) {
        this.router.context.settings = {
          ...(this.router.context.settings || {}),
          "pdf.userLogoEnabled": enabled ? "true" : "false",
          "pdf.userLogoWidthMm": widthMm,
          "pdf.userLogoTopMm": topMm,
          "pdf.userLogoRightMm": rightMm,
          "pdf.userLogoPngDataUrl": this._pdfLogoDataUrl || "",
          "pdf.userLogoFilePath": this._pdfLogoFilePath || "",
        };
      }
      return true;
    } finally {
      this._pdfLogoSaving = false;
    }
  }

  _pdfSettingsDefaults() {
    return {
      protocolTitle: "Baubesprechung",
      trafficLightAllEnabled: true,
      footerUseUserData: false,
      protocolsDir: "C:\\Downloads",
      preRemarks: DEFAULT_V2_PRE_REMARKS_TEXT,
      preRemarksEnabled: DEFAULT_V2_PRE_REMARKS_ENABLED,
    };
  }

  _getNormalizedUserFooterDefaults() {
    return {
      name1: this._normalizeUserText(this.inpUserName1?.value, 80),
      name2: this._normalizeUserText(this.inpUserName2?.value, 80),
      street: this._normalizeUserText(this.inpUserStreet?.value, 80),
      zip: this._normalizeUserZip(this.inpUserZip?.value, 5),
      city: this._normalizeUserText(this.inpUserCity?.value, 80),
    };
  }

  _todayDdMmYyyy() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  }

  _applyPdfFooterUserDefaultsFromUser(values, { overwriteExisting = false } = {}) {
    const data = values || this._getNormalizedUserFooterDefaults();
    const pairs = [
      [this.inpPdfFooterName1, data.name1],
      [this.inpPdfFooterName2, data.name2],
      [this.inpPdfFooterStreet, data.street],
      [this.inpPdfFooterZip, data.zip],
      [this.inpPdfFooterCity, data.city],
    ];

    for (const [input, value] of pairs) {
      if (!input) continue;
      const current = String(input.value || "").trim();
      if (current && !overwriteExisting) continue;
      const next = String(value || "").trim();
      if (!next) continue;
      input.value = next;
    }
  }

  _applyPdfFooterPlaceDateDefaults({ city } = {}) {
    let changed = false;
    if (this.inpPdfFooterPlace) {
      const current = String(this.inpPdfFooterPlace.value || "").trim();
      const next = String(city || "").trim();
      if (!current && next) {
        this.inpPdfFooterPlace.value = next;
        changed = true;
      }
    }
    if (this.inpPdfFooterDate) {
      const current = String(this.inpPdfFooterDate.value || "").trim();
      if (!current) {
        this.inpPdfFooterDate.value = this._todayDdMmYyyy();
        changed = true;
      }
    }
    return changed;
  }

  _getPdfSettingsInputValues() {
    const defaults = this._pdfSettingsDefaults();
    const protocolTitle = this._normalizeUserText(this.inpPdfProtocolTitle?.value, 80);
    const trafficLightAllEnabled = this._parseBool(
      this.inpPdfTrafficLightAll?.checked,
      defaults.trafficLightAllEnabled
    );
    const protocolsDirRaw = (this.inpPdfProtocolsDir?.value ?? "").toString().trim();
    const protocolsDir = protocolsDirRaw || defaults.protocolsDir;
    const footerUseUserData = this._parseBool(
      this.pdfFooterUseUserData,
      defaults.footerUseUserData
    );
    const footerPlace = this._normalizeUserText(this.inpPdfFooterPlace?.value, 80);
    const footerDate = this._normalizeUserText(this.inpPdfFooterDate?.value, 40);
    const footerName1 = this._normalizeUserText(this.inpPdfFooterName1?.value, 80);
    const footerName2 = this._normalizeUserText(this.inpPdfFooterName2?.value, 80);
    const footerRecorder = this._normalizeUserText(this.inpPdfFooterRecorder?.value, 80);
    const footerStreet = this._normalizeUserText(this.inpPdfFooterStreet?.value, 80);
    const footerZip = this._normalizeUserZip(this.inpPdfFooterZip?.value);
    const footerCity = this._normalizeUserText(this.inpPdfFooterCity?.value, 80);
    const preRemarks = this._normalizePdfPreRemarks(this.pdfPreRemarks ?? defaults.preRemarks);
    const preRemarksEnabled = this._parseBool(this.pdfPreRemarksEnabled, defaults.preRemarksEnabled);

    return {
      protocolTitle,
      trafficLightAllEnabled,
      protocolsDir,
      preRemarks,
      preRemarksEnabled,
      footerUseUserData,
      footerPlace,
      footerDate,
      footerName1,
      footerName2,
      footerRecorder,
      footerStreet,
      footerZip,
      footerCity,
    };
  }

  _applyPdfSettingsInputs(values) {
    if (!values) return;
    if (this.inpPdfProtocolTitle) this.inpPdfProtocolTitle.value = values.protocolTitle || "";
    if (this.inpPdfTrafficLightAll) this.inpPdfTrafficLightAll.checked = !!values.trafficLightAllEnabled;
    this.pdfFooterUseUserData = !!values.footerUseUserData;
    if (this.inpPdfProtocolsDir) {
      const defaults = this._pdfSettingsDefaults();
      this.inpPdfProtocolsDir.value = String(values.protocolsDir || "").trim() || defaults.protocolsDir;
    }
    if (this.inpPdfFooterPlace) this.inpPdfFooterPlace.value = values.footerPlace || "";
    if (this.inpPdfFooterDate) this.inpPdfFooterDate.value = values.footerDate || "";
    if (this.inpPdfFooterName1) this.inpPdfFooterName1.value = values.footerName1 || "";
    if (this.inpPdfFooterName2) this.inpPdfFooterName2.value = values.footerName2 || "";
    if (this.inpPdfFooterRecorder) this.inpPdfFooterRecorder.value = values.footerRecorder || "";
    if (this.inpPdfFooterStreet) this.inpPdfFooterStreet.value = values.footerStreet || "";
    if (this.inpPdfFooterZip) this.inpPdfFooterZip.value = values.footerZip || "";
    if (this.inpPdfFooterCity) this.inpPdfFooterCity.value = values.footerCity || "";
    this.pdfPreRemarks = this._normalizePdfPreRemarks(values.preRemarks || "");
    this.pdfPreRemarksEnabled = this._parseBool(values.preRemarksEnabled, false);
  }

  _schedulePdfSettingsSave({ markTouched = true } = {}) {
    if (this._pdfSettingsSaveTimer) {
      clearTimeout(this._pdfSettingsSaveTimer);
      this._pdfSettingsSaveTimer = null;
    }
    this._pdfSettingsSaveTimer = setTimeout(() => {
      this._pdfSettingsSaveTimer = null;
      this._savePdfSettings({ markTouched });
    }, 200);
  }

  async _savePdfSettings({ markTouched = true } = {}) {
    if (this._pdfSettingsSaving) return false;
    if (this.saving) return false;

    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    const defaults = this._pdfSettingsDefaults();
    const useUserData = this._parseBool(this.pdfFooterUseUserData, defaults.footerUseUserData);
    if (useUserData) {
      this._applyPdfFooterUserDefaultsFromUser(undefined, { overwriteExisting: true });
    }

    const values = this._getPdfSettingsInputValues();
    this._applyPdfSettingsInputs(values);

    this._pdfSettingsSaving = true;

    try {
      const payload = {
        "pdf.protocolTitle": values.protocolTitle,
        "pdf.trafficLightAllEnabled": values.trafficLightAllEnabled ? "true" : "false",
        "pdf.protocolsDir": values.protocolsDir,
        "pdf.preRemarks": values.preRemarks,
        "print.preRemarks.enabled": values.preRemarksEnabled ? "true" : "false",
        "pdf.footerPlace": values.footerPlace,
        "pdf.footerDate": values.footerDate,
        "pdf.footerName1": values.footerName1,
        "pdf.footerName2": values.footerName2,
        "pdf.footerRecorder": values.footerRecorder,
        "pdf.footerStreet": values.footerStreet,
        "pdf.footerZip": values.footerZip,
        "pdf.footerCity": values.footerCity,
        "pdf.footerUseUserData": values.footerUseUserData ? "true" : "false",
      };
      if (markTouched) {
        Object.assign(
          payload,
          this._buildTouchedPayloadFromValues({
            "pdf.protocolTitle": values.protocolTitle,
            "pdf.protocolsDir": values.protocolsDir,
            "pdf.preRemarks": values.preRemarks,
            "pdf.footerPlace": values.footerPlace,
            "pdf.footerDate": values.footerDate,
            "pdf.footerName1": values.footerName1,
            "pdf.footerName2": values.footerName2,
            "pdf.footerRecorder": values.footerRecorder,
            "pdf.footerStreet": values.footerStreet,
            "pdf.footerZip": values.footerZip,
            "pdf.footerCity": values.footerCity,
          }),
          this._buildTouchedPayloadForKeys([
            "pdf.trafficLightAllEnabled",
            "print.preRemarks.enabled",
            "pdf.footerUseUserData",
          ])
        );
      }
      const res = await api.appSettingsSetMany(payload);
      if (!res?.ok) {
        alert(res?.error || "Speichern fehlgeschlagen");
        return false;
      }

      if (this.router?.context) {
        this.router.context.settings = {
          ...(this.router.context.settings || {}),
          "pdf.protocolTitle": values.protocolTitle,
          "pdf.trafficLightAllEnabled": values.trafficLightAllEnabled ? "true" : "false",
          "pdf.protocolsDir": values.protocolsDir,
          "pdf.preRemarks": values.preRemarks,
          "print.preRemarks.enabled": values.preRemarksEnabled ? "true" : "false",
          "pdf.footerPlace": values.footerPlace,
          "pdf.footerDate": values.footerDate,
          "pdf.footerName1": values.footerName1,
          "pdf.footerName2": values.footerName2,
          "pdf.footerRecorder": values.footerRecorder,
          "pdf.footerStreet": values.footerStreet,
          "pdf.footerZip": values.footerZip,
          "pdf.footerCity": values.footerCity,
          "pdf.footerUseUserData": values.footerUseUserData ? "true" : "false",
        };
      }
      return true;
    } finally {
      this._pdfSettingsSaving = false;
    }
  }

  _normalizePrintLogoSize(value) {
    const s = String(value || "").trim().toLowerCase();
    if (s === "small" || s === "medium" || s === "large") return s;
    return "medium";
  }

  _normalizePrintLogoAlign(value) {
    const s = String(value || "").trim().toLowerCase();
    if (s === "left" || s === "center" || s === "right") return s;
    return "center";
  }

  _normalizePrintLogoVAlign(value) {
    const s = String(value || "").trim().toLowerCase();
    if (s === "top" || s === "middle" || s === "bottom") return s;
    return "bottom";
  }

  _previewLogoMaxHeightPx(sizeValue) {
    const size = this._normalizePrintLogoSize(sizeValue);
    if (size === "small") return 44;
    if (size === "large") return 72;
    return 58;
  }

  _applyPrintLogoPreviewSize(slotIndex, sizeValue) {
    const idx = Number(slotIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 2) return;
    const img = this.printLogoPreviewImgs?.[idx];
    if (!img) return;
    img.style.maxHeight = String(this._previewLogoMaxHeightPx(sizeValue)) + "px";
  }

  _applyPrintLogoSize(slotIndex, value) {
    const idx = Number(slotIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 2) return;
    const normalized = this._normalizePrintLogoSize(value);
    const sel = this.printLogoSizeSelects?.[idx];
    if (!sel) return;
    sel.value = normalized;
    this._applyPrintLogoPreviewSize(idx, normalized);
  }

  _applyPrintLogoAlign(slotIndex, value) {
    const idx = Number(slotIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 2) return;
    const normalized = this._normalizePrintLogoAlign(value);
    const checks = this.printLogoAlignChecks?.[idx];
    if (checks) {
      if (checks.left) checks.left.checked = normalized === "left";
      if (checks.center) checks.center.checked = normalized === "center";
      if (checks.right) checks.right.checked = normalized === "right";
    }
    const frame = this.printLogoPreviewFrames?.[idx];
    if (frame) {
      frame.style.justifyContent = normalized === "left"
        ? "flex-start"
        : normalized === "right"
          ? "flex-end"
          : "center";
    }
  }

  _applyPrintLogoVAlign(slotIndex, value) {
    const idx = Number(slotIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 2) return;
    const normalized = this._normalizePrintLogoVAlign(value);
    const checks = this.printLogoVAlignChecks?.[idx];
    if (checks) {
      if (checks.top) checks.top.checked = normalized === "top";
      if (checks.middle) checks.middle.checked = normalized === "middle";
      if (checks.bottom) checks.bottom.checked = normalized === "bottom";
    }
    const frame = this.printLogoPreviewFrames?.[idx];
    if (frame) {
      frame.style.alignItems = normalized === "top"
        ? "flex-start"
        : normalized === "middle"
          ? "center"
          : "flex-end";
    }
  }

  _setPrintLogoDataUrl(slotIndex, dataUrl) {
    const idx = Number(slotIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 2) return;
    const next = String(dataUrl || "");
    this._printLogoDataUrls[idx] = next;

    const placeholder = this.printLogoPlaceholderEls?.[idx];
    if (placeholder) {
      placeholder.style.display = next ? "none" : "flex";
    }

    const img = this.printLogoPreviewImgs?.[idx];
    if (img) {
      if (next) {
        img.src = next;
        img.style.display = "block";
      } else {
        img.src = "";
        img.style.display = "none";
      }
    }

    const fileInp = this.printLogoFileInputs?.[idx];
    if (fileInp) fileInp.value = "";
  }

  _applyPrintLogoInputsFromSettings(data) {
    const legacyPreset = this._normalizePrintLogoSize(data["print.logoSizePreset"]);
    if (this.inpPrintHeaderAdaptive) {
      this.inpPrintHeaderAdaptive.checked = this._parseBool(data["print.v2.globalHeaderAdaptive"], false);
    }
    for (let i = 0; i < 3; i++) {
      const keyNo = String(i + 1);
      const enabled = this._parseBool(data["print.logo" + keyNo + ".enabled"], false);
      const dataUrl = String(data["print.logo" + keyNo + ".pngDataUrl"] || "").trim();
      const sizeRaw = data["print.logo" + keyNo + ".size"];
      const size = sizeRaw == null || String(sizeRaw).trim() === ""
        ? legacyPreset
        : this._normalizePrintLogoSize(sizeRaw);
      const align = this._normalizePrintLogoAlign(data["print.logo" + keyNo + ".align"]);
      const vAlign = this._normalizePrintLogoVAlign(data["print.logo" + keyNo + ".vAlign"]);
      const inp = this.printLogoEnabledInputs?.[i];
      if (inp) inp.checked = !!enabled;
      this._applyPrintLogoSize(i, size);
      this._applyPrintLogoAlign(i, align);
      this._applyPrintLogoVAlign(i, vAlign);
      this._setPrintLogoDataUrl(i, dataUrl);
    }
  }

  _getPrintLogoValues() {
    const values = {
      headerAdaptive: !!this.inpPrintHeaderAdaptive?.checked,
      slots: [
        { enabled: false, size: "medium", align: "center", vAlign: "bottom", dataUrl: "" },
        { enabled: false, size: "medium", align: "center", vAlign: "bottom", dataUrl: "" },
        { enabled: false, size: "medium", align: "center", vAlign: "bottom", dataUrl: "" },
      ],
    };
    for (let i = 0; i < 3; i++) {
      values.slots[i].enabled = !!this.printLogoEnabledInputs?.[i]?.checked;
      values.slots[i].size = this._normalizePrintLogoSize(this.printLogoSizeSelects?.[i]?.value);
      values.slots[i].align = this._normalizePrintLogoAlign(
        this.printLogoAlignChecks?.[i]?.left?.checked
          ? "left"
          : this.printLogoAlignChecks?.[i]?.right?.checked
            ? "right"
            : "center"
      );
      values.slots[i].vAlign = this._normalizePrintLogoVAlign(
        this.printLogoVAlignChecks?.[i]?.top?.checked
          ? "top"
          : this.printLogoVAlignChecks?.[i]?.middle?.checked
            ? "middle"
            : "bottom"
      );
      values.slots[i].dataUrl = String(this._printLogoDataUrls?.[i] || "").trim();
    }
    return values;
  }

  async _savePrintLogoSettings() {
    if (this._printLogoSaving) return false;
    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    const values = this._getPrintLogoValues();
    this._printLogoSaving = true;
    this._applyState();
    try {
      const payload = {};
      payload["print.v2.globalHeaderAdaptive"] = values.headerAdaptive ? "true" : "false";
      for (let i = 0; i < 3; i++) {
        const keyNo = String(i + 1);
        payload["print.logo" + keyNo + ".enabled"] = values.slots[i].enabled ? "true" : "false";
        payload["print.logo" + keyNo + ".size"] = values.slots[i].size;
        payload["print.logo" + keyNo + ".align"] = values.slots[i].align;
        payload["print.logo" + keyNo + ".vAlign"] = values.slots[i].vAlign;
        payload["print.logo" + keyNo + ".pngDataUrl"] = values.slots[i].dataUrl;
      }
      // Legacy fallback fuer bestehende Renderer-Pfade mit globalem Preset.
      payload["print.logoSizePreset"] = values.slots[0].size;
      const res = await api.appSettingsSetMany(payload);
      if (!res?.ok) {
        alert(res?.error || "Logo-Einstellungen konnten nicht gespeichert werden.");
        return false;
      }
      if (this.router?.context) {
        this.router.context.settings = {
          ...(this.router.context.settings || {}),
          ...payload,
        };
      }
      return true;
    } finally {
      this._printLogoSaving = false;
      this._applyState();
    }
  }

  async _handlePrintLogoFileInput(slotIndex) {
    const idx = Number(slotIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx > 2) return;
    const file = this.printLogoFileInputs?.[idx]?.files?.[0] || null;
    if (!file) return;
    try {
      const dataUrl = await this._convertImageFileToPngDataUrl(file);
      if (!dataUrl) {
        alert("Logo konnte nicht gelesen werden.");
        return;
      }
      this._setPrintLogoDataUrl(idx, dataUrl);
      if (this.printLogoEnabledInputs?.[idx]) {
        this.printLogoEnabledInputs[idx].checked = true;
      }
    } catch (_e) {
      alert("Logo konnte nicht verarbeitet werden.");
    } finally {
      if (this.printLogoFileInputs?.[idx]) {
        this.printLogoFileInputs[idx].value = "";
      }
    }
  }

  async _handlePdfLogoFileInput() {
    const file = this.inpPdfLogoFile?.files?.[0] || null;
    if (!file) return;

    try {
      const dataUrl = await this._convertImageFileToPngDataUrl(file);
      if (!dataUrl) {
        alert("Logo konnte nicht gelesen werden.");
        return;
      }
      const pathValue = (file.path || file.name || "").toString();
      if (pathValue) this._setPdfLogoFilePath(pathValue, { skipSave: true });
      this._setPdfLogoDataUrl(dataUrl);
    } catch (_e) {
      alert("Logo konnte nicht verarbeitet werden.");
    } finally {
      if (this.inpPdfLogoFile) this.inpPdfLogoFile.value = "";
    }
  }

  async _convertImageFileToPngDataUrl(file) {
    const maxWidth = 800;
    let bitmap = null;
    let img = null;
    let revoke = null;

    if (typeof createImageBitmap === "function") {
      try {
        bitmap = await createImageBitmap(file);
      } catch (_e) {
        bitmap = null;
      }
    }

    if (!bitmap) {
      const url = URL.createObjectURL(file);
      revoke = () => URL.revokeObjectURL(url);
      img = await new Promise((resolve) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => resolve(null);
        el.src = url;
      });
    }

    const src = bitmap || img;
    if (!src) {
      if (revoke) revoke();
      return "";
    }

    const width = Number(src.width || src.naturalWidth || 0);
    const height = Number(src.height || src.naturalHeight || 0);
    if (!width || !height) {
      if (bitmap?.close) bitmap.close();
      if (revoke) revoke();
      return "";
    }

    const scale = width > maxWidth ? maxWidth / width : 1;
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (bitmap?.close) bitmap.close();
      if (revoke) revoke();
      return "";
    }

    ctx.drawImage(src, 0, 0, outW, outH);
    if (bitmap?.close) bitmap.close();
    if (revoke) revoke();

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
    if (!blob) return "";

    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });

    return String(dataUrl || "");
  }

  async _loadImageSizeFromDataUrl(dataUrl) {
    if (!dataUrl) return null;
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  async _loadPdfLogoPixelSize(dataUrl) {
    const token = ++this._pdfLogoLoadToken;
    const dims = await this._loadImageSizeFromDataUrl(dataUrl);
    if (token !== this._pdfLogoLoadToken) return;
    this._pdfLogoPx = dims;
    this._updatePdfLogoQuality();
  }

  _setPdfLogoDataUrl(dataUrl, { skipSave = false } = {}) {
    const next = String(dataUrl || "");
    this._pdfLogoDataUrl = next;

    // Dummy/Preview umschalten
    if (this.pdfLogoDummyEl) {
      this.pdfLogoDummyEl.style.display = next ? "none" : "flex";
    }

    if (this.imgPdfLogoPreview) {
      if (next) {
        this.imgPdfLogoPreview.src = next;
        this.imgPdfLogoPreview.style.display = "block";
      } else {
        this.imgPdfLogoPreview.src = "";
        this.imgPdfLogoPreview.style.display = "none";
      }
    }

    if (this.inpPdfLogoFile) this.inpPdfLogoFile.value = "";

    if (next) {
      this._loadPdfLogoPixelSize(next);
    } else {
      this._pdfLogoPx = null;
      this._updatePdfLogoQuality();
    }

    if (!skipSave) this._schedulePdfLogoSave();
  }

  _updatePdfLogoQuality() {
    if (!this.pdfLogoQualityEl) return;
    const { widthMm } = this._getPdfLogoInputValues();
    const okPx = Math.round((widthMm * 150) / 25.4);
    const goodPx = Math.round((widthMm * 300) / 25.4);

    const pxWidth = Number(this._pdfLogoPx?.width || 0);
    const pxHeight = Number(this._pdfLogoPx?.height || 0);

    let dpiEff = 0;
    if (pxWidth > 0 && widthMm > 0) {
      dpiEff = Math.round((pxWidth * 25.4) / widthMm);
    }

    let status = "Kein Logo gesetzt";
    let statusColor = "#666";

    if (pxWidth > 0) {
      if (dpiEff < 150) {
        status = "Wird im Druck unscharf...";
        statusColor = "#c62828";
      } else if (dpiEff < 300) {
        status = "OK";
        statusColor = "#ef6c00";
      } else {
        status = "Sehr scharf";
        statusColor = "#2e7d32";
      }
    }

    const logoInfo = pxWidth > 0 ? `${pxWidth}x${pxHeight}px` : "-";
    const dpiInfo = dpiEff > 0 ? `${dpiEff} dpi` : "-";

    this.pdfLogoQualityEl.innerHTML = `
      <div style="font-weight:600; color:${statusColor};">Qualitaet: ${status}</div>
      <div>Fuer ${widthMm} mm: empfohlen >= ${okPx}px (ok) / ${goodPx}px (sehr scharf). Dein Logo: ${logoInfo} (~${dpiInfo}).</div>
    `.trim();
  }

  _forceEnableAddRoleInput() {
    if (!this.inpAddRole) return;
    this.inpAddRole.disabled = false;
    this.inpAddRole.removeAttribute("disabled");
    this.inpAddRole.readOnly = false;
    this.inpAddRole.style.pointerEvents = "auto";
  }

  _enableAddRoleControls() {
    if (this.btnAddRole) this.btnAddRole.disabled = false;
    this._forceEnableAddRoleInput();
  }

  _resolveDeleteConfirm(ok) {
    if (this.deleteConfirmOverlayEl) this.deleteConfirmOverlayEl.style.display = "none";
    this._unlockBodyScroll();
    const fn = this._deleteConfirmResolve;
    this._deleteConfirmResolve = null;
    if (typeof fn === "function") fn(!!ok);
  }

  _confirmDeleteCategory(message) {
    if (this.deleteConfirmOverlayEl) this.deleteConfirmOverlayEl.style.display = "flex";
    this._lockBodyScroll();
    if (this.deleteConfirmMsgEl) this.deleteConfirmMsgEl.textContent = message || "";
    if (this.deleteConfirmOkBtn) this.deleteConfirmOkBtn.disabled = false;
    if (this.deleteConfirmCancelBtn) this.deleteConfirmCancelBtn.disabled = false;
    if (this.deleteConfirmOverlayEl) this.deleteConfirmOverlayEl.tabIndex = -1;
    return new Promise((resolve) => {
      this._deleteConfirmResolve = resolve;
      if (this.deleteConfirmOverlayEl) this.deleteConfirmOverlayEl.focus();
    });
  }

  _resolveRename(ok) {
    if (this.renameOverlayEl) this.renameOverlayEl.style.display = "none";
    this._unlockBodyScroll();
    const fn = this._renameResolve;
    this._renameResolve = null;
    if (typeof fn === "function") fn(!!ok);
  }

  _promptRenameCategory(current) {
    if (this.renameOverlayEl) this.renameOverlayEl.style.display = "flex";
    this._lockBodyScroll();
    if (this.renameInputEl) {
      this.renameInputEl.value = current || "";
      this.renameInputEl.focus();
      this.renameInputEl.select();
    }
    if (this.renameOkBtn) this.renameOkBtn.disabled = false;
    if (this.renameCancelBtn) this.renameCancelBtn.disabled = false;
    return new Promise((resolve) => {
      this._renameResolve = resolve;
    });
  }

  _activateAddRoleInput() {
    if (!this.inpAddRole) return;
    this._forceEnableAddRoleInput();
    try {
      this.inpAddRole.focus();
      this.inpAddRole.click();
    } catch {
      // ignore
    }
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

  _fallbackRoleCode() {
    return 60;
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

  _roleOptions() {
    const labels = this.roleLabels || this._defaultRoleLabels();
    const order =
      Array.isArray(this.roleOrder) && this.roleOrder.length ? this.roleOrder : this._defaultRoleOrder();

    return order.map((code) => ({
      code,
      label: labels[code] || `Kategorie ${code}`,
    }));
  }

  _renderRoleOrderList() {
    if (!this.roleListEl) return;

    const options = this._roleOptions();
    const labelByCode = new Map(options.map((o) => [o.code, o.label]));
    const busy = !!this.saving;

    this.roleListEl.innerHTML = "";

    const list = Array.isArray(this.roleOrder) ? this.roleOrder : [];
    const visible = list.filter((code) => labelByCode.has(code));

    visible.forEach((code) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.padding = "6px 8px";
      row.style.borderBottom = "1px solid #eee";
      row.style.borderRadius = "6px";
      row.style.cursor = "pointer";

      const isSelected = String(this.roleSelectedCode || "") === String(code);
      row.style.background = isSelected ? "#dff0ff" : "transparent";
      row.style.border = isSelected ? "1px solid #7aa7ff" : "1px solid transparent";
      row.style.fontWeight = isSelected ? "700" : "400";

      row.onclick = () => {
        if (busy) return;
        this._selectRole(code);
        if (this.roleListEl) this.roleListEl.focus();
      };

      const labelWrap = document.createElement("div");
      labelWrap.style.flex = "1 1 auto";
      labelWrap.style.minWidth = "0";

      if (String(this.roleRenameCode || "") === String(code)) {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = labelByCode.get(code) || String(code);
        inp.style.width = "100%";
        inp.onkeydown = (e) => this._handleRoleRenameKey(e);
        inp.onblur = () => this._commitRoleInlineRename({ commit: true });
        this.roleRenameInputEl = inp;
        labelWrap.append(inp);
        setTimeout(() => {
          try {
            inp.focus();
            inp.select();
          } catch {
            // ignore
          }
        }, 0);
      } else {
        const label = document.createElement("div");
        label.textContent = labelByCode.get(code) || String(code);
        label.title = `Code ${code}`;
        labelWrap.append(label);
      }

      row.append(labelWrap);
      this.roleListEl.appendChild(row);
    });

    this._updateRoleActionsState();
  }

  _updateRoleActionsState() {
    const hasSelection = this.roleSelectedCode !== null && this.roleSelectedCode !== undefined;
    const busy = !!this.saving;
    const canDelete =
      hasSelection && String(this.roleSelectedCode) !== String(this._fallbackRoleCode());
    if (this.btnRoleMove) {
      this.btnRoleMove.disabled = busy || !hasSelection;
      this.btnRoleMove.style.opacity = this.btnRoleMove.disabled ? "0.55" : "1";
      this.btnRoleMove.style.background = this.roleMoveModeActive ? "#e8f2ff" : "#f3f3f3";
      this.btnRoleMove.style.border = this.roleMoveModeActive
        ? "1px solid #7aa7ff"
        : "1px solid #ddd";
    }
    if (this.roleMoveHintEl) {
      this.roleMoveHintEl.style.display = this.roleMoveModeActive ? "" : "none";
    }
    if (this.btnRoleDelete) {
      this.btnRoleDelete.disabled = busy || !canDelete;
      this.btnRoleDelete.style.opacity = this.btnRoleDelete.disabled ? "0.55" : "1";
    }
    if (this.btnRoleRename) {
      this.btnRoleRename.disabled = busy || !hasSelection;
      this.btnRoleRename.style.opacity = this.btnRoleRename.disabled ? "0.55" : "1";
    }
  }

  _selectRole(code) {
    this.roleSelectedCode = code;
    this._renderRoleOrderList();
  }

  _toggleRoleMoveMode() {
    if (this.saving) return;
    if (!this.roleSelectedCode) return;
    this.roleMoveModeActive = !this.roleMoveModeActive;
    if (this.roleMoveModeActive) {
      this._attachRoleMoveMouseDown();
      this._attachRoleMoveKeyDown();
    } else {
      this._detachRoleMoveMouseDown();
      this._detachRoleMoveKeyDown();
    }
    if (this.roleMoveModeActive) {
      this.roleRenameCode = null;
      this.roleRenameInputEl = null;
    }
    this._renderRoleOrderList();
  }

  _attachRoleMoveMouseDown() {
    if (this._roleMoveMouseDownHandler) return;
    this._roleMoveMouseDownHandler = () => {
      if (!this.roleMoveModeActive) return;
      this.roleMoveModeActive = false;
      this._detachRoleMoveMouseDown();
      this._detachRoleMoveKeyDown();
      this._renderRoleOrderList();
    };
    document.addEventListener("mousedown", this._roleMoveMouseDownHandler, true);
  }

  _detachRoleMoveMouseDown() {
    if (!this._roleMoveMouseDownHandler) return;
    document.removeEventListener("mousedown", this._roleMoveMouseDownHandler, true);
    this._roleMoveMouseDownHandler = null;
  }

  _attachRoleMoveKeyDown() {
    if (this._roleMoveKeyDownHandler) return;
    this._roleMoveKeyDownHandler = (e) => {
      if (!this.roleMoveModeActive) return;
      if (this.roleRenameCode) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this._moveSelectedRole(-1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this._moveSelectedRole(1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        this.roleMoveModeActive = false;
        this._detachRoleMoveMouseDown();
        this._detachRoleMoveKeyDown();
        this._renderRoleOrderList();
      }
    };
    document.addEventListener("keydown", this._roleMoveKeyDownHandler, true);
  }

  _detachRoleMoveKeyDown() {
    if (!this._roleMoveKeyDownHandler) return;
    document.removeEventListener("keydown", this._roleMoveKeyDownHandler, true);
    this._roleMoveKeyDownHandler = null;
  }

  _handleRoleKeyDown(e) {
    if (!this._settingsModalOpen) return;

    if (this.roleRenameCode) {
      this._handleRoleRenameKey(e);
      return;
    }

    if (!this.roleMoveModeActive) return;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      this._moveSelectedRole(-1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this._moveSelectedRole(1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      this._toggleRoleMoveMode();
    }
  }

  _handleRoleRenameKey(e) {
    if (!this.roleRenameCode) return;
    if (e.key === "Enter") {
      e.preventDefault();
      this._commitRoleInlineRename({ commit: true });
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this._commitRoleInlineRename({ commit: false });
    }
  }

  _commitRoleInlineRename({ commit } = {}) {
    if (!this.roleRenameCode) return true;
    const code = this.roleRenameCode;
    const raw = this.roleRenameInputEl?.value ?? "";
    const label = String(raw).trim();

    if (commit) {
      if (!label) return false;
      this.roleLabels = { ...(this.roleLabels || {}) };
      this.roleLabels[code] = label;
    }

    this.roleRenameCode = null;
    this.roleRenameInputEl = null;
    this._renderRoleOrderList();
    if (commit) {
      this._saveRoleMeta();
    }
    return true;
  }

  _startRenameSelectedRole() {
    if (this.saving) return;
    if (!this.roleSelectedCode) return;
    this.roleMoveModeActive = false;
    this.roleRenameCode = this.roleSelectedCode;
    this._renderRoleOrderList();
  }

  async _deleteSelectedRole() {
    if (this.saving) return;
    if (!this.roleSelectedCode) return;
    const list = Array.isArray(this.roleOrder) ? this.roleOrder : [];
    const idx = list.findIndex((c) => String(c) === String(this.roleSelectedCode));
    const nextCode = idx >= 0 ? list[idx + 1] ?? list[idx - 1] ?? null : null;
    this._roleSelectionAfterReload = nextCode;
    await this._deleteRoleCategory(this.roleSelectedCode);
  }

  async _moveSelectedRole(delta) {
    if (this.saving) return;
    const list = Array.isArray(this.roleOrder) ? [...this.roleOrder] : [];
    const idx = list.findIndex((c) => String(c) === String(this.roleSelectedCode));
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const tmp = list[idx];
    list[idx] = list[target];
    list[target] = tmp;
    this.roleOrder = list;
    this._renderRoleOrderList();
    await this._saveRoleMeta();
  }

  async _moveRole(index, delta) {
    if (this.saving) return;
    const list = Array.isArray(this.roleOrder) ? [...this.roleOrder] : [];
    const a = index;
    const b = index + delta;
    if (a < 0 || b < 0 || a >= list.length || b >= list.length) return;
    const tmp = list[a];
    list[a] = list[b];
    list[b] = tmp;
    this.roleOrder = list;
    this._renderRoleOrderList();
    await this._saveRoleMeta();
  }

  async _renameRoleCategory(code) {
    if (this.saving) return;
    const current = (this.roleLabels && this.roleLabels[code]) || `Kategorie ${code}`;
    const ok = await this._promptRenameCategory(current);
    if (!ok) return;
    const next = this.renameInputEl?.value ?? "";
    const label = String(next).trim();
    if (!label) return;

    this.roleLabels = { ...(this.roleLabels || {}) };
    this.roleLabels[code] = label;
    this._renderRoleOrderList();
    await this._saveRoleMeta();
  }

  async _addRoleCategory() {
    if (this.saving) return;
    const label = (this.inpAddRole?.value || "").trim();
    if (!label) return;

    const order = Array.isArray(this.roleOrder) ? [...this.roleOrder] : [];
    const codes = [...order, ...Object.keys(this.roleLabels || {}).map((k) => Number(k))].filter((n) =>
      Number.isFinite(n)
    );

    const max = codes.length ? Math.max(...codes) : 0;
    const newCode = Math.trunc(max) + 10;

    this.roleLabels = { ...(this.roleLabels || {}) };
    this.roleLabels[newCode] = label;
    this.roleOrder = [...order, newCode];

    this._renderRoleOrderList();
    await this._saveRoleMeta();

    if (this.inpAddRole) this.inpAddRole.value = "";
  }

  async _deleteRoleCategory(code) {
    if (this.saving) return;
    if (code === this._fallbackRoleCode()) return;

    const labels = this.roleLabels || this._defaultRoleLabels();
    const fallbackCode = this._fallbackRoleCode();
    const label = labels[code] || `Kategorie ${code}`;
    const fallbackLabel = labels[fallbackCode] || this._defaultRoleLabels()[fallbackCode];

    const ok = await this._confirmDeleteCategory(
      `Kategorie "${label}" wird geloescht. Firmen werden auf "${fallbackLabel}" umgestellt. Fortfahren?`
    );
    if (!ok) return;

    const api = window.bbmDb || {};
    if (typeof api.settingsCategoriesDelete !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return;
    }

    this.saving = true;
    this._setMsg("Loesche...");
    this._applyState();

    let infoMsg = "";
    try {
      const res = await api.settingsCategoriesDelete({
        code,
        fallbackCode,
      });
      if (!res?.ok) {
        alert(res?.error || "Loeschen fehlgeschlagen");
        return;
      }

      const firms = Number(res?.reassignedCounts?.firms || 0);
      const projectFirms = Number(res?.reassignedCounts?.projectFirms || 0);
      infoMsg = `Umgehaengt: Stamm ${firms}, Projekt ${projectFirms}`;
    } finally {
      this.saving = false;
      this._applyState();
      await this._reload();
      if (infoMsg) this._setMsg(infoMsg);
      this._enableAddRoleControls();
      try {
        window.focus();
      } catch {
        // ignore
      }
      setTimeout(() => {
        this._enableAddRoleControls();
        this._activateAddRoleInput();
      }, 100);
    }
  }

  async _saveRoleMeta() {
    if (this.saving) return false;

    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    this.saving = true;
    this._setMsg("Speichere...");
    this._applyState();

    try {
      const res = await api.appSettingsSetMany({
        firm_role_order: JSON.stringify(this.roleOrder || []),
        firm_role_labels: JSON.stringify(this.roleLabels || {}),
      });
      if (!res?.ok) {
        alert(res?.error || "Speichern fehlgeschlagen");
        return false;
      }

      this._setMsg("Gespeichert");
      return true;
    } finally {
      this.saving = false;
      this._applyState();
    }
  }

  async _reload() {
    this._setMsg("");
    this._applyState();

    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") {
      this._setMsg("Settings-API fehlt (IPC noch nicht aktiv).");
      this._applyState();
      return;
    }

    const res = await api.appSettingsGetMany([
      "user_name",
      "user_company",
      "user_name1",
      "user_name2",
      "user_street",
      "user_zip",
      "user_city",
      "firm_role_order",
      "firm_role_labels",
      "header.logoSizePx",
      "header.logoPadLeftPx",
      "header.logoPadTopPx",
      "header.logoPadRightPx",
      "header.logoPosition",
      "header.logoEnabled",
      "ui.themeHeaderBaseColor",
      "ui.themeSidebarBaseColor",
      "ui.themeMainBaseColor",
      "ui.themeHeaderTone",
      "ui.themeSidebarTone",
      "ui.themeMainTone",
      "ui.themeHeaderMode",
      "ui.themeSidebarMode",
      "ui.themeMainMode",
      "ui.themeHeaderUseDefault",
      "ui.themeSidebarUseDefault",
      "ui.themeMainUseDefault",
      "defaults.ui.themeHeaderBaseColor",
      "defaults.ui.themeSidebarBaseColor",
      "defaults.ui.themeMainBaseColor",
      "defaults.ui.themeHeaderTone",
      "defaults.ui.themeSidebarTone",
      "defaults.ui.themeMainTone",
      "dev_color_default_enabled",
      "dev_color_header_default",
      "dev_color_header_name",
      "dev_color_header_r",
      "dev_color_header_g",
      "dev_color_header_b",
      "dev_color_sidebar_default",
      "dev_color_sidebar_name",
      "dev_color_sidebar_r",
      "dev_color_sidebar_g",
      "dev_color_sidebar_b",
      "dev_color_main_default",
      "dev_color_main_name",
      "dev_color_main_r",
      "dev_color_main_g",
      "dev_color_main_b",
      "pdf.userLogoPngDataUrl",
      "pdf.userLogoEnabled",
      "pdf.userLogoWidthMm",
      "pdf.userLogoTopMm",
      "pdf.userLogoRightMm",
      "pdf.userLogoFilePath",
      "print.logo1.enabled",
      "print.logo1.size",
      "print.logo1.align",
      "print.logo1.vAlign",
      "print.logo1.pngDataUrl",
      "print.logo2.enabled",
      "print.logo2.size",
      "print.logo2.align",
      "print.logo2.vAlign",
      "print.logo2.pngDataUrl",
      "print.logo3.enabled",
      "print.logo3.size",
      "print.logo3.align",
      "print.logo3.vAlign",
      "print.logo3.pngDataUrl",
      "print.logoSizePreset",
      "print.v2.globalHeaderAdaptive",
      "pdf.protocolTitle",
      "pdf.trafficLightAllEnabled",
      "pdf.protocolsDir",
      "pdf.preRemarks",
      "print.preRemarks.enabled",
      "pdf.footerPlace",
      "pdf.footerDate",
      "pdf.footerName1",
      "pdf.footerName2",
      "pdf.footerRecorder",
      "pdf.footerStreet",
      "pdf.footerZip",
      "pdf.footerCity",
      "pdf.footerUseUserData",
    ]);
    if (!res?.ok) {
      this._setMsg(res?.error || "Fehler beim Laden der Einstellungen");
      this._applyState();
      return;
    }

    const data = res.data || {};
    this.userName = (data.user_name ?? "").toString();
    this.userCompany = (data.user_company ?? "").toString();

    let profile = null;
    if (typeof api.userProfileGet === "function") {
      const resProfile = await api.userProfileGet();
      if (!resProfile?.ok) {
        this._setMsg(resProfile?.error || "Fehler beim Laden der Nutzerdaten");
      } else {
        profile = resProfile.profile || null;
      }
    }

    const profileHasAny = !!profile && [
      profile.name1,
      profile.name2,
      profile.street,
      profile.zip,
      profile.city,
    ].some((v) => String(v || "").trim());
    if (profile && !profileHasAny) profile = null;

    let userName1 = (data.user_name1 ?? "").toString();
    let userName2 = (data.user_name2 ?? "").toString();
    let userStreet = (data.user_street ?? "").toString();
    let userZip = this._normalizeUserZip((data.user_zip ?? "").toString(), 5);
    let userCity = (data.user_city ?? "").toString();

    if (profile) {
      userName1 = (profile.name1 ?? "").toString();
      userName2 = (profile.name2 ?? "").toString();
      userStreet = (profile.street ?? "").toString();
      userZip = this._normalizeUserZip((profile.zip ?? "").toString(), 5);
      userCity = (profile.city ?? "").toString();
    } else if (typeof api.userProfileUpsert === "function") {
      const hasAny = [userName1, userName2, userStreet, userZip, userCity].some((v) => String(v || "").trim());
      if (hasAny) {
        const resProfile = await api.userProfileUpsert({
          name1: userName1,
          name2: userName2,
          street: userStreet,
          zip: userZip,
          city: userCity,
        });
        if (!resProfile?.ok) {
          this._setMsg(resProfile?.error || "Fehler beim Speichern der Nutzerdaten");
        }
      }
    }

    if (this.inpUserName1) this.inpUserName1.value = userName1;
    if (this.inpUserName2) this.inpUserName2.value = userName2;
    if (this.inpUserStreet) this.inpUserStreet.value = userStreet;
    if (this.inpUserZip) this.inpUserZip.value = this._normalizeUserZip(userZip, 5);
    if (this.inpUserCity) this.inpUserCity.value = userCity;
    const defaults = this._logoDefaults();
    const size = this._clampLogoNumber(data["header.logoSizePx"], 12, 48, defaults.size);
    const padLeft = this._clampLogoNumber(data["header.logoPadLeftPx"], 0, 40, defaults.padLeft);
    const padTop = this._clampLogoNumber(data["header.logoPadTopPx"], 0, 20, defaults.padTop);
    const padRight = this._clampLogoNumber(data["header.logoPadRightPx"], 0, 80, defaults.padRight);
    const position = this._normalizeLogoPosition(data["header.logoPosition"], defaults.position);
    const logoEnabled = this._parseBool(data["header.logoEnabled"], defaults.enabled);
    this._applyLogoInputs({ size, padLeft, padTop, padRight, position, enabled: logoEnabled });

    const startThemeDefaults = this._readThemeStartDefaultsFromData(data);
    this._setThemeRuntimeDefaults(startThemeDefaults);
    const themeDefaults = this._themeDefaults();
    const headerDefaultRgb = this._themeAreaDefaultRgb("header");
    const sidebarDefaultRgb = this._themeAreaDefaultRgb("sidebar");
    const mainDefaultRgb = this._themeAreaDefaultRgb("main");
    const legacyHeaderDefault = this._parseBool(data["dev_color_header_default"], true);
    const legacySidebarDefault = this._parseBool(data["dev_color_sidebar_default"], true);
    const legacyMainDefault = this._parseBool(data["dev_color_main_default"], true);
    const legacyGlobalUseDefault = this._parseBool(
      data["dev_color_default_enabled"],
      legacyHeaderDefault && legacySidebarDefault && legacyMainDefault
    );
    const headerUseDefault = this._parseBool(data["ui.themeHeaderUseDefault"], legacyGlobalUseDefault);
    const sidebarUseDefault = this._parseBool(data["ui.themeSidebarUseDefault"], legacyGlobalUseDefault);
    const mainUseDefault = this._parseBool(data["ui.themeMainUseDefault"], legacyGlobalUseDefault);
    const legacyHeaderRgb = {
      r: headerUseDefault
        ? headerDefaultRgb.r
        : this._clampThemeRgb(data["dev_color_header_r"], headerDefaultRgb.r),
      g: headerUseDefault
        ? headerDefaultRgb.g
        : this._clampThemeRgb(data["dev_color_header_g"], headerDefaultRgb.g),
      b: headerUseDefault
        ? headerDefaultRgb.b
        : this._clampThemeRgb(data["dev_color_header_b"], headerDefaultRgb.b),
    };
    const legacySidebarRgb = {
      r: sidebarUseDefault
        ? sidebarDefaultRgb.r
        : this._clampThemeRgb(data["dev_color_sidebar_r"], sidebarDefaultRgb.r),
      g: sidebarUseDefault
        ? sidebarDefaultRgb.g
        : this._clampThemeRgb(data["dev_color_sidebar_g"], sidebarDefaultRgb.g),
      b: sidebarUseDefault
        ? sidebarDefaultRgb.b
        : this._clampThemeRgb(data["dev_color_sidebar_b"], sidebarDefaultRgb.b),
    };
    const legacyMainRgb = {
      r: mainUseDefault
        ? mainDefaultRgb.r
        : this._clampThemeRgb(data["dev_color_main_r"], mainDefaultRgb.r),
      g: mainUseDefault
        ? mainDefaultRgb.g
        : this._clampThemeRgb(data["dev_color_main_g"], mainDefaultRgb.g),
      b: mainUseDefault
        ? mainDefaultRgb.b
        : this._clampThemeRgb(data["dev_color_main_b"], mainDefaultRgb.b),
    };
    const headerRgb = this._themeHexToRgb(data["ui.themeHeaderBaseColor"], legacyHeaderRgb);
    const sidebarRgb = this._themeHexToRgb(data["ui.themeSidebarBaseColor"], legacySidebarRgb);
    const mainRgb = this._themeHexToRgb(data["ui.themeMainBaseColor"], legacyMainRgb);
    const themeSettings = normalizeThemeSettings({
      headerBaseColor: this._themeRgbToHex(headerRgb),
      sidebarBaseColor: this._themeRgbToHex(sidebarRgb),
      mainBaseColor: this._themeRgbToHex(mainRgb),
      headerTone: data["ui.themeHeaderTone"] ?? (headerUseDefault ? themeDefaults.headerTone : 50),
      sidebarTone: data["ui.themeSidebarTone"] ?? (sidebarUseDefault ? themeDefaults.sidebarTone : 50),
      mainTone: data["ui.themeMainTone"] ?? (mainUseDefault ? themeDefaults.mainTone : 50),
      headerMode: data["ui.themeHeaderMode"] ?? null,
      sidebarMode: data["ui.themeSidebarMode"] ?? null,
      mainMode: data["ui.themeMainMode"] ?? null,
      headerUseDefault,
      sidebarUseDefault,
      mainUseDefault,
    });
    themeSettings.headerColorName = (data["dev_color_header_name"] ?? "").toString();
    themeSettings.sidebarColorName = (data["dev_color_sidebar_name"] ?? "").toString();
    themeSettings.mainColorName = (data["dev_color_main_name"] ?? "").toString();
    themeSettings.headerR = headerRgb.r;
    themeSettings.headerG = headerRgb.g;
    themeSettings.headerB = headerRgb.b;
    themeSettings.sidebarR = sidebarRgb.r;
    themeSettings.sidebarG = sidebarRgb.g;
    themeSettings.sidebarB = sidebarRgb.b;
    themeSettings.mainR = mainRgb.r;
    themeSettings.mainG = mainRgb.g;
    themeSettings.mainB = mainRgb.b;
    this._applyThemeInputs(themeSettings);
    applyThemeForSettings(themeSettings);
    if (this.router?.context) {
      this.router.context.settings = {
        ...(this.router.context.settings || {}),
        "ui.themeHeaderBaseColor": themeSettings.headerBaseColor,
        "ui.themeSidebarBaseColor": themeSettings.sidebarBaseColor,
        "ui.themeMainBaseColor": themeSettings.mainBaseColor,
        "ui.themeHeaderTone": themeSettings.headerTone,
        "ui.themeSidebarTone": themeSettings.sidebarTone,
        "ui.themeMainTone": themeSettings.mainTone,
        "ui.themeHeaderUseDefault": themeSettings.headerUseDefault ? "true" : "false",
        "ui.themeSidebarUseDefault": themeSettings.sidebarUseDefault ? "true" : "false",
        "ui.themeMainUseDefault": themeSettings.mainUseDefault ? "true" : "false",
        "defaults.ui.themeHeaderBaseColor": this._themeRuntimeDefaults.headerBaseColor,
        "defaults.ui.themeSidebarBaseColor": this._themeRuntimeDefaults.sidebarBaseColor,
        "defaults.ui.themeMainBaseColor": this._themeRuntimeDefaults.mainBaseColor,
        "defaults.ui.themeHeaderTone": String(this._themeRuntimeDefaults.headerTone),
        "defaults.ui.themeSidebarTone": String(this._themeRuntimeDefaults.sidebarTone),
        "defaults.ui.themeMainTone": String(this._themeRuntimeDefaults.mainTone),
        "dev_color_default_enabled": themeSettings.headerUseDefault ? "true" : "false",
        "dev_color_header_default": themeSettings.headerUseDefault ? "true" : "false",
        "dev_color_header_name": themeSettings.headerColorName,
        "dev_color_header_r": themeSettings.headerR,
        "dev_color_header_g": themeSettings.headerG,
        "dev_color_header_b": themeSettings.headerB,
        "dev_color_sidebar_default": themeSettings.sidebarUseDefault ? "true" : "false",
        "dev_color_sidebar_name": themeSettings.sidebarColorName,
        "dev_color_sidebar_r": themeSettings.sidebarR,
        "dev_color_sidebar_g": themeSettings.sidebarG,
        "dev_color_sidebar_b": themeSettings.sidebarB,
        "dev_color_main_default": themeSettings.mainUseDefault ? "true" : "false",
        "dev_color_main_name": themeSettings.mainColorName,
        "dev_color_main_r": themeSettings.mainR,
        "dev_color_main_g": themeSettings.mainG,
        "dev_color_main_b": themeSettings.mainB,
      };
    }

    const pdfLogoDefaults = this._pdfLogoDefaults();
    const enabled = this._parseBool(data["pdf.userLogoEnabled"], pdfLogoDefaults.enabled);
    const widthMm = this._clampPdfLogoNumber(
      data["pdf.userLogoWidthMm"],
      10,
      60,
      pdfLogoDefaults.widthMm
    );
    const topMm = this._clampPdfLogoNumber(data["pdf.userLogoTopMm"], 0, 30, pdfLogoDefaults.topMm);
    const rightMm = this._clampPdfLogoNumber(
      data["pdf.userLogoRightMm"],
      0,
      30,
      pdfLogoDefaults.rightMm
    );
    const dataUrl = (data["pdf.userLogoPngDataUrl"] ?? "").toString();
    const logoFilePath = (data["pdf.userLogoFilePath"] ?? "").toString();

    this._applyPdfLogoInputs({ enabled, widthMm, topMm, rightMm });
    this._setPdfLogoDataUrl(dataUrl, { skipSave: true });
    this._setPdfLogoFilePath(logoFilePath, { skipSave: true });

    const legacyPdfLogoDataUrl = String(data["pdf.userLogoPngDataUrl"] || "").trim();
    const printLogo1DataUrl = String(data["print.logo1.pngDataUrl"] || "").trim();
    if (!printLogo1DataUrl && legacyPdfLogoDataUrl && typeof api.appSettingsSetMany === "function") {
      const fallbackSize = this._normalizePrintLogoSize(data["print.logoSizePreset"]);
      try {
        const migrateRes = await api.appSettingsSetMany({
          "print.logo1.enabled": "true",
          "print.logo1.size": fallbackSize,
          "print.logo1.pngDataUrl": legacyPdfLogoDataUrl,
        });
        if (migrateRes?.ok) {
          data["print.logo1.enabled"] = "true";
          data["print.logo1.size"] = fallbackSize;
          data["print.logo1.pngDataUrl"] = legacyPdfLogoDataUrl;
        }
      } catch (_e) {
        // Migration ist optional; bei Fehlern nicht den Settings-Dialog blockieren.
      }
    }

    this._applyPrintLogoInputsFromSettings(data);

    const pdfSettingsDefaults = this._pdfSettingsDefaults();
    const protocolTitleRaw = data["pdf.protocolTitle"];
    const protocolTitle =
      protocolTitleRaw == null
        ? pdfSettingsDefaults.protocolTitle
        : String(protocolTitleRaw);
    const trafficLightAllEnabled = this._parseBool(
      data["pdf.trafficLightAllEnabled"],
      pdfSettingsDefaults.trafficLightAllEnabled
    );
    const protocolsDirRaw = data["pdf.protocolsDir"];
    const protocolsDirNormalized = protocolsDirRaw == null ? "" : String(protocolsDirRaw).trim();
    const protocolsDir = protocolsDirNormalized || pdfSettingsDefaults.protocolsDir;
    const preRemarksRaw = data["pdf.preRemarks"];
    const preRemarks =
      preRemarksRaw == null ? pdfSettingsDefaults.preRemarks : String(preRemarksRaw);
    const preRemarksEnabled = this._parseBool(
      data["print.preRemarks.enabled"],
      pdfSettingsDefaults.preRemarksEnabled
    );
    const footerUseUserData = this._parseBool(
      data["pdf.footerUseUserData"],
      pdfSettingsDefaults.footerUseUserData
    );
    const footerPlace = (data["pdf.footerPlace"] ?? "").toString();
    const footerDate = (data["pdf.footerDate"] ?? "").toString();
    const footerName1 = (data["pdf.footerName1"] ?? "").toString();
    const footerName2 = (data["pdf.footerName2"] ?? "").toString();
    const footerRecorder = (data["pdf.footerRecorder"] ?? "").toString();
    const footerStreet = (data["pdf.footerStreet"] ?? "").toString();
    const footerZip = (data["pdf.footerZip"] ?? "").toString();
    const footerCity = (data["pdf.footerCity"] ?? "").toString();

    this._applyPdfSettingsInputs({
      protocolTitle,
      trafficLightAllEnabled,
      protocolsDir,
      preRemarks,
      preRemarksEnabled,
      footerUseUserData,
      footerPlace,
      footerDate,
      footerName1,
      footerName2,
      footerRecorder,
      footerStreet,
      footerZip,
      footerCity,
    });

    if (!protocolsDirNormalized) {
      this._schedulePdfSettingsSave({ markTouched: false });
    }

    if (footerUseUserData) {
      this._applyPdfFooterUserDefaultsFromUser();
    }

    const defaultsChanged = this._applyPdfFooterPlaceDateDefaults({ city: userCity });
    if (defaultsChanged) {
      this._schedulePdfSettingsSave({ markTouched: false });
    }

    this.roleLabels = this._normalizeRoleLabels(data.firm_role_labels || "");
    this.roleOrder = this._normalizeRoleOrder(data.firm_role_order || "", this.roleLabels);
    if (this._roleSelectionAfterReload !== null && this._roleSelectionAfterReload !== undefined) {
      this.roleSelectedCode = this._roleSelectionAfterReload;
      this._roleSelectionAfterReload = null;
    } else if (!this.roleSelectedCode && this.roleOrder.length) {
      this.roleSelectedCode = this.roleOrder[0];
    }
    this._renderRoleOrderList();
    await this._reloadSecurityPinState();
    this._applyState();
  }

  async _save() {
    if (this.saving) return false;

    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") {
      alert("Settings-API fehlt (IPC noch nicht aktiv).");
      return false;
    }

    const user_name = this._normalizeUserText(this.inpName?.value ?? this.userName, 80);
    const user_company = this._normalizeUserText(this.inpCompany?.value ?? this.userCompany, 80);
    const user_name1 = this._normalizeUserText(this.inpUserName1?.value, 80);
    const user_name2 = this._normalizeUserText(this.inpUserName2?.value, 80);
    const user_street = this._normalizeUserText(this.inpUserStreet?.value, 80);
    const user_zip = this._normalizeUserZip(this.inpUserZip?.value, 5);
    const user_city = this._normalizeUserText(this.inpUserCity?.value, 80);
    this._applyPdfFooterUserDefaultsFromUser({
      name1: user_name1,
      name2: user_name2,
      street: user_street,
      zip: user_zip,
      city: user_city,
    }, { overwriteExisting: true });

    const pdfValues = this._getPdfSettingsInputValues();
    const pdfValuesForSave = {
      ...pdfValues,
      footerName1: user_name1,
      footerName2: user_name2,
      footerStreet: user_street,
      footerZip: user_zip,
      footerCity: user_city,
    };

    this.userName = user_name;
    this.userCompany = user_company;
    if (this.inpUserName1) this.inpUserName1.value = user_name1;
    if (this.inpUserName2) this.inpUserName2.value = user_name2;
    if (this.inpUserStreet) this.inpUserStreet.value = user_street;
    if (this.inpUserZip) this.inpUserZip.value = user_zip;
    if (this.inpUserCity) this.inpUserCity.value = user_city;
    this._applyPdfSettingsInputs(pdfValuesForSave);

    this.saving = true;
    this._setMsg("Speichere...");
    this._applyState();

    try {
      if (typeof api.userProfileUpsert === "function") {
        const resProfile = await api.userProfileUpsert({
          name1: user_name1,
          name2: user_name2,
          street: user_street,
          zip: user_zip,
          city: user_city,
        });
        if (!resProfile?.ok) {
          alert(resProfile?.error || "Speichern der Nutzerdaten fehlgeschlagen");
          return false;
        }
        if (resProfile?.profile) {
          const p = resProfile.profile;
          if (this.inpUserName1) this.inpUserName1.value = (p.name1 ?? "").toString();
          if (this.inpUserName2) this.inpUserName2.value = (p.name2 ?? "").toString();
          if (this.inpUserStreet) this.inpUserStreet.value = (p.street ?? "").toString();
          if (this.inpUserZip) this.inpUserZip.value = this._normalizeUserZip((p.zip ?? "").toString(), 5);
          if (this.inpUserCity) this.inpUserCity.value = (p.city ?? "").toString();
        }
      }

      const payload = {
        user_name,
        user_company,
        user_name1,
        user_name2,
        user_street,
        user_zip,
        user_city,
        "pdf.protocolTitle": pdfValuesForSave.protocolTitle,
        "pdf.trafficLightAllEnabled": pdfValuesForSave.trafficLightAllEnabled ? "true" : "false",
        "pdf.preRemarks": pdfValuesForSave.preRemarks,
        "print.preRemarks.enabled": pdfValuesForSave.preRemarksEnabled ? "true" : "false",
        "pdf.footerPlace": pdfValuesForSave.footerPlace,
        "pdf.footerDate": pdfValuesForSave.footerDate,
        "pdf.footerName1": pdfValuesForSave.footerName1,
        "pdf.footerName2": pdfValuesForSave.footerName2,
        "pdf.footerRecorder": pdfValuesForSave.footerRecorder,
        "pdf.footerStreet": pdfValuesForSave.footerStreet,
        "pdf.footerZip": pdfValuesForSave.footerZip,
        "pdf.footerCity": pdfValuesForSave.footerCity,
        "pdf.footerUseUserData": pdfValuesForSave.footerUseUserData ? "true" : "false",
        ...this._buildTouchedPayloadFromValues({
          user_name,
          user_company,
          user_name1,
          user_name2,
          user_street,
          user_zip,
          user_city,
          "pdf.protocolTitle": pdfValuesForSave.protocolTitle,
          "pdf.preRemarks": pdfValuesForSave.preRemarks,
          "pdf.footerPlace": pdfValuesForSave.footerPlace,
          "pdf.footerDate": pdfValuesForSave.footerDate,
          "pdf.footerName1": pdfValuesForSave.footerName1,
          "pdf.footerName2": pdfValuesForSave.footerName2,
          "pdf.footerRecorder": pdfValuesForSave.footerRecorder,
          "pdf.footerStreet": pdfValuesForSave.footerStreet,
          "pdf.footerZip": pdfValuesForSave.footerZip,
          "pdf.footerCity": pdfValuesForSave.footerCity,
        }),
        ...this._buildTouchedPayloadForKeys([
          "pdf.trafficLightAllEnabled",
          "print.preRemarks.enabled",
          "pdf.footerUseUserData",
        ]),
        };
      const res = await api.appSettingsSetMany(payload);
        if (!res?.ok) {
          alert(res?.error || "Speichern fehlgeschlagen");
          return false;
        }

      if (this.router?.context) {
        this.router.context.settings = {
          ...(this.router.context.settings || {}),
          user_name,
          user_company,
          user_name1,
          user_name2,
          user_street,
          user_zip,
          user_city,
          "pdf.protocolTitle": pdfValuesForSave.protocolTitle,
          "pdf.trafficLightAllEnabled": pdfValuesForSave.trafficLightAllEnabled ? "true" : "false",
          "pdf.preRemarks": pdfValuesForSave.preRemarks,
          "print.preRemarks.enabled": pdfValuesForSave.preRemarksEnabled ? "true" : "false",
          "pdf.footerPlace": pdfValuesForSave.footerPlace,
          "pdf.footerDate": pdfValuesForSave.footerDate,
          "pdf.footerName1": pdfValuesForSave.footerName1,
          "pdf.footerName2": pdfValuesForSave.footerName2,
          "pdf.footerRecorder": pdfValuesForSave.footerRecorder,
          "pdf.footerStreet": pdfValuesForSave.footerStreet,
          "pdf.footerZip": pdfValuesForSave.footerZip,
          "pdf.footerCity": pdfValuesForSave.footerCity,
          "pdf.footerUseUserData": pdfValuesForSave.footerUseUserData ? "true" : "false",
        };
      }
      window.dispatchEvent(new Event("bbm:header-refresh"));

        this._setMsg("Gespeichert");
        return true;
      } finally {
        this.saving = false;
        this._applyState();
      }
    }
}
