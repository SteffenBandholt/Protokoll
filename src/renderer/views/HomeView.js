// src/renderer/views/HomeView.js

export default class HomeView {
  constructor({ router } = {}) {
    this.router = router || null;
    this.root = null;
    this.lastProjectTileEl = null;
    this.lastProjectSubEl = null;
    this.lastProjectId = null;
    this.footerEl = null;
  }

  _readUiMode() {
    try {
      const raw = String(window.localStorage?.getItem?.("bbm.uiMode") || "").trim().toLowerCase();
      return raw === "new" ? "new" : "old";
    } catch (_e) {
      return "old";
    }
  }

  _isNewUiMode() {
    return this._readUiMode() === "new";
  }

  _readLastProjectId() {
    try {
      const raw = String(window.localStorage?.getItem?.("bbm.lastProjectId") || "").trim();
      return raw || null;
    } catch (_e) {
      return null;
    }
  }

  _projectLabel(p) {
    if (!p) return "";
    const numberRaw = p.project_number ?? p.projectNumber ?? "";
    const number = String(numberRaw || "").trim();
    const short = String(p.short || "").trim();
    const name = String(p.name || "").trim();
    const base = short || name || "(ohne Name)";
    if (number && base) return `${number} - ${base}`;
    return number || base;
  }

  _setLastProjectTileState({ text, disabled, projectId } = {}) {
    this.lastProjectId = projectId || null;
    if (this.lastProjectSubEl) {
      this.lastProjectSubEl.textContent = text || "";
    }
    if (this.lastProjectTileEl) {
      const isDisabled = !!disabled;
      this.lastProjectTileEl.dataset.disabled = isDisabled ? "1" : "0";
      this.lastProjectTileEl.style.opacity = isDisabled ? "0.65" : "1";
      this.lastProjectTileEl.style.cursor = isDisabled ? "default" : "pointer";
      this.lastProjectTileEl.tabIndex = isDisabled ? -1 : 0;
    }
  }

  async _loadLastProjectTile() {
    if (!this._isNewUiMode()) return;
    if (!this.lastProjectTileEl || !this.lastProjectSubEl) return;

    const lastId = this._readLastProjectId();
    if (!lastId) {
      this._setLastProjectTileState({
        text: "Kein letztes Projekt",
        disabled: true,
        projectId: null,
      });
      return;
    }

    const api = window.bbmDb || {};
    if (typeof api.projectsList !== "function") {
      this._setLastProjectTileState({
        text: "Projektliste nicht verfügbar",
        disabled: true,
        projectId: null,
      });
      return;
    }

    try {
      const res = await api.projectsList();
      if (!res?.ok) {
        this._setLastProjectTileState({
          text: "Projektliste konnte nicht geladen werden",
          disabled: true,
          projectId: null,
        });
        return;
      }
      const list = Array.isArray(res.list) ? res.list : [];
      const project = list.find((p) => String(p?.id ?? "") === String(lastId)) || null;
      if (!project || !project.id) {
        this._setLastProjectTileState({
          text: "Zuletzt geöffnetes Projekt nicht gefunden",
          disabled: true,
          projectId: null,
        });
        return;
      }

      this._setLastProjectTileState({
        text: this._projectLabel(project),
        disabled: false,
        projectId: project.id,
      });
    } catch (_e) {
      this._setLastProjectTileState({
        text: "Projektliste konnte nicht geladen werden",
        disabled: true,
        projectId: null,
      });
    }
  }

  async _openLastProject() {
    if (!this.lastProjectId) return;

    await this.router?.showProjects?.();
    const view = this.router?.currentView || null;
    if (!view || typeof view.openProjectById !== "function") return;

    const ok = await view.openProjectById(this.lastProjectId);
    if (!ok) {
      await this._loadLastProjectTile();
    }
  }

  async _openCreateProject() {
    await this.router?.showProjects?.();
    const view = this.router?.currentView || null;
    if (!view || typeof view.openCreateProject !== "function") return;
    await view.openCreateProject();
  }

  async _openCreateFirm() {
    await this.router?.showFirms?.();
    const view = this.router?.currentView || null;
    if (view?.btnNewFirm && typeof view.btnNewFirm.click === "function") {
      view.btnNewFirm.click();
    }
  }

  render() {
    const isNewUi = this._isNewUiMode();

    const root = document.createElement("div");
    root.style.height = "100%";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.boxSizing = "border-box";
    root.style.paddingBottom = "8px";

    root.style.position = "relative";
    root.style.overflow = "auto";

    const bgWrap = document.createElement("div");
    bgWrap.setAttribute("aria-hidden", "true");
    bgWrap.style.position = "absolute";
    bgWrap.style.inset = "0";
    bgWrap.style.display = "flex";
    bgWrap.style.justifyContent = "center";
    bgWrap.style.alignItems = "center";
    bgWrap.style.pointerEvents = "none";
    bgWrap.style.zIndex = "0";

    const bgImg = document.createElement("img");
    bgImg.src = "./assets/icon-BBM.png";
    bgImg.alt = "";
    bgImg.style.display = "block";
    bgImg.style.width = "clamp(55px, 7vw, 105px)";
    bgImg.style.maxWidth = "17.5%";
    bgImg.style.height = "auto";
    bgImg.style.objectFit = "contain";

    bgWrap.append(bgImg);

    const contentWrap = document.createElement("div");
    contentWrap.style.position = "relative";
    contentWrap.style.zIndex = "1";
    contentWrap.style.display = "flex";
    contentWrap.style.flexDirection = "column";
    contentWrap.style.flex = "1";
    contentWrap.style.minHeight = "100%";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";
    head.style.marginBottom = "10px";

    const h = document.createElement("h2");
    h.textContent = isNewUi ? "Start" : "Home";
    h.style.margin = "0";

    head.append(h);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(200px, 1fr))";
    grid.style.gap = "12px";
    grid.style.maxWidth = "720px";

    const mkTile = ({ titleText, subText, onClick, disabled = false }) => {
      const t = document.createElement("div");
      t.style.border = "1px solid var(--card-border)";
      t.style.borderRadius = "8px";
      t.style.padding = "12px";
      t.style.background = "var(--card-bg)";
      t.style.color = "var(--text-main)";
      t.style.cursor = disabled ? "default" : "pointer";
      t.style.display = "flex";
      t.style.flexDirection = "column";
      t.style.gap = "6px";
      t.style.opacity = disabled ? "0.65" : "1";
      t.dataset.disabled = disabled ? "1" : "0";

      const title = document.createElement("div");
      title.textContent = titleText;
      title.style.fontWeight = "700";

      t.append(title);

      if (subText) {
        const sub = document.createElement("div");
        sub.textContent = subText;
        sub.style.fontSize = "12px";
        sub.style.opacity = "0.75";
        t.append(sub);
      }

      t.onmouseenter = () => {
        if (t.dataset.disabled === "1") return;
        t.style.borderColor = "var(--sidebar-active-indicator)";
      };
      t.onmouseleave = () => {
        t.style.borderColor = "var(--card-border)";
      };

      t.addEventListener("click", async () => {
        if (t.dataset.disabled === "1") return;
        await onClick?.();
      });

      t.tabIndex = disabled ? -1 : 0;
      t.addEventListener("keydown", async (e) => {
        if (t.dataset.disabled === "1") return;
        if (e.key !== "Enter") return;
        e.preventDefault();
        await onClick?.();
      });

      return { tile: t, titleEl: title, subEl: subText ? t.lastChild : null };
    };

    if (isNewUi) {
      const tileLastProject = mkTile({
        titleText: "Letztes Projekt öffnen",
        subText: "Lade...",
        disabled: true,
        onClick: async () => {
          await this._openLastProject();
        },
      });
      this.lastProjectTileEl = tileLastProject.tile;
      this.lastProjectSubEl = tileLastProject.subEl;
      this.lastProjectId = null;

      const tileNewProject = mkTile({
        titleText: "Neues Projekt anlegen",
        onClick: async () => {
          await this._openCreateProject();
        },
      });

      const tileNewFirm = mkTile({
        titleText: "Neue Firma anlegen",
        onClick: async () => {
          await this._openCreateFirm();
        },
      });

      grid.append(tileLastProject.tile, tileNewProject.tile, tileNewFirm.tile);
    } else {
      const tileProjects = mkTile({
        titleText: "Projekte",
        onClick: async () => {
          await this.router?.showProjects?.();
        },
      });

      const tileFirms = mkTile({
        titleText: "Firmen",
        onClick: async () => {
          await this.router?.showFirms?.();
        },
      });

      const tileSettings = mkTile({
        titleText: "Einstellungen",
        onClick: async () => {
          await this.router?.showSettings?.();
        },
      });

      const tileArchive = mkTile({
        titleText: "Archiv",
        onClick: async () => {
          await this.router?.showArchive?.();
        },
      });

      grid.append(tileProjects.tile, tileFirms.tile, tileSettings.tile, tileArchive.tile);
    }

    const footerWrap = document.createElement("div");
    footerWrap.style.marginTop = "auto";
    footerWrap.style.alignSelf = "flex-start";
    footerWrap.style.paddingTop = "10px";

    const creditLine = document.createElement("div");
    creditLine.style.fontSize = "11px";
    creditLine.style.opacity = "0.8";
    creditLine.textContent = "Entwickelt von Steffen Bandholt - ";
    const creditMail = document.createElement("a");
    creditMail.href = "mailto:info@bandholt.de";
    creditMail.textContent = "info@bandholt.de";
    creditLine.appendChild(creditMail);

    const footer = document.createElement("div");
    footer.textContent = `\u00A9 ${new Date().getFullYear()} BBM alle Rechte vorbehalten`;
    footer.style.fontSize = "11px";
    footer.style.color = "#000";
    footer.style.userSelect = "none";

    this.footerEl = footer;
    footerWrap.append(creditLine, footer);
    contentWrap.append(head, grid, footerWrap);
    root.append(bgWrap, contentWrap);

    this.root = root;
    return root;
  }

  async load() {
    await this._loadLastProjectTile();
    try {
      const res = await window.bbmDb?.appGetVersion?.();
      const year = new Date().getFullYear();
      const v = res && res.ok && res.version ? ` v${res.version}` : "";
      if (this.footerEl) this.footerEl.textContent = `\u00A9 ${year} BBM${v} alle Rechte vorbehalten`;
    } catch (_e) {
      const year = new Date().getFullYear();
      if (this.footerEl) this.footerEl.textContent = `\u00A9 ${year} BBM alle Rechte vorbehalten`;
    }
  }
}
