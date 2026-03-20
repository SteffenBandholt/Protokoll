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

  _formatProtocolDateForName(dateValue) {
    const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(d.getTime())) return { dot: "", iso: "" };
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return {
      dot: `${dd}.${mm}.${yyyy}`,
      iso: `${yyyy}-${mm}-${dd}`,
    };
  }

  _sanitizeProtocolFilePart(value) {
    return String(value || "")
      .replace(/[<>:"/\\|?*]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async _loadProjectForStoredPdf() {
    const api = window.bbmDb || {};
    if (typeof api.projectsList !== "function") return null;
    const res = await api.projectsList();
    if (!res?.ok) return null;
    const list = res.list || [];
    return list.find((item) => item.id === this.projectId) || null;
  }

  async _loadProtocolSettingsForStoredPdf() {
    const api = window.bbmDb || {};
    let merged = { ...(this.router?.context?.settings || {}) };
    if (typeof api.appSettingsGetMany === "function") {
      const res = await api.appSettingsGetMany(["pdf.protocolsDir", "pdf.protocolTitle"]);
      if (res?.ok && res.data) {
        merged = { ...merged, ...(res.data || {}) };
      }
    }
    return merged;
  }

  _buildExpectedProtocolFileNames({ project, protocolTitle, meeting }) {
    const projectNumber = this._sanitizeProtocolFilePart(
      project?.project_number ?? project?.projectNumber ?? project?.number ?? ""
    );
    const projectShort = this._sanitizeProtocolFilePart(project?.short || project?.name || "");
    const protocolName = this._sanitizeProtocolFilePart(protocolTitle || "Baubesprechung");
    const meetingIndex =
      meeting?.meeting_index ?? meeting?.meetingIndex ?? meeting?.index ?? meeting?.number ?? "";
    const dateParts = this._formatProtocolDateForName(
      meeting?.meeting_date ||
        meeting?.meetingDate ||
        meeting?.date ||
        meeting?.created_at ||
        meeting?.createdAt ||
        meeting?.updated_at ||
        meeting?.updatedAt ||
        ""
    );

    const candidates = [];
    if (projectNumber && protocolName && meetingIndex && dateParts.iso) {
      candidates.push(`${projectNumber}_${protocolName}_#${meetingIndex}-${dateParts.iso}.pdf`);
    }
    if (projectNumber && projectShort && protocolName && meetingIndex && dateParts.dot) {
      candidates.push(
        `${projectNumber}_${projectShort}_${protocolName}_#${meetingIndex} - ${dateParts.dot}.pdf`
      );
    }
    return candidates;
  }

  async _openStoredProtocolPreview(meeting) {
    const printApi = window.bbmPrint || {};
    if (typeof printApi.findStoredProtocolPdf !== "function") {
      return false;
    }

    const settings = await this._loadProtocolSettingsForStoredPdf();
    const baseDir = String(settings?.["pdf.protocolsDir"] || "").trim();
    if (!baseDir) {
      alert("Speicherort Protokolle ist nicht gesetzt.");
      return true;
    }

    const project = await this._loadProjectForStoredPdf();
    if (!project) {
      return false;
    }

    const protocolTitle = String(settings?.["pdf.protocolTitle"] || "").trim() || "Baubesprechung";
    const meetingIndex =
      meeting?.meeting_index ?? meeting?.meetingIndex ?? meeting?.index ?? meeting?.number ?? "";

    const found = await printApi.findStoredProtocolPdf({
      baseDir,
      project: {
        project_number: project?.project_number ?? project?.projectNumber ?? project?.number ?? "",
        short: project?.short || "",
        name: project?.name || "",
      },
      expectedFileNames: this._buildExpectedProtocolFileNames({
        project,
        protocolTitle,
        meeting,
      }),
      meetingIndex,
    });

    if (!found?.ok || !found?.filePath) {
      const details = found?.expectedFileNames?.length
        ? `\nErwartet: ${found.expectedFileNames.join(" | ")}`
        : "";
      alert((found?.error || "PDF nicht gefunden.") + details + (found?.dir ? `\nOrdner: ${found.dir}` : ""));
      return true;
    }

    if (typeof this.router?.openStoredProtocolPreview !== "function") {
      return false;
    }

    await this.router.openStoredProtocolPreview({
      filePath: found.filePath,
      title: "Protokoll (Vorschau)",
    });
    return true;
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
    root.className = "page-stack";

    // ===== Header =====
    const head = document.createElement("div");
    head.className = "page-header-a";

    const titleWrap = document.createElement("div");
    titleWrap.className = "page-title-wrap";

    const btnBackToTops = document.createElement("button");
    btnBackToTops.textContent = this.printSelectionMode ? "Abbrechen" : "zum Protokoll:";
    btnBackToTops.className = "btn";
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

    const title = document.createElement("div");
    title.className = "page-title";
    title.textContent = "Protokolle";

    const subtitle = document.createElement("div");
    subtitle.className = "page-subtitle";
    subtitle.textContent = `#${this.projectId}`;

    titleWrap.append(title, subtitle);

    const headActions = document.createElement("div");
    headActions.className = "meetings-header-actions";
    headActions.append(btnBackToTops);

    head.append(titleWrap, headActions);

    // ===== Suche/Filter =====
    const searchRow = document.createElement("div");
    searchRow.className = "meetings-search-row";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Schlagwort suchen...";
    searchInput.maxLength = 50;
    searchInput.className = "meetings-search-input";
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
    btnSearch.className = "btn";
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
    btnFilterToggle.className = "btn";
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

    const searchActions = document.createElement("div");
    searchActions.className = "meetings-search-actions";
    searchActions.append(btnSearch, btnFilterToggle);

    searchRow.append(searchInput, searchActions);

    // ===== Liste =====
    const list = document.createElement("ul");
    list.className = "meetings-list";

    const selectionHint = document.createElement("div");
    selectionHint.style.display = this.printSelectionMode ? "block" : "none";
    selectionHint.className = "meetings-selection-hint";
    selectionHint.textContent = this.printSelectionMode
      ? `Geschlossene Besprechung auswählen (${this._printKindLabel()})`
      : "";

    root.append(head, selectionHint, searchRow, list);

    this.root = root;
    this.listEl = list;
    this.projectTitleEl = subtitle;
    this.btnBackToTops = btnBackToTops;
    this.selectionHintEl = selectionHint;
    this.searchInput = searchInput;
    this.btnSearch = btnSearch;
    this.btnFilterToggle = btnFilterToggle;
    this.btnPdf = null;

    this._updateBackButtonState();
    this._updateFilterToggleText();
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
    const base = this.closedMeetings || [];

    if (!term) {
      this.filteredMeetings = base;
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
    for (const m of base) {
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

  getSelectedClosedMeetingForEmail() {
    const mid = this.selectedMeetingId || null;
    if (!mid) return null;
    return (this.closedMeetings || []).find((m) => m && m.id === mid) || null;
  }

  async _openSelectedPdfPreview() {
    if (this._printBusy) return;

    const mid = this.selectedMeetingId || null;
    if (!mid) {
      alert("Bitte ein Protokoll auswählen.");
      return;
    }

    this._printBusy = true;
    try {
      await this._openPdfPreviewForMeeting(mid);
    } finally {
      this._printBusy = false;
      if (typeof this.router?.closePrintModal === "function") {
        await this.router.closePrintModal({ keepPreview: true });
      }
    }
  }

  async _openPdfPreviewForMeeting(meetingId) {
    const mid = meetingId || null;
    if (!mid) {
      alert("Bitte ein Protokoll auswählen.");
      return false;
    }

    const meeting = (this.meetings || []).find((m) => m.id === mid) || null;
    if (!meeting) {
      alert("Besprechung nicht gefunden.");
      return false;
    }

    const isClosed = Number(meeting.is_closed) === 1;
    if (!isClosed) {
      if (typeof this.router?.openPrintVorabzug === "function") {
        await this.router.openPrintVorabzug({
          projectId: this.projectId,
          meetingId: meeting.id,
        });
        return true;
      }
      alert("PrintModal unterstützt keinen Vorabzug (openPrintVorabzug fehlt).");
      return false;
    }

    const handledStoredPdf = await this._openStoredProtocolPreview(meeting);
    if (handledStoredPdf) {
      return true;
    }

    if (typeof this.router?.openMeetingPrintPreview === "function") {
      await this.router.openMeetingPrintPreview({
        projectId: this.projectId,
        meetingId: meeting.id,
        mode: "closed",
      });
      return true;
    }

    alert("PrintModal unterstützt keine Protokoll-Vorschau (openMeetingPrintPreview fehlt).");
    return false;
  }

  async printSelectedProtocolPreviewFromHeader() {
    const mid = this.selectedMeetingId || null;
    if (!mid) {
      alert("Bitte ein Protokoll auswählen.");
      return { handled: true, ok: false };
    }
    if (this._printBusy) {
      return { handled: true, ok: false };
    }

    this._printBusy = true;
    try {
      const ok = await this._openPdfPreviewForMeeting(mid);
      return { handled: true, ok: !!ok };
    } catch (_e) {
      return { handled: true, ok: false };
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
    const formatMeetingLabel = (meeting) => {
      const idx = Number(meeting?.meeting_index || 0);
      const raw = String(meeting?.title || "").trim();
      const prefixed = raw.match(/^#(\d+)\s*[-–]?\s*(.*)$/);
      if (prefixed) {
        const nr = Number(prefixed[1] || 0) || idx;
        const rest = String(prefixed[2] || "").trim();
        return rest ? `#${nr} - ${rest}` : `#${nr}`;
      }
      if (!raw) return `#${idx}`;
      return `#${idx} - ${raw}`;
    };

    const base = this.closedMeetings || [];
    const visible = this.filterEnabled
      ? this.filteredMeetings || []
      : base;

    if (!visible.length) {
      const empty = document.createElement("li");
      empty.className = "meetings-empty";
      empty.textContent = this.filterEnabled && this.searchText
        ? "Keine Treffer in Protokollen."
        : "Keine Protokolle vorhanden.";
      list.appendChild(empty);
      return;
    }

    for (const m of visible) {
      const li = document.createElement("li");
      li.className = "meetings-item";

      const closed = Number(m.is_closed) === 1;
      const selectableInPrintMode = !this.printSelectionMode || closed;
      const displayTitle = formatMeetingLabel(m);
      const isOpen = false;
      li.textContent = "";
      const titleLine = document.createElement("div");
      titleLine.textContent = `${displayTitle}${closed ? " (geschlossen)" : ""}`;
      li.appendChild(titleLine);

      if (closed) li.classList.add("is-closed");
      if (this.printSelectionMode && !closed) li.classList.add("is-disabled");
      const isSelected = !this.printSelectionMode && this.selectedMeetingId && m.id === this.selectedMeetingId;

      if (isSelected) {
        li.classList.add("is-selected");
      }
      if (isOpen) {
        li.classList.add("is-open");
      }

      li.tabIndex = selectableInPrintMode ? 0 : -1;
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
            const r = this.router?.showTops?.(m.id, this.projectId, { readOnly: true });
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
        this.router.showTops(m.id, this.projectId, { readOnly: true });
      });

      list.appendChild(li);
    }
  }
}
