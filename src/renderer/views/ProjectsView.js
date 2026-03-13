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
    this._transferModalBodyEl = null;
    this._transferModalStatusEl = null;
    this._transferModalCloseBtn = null;
    this._transferModalFooterCloseBtn = null;
    this._transferModalButtons = [];
    this._transferBusy = false;
    this._transferMode = "menu";
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

  _setTransferStatus(text) {
    if (!this._transferModalStatusEl) return;
    this._transferModalStatusEl.textContent = String(text || "");
  }

  _syncTransferButtonsBusy() {
    const dis = !!this._transferBusy;
    for (const btn of this._transferModalButtons || []) {
      if (!btn) continue;
      btn.disabled = dis;
      btn.style.opacity = dis ? "0.7" : "1";
      btn.style.cursor = dis ? "default" : "pointer";
    }
    if (this._transferModalCloseBtn) {
      this._transferModalCloseBtn.disabled = dis;
      this._transferModalCloseBtn.style.opacity = dis ? "0.7" : "1";
      this._transferModalCloseBtn.style.cursor = dis ? "default" : "pointer";
    }
    if (this._transferModalFooterCloseBtn) {
      this._transferModalFooterCloseBtn.disabled = dis;
      this._transferModalFooterCloseBtn.style.opacity = dis ? "0.7" : "1";
      this._transferModalFooterCloseBtn.style.cursor = dis ? "default" : "pointer";
    }
  }

  _registerTransferButton(btn) {
    if (!btn) return;
    this._transferModalButtons.push(btn);
    this._syncTransferButtonsBusy();
  }

  _resetTransferButtons() {
    this._transferModalButtons = [];
  }

  _setTransferBusy(on) {
    this._transferBusy = !!on;
    this._syncTransferButtonsBusy();
  }

  _closeTransferModal({ force = false } = {}) {
    if (!force && this._transferBusy) return;
    if (this._transferModalEl) {
      try {
        this._transferModalEl.remove();
      } catch (_e) {
        // ignore
      }
    }
    this._transferModalEl = null;
    this._transferModalBodyEl = null;
    this._transferModalStatusEl = null;
    this._transferModalCloseBtn = null;
    this._transferModalFooterCloseBtn = null;
    this._transferModalButtons = [];
    this._transferBusy = false;
    this._transferMode = "menu";
  }

  async _runTransferImport() {
    if (this._transferBusy) return;
    if (typeof window.bbmProjectTransfer?.importProject !== "function") {
      this._flashMsg("Import ist nicht verfuegbar (Preload/IPC fehlt).", 8000);
      return;
    }

    try {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".zip";
      fileInput.style.display = "none";

      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        const filePath = file?.path || "";
        if (!filePath) return;

        this._setTransferBusy(true);
        this._setTransferStatus("Importiere...");
        this._setMsg("Importiere...");

        try {
          const res = await window.bbmProjectTransfer.importProject(filePath);
          if (!res?.ok) {
            this._flashMsg(res?.error || "Import fehlgeschlagen.", 8000);
            return;
          }
          this._flashMsg("Projekt importiert.", 4000);
          await this.reloadProjects();
        } catch (err) {
          console.error("[ProjectsView] transfer import failed:", err);
          this._flashMsg("Import fehlgeschlagen.", 8000);
        } finally {
          this._setTransferStatus("");
          this._setTransferBusy(false);
          this._setMsg("");
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
      console.error("[ProjectsView] _runTransferImport failed:", err);
      this._flashMsg("Import konnte nicht gestartet werden.", 8000);
    }
  }

  async _runTransferExportForProject(projectId) {
    if (this._transferBusy) return;
    if (!projectId) return;
    if (typeof window.bbmProjectTransfer?.exportProject !== "function") {
      this._flashMsg("Export ist nicht verfuegbar (Preload/IPC fehlt).", 8000);
      return;
    }

    this._setTransferBusy(true);
    this._setTransferStatus("Exportiere...");
    this._setMsg("Exportiere...");

    try {
      const res = await window.bbmProjectTransfer.exportProject({ projectId });
      if (!res?.ok) {
        this._flashMsg(res?.error || "Export fehlgeschlagen.", 8000);
        return;
      }
      this._flashMsg("Export abgeschlossen.", 4000);
      await this.reloadProjects();
    } catch (err) {
      console.error("[ProjectsView] transfer export failed:", err);
      this._flashMsg("Export fehlgeschlagen.", 8000);
    } finally {
      this._setTransferStatus("");
      this._setTransferBusy(false);
      this._setMsg("");
    }
  }

  async _runTransferExportAll() {
    if (this._transferBusy) return;
    const hasBulkExport = typeof window.bbmProjectTransfer?.exportAllProjects === "function";
    const hasSingleExport = typeof window.bbmProjectTransfer?.exportProject === "function";
    if (!hasBulkExport && !hasSingleExport) {
      this._flashMsg("Export ist nicht verfuegbar (Preload/IPC fehlt).", 8000);
      return;
    }

    const list = Array.isArray(this.projects) ? this.projects.filter((p) => !!p?.id) : [];
    if (!list.length) {
      this._flashMsg("Keine Projekte zum Export vorhanden.", 5000);
      return;
    }

    this._setTransferBusy(true);
    this._setTransferStatus("Exportiere alle...");
    this._setMsg("Exportiere alle...");

    try {
      if (hasBulkExport) {
        const bulkRes = await window.bbmProjectTransfer.exportAllProjects();
        if (!bulkRes?.ok) {
          this._flashMsg(bulkRes?.error || "Export (Alle) fehlgeschlagen.", 8000);
          await this.reloadProjects();
          return;
        }
        this._flashMsg("Alle Projekte exportiert.", 5000);
        await this.reloadProjects();
        return;
      }

      let okCount = 0;
      for (const p of list) {
        const res = await window.bbmProjectTransfer.exportProject({ projectId: p.id });
        if (!res?.ok) {
          const label = this._labelFull(p);
          this._flashMsg(`${label}: ${res?.error || "Export fehlgeschlagen."}`, 9000);
          await this.reloadProjects();
          return;
        }
        okCount += 1;
      }

      this._flashMsg(`${okCount} Projekt(e) exportiert.`, 5000);
      await this.reloadProjects();
    } catch (err) {
      console.error("[ProjectsView] transfer export all failed:", err);
      this._flashMsg("Export (Alle) fehlgeschlagen.", 8000);
    } finally {
      this._setTransferStatus("");
      this._setTransferBusy(false);
      this._setMsg("");
    }
  }

  _renderTransferExportSelection() {
    if (!this._transferModalBodyEl) return;
    this._transferMode = "export";
    this._transferModalBodyEl.innerHTML = "";
    this._resetTransferButtons();

    const hint = document.createElement("div");
    hint.textContent = "Export: Projekt auswaehlen.";
    hint.style.fontSize = "12px";
    hint.style.opacity = "0.8";
    hint.style.marginBottom = "10px";

    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gap = "8px";

    const mkBtn = (text, onClick, { primary = false } = {}) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      applyPopupButtonStyle(btn, primary ? { variant: "primary" } : undefined);
      btn.style.textAlign = "left";
      btn.onclick = onClick;
      this._registerTransferButton(btn);
      return btn;
    };

    list.appendChild(
      mkBtn("Alle", async () => {
        await this._runTransferExportAll();
      }, { primary: true })
    );

    for (const p of this.projects || []) {
      const label = this._labelFull(p);
      const pn = this._getProjectNumber(p);
      const txt = pn ? `${label} (Nr.: ${pn})` : label;
      list.appendChild(
        mkBtn(txt, async () => {
          await this._runTransferExportForProject(p?.id || null);
        })
      );
    }

    const footer = document.createElement("div");
    footer.style.marginTop = "10px";
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";

    const btnBack = document.createElement("button");
    btnBack.type = "button";
    btnBack.textContent = "Zurueck";
    applyPopupButtonStyle(btnBack);
    btnBack.onclick = () => this._renderTransferMenu();
    this._registerTransferButton(btnBack);

    footer.appendChild(btnBack);
    this._transferModalBodyEl.append(hint, list, footer);
    this._syncTransferButtonsBusy();
  }

  _renderTransferMenu() {
    if (!this._transferModalBodyEl) return;
    this._transferMode = "menu";
    this._transferModalBodyEl.innerHTML = "";
    this._resetTransferButtons();

    const hint = document.createElement("div");
    hint.textContent = "Waehle eine Aktion:";
    hint.style.fontSize = "12px";
    hint.style.opacity = "0.8";
    hint.style.marginBottom = "10px";

    const actions = document.createElement("div");
    actions.style.display = "grid";
    actions.style.gap = "8px";

    const btnImport = document.createElement("button");
    btnImport.type = "button";
    btnImport.textContent = "Import";
    applyPopupButtonStyle(btnImport, { variant: "primary" });
    btnImport.onclick = async () => {
      await this._runTransferImport();
    };
    this._registerTransferButton(btnImport);

    const btnExport = document.createElement("button");
    btnExport.type = "button";
    btnExport.textContent = "Export";
    applyPopupButtonStyle(btnExport);
    btnExport.onclick = () => this._renderTransferExportSelection();
    this._registerTransferButton(btnExport);

    actions.append(btnImport, btnExport);
    this._transferModalBodyEl.append(hint, actions);
    this._syncTransferButtonsBusy();
  }

  _openTransferModal() {
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
    box.style.width = "min(320px, calc(100vw - 32px))";
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
    title.textContent = "Projekt-Transfer";
    title.style.fontWeight = "800";

    const status = document.createElement("div");
    status.style.marginLeft = "auto";
    status.style.fontSize = "12px";
    status.style.opacity = "0.85";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "X";
    applyPopupButtonStyle(btnClose);
    btnClose.onclick = () => this._closeTransferModal();

    header.append(title, status, btnClose);

    const body = document.createElement("div");
    body.style.flex = "1 1 auto";
    body.style.minHeight = "0";
    body.style.overflow = "auto";
    body.style.padding = "12px 16px";

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.padding = "10px 16px";
    footer.style.borderTop = "1px solid #e2e8f0";

    const btnFooterClose = document.createElement("button");
    btnFooterClose.type = "button";
    btnFooterClose.textContent = "Schließen";
    applyPopupButtonStyle(btnFooterClose);
    btnFooterClose.onclick = () => this._closeTransferModal();
    footer.appendChild(btnFooterClose);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this._closeTransferModal();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this._closeTransferModal();
      }
    });

    box.append(header, body, footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    this._transferModalEl = overlay;
    this._transferModalBodyEl = body;
    this._transferModalStatusEl = status;
    this._transferModalCloseBtn = btnClose;
    this._transferModalFooterCloseBtn = btnFooterClose;
    this._transferBusy = false;
    this._transferMode = "menu";
    this._resetTransferButtons();

    this._renderTransferMenu();
    this._syncTransferButtonsBusy();
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
      if (this._transferModalEl && this._transferMode === "export") {
        this._renderTransferExportSelection();
      }
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

    const openProjectTransfer = async () => {
      if (this.loading || this._startingProject) return;
      this._openTransferModal();
    };

    // Projekt-Transfer Kachel
    const transferTile = mkTile();
    transferTile.style.background = "var(--card-bg)";
    transferTile.style.borderStyle = "dashed";

    const transferTitle = document.createElement("div");
    transferTitle.textContent = "Projekt-Transfer";
    transferTitle.style.fontWeight = "800";
    transferTitle.style.fontSize = "16px";
    transferTitle.style.marginBottom = "6px";

    const transferHint = document.createElement("div");
    transferHint.textContent = "Import und Export zentral";
    transferHint.style.opacity = "0.8";
    transferHint.style.fontSize = "12px";

    transferTile.append(transferTitle, transferHint);

    transferTile.addEventListener("click", openProjectTransfer);
    transferTile.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      openProjectTransfer();
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
    this._closeTransferModal({ force: true });

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
