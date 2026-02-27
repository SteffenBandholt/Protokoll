// src/renderer/ui/MainHeader.js
//
// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.1
//
import { HEADER, POPOVER_MENU } from "./zIndex.js";

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
    const itemFirmsPool = mkSetupItem("Firmenpool", async (projectId) => {
      if (typeof this.router?.showFirmsPool !== "function") return;
      await this.router.showFirmsPool(projectId);
    });
    const itemCandidates = mkSetupItem("Personalpool", async (projectId) => {
      if (typeof this.router?.openCandidatesModal !== "function") {
        alert("Personalpool ist nicht verfÃ¼gbar.");
        return;
      }
      try {
        await this.router.openCandidatesModal({ projectId });
      } catch (err) {
        console.error("[header] setup Personalpool failed:", err);
        alert("Personalpool konnte nicht geÃ¶ffnet werden.");
      }
    });
    setupMenu.append(itemProjectFirms, itemFirmsPool, itemCandidates);

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


    const itemHeaderTest = mkPrintItem("Kopf-Test", async (state) => {
      if (typeof window?.bbmPrint?.printPdf !== "function") {
        alert("printPdf ist nicht verfuegbar (Preload/IPC fehlt).");
        return;
      }
      const projectId = state.projectId || null;
      const meetingId = state.currentMeetingId || state.openMeetingId || null;
      if (!projectId) {
        alert("Bitte zuerst ein Projekt auswaehlen.");
        return;
      }
      if (!meetingId) {
        alert("Bitte zuerst eine offene Besprechung in der TopsView laden.");
        return;
      }
      const out = await window.bbmPrint.printPdf({
        mode: "headerTest",
        projectId,
        meetingId,
        targetDir: "C:\\Users\\Steffen\\Downloads\\bbm",
        fileName: "Kopf-Test.pdf",
      });
      if (!out?.ok) {
        alert(out?.error || "PDF-Erzeugung fehlgeschlagen");
        return;
      }
      alert(`Kopf-Test PDF erzeugt:\n${out.filePath || "(Pfad unbekannt)"}`);
    });
    const firmsBranch = mkSubmenuBranch("Firmenliste â–¶", "firms");
    const itemFirmsOpen = mkPrintItem("Offene Besprechung", async (state) => {
      if (!state.openMeetingId) return;
      if (typeof this.router?.openFirmsPrintPreview !== "function") return;
      await this.router.openFirmsPrintPreview({
        projectId: state.projectId,
        meetingId: state.openMeetingId,
      });
    });
    const itemFirmsClosed = mkPrintItem("Geschlossene Besprechungâ€¦", async (state) => {
      if (typeof this.router?.openMeetingsForPrintSelection !== "function") return;
      await this.router.openMeetingsForPrintSelection({
        projectId: state.projectId,
        printKind: "firms",
      });
    });
    firmsBranch.submenu.append(itemFirmsOpen, itemFirmsClosed);

    const todoBranch = mkSubmenuBranch("ToDo-Liste â–¶", "todo");
    const itemTodoOpen = mkPrintItem("Offene Besprechung", async (state) => {
      if (!state.openMeetingId) return;
      if (typeof this.router?.openTodoPrintPreview !== "function") return;
      await this.router.openTodoPrintPreview({
        projectId: state.projectId,
        meetingId: state.openMeetingId,
      });
    });
    const itemTodoClosed = mkPrintItem("Geschlossene Besprechungâ€¦", async (state) => {
      if (typeof this.router?.openMeetingsForPrintSelection !== "function") return;
      await this.router.openMeetingsForPrintSelection({
        projectId: state.projectId,
        printKind: "todo",
      });
    });
    todoBranch.submenu.append(itemTodoOpen, itemTodoClosed);

    const itemMeetings = mkPrintItem("Protokolle", async (state) => {
      if (typeof this.router?.showMeetings !== "function") return;
      await this.router.showMeetings(state.projectId);
    });

    printMenu.append(itemPreview, itemHeaderTest, firmsBranch.wrap, todoBranch.wrap, itemMeetings);
    printWrap.append(printBtn, printMenu);

    printBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (printBtn.disabled) return;
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

    if (this._printResizeHandler) {
      window.removeEventListener("resize", this._printResizeHandler);
      this._printResizeHandler = null;
    }
    this._printResizeHandler = () => {
      if (!this._printOpen || !this._printActiveSubmenu) return;
      this._positionActivePrintSubmenu();
    };
    window.addEventListener("resize", this._printResizeHandler);

    const btnProjectFirms = document.createElement("button");
    btnProjectFirms.type = "button";
    btnProjectFirms.textContent = "Firmen (intern)";
    applyActionTextButtonStyle(btnProjectFirms);
    btnProjectFirms.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btnProjectFirms.disabled) return;
      this._setPrintOpen(false);
      try {
        await runProjectAction(async (projectId) => {
          if (typeof this.router?.showProjectFirms !== "function") return;
          await this.router.showProjectFirms(projectId);
        });
      } catch (err) {
        console.error("[header] action Firmen (intern) failed:", err);
      }
    };

    const btnFirmsPool = document.createElement("button");
    btnFirmsPool.type = "button";
    btnFirmsPool.textContent = "Firmenpool";
    applyActionTextButtonStyle(btnFirmsPool);
    btnFirmsPool.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btnFirmsPool.disabled) return;
      this._setPrintOpen(false);
      try {
        await runProjectAction(async (projectId) => {
          if (typeof this.router?.showFirmsPool !== "function") return;
          await this.router.showFirmsPool(projectId);
        });
      } catch (err) {
        console.error("[header] action Firmenpool failed:", err);
      }
    };

    const btnParticipants = document.createElement("button");
    btnParticipants.type = "button";
    btnParticipants.textContent = "Teilnehmer";
    applyActionTextButtonStyle(btnParticipants);
    btnParticipants.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btnParticipants.disabled) return;
      this._setPrintOpen(false);
      try {
        const projectId = this.router?.currentProjectId || null;
        const meetingId = this.router?.currentMeetingId || null;
        if (typeof this.router?.openParticipantsModal !== "function") return;
        await this.router.openParticipantsModal({ projectId, meetingId });
      } catch (err) {
        console.error("[header] action Teilnehmer failed:", err);
      }
    };

    if (this._isNewUi) {
      actionWrap.append(btnProjectFirms, btnFirmsPool, btnParticipants, printWrap);
    } else {
      actionWrap.append(setupWrap, printWrap);
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
    stickyNoticeClose.textContent = "SchlieÃŸen";
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
      stickyNotice.style.gridRow = "3";
    }

    root.append(logoGroup, elCenterTitle, elActive, rightInfo, actionWrap, stickyNotice);

    this.root = root;

    this.elCenterTitle = elCenterTitle;
    this.elVersion = null;
    this.elActive = elActive;

    this.elUserName = elUserName;
    this.elUserCompany = elUserCompany;
    this.elRightInfo = rightInfo;
    this.elPrintBtn = printBtn;
    this.elPrintWrap = printWrap;
    this.elPrintMenu = printMenu;
    this.elPrintItemPreview = itemPreview;
    this.elPrintItemHeaderTest = itemHeaderTest;
    this.elPrintBranchFirms = firmsBranch.trigger;
    this.elPrintBranchTodo = todoBranch.trigger;
    this.elPrintBranchFirmsWrap = firmsBranch.wrap;
    this.elPrintBranchTodoWrap = todoBranch.wrap;
    this.elPrintSubmenuFirms = firmsBranch.submenu;
    this.elPrintSubmenuTodo = todoBranch.submenu;
    this.elPrintItemFirmsOpen = itemFirmsOpen;
    this.elPrintItemFirmsClosed = itemFirmsClosed;
    this.elPrintItemTodoOpen = itemTodoOpen;
    this.elPrintItemTodoClosed = itemTodoClosed;
    this.elPrintItemMeetings = itemMeetings;
    this.elActionProjectFirmsBtn = btnProjectFirms;
    this.elActionFirmsPoolBtn = btnFirmsPool;
    this.elActionCandidatesBtn = null;
    this.elActionParticipantsBtn = btnParticipants;
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
    const shown = value || "â€”";

    // "aktiv:" 14/16 normal, Wert 16/18 600, Abstand 0,75cm
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

    const setupStatus = this._setupStatusForProjectId === this.router?.currentProjectId
      ? this._setupStatus
      : null;
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
        ? `Zuordnung: ${setupStatus.firmsAssignedCount}, Firmenpool: ${setupStatus.firmsActiveCount}, Personalpool: ${setupStatus.peopleActiveCount}`
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
      // fallback: whatever router already knows
      this._activeLabelForProjectId = projectId;
      this._activeLabel = (router?.context?.projectLabel || "").toString().trim();
      return;
    }

    // async refresh (non-blocking)
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

        // Ziel: Projektnummer â€“ Kurzbez (Fallbacks siehe Spec)
        let label = "";
        if (pn && sh) label = `${pn} â€“ ${sh}`;
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
      this.elPrintSubmenuFirms.style.display = this._printActiveSubmenu === "firms" ? "flex" : "none";
    }
    if (this.elPrintSubmenuTodo) {
      this.elPrintSubmenuTodo.style.display = this._printActiveSubmenu === "todo" ? "flex" : "none";
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

  _setPrintOpen(open) {
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
        } catch (_e) {
          // ignore
        }
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
      "Nur in der TopsView mit geladener offener Besprechung verfÃ¼gbar"
    );
    this._setMenuButtonEnabled(
      this.elPrintItemHeaderTest,
      !!s.canPreviewProtocol,
      "Nur in der TopsView mit geladener offener Besprechung verfÃ¼gbar"
    );
    this._setMenuButtonEnabled(
      this.elPrintBranchFirms,
      hasProject,
      "Nur mit aktivem Projekt verfÃ¼gbar"
    );
    this._setMenuButtonEnabled(
      this.elPrintItemFirmsOpen,
      !!s.canOpenMeetingActions,
      "Keine offene Besprechung verfÃ¼gbar"
    );
    this._setMenuButtonEnabled(
      this.elPrintItemFirmsClosed,
      !!s.canSelectClosedMeeting,
      "Nur mit aktivem Projekt verfÃ¼gbar"
    );
    this._setMenuButtonEnabled(
      this.elPrintBranchTodo,
      hasProject,
      "Nur mit aktivem Projekt verfÃ¼gbar"
    );
    this._setMenuButtonEnabled(
      this.elPrintItemTodoOpen,
      !!s.canOpenMeetingActions,
      "Keine offene Besprechung verfÃ¼gbar"
    );
    this._setMenuButtonEnabled(
      this.elPrintItemTodoClosed,
      !!s.canSelectClosedMeeting,
      "Nur mit aktivem Projekt verfÃ¼gbar"
    );
    this._setMenuButtonEnabled(
      this.elPrintItemMeetings,
      !!s.canNavigateMeetings,
      "Nur mit aktivem Projekt verfÃ¼gbar"
    );

    if (!hasProject) {
      this._setPrintOpen(false);
    }
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
    const candidates = [
      item.is_active,
      item.isActive,
      item.active,
      item.enabled,
      item.isEnabled,
      item.status,
    ];
    for (const v of candidates) {
      const parsed = this._parseActiveValue(v);
      if (parsed !== null) return parsed;
    }
    // Fallback-Regel: wenn kein Active-Feld vorhanden -> als aktiv behandeln.
    return true;
  }

  _hasActiveField(item) {
    if (!item || typeof item !== "object") return false;
    return [
      "is_active",
      "isActive",
      "active",
      "enabled",
      "isEnabled",
      "status",
    ].some((k) => Object.prototype.hasOwnProperty.call(item, k));
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
    const worstLight = this._worstLight([
      lights.firmsAssigned,
      lights.firmsPool,
      lights.peoplePool,
    ]);
    const isReady = [lights.firmsAssigned, lights.firmsPool, lights.peoplePool]
      .every((l) => this._lightRank(l) >= this._lightRank("yellow"));

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
    const projectDisabledTitle = "Nur mit aktivem Projekt verfÃ¼gbar";
    const participantsDisabledTitle = "Nur mit geÃ¶ffneter Besprechung verfÃ¼gbar";
    this._setMenuButtonEnabled(this.elActionProjectFirmsBtn, hasProject, projectDisabledTitle);
    this._setMenuButtonEnabled(this.elActionFirmsPoolBtn, hasProject, projectDisabledTitle);
    this._setMenuButtonEnabled(this.elActionCandidatesBtn, hasProject, projectDisabledTitle);
    this._setMenuButtonEnabled(
      this.elActionParticipantsBtn,
      hasProject && hasMeeting,
      participantsDisabledTitle
    );
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
      this.elSetupBtn.title = hasProject
        ? "Setup Ã¶ffnen"
        : "Nur mit aktivem Projekt verfÃ¼gbar";
    }
    if (!hasProject || !visible) {
      this._setSetupOpen(false);
    }
  }

  _applyPrintButtonState() {
    if (!this.elPrintBtn) return;
    const hasProject = !!this.router?.currentProjectId;
    this.elPrintBtn.disabled = !hasProject;
    this.elPrintBtn.style.opacity = hasProject ? "1" : "0.55";
    this.elPrintBtn.style.cursor = hasProject ? "pointer" : "not-allowed";
    this.elPrintBtn.title = hasProject
      ? "Drucken-MenÃ¼ Ã¶ffnen"
      : "Nur mit aktivem Projekt verfÃ¼gbar";
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

  refresh() {
    // Center title only in TopsView
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

    // User/Company
    const settings = this.router?.context?.settings || {};
    const uName = (settings.user_name ?? "").toString().trim();
    const uComp = (settings.user_company ?? "").toString().trim();

    if (this.elUserName) this.elUserName.textContent = uName || "";
    if (this.elUserCompany) this.elUserCompany.textContent = uComp || "";
    if (this.elRightInfo && this._isNewUi) {
      this.elRightInfo.style.display = "none";
    }

    const logoSize = this._clampLogoNumber(
      settings["header.logoSizePx"],
      12,
      48,
      20
    );
    const logoPadLeft = this._clampLogoNumber(
      settings["header.logoPadLeftPx"],
      0,
      40,
      0
    );
    const logoPadTop = this._clampLogoNumber(
      settings["header.logoPadTopPx"],
      0,
      20,
      0
    );
    const logoPadRight = this._clampLogoNumber(
      settings["header.logoPadRightPx"],
      0,
      80,
      0
    );
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

    // Active: fallback sofort, dann async stabilisieren
    const pid = this.router?.currentProjectId || null;
    const fallback =
      (this._activeLabelForProjectId === pid && this._activeLabel) ||
      (this.router?.context?.projectLabel || "");

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
}
