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
    this._transferModalEl = null;
  }

  _cleanupProjectFormModal() {
    this._projectFormModal = null;
    if (this._projectFormPrevProjectId !== null) {
      this.router.currentProjectId = this._projectFormPrevProjectId;
    }
    this._projectFormPrevProjectId = null;
    this._transferModalEl = null;
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

  _closeProjectTransferModal() {
    if (this._transferModalEl) {
      try {
        this._transferModalEl.remove();
      } catch (_) {}
    }
    this._transferModalEl = null;
  }

  _formatBytes(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    if (n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  _formatDateTime(ms) {
    const d = new Date(Number(ms || 0));
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
  }

  async _openProjectTransferModal() {
    if (this._transferModalEl) return;

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
    box.style.width = "min(720px, calc(100vw - 32px))";
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
    title.textContent = "Projekt Import / Export";
    title.style.fontWeight = "800";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "X";
    applyPopupButtonStyle(btnClose);
    btnClose.style.marginLeft = "auto";
    btnClose.onclick = () => this._closeProjectTransferModal();

    header.append(title, btnClose);

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.minHeight = "0";
    body.style.overflow = "auto";
    body.style.padding = "12px 16px";

    const status = document.createElement("div");
    status.style.fontSize = "12px";
    status.style.opacity = "0.8";
    status.style.marginBottom = "10px";
    status.textContent = "";

    const exportBox = document.createElement("div");
    exportBox.style.border = "1px solid #e2e8f0";
    exportBox.style.borderRadius = "8px";
    exportBox.style.padding = "10px";
    exportBox.style.marginBottom = "12px";

    const exportTitle = document.createElement("div");
    exportTitle.textContent = "Projekt exportieren";
    exportTitle.style.fontWeight = "700";
    exportTitle.style.marginBottom = "8px";

    const exportHint = document.createElement("div");
    exportHint.textContent = "W?hlt ein Projekt und erstellt ein ZIP im Export-Ordner.";
    exportHint.style.fontSize = "12px";
    exportHint.style.opacity = "0.75";
    exportHint.style.marginBottom = "8px";

    const exportSelect = document.createElement("select");
    exportSelect.style.width = "100%";
    exportSelect.style.boxSizing = "border-box";
    exportSelect.style.padding = "6px 8px";
    exportSelect.style.border = "1px solid #ddd";
    exportSelect.style.borderRadius = "6px";

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "Export starten";
    applyPopupButtonStyle(exportBtn, { variant: "primary" });
    exportBtn.style.marginTop = "8px";

    const fillExportOptions = () => {
      exportSelect.innerHTML = "";
      const list = Array.isArray(this.projects) ? this.projects : [];
      if (!list.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Keine Projekte vorhanden";
        exportSelect.appendChild(opt);
        exportSelect.disabled = true;
        exportBtn.disabled = true;
        return;
      }
      exportSelect.disabled = false;
      exportBtn.disabled = false;
      for (const p of list) {
        const opt = document.createElement("option");
        opt.value = String(p?.id || "");
        const pn = this._getProjectNumber(p);
        opt.textContent = pn ? `${pn} - ${this._labelForTile(p)}` : this._labelForTile(p);
        exportSelect.appendChild(opt);
      }
    };
    fillExportOptions();

    exportBtn.onclick = async () => {
      const projectId = String(exportSelect.value || "").trim();
      if (!projectId) {
        status.textContent = "Bitte ein Projekt w?hlen.";
        return;
      }
      try {
        status.textContent = "Exportiere Projekt...";
        const api = window.bbmProjectTransfer || {};

    btnOpenExportDir.onclick = async () => {
      if (typeof api.openExportFolder !== "function") {
        status.textContent = "Export-Ordner ?ffnen ist nicht verf?gbar (Preload/IPC fehlt).";
        return;
      }
      const res = await api.openExportFolder();
      if (!res?.ok) {
        status.textContent = res?.error || "Export-Ordner konnte nicht ge?ffnet werden.";
        return;
      }
      if (res?.exportRoot) exportDirHint.textContent = `Export-Ordner: ${res.exportRoot}`;
    };
        if (typeof api.exportProject !== "function") {
          status.textContent = "Export ist nicht verf?gbar (Preload/IPC fehlt).";
          return;
        }
        const res = await api.exportProject({ projectId });
        if (!res?.ok) {
          status.textContent = res?.error || "Export fehlgeschlagen.";
          return;
        }
        status.textContent = "Export abgeschlossen.";
        await this.reloadProjects();
        fillExportOptions();
      } catch (err) {
        status.textContent = err?.message || "Export fehlgeschlagen.";
      }
    };

    exportBox.append(exportTitle, exportHint, exportSelect, exportBtn);

    const importBox = document.createElement("div");
    importBox.style.border = "1px solid #e2e8f0";
    importBox.style.borderRadius = "8px";
    importBox.style.padding = "10px";

    const importTitle = document.createElement("div");
    importTitle.textContent = "Projekt importieren";
    importTitle.style.fontWeight = "700";
    importTitle.style.marginBottom = "8px";

    const importHint = document.createElement("div");
    importHint.textContent = "Imports aus dem Export-Ordner der App.";
    importHint.style.fontSize = "12px";
    importHint.style.opacity = "0.75";
    importHint.style.marginBottom = "6px";

    const exportDirHint = document.createElement("div");
    exportDirHint.textContent = "Export-Ordner: -";
    exportDirHint.style.fontSize = "12px";
    exportDirHint.style.opacity = "0.7";
    exportDirHint.style.marginBottom = "6px";

    const exportDirActions = document.createElement("div");
    exportDirActions.style.display = "flex";
    exportDirActions.style.justifyContent = "flex-start";
    exportDirActions.style.marginBottom = "8px";

    const btnOpenExportDir = document.createElement("button");
    btnOpenExportDir.type = "button";
    btnOpenExportDir.textContent = "Ordner ?ffnen";
    applyPopupButtonStyle(btnOpenExportDir);

    exportDirActions.append(btnOpenExportDir);

    const importActions = document.createElement("div");
    importActions.style.display = "flex";
    importActions.style.gap = "8px";
    importActions.style.marginBottom = "8px";

    const importAllBtn = document.createElement("button");
    importAllBtn.type = "button";
    importAllBtn.textContent = "Alle importieren";
    applyPopupButtonStyle(importAllBtn);

    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.textContent = "Liste aktualisieren";
    applyPopupButtonStyle(refreshBtn);

    importActions.append(importAllBtn, refreshBtn);

    const importList = document.createElement("div");
    importList.style.display = "flex";
    importList.style.flexDirection = "column";
    importList.style.gap = "6px";

    const api = window.bbmProjectTransfer || {};

    btnOpenExportDir.onclick = async () => {
      if (typeof api.openExportFolder !== "function") {
        status.textContent = "Export-Ordner ?ffnen ist nicht verf?gbar (Preload/IPC fehlt).";
        return;
      }
      const res = await api.openExportFolder();
      if (!res?.ok) {
        status.textContent = res?.error || "Export-Ordner konnte nicht ge?ffnet werden.";
        return;
      }
      if (res?.exportRoot) exportDirHint.textContent = `Export-Ordner: ${res.exportRoot}`;
    };

    const loadExportList = async () => {
      importList.innerHTML = "";
      if (typeof api.listExports !== "function") {
        importList.textContent = "Export-Liste nicht verf?gbar (Preload/IPC fehlt).";
        importAllBtn.disabled = true;
        return [];
      }
      const res = await api.listExports();
      if (res?.exportRoot) exportDirHint.textContent = `Export-Ordner: ${res.exportRoot}`;
      if (!res?.ok) {
        importList.textContent = res?.error || "Export-Ordner konnte nicht gelesen werden.";
        importAllBtn.disabled = true;
        return [];
      }
      const list = Array.isArray(res.list) ? res.list : [];
      if (!list.length) {
        importList.textContent = "Keine Exportdateien gefunden.";
        importAllBtn.disabled = true;
        return [];
      }
      importAllBtn.disabled = false;
      for (const item of list) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "8px";
        row.style.border = "1px solid #eee";
        row.style.borderRadius = "6px";
        row.style.padding = "6px 8px";

        const label = document.createElement("div");
        label.style.flex = "1 1 auto";
        label.style.fontSize = "12px";
        const meta = `${this._formatDateTime(item.mtimeMs)} ? ${this._formatBytes(item.size)}`;
        label.textContent = `${item.fileName} (${meta})`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Import";
        applyPopupButtonStyle(btn, { variant: "primary" });
        btn.onclick = async () => {
          btn.disabled = true;
          status.textContent = `Importiere ${item.fileName}...`;
          const resImport = await api.importFromExport({ filePath: item.filePath });
          if (!resImport?.ok) {
            status.textContent = resImport?.error || "Import fehlgeschlagen.";
            btn.disabled = false;
            return;
          }
          status.textContent = `Import abgeschlossen: ${item.fileName}`;
          await this.reloadProjects();
          await loadExportList();
        };

        row.append(label, btn);
        importList.appendChild(row);
      }
      return list;
    };

    importAllBtn.onclick = async () => {
      importAllBtn.disabled = true;
      refreshBtn.disabled = true;
      status.textContent = "Importiere alle Exportdateien...";
      const list = await loadExportList();
      let okCount = 0;
      for (const item of list) {
        const resImport = await api.importFromExport({ filePath: item.filePath });
        if (resImport?.ok) okCount += 1;
      }
      await this.reloadProjects();
      await loadExportList();
      status.textContent = `Import abgeschlossen: ${okCount} Datei(en) erfolgreich.`;
      importAllBtn.disabled = false;
      refreshBtn.disabled = false;
    };

    refreshBtn.onclick = async () => {
      await loadExportList();
    };

    await loadExportList();

    importBox.append(importTitle, importHint, exportDirHint, exportDirActions, importActions, importList);

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.padding = "12px 16px";
    footer.style.borderTop = "1px solid #e2e8f0";

    const btnCloseBottom = document.createElement("button");
    btnCloseBottom.type = "button";
    btnCloseBottom.textContent = "Schlie?en";
    applyPopupButtonStyle(btnCloseBottom);
    btnCloseBottom.onclick = () => this._closeProjectTransferModal();

    footer.append(btnCloseBottom);

    body.append(status, exportBox, importBox);
    box.append(header, body, footer);
    overlay.appendChild(box);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this._closeProjectTransferModal();
    });

    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this._closeProjectTransferModal();
      }
    });

    document.body.appendChild(overlay);
    this._transferModalEl = overlay;
    try {
      overlay.focus();
    } catch (_e) {
      // ignore
    }
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

    // Projekt Import / Export Kachel
    const transferTile = mkTile();
    transferTile.style.background = "var(--card-bg)";
    transferTile.style.borderStyle = "dashed";

    const transferTitle = document.createElement("div");
    transferTitle.textContent = "Projekt Import / Export";
    transferTitle.style.fontWeight = "800";
    transferTitle.style.fontSize = "16px";
    transferTitle.style.marginBottom = "6px";

    const transferHint = document.createElement("div");
    transferHint.textContent = "Projekte sichern oder aus Exporten wiederherstellen";
    transferHint.style.opacity = "0.8";
    transferHint.style.fontSize = "12px";

    transferTile.append(transferTitle, transferHint);

    const openTransfer = async () => {
      await this._openProjectTransferModal();
    };

    transferTile.addEventListener("click", openTransfer);
    transferTile.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      openTransfer();
    });

    grid.appendChild(transferTile);

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
      btnEdit.style.padding = "0";
      btnEdit.style.border = "none";
      btnEdit.style.background = "transparent";
      btnEdit.style.color = "#0b61ff"; // kräftiges, leuchtendes Blau
      btnEdit.style.cursor = "pointer";
      btnEdit.style.fontSize = "12px";
      btnEdit.style.textDecoration = "underline";
      btnEdit.style.fontWeight = "600";
      btnEdit.style.letterSpacing = "0.15px";
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
    // Zuerst versuchen, ein offenes Protokoll wieder zu öffnen.
    const openedExisting = await this._openExistingMeetingIfAvailable(projectId);
    if (openedExisting) return true;

    // Falls keines offen ist, neues anlegen.
    return await this._createMeetingAndOpenTops(projectId, projectObj);
  }

  async _openExistingMeetingIfAvailable(projectId) {
    if (this._startingProject) return false;

    const api = window.bbmDb || {};
    if (typeof api.meetingsListByProject !== "function") return false;

    this._startingProject = true;
    this._setMsg("Öffne Projekt...");

    try {
      const res = await api.meetingsListByProject(projectId);
      if (!res?.ok) return false;
      const list = Array.isArray(res.list) ? res.list : [];
      const openMeetings = list.filter((m) => Number(m?.is_closed) !== 1);
      if (openMeetings.length === 0) return false;

      const pickLatest = (arr) =>
        arr.reduce((best, cur) => {
          const bestIdx = Number(best?.meeting_index ?? best?.meetingIndex ?? 0);
          const curIdx = Number(cur?.meeting_index ?? cur?.meetingIndex ?? 0);
          if (curIdx > bestIdx) return cur;
          if (curIdx === bestIdx) {
            const bestId = Number(best?.id ?? 0);
            const curId = Number(cur?.id ?? 0);
            return curId > bestId ? cur : best;
          }
          return best;
        }, openMeetings[0]);

      const meeting = pickLatest(openMeetings);
      if (!meeting?.id) return false;

      this.router.currentProjectId = projectId;
      this.router.currentMeetingId = meeting.id;
      await this.router.showTops(meeting.id, projectId);
      this._rememberLastProject(projectId);
      return true;
    } catch (err) {
      console.warn("[ProjectsView] _openExistingMeetingIfAvailable failed:", err);
      return false;
    } finally {
      this._startingProject = false;
      this._setMsg("");
    }
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
