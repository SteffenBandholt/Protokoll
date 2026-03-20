// src/renderer/ui/pages/ProjectsPageA.js

export default class ProjectsPageA {
  constructor({ router } = {}) {
    this.router = router || null;

    this.root = null;
    this.gridEl = null;
    this.statusEl = null;

    this.projects = [];
    this.loading = false;
  }

  _projectTitle(project) {
    if (!project) return "(ohne Name)";
    const short = String(project.short || "").trim();
    const name = String(project.name || "").trim();
    return short || name || "(ohne Name)";
  }

  _projectMeta(project) {
    if (!project) return "";
    const numberRaw = project.project_number ?? project.projectNumber ?? "";
    const number = String(numberRaw || "").trim();
    const city = String(project.city || "").trim();

    if (number && city) return `Nr. ${number} - ${city}`;
    if (number) return `Nr. ${number}`;
    return city;
  }

  _setStatus(text) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text || "";
  }

  _renderProjects() {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = "";

    if (this.loading) {
      const loadingCard = document.createElement("div");
      loadingCard.className = "card";
      loadingCard.textContent = "Lade Projekte...";
      this.gridEl.appendChild(loadingCard);
      return;
    }

    if (!this.projects.length) {
      const emptyCard = document.createElement("div");
      emptyCard.className = "card";

      const emptyTitle = document.createElement("div");
      emptyTitle.className = "project-card-title";
      emptyTitle.textContent = "Noch keine Projekte";

      const emptyMeta = document.createElement("div");
      emptyMeta.className = "project-card-meta";
      emptyMeta.textContent =
        "Lege ein neues Projekt an, um hier eine \u00dcbersicht zu sehen.";

      emptyCard.append(emptyTitle, emptyMeta);
      this.gridEl.appendChild(emptyCard);
      return;
    }

    const canShowMeetings = typeof this.router?.showMeetings === "function";

    for (const project of this.projects) {
      const card = document.createElement("div");
      card.className = "card project-card-a";

      const title = document.createElement("div");
      title.className = "project-card-title";
      title.textContent = this._projectTitle(project);

      const meta = document.createElement("div");
      meta.className = "project-card-meta";
      meta.textContent = this._projectMeta(project);

      card.append(title, meta);

      if (canShowMeetings) {
        const actions = document.createElement("div");
        actions.className = "project-card-actions";

        const btnOpen = document.createElement("button");
        btnOpen.type = "button";
        btnOpen.className = "btn";
        btnOpen.textContent = "Protokolle";

        btnOpen.addEventListener("click", async () => {
          const projectId = project?.id || null;
          if (!projectId) return;
          await this.router.showMeetings(projectId);
        });

        actions.appendChild(btnOpen);
        card.appendChild(actions);
      }

      this.gridEl.appendChild(card);
    }
  }

  async _loadProjects() {
    this.loading = true;
    this._setStatus("");
    this._renderProjects();

    try {
      const api = window.bbmDb || {};
      if (typeof api.projectsList !== "function") {
        this.projects = [];
        this._setStatus("projectsList ist nicht verf\u00fcgbar.");
        return;
      }

      const res = await api.projectsList();
      if (!res?.ok) {
        this.projects = [];
        this._setStatus(res?.error || "Fehler beim Laden der Projekte.");
        return;
      }

      this.projects = Array.isArray(res.list) ? res.list : [];
      this._setStatus("");
    } catch (err) {
      this.projects = [];
      this._setStatus(err?.message || "Fehler beim Laden der Projekte.");
    } finally {
      this.loading = false;
      this._renderProjects();
    }
  }

  render() {
    const root = document.createElement("div");
    root.className = "page-stack";

    const header = document.createElement("div");
    header.className = "page-header-a";

    const titleWrap = document.createElement("div");
    titleWrap.className = "page-title-wrap";

    const title = document.createElement("div");
    title.className = "page-title";
    title.textContent = "Projekte";

    const subtitle = document.createElement("div");
    subtitle.className = "page-subtitle";
    subtitle.textContent =
      "\u00dcbersicht und schneller Zugriff auf vorhandene Projekte.";

    titleWrap.append(title, subtitle);

    const actions = document.createElement("div");

    const btnNew = document.createElement("button");
    btnNew.type = "button";
    btnNew.className = "btn btn-primary";
    btnNew.textContent = "+ Neues Projekt";

    const canOpenProjectForm = typeof this.router?.showProjectForm === "function";
    btnNew.disabled = !canOpenProjectForm;
    btnNew.addEventListener("click", async () => {
      if (!canOpenProjectForm) return;
      await this.router.showProjectForm({ projectId: null });
    });

    actions.appendChild(btnNew);
    header.append(titleWrap, actions);

    const status = document.createElement("div");
    status.className = "page-subtitle";

    const grid = document.createElement("div");
    grid.className = "project-grid-a";

    root.append(header, status, grid);

    this.root = root;
    this.gridEl = grid;
    this.statusEl = status;

    this._renderProjects();

    return root;
  }

  async load() {
    await this._loadProjects();
  }
}
