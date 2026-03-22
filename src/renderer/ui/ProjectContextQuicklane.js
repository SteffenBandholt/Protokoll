// src/renderer/ui/ProjectContextQuicklane.js

export default class ProjectContextQuicklane {
  constructor({ router } = {}) {
    this.router = router || null;
    this.root = null;
    this.tabEl = null;
    this.closeBtn = null;
    this.pinBtn = null;
    this.bodyEl = null;
    this.contextMetaEl = null;
    this.projectSectionEl = null;
    this.firmsSectionEl = null;
    this.employeesSectionEl = null;
    this.previewSectionEl = null;
    this.ampelSectionEl = null;
    this.longtextSectionEl = null;
    this.outputSectionEl = null;
    this.outputPopupEl = null;
    this.projectNumberValueEl = null;
    this.projectShortValueEl = null;
    this.projectIdValueEl = null;
    this.meetingIdValueEl = null;
    this._isOpen = false;
    this._isPinned = false;
    this._enabled = false;
    this._closeTimer = null;
    this._lastOpts = {};
    this._isHoveringTab = false;
    this._isHoveringPanel = false;
    this._ampelEnabled = null;
    this._longtextEnabled = null;
    this._isOutputOpen = false;
    this._ampelStateHandler = (e) => {
      this._ampelEnabled = !!e?.detail?.enabled;
      this._renderContext();
    };
    this._longtextStateHandler = (e) => {
      this._longtextEnabled = !!e?.detail?.enabled;
      this._renderContext();
    };
    this._escHandler = (e) => {
      if (e.key !== "Escape") return;
      if (this._isOutputOpen) {
        this._setOutputOpen(false);
        return;
      }
      this.close();
    };

    this._ensureRoot();
    window.addEventListener("bbm:ampel-state", this._ampelStateHandler);
    window.addEventListener("bbm:longtext-state", this._longtextStateHandler);
  }

  _ensureRoot() {
    if (this.root) return this.root;

    const wrap = document.createElement("section");
    wrap.setAttribute("data-bbm-quicklane", "project-context");
    wrap.style.position = "fixed";
    wrap.style.top = "0";
    wrap.style.right = "0";
    wrap.style.height = "100%";
    wrap.style.width = "56px";
    wrap.style.background = "#f7f7f7";
    wrap.style.boxShadow = "-8px 0 22px rgba(0,0,0,0.14)";
    wrap.style.borderLeft = "1px solid #dfdfdf";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.transform = "translateX(calc(100% - 22px))";
    wrap.style.pointerEvents = "auto";
    wrap.style.transition = "transform 220ms ease-out";
    wrap.style.willChange = "transform";
    wrap.style.zIndex = "24";
    wrap.style.overflow = "hidden";

    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = "Tools";
    tab.title = "Projektkontext";
    tab.setAttribute("aria-label", "Projektkontext");
    tab.style.position = "absolute";
    tab.style.left = "-22px";
    tab.style.top = "96px";
    tab.style.width = "22px";
    tab.style.height = "124px";
    tab.style.border = "1px solid #d9d9d9";
    tab.style.borderRight = "none";
    tab.style.borderRadius = "10px 0 0 10px";
    tab.style.background = "#f1f1f1";
    tab.style.color = "#333";
    tab.style.cursor = "pointer";
    tab.style.display = "flex";
    tab.style.alignItems = "center";
    tab.style.justifyContent = "center";
    tab.style.padding = "8px 0";
    tab.style.writingMode = "vertical-rl";
    tab.style.transform = "rotate(180deg)";
    tab.style.fontSize = "11px";
    tab.style.fontWeight = "700";
    tab.style.letterSpacing = "0.08em";
    tab.style.boxShadow = "-4px 0 12px rgba(0,0,0,0.08)";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.flexDirection = "column";
    header.style.alignItems = "center";
    header.style.gap = "6px";
    header.style.padding = "8px";
    header.style.borderBottom = "1px solid #e8e8e8";
    header.style.background = "#fafafa";

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.textContent = "P";
    pinBtn.title = "Anheften";
    pinBtn.style.border = "1px solid #d5d5d5";
    pinBtn.style.background = "#ffffff";
    pinBtn.style.borderRadius = "10px";
    pinBtn.style.width = "40px";
    pinBtn.style.height = "40px";
    pinBtn.style.padding = "0";
    pinBtn.style.cursor = "pointer";
    pinBtn.style.display = "inline-flex";
    pinBtn.style.alignItems = "center";
    pinBtn.style.justifyContent = "center";
    pinBtn.style.fontSize = "12px";
    pinBtn.style.fontWeight = "700";
    pinBtn.onclick = () => this._togglePinned();

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "X";
    closeBtn.title = "Schliessen";
    closeBtn.style.border = "1px solid #d5d5d5";
    closeBtn.style.background = "#ffffff";
    closeBtn.style.borderRadius = "10px";
    closeBtn.style.width = "40px";
    closeBtn.style.height = "40px";
    closeBtn.style.padding = "0";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.display = "none";
    closeBtn.style.alignItems = "center";
    closeBtn.style.justifyContent = "center";
    closeBtn.style.fontSize = "12px";
    closeBtn.style.fontWeight = "700";
    closeBtn.onclick = () => this.close();

    header.append(pinBtn, closeBtn);

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.padding = "10px 8px";
    body.style.overflowY = "auto";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.alignItems = "center";
    body.style.gap = "10px";

    const createToolItem = ({ icon, title, actionHandler = null }) => {
      const item = document.createElement("div");
      item.title = title;
      item.style.width = "40px";
      item.style.height = "40px";
      item.style.border = "1px solid #dfdfdf";
      item.style.borderRadius = "10px";
      item.style.background = "#ffffff";
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.justifyContent = "center";
      item.style.fontSize = "20px";
      item.style.lineHeight = "1";
      item.style.userSelect = "none";
      item.style.transition = "background 140ms ease-out, border-color 140ms ease-out";

      if (typeof actionHandler === "function") {
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.onclick = actionHandler;
        item.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          actionHandler();
        });
      }

      item.textContent = icon;
      return item;
    };

    const projectSection = createToolItem({
      icon: "📁",
      title: "Projekt",
      actionHandler: () => {
        if (!this._lastOpts?.projectId) return;
        this.router?.openProjectFormModal?.({ projectId: this._lastOpts.projectId });
      },
    });

    const firmsSection = createToolItem({
      icon: "🏢",
      title: "Firmen",
      actionHandler: () => {
        if (!this._lastOpts?.projectId) return;
        this.router?.showProjectFirms?.(this._lastOpts.projectId);
      },
    });

    const employeesSection = createToolItem({
      icon: "👥",
      title: "Teilnehmer",
      actionHandler: () => {
        if (!this._lastOpts?.projectId || !this._lastOpts?.meetingId) return;
        this.router?.openParticipantsModal?.({
          projectId: this._lastOpts.projectId,
          meetingId: this._lastOpts.meetingId,
        });
      },
    });

    const previewSection = createToolItem({
      icon: "📄",
      title: "Vorschau",
      actionHandler: () => {
        if (!this._lastOpts?.projectId || !this._lastOpts?.meetingId) return;
        this.router?.openPrintVorabzug?.({
          projectId: this._lastOpts.projectId,
          meetingId: this._lastOpts.meetingId,
        });
      },
    });

    const ampelSection = createToolItem({
      icon: "",
      title: "Ampel an/aus",
      actionHandler: () => {
        const activeView = this.router?.activeView || null;
        activeView?.btnAmpelToggle?.click?.();
      },
    });
    const ampelWrap = document.createElement("div");
    ampelWrap.style.width = "16px";
    ampelWrap.style.height = "26px";
    ampelWrap.style.borderRadius = "8px";
    ampelWrap.style.background = "#1f1f1f";
    ampelWrap.style.padding = "3px 0";
    ampelWrap.style.boxSizing = "border-box";
    ampelWrap.style.display = "flex";
    ampelWrap.style.flexDirection = "column";
    ampelWrap.style.alignItems = "center";
    ampelWrap.style.justifyContent = "space-between";
    const ampelRed = document.createElement("span");
    const ampelYellow = document.createElement("span");
    const ampelGreen = document.createElement("span");
    for (const lamp of [ampelRed, ampelYellow, ampelGreen]) {
      lamp.style.width = "6px";
      lamp.style.height = "6px";
      lamp.style.borderRadius = "999px";
      lamp.style.display = "block";
      lamp.style.transition = "background 140ms ease-out, box-shadow 140ms ease-out, opacity 140ms ease-out";
    }
    ampelWrap.append(ampelRed, ampelYellow, ampelGreen);
    ampelSection.replaceChildren(ampelWrap);

    const longtextSection = createToolItem({
      icon: "",
      title: "Langtext an/aus",
      actionHandler: () => {
        const activeView = this.router?.activeView || null;
        activeView?.btnLongToggle?.click?.();
      },
    });
    const longtextWrap = document.createElement("div");
    longtextWrap.style.width = "18px";
    longtextWrap.style.height = "18px";
    longtextWrap.style.display = "flex";
    longtextWrap.style.flexDirection = "column";
    longtextWrap.style.justifyContent = "space-between";
    const longtextLines = [];
    for (let i = 0; i < 4; i += 1) {
      const line = document.createElement("span");
      line.style.display = "block";
      line.style.height = "2px";
      line.style.borderRadius = "999px";
      line.style.background = "#3d4a5c";
      line.style.transition = "opacity 140ms ease-out, width 140ms ease-out, background 140ms ease-out";
      longtextLines.push(line);
      longtextWrap.appendChild(line);
    }
    longtextSection.replaceChildren(longtextWrap);

    const outputSection = createToolItem({
      icon: "🖨",
      title: "Ausgabe",
      actionHandler: () => {
        if (!this._lastOpts?.projectId) return;
        this._setOutputOpen(!this._isOutputOpen);
      },
    });

    const createOutputAction = (label, actionHandler) => {
      const item = document.createElement("div");
      item.textContent = label;
      item.style.width = "100%";
      item.style.minHeight = "32px";
      item.style.padding = "8px 10px";
      item.style.boxSizing = "border-box";
      item.style.borderRadius = "8px";
      item.style.border = "1px solid #dfdfdf";
      item.style.background = "#ffffff";
      item.style.fontSize = "12px";
      item.style.fontWeight = "600";
      item.style.color = "#222";
      item.style.cursor = "pointer";
      item.style.userSelect = "none";
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.onclick = actionHandler;
      item.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        actionHandler();
      });
      item.onmouseenter = () => {
        item.style.background = "#f0f0f0";
      };
      item.onmouseleave = () => {
        item.style.background = "#ffffff";
      };
      return item;
    };

    const outputPopup = document.createElement("div");
    outputPopup.style.position = "fixed";
    outputPopup.style.display = "none";
    outputPopup.style.minWidth = "180px";
    outputPopup.style.maxWidth = "220px";
    outputPopup.style.boxSizing = "border-box";
    outputPopup.style.padding = "8px";
    outputPopup.style.border = "1px solid #d8d8d8";
    outputPopup.style.borderRadius = "12px";
    outputPopup.style.background = "#ffffff";
    outputPopup.style.boxShadow = "-8px 8px 24px rgba(0,0,0,0.16)";
    outputPopup.style.flexDirection = "column";
    outputPopup.style.gap = "6px";
    outputPopup.style.zIndex = "40";

    const outputProtocols = createOutputAction("Protokolle", async () => {
      if (!this._lastOpts?.projectId) return;
      await this.router?.openClosedProtocolSelector?.({ mode: "view" });
      this._setOutputOpen(false);
    });
    const outputPrint = createOutputAction("Drucken", async () => {
      if (!this._lastOpts?.projectId) return;
      await this.router?.openOutputPrint?.();
      this._setOutputOpen(false);
    });
    const outputMail = createOutputAction("E-Mail senden", async () => {
      if (!this._lastOpts?.projectId) return;
      await this.router?.openClosedProtocolSelector?.({ mode: "mail" });
      this._setOutputOpen(false);
    });
    outputPopup.append(outputProtocols, outputPrint, outputMail);

    const contextMeta = document.createElement("div");
    contextMeta.style.display = "none";
    contextMeta.style.width = "100%";
    contextMeta.style.boxSizing = "border-box";
    contextMeta.style.padding = "10px 8px 12px";
    contextMeta.style.borderTop = "1px solid #e4e4e4";
    contextMeta.style.background = "#fafafa";
    contextMeta.style.flexDirection = "column";
    contextMeta.style.gap = "6px";

    const createMetaRow = (labelText, valueEl) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.flexDirection = "column";
      row.style.gap = "1px";

      const label = document.createElement("div");
      label.textContent = labelText;
      label.style.fontSize = "10px";
      label.style.color = "#666";

      valueEl.textContent = "—";
      valueEl.style.fontSize = "11px";
      valueEl.style.fontWeight = "600";
      valueEl.style.color = "#222";

      row.append(label, valueEl);
      return row;
    };

    const projectNumberValue = document.createElement("div");
    const projectShortValue = document.createElement("div");
    const projectIdValue = document.createElement("div");
    const meetingIdValue = document.createElement("div");

    contextMeta.append(
      createMetaRow("Projektnummer", projectNumberValue),
      createMetaRow("Kurzbezeichnung", projectShortValue),
      createMetaRow("Projekt-ID", projectIdValue),
      createMetaRow("Meeting-ID", meetingIdValue)
    );

    body.append(projectSection, firmsSection, employeesSection, previewSection, ampelSection, longtextSection, outputSection, contextMeta);
    wrap.append(tab, header, body);
    document.body.appendChild(outputPopup);

    tab.addEventListener("mouseenter", () => {
      if (!this._enabled) return;
      this._isHoveringTab = true;
      this._cancelClose();
      this._showOpenState();
    });
    tab.addEventListener("mouseleave", (e) => {
      if (!this._enabled) return;
      this._isHoveringTab = false;
      if (this.root?.contains(e.relatedTarget)) return;
      this._scheduleClose();
    });
    tab.addEventListener("click", () => {
      if (!this._enabled) return;
      this._togglePinned();
    });

    wrap.addEventListener("mouseenter", () => {
      if (!this._enabled) return;
      this._isHoveringPanel = true;
      this._cancelClose();
      this._showOpenState();
    });
    wrap.addEventListener("mouseleave", (e) => {
      if (!this._enabled) return;
      this._isHoveringPanel = false;
      if (this.root?.contains(e.relatedTarget)) return;
      this._scheduleClose();
    });
    document.addEventListener(
      "mousedown",
      (e) => {
        if (!this._isOutputOpen) return;
        if (outputSection.contains(e.target)) return;
        if (outputPopup.contains(e.target)) return;
        this._setOutputOpen(false);
      },
      true
    );

    document.body.appendChild(wrap);
    document.addEventListener("keydown", this._escHandler, true);

    this.root = wrap;
    this.tabEl = tab;
    this.closeBtn = closeBtn;
    this.pinBtn = pinBtn;
    this.bodyEl = body;
    this.contextMetaEl = contextMeta;
    this.projectSectionEl = projectSection;
    this.firmsSectionEl = firmsSection;
    this.employeesSectionEl = employeesSection;
    this.previewSectionEl = previewSection;
    this.ampelSectionEl = ampelSection;
    this.longtextSectionEl = longtextSection;
    this.outputSectionEl = outputSection;
    this.outputPopupEl = outputPopup;
    this.projectNumberValueEl = projectNumberValue;
    this.projectShortValueEl = projectShortValue;
    this.projectIdValueEl = projectIdValue;
    this.meetingIdValueEl = meetingIdValue;

    this._applyState();
    return wrap;
  }

  _renderContext() {
    const projectLabel = String(this._lastOpts?.projectLabel || "").trim();
    let projectNumber = String(this._lastOpts?.projectNumber || "").trim();
    let projectShort = String(this._lastOpts?.projectShort || "").trim();

    if (projectLabel) {
      const parts = projectLabel.split(" - ");
      if (parts.length >= 2) {
        if (!projectNumber) projectNumber = parts[0].trim();
        if (!projectShort) projectShort = parts.slice(1).join(" - ").trim();
      } else {
        const altParts = projectLabel.split(" – ");
        if (altParts.length >= 2) {
          if (!projectNumber) projectNumber = altParts[0].trim();
          if (!projectShort) projectShort = altParts.slice(1).join(" - ").trim();
        } else if (!projectShort && !projectLabel.startsWith("#")) {
          projectShort = projectLabel;
        }
      }
    }

    if (this.projectNumberValueEl) this.projectNumberValueEl.textContent = projectNumber || "—";
    if (this.projectShortValueEl) this.projectShortValueEl.textContent = projectShort || "—";
    if (this.projectIdValueEl) {
      this.projectIdValueEl.textContent =
        this._lastOpts?.projectId === undefined || this._lastOpts?.projectId === null
          ? "—"
          : String(this._lastOpts.projectId);
    }
    if (this.meetingIdValueEl) {
      this.meetingIdValueEl.textContent =
        this._lastOpts?.meetingId === undefined || this._lastOpts?.meetingId === null
          ? "—"
          : String(this._lastOpts.meetingId);
    }

    const hasProject = !!this._lastOpts?.projectId;
    const hasParticipants = hasProject && !!this._lastOpts?.meetingId;
    const hasPreview = hasProject && !!this._lastOpts?.meetingId;
    const ampelOn =
      typeof this._ampelEnabled === "boolean"
        ? this._ampelEnabled
        : !!this.router?.activeView?.showAmpelInList;
    const hasAmpel = !!this.router?.activeView?.btnAmpelToggle;
    const longtextOn =
      typeof this._longtextEnabled === "boolean"
        ? this._longtextEnabled
        : !!this.router?.activeView?.showLongtextInList;
    const hasLongtext = !!this.router?.activeView?.btnLongToggle;
    const hasOutput = hasProject;
    this._applyToolItemState(this.projectSectionEl, hasProject);
    this._applyToolItemState(this.firmsSectionEl, hasProject);
    this._applyToolItemState(this.employeesSectionEl, hasParticipants);
    this._applyToolItemState(this.previewSectionEl, hasPreview);
    this._applyToolItemState(this.ampelSectionEl, hasAmpel);
    this._applyToolItemState(this.longtextSectionEl, hasLongtext);
    this._applyToolItemState(this.outputSectionEl, hasOutput);
    if (this.ampelSectionEl?.firstChild) {
      const lamps = this.ampelSectionEl.firstChild.children || [];
      const red = lamps[0];
      const yellow = lamps[1];
      const green = lamps[2];
      if (red && yellow && green) {
        red.style.background = ampelOn ? "#5b2323" : "#ff3b30";
        red.style.opacity = ampelOn ? "0.32" : "1";
        red.style.boxShadow = ampelOn ? "none" : "0 0 10px rgba(255,59,48,0.8)";
        yellow.style.background = "#f4c542";
        yellow.style.opacity = "0.45";
        yellow.style.boxShadow = "none";
        green.style.background = ampelOn ? "#22c55e" : "#1f4d2f";
        green.style.opacity = ampelOn ? "1" : "0.32";
        green.style.boxShadow = ampelOn ? "0 0 10px rgba(34,197,94,0.85)" : "none";
      }
    }
    if (this.longtextSectionEl?.firstChild) {
      const lines = this.longtextSectionEl.firstChild.children || [];
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line) continue;
        if (longtextOn) {
          const widths = ["18px", "16px", "18px", "13px"];
          line.style.width = widths[i] || "18px";
          line.style.opacity = "1";
          line.style.background = "#304255";
        } else {
          line.style.width = i === 0 ? "18px" : "8px";
          line.style.opacity = i === 0 ? "0.95" : "0.18";
          line.style.background = "#5d6a7a";
        }
      }
    }
    if (!hasOutput) this._isOutputOpen = false;
    if (this.outputPopupEl && this.outputSectionEl) {
      if (this._isOutputOpen && hasOutput) {
        const rect = this.outputSectionEl.getBoundingClientRect();
        this.outputPopupEl.style.top = `${Math.max(12, rect.top)}px`;
        this.outputPopupEl.style.left = `${Math.max(12, rect.left - 196)}px`;
        this.outputPopupEl.style.display = "flex";
      } else {
        this.outputPopupEl.style.display = "none";
      }
    }
  }

  _applyToolItemState(el, interactive) {
    if (!el) return;
    el.style.opacity = interactive ? "1" : "0.45";
    el.style.cursor = interactive ? "pointer" : "default";
    el.style.background = interactive ? "#ffffff" : "#f3f3f3";
    el.style.borderColor = interactive ? "#d8d8d8" : "#e3e3e3";
    el.tabIndex = interactive ? 0 : -1;
    el.setAttribute("aria-disabled", interactive ? "false" : "true");
    if (interactive) {
      el.onmouseenter = () => {
        el.style.background = "#f0f0f0";
      };
      el.onmouseleave = () => {
        el.style.background = "#ffffff";
      };
    } else {
      el.onmouseenter = null;
      el.onmouseleave = null;
    }
  }

  _cancelClose() {
    if (!this._closeTimer) return;
    clearTimeout(this._closeTimer);
    this._closeTimer = null;
  }

  _scheduleClose() {
    if (this._isPinned) return;
    this._cancelClose();
    this._closeTimer = setTimeout(() => {
      this._closeTimer = null;
      if (this._isPinned || this._isHoveringTab || this._isHoveringPanel) return;
      this._hideOpenState();
    }, 320);
  }

  _showOpenState() {
    this._isOpen = true;
    this._applyState();
  }

  _hideOpenState() {
    this._isOpen = false;
    this._applyState();
  }

  _togglePinned() {
    this._isPinned = !this._isPinned;
    this._cancelClose();
    this._isOpen = this._isPinned;
    this._applyState();
  }

  _setOutputOpen(nextOpen) {
    this._isOutputOpen = !!nextOpen;
    this._renderContext();
  }

  setContext({ projectId, meetingId, projectLabel, projectNumber, projectShort } = {}) {
    this._ensureRoot();
    this._lastOpts = {
      ...this._lastOpts,
      projectId: projectId ?? null,
      meetingId: meetingId ?? null,
      projectLabel: projectLabel ?? null,
      projectNumber: projectNumber ?? null,
      projectShort: projectShort ?? null,
    };
    this._renderContext();
  }

  setEnabled(enabled) {
    this._ensureRoot();
    this._enabled = !!enabled;

    if (!this._enabled) {
      this._cancelClose();
      this._isPinned = false;
      this._isOpen = false;
      this._isHoveringTab = false;
      this._isHoveringPanel = false;
      this._isOutputOpen = false;
    }

    this._applyState();
  }

  _applyState() {
    if (!this.root) return;

    if (!this._enabled) {
      this.root.style.display = "none";
      this.root.style.pointerEvents = "none";
      this.root.style.transform = "translateX(calc(100% - 22px))";
      return;
    }

    this.root.style.display = "flex";
    this.root.style.pointerEvents = "auto";
    this.root.style.width = this._isPinned ? "176px" : "56px";
    this.root.style.transform =
      this._isOpen || this._isPinned ? "translateX(0)" : "translateX(calc(100% - 22px))";

    if (this.closeBtn) this.closeBtn.style.display = this._isPinned ? "inline-flex" : "none";
    if (this.contextMetaEl) this.contextMetaEl.style.display = this._isPinned ? "flex" : "none";

    if (this.pinBtn) {
      this.pinBtn.textContent = this._isPinned ? "U" : "P";
      this.pinBtn.title = this._isPinned ? "Loesen" : "Anheften";
      this.pinBtn.style.background = this._isPinned ? "#eef7ff" : "#ffffff";
      this.pinBtn.style.borderColor = this._isPinned ? "#b6d4ff" : "#d5d5d5";
      this.pinBtn.style.color = this._isPinned ? "#0b4db4" : "#222";
    }
  }

  open(opts = {}) {
    this._ensureRoot();
    this._lastOpts = opts && typeof opts === "object" ? { ...opts } : {};
    this._renderContext();
    this._enabled = true;
    this._cancelClose();
    this._isPinned = true;
    this._isOpen = true;
    this._applyState();
  }

  close() {
    this._cancelClose();
    this._isPinned = false;
    this._isOpen = false;
    this._isHoveringTab = false;
    this._isHoveringPanel = false;
    this._applyState();
  }
}
