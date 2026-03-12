// src/renderer/views/ProjectsView.js
//
// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.1
//
// Projekte-Kacheln:

import { applyPopupButtonStyle } from "../ui/popupButtonStyles.js";
// - Klick auf Kachel: legt IMMER eine neue Besprechung an und öffnet TopsView
// - Edit: öffnet Projektedit (ProjectFormView)  ✅ robust gegen Bubble
// - Projektnummer: eigene Zeile

const LAST_PROJECT_KEY = "bbm.lastProjectId";
const CREATE_MEETING_EDIT_PARTICIPANTS_KEY = "bbm.createMeeting.editParticipants";

export default class ProjectsView {
  constructor({ router }) {
    this.router = router;

    this.root = null;
    this.hostEl = null;
    this.msgEl = null;

    this.projects = [];
    this.loading = false;
    this._startingProject = false;

    this._msgTimer = null;
    this._createMeetingModalEl = null;
    this._createMeetingModalResolve = null;
    this._projectFormModal = null;
    this._projectFormPrevProjectId = null;
  }

  _cleanupProjectFormModal() {
    this._projectFormModal = null;
    if (this._projectFormPrevProjectId !== null) {
      this.router.currentProjectId = this._projectFormPrevProjectId;
    }
    this._projectFormPrevProjectId = null;
  }

  async _openProjectFormModal({ projectId } = {}) {
    if (this._projectFormModal) return;

    try {
      this._projectFormPrevProjectId = this.router.currentProjectId || null;
      const mod = await import("../views/ProjectFormView.js");
      const ProjectFormView = mod.default;

      this.router.currentProjectId = projectId || null;
      this.router.currentMeetingId = null;

      const view = new ProjectFormView({
        router: this.router,
        projectId: projectId || null,
        mode: "modal",
        onClose: () => this._cleanupProjectFormModal(),
        onSaved: async () => {
          await this.reloadProjects();
          this._cleanupProjectFormModal();
        },
      });

      this._projectFormModal = view;
      view.render();
      await view.load();
      view.openModal();
    } catch (err) {
      console.error("[ProjectsView] Project modal failed:", err);
      this._cleanupProjectFormModal();
    }
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  _setMsg(t) {
    if (!this.msgEl) return;
    this.msgEl.textContent = t || "";
  }

  _flashMsg(text, ms = 3500) {
    const t = String(text || "").trim();
    if (!t) return;

    if (this._msgTimer) {
      clearTimeout(this._msgTimer);
      this._msgTimer = null;
    }

    this._setMsg(t);

    this._msgTimer = setTimeout(() => {
      if (this.msgEl && this.msgEl.textContent === t) this._setMsg("");
      this._msgTimer = null;
    }, Math.max(600, Number(ms || 0)));
  }

  _getProjectNumber(p) {
    if (!p) return "";
    const v = p.project_number ?? p.projectNumber ?? "";
    const s = v === null || v === undefined ? "" : String(v).trim();
    return s;
  }

  _labelForTile(p) {
    if (!p) return "(ohne Name)";
    const short = String(p.short || "").trim();
    const name = String(p.name || "").trim();
    return short || name || "(ohne Name)";
  }

  _labelFull(p) {
    if (!p) return "(ohne Name)";
    const short = String(p.short || "").trim();
    const name = String(p.name || "").trim();
    if (short && name) return `${short} - ${name}`;
    return name || short || "(ohne Name)";
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

  _todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  _addDaysISO(iso, days) {
    const s = String(iso || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + Number(days || 0));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  _isoToDDMMYYYY(iso) {
    const s = String(iso || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    const y = s.slice(0, 4);
    const m = s.slice(5, 7);
    const d = s.slice(8, 10);
    return `${d}.${m}.${y}`;
  }

  _extractDateISOFromMeeting(m) {
    if (!m) return null;

    const raw =
      m.meeting_date || m.meetingDate || m.date || m.created_at || m.createdAt || null;

    if (raw) {
      const s = String(raw).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    }

    const title = m.title ? String(m.title) : "";

    const hitIso = title.match(/(\d{4}-\d{2}-\d{2})/);
    if (hitIso && hitIso[1]) return hitIso[1];

    const hitDE = title.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (hitDE) {
      const dd = hitDE[1];
      const mm = hitDE[2];
      const yyyy = hitDE[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    const hitDE2 = title.match(/(\d{2})\.(\d{2})\.(\d{2})/);
    if (hitDE2) {
      const dd = hitDE2[1];
      const mm = hitDE2[2];
      const yy = Number(hitDE2[3]);
      const yyyy = yy <= 69 ? 2000 + yy : 1900 + yy;
      return `${String(yyyy).padStart(4, "0")}-${mm}-${dd}`;
    }

    return null;
  }

  _closeCreateMeetingModal(result) {
    if (this._createMeetingModalEl) {
      try {
        this._createMeetingModalEl.remove();
      } catch (_) {}
    }
    this._createMeetingModalEl = null;

    if (this._createMeetingModalResolve) {
      const resolve = this._createMeetingModalResolve;
      this._createMeetingModalResolve = null;
      resolve(result || null);
    }
  }

  _openCreateMeetingModal({ dateISO }) {
    if (this._createMeetingModalEl) {
      this._closeCreateMeetingModal(null);
    }

    return new Promise((resolve) => {
      this._createMeetingModalResolve = resolve;

      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.left = "0";
      overlay.style.top = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.background = "rgba(0,0,0,0.35)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "9999";
      overlay.tabIndex = -1;

      const box = document.createElement("div");
      box.style.background = "#fff";
      box.style.borderRadius = "10px";
      box.style.border = "1px solid rgba(0,0,0,0.15)";
      box.style.width = "min(560px, calc(100vw - 32px))";
      box.style.maxHeight = "calc(100vh - 32px)";
      box.style.display = "flex";
      box.style.flexDirection = "column";
      box.style.overflow = "hidden";
      box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";

      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.gap = "10px";
      header.style.padding = "12px 16px";
      header.style.borderBottom = "1px solid #e2e8f0";

      const title = document.createElement("div");
      title.textContent = "Protokoll anlegen";
      title.style.fontWeight = "800";

      const btnClose = document.createElement("button");
      btnClose.type = "button";
      btnClose.textContent = "X";
      applyPopupButtonStyle(btnClose);
      btnClose.style.marginLeft = "auto";
      btnClose.onclick = () => this._closeCreateMeetingModal(null);

      header.append(title, btnClose);

      const body = document.createElement("div");
      body.style.flex = "1 1 auto";
      body.style.minHeight = "0";
      body.style.overflow = "auto";
      body.style.padding = "12px 16px";

      const labDate = document.createElement("label");
      labDate.textContent = "Datum";
      labDate.style.display = "block";
      labDate.style.fontSize = "12px";
      labDate.style.opacity = "0.8";
      labDate.style.marginBottom = "4px";

      const inpDate = document.createElement("input");
      inpDate.type = "date";
      inpDate.value = /^\d{4}-\d{2}-\d{2}$/.test(String(dateISO || "")) ? dateISO : "";
      inpDate.style.width = "100%";
      inpDate.style.boxSizing = "border-box";
      inpDate.style.padding = "6px 8px";
      inpDate.style.border = "1px solid #ddd";
      inpDate.style.borderRadius = "6px";
      inpDate.style.marginBottom = "10px";

      const labKeyword = document.createElement("label");
      labKeyword.textContent = "Schlagwort (optional)";
      labKeyword.style.display = "block";
      labKeyword.style.fontSize = "12px";
      labKeyword.style.opacity = "0.8";
      labKeyword.style.marginBottom = "4px";

      const inpKeyword = document.createElement("input");
      inpKeyword.type = "text";
      inpKeyword.value = "";
      inpKeyword.style.width = "100%";
      inpKeyword.style.boxSizing = "border-box";
      inpKeyword.style.padding = "6px 8px";
      inpKeyword.style.border = "1px solid #ddd";
      inpKeyword.style.borderRadius = "6px";

      const participantsOptionRow = document.createElement("label");
      participantsOptionRow.style.display = "flex";
      participantsOptionRow.style.alignItems = "center";
      participantsOptionRow.style.gap = "8px";
      participantsOptionRow.style.marginTop = "12px";
      participantsOptionRow.style.cursor = "pointer";

      const chkEditParticipants = document.createElement("input");
      chkEditParticipants.type = "checkbox";
      chkEditParticipants.checked = this._readCreateMeetingEditParticipantsDefault();
      chkEditParticipants.style.margin = "0";

      const participantsOptionText = document.createElement("span");
      participantsOptionText.textContent = "Teilnehmerliste bearbeiten";

      participantsOptionRow.append(chkEditParticipants, participantsOptionText);

      const btnRow = document.createElement("div");
      btnRow.style.display = "flex";
      btnRow.style.justifyContent = "flex-end";
      btnRow.style.gap = "8px";
      btnRow.style.padding = "12px 16px";
      btnRow.style.borderTop = "1px solid #e2e8f0";

      const btnCancel = document.createElement("button");
      btnCancel.type = "button";
      btnCancel.textContent = "Abbrechen";
      applyPopupButtonStyle(btnCancel);

      const btnCreate = document.createElement("button");
      btnCreate.type = "button";
      btnCreate.textContent = "Anlegen";
      applyPopupButtonStyle(btnCreate, { variant: "primary" });

      btnCancel.onclick = () => this._closeCreateMeetingModal(null);
      btnCreate.onclick = () =>
        this._closeCreateMeetingModal({
          dateISO: String(inpDate.value || "").trim(),
          keyword: String(inpKeyword.value || "").trim(),
          editParticipants: chkEditParticipants.checked,
        });

      const submitCreate = () =>
        this._closeCreateMeetingModal({
          dateISO: String(inpDate.value || "").trim(),
          keyword: String(inpKeyword.value || "").trim(),
          editParticipants: chkEditParticipants.checked,
        });

      inpDate.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        submitCreate();
      });
      inpKeyword.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        submitCreate();
      });

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) this._closeCreateMeetingModal(null);
      });

      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          this._closeCreateMeetingModal(null);
        }
      });

      btnRow.append(btnCancel, btnCreate);
      body.append(labDate, inpDate, labKeyword, inpKeyword, participantsOptionRow);
      box.append(header, body, btnRow);
      overlay.appendChild(box);

      document.body.appendChild(overlay);
      this._createMeetingModalEl = overlay;
      try {
        overlay.focus();
      } catch (_e) {
        // ignore
      }

      try {
        inpDate.focus();
      } catch (_) {}
    });
  }

  // ------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------
  render() {
    const root = document.createElement("div");

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";
    head.style.marginBottom = "10px";

    const h = document.createElement("h2");
    h.textContent = "Projekte";
    h.style.margin = "0";

    const msg = document.createElement("div");
    msg.style.marginLeft = "auto";
    msg.style.fontSize = "12px";
    msg.style.opacity = "0.85";

    head.append(h, msg);

    const host = document.createElement("div");

    root.append(head, host);

    this.root = root;
    this.hostEl = host;
    this.msgEl = msg;

    this._renderGrid();

    return root;
  }

  async load() {
    await this.reloadProjects();
  }

  async openCreateProject() {
    if (this.loading || this._startingProject) return false;

    this.router.currentProjectId = null;
    this.router.currentMeetingId = null;

    await this._openProjectFormModal({ projectId: null });
    return true;
  }

  async openProjectById(projectId) {
    if (this.loading) return false;
    if (this._startingProject) {
      // Safety net: falls der Start-Flag hängengeblieben ist, freigeben und neu versuchen.
      this._startingProject = false;
    }

    const wanted = String(projectId ?? "").trim();
    if (!wanted) {
      this._flashMsg("Projekt kann nicht geöffnet werden: id fehlt.", 7000);
      return false;
    }

    let project = (this.projects || []).find((p) => String(p?.id ?? "") === wanted) || null;
    if (!project) {
      await this.reloadProjects();
      project = (this.projects || []).find((p) => String(p?.id ?? "") === wanted) || null;
    }

    if (!project || !project.id) {
      this._flashMsg("Projekt wurde nicht gefunden.", 7000);
      return false;
    }

    if (this._isNewUiMode()) {
      return await this._openProjectInNewMode(project.id, project);
    }

    // Alt-Modus: unveränderter bisheriger Klickpfad.
    return await this._createMeetingAndOpenTops(project.id, project);
  }

  _rememberLastProject(projectId) {
    const id = String(projectId ?? "").trim();
    if (!id) return;
    try {
      window.localStorage?.setItem?.(LAST_PROJECT_KEY, id);
    } catch (_e) {
      // ignore
    }
  }

  _readCreateMeetingEditParticipantsDefault() {
    try {
      const raw = String(
        window.localStorage?.getItem?.(CREATE_MEETING_EDIT_PARTICIPANTS_KEY) || ""
      ).trim().toLowerCase();
      if (raw === "0" || raw === "false") return false;
      if (raw === "1" || raw === "true") return true;
    } catch (_e) {
      // ignore
    }
    return true;
  }

  _writeCreateMeetingEditParticipants(value) {
    try {
      window.localStorage?.setItem?.(
        CREATE_MEETING_EDIT_PARTICIPANTS_KEY,
        value ? "1" : "0"
      );
    } catch (_e) {
      // ignore
    }
  }

  async reloadProjects() {
    this.loading = true;
    this._setMsg("Lade...");

    try {
      const api = window.bbmDb || {};
      if (typeof api.projectsList !== "function") {
        this.projects = [];
        this._flashMsg("projectsList ist nicht verfügbar (Preload/IPC fehlt).", 9000);
        return;
      }

      const res = await api.projectsList();
      if (!res?.ok) {
        this.projects = [];
        this._flashMsg(res?.error || "Fehler beim Laden", 9000);
        return;
      }

      this.projects = res.list || [];
      this._setMsg("");
    } finally {
      this.loading = false;
      this._renderGrid();
    }
  }

  // ------------------------------------------------------------
  // Grid
  // ------------------------------------------------------------
  _renderGrid() {
    if (!this.hostEl) return;

    this.hostEl.innerHTML = "";

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(220px, 1fr))";
    grid.style.gap = "10px";
    grid.style.alignItems = "stretch";

    const mkTile = () => {
      const t = document.createElement("div");
      t.style.border = "1px solid var(--card-border)";
      t.style.borderRadius = "10px";
      t.style.background = "var(--card-bg)";
      t.style.color = "var(--text-main)";
      t.style.padding = "12px";
      t.style.boxSizing = "border-box";
      t.style.cursor = "pointer";
      t.style.userSelect = "none";
      t.style.position = "relative";
      t.tabIndex = 0;

      t.onmouseenter = () => {
        if (this.loading || this._startingProject) return;
        t.style.borderColor = "var(--sidebar-active-indicator)";
      };
      t.onmouseleave = () => {
        t.style.borderColor = "var(--card-border)";
      };

      return t;
    };

    // + Projekt anlegen
    const createTile = mkTile();
    createTile.style.background = "var(--card-bg)";
    createTile.style.borderStyle = "dashed";

    const createTitle = document.createElement("div");
    createTitle.textContent = "+ Projekt anlegen";
    createTitle.style.fontWeight = "800";
    createTitle.style.fontSize = "16px";
    createTitle.style.marginBottom = "6px";

    const createHint = document.createElement("div");
    createHint.textContent = "Stammdaten erfassen";
    createHint.style.opacity = "0.8";
    createHint.style.fontSize = "12px";

    createTile.append(createTitle, createHint);

    const openCreate = async () => {
      await this.openCreateProject();
    };

    createTile.addEventListener("click", openCreate);
    createTile.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      openCreate();
    });

    grid.appendChild(createTile);

    const runImportFlow = async () => {
      try {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".zip";
        fileInput.style.display = "none";
        fileInput.onchange = async () => {
          const file = fileInput.files?.[0];
          const filePath = file?.path || "";
          if (!filePath) return;
          try {
            const res = await window.bbmProjectTransfer?.importProject(filePath);
            if (!res?.ok) {
              this._flashMsg(res?.error || "Import fehlgeschlagen.", 8000);
              return;
            }
            this._flashMsg("Projekt importiert.", 4000);
            await this.reloadProjects();
          } catch (errImport) {
            console.error("[ProjectsView] Projektimport failed:", errImport);
            this._flashMsg("Import fehlgeschlagen.", 8000);
          }
        };
        document.body.appendChild(fileInput);
        fileInput.click();
        setTimeout(() => {
          try {
            document.body.removeChild(fileInput);
          } catch (_e) {
            // ignore
          }
        }, 1000);
      } catch (err) {
        console.error("[ProjectsView] runImportFlow failed:", err);
        this._flashMsg("Import konnte nicht gestartet werden.", 8000);
      }
    };

    // Projekt importieren Kachel
    const importTile = mkTile();
    importTile.style.background = "var(--card-bg)";
    importTile.style.borderStyle = "dashed";

    const importTitle = document.createElement("div");
    importTitle.textContent = "Projekt importieren";
    importTitle.style.fontWeight = "800";
    importTitle.style.fontSize = "16px";
    importTitle.style.marginBottom = "6px";

    const importHint = document.createElement("div");
    importHint.textContent = "ZIP auswählen und wiederherstellen";
    importHint.style.opacity = "0.8";
    importHint.style.fontSize = "12px";

    importTile.append(importTitle, importHint);

    importTile.addEventListener("click", runImportFlow);
    importTile.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      runImportFlow();
    });

    grid.appendChild(importTile);

    // Projektkacheln
    for (const p of this.projects || []) {
      const tile = mkTile();

      const pn = this._getProjectNumber(p);

      const pnLine = document.createElement("div");
      pnLine.style.fontSize = "12px";
      pnLine.style.opacity = "0.9";
      pnLine.style.marginBottom = "6px";
      pnLine.style.whiteSpace = "nowrap";
      pnLine.textContent = pn ? `Nr.: ${pn}` : "";
      pnLine.style.display = pn ? "block" : "none";

      const title = document.createElement("div");
      title.textContent = this._labelForTile(p);
      title.style.fontWeight = "900";
      title.style.fontSize = "18px";
      title.style.marginBottom = "6px";

      const subtitle = document.createElement("div");
      subtitle.style.opacity = "0.85";
      subtitle.style.fontSize = "12px";
      subtitle.style.minHeight = "16px";

      const hasShort = String(p.short || "").trim().length > 0;
      const name = String(p.name || "").trim();
      subtitle.textContent = hasShort ? name : String(p.city || "").trim();

      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.textContent = "Edit";
      btnEdit.className = "bbm-btn-edit";
      btnEdit.style.position = "absolute";
      btnEdit.style.top = "10px";
      btnEdit.style.right = "10px";
      btnEdit.style.padding = "4px 8px";
      btnEdit.style.borderRadius = "8px";
      btnEdit.style.border = "1px solid #ddd";
      btnEdit.style.background = "#f3f3f3";
      btnEdit.style.cursor = "pointer";
      btnEdit.style.fontSize = "12px";
      btnEdit.style.zIndex = "5";
      btnEdit.style.pointerEvents = "auto";

      const stop = (e) => {
        try {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        } catch (_) {}
      };
      btnEdit.addEventListener("pointerdown", stop);
      btnEdit.addEventListener("mousedown", stop);

      btnEdit.addEventListener("click", async (e) => {
        stop(e);

        if (this.loading || this._startingProject) return;

        const pid = p?.id || null;
        if (!pid) {
          this._flashMsg("Projekt hat keine ID (id fehlt).", 7000);
          return;
        }

        this.router.currentProjectId = pid;
        this.router.currentMeetingId = null;

        await this._openProjectFormModal({ projectId: pid });
      });

      const openProject = async () => {
        await this.openProjectById(p?.id || null);
      };

      tile.addEventListener("click", (e) => {
        openProject();
      });

      tile.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        e.stopPropagation();
        openProject();
      });

      tile.append(btnEdit, pnLine, title, subtitle);
      grid.appendChild(tile);
    }

    this.hostEl.appendChild(grid);

    if (this.loading) {
      const hint = document.createElement("div");
      hint.textContent = "Lade Projekte...";
      hint.style.opacity = "0.8";
      hint.style.marginTop = "10px";
      this.hostEl.appendChild(hint);
    }
  }

  // ------------------------------------------------------------
  // Project click flow: Offene Besprechung öffnen, sonst anlegen
  // ------------------------------------------------------------
  async _openProjectInNewMode(projectId, projectObj) {
    // Reuse der bestehenden Logik: offene Besprechung verwenden, sonst neu anlegen und Tops öffnen.
    return await this._createMeetingAndOpenTops(projectId, projectObj);
  }

  async _createMeetingAndOpenTops(projectId, projectObj) {
    if (this._startingProject) return false;

    let result = false;
    this._startingProject = true;
    this._setMsg("Öffne Projekt...");

    try {
      this.router.currentProjectId = projectId;
      this.router.currentMeetingId = null;

      const api = window.bbmDb || {};
      if (typeof api.meetingsCreate !== "function") {
        this._flashMsg("meetingsCreate ist nicht verfügbar (Preload/IPC fehlt).", 9000);
        // Fallback: trotzdem TopsView im Idle-State öffnen
        await this.router.showTops(null, projectId);
        this._rememberLastProject(projectId);
        return true;
      }

      // Dialog zum Anlegen des Protokolls (Datum/Schlagwort/Teilnehmer-Option)
      const modalRes = await this._openCreateMeetingModal({ dateISO: this._todayISO() });
      if (!modalRes) return false; // abgebrochen

      let dateISO = String(modalRes.dateISO || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) dateISO = this._todayISO();
      const keyword = String(modalRes.keyword || "").trim();
      const editParticipants = modalRes.editParticipants !== false;
      this._writeCreateMeetingEditParticipants(editParticipants);

      // nächsten Index ermitteln
      let nextIndex = 1;
      if (typeof api.meetingsListByProject === "function") {
        try {
          const res = await api.meetingsListByProject(projectId);
          if (res?.ok) {
            const list = res.list || [];
            const maxIdx = list.reduce((mx, x) => Math.max(mx, Number(x.meeting_index || 0)), 0);
            nextIndex = (maxIdx || 0) + 1;
          }
        } catch (errList) {
          console.warn("[ProjectsView] meetingsListByProject failed:", errList);
        }
      }

      const dd = this._isoToDDMMYYYY(dateISO);
      const idx = `#${nextIndex}`;
      const title = keyword ? `${idx} ${dd} - ${keyword}` : `${idx} ${dd}`;

      this._setMsg("Protokoll wird angelegt...");
      let meetingId = null;
      try {
        const createRes = await api.meetingsCreate({ projectId, title });
        if (!createRes?.ok || !createRes.meeting?.id) {
          this._flashMsg(createRes?.error || "Besprechung konnte nicht angelegt werden.", 9000);
        } else {
          meetingId = createRes.meeting.id;
        }
      } catch (errCreate) {
        console.error("[ProjectsView] meetingsCreate threw", errCreate);
        this._flashMsg(errCreate?.message || String(errCreate), 9000);
      }

      // Wenn Anlage fehlgeschlagen: TopsView trotzdem im Idle-State öffnen
      if (!meetingId) {
        this._setMsg("Öffne Protokoll...");
        await this.router.showTops(null, projectId);
        this._rememberLastProject(projectId);
        return false;
      }

      this.router.currentProjectId = projectId;
      this.router.currentMeetingId = meetingId;

      this._setMsg("Öffne Protokoll...");

      await this.router.showTops(meetingId, projectId);

      this._rememberLastProject(projectId);
      result = true;

      // optional Teilnehmer direkt öffnen
      if (editParticipants && typeof this.router.openParticipantsModal === "function") {
        try {
          await this.router.openParticipantsModal({ projectId, meetingId });
        } catch (errParticipants) {
          console.warn("[ProjectsView] openParticipantsModal failed:", errParticipants);
        }
      }
    } catch (err) {
      console.error("[ProjectsView] _createMeetingAndOpenTops failed:", err);
      this._flashMsg(err?.message || String(err), 9000);
      result = false;
    } finally {
      this._startingProject = false;
      this._setMsg("");
    }

    return result;
  }

  destroy() {
    if (this._msgTimer) {
      clearTimeout(this._msgTimer);
      this._msgTimer = null;
    }

    this._closeCreateMeetingModal(null);

    if (this._projectFormModal) {
      try {
        if (typeof this._projectFormModal.destroy === "function") {
          this._projectFormModal.destroy();
        } else if (typeof this._projectFormModal._closeModal === "function") {
          this._projectFormModal._closeModal();
        }
      } catch (_e) {
        // ignore
      }
    }

    this._cleanupProjectFormModal();
  }
}
