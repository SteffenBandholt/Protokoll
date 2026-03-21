// src/renderer/ui/ProjectContextQuicklane.js

export default class ProjectContextQuicklane {
  constructor() {
    this.root = null;
    this.tabEl = null;
    this.closeBtn = null;
    this.pinBtn = null;
    this.bodyEl = null;
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
    wrap.style.width = "320px";
    wrap.style.maxWidth = "92vw";
    wrap.style.background = "#ffffff";
    wrap.style.boxShadow = "-8px 0 22px rgba(0,0,0,0.14)";
    wrap.style.borderLeft = "1px solid #e4e4e4";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.transform = "translateX(calc(100% - 22px))";
    wrap.style.pointerEvents = "auto";
    wrap.style.transition = "transform 220ms ease-out";
    wrap.style.willChange = "transform";
    wrap.style.zIndex = "24";

    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = "Projekt";
    tab.setAttribute("aria-label", "Projektkontext");
    tab.style.position = "absolute";
    tab.style.left = "-22px";
    tab.style.top = "96px";
    tab.style.width = "22px";
    tab.style.height = "124px";
    tab.style.border = "1px solid #d9d9d9";
    tab.style.borderRight = "none";
    tab.style.borderRadius = "10px 0 0 10px";
    tab.style.background = "#f6f6f6";
    tab.style.color = "#333";
    tab.style.cursor = "pointer";
    tab.style.display = "flex";
    tab.style.alignItems = "center";
    tab.style.justifyContent = "center";
    tab.style.padding = "8px 0";
    tab.style.writingMode = "vertical-rl";
    tab.style.transform = "rotate(180deg)";
    tab.style.fontSize = "12px";
    tab.style.fontWeight = "600";
    tab.style.letterSpacing = "0.04em";
    tab.style.boxShadow = "-4px 0 12px rgba(0,0,0,0.08)";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "14px 16px";
    header.style.borderBottom = "1px solid #ededed";
    header.style.background = "#fafafa";

    const title = document.createElement("div");
    title.textContent = "Projektkontext";
    title.style.fontWeight = "700";
    title.style.fontSize = "15px";
    title.style.letterSpacing = "0.01em";

    const actions = document.createElement("div");
    actions.style.display = "inline-flex";
    actions.style.alignItems = "center";
    actions.style.gap = "8px";

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.textContent = "Pin";
    pinBtn.style.border = "1px solid #d5d5d5";
    pinBtn.style.background = "#ffffff";
    pinBtn.style.borderRadius = "6px";
    pinBtn.style.minWidth = "42px";
    pinBtn.style.height = "32px";
    pinBtn.style.padding = "0 10px";
    pinBtn.style.cursor = "pointer";
    pinBtn.style.display = "inline-flex";
    pinBtn.style.alignItems = "center";
    pinBtn.style.justifyContent = "center";
    pinBtn.onclick = () => this._togglePinned();

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "X";
    closeBtn.style.border = "1px solid #d5d5d5";
    closeBtn.style.background = "#ffffff";
    closeBtn.style.borderRadius = "6px";
    closeBtn.style.width = "32px";
    closeBtn.style.height = "32px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.display = "inline-flex";
    closeBtn.style.alignItems = "center";
    closeBtn.style.justifyContent = "center";
    closeBtn.onclick = () => this.close();

    actions.append(pinBtn, closeBtn);
    header.append(title, actions);

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.padding = "16px";
    body.style.overflowY = "auto";
    body.style.color = "#333";
    body.style.fontSize = "14px";
    body.style.lineHeight = "1.5";

    const sectionTitle = document.createElement("div");
    sectionTitle.textContent = "Kontext";
    sectionTitle.style.fontSize = "12px";
    sectionTitle.style.fontWeight = "700";
    sectionTitle.style.letterSpacing = "0.05em";
    sectionTitle.style.textTransform = "uppercase";
    sectionTitle.style.color = "#666";
    sectionTitle.style.marginBottom = "12px";

    const contextCard = document.createElement("div");
    contextCard.style.display = "grid";
    contextCard.style.gridTemplateColumns = "1fr";
    contextCard.style.gap = "10px";
    contextCard.style.padding = "12px";
    contextCard.style.border = "1px solid #e8e8e8";
    contextCard.style.borderRadius = "10px";
    contextCard.style.background = "#fbfbfb";

    const projectNumberRow = document.createElement("div");
    projectNumberRow.style.display = "flex";
    projectNumberRow.style.flexDirection = "column";
    projectNumberRow.style.gap = "3px";

    const projectNumberLabel = document.createElement("div");
    projectNumberLabel.textContent = "Projektnummer";
    projectNumberLabel.style.fontSize = "12px";
    projectNumberLabel.style.color = "#666";

    const projectNumberValue = document.createElement("div");
    projectNumberValue.textContent = "\u2014";
    projectNumberValue.style.fontSize = "14px";
    projectNumberValue.style.fontWeight = "600";
    projectNumberValue.style.color = "#222";

    projectNumberRow.append(projectNumberLabel, projectNumberValue);

    const projectShortRow = document.createElement("div");
    projectShortRow.style.display = "flex";
    projectShortRow.style.flexDirection = "column";
    projectShortRow.style.gap = "3px";

    const projectShortLabel = document.createElement("div");
    projectShortLabel.textContent = "Kurzbezeichnung";
    projectShortLabel.style.fontSize = "12px";
    projectShortLabel.style.color = "#666";

    const projectShortValue = document.createElement("div");
    projectShortValue.textContent = "\u2014";
    projectShortValue.style.fontSize = "14px";
    projectShortValue.style.fontWeight = "600";
    projectShortValue.style.color = "#222";

    projectShortRow.append(projectShortLabel, projectShortValue);

    const idsWrap = document.createElement("div");
    idsWrap.style.display = "grid";
    idsWrap.style.gridTemplateColumns = "1fr";
    idsWrap.style.gap = "10px";
    idsWrap.style.paddingTop = "4px";
    idsWrap.style.borderTop = "1px solid #ececec";

    const projectIdRow = document.createElement("div");
    projectIdRow.style.display = "flex";
    projectIdRow.style.flexDirection = "column";
    projectIdRow.style.gap = "3px";

    const projectLabel = document.createElement("div");
    projectLabel.textContent = "Projekt-ID";
    projectLabel.style.fontSize = "12px";
    projectLabel.style.color = "#666";

    const projectValue = document.createElement("div");
    projectValue.textContent = "\u2014";
    projectValue.style.fontSize = "12px";
    projectValue.style.fontWeight = "500";
    projectValue.style.color = "#666";

    projectIdRow.append(projectLabel, projectValue);

    const meetingRow = document.createElement("div");
    meetingRow.style.display = "flex";
    meetingRow.style.flexDirection = "column";
    meetingRow.style.gap = "3px";

    const meetingLabel = document.createElement("div");
    meetingLabel.textContent = "Meeting-ID";
    meetingLabel.style.fontSize = "12px";
    meetingLabel.style.color = "#666";

    const meetingValue = document.createElement("div");
    meetingValue.textContent = "\u2014";
    meetingValue.style.fontSize = "12px";
    meetingValue.style.fontWeight = "500";
    meetingValue.style.color = "#666";

    meetingRow.append(meetingLabel, meetingValue);
    idsWrap.append(projectIdRow, meetingRow);
    contextCard.append(projectNumberRow, projectShortRow, idsWrap);

    const quicklaneSections = document.createElement("div");
    quicklaneSections.style.display = "grid";
    quicklaneSections.style.gridTemplateColumns = "1fr";
    quicklaneSections.style.gap = "12px";
    quicklaneSections.style.marginTop = "18px";

    const createPlaceholderSection = (titleText, detailText) => {
      const section = document.createElement("div");
      section.style.display = "flex";
      section.style.flexDirection = "column";
      section.style.gap = "6px";
      section.style.padding = "12px";
      section.style.border = "1px solid #e8e8e8";
      section.style.borderRadius = "10px";
      section.style.background = "#fbfbfb";

      const title = document.createElement("div");
      title.textContent = titleText;
      title.style.fontSize = "13px";
      title.style.fontWeight = "700";
      title.style.color = "#222";

      const detail = document.createElement("div");
      detail.textContent = detailText;
      detail.style.fontSize = "12px";
      detail.style.color = "#666";

      section.append(title, detail);
      return section;
    };

    quicklaneSections.append(
      createPlaceholderSection("Projekt", "folgt"),
      createPlaceholderSection("Firmen", "noch ohne Funktion"),
      createPlaceholderSection("Mitarbeiter", "noch ohne Funktion")
    );

    body.append(sectionTitle, contextCard, quicklaneSections);

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
    this.pinBtn = pinBtn;
    this.closeBtn = closeBtn;
    this.bodyEl = body;
    this.projectNumberValueEl = projectNumberValue;
    this.projectShortValueEl = projectShortValue;
    this.projectIdValueEl = projectValue;
    this.meetingIdValueEl = meetingValue;

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
          if (!projectShort) projectShort = altParts.slice(1).join(" – ").trim();
        } else if (!projectShort && !projectLabel.startsWith("#")) {
          projectShort = projectLabel;
        }
      }
    }

    if (this.projectNumberValueEl) {
      this.projectNumberValueEl.textContent = projectNumber || "\u2014";
    }
    if (this.projectShortValueEl) {
      this.projectShortValueEl.textContent = projectShort || "\u2014";
    }
    if (this.projectIdValueEl) {
      this.projectIdValueEl.textContent =
        this._lastOpts?.projectId === undefined || this._lastOpts?.projectId === null
          ? "\u2014"
          : String(this._lastOpts.projectId);
    }
    if (this.meetingIdValueEl) {
      this.meetingIdValueEl.textContent =
        this._lastOpts?.meetingId === undefined || this._lastOpts?.meetingId === null
          ? "\u2014"
          : String(this._lastOpts.meetingId);
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
    const isVisible = this._isOpen || this._isPinned;
    this.root.style.transform = isVisible ? "translateX(0)" : "translateX(calc(100% - 22px))";

    if (this.pinBtn) {
      this.pinBtn.textContent = this._isPinned ? "Unpin" : "Pin";
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
