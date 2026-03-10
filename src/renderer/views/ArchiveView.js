// src/renderer/views/ArchiveView.js
//
// Archivierte Projekte:
// - Liste archivierter Projekte (Kacheln)
// - "Aktivieren": archived_at = NULL
// - "Löschen": Hard Delete inkl. aller abhängigen Daten (1x confirm)

import { applyPopupButtonStyle } from "../ui/popupButtonStyles.js";

export default class ArchiveView {
  constructor({ router } = {}) {
    this.router = router || null;

    this.root = null;
    this.hostEl = null;
    this.msgEl = null;

    this.loading = false;
    this.busyProjectId = null;

    this.projects = [];
    this._msgTimer = null;
  }

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

  _formatArchivedAt(p) {
    const raw = p?.archived_at ?? p?.archivedAt ?? null;
    if (!raw) return "";
    const s = String(raw);
    const iso = s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const y = iso.slice(0, 4);
      const m = iso.slice(5, 7);
      const d = iso.slice(8, 10);
      return `${d}.${m}.${y}`;
    }
    return s;
  }

  render() {
    const root = document.createElement("div");

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "10px";
    head.style.marginBottom = "10px";

    const h = document.createElement("h2");
    h.textContent = "Archiviert";
    h.style.margin = "0";

    const hasActiveProject = !!(this.router?.currentProjectId || this.router?.lastTopsProjectId);
    const btnBackToProject = document.createElement("button");
    btnBackToProject.type = "button";
    btnBackToProject.textContent = "Zurück zum Protokoll";
    btnBackToProject.disabled = !hasActiveProject;
    applyPopupButtonStyle(btnBackToProject, { variant: "neutral" });
    btnBackToProject.onclick = async () => {
      const projectId =
        this.router?.currentProjectId || this.router?.lastTopsProjectId || null;
      const meetingId =
        this.router?.currentMeetingId || this.router?.lastTopsMeetingId || null;
      if (!projectId) return;
      if (meetingId && typeof this.router?.showTops === "function") {
        await this.router.showTops(meetingId, projectId);
        return;
      }
      if (typeof this.router?.showMeetings === "function") {
        await this.router.showMeetings(projectId);
      }
    };

    const msg = document.createElement("div");
    msg.style.marginLeft = "auto";
    msg.style.fontSize = "12px";
    msg.style.opacity = "0.85";

    head.append(h, btnBackToProject, msg);

    const host = document.createElement("div");

    root.append(head, host);

    this.root = root;
    this.hostEl = host;
    this.msgEl = msg;

    this._renderGrid();

    return root;
  }

  async load() {
    await this.reload();
  }

  async reload() {
    this.loading = true;
    this._setMsg("Lade...");

    try {
      const api = window.bbmDb || {};
      if (typeof api.projectsListArchived !== "function") {
        this.projects = [];
        this._flashMsg("projectsListArchived ist nicht verfügbar (Preload/IPC fehlt).", 9000);
        return;
      }

      const res = await api.projectsListArchived();
      if (!res?.ok) {
        this.projects = [];
        this._flashMsg(res?.error || "Fehler beim Laden", 9000);
        return;
      }

      this.projects = res.list || [];
      this._setMsg("");
    } finally {
      this.loading = false;
      this.busyProjectId = null;
      this._renderGrid();
    }
  }

  _renderGrid() {
    if (!this.hostEl) return;

    this.hostEl.innerHTML = "";

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(260px, 1fr))";
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
      t.style.userSelect = "none";
      t.style.position = "relative";
      return t;
    };

    if (!this.loading && (!this.projects || this.projects.length === 0)) {
      const empty = document.createElement("div");
      empty.style.opacity = "0.75";
      empty.textContent = "Keine archivierten Projekte.";
      this.hostEl.appendChild(empty);
      return;
    }

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

      const meta = document.createElement("div");
      meta.style.opacity = "0.8";
      meta.style.fontSize = "12px";
      const archivedAt = this._formatArchivedAt(p);
      meta.textContent = archivedAt ? `Archiviert am: ${archivedAt}` : "Archiviert";

      const btnRow = document.createElement("div");
      btnRow.style.display = "flex";
      btnRow.style.gap = "8px";
      btnRow.style.marginTop = "12px";

      const btnUnarchive = document.createElement("button");
      btnUnarchive.type = "button";
      btnUnarchive.textContent = "Aktivieren";
      btnUnarchive.dataset.variant = "primary";

      const btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.textContent = "Löschen";
      btnDelete.dataset.variant = "danger";

      const pid = p?.id || null;
      const isBusy = !!pid && this.busyProjectId === pid;

      const applyBusy = (busy) => {
        const dis = !!busy || this.loading;
        btnUnarchive.disabled = dis;
        btnDelete.disabled = dis;
      };

      applyBusy(isBusy);

      btnUnarchive.addEventListener("click", async () => {
        if (!pid) return;
        if (this.loading || this.busyProjectId) return;

        const api = window.bbmDb || {};
        if (typeof api.projectsUnarchive !== "function") {
          alert("projectsUnarchive ist nicht verfügbar (Preload/IPC fehlt).");
          return;
        }

        this.busyProjectId = pid;
        this._setMsg("Aktiviere...");
        this._renderGrid();

        try {
          const res = await api.projectsUnarchive(pid);
          if (!res?.ok) {
            alert(res?.error || "Aktivieren fehlgeschlagen");
            return;
          }
          await this.reload();
        } finally {
          this._setMsg("");
          this.busyProjectId = null;
          this._renderGrid();
        }
      });

      btnDelete.addEventListener("click", async () => {
        if (!pid) return;
        if (this.loading || this.busyProjectId) return;

        const ok = confirm(
          "Projekt endgültig löschen?\n\nDas entfernt auch alle Besprechungen, TOPs und Teilnehmer/Verantwortliche.\nDieser Vorgang kann nicht rückgängig gemacht werden."
        );
        if (!ok) return;

        const api = window.bbmDb || {};
        if (typeof api.projectsDeleteForever !== "function") {
          alert("projectsDeleteForever ist nicht verfügbar (Preload/IPC fehlt).");
          return;
        }

        this.busyProjectId = pid;
        this._setMsg("Lösche...");
        this._renderGrid();

        try {
          const res = await api.projectsDeleteForever(pid);
          if (!res?.ok) {
            alert(res?.error || "Löschen fehlgeschlagen");
            return;
          }
          await this.reload();
        } finally {
          this._setMsg("");
          this.busyProjectId = null;
          this._renderGrid();
        }
      });

      btnRow.append(btnUnarchive, btnDelete);

      tile.append(pnLine, title, meta, btnRow);
      grid.appendChild(tile);
    }

    this.hostEl.appendChild(grid);

    if (this.loading) {
      const hint = document.createElement("div");
      hint.textContent = "Lade archivierte Projekte...";
      hint.style.opacity = "0.8";
      hint.style.marginTop = "10px";
      this.hostEl.appendChild(hint);
    }
  }
}
