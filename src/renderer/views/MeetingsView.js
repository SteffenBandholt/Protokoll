// src/renderer/views/MeetingsView.js

export default class MeetingsView {
  constructor({ router, projectId, printSelectionMode = false, printKind = null }) {
    this.router = router;
    this.projectId = projectId;
    this.printSelectionMode = !!printSelectionMode;
    this.printKind = printKind === "todo" ? "todo" : (printKind === "firms" ? "firms" : null);

    this.root = null;
    this.listEl = null;
    this.projectTitleEl = null;
    this.btnBackToTops = null;
    this.selectionHintEl = null;
    this.searchInput = null;
    this.btnSearch = null;
    this.btnFilterToggle = null;
    this.btnTopListAll = null;

    this.meetings = [];
    this.closedMeetings = [];
    this.openMeetingId = null;
    this.filterEnabled = false;
    this.searchText = "";
    this.filteredMeetings = null;
    this.filterBusy = false;
    this.filterSeq = 0;
    this.selectedMeetingId = null;
    this._lastClickAt = 0;
    this._lastClickId = null;
    this._printBusy = false;
  }

  _updateBackButtonState() {
    if (!this.btnBackToTops) return;
    this.btnBackToTops.disabled = false;
  }

  _setProjectTitle(label) {
    if (!this.projectTitleEl) return;
    this.projectTitleEl.textContent = label || `#${this.projectId}`;
  }

  _printKindLabel() {
    if (this.printKind === "todo") return "ToDo-Liste";
    if (this.printKind === "firms") return "Firmenliste";
    return "Druck";
  }

  async _selectClosedMeetingForPrint(meeting) {
    if (!this.printSelectionMode) return;
    if (!meeting || Number(meeting.is_closed) !== 1) return;
    if (this._printBusy) return;

    this._printBusy = true;
    try {
      if (typeof this.router?.completePrintSelection === "function") {
        await this.router.completePrintSelection({
          projectId: this.projectId,
          meetingId: meeting.id,
        });
      }
    } finally {
      this._printBusy = false;
    }
  }

  async _loadProjectLabel() {
    const api = window.bbmDb || {};
    if (typeof api.projectsList !== "function") {
      this._setProjectTitle(`#${this.projectId}`);
      return;
    }

    const res = await api.projectsList();
    if (!res?.ok) {
      this._setProjectTitle(`#${this.projectId}`);
      return;
    }

    const list = res.list || [];
    const p = list.find((x) => x.id === this.projectId) || null;
    const short = (p && String(p.short || "").trim()) || "";
    const name = (p && String(p.name || "").trim()) || "";
    this._setProjectTitle(short || name || `#${this.projectId}`);
  }

  render() {
    const root = document.createElement("div");

    // ===== Header =====
    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.gap = "8px";
    head.style.alignItems = "center";
    head.style.marginBottom = "10px";

    const btnBackToTops = document.createElement("button");
    btnBackToTops.textContent = this.printSelectionMode ? "Abbrechen" : "Zur\u00fcck zum Protokoll";
    btnBackToTops.onclick = () => {
      if (this.printSelectionMode) {
        if (typeof this.router?.cancelPrintSelection === "function") {
          this.router.cancelPrintSelection({ restore: true });
          return;
        }
        this.router.showMeetings(this.projectId);
        return;
      }
      if (this.openMeetingId) {
        this.router.showTops(this.openMeetingId, this.projectId);
        return;
      }
      this.router.showProjects();
    };

    const h = document.createElement("h2");
    h.textContent = `#${this.projectId}`;
    h.style.margin = "0";

    head.append(btnBackToTops, h);

    // ===== Suche/Filter =====
    const searchRow = document.createElement("div");
    searchRow.style.display = "flex";
    searchRow.style.gap = "8px";
    searchRow.style.alignItems = "center";
    searchRow.style.margin = "10px 0";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Schlagwort suchen…";
    searchInput.maxLength = 50;
    searchInput.style.minWidth = "320px";
    searchInput.style.flex = "0 1 360px";
    searchInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      const raw = (searchInput.value || "").slice(0, 50);
      searchInput.value = raw;
      this.searchText = raw.trim();
      this.filterEnabled = true;
      this._updateFilterToggleText();
      this._applyFilter();
    });

    const btnSearch = document.createElement("button");
    btnSearch.textContent = "Suchen";
    btnSearch.onclick = () => {
      const raw = (searchInput.value || "").slice(0, 50);
      searchInput.value = raw;
      this.searchText = raw.trim();
      this.filterEnabled = true;
      this._updateFilterToggleText();
      this._applyFilter();
    };

    const btnFilterToggle = document.createElement("button");
    btnFilterToggle.textContent = "Filter an";
    btnFilterToggle.onclick = () => {
      this.filterEnabled = !this.filterEnabled;
      if (this.filterEnabled) {
        const raw = (searchInput.value || "").slice(0, 50);
        searchInput.value = raw;
        this.searchText = raw.trim();
      } else {
        searchInput.value = "";
        this.searchText = "";
      }
      this._updateFilterToggleText();
      this._applyFilter();
    };

    const btnPdf = document.createElement("button");
    btnPdf.textContent = "PDF";
    btnPdf.onclick = () => {
      this._openSelectedPdfPreview();
    };

    const btnTopListAll = document.createElement("button");
    btnTopListAll.textContent = "Top-Liste(alle)";
    btnTopListAll.onclick = () => {
      this._openTopListAllPreview();
    };

    const searchActions = document.createElement("div");
    searchActions.style.display = "flex";
    searchActions.style.gap = "8px";
    searchActions.append(btnSearch, btnFilterToggle, btnPdf, btnTopListAll);

    searchRow.style.flexWrap = "wrap";
    searchRow.style.justifyContent = "flex-start";
    searchRow.append(searchInput, searchActions);

    // ===== Liste =====
    const list = document.createElement("ul");
    list.style.paddingLeft = "0";

    const selectionHint = document.createElement("div");
    selectionHint.style.display = this.printSelectionMode ? "block" : "none";
    selectionHint.style.margin = "0 0 10px 0";
    selectionHint.style.padding = "8px 10px";
    selectionHint.style.border = "1px solid #b6d4ff";
    selectionHint.style.borderRadius = "8px";
    selectionHint.style.background = "#eef7ff";
    selectionHint.style.color = "#0b4db4";
    selectionHint.style.fontSize = "13px";
    selectionHint.textContent = this.printSelectionMode
      ? `Geschlossene Besprechung ausw\u00e4hlen (${this._printKindLabel()})`
      : "";

    root.append(head, selectionHint, searchRow, list);

    this.root = root;
    this.listEl = list;
    this.projectTitleEl = h;
    this.btnBackToTops = btnBackToTops;
    this.selectionHintEl = selectionHint;
    this.searchInput = searchInput;
    this.btnSearch = btnSearch;
    this.btnFilterToggle = btnFilterToggle;
    this.btnPdf = btnPdf;
    this.btnTopListAll = btnTopListAll;

    this._updateBackButtonState();
    this._updateFilterToggleText();
    if (this.printSelectionMode && this.btnPdf) {
      this.btnPdf.disabled = true;
      this.btnPdf.style.opacity = "0.55";
      this.btnPdf.style.cursor = "not-allowed";
      this.btnPdf.title = "Im Auswahlmodus nicht verf\u00fcgbar";
    }
    if (this.printSelectionMode && this.btnTopListAll) {
      this.btnTopListAll.disabled = true;
      this.btnTopListAll.style.opacity = "0.55";
      this.btnTopListAll.style.cursor = "not-allowed";
      this.btnTopListAll.title = "Im Auswahlmodus nicht verf\u00fcgbar";
    }

    return root;
  }

  async load() {
    await this._loadProjectLabel();
    await this.reloadList();
  }

  async reloadList() {
    const res = await window.bbmDb.meetingsListByProject(this.projectId);
    if (!res?.ok) {
      this.listEl.textContent = res?.error || "Fehler beim Laden";
      return;
    }

    const sortValue = (m) => {
      const raw =
        m.meeting_date || m.meetingDate || m.date || m.created_at || m.createdAt || null;
      if (raw) {
        const t = Date.parse(String(raw));
        if (!Number.isNaN(t)) return t;
      }
      return Number(m.meeting_index || 0) || 0;
    };

    const list = res.list || [];
    this.meetings = list
      .slice()
      .sort(
        (a, b) =>
          sortValue(b) - sortValue(a) || Number(b.meeting_index || 0) - Number(a.meeting_index || 0)
      );
    this.closedMeetings = this.meetings.filter((m) => Number(m.is_closed) === 1);
    this.openMeetingId =
      this.meetings.find((m) => Number(m.is_closed) === 0)?.id || null;
    if (!this.closedMeetings.some((m) => m.id === this.selectedMeetingId)) {
      this.selectedMeetingId = null;
    }
    this.renderList();
    this._updateBackButtonState();
    this._applyFilter();
  }

  _updateFilterToggleText() {
    if (!this.btnFilterToggle) return;
    this.btnFilterToggle.textContent = this.filterEnabled ? "Filter aus" : "Filter an";
  }

  async _applyFilter() {
    if (!this.filterEnabled) {
      this.filteredMeetings = null;
      this.filterBusy = false;
      this.renderList();
      return;
    }

    const term = (this.searchText || "").trim().toLowerCase();
    const closed = this.closedMeetings || [];

    if (!term) {
      this.filteredMeetings = closed;
      this.filterBusy = false;
      this.renderList();
      return;
    }

    const seq = ++this.filterSeq;
    this.filterBusy = true;
    this.filteredMeetings = [];
    this.renderList();

    const api = window.bbmDb || {};
    if (typeof api.topsListByMeeting !== "function") {
      this.filterBusy = false;
      this.filteredMeetings = [];
      this.renderList();
      return;
    }

    const results = [];
    for (const m of closed) {
      try {
        const res = await api.topsListByMeeting(m.id);
        if (!res?.ok) continue;
        const tops = res.list || [];
        const hit = tops.some((t) => {
          const title = (t.title ? String(t.title) : "").toLowerCase();
          const longtext = (t.longtext ? String(t.longtext) : "").toLowerCase();
          return title.includes(term) || longtext.includes(term);
        });
        if (hit) results.push(m);
      } catch (_e) {
        // ignore
      }

      if (seq !== this.filterSeq) return;
    }

    if (seq !== this.filterSeq) return;
    this.filteredMeetings = results;
    this.filterBusy = false;
    this.renderList();
  }

  async _openSelectedPdfPreview() {
    if (this._printBusy) return;

    const mid = this.selectedMeetingId || null;
    if (!mid) {
      alert("Bitte zuerst ein Protokoll auswählen.");
      return;
    }

    const meeting = (this.meetings || []).find((m) => m.id === mid) || null;
    if (!meeting) {
      alert("Besprechung nicht gefunden.");
      return;
    }

    const isClosed = Number(meeting.is_closed) === 1;

    this._printBusy = true;
    try {
      if (!isClosed) {
        if (typeof this.router?.openPrintVorabzug === "function") {
          await this.router.openPrintVorabzug({
            projectId: this.projectId,
            meetingId: meeting.id,
          });
          return;
        }
        alert("PrintModal unterstützt keinen Vorabzug (openPrintVorabzug fehlt).");
        return;
      }

      if (typeof this.router?.openMeetingPrintPreview === "function") {
        await this.router.openMeetingPrintPreview({
          projectId: this.projectId,
          meetingId: meeting.id,
          mode: "closed",
        });
        return;
      }

      alert("PrintModal unterstützt keine Protokoll-Vorschau (openMeetingPrintPreview fehlt).");
    } finally {
      this._printBusy = false;
      if (typeof this.router?.closePrintModal === "function") {
        await this.router.closePrintModal({ keepPreview: true });
      }
    }
  }

  async _openTopListAllPreview() {
    if (this._printBusy) return;

    this._printBusy = true;
    try {
      if (typeof this.router?.openTopListAllPrintPreview === "function") {
        await this.router.openTopListAllPrintPreview({
          projectId: this.projectId,
        });
        return;
      }
      alert("PrintModal unterstützt keine Top-Liste(alle)-Vorschau (openTopListAllPrintPreview fehlt).");
    } finally {
      this._printBusy = false;
      if (typeof this.router?.closePrintModal === "function") {
        await this.router.closePrintModal({ keepPreview: true });
      }
    }
  }

  renderList() {
    const list = this.listEl;
    list.innerHTML = "";

    const base = this.closedMeetings || [];
    const visible = this.filterEnabled
      ? this.filteredMeetings || []
      : base;

    if (!visible.length) {
      const empty = document.createElement("li");
      empty.style.listStyle = "none";
      empty.style.padding = "8px 8px";
      empty.style.margin = "4px 0";
      empty.style.color = "var(--text-muted, #666)";
      empty.style.cursor = "default";
      empty.textContent = this.filterEnabled && this.searchText
        ? "Keine Treffer in geschlossenen Protokollen."
        : "Keine geschlossenen Protokolle vorhanden.";
      list.appendChild(empty);
      return;
    }

    for (const m of visible) {
      const li = document.createElement("li");
      li.style.listStyle = "none";
      li.style.padding = "6px 8px";
      li.style.margin = "4px 0";
      li.style.borderRadius = "6px";
      li.style.background = "#f3f3f3";
      li.style.border = "1px solid transparent";
      li.style.fontWeight = "normal";
      li.style.cursor = "pointer";

      const closed = Number(m.is_closed) === 1;
      const selectableInPrintMode = !this.printSelectionMode || closed;
      const title = m.title ? String(m.title) : "(ohne Titel)";
      const titleHasIndex = /^#\d+\b/.test(title);
      const displayTitle = titleHasIndex
        ? title
        : title === "(ohne Titel)"
          ? `#${m.meeting_index}`
          : `#${m.meeting_index} – ${title}`;
      li.textContent = displayTitle;
      const isSelected = !this.printSelectionMode && this.selectedMeetingId && m.id === this.selectedMeetingId;
      const baseBg = "#f3f3f3";
      li.style.background = isSelected ? "#eaf3ff" : baseBg;
      li.style.cursor = selectableInPrintMode ? "pointer" : "not-allowed";

      if (isSelected) {
        li.style.border = "1px solid #b6d4ff";
      }

      li.tabIndex = selectableInPrintMode ? 0 : -1;
      li.addEventListener("mouseenter", () => {
        if (!selectableInPrintMode) return;
        if (isSelected) return;
        li.style.background = "#eaf3ff";
        li.style.border = "1px solid #b6d4ff";
      });
      li.addEventListener("mouseleave", () => {
        if (!selectableInPrintMode) return;
        if (isSelected) return;
        li.style.background = baseBg;
        li.style.border = "1px solid transparent";
      });
      li.addEventListener("click", () => {
        if (this.printSelectionMode) {
          if (!closed) return;
          this._selectClosedMeetingForPrint(m);
          return;
        }

        const now = Date.now();
        const isDouble = this._lastClickId === m.id && now - this._lastClickAt < 500;
        this._lastClickAt = now;
        this._lastClickId = m.id;

        if (isDouble) {
          try {
            const r = this.router?.showTops?.(m.id, this.projectId);
            if (r && typeof r.catch === "function") {
              r.catch(() => {});
            }
          } catch (_err) {
            // ignore
          }
          return;
        }

        this.selectedMeetingId = m.id;
        this.renderList();
      });
      li.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        e.stopPropagation();
        if (this.printSelectionMode) {
          if (!closed) return;
          this._selectClosedMeetingForPrint(m);
          return;
        }
        this.router.showTops(m.id, this.projectId);
      });

      list.appendChild(li);
    }
  }
}
