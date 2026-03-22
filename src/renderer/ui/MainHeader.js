// src/renderer/ui/MainHeader.js
//
// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.1
//
import { HEADER, POPOVER_MENU } from "./zIndex.js";
import { sendMailPayload } from "../services/mail/sendMailPayload.js";
import { openClosedProtocolSelector } from "./react/ClosedProtocolSelector.js";
import { resolveProtocolsDir } from "../utils/pdfProtocolsDir.js";

export default class MainHeader {
  constructor({ router, version = "1.0", sidebarWidth = 220, padding = 12 } = {}) {
    this.router = router;
    this.version = version;
    this.sidebarWidth = Number(sidebarWidth) || 220;
    this.padding = Number(padding) || 12;

    this.root = null;
    this._uiMode = this._readUiMode();
    this._isNewUi = this._uiMode === "new";

    // logo group text under logo
    this.elVersion = null;

    // bottom left active
    this.elActive = null;

    // centered title (TopsView only)
    this.elCenterTitle = null;

    // right bottom user info
    this.elUserName = null;
    this.elUserCompany = null;
    this.elRightInfo = null;
    this.elTrialInfo = null;
    this.elDevBadge = null;

    this.elPrintBtn = null;
    this.elPrintWrap = null;
    this.elPrintMenu = null;
    this.elPrintItemPreview = null;
    this.elPrintItemHeaderTest = null;
    this.elPrintBranchFirms = null;
    this.elPrintBranchTodo = null;
    this.elPrintBranchFirmsWrap = null;
    this.elPrintBranchTodoWrap = null;
    this.elPrintSubmenuFirms = null;
    this.elPrintSubmenuTodo = null;
    this.elPrintItemFirmsOpen = null;
    this.elPrintItemFirmsClosed = null;
    this.elPrintItemTodoOpen = null;
    this.elPrintItemTodoClosed = null;
    this.elPrintItemMeetings = null;
    this.elActionProjectFirmsBtn = null;
    this.elActionFirmsPoolBtn = null;
    this.elActionMeetingsBtn = null;
    this.elActionCandidatesBtn = null;
    this.elActionParticipantsBtn = null;
    this.elSetupWrap = null;
    this.elSetupBtn = null;
    this.elSetupMenu = null;
    this._setupOpen = false;
    this._setupDocMouseDown = null;
    this._printOpen = false;
    this._printActiveSubmenu = "";
    this._printDocMouseDown = null;
    this._printMenuState = null;
    this._printMenuStateLoading = null;
    this._printResizeHandler = null;

    // mail menu
    this.elMailBtn = null;
    this.elMailMenu = null;
    this._mailOpen = false;
    this._mailDocMouseDown = null;

    // logo
    this.elLogoGroup = null;
    this.elLogoWrap = null;
    this.elLogoImg = null;
    this._defaultLogoSrc = "";
    this._defaultLogoLoading = null;
    this.elStickyNotice = null;
    this.elStickyNoticeText = null;
    this._stickyNoticeMessage = "";

    // async label cache
    this._activeLabelForProjectId = null;
    this._activeLabel = "";
    this._activeLoading = null;
    this._setupStatusForProjectId = null;
    this._setupStatus = null;
    this._setupStatusLoading = null;
    this._setupStatusLoadedAt = 0;
    this._setupStatusRefreshPending = false;

    // Trial / Build channel
    this._trialInfoLoading = null;
    this._trialInfoText = "";
    this._buildChannelLoading = null;
    this._buildChannel = "";
    this._baseWindowTitle = String(document?.title || "BBM").trim() || "BBM";
  }

  _readUiMode() {
    try {
      const raw = String(window.localStorage?.getItem?.("bbm.uiMode") || "").trim().toLowerCase();
      return raw === "new" ? "new" : "old";
    } catch (_e) {
      return "old";
    }
  }

  render() {
    const root = document.createElement("div");
    root.style.boxSizing = "border-box";
    root.style.width = "100%";
    root.style.padding = `${this.padding}px`;
    root.style.borderBottom = "1px solid var(--card-border)";
    root.style.background = "var(--header-bg)";
    root.style.color = "var(--header-text)";
    root.style.position = "sticky";
    root.style.top = "0";
    root.style.zIndex = String(HEADER);
    if (this._isNewUi) {
      root.style.setProperty("--header-action-underline", "2.5px");
      root.style.setProperty("--header-action-baseline-offset", "-3mm");
      root.style.setProperty("--header-action-offset-x", "120px");
    }

    // fixed-ish layout, PDF-nah
    root.style.display = "grid";
    root.style.gridTemplateColumns = "1fr auto 1fr";
    root.style.gridTemplateRows = "auto auto auto auto";
    root.style.columnGap = "12px";
    root.style.rowGap = "6px";
    root.style.alignItems = "start";

    const logoGroup = document.createElement("div");
    logoGroup.style.gridColumn = "1";
    logoGroup.style.gridRow = "1";
    logoGroup.style.alignSelf = "start";
    logoGroup.style.justifySelf = "start";
    logoGroup.style.display = "none";
    logoGroup.style.flexDirection = "column";
    logoGroup.style.alignItems = "flex-start";
    logoGroup.style.gap = "4px";

    const logoWrap = document.createElement("div");
    logoWrap.style.display = "inline-flex";
    logoWrap.style.justifyContent = "flex-start";

    const logoImg = document.createElement("img");
    logoImg.style.display = "none";
    logoImg.alt = "Logo";
    logoImg.draggable = false;
    logoImg.style.width = "auto";
    logoImg.onerror = () => {
      logoImg.style.display = "none";
      logoImg.removeAttribute("src");
    };

    logoWrap.append(logoImg);

    // Center title (row 1, col 2) - only in TopsView
    const elCenterTitle = document.createElement("div");
    elCenterTitle.textContent = "Protokoll";
    elCenterTitle.style.gridColumn = "2";
    elCenterTitle.style.gridRow = "1";
    elCenterTitle.style.textAlign = "center";
    elCenterTitle.style.whiteSpace = "nowrap";
    elCenterTitle.style.fontSize = "36px";
    elCenterTitle.style.lineHeight = "40px";
    elCenterTitle.style.fontWeight = "600";
    elCenterTitle.style.userSelect = "none";

    // Active label (row 2, col 1) bottom-left
    const elActive = document.createElement("div");
    elActive.style.gridColumn = "1";
    elActive.style.gridRow = "2";
    elActive.style.alignSelf = "end";
    elActive.style.justifySelf = "start";
    elActive.style.display = "inline-flex";
    elActive.style.alignItems = "baseline";
    elActive.style.whiteSpace = "nowrap";
    elActive.style.overflow = "hidden";
    elActive.style.textOverflow = "ellipsis";
    elActive.style.maxWidth = "100%";

    // Right info (row 2, col 3) bottom-right
    const rightInfo = document.createElement("div");
    rightInfo.style.gridColumn = "3";
    rightInfo.style.gridRow = "2";
    rightInfo.style.alignSelf = "end";
    rightInfo.style.justifySelf = "end";
    rightInfo.style.display = "flex";
    rightInfo.style.flexDirection = "column";
    rightInfo.style.alignItems = "flex-end";
    rightInfo.style.justifyContent = "flex-end";
    rightInfo.style.gap = "2px";
    rightInfo.style.minWidth = "160px";

    const elUserName = document.createElement("div");
    elUserName.style.fontSize = "12px";
    elUserName.style.opacity = "0.9";
    elUserName.style.fontWeight = "600";
    elUserName.style.userSelect = "none";

    const elUserCompany = document.createElement("div");
    elUserCompany.style.fontSize = "11px";
    elUserCompany.style.opacity = "0.7";
    elUserCompany.style.fontWeight = "400";
    elUserCompany.style.userSelect = "none";

    rightInfo.append(elUserName, elUserCompany);

    logoGroup.append(logoWrap);

    const actionWrap = document.createElement("div");
    actionWrap.style.gridColumn = "3";
    actionWrap.style.gridRow = "1";
    actionWrap.style.justifySelf = "end";
    actionWrap.style.alignSelf = "start";
    actionWrap.style.display = "inline-flex";
    actionWrap.style.alignItems = "center";
    actionWrap.style.gap = "8px";
    actionWrap.style.paddingRight = this._isNewUi ? "clamp(8px, 1.6vw, 18px)" : "0px";

    // Trial Info (Header) – existiert, aber wird NICHT angezeigt (Fenster-Titel bleibt aktiv)
    const trialInfo = document.createElement("div");
    trialInfo.style.display = "none";
    trialInfo.style.fontSize = "12px";
    trialInfo.style.fontWeight = "600";
    trialInfo.style.color = "var(--header-text)";
    trialInfo.style.opacity = "0.9";
    trialInfo.style.whiteSpace = "nowrap";
    trialInfo.style.gridColumn = "2";
    trialInfo.style.gridRow = "1";
    trialInfo.style.justifySelf = "center";
    trialInfo.style.alignSelf = "start";

    // DEV Badge (rot oben rechts)
    const devBadge = document.createElement("div");
    devBadge.textContent = "DEV";
    devBadge.style.position = "absolute";
    devBadge.style.top = "8px";
    devBadge.style.right = "10px";
    devBadge.style.background = "#dc2626";
    devBadge.style.color = "#fff";
    devBadge.style.fontSize = "11px";
    devBadge.style.fontWeight = "800";
    devBadge.style.padding = "2px 10px";
    devBadge.style.borderRadius = "999px";
    devBadge.style.letterSpacing = "0.6px";
    devBadge.style.display = "none";
    devBadge.style.userSelect = "none";
    devBadge.style.pointerEvents = "none";

    const applyActionTextButtonStyle = (btn) => {
      if (!btn) return;
      btn.style.display = "inline-flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.border = "none";
      btn.style.background = "transparent";
      btn.style.color = "var(--header-text)";
      btn.style.padding = "0 2px 2px";
      btn.style.margin = "0";
      btn.style.minHeight = "0";
      btn.style.lineHeight = "1.25";
      btn.style.fontSize = "13px";
      btn.style.fontWeight = "700";
      btn.style.borderRadius = "0";
      btn.style.borderBottom = "var(--header-action-underline) solid currentColor";
      btn.style.borderBottomColor = "currentColor";
      btn.style.cursor = "pointer";
      btn.style.whiteSpace = "nowrap";
      btn.onmouseenter = () => {
        if (btn.disabled) return;
        btn.style.borderBottomColor = "#ff8c00";
      };
      btn.onmouseleave = () => {
        btn.style.borderBottomColor = "currentColor";
      };
    };

    const runProjectAction = async (fn) => {
      const projectId = this.router?.currentProjectId || null;
      if (!projectId) return;
      if (typeof fn !== "function") return;
      await fn(projectId);
    };

    const setupWrap = document.createElement("div");
    setupWrap.style.position = "relative";
    setupWrap.style.display = "inline-flex";
    setupWrap.style.alignItems = "center";

    const setupBtn = document.createElement("button");
    setupBtn.type = "button";
    setupBtn.textContent = "Setup";
    setupBtn.style.minHeight = "30px";

    const setupMenu = document.createElement("div");
    setupMenu.style.position = "absolute";
    setupMenu.style.top = "calc(100% + 4px)";
    setupMenu.style.right = "0";
    setupMenu.style.minWidth = "190px";
    setupMenu.style.display = "none";
    setupMenu.style.flexDirection = "column";
    setupMenu.style.gap = "0";
    setupMenu.style.padding = "4px";
    setupMenu.style.border = "1px solid var(--card-border)";
    setupMenu.style.borderRadius = "8px";
    setupMenu.style.background = "var(--card-bg)";
    setupMenu.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
    setupMenu.style.zIndex = String(POPOVER_MENU);

    const runSetupAction = async (fn) => {
      this._setSetupOpen(false);
      const projectId = this.router?.currentProjectId || null;
      if (!projectId || setupBtn.disabled) return;
      if (typeof fn !== "function") return;
      await fn(projectId);
    };

    const mkSetupItem = (label, onPick) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = label;
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
        item.style.background = "transparent";
      };
      item.onclick = async () => {
        try {
          await runSetupAction(onPick);
        } catch (e) {
          console.error("[header] setup action failed:", e);
        }
      };
      return item;
    };

    const itemProjectFirms = mkSetupItem("Firmen zuordnen", async (projectId) => {
      if (typeof this.router?.showProjectFirms !== "function") return;
      await this.router.showProjectFirms(projectId);
    });
    setupMenu.append(itemProjectFirms);

    if (!this._isNewUi) {
      setupBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (setupBtn.disabled) return;
        if (!this._setupOpen) this._setPrintOpen(false);
        this._setSetupOpen(!this._setupOpen);
      };

      if (this._setupDocMouseDown) {
        document.removeEventListener("mousedown", this._setupDocMouseDown, true);
        this._setupDocMouseDown = null;
      }
      this._setupDocMouseDown = (e) => {
        if (!this._setupOpen) return;
        if (setupWrap.contains(e.target)) return;
        this._setSetupOpen(false);
      };
      document.addEventListener("mousedown", this._setupDocMouseDown, true);
    }

    setupWrap.append(setupBtn, setupMenu);

    const printWrap = document.createElement("div");
    printWrap.style.position = "relative";
    printWrap.style.display = "inline-flex";
    printWrap.style.alignItems = "center";

    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.textContent = "Drucken";
    applyActionTextButtonStyle(printBtn);

    const printMenu = document.createElement("div");
    printMenu.style.position = "absolute";
    printMenu.style.top = "calc(100% + 4px)";
    printMenu.style.right = "0";
    printMenu.style.minWidth = "236px";
    printMenu.style.display = "none";
    printMenu.style.flexDirection = "column";
    printMenu.style.gap = "0";
    printMenu.style.padding = "4px";
    printMenu.style.border = "1px solid var(--card-border)";
    printMenu.style.borderRadius = "8px";
    printMenu.style.background = "var(--card-bg)";
    printMenu.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
    printMenu.style.zIndex = String(POPOVER_MENU);

    const mkPrintItem = (label, onPick) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = label;
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
        if (item.disabled) return;
        item.style.background = "var(--btn-outline-hover-bg)";
      };
      item.onmouseleave = () => {
        if (item.disabled) return;
        item.style.background = "transparent";
      };
      item.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item.disabled) return;
        const state = await this._refreshPrintMenuState({ force: true });
        if (!state?.hasProject) return;
        this._setPrintOpen(false);
        if (typeof onPick !== "function") return;
        try {
          await onPick(state);
        } catch (err) {
          console.error("[header] print action failed:", err);
          alert(err?.message || String(err) || "Druckaktion fehlgeschlagen.");
        }
      };
      return item;
    };

    const mkSubmenuBranch = (label, key) => {
      const wrap = document.createElement("div");
      wrap.style.position = "relative";

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.textContent = label;
      trigger.style.display = "block";
      trigger.style.width = "100%";
      trigger.style.textAlign = "left";
      trigger.style.border = "none";
      trigger.style.background = "transparent";
      trigger.style.color = "var(--text-main)";
      trigger.style.padding = "8px 10px";
      trigger.style.borderRadius = "6px";
      trigger.style.minHeight = "30px";
      trigger.style.cursor = "pointer";
      trigger.onmouseenter = () => {
        if (trigger.disabled) return;
        trigger.style.background = "var(--btn-outline-hover-bg)";
      };
      trigger.onmouseleave = () => {
        if (trigger.disabled) return;
        trigger.style.background = "transparent";
      };
      trigger.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (trigger.disabled) return;
        this._setPrintSubmenu(this._printActiveSubmenu === key ? "" : key);
      };

      const submenu = document.createElement("div");
      submenu.style.position = "absolute";
      submenu.style.top = "0";
      submenu.style.left = "calc(100% + 4px)";
      submenu.style.minWidth = "210px";
      submenu.style.display = "none";
      submenu.style.flexDirection = "column";
      submenu.style.gap = "0";
      submenu.style.padding = "4px";
      submenu.style.border = "1px solid var(--card-border)";
      submenu.style.borderRadius = "8px";
      submenu.style.background = "var(--card-bg)";
      submenu.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
      submenu.style.zIndex = String(POPOVER_MENU);

      wrap.addEventListener("pointerenter", () => {
        if (!this._printOpen || trigger.disabled) return;
        this._setPrintSubmenu(key);
      });
      wrap.addEventListener("pointerleave", () => {
        if (this._printActiveSubmenu !== key) return;
        this._setPrintSubmenu("");
      });

      wrap.append(trigger, submenu);
      return { wrap, trigger, submenu };
    };

    const itemPreview = mkPrintItem("Vorschau (Protokoll)", async (state) => {
      if (typeof this.router?.openPrintVorabzug !== "function") return;
      await this.router.openPrintVorabzug({
        projectId: state.projectId,
        meetingId: state.currentMeetingId,
      });
    });

    const itemFirms = mkPrintItem("Firmenliste", async (state) => {
      await this._openStoredProjectPdfSelectionPopup({ projectId: state.projectId, kind: "firms" });
    });

    const itemTodo = mkPrintItem("ToDo-Liste", async (state) => {
      await this._openStoredProjectPdfSelectionPopup({ projectId: state.projectId, kind: "todo" });
    });

    const itemTopList = mkPrintItem("Top-Liste", async (state) => {
      await this._openStoredProjectPdfSelectionPopup({ projectId: state.projectId, kind: "topsall" });
    });

    const itemMeetingsClosed = mkPrintItem("Protokolle", async (state) => {
      await this._openStoredProjectPdfSelectionPopup({ projectId: state.projectId, kind: "protocol" });
    });

    printMenu.append(itemPreview, itemFirms, itemTodo, itemTopList, itemMeetingsClosed);
    printWrap.append(printBtn, printMenu);


    const mailWrap = document.createElement("div");
    mailWrap.style.position = "relative";
    mailWrap.style.display = "inline-flex";
    mailWrap.style.alignItems = "center";

    const mailBtn = document.createElement("button");
    mailBtn.type = "button";
    mailBtn.textContent = "E-Mail senden";
    applyActionTextButtonStyle(mailBtn);
    mailBtn.disabled = true; // initial: keine Projekt-Kontext -> deaktiviert
    mailBtn.style.opacity = "0.6";

    const mailMenu = document.createElement("div");
    mailMenu.style.position = "absolute";
    mailMenu.style.top = "calc(100% + 4px)";
    mailMenu.style.right = "0";
    mailMenu.style.minWidth = "240px";
    mailMenu.style.display = "none";
    mailMenu.style.flexDirection = "column";
    mailMenu.style.gap = "0";
    mailMenu.style.padding = "4px";
    mailMenu.style.border = "1px solid var(--card-border)";
    mailMenu.style.borderRadius = "8px";
    mailMenu.style.background = "var(--card-bg)";
    mailMenu.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
    mailMenu.style.zIndex = String(POPOVER_MENU);

    const mkMailItem = (label, onPick) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = label;
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
        if (item.disabled) return;
        item.style.background = "var(--btn-outline-hover-bg)";
      };
      item.onmouseleave = () => {
        if (item.disabled) return;
        item.style.background = "transparent";
      };
      item.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item.disabled) return;
        this._setMailOpen(false);
        if (typeof onPick !== "function") return;
        try {
          await onPick();
        } catch (err) {
          console.error("[header] mail action failed:", err);
        }
      };
      return item;
    };

    const mailItemQuick = mkMailItem("Aktuelles Protokoll senden", async () => {
      await this._openMailClient();
    });
    const mailItemSendFile = mkMailItem("Datei an Teilnehmer senden", async () => {
      await this._openMailFileFlow();
    });
    mailMenu.append(mailItemQuick, mailItemSendFile);
    this.elMailBtn = mailBtn;
    this.elMailMenu = mailMenu;

    mailBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (mailBtn.disabled) return;
      this._setMailOpen(false);
      try {
        await this._openMailFileFlow();
      } catch (err) {
        console.error("[header] mail direct action failed:", err);
      }
    };

    printBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (printBtn.disabled) return;
      if (this._isMeetingsQuickPrintActive()) {
        this._setPrintOpen(false);
        try {
          await this.router?.activeView?.printSelectedProtocolPreviewFromHeader?.();
        } catch (_err) {}
        return;
      }
      if (this._printOpen) {
        this._setPrintOpen(false);
        return;
      }
      await this._refreshPrintMenuState({ force: true });
      this._setPrintOpen(true);
    };

    if (this._printDocMouseDown) {
      document.removeEventListener("mousedown", this._printDocMouseDown, true);
      this._printDocMouseDown = null;
    }
    this._printDocMouseDown = (e) => {
      if (!this._printOpen) return;
      if (printWrap.contains(e.target)) return;
      this._setPrintOpen(false);
    };
    document.addEventListener("mousedown", this._printDocMouseDown, true);

    if (this._mailDocMouseDown) {
      document.removeEventListener("mousedown", this._mailDocMouseDown, true);
      this._mailDocMouseDown = null;
    }
    this._mailDocMouseDown = (e) => {
      if (!this._mailOpen) return;
      if (mailWrap.contains(e.target)) return;
      this._setMailOpen(false);
    };
    document.addEventListener("mousedown", this._mailDocMouseDown, true);

    mailWrap.append(mailBtn);

    if (this._printResizeHandler) {
      window.removeEventListener("resize", this._printResizeHandler);
      this._printResizeHandler = null;
    }
    this._printResizeHandler = () => {
      if (!this._printOpen || !this._printActiveSubmenu) return;
      this._positionActivePrintSubmenu();
    };
    window.addEventListener("resize", this._printResizeHandler);

    const btnMeetings = document.createElement("button");
    btnMeetings.type = "button";
    btnMeetings.textContent = "Protokolle";
    applyActionTextButtonStyle(btnMeetings);
    btnMeetings.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btnMeetings.disabled) return;
      this._setPrintOpen(false);
      try {
        const projectId = this.router?.currentProjectId || null;
        if (!projectId) return;
        if (typeof this.router?.showMeetings !== "function") return;
        await this.router.showMeetings(projectId);
      } catch (err) {
        console.error("[header] action Protokolle failed:", err);
      }
    };

    // Ausgabe bleibt intern vorbereitet; direkte Header-Hauptaktionen laufen vorerst nur ueber die Quicklane.
    if (this._isNewUi) {
      // bewusst leer: Ausgabe-/Protokoll-Aktionen bleiben intern verfuegbar, aber nicht direkt im Header priorisiert
    } else {
      actionWrap.append(setupWrap);
    }

    const stickyNotice = document.createElement("div");
    stickyNotice.style.gridColumn = "1 / span 3";
    stickyNotice.style.gridRow = "4";
    stickyNotice.style.display = "none";
    stickyNotice.style.alignItems = "center";
    stickyNotice.style.gap = "10px";
    stickyNotice.style.padding = "6px 10px";
    stickyNotice.style.border = "1px solid #f1c40f";
    stickyNotice.style.borderRadius = "8px";
    stickyNotice.style.background = "#fff7d6";
    stickyNotice.style.color = "#5c4500";
    stickyNotice.style.fontSize = "12px";
    stickyNotice.style.boxSizing = "border-box";

    const stickyNoticeText = document.createElement("div");
    stickyNoticeText.style.flex = "1";

    const stickyNoticeClose = document.createElement("button");
    stickyNoticeClose.type = "button";
    stickyNoticeClose.textContent = "Schließen";
    stickyNoticeClose.style.padding = "4px 8px";
    stickyNoticeClose.style.borderRadius = "8px";
    stickyNoticeClose.style.border = "1px solid #d9b94b";
    stickyNoticeClose.style.background = "#fff";
    stickyNoticeClose.style.cursor = "pointer";
    stickyNoticeClose.onclick = () => this.clearStickyNotice();

    stickyNotice.append(stickyNoticeText, stickyNoticeClose);

    if (this._isNewUi) {
      root.style.gridTemplateRows = "auto auto auto";
      root.style.rowGap = "8px";
      elCenterTitle.style.fontSize = "20px";
      elCenterTitle.style.lineHeight = "24px";
      elCenterTitle.style.fontWeight = "700";
      elCenterTitle.style.textAlign = "left";

      elActive.style.gridColumn = "1 / span 2";
      elActive.style.gridRow = "2";
      elActive.style.alignSelf = "start";
      elActive.style.justifySelf = "start";
      elActive.style.maxWidth = "100%";

      actionWrap.style.gridColumn = "1 / span 3";
      actionWrap.style.gridRow = "2";
      actionWrap.style.justifySelf = "center";
      actionWrap.style.alignSelf = "end";
      actionWrap.style.paddingRight = "0px";
      actionWrap.style.marginBottom = "var(--header-action-baseline-offset)";
      actionWrap.style.transform = "translateX(clamp(0px, 12vw, var(--header-action-offset-x)))";
      actionWrap.style.maxWidth = "min(calc(100% - 20px), 760px)";
      actionWrap.style.flexWrap = "wrap";
      actionWrap.style.justifyContent = "center";
      actionWrap.style.rowGap = "6px";

      rightInfo.style.display = "none";
      trialInfo.style.gridRow = "1";
      trialInfo.style.marginBottom = "0";
      stickyNotice.style.gridRow = "3";
    }

    root.append(logoGroup, trialInfo, elCenterTitle, elActive, rightInfo, actionWrap, devBadge, stickyNotice);

    this.root = root;

    this.elCenterTitle = elCenterTitle;
    this.elVersion = null;
    this.elActive = elActive;

    this.elUserName = elUserName;
    this.elUserCompany = elUserCompany;
    this.elRightInfo = rightInfo;
    this.elTrialInfo = trialInfo;
    this.elDevBadge = devBadge;

    this.elPrintBtn = printBtn;
    this.elPrintWrap = printWrap;
    this.elPrintMenu = printMenu;
    this.elPrintItemPreview = itemPreview;
    this.elPrintItemHeaderTest = null;
    this.elPrintItemTopList = null;
    this.elPrintBranchFirms = itemFirms;
    this.elPrintBranchTodo = itemTodo;
    this.elPrintBranchFirmsWrap = null;
    this.elPrintBranchTodoWrap = null;
    this.elPrintSubmenuFirms = null;
    this.elPrintSubmenuTodo = null;
    this.elPrintItemFirmsOpen = null;
    this.elPrintItemFirmsClosed = null;
    this.elPrintItemTodoOpen = null;
    this.elPrintItemTodoClosed = null;
    this.elPrintItemTopList = itemTopList;
    this.elPrintItemMeetings = itemMeetingsClosed;
    this.elActionProjectFirmsBtn = null;
    this.elActionMeetingsBtn = btnMeetings;
    this.elActionCandidatesBtn = null;
    this.elActionParticipantsBtn = null;
    this.elSetupWrap = setupWrap;
    this.elSetupBtn = setupBtn;
    this.elSetupMenu = setupMenu;
    this.elLogoGroup = logoGroup;
    this.elLogoWrap = logoWrap;
    this.elLogoImg = logoImg;
    this.elStickyNotice = stickyNotice;
    this.elStickyNoticeText = stickyNoticeText;

    if (this._stickyNoticeMessage) {
      this.setStickyNotice(this._stickyNoticeMessage);
    }

    this.refresh();
    return root;
  }

  setStickyNotice(message) {
    const text = String(message || "").trim();
    this._stickyNoticeMessage = text;

    if (!this.elStickyNotice || !this.elStickyNoticeText) return;

    if (!text) {
      this.elStickyNotice.style.display = "none";
      this.elStickyNoticeText.textContent = "";
      return;
    }

    this.elStickyNoticeText.textContent = text;
    this.elStickyNotice.style.display = "flex";
  }

  clearStickyNotice() {
    if (this.router?.context?.ui) {
      this.router.context.ui.stickyNotice = "";
      this.router.context.ui.suppressClickBlockerNotice = true;
    }
    this.setStickyNotice("");
  }

  _clampLogoNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const v = Math.round(n);
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  _parseBool(value, fallback) {
    if (value == null || value === "") return fallback;
    const s = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "ja", "on"].includes(s)) return true;
    if (["0", "false", "no", "nein", "off"].includes(s)) return false;
    return fallback;
  }

  _normalizeLogoPosition(value, fallback = "left") {
    const s = String(value || "").trim().toLowerCase();
    if (s === "right" || s === "rechts") return "right";
    if (s === "left" || s === "links") return "left";
    return fallback;
  }

  _toFileUrl(p) {
    const raw = String(p || "").trim();
    if (!raw) return "";
    if (/^file:\/\//i.test(raw)) return raw;
    if (/^[a-zA-Z]:[\\/]/.test(raw)) {
      return `file:///${raw.replace(/\\/g, "/")}`;
    }
    return raw;
  }

  _fallbackBundledLogoUrl() {
    try {
      return new URL("../../../build/bbm-icon.ico", import.meta.url).toString();
    } catch {
      return "../../../build/bbm-icon.ico";
    }
  }

  async _resolveDefaultLogoSrc() {
    if (this._defaultLogoSrc) return this._defaultLogoSrc;
    if (this._defaultLogoLoading) return this._defaultLogoLoading;

    const api = window.bbmDb || {};
    if (typeof api.appGetBundledIconPath !== "function") {
      this._defaultLogoSrc = this._fallbackBundledLogoUrl();
      return this._defaultLogoSrc;
    }

    this._defaultLogoLoading = api
      .appGetBundledIconPath()
      .then((res) => {
        const bundled = this._toFileUrl(res?.ok ? res?.path : "");
        this._defaultLogoSrc = bundled || this._fallbackBundledLogoUrl();
        return this._defaultLogoSrc;
      })
      .catch(() => {
        this._defaultLogoSrc = this._fallbackBundledLogoUrl();
        return this._defaultLogoSrc;
      })
      .finally(() => {
        this._defaultLogoLoading = null;
      });

    return this._defaultLogoLoading;
  }

  async _applyLogoSource(settings = {}) {
    if (!this.elLogoImg) return;

    const customLogo = this._toFileUrl(settings["header.logoPath"]);
    if (!customLogo) {
      this.elLogoImg.style.display = "none";
      this.elLogoImg.removeAttribute("src");
      return;
    }

    if (this.elLogoImg.src !== customLogo) {
      this.elLogoImg.src = customLogo;
    }
    this.elLogoImg.style.display = "block";
  }

  _setActiveText(val) {
    if (!this.elActive) return;

    const value = (val ?? "").toString().trim();
    const shown = value || "-";

    this.elActive.textContent = "";

    const sLabel = document.createElement("span");
    sLabel.textContent = "aktiv:";
    sLabel.style.fontSize = "14px";
    sLabel.style.lineHeight = "16px";
    sLabel.style.opacity = "0.8";
    sLabel.style.fontWeight = "400";
    sLabel.style.flex = "0 0 auto";

    const sValue = document.createElement("span");
    sValue.textContent = shown;
    sValue.style.marginLeft = "0.75cm";
    sValue.style.fontSize = "12px";
    sValue.style.lineHeight = "14px";
    sValue.style.fontWeight = "600";
    sValue.style.flex = "1 1 auto";
    sValue.style.minWidth = "0";
    sValue.style.overflow = "hidden";
    sValue.style.textOverflow = "ellipsis";
    sValue.style.whiteSpace = "nowrap";

    this.elActive.append(sLabel, sValue);
  }

  _setActiveProjectBlock(val) {
    if (!this.elActive) return;

    const hasProject = !!this.router?.currentProjectId;
    const activeValue = (val ?? "").toString().trim();

    this.elActive.textContent = "";
    this.elActive.style.display = hasProject ? "grid" : "none";
    if (!hasProject) return;

    this.elActive.style.gridTemplateColumns = "auto minmax(0, 1fr)";
    this.elActive.style.columnGap = "10px";
    this.elActive.style.rowGap = "2px";
    this.elActive.style.alignItems = "center";

    const activeLabel = document.createElement("span");
    activeLabel.textContent = "aktiv:";
    activeLabel.style.fontSize = "13px";
    activeLabel.style.lineHeight = "16px";
    activeLabel.style.opacity = "0.8";
    activeLabel.style.fontWeight = "600";
    activeLabel.style.textAlign = "left";

    const activeValEl = document.createElement("span");
    activeValEl.textContent = activeValue;
    activeValEl.style.fontSize = "13px";
    activeValEl.style.lineHeight = "16px";
    activeValEl.style.fontWeight = "700";
    activeValEl.style.minWidth = "0";
    activeValEl.style.overflow = "hidden";
    activeValEl.style.textOverflow = "ellipsis";
    activeValEl.style.whiteSpace = "nowrap";
    activeValEl.style.textAlign = "left";

    const readyLabel = document.createElement("span");
    readyLabel.textContent = "bereit:";
    readyLabel.style.fontSize = "13px";
    readyLabel.style.lineHeight = "16px";
    readyLabel.style.opacity = "0.8";
    readyLabel.style.fontWeight = "600";
    readyLabel.style.textAlign = "left";

    const setupStatus =
      this._setupStatusForProjectId === this.router?.currentProjectId ? this._setupStatus : null;
    const readyLight = String(setupStatus?.worstLight || "").trim().toLowerCase();
    const readyValEl = document.createElement("span");
    readyValEl.textContent = "";
    readyValEl.style.fontSize = "13px";
    readyValEl.style.lineHeight = "16px";
    readyValEl.style.fontWeight = "600";
    readyValEl.style.minHeight = "16px";
    readyValEl.style.textAlign = "left";
    readyValEl.style.display = "inline-flex";
    readyValEl.style.alignItems = "center";
    readyValEl.style.gap = "6px";
    if (readyLight) {
      const dot = document.createElement("span");
      dot.style.display = "inline-block";
      dot.style.width = "10px";
      dot.style.height = "10px";
      dot.style.borderRadius = "999px";
      dot.style.background = this._lightColor(readyLight);
      dot.style.border = "1px solid rgba(0,0,0,0.2)";
      readyValEl.appendChild(dot);
      readyValEl.title = setupStatus
        ? `Zuordnung: ${setupStatus.firmsAssignedCount}, Firmen im Projekt: ${setupStatus.firmsActiveCount}, aktive Mitarbeiter im Projekt: ${setupStatus.peopleActiveCount}`
        : "";
    }

    this.elActive.append(activeLabel, activeValEl, readyLabel, readyValEl);
  }

  _ensureActiveLabel() {
    const router = this.router;
    const projectId = router?.currentProjectId || null;

    if (!projectId) {
      this._activeLabelForProjectId = null;
      this._activeLabel = "";
      return;
    }

    if (this._activeLabelForProjectId === projectId && this._activeLabel) return;
    if (this._activeLoading) return;

    const api = window.bbmDb || {};
    if (typeof api.projectsList !== "function") {
      this._activeLabelForProjectId = projectId;
      this._activeLabel = (router?.context?.projectLabel || "").toString().trim();
      return;
    }

    this._activeLoading = api
      .projectsList()
      .then((res) => {
        if (!res?.ok) return;

        const list = res.list || [];
        const p = list.find((x) => x.id === projectId) || null;
        if (!p) return;

        const pn = (p.project_number ?? p.projectNumber ?? "").toString().trim();
        const sh = (p.short ?? "").toString().trim();
        const nm = (p.name ?? "").toString().trim();

        let label = "";
        if (pn && sh) label = `${pn} - ${sh}`;
        else if (pn && !sh) label = pn;
        else if (!pn && sh) label = sh;
        else if (nm) label = nm;
        else label = `#${projectId}`;

        this._activeLabelForProjectId = projectId;
        this._activeLabel = label;

        if (this._isNewUi) {
          this._setActiveProjectBlock(label);
        } else {
          this._setActiveText(label);
        }
      })
      .catch(() => {})
      .finally(() => {
        this._activeLoading = null;
      });
  }

  _setSetupOpen(open) {
    this._setupOpen = !!open;
    if (!this.elSetupMenu) return;
    this.elSetupMenu.style.display = this._setupOpen ? "flex" : "none";
  }

  _setPrintSubmenu(key) {
    this._printActiveSubmenu = String(key || "").trim();
    if (this.elPrintSubmenuFirms) {
      this.elPrintSubmenuFirms.style.display =
        this._printActiveSubmenu === "firms" ? "flex" : "none";
    }
    if (this.elPrintSubmenuTodo) {
      this.elPrintSubmenuTodo.style.display =
        this._printActiveSubmenu === "todo" ? "flex" : "none";
    }
    if (this._printOpen && this._printActiveSubmenu) {
      const activeKey = this._printActiveSubmenu;
      window.requestAnimationFrame(() => {
        if (!this._printOpen || this._printActiveSubmenu !== activeKey) return;
        this._positionActivePrintSubmenu();
      });
    }
  }

  _positionPrintSubmenu(submenuEl, wrapEl) {
    if (!submenuEl || !wrapEl) return;

    const viewportPad = 8;
    const gap = 4;
    submenuEl.style.maxWidth = `calc(100vw - ${viewportPad * 2}px)`;
    submenuEl.style.left = `calc(100% + ${gap}px)`;
    submenuEl.style.right = "auto";

    let rect = submenuEl.getBoundingClientRect();
    const viewportRight = Number(window.innerWidth || 0) - viewportPad;

    if (rect.right > viewportRight) {
      submenuEl.style.left = "auto";
      submenuEl.style.right = `calc(100% + ${gap}px)`;
      rect = submenuEl.getBoundingClientRect();
    }

    if (rect.left < viewportPad) {
      const wrapRect = wrapEl.getBoundingClientRect();
      const minLeft = Math.max(viewportPad - wrapRect.left, 0);
      submenuEl.style.right = "auto";
      submenuEl.style.left = `${minLeft}px`;
      rect = submenuEl.getBoundingClientRect();

      if (rect.right > viewportRight) {
        const overflowRight = rect.right - viewportRight;
        submenuEl.style.left = `${Math.max(minLeft - overflowRight, 0)}px`;
      }
    }
  }

  _positionActivePrintSubmenu() {
    if (this._printActiveSubmenu === "firms") {
      this._positionPrintSubmenu(this.elPrintSubmenuFirms, this.elPrintBranchFirmsWrap);
      return;
    }
    if (this._printActiveSubmenu === "todo") {
      this._positionPrintSubmenu(this.elPrintSubmenuTodo, this.elPrintBranchTodoWrap);
    }
  }

  _isMeetingsQuickPrintActive() {
    return typeof this.router?.activeView?.printSelectedProtocolPreviewFromHeader === "function";
  }

  _setPrintOpen(open) {
    if (open && this._isMeetingsQuickPrintActive()) {
      this._printOpen = false;
      if (this.elPrintMenu) this.elPrintMenu.style.display = "none";
      this._setPrintSubmenu("");
      return;
    }
    this._printOpen = !!open;
    if (this.elPrintMenu) {
      this.elPrintMenu.style.display = this._printOpen ? "flex" : "none";
    }
    if (!this._printOpen) {
      this._setPrintSubmenu("");
      return;
    }
    this._setSetupOpen(false);
  }

  _setMailOpen(open) {
    this._mailOpen = !!open;
    if (this.elMailMenu) this.elMailMenu.style.display = this._mailOpen ? "flex" : "none";
    if (this._mailOpen) {
      this._setPrintOpen(false);
      this._setSetupOpen(false);
    }
  }

  _setMenuButtonEnabled(btn, enabled, disabledTitle = "") {
    if (!btn) return;
    const isEnabled = !!enabled;
    btn.disabled = !isEnabled;
    btn.style.opacity = isEnabled ? "1" : "0.55";
    btn.style.cursor = isEnabled ? "pointer" : "not-allowed";
    btn.title = isEnabled ? "" : String(disabledTitle || "");
  }

  async _resolvePrintMenuState({ force = false } = {}) {
    const projectId = this.router?.currentProjectId || null;
    const hasProject = !!projectId;

    const ui = this.router?.context?.ui || {};
    const isTopsView = !!ui.isTopsView;
    const currentMeetingId = this.router?.currentMeetingId || null;

    const base = {
      hasProject,
      projectId,
      isTopsView,
      currentMeetingId,
      openMeetingId: null,
      canPreviewProtocol: false,
      canOpenMeetingActions: false,
      canSelectClosedMeeting: hasProject,
      canNavigateMeetings: hasProject,
    };

    if (!hasProject) return base;

    if (!force && this._printMenuState && this._printMenuState.projectId === projectId) {
      const isFresh = Date.now() - Number(this._printMenuState.loadedAt || 0) < 1200;
      if (isFresh) {
        const openMeetingId = this._printMenuState.openMeetingId || null;
        const currentMeetingIsOpen =
          !!currentMeetingId && !!openMeetingId && String(currentMeetingId) === String(openMeetingId);
        return {
          ...this._printMenuState,
          isTopsView,
          currentMeetingId,
          canPreviewProtocol: hasProject && isTopsView && currentMeetingIsOpen,
          canOpenMeetingActions: hasProject && !!openMeetingId,
          canSelectClosedMeeting: hasProject,
          canNavigateMeetings: hasProject,
        };
      }
    }

    if (!force && this._printMenuStateLoading) {
      const pending = await this._printMenuStateLoading;
      if (!pending) return base;
      const openMeetingId = pending.openMeetingId || null;
      const currentMeetingIsOpen =
        !!currentMeetingId && !!openMeetingId && String(currentMeetingId) === String(openMeetingId);
      return {
        ...pending,
        isTopsView,
        currentMeetingId,
        canPreviewProtocol: hasProject && isTopsView && currentMeetingIsOpen,
        canOpenMeetingActions: hasProject && !!openMeetingId,
        canSelectClosedMeeting: hasProject,
        canNavigateMeetings: hasProject,
      };
    }

    const api = window.bbmDb || {};
    this._printMenuStateLoading = (async () => {
      let openMeetingId = null;
      if (typeof api.meetingsListByProject === "function") {
        try {
          const res = await api.meetingsListByProject(projectId);
          if (res?.ok) {
            const list = Array.isArray(res.list) ? res.list : [];
            const openMeeting = list.find((m) => Number(m?.is_closed) === 0) || null;
            openMeetingId = openMeeting?.id || null;
          }
        } catch (_e) {}
      }

      const currentMeetingIsOpen =
        !!currentMeetingId && !!openMeetingId && String(currentMeetingId) === String(openMeetingId);
      return {
        hasProject,
        projectId,
        isTopsView,
        currentMeetingId,
        openMeetingId,
        canPreviewProtocol: hasProject && isTopsView && currentMeetingIsOpen,
        canOpenMeetingActions: hasProject && !!openMeetingId,
        canSelectClosedMeeting: hasProject,
        canNavigateMeetings: hasProject,
        loadedAt: Date.now(),
      };
    })();

    try {
      return await this._printMenuStateLoading;
    } finally {
      this._printMenuStateLoading = null;
    }
  }

  _applyPrintMenuState(state = null) {
    const s = state || this._printMenuState || {};
    const hasProject = !!s.hasProject;

    this._setMenuButtonEnabled(
      this.elPrintItemPreview,
      !!s.canPreviewProtocol,
      "Nur in der TopsView mit geladener offener Besprechung verfügbar"
    );
    this._setMenuButtonEnabled(this.elPrintBranchFirms, hasProject, "Nur mit aktivem Projekt verfügbar");
    this._setMenuButtonEnabled(this.elPrintBranchTodo, hasProject, "Nur mit aktivem Projekt verfügbar");
    this._setMenuButtonEnabled(this.elPrintItemTopList, hasProject, "Nur mit aktivem Projekt verfügbar");
    this._setMenuButtonEnabled(this.elPrintItemMeetings, hasProject, "Nur mit aktivem Projekt verfügbar");

    if (!hasProject) this._setPrintOpen(false);
  }

  async _refreshPrintMenuState({ force = false } = {}) {
    const state = await this._resolvePrintMenuState({ force });
    this._printMenuState = state || null;
    this._applyPrintMenuState(this._printMenuState);
    return this._printMenuState;
  }

  _pickArray(res) {
    return res?.items || res?.list || res?.data || res?.candidates || [];
  }

  _parseActiveValue(v) {
    if (v === undefined || v === null || v === "") return null;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return Number.isFinite(v) ? v !== 0 : null;
    const s = String(v).trim().toLowerCase();
    if (["1", "true", "yes", "ja", "on", "active"].includes(s)) return true;
    if (["0", "false", "no", "nein", "off", "inactive"].includes(s)) return false;
    return null;
  }

  _isItemActive(item) {
    if (!item || typeof item !== "object") return true;
    const candidates = [item.is_active, item.isActive, item.active, item.enabled, item.isEnabled, item.status];
    for (const v of candidates) {
      const parsed = this._parseActiveValue(v);
      if (parsed !== null) return parsed;
    }
    return true;
  }

  _hasActiveField(item) {
    if (!item || typeof item !== "object") return false;
    return ["is_active", "isActive", "active", "enabled", "isEnabled", "status"].some((k) =>
      Object.prototype.hasOwnProperty.call(item, k)
    );
  }

  _dedupeBy(list, keyFn) {
    const out = [];
    const seen = new Set();
    for (const item of Array.isArray(list) ? list : []) {
      const key = String(keyFn?.(item) || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  _lightFromCount(count) {
    const n = Math.max(0, Number(count) || 0);
    if (n === 0) return "red";
    if (n === 1) return "yellow";
    if (n === 2) return "orange";
    return "green";
  }

  _lightRank(light) {
    if (light === "red") return 0;
    if (light === "yellow") return 1;
    if (light === "orange") return 2;
    if (light === "green") return 3;
    return 0;
  }

  _worstLight(lights = []) {
    if (!Array.isArray(lights) || lights.length === 0) return "red";
    let worst = "green";
    for (const l of lights) {
      if (this._lightRank(l) < this._lightRank(worst)) worst = l;
    }
    return worst;
  }

  _lightColor(light) {
    if (light === "green") return "#16a34a";
    if (light === "orange") return "#f97316";
    if (light === "yellow") return "#f59e0b";
    return "#dc2626";
  }

  async computeSetupStatus(projectId) {
    const pid = projectId || this.router?.currentProjectId || null;
    if (!pid) {
      return {
        firmsAssignedCount: 0,
        firmsActiveCount: 0,
        peopleActiveCount: 0,
        lights: { firmsAssigned: "red", firmsPool: "red", peoplePool: "red" },
        worstLight: "red",
        isReady: false,
      };
    }

    const api = window.bbmDb || {};
    const safeCall = async (fn, arg) => {
      if (typeof fn !== "function") return [];
      try {
        const res = await fn(arg);
        if (!res?.ok) return [];
        const arr = this._pickArray(res);
        return Array.isArray(arr) ? arr : [];
      } catch (_e) {
        return [];
      }
    };

    const firmCandidatesRaw = await safeCall(api.projectFirmsListFirmCandidatesByProject, pid);
    const firmCandidates = this._dedupeBy(
      firmCandidatesRaw,
      (x) => `${String(x?.kind || "")}::${String(x?.id || "")}`
    );
    const firmsAssignedCount = firmCandidates.length;

    const localFirms = await safeCall(api.projectFirmsListByProject, pid);
    const globalFirms = await safeCall(api.firmsListGlobal);
    const localById = new Map((localFirms || []).map((x) => [String(x?.id || ""), x]));
    const globalById = new Map((globalFirms || []).map((x) => [String(x?.id || ""), x]));

    let firmsActiveCount = 0;
    for (const item of firmCandidates) {
      const kind = String(item?.kind || "").trim();
      const id = String(item?.id || "").trim();
      if (!id) continue;
      let source = item;
      if (kind === "project_firm" && localById.has(id)) {
        const local = localById.get(id);
        source = this._hasActiveField(item) ? { ...local, ...item } : local;
      }
      if (kind === "global_firm" && globalById.has(id)) {
        const global = globalById.get(id);
        source = this._hasActiveField(item) ? { ...global, ...item } : global;
      }
      if (this._isItemActive(source)) firmsActiveCount += 1;
    }

    const peopleRaw = await safeCall(api.projectCandidatesList, { projectId: pid });
    const people = this._dedupeBy(
      peopleRaw,
      (x) => `${String(x?.kind || "")}::${String(x?.personId ?? x?.person_id ?? "")}`
    );
    let peopleActiveCount = 0;
    for (const item of people) {
      if (this._isItemActive(item)) peopleActiveCount += 1;
    }

    const lights = {
      firmsAssigned: this._lightFromCount(firmsAssignedCount),
      firmsPool: this._lightFromCount(firmsActiveCount),
      peoplePool: this._lightFromCount(peopleActiveCount),
    };
    const worstLight = this._worstLight([lights.firmsAssigned, lights.firmsPool, lights.peoplePool]);
    const isReady = [lights.firmsAssigned, lights.firmsPool, lights.peoplePool].every(
      (l) => this._lightRank(l) >= this._lightRank("yellow")
    );

    return {
      firmsAssignedCount,
      firmsActiveCount,
      peopleActiveCount,
      lights,
      worstLight,
      isReady,
    };
  }

  _ensureSetupStatus({ force = false } = {}) {
    const projectId = this.router?.currentProjectId || null;
    if (!projectId) {
      this._setupStatusForProjectId = null;
      this._setupStatus = null;
      this._setupStatusLoadedAt = 0;
      this._setupStatusRefreshPending = false;
      return;
    }

    const now = Date.now();
    const isFresh =
      this._setupStatusForProjectId === projectId &&
      this._setupStatus &&
      now - this._setupStatusLoadedAt < 1500;
    if (!force && isFresh) return;
    if (this._setupStatusLoading) {
      if (force) this._setupStatusRefreshPending = true;
      return;
    }

    this._setupStatusRefreshPending = false;
    this._setupStatusLoading = this.computeSetupStatus(projectId)
      .then((status) => {
        this._setupStatusForProjectId = projectId;
        this._setupStatus = status || null;
        this._setupStatusLoadedAt = Date.now();
        if (!this._isNewUi) return;
        if ((this.router?.currentProjectId || null) !== projectId) return;
        const fallback =
          (this._activeLabelForProjectId === projectId && this._activeLabel) ||
          (this.router?.context?.projectLabel || "");
        this._setActiveProjectBlock(fallback);
      })
      .catch(() => {})
      .finally(() => {
        this._setupStatusLoading = null;
        if (this._setupStatusRefreshPending) {
          this._setupStatusRefreshPending = false;
          this._ensureSetupStatus({ force: true });
        }
      });
  }

  _applyHeaderActionState() {
    const hasProject = !!this.router?.currentProjectId;
    const hasMeeting = !!this.router?.currentMeetingId;
    const projectDisabledTitle = "Nur mit aktivem Projekt verfügbar";
    const participantsDisabledTitle = "Nur mit geöffneter Besprechung verfügbar";
    // Mail-Button folgt der Projekt-Logik
    if (this.elMailBtn) {
      this.elMailBtn.disabled = !hasProject;
      this.elMailBtn.style.opacity = hasProject ? "1" : "0.6";
      this.elMailBtn.style.cursor = hasProject ? "pointer" : "not-allowed";
      this.elMailBtn.title = hasProject ? "E-Mail senden" : projectDisabledTitle;
    }
    this._setMenuButtonEnabled(this.elActionMeetingsBtn, hasProject, projectDisabledTitle);
    this._setMenuButtonEnabled(this.elActionCandidatesBtn, hasProject, projectDisabledTitle);
  }

  _applySetupState() {
    const hasProject = !!this.router?.currentProjectId;
    const visible = false;

    if (this.elSetupWrap) {
      this.elSetupWrap.style.display = visible ? "inline-flex" : "none";
    }
    if (this.elSetupBtn) {
      this.elSetupBtn.disabled = !hasProject;
      this.elSetupBtn.style.opacity = hasProject ? "1" : "0.55";
      this.elSetupBtn.style.cursor = hasProject ? "pointer" : "not-allowed";
      this.elSetupBtn.title = hasProject ? "Setup öffnen" : "Nur mit aktivem Projekt verfügbar";
    }
    if (!hasProject || !visible) {
      this._setSetupOpen(false);
    }
  }

  _applyPrintButtonState() {
    if (!this.elPrintBtn) return;
    const hasProject = !!this.router?.currentProjectId;
    const isMeetingsQuickPrint = this._isMeetingsQuickPrintActive();
    this.elPrintBtn.disabled = !hasProject;
    this.elPrintBtn.style.opacity = hasProject ? "1" : "0.55";
    this.elPrintBtn.style.cursor = hasProject ? "pointer" : "not-allowed";
    this.elPrintBtn.title = hasProject
      ? isMeetingsQuickPrint
        ? "In Protokolle-Ansicht: Drucken öffnet die PDF-Vorschau des markierten Protokolls."
        : "Drucken-Menü öffnen"
      : "Nur mit aktivem Projekt verfügbar";
    if (this.elPrintMenu) {
      this.elPrintMenu.style.display = isMeetingsQuickPrint ? "none" : this._printOpen ? "flex" : "none";
    }
    if (isMeetingsQuickPrint) this._setPrintOpen(false);
    if (!hasProject) this._setPrintOpen(false);

    const fallbackState = this._printMenuState || {
      hasProject,
      projectId: this.router?.currentProjectId || null,
      isTopsView: !!this.router?.context?.ui?.isTopsView,
      currentMeetingId: this.router?.currentMeetingId || null,
      openMeetingId: null,
      canPreviewProtocol: false,
      canOpenMeetingActions: false,
      canSelectClosedMeeting: hasProject,
      canNavigateMeetings: hasProject,
    };
    fallbackState.hasProject = hasProject;
    fallbackState.canSelectClosedMeeting = hasProject;
    fallbackState.canNavigateMeetings = hasProject;
    if (!hasProject) {
      fallbackState.canPreviewProtocol = false;
      fallbackState.canOpenMeetingActions = false;
    }
    this._applyPrintMenuState(fallbackState);
  }

  // ============================================================
  // Trial: Fenster-Titel AN, Header-Anzeige AUS
  // ============================================================
  async _refreshTrialInfo() {
    const api = window.bbmDb || {};

    // Header-Anzeige immer aus
    if (this.elTrialInfo) {
      this.elTrialInfo.textContent = "";
      this.elTrialInfo.style.display = "none";
    }

    if (typeof api.appSettingsGetMany !== "function") {
      this._trialInfoText = "";
      document.title = this._baseWindowTitle;
      return;
    }
    if (this._trialInfoLoading) return;

    this._trialInfoLoading = (async () => {
      try {
        const res = await api.appSettingsGetMany(["trial.enabled", "trial.daysLimit", "trial.firstStartAt"]);
        if (!res?.ok) {
          this._trialInfoText = "";
          return;
        }
        const data = res.data || {};
        const enabledRaw = String(data["trial.enabled"] || "").trim().toLowerCase();
        const enabled = enabledRaw === "1" || enabledRaw === "true" || enabledRaw === "yes" || enabledRaw === "on";
        const limit = Math.max(0, Math.floor(Number(data["trial.daysLimit"] || 0) || 0));
        const firstStart = Math.floor(Number(data["trial.firstStartAt"] || 0) || 0);

        if (!enabled || limit <= 0 || firstStart <= 0) {
          this._trialInfoText = "";
          return;
        }

        const dayMs = 24 * 60 * 60 * 1000;
        const usedDays = Math.floor((Date.now() - firstStart) / dayMs) + 1;
        const remaining = Math.max(0, limit - usedDays + 1);
        this._trialInfoText = `Testversion: noch ${remaining} Tage`;
      } catch (_e) {
        this._trialInfoText = "";
      } finally {
        // ✅ nur Fenster-Titel setzen (Electron/Windows-Zeile)
        document.title = this._trialInfoText ? `${this._baseWindowTitle} - ${this._trialInfoText}` : this._baseWindowTitle;

        // ✅ Header bleibt aus
        if (this.elTrialInfo) {
          this.elTrialInfo.textContent = "";
          this.elTrialInfo.style.display = "none";
        }

        this._trialInfoLoading = null;
      }
    })();
  }

  async _refreshBuildChannelBadge() {
    if (!this.elDevBadge) return;
    this.elDevBadge.style.display = "none";

    const api = window.bbmDb || {};
    if (typeof api.appGetBuildChannel !== "function") return;
    if (this._buildChannelLoading) return;

    this._buildChannelLoading = (async () => {
      try {
        const res = await api.appGetBuildChannel();
        const ch = String(res?.ok ? res?.channel : "").trim().toUpperCase();
        this._buildChannel = ch;
        this.elDevBadge.style.display = ch === "DEV" ? "inline-flex" : "none";
      } catch (_e) {
        this._buildChannel = "";
        this.elDevBadge.style.display = "none";
      } finally {
        this._buildChannelLoading = null;
      }
    })();
  }

  refresh() {
    const ui = this.router?.context?.ui || {};
    const isTopsView = !!ui.isTopsView;
    const pageTitle = (ui.pageTitle || "Protokoll").toString().trim();

    if (this.elCenterTitle) {
      if (this._isNewUi) {
        this.elCenterTitle.textContent = "";
        this.elCenterTitle.style.display = "none";
      } else {
        this.elCenterTitle.textContent = pageTitle || "Protokoll";
        this.elCenterTitle.style.display = isTopsView ? "block" : "none";
      }
    }

    const settings = this.router?.context?.settings || {};
    const uName = (settings.user_name ?? "").toString().trim();
    const uComp = (settings.user_company ?? "").toString().trim();

    if (this.elUserName) this.elUserName.textContent = uName || "";
    if (this.elUserCompany) this.elUserCompany.textContent = uComp || "";
    if (this.elRightInfo && this._isNewUi) {
      this.elRightInfo.style.display = "none";
    }

    // ✅ Fenster-Titel Trial AN (Header AUS)
    this._refreshTrialInfo();

    // ✅ DEV Badge
    this._refreshBuildChannelBadge();

    const logoSize = this._clampLogoNumber(settings["header.logoSizePx"], 12, 48, 20);
    const logoPadLeft = this._clampLogoNumber(settings["header.logoPadLeftPx"], 0, 40, 0);
    const logoPadTop = this._clampLogoNumber(settings["header.logoPadTopPx"], 0, 20, 0);
    const logoPadRight = this._clampLogoNumber(settings["header.logoPadRightPx"], 0, 80, 0);
    const logoPos = this._normalizeLogoPosition(settings["header.logoPosition"], "left");
    const logoEnabled = this._parseBool(settings["header.logoEnabled"], true);
    const hasCustomLogo = !!String(settings["header.logoPath"] || "").trim();

    if (this.elLogoGroup) {
      this.elLogoGroup.style.display = logoEnabled && hasCustomLogo ? "flex" : "none";
      this.elLogoGroup.style.gridColumn = logoPos === "right" ? "3" : "1";
      this.elLogoGroup.style.justifySelf = logoPos === "right" ? "end" : "start";
      this.elLogoGroup.style.alignItems = logoPos === "right" ? "flex-end" : "flex-start";
      this.elLogoGroup.style.paddingRight = logoPos === "right" ? `${logoPadRight}px` : "0px";
      this.elLogoGroup.style.marginRight = logoPos === "left" ? `${logoPadRight}px` : "0px";
      if (this._isNewUi) {
        this.elLogoGroup.style.gridColumn = "1";
        this.elLogoGroup.style.justifySelf = "start";
        this.elLogoGroup.style.alignItems = "flex-start";
      }
    }

    if (this.elLogoWrap) {
      this.elLogoWrap.style.paddingLeft = `${logoPadLeft}px`;
      this.elLogoWrap.style.paddingTop = `${logoPadTop}px`;
    }
    if (this.elLogoImg) {
      this.elLogoImg.style.height = `${logoSize}px`;
    }
    this._applyLogoSource(settings).catch(() => {});

    const pid = this.router?.currentProjectId || null;
    const fallback =
      (this._activeLabelForProjectId === pid && this._activeLabel) ||
      this.router?.context?.projectLabel ||
      "";

    if (this._isNewUi) {
      this._setActiveProjectBlock(fallback);
    } else {
      this._setActiveText(fallback);
    }
    this._ensureActiveLabel();
    if (this._isNewUi) {
      this._ensureSetupStatus({ force: true });
    }
    if (this.elPrintBtn) {
      this.elPrintBtn.style.display = this._isNewUi ? "inline-flex" : "none";
    }
    this._applyHeaderActionState();
    this._applySetupState();
    this._applyPrintButtonState();
    if (this._isNewUi) {
      this._refreshPrintMenuState({ force: false }).catch(() => {});
    } else {
      this._setPrintOpen(false);
    }

    let stickyFromContext = this.router?.context?.ui?.stickyNotice || "";
    if (/^hinweis:\s*klick-blocker entfernt/i.test(String(stickyFromContext))) {
      stickyFromContext = "";
      if (this.router?.context?.ui) {
        this.router.context.ui.stickyNotice = "";
      }
    }
    this.setStickyNotice(stickyFromContext);
  }

  async _getCurrentProjectMailContext() {
    const projectId = this.router?.currentProjectId || null;
    const clean = (v) => String(v || "").trim();
    const splitProjectLabel = (label) => {
      const raw = clean(label);
      if (!raw) return { projectNumber: "", projectShortName: "" };
      const parts = raw.split(" - ");
      if (parts.length >= 2) {
        return {
          projectNumber: clean(parts.shift()),
          projectShortName: clean(parts.join(" - ")),
        };
      }
      return { projectNumber: "", projectShortName: raw };
    };

    if (!projectId) {
      return splitProjectLabel(this.router?.context?.projectLabel || "");
    }

    const api = window.bbmDb || {};
    if (typeof api.projectsList === "function") {
      try {
        const res = await api.projectsList();
        if (res?.ok && Array.isArray(res.list)) {
          const project = res.list.find((x) => x && x.id === projectId) || null;
          if (project) {
            const projectNumber = clean(project.project_number ?? project.projectNumber ?? "");
            const projectShortName = clean(project.short ?? project.short_name ?? project.projectShortName ?? "");
            if (projectNumber || projectShortName) {
              return { projectNumber, projectShortName };
            }
          }
        }
      } catch (err) {
        console.warn("[header] project mail context fallback used:", err);
      }
    }

    const fallbackLabel =
      (this._activeLabelForProjectId === projectId && this._activeLabel) ||
      this.router?.context?.projectLabel ||
      "";
    return splitProjectLabel(fallbackLabel);
  }

  _buildEmailSubject({ projectNumber, projectShortName, mailType } = {}) {
    const clean = (v) => String(v || "").trim();
    const numberPart = clean(projectNumber);
    const shortNamePart = clean(projectShortName);
    const typePart = clean(mailType);
    const base = [numberPart, shortNamePart].filter(Boolean).join(" - ");
    if (!typePart) return base;
    return base ? `${base} - ${typePart} -` : `${typePart} -`;
  }


_formatEmailDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[3]}.${direct[2]}.${direct[1]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

async _resolveProtocolTitleForEmail(projectId = null) {
  const api = window.bbmDb || {};

  try {
    if (projectId && typeof api.projectSettingsGetMany === "function") {
      const res = await api.projectSettingsGetMany({
        projectId,
        keys: ["pdf.protocolTitle"],
      });
      const value = String(res?.data?.["pdf.protocolTitle"] || "").trim();
      if (res?.ok && value) return value;
    }
  } catch (_err) {
    // ignore
  }

  try {
    if (typeof api.appSettingsGetMany === "function") {
      const res = await api.appSettingsGetMany(["pdf.protocolTitle"]);
      const value = String(res?.data?.["pdf.protocolTitle"] || "").trim();
      if (res?.ok && value) return value;
    }
  } catch (_err) {
    // ignore
  }

  return "Baubesprechung";
}

  async _getStoredEmailTemplate() {
    const api = window.bbmDb || {};
    const out = { subject: "", body: "" };
    if (typeof api.appSettingsGetMany !== "function") return out;

  try {
    const res = await api.appSettingsGetMany(["email_subject", "email_body"]);
    if (!res?.ok) return out;
    const data = res.data || {};
    out.subject = String(data.email_subject || "");
    out.body = String(data.email_body || "");
  } catch (_err) {
    // ignore
  }

  return out;
}

_buildEmailTemplateContext({ projectNumber, projectShortName, protocolTitle, meeting } = {}) {
  const clean = (v) => String(v || "").trim();
  const idxRaw = meeting?.meeting_index ?? meeting?.meetingIndex ?? meeting?.index ?? meeting?.number ?? "";
  const idx = clean(idxRaw);
  const dateRaw =
    meeting?.meeting_date ||
    meeting?.meetingDate ||
    meeting?.date ||
    meeting?.created_at ||
    meeting?.createdAt ||
    "";
  const date = this._formatEmailDate(dateRaw);
  return {
    projectNumber: clean(projectNumber),
    projectShortName: clean(projectShortName),
    protocolTitle: clean(protocolTitle) || "Protokoll",
    meetingIndex: idx,
    meetingDate: date,
  };
}

_defaultMeetingEmailSubject(context = {}) {
  const clean = (v) => String(v || "").trim();
  const left = [clean(context.projectNumber), clean(context.projectShortName)].filter(Boolean).join(" - ");
  let right = clean(context.protocolTitle) || "Protokoll";
  if (clean(context.meetingIndex)) right += ` #${clean(context.meetingIndex)}`;
  if (clean(context.meetingDate)) right += ` - ${clean(context.meetingDate)}`;
  if (left && right) return `${left}  |  ${right}`;
  return left || right;
}

_applyEmailSubjectTemplate(template, context = {}) {
  const raw = String(template || "");
  if (!raw.trim()) return this._defaultMeetingEmailSubject(context);
  const replacements = {
    "{projectNumber}": String(context.projectNumber || ""),
    "{projectShortName}": String(context.projectShortName || ""),
    "{protocolTitle}": String(context.protocolTitle || ""),
    "{meetingIndex}": String(context.meetingIndex || ""),
    "{meetingDate}": String(context.meetingDate || ""),
  };
  let out = raw;
  Object.entries(replacements).forEach(([token, value]) => {
    out = out.split(token).join(value);
  });
  out = out
    .replace(/\s+\|\s+\|\s+/g, "  |  ")
    .replace(/\s*\|\s*/g, "  |  ")
    .replace(/\s{3,}/g, "  ")
    .replace(/\s+-\s+-\s+/g, " - ")
    .replace(/\s+#\s+-/g, " -")
    .replace(/\|\s*$/g, "")
    .trim();
  return out || this._defaultMeetingEmailSubject(context);
}

_buildFallbackEmailSubject({ projectNumber, projectShortName, mailType } = {}) {
  const clean = (v) => String(v || "").trim();
  const numberPart = clean(projectNumber);
  const shortNamePart = clean(projectShortName);
  const typePart = clean(mailType);
  const base = [numberPart, shortNamePart].filter(Boolean).join(" - ");
  if (!typePart) return base;
  return base ? `${base} - ${typePart}` : typePart;
}

  async _getMeetingRecipientOptions(meetingId = null) {
    const selectedMeeting =
      this.router?.activeView?.getSelectedClosedMeetingForEmail?.() ||
      this.router?.activeView?.getSelectedClosedMeeting?.() ||
      null;
    const mid = meetingId || selectedMeeting?.id || null;
    if (!mid) return { distribution: [], all: [], anyDistributionField: false };

    const api = window.bbmDb || {};
    if (typeof api.meetingParticipantsList !== "function") {
      return { distribution: [], all: [], anyDistributionField: false };
    }

    const getRows = (res) =>
      Array.isArray(res?.items) ? res.items : Array.isArray(res?.list) ? res.list : [];

    const readEmail = (item) =>
      String(
        item?.email ??
          item?.email_raw ??
          item?.mail ??
          item?.e_mail ??
          item?.person_email ??
          item?.personEmail ??
          item?.participant_email ??
          item?.participantEmail ??
          ""
      ).trim();

    const hasDistributionField = (item) =>
      item &&
      (Object.prototype.hasOwnProperty.call(item, "isInDistribution") ||
        Object.prototype.hasOwnProperty.call(item, "is_in_distribution") ||
        Object.prototype.hasOwnProperty.call(item, "inDistribution") ||
        Object.prototype.hasOwnProperty.call(item, "in_distribution") ||
        Object.prototype.hasOwnProperty.call(item, "send_email") ||
        Object.prototype.hasOwnProperty.call(item, "sendEmail") ||
        Object.prototype.hasOwnProperty.call(item, "email_enabled") ||
        Object.prototype.hasOwnProperty.call(item, "emailEnabled"));

    const inDistribution = (item) =>
      Number(
        item?.isInDistribution ??
          item?.is_in_distribution ??
          item?.inDistribution ??
          item?.in_distribution ??
          item?.send_email ??
          item?.sendEmail ??
          item?.email_enabled ??
          item?.emailEnabled ??
          0
      ) === 1;

    try {
      const res = await api.meetingParticipantsList({ meetingId: mid });
      const rows = getRows(res);
      if (!res?.ok || !rows.length) return { distribution: [], all: [], anyDistributionField: false };

      const anyDistributionField = rows.some((item) => hasDistributionField(item));
      const seenAll = new Set();
      const all = [];
      for (const item of rows) {
        const email = readEmail(item);
        if (!email) continue;
        const key = email.toLowerCase();
        if (seenAll.has(key)) continue;
        seenAll.add(key);
        all.push(email);
      }

      if (!anyDistributionField) {
        return { distribution: [...all], all, anyDistributionField: false };
      }

      const dist = [];
      const seenDist = new Set();
      for (const item of rows) {
        if (!inDistribution(item)) continue;
        const email = readEmail(item);
        if (!email) continue;
        const key = email.toLowerCase();
        if (seenDist.has(key)) continue;
        seenDist.add(key);
        dist.push(email);
      }

      return { distribution: dist, all, anyDistributionField: true };
    } catch (err) {
      console.warn("[header] recipients lookup failed:", err);
      return { distribution: [], all: [], anyDistributionField: false };
    }
  }

  async _getSelectedMeetingRecipients() {
    const opt = await this._getMeetingRecipientOptions();
    if (opt.anyDistributionField && opt.distribution.length) return opt.distribution;
    if (opt.all.length) return opt.all;
    return [];
  }

async _buildProtocolPdfLookupPayload(selectedMeeting, projectId) {
  if (!selectedMeeting || !projectId) return null;

  const api = window.bbmDb || {};
  if (typeof api.projectsList !== "function" || typeof api.appSettingsGetMany !== "function") return null;

  try {
    const [projectsRes, settingsRes] = await Promise.all([
      api.projectsList(),
      api.appSettingsGetMany(["pdf.protocolsDir", "pdf.protocolTitle"]),
    ]);

    if (!projectsRes?.ok || !Array.isArray(projectsRes.list) || !settingsRes?.ok) return null;

    const project = projectsRes.list.find((x) => x && x.id === projectId) || null;
    const baseDir = String(settingsRes?.data?.["pdf.protocolsDir"] || "").trim();
    const protocolTitle =
      String(settingsRes?.data?.["pdf.protocolTitle"] || "").trim() || "Baubesprechung";

    if (!project || !baseDir) return null;

    const cleanPart = (v) =>
      String(v || "")
        .replace(/[<>:"/\\|?*]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const formatDateParts = (value) => {
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return { dot: "", iso: "" };
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return { dot: `${dd}.${mm}.${yyyy}`, iso: `${yyyy}-${mm}-${dd}` };
    };

    const meetingIndex =
      selectedMeeting?.meeting_index ??
      selectedMeeting?.meetingIndex ??
      selectedMeeting?.index ??
      selectedMeeting?.number ??
      "";

    const dateParts = formatDateParts(
      selectedMeeting?.meeting_date ||
        selectedMeeting?.meetingDate ||
        selectedMeeting?.date ||
        selectedMeeting?.created_at ||
        selectedMeeting?.createdAt ||
        selectedMeeting?.updated_at ||
        selectedMeeting?.updatedAt ||
        ""
    );

    const expectedFileNames = [];
    const numberPart = cleanPart(project?.project_number ?? project?.projectNumber ?? project?.number ?? "");
    const shortPart = cleanPart(project?.short || project?.name || "");
    const titlePart = cleanPart(protocolTitle);

    if (numberPart && titlePart && meetingIndex && dateParts.iso) {
      expectedFileNames.push(`${numberPart}_${titlePart}_#${meetingIndex}-${dateParts.iso}.pdf`);
    }
    if (numberPart && shortPart && titlePart && meetingIndex && dateParts.dot) {
      expectedFileNames.push(
        `${numberPart}_${shortPart}_${titlePart}_#${meetingIndex} - ${dateParts.dot}.pdf`
      );
    }

    return {
      baseDir,
      project: {
        project_number: project?.project_number ?? project?.projectNumber ?? project?.number ?? "",
        short: project?.short || "",
        name: project?.name || "",
      },
      expectedFileNames,
      meetingIndex: String(meetingIndex || "").trim(),
    };
  } catch (err) {
    console.warn("[header] protocol pdf lookup payload failed:", err);
    return null;
  }
}


async _openMailClient(mailType = "", options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const forceMailto = !!opts.forceMailto;
  const providedRecipients = Array.isArray(opts.recipients) ? opts.recipients.filter(Boolean) : null;
  const providedAttachments = Array.isArray(opts.attachments) ? opts.attachments.filter(Boolean) : [];
  const projectId = this.router?.currentProjectId || this.router?.context?.projectId || null;
  const selectedMeeting = opts.meeting || this.router?.activeView?.getSelectedClosedMeetingForEmail?.() || null;

  if (!selectedMeeting && this.router?.activeView?.constructor?.name === "MeetingsView") {
    alert("Bitte ein geschlossenes Protokoll in der Liste auswählen.");
    return;
  }

  const { projectNumber, projectShortName } = await this._getCurrentProjectMailContext();
  const emailTemplate = await this._getStoredEmailTemplate();
  const protocolTitle = await this._resolveProtocolTitleForEmail(projectId);

  let subject = String(opts.subject || "").trim();
  if (!subject) {
    let tplSubject = String(emailTemplate.subject || "").trim();
    if (selectedMeeting) {
      const templateContext = this._buildEmailTemplateContext({
        projectNumber,
        projectShortName,
        protocolTitle,
        meeting: selectedMeeting,
      });
      tplSubject = this._applyEmailSubjectTemplate(tplSubject, templateContext);
    }
    if (!tplSubject) {
      tplSubject = this._buildFallbackEmailSubject({ projectNumber, projectShortName, mailType }) || "Protokoll";
    }
    subject = tplSubject;
  }

  let body = typeof opts.body === "string" ? opts.body : String(emailTemplate.body || "");
  if (!body.trim()) {
    body =
      "Sehr geehrte Damen und Herren,\n\n" +
      "anbei erhalten Sie das neue Protokoll für das oben genannte Projekt mit der Bitte um Beachtung und Veranlassung.";
  }

  const recipients = providedRecipients || (await this._getSelectedMeetingRecipients());
  const lookupPayload = await this._buildProtocolPdfLookupPayload(selectedMeeting, projectId);

  const attachments = [...providedAttachments];
  try {
    if (!attachments.length && lookupPayload && window.bbmPrint?.findStoredProtocolPdf) {
      const found = await window.bbmPrint.findStoredProtocolPdf(lookupPayload);
      if (found?.ok && found?.filePath) {
        attachments.push(String(found.filePath || "").trim());
      }
    }
  } catch (err) {
    console.warn("[header] protocol pdf resolve failed:", err);
  }

  const sendViaMailto = () => {
    try {
      sendMailPayload({
        to: recipients,
        subject,
        body,
        attachments,
      });
    } catch (err) {
      console.error("[header] mailto fallback failed:", err);
      alert("E-Mail konnte nicht geöffnet werden.");
    }
  };

  // Dedup attachments
  const uniqAttachments = [];
  const seenAtt = new Set();
  for (const a of attachments) {
    const key = String(a || "").trim().toLowerCase();
    if (!key) continue;
    if (seenAtt.has(key)) continue;
    seenAtt.add(key);
    uniqAttachments.push(String(a || "").trim());
  }

  if (forceMailto) {
    attachments.length = 0;
    attachments.push(...uniqAttachments);
    sendViaMailto();
    return;
  }

  if (uniqAttachments.length && window.bbmMail?.createOutlookDraft) {
    try {
      const draftRes = await window.bbmMail.createOutlookDraft({
        to: recipients,
        subject,
        body,
        attachments: uniqAttachments,
        attachmentPath: uniqAttachments[0] || "",
      });
      if (draftRes?.ok) return;
      console.warn("[header] Outlook draft failed, fallback to mailto:", draftRes?.error || draftRes);
    } catch (err) {
      console.warn("[header] Outlook draft failed, fallback to mailto:", err);
    }
  }

  attachments.length = 0;
  attachments.push(...uniqAttachments);
  sendViaMailto();
}

  async _openMailFileFlow() {
    await this._openClosedProtocolSelectorFlow("mail");
  }

  async _openPrintFileFlow() {
    await this._openClosedProtocolSelectorFlow("print");
  }

  async _openClosedProtocolSelectorFlow(mode = "view") {
    this._setPrintOpen(false);
    this._setMailOpen(false);
    const projectId = this.router?.currentProjectId || null;
    if (!projectId) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }
    const meetings = await this._fetchClosedMeetings(projectId);
    if (!meetings.length) {
      alert("Keine geschlossenen Protokolle gefunden.");
      return;
    }

    const items = meetings
      .slice()
      .sort((a, b) => (Number(b?.meeting_index || 0) || 0) - (Number(a?.meeting_index || 0) || 0))
      .map((meeting) => ({
        id: meeting?.id || meeting?.meeting_id || null,
        label: this._formatMeetingListEntry(meeting),
        searchText: `${meeting?.title || ""} ${meeting?.meeting_index || ""} ${meeting?.meeting_date || ""}`,
        meeting,
      }))
      .filter((item) => item.id);

    await openClosedProtocolSelector({
      mode,
      items,
      searchEnabled: mode === "view",
      onConfirm: async (item) => {
        const meeting = item?.meeting || null;
        const meetingId = meeting?.id || meeting?.meeting_id || null;
        if (!meetingId) return;
        if (mode === "mail") {
          await this._openMailSendModal({ projectId, meeting });
          return;
        }
        if (mode === "print") {
          await this.router?.openMeetingPrintPreview?.({
            projectId,
            meetingId,
            mode: "closed",
          });
          return;
        }
        await this.router?.showTops?.(meetingId, projectId);
      },
    });
  }

  async _fetchClosedMeetings(projectId) {
    const api = window.bbmDb || {};
    if (typeof api.meetingsListByProject !== "function") return [];
    try {
      const res = await api.meetingsListByProject(projectId);
      const list = Array.isArray(res?.list) ? res.list : [];
      return list.filter((m) => Number(m?.is_closed) === 1 || String(m?.status || "").toLowerCase() === "closed");
    } catch (_e) {
      return [];
    }
  }

  _formatMeetingListEntry(meeting) {
    const clean = (v) => String(v || "").trim();
    const idxRaw =
      meeting?.meeting_index ??
      meeting?.meetingIndex ??
      meeting?.index ??
      meeting?.number ??
      meeting?.meetingNumber ??
      "";
    const idx = clean(idxRaw) ? `#${clean(idxRaw)}` : "";
    const dateRaw =
      meeting?.meeting_date ||
      meeting?.meetingDate ||
      meeting?.date ||
      meeting?.created_at ||
      meeting?.createdAt ||
      "";
    const dateTxt = this._formatEmailDate(dateRaw) || "";
    let keyword = clean(meeting?.title || "");
    keyword = keyword.replace(/^#\s*\d+\s*[-–—:]?\s*/i, "").trim();
    const parts = [idx, dateTxt].filter(Boolean);
    let label = parts.join(" · ");
    if (keyword) label = label ? `${label} · ${keyword}` : keyword;
    return label || "Protokoll";
  }

  async _promptMeetingSelection(projectId) {
    const meetings = await this._fetchClosedMeetings(projectId);
    if (!meetings.length) {
      alert("Keine geschlossenen Protokolle gefunden.");
      return null;
    }

    return await new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,0.45)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "12500";
      overlay.tabIndex = -1;

      const card = document.createElement("div");
      card.style.width = "min(520px, 92vw)";
      card.style.maxHeight = "80vh";
      card.style.background = "#fff";
      card.style.borderRadius = "10px";
      card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.padding = "14px";
      card.style.gap = "10px";

      const title = document.createElement("div");
      title.textContent = "zunächst Protokoll auswählen";
      title.style.fontWeight = "700";
      title.style.fontSize = "16px";

      const listEl = document.createElement("div");
      listEl.style.display = "flex";
      listEl.style.flexDirection = "column";
      listEl.style.gap = "6px";
      listEl.style.overflow = "auto";
      listEl.style.maxHeight = "50vh";

      let selectedId = null;

      meetings
        .slice()
        .sort((a, b) => (Number(b?.meeting_index || 0) || 0) - (Number(a?.meeting_index || 0) || 0))
        .forEach((m) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = this._formatMeetingListEntry(m);
          btn.style.display = "flex";
          btn.style.justifyContent = "space-between";
          btn.style.alignItems = "center";
          btn.style.border = "1px solid var(--card-border)";
          btn.style.background = "var(--card-bg)";
          btn.style.borderRadius = "6px";
          btn.style.padding = "10px 12px";
          btn.style.cursor = "pointer";
          btn.onclick = () => {
            selectedId = m.id || m.meeting_id || null;
            Array.from(listEl.children).forEach((c) => (c.style.outline = ""));
            btn.style.outline = "2px solid var(--accent, #2563eb)";
          };
          btn.ondblclick = () => {
            selectedId = m.id || m.meeting_id || null;
            finish();
          };
          listEl.appendChild(btn);
        });

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.justifyContent = "flex-end";
      actions.style.gap = "8px";

      const btnCancel = document.createElement("button");
      btnCancel.type = "button";
      btnCancel.textContent = "Abbrechen";
      btnCancel.style.padding = "8px 12px";
      btnCancel.onclick = () => {
        cleanup();
        resolve(null);
      };

      const btnOk = document.createElement("button");
      btnOk.type = "button";
      btnOk.textContent = "Weiter";
      btnOk.style.padding = "8px 12px";
      btnOk.style.background = "#2563eb";
      btnOk.style.color = "#fff";
      btnOk.style.border = "none";
      btnOk.style.borderRadius = "6px";
      btnOk.onclick = () => finish();

      actions.append(btnCancel, btnOk);
      card.append(title, listEl, actions);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      try {
        overlay.focus();
      } catch (_e) {}

      const cleanup = () => {
        try {
          overlay.remove();
        } catch (_e) {}
      };

      const finish = () => {
        if (!selectedId) {
          const first = meetings[0];
          selectedId = first?.id || first?.meeting_id || null;
        }
        const meeting = meetings.find((m) => (m.id || m.meeting_id) === selectedId) || null;
        cleanup();
        resolve(meeting);
      };
    });
  }

  async _openStoredProjectPdfSelectionPopup({ projectId, kind } = {}) {
    const pid = projectId || this.router?.currentProjectId || null;
    const kindKey = String(kind || "").trim().toLowerCase();
    if (!pid) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }
    if (typeof window?.bbmPrint?.listStoredProjectPdfs !== "function") {
      alert("Gespeicherte PDFs sind nicht verfügbar.");
      return;
    }

    const api = window.bbmDb || {};
    let settings = this.router?.context?.settings || {};
    const protocolsDir = await resolveProtocolsDir({
      settings,
      api,
      persistIfMissing: true,
      router: this.router,
    });
    settings = protocolsDir.settings || settings;
    const baseDir = String(protocolsDir.dir || "").trim();

    const projectInfo = await this._getCurrentProjectMailContext();
    const clean = (v) => String(v || "").trim();
    const splitProjectLabel = (label) => {
      const raw = clean(label);
      if (!raw) return { projectNumber: "", projectName: "" };
      const parts = raw.split(" - ");
      if (parts.length >= 2) {
        return {
          projectNumber: clean(parts.shift()),
          projectName: clean(parts.join(" - ")),
        };
      }
      return { projectNumber: "", projectName: raw };
    };
    const projectLabelParts = splitProjectLabel(this.router?.context?.projectLabel || "");
    const listRes = await window.bbmPrint.listStoredProjectPdfs({
      baseDir,
      kind: kindKey,
      project: {
        project_number: projectInfo.projectNumber || projectLabelParts.projectNumber || "",
        name: projectLabelParts.projectName || "",
        short: projectInfo.projectShortName || "",
      },
    });

    if (!listRes?.ok) {
      alert(listRes?.error || "Gespeicherte PDFs konnten nicht geladen werden.");
      return;
    }

    const files = Array.isArray(listRes?.files) ? listRes.files : [];
    const closedMeetings = kindKey === "protocol" ? await this._fetchClosedMeetings(pid) : [];
    const popupTitle = this._getStoredPdfPopupTitle(kindKey);

    return await new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,0.45)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "12500";
      overlay.tabIndex = -1;

      const card = document.createElement("div");
      card.style.width = "min(400px, 94vw)";
      card.style.maxHeight = "80vh";
      card.style.background = "#fff";
      card.style.borderRadius = "10px";
      card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.padding = "14px";
      card.style.gap = "10px";

      const title = document.createElement("div");
      title.textContent = popupTitle;
      title.style.fontWeight = "700";
      title.style.fontSize = "16px";

      const listEl = document.createElement("div");
      listEl.style.display = "flex";
      listEl.style.flexDirection = "column";
      listEl.style.gap = "6px";
      listEl.style.overflow = "auto";
      listEl.style.maxHeight = "50vh";

      if (!files.length) {
        const empty = document.createElement("div");
        empty.textContent = this._getStoredPdfEmptyText(kindKey);
        empty.style.opacity = "0.75";
        empty.style.padding = "8px 2px";
        listEl.appendChild(empty);
      } else {
        files.forEach((item) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.style.display = "flex";
          btn.style.flexDirection = "column";
          btn.style.alignItems = "flex-start";
          btn.style.gap = "4px";
          btn.style.width = "100%";
          btn.style.boxSizing = "border-box";
          btn.style.border = "1px solid var(--card-border)";
          btn.style.background = "var(--card-bg)";
          btn.style.borderRadius = "6px";
          btn.style.padding = "10px 12px";
          btn.style.cursor = "pointer";
          btn.style.textAlign = "left";

          const nameEl = document.createElement("div");
          nameEl.textContent = this._formatStoredProjectPdfListEntry(item, kindKey, closedMeetings);
          nameEl.style.fontWeight = "700";
          nameEl.style.wordBreak = "break-word";

          btn.onclick = async () => {
            const PrintModal = (await import("./PrintModal.js")).default;
            const pm = new PrintModal({ router: this.router });
            await pm.openExistingPdfPreview({
              filePath: item?.filePath,
              title: `${popupTitle} (Vorschau)`,
            });
          };

          btn.append(nameEl);
          listEl.appendChild(btn);
        });
      }

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.justifyContent = "flex-end";
      actions.style.gap = "8px";

      const btnClose = document.createElement("button");
      btnClose.type = "button";
      btnClose.textContent = "Schließen";
      btnClose.style.padding = "8px 12px";
      btnClose.onclick = () => {
        cleanup();
        resolve();
      };

      actions.appendChild(btnClose);
      card.append(title, listEl, actions);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      try {
        overlay.focus();
      } catch (_e) {}

      const cleanup = () => {
        try {
          overlay.remove();
        } catch (_e) {}
      };
    });
  }

  _getStoredPdfPopupTitle(kind = "") {
    if (kind === "todo") return "ToDo-Liste";
    if (kind === "topsall") return "Top-Liste";
    if (kind === "protocol") return "Protokolle";
    return "Firmenliste";
  }

  _getStoredPdfEmptyText(kind = "") {
    if (kind === "todo") return "Keine gespeicherten ToDo-Listen-PDFs gefunden.";
    if (kind === "topsall") return "Keine gespeicherten Top-Listen-PDFs gefunden.";
    if (kind === "protocol") return "Keine gespeicherten Protokoll-PDFs gefunden.";
    return "Keine gespeicherten Firmenlisten-PDFs gefunden.";
  }

  _formatStoredProjectPdfListEntry(item = {}, kind = "", meetings = []) {
    const fileName = String(item?.fileName || "").trim();
    const match = fileName.match(/#\s*(\d+)\s*[-_ ]?\s*(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})/i);
    let meetingLabel = "";
    let meetingIndex = "";
    if (match) {
      meetingIndex = String(match[1] || "").trim();
      const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(match[2]) ? this._formatEmailDate(match[2]) : match[2];
      meetingLabel = `#${meetingIndex} - ${dateLabel}`;
    }
    if (kind === "protocol") {
      const protocolKeyword =
        this._extractProtocolKeywordFromMeetings(meetingIndex, meetings) ||
        this._extractProtocolKeywordFromFileName(fileName);
      return [meetingLabel, protocolKeyword].filter(Boolean).join(" - ") || fileName;
    }
    return meetingLabel || fileName || String(item?.filePath || "").trim();
  }

  _extractProtocolKeywordFromMeetings(meetingIndex = "", meetings = []) {
    const idx = String(meetingIndex || "").trim();
    if (!idx) return "";
    const meeting = (Array.isArray(meetings) ? meetings : []).find((m) => {
      const value =
        m?.meeting_index ??
        m?.meetingIndex ??
        m?.index ??
        m?.number ??
        m?.meetingNumber ??
        "";
      return String(value || "").trim() === idx;
    });
    return this._extractMeetingKeyword(meeting);
  }

  _extractMeetingKeyword(meeting = null) {
    const clean = (v) => String(v || "").trim();
    let keyword = clean(meeting?.title || "");
    keyword = keyword.replace(/^#\s*\d+\s*[-–—:]?\s*/i, "").trim();
    return keyword;
  }

  _extractProtocolKeywordFromFileName(fileName = "") {
    const base = String(fileName || "").replace(/\.pdf$/i, "").trim();
    const hashIndex = base.lastIndexOf("_#");
    if (hashIndex <= 0) return "";
    const prefix = base.slice(0, hashIndex);
    const parts = prefix.split("_").map((p) => String(p || "").trim()).filter(Boolean);
    if (parts.length < 2) return "";
    const keyword = String(parts[parts.length - 1] || "").trim();
    if (!keyword) return "";
    if (/^(protokoll|baubesprechung)$/i.test(keyword)) return "";
    return keyword;
  }

  async _generateEmailAttachmentsForMeeting({ projectId, meetingId }) {
    const results = { protocol: "", firms: "", todo: "", tops: "" };
    try {
      if (typeof this.router?.printClosedMeetingDirect === "function") {
        const r = await this.router.printClosedMeetingDirect({ projectId, meetingId });
        if (r?.filePath) results.protocol = r.filePath;
      }
    } catch (err) {
      console.warn("[header] printClosedMeetingDirect for mail failed:", err);
    }
    try {
      if (typeof this.router?.printFirmsDirect === "function") {
        const r = await this.router.printFirmsDirect({ projectId, meetingId });
        if (r?.filePath) results.firms = r.filePath;
      }
    } catch (err) {
      console.warn("[header] printFirmsDirect for mail failed:", err);
    }
    try {
      if (typeof this.router?.printTodoDirect === "function") {
        const r = await this.router.printTodoDirect({ projectId, meetingId });
        if (r?.filePath) results.todo = r.filePath;
      }
    } catch (err) {
      console.warn("[header] printTodoDirect for mail failed:", err);
    }
    try {
      if (typeof this.router?.printTopListAllDirect === "function") {
        const r = await this.router.printTopListAllDirect({ projectId, meetingId });
        if (r?.filePath) results.tops = r.filePath;
      }
    } catch (err) {
      console.warn("[header] printTopListAllDirect for mail failed:", err);
    }
    return results;
  }

  async _openMailSendModal({ projectId, meeting }) {
    const meetingId = meeting?.id || meeting?.meeting_id || null;
    if (!meetingId) return;

    const recOptions = await this._getMeetingRecipientOptions(meetingId);
    const allRecipients = recOptions.all || [];
    const distRecipients =
      (recOptions.anyDistributionField && recOptions.distribution.length ? recOptions.distribution : allRecipients) || [];
    let selectedRecipients = [...distRecipients];

    const attachmentsFound = await this._generateEmailAttachmentsForMeeting({ projectId, meetingId });
    const attachments = [
      { key: "protocol", label: "Protokoll", path: attachmentsFound.protocol || "", selected: true },
      { key: "firms", label: "Firmenliste", path: attachmentsFound.firms || "", selected: true },
      { key: "todo", label: "ToDo-Liste", path: attachmentsFound.todo || "", selected: true },
      { key: "tops", label: "Top-Liste", path: attachmentsFound.tops || "", selected: true },
    ];

    const { projectNumber, projectShortName } = await this._getCurrentProjectMailContext();
    const protocolTitle = await this._resolveProtocolTitleForEmail(projectId);
    const emailTemplate = await this._getStoredEmailTemplate();
    const templateContext = this._buildEmailTemplateContext({
      projectNumber,
      projectShortName,
      protocolTitle,
      meeting,
    });
    const baseSubject =
      this._applyEmailSubjectTemplate(emailTemplate.subject || "", templateContext) ||
      this._buildFallbackEmailSubject({ projectNumber, projectShortName, mailType: "" }) ||
      this._defaultMeetingEmailSubject(templateContext);
    const baseBody =
      (emailTemplate.body || "").trim() ||
      "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie das neue Protokoll für das oben genannte Projekt mit der Bitte um Beachtung und Veranlassung.";

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.45)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "12600";
    overlay.tabIndex = -1;

    const card = document.createElement("div");
    card.style.width = "min(760px, 94vw)";
    card.style.maxHeight = "90vh";
    card.style.background = "#fff";
    card.style.borderRadius = "10px";
    card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.28)";
    card.style.display = "grid";
    card.style.gridTemplateRows = "auto 1fr auto";
    card.style.rowGap = "14px";
    card.style.padding = "16px";

    const title = document.createElement("div");
    title.textContent = "Datei an Teilnehmer senden";
    title.style.fontWeight = "700";
    title.style.fontSize = "16px";

    const content = document.createElement("div");
    content.style.display = "grid";
    content.style.gridTemplateColumns = "1fr 1fr";
    content.style.gap = "14px";
    content.style.minWidth = "0";
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
      btn.style.padding = "4px 8px";
      btn.style.border = "1px solid var(--card-border)";
      btn.style.background = "var(--card-bg)";
      btn.style.borderRadius = "6px";
      btn.style.cursor = "pointer";
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
      text.textContent = att.label + (att.path ? "" : " (Pfad wird ggf. neu erzeugt)");
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

    content.append(recWrap, attWrap, subjectLabel, subjectInput, bodyLabel, bodyInput);
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
    btnCancel.style.padding = "8px 12px";


    const btnSend = document.createElement("button");
    btnSend.type = "button";
    btnSend.textContent = "Mit Outlook / Mailprogramm öffnen";
    btnSend.style.padding = "8px 12px";
    btnSend.style.background = "#2563eb";
    btnSend.style.color = "#fff";
    btnSend.style.border = "none";
    btnSend.style.borderRadius = "6px";

    const closeOverlay = () => {
      try {
        overlay.remove();
      } catch (_e) {}
    };

    const collectAttachments = () =>
      attachments.filter((a) => a.selected && a.path).map((a) => a.path);

    const send = async () => {
      btnSend.disabled = true;
      try {
        await this._openMailClient("", {
          recipients: selectedRecipients,
          subject: subjectInput.value,
          body: bodyInput.value,
          attachments: collectAttachments(),
          meeting,
        });
      } catch (err) {
        console.error("[header] send mail failed:", err);
      } finally {
        closeOverlay();
      }
    };

    btnSend.onclick = () => send();
    btnCancel.onclick = () => {
      closeOverlay();
    };

    actions.append(btnCancel, btnSend);

    card.append(title, content, actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    try {
      overlay.focus();
    } catch (_e) {}
  }


}
