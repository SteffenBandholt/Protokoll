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
    this._escHandler = (e) => {
      if (e.key === "Escape") this.close();
    };

    this._ensureRoot();
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

    body.append(projectSection, firmsSection, employeesSection, contextMeta);
    wrap.append(tab, header, body);

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
    this._applyToolItemState(this.projectSectionEl, hasProject);
    this._applyToolItemState(this.firmsSectionEl, hasProject);
    this._applyToolItemState(this.employeesSectionEl, hasParticipants);
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
