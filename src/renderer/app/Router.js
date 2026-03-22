// src/renderer/app/Router.js

export default class Router {
  constructor({ contentRoot, onSectionChange } = {}) {
    this.contentRoot = contentRoot;
    this.onSectionChange = onSectionChange;

    this.currentProjectId = null;
    this.currentMeetingId = null;
    this.lastTopsProjectId = null;
    this.lastTopsMeetingId = null;

    this.refreshHeader = null;

    this.context = this.context || {};
    this.context.settings = this.context.settings || {};
    this.context.projectLabel = this.context.projectLabel || null;

    // UI flags for header
    this.context.ui = this.context.ui || {};
    this.context.ui.isTopsView = !!this.context.ui.isTopsView;
    this.context.ui.pageTitle = this.context.ui.pageTitle || null;

    this._appSettingsLoaded = false;
    this._appSettingsLoading = null;

    this._projectLabelLoading = null;
    this._projectLabelForId = null;

    this.activeSection = null;

    // Kandidaten/Teilnehmer Modals (lazy)
    this._participantsModals = null;
    this._participantsModalsLoading = null;

    // Print Modal (lazy)
    this._printModal = null;
    this._printModalLoading = null;
    this._helpModal = null;
    this._helpModalLoading = null;
    this._projectContextLane = null;
    this._projectContextLaneLoading = null;
    this._projectFormModal = null;
    this.currentView = null;
    this.activeView = null;

    this._setupStatusRefreshTimer = null;
    this._printSelectionState = null;

    Promise.resolve().then(() => {
      this._ensureProjectContextQuicklane().catch(() => {});
    });
  }

  _emitContextChange() {
    try {
      window.dispatchEvent(
        new CustomEvent("bbm:router-context", {
          detail: {
            projectId: this.currentProjectId || null,
            meetingId: this.currentMeetingId || null,
          },
        })
      );
    } catch (_e) {
      // ignore
    }
  }

  _refreshHeaderSafe() {
    try {
      if (typeof this.refreshHeader === "function") {
        this.refreshHeader();
      }
    } catch (e) {
      console.warn("[header] refresh failed:", e);
    }
  }

  _readUiMode() {
    try {
      const raw = String(window.localStorage?.getItem?.("bbm.uiMode") || "").trim().toLowerCase();
      return raw === "new" ? "new" : "old";
    } catch (_e) {
      return "old";
    }
  }

  requestSetupStatusRefresh() {
    if (this._readUiMode() !== "new") return;

    if (this._setupStatusRefreshTimer) {
      clearTimeout(this._setupStatusRefreshTimer);
      this._setupStatusRefreshTimer = null;
    }

    this._setupStatusRefreshTimer = setTimeout(() => {
      this._setupStatusRefreshTimer = null;
      this._refreshHeaderSafe();
    }, 80);
  }

  _cleanupTransientOverlays() {
    try {
      const nodes = Array.from(document.body?.children || []);
      const vw = Number(window.innerWidth || 0);
      const vh = Number(window.innerHeight || 0);
      let removed = 0;

      for (const el of nodes) {
        if (!el || !el.style) continue;
        if (el === document.body || el === document.documentElement) continue;
        const overlayKind = String(el?.getAttribute?.("data-bbm-print-overlay") || "").toLowerCase();
        if (overlayKind === "preview") continue;

        const cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
        const position = (cs?.position || el.style.position || "").toLowerCase();
        const display = (cs?.display || el.style.display || "").toLowerCase();
        const visibility = (cs?.visibility || "").toLowerCase();
        const pointerEvents = (cs?.pointerEvents || "").toLowerCase();
        if (position !== "fixed") continue;
        if (display === "none") continue;
        if (visibility === "hidden") continue;
        if (pointerEvents === "none") continue;

        const zRaw = cs?.zIndex || el.style.zIndex || "0";
        const z = Number(zRaw);
        if (!Number.isFinite(z) || z < 999) continue;

        const r = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
        const coversViewport =
          !!r &&
          r.width >= Math.max(1, vw * 0.95) &&
          r.height >= Math.max(1, vh * 0.95);
        if (!coversViewport) continue;

        const bg = (cs?.backgroundColor || el.style.backgroundColor || "").toString();
        const hasBackdrop = bg.includes("rgba(") || bg.includes("hsla(");
        if (!hasBackdrop && (!el.children || el.children.length === 0)) continue;

        try {
          el.remove();
          removed += 1;
        } catch (_e) {
          // ignore
        }
      }

      if (removed > 0) {
        // defensiv: bei haengenden Overlays koennen globale Locks aktiv bleiben
        try {
          if (document.body?.style?.pointerEvents === "none") {
            document.body.style.pointerEvents = "";
          }
          if (document.documentElement?.style?.pointerEvents === "none") {
            document.documentElement.style.pointerEvents = "";
          }
          if (document.body?.hasAttribute("inert")) {
            document.body.removeAttribute("inert");
          }
          if (document.documentElement?.hasAttribute("inert")) {
            document.documentElement.removeAttribute("inert");
          }
        } catch (_e) {
          // ignore
        }
      }
    } catch (_e) {
      // ignore
    }
  }

  async ensureAppSettingsLoaded({ force = false } = {}) {
    if (!force && this._appSettingsLoaded) return this.context.settings || {};
    if (this._appSettingsLoading) return await this._appSettingsLoading;

    const api = window.bbmDb || {};
    const hasApi = typeof api.appSettingsGetMany === "function";

    // Fallback: keine Settings-API vorhanden -> placeholders bleiben leer
    if (!hasApi) {
      this._appSettingsLoaded = true;
      this.context.settings = this.context.settings || {};
      this._refreshHeaderSafe();
      return this.context.settings;
    }

    this._appSettingsLoading = (async () => {
      try {
        const keys = [
          "user_name",
          "user_company",
          "user_name1",
          "user_name2",
          "user_street",
          "user_zip",
          "user_city",
          "header.logoSizePx",
          "header.logoPadLeftPx",
          "header.logoPadTopPx",
          "header.logoPadRightPx",
          "header.logoPosition",
          "header.logoEnabled",
          "ui.themeHeaderBaseColor",
          "ui.themeSidebarBaseColor",
          "ui.themeMainBaseColor",
          "ui.themeHeaderTone",
          "ui.themeSidebarTone",
          "ui.themeMainTone",
          "ui.themeHeaderMode",
          "ui.themeSidebarMode",
          "ui.themeMainMode",
          "ui.themeHeaderUseDefault",
          "ui.themeSidebarUseDefault",
          "ui.themeMainUseDefault",
          "defaults.ui.themeHeaderBaseColor",
          "defaults.ui.themeSidebarBaseColor",
          "defaults.ui.themeMainBaseColor",
          "defaults.ui.themeHeaderTone",
          "defaults.ui.themeSidebarTone",
          "defaults.ui.themeMainTone",
          "pdf.userLogoPngDataUrl",
          "pdf.userLogoEnabled",
          "pdf.userLogoWidthMm",
          "pdf.userLogoTopMm",
          "pdf.userLogoRightMm",
          "pdf.protocolTitle",
          "pdf.preRemarks",
          "pdf.trafficLightAllEnabled",
          "pdf.footerPlace",
          "pdf.footerDate",
          "pdf.footerName1",
          "pdf.footerName2",
          "pdf.footerRecorder",
          "pdf.footerStreet",
          "pdf.footerZip",
          "pdf.footerCity",
          "pdf.footerUseUserData",
          "tops.ampelEnabled",
        ];
        const res = await api.appSettingsGetMany(keys);

        if (res && res.ok) {
          const out = res.data || {};
          this.context.settings = {
            ...(this.context.settings || {}),
            user_name: (out.user_name ?? "").toString(),
            user_company: (out.user_company ?? "").toString(),
            user_name1: (out.user_name1 ?? "").toString(),
            user_name2: (out.user_name2 ?? "").toString(),
            user_street: (out.user_street ?? "").toString(),
            user_zip: (out.user_zip ?? "").toString(),
            user_city: (out.user_city ?? "").toString(),
            "header.logoSizePx": out["header.logoSizePx"],
            "header.logoPadLeftPx": out["header.logoPadLeftPx"],
            "header.logoPadTopPx": out["header.logoPadTopPx"],
            "header.logoPadRightPx": out["header.logoPadRightPx"],
            "header.logoPosition": out["header.logoPosition"],
            "header.logoEnabled": out["header.logoEnabled"],
            "ui.themeHeaderBaseColor": out["ui.themeHeaderBaseColor"],
            "ui.themeSidebarBaseColor": out["ui.themeSidebarBaseColor"],
            "ui.themeMainBaseColor": out["ui.themeMainBaseColor"],
            "ui.themeHeaderTone": out["ui.themeHeaderTone"],
            "ui.themeSidebarTone": out["ui.themeSidebarTone"],
            "ui.themeMainTone": out["ui.themeMainTone"],
            "ui.themeHeaderMode": out["ui.themeHeaderMode"],
            "ui.themeSidebarMode": out["ui.themeSidebarMode"],
            "ui.themeMainMode": out["ui.themeMainMode"],
            "ui.themeHeaderUseDefault": out["ui.themeHeaderUseDefault"],
            "ui.themeSidebarUseDefault": out["ui.themeSidebarUseDefault"],
            "ui.themeMainUseDefault": out["ui.themeMainUseDefault"],
            "defaults.ui.themeHeaderBaseColor": out["defaults.ui.themeHeaderBaseColor"],
            "defaults.ui.themeSidebarBaseColor": out["defaults.ui.themeSidebarBaseColor"],
            "defaults.ui.themeMainBaseColor": out["defaults.ui.themeMainBaseColor"],
            "defaults.ui.themeHeaderTone": out["defaults.ui.themeHeaderTone"],
            "defaults.ui.themeSidebarTone": out["defaults.ui.themeSidebarTone"],
            "defaults.ui.themeMainTone": out["defaults.ui.themeMainTone"],
            "pdf.userLogoPngDataUrl": out["pdf.userLogoPngDataUrl"],
            "pdf.userLogoEnabled": out["pdf.userLogoEnabled"],
            "pdf.userLogoWidthMm": out["pdf.userLogoWidthMm"],
            "pdf.userLogoTopMm": out["pdf.userLogoTopMm"],
            "pdf.userLogoRightMm": out["pdf.userLogoRightMm"],
            "pdf.protocolTitle": out["pdf.protocolTitle"],
            "pdf.preRemarks": out["pdf.preRemarks"],
            "pdf.trafficLightAllEnabled": out["pdf.trafficLightAllEnabled"],
            "pdf.footerPlace": out["pdf.footerPlace"],
            "pdf.footerDate": out["pdf.footerDate"],
            "pdf.footerName1": out["pdf.footerName1"],
            "pdf.footerName2": out["pdf.footerName2"],
            "pdf.footerRecorder": out["pdf.footerRecorder"],
            "pdf.footerStreet": out["pdf.footerStreet"],
            "pdf.footerZip": out["pdf.footerZip"],
            "pdf.footerCity": out["pdf.footerCity"],
            "pdf.footerUseUserData": out["pdf.footerUseUserData"],
            "tops.ampelEnabled": out["tops.ampelEnabled"],
          };
        } else {
          this.context.settings = this.context.settings || {};
        }
      } catch (_e) {
        this.context.settings = this.context.settings || {};
      } finally {
        this._appSettingsLoaded = true;
        this._refreshHeaderSafe();
      }

      return this.context.settings;
    })();

    try {
      return await this._appSettingsLoading;
    } finally {
      this._appSettingsLoading = null;
    }
  }

  async ensureCurrentProjectLabelLoaded({ force = false } = {}) {
    const projectId = this.currentProjectId || null;
    if (!projectId) {
      this.context.projectLabel = null;
      this._projectLabelForId = null;
      this._refreshHeaderSafe();
      return null;
    }

    if (!force && this._projectLabelForId === projectId && this.context.projectLabel) {
      return this.context.projectLabel;
    }

    if (this._projectLabelLoading) return await this._projectLabelLoading;

    const api = window.bbmDb || {};
    if (typeof api.projectsList !== "function") {
      this.context.projectLabel = `#${projectId}`;
      this._projectLabelForId = projectId;
      this._refreshHeaderSafe();
      return this.context.projectLabel;
    }

    this._projectLabelLoading = (async () => {
      try {
        const res = await api.projectsList();
        if (res && res.ok) {
          const list = res.list || [];
          const p = list.find((x) => x.id === projectId) || null;

          const pn =
            (p && (p.project_number ?? p.projectNumber ?? "").toString().trim()) || "";
          const sh = (p && (p.short || "").toString().trim()) || "";
          const nm = (p && (p.name || "").toString().trim()) || "";

          // ✅ Spec: pn–sh | sh | pn | name | #id
          let label = "";
          if (pn && sh) label = `${pn} – ${sh}`;
          else if (!pn && sh) label = `${sh}`;
          else if (pn && !sh) label = `${pn}`;
          else if (nm) label = `${nm}`;
          else label = `#${projectId}`;

          this.context.projectLabel = label;
          this._projectLabelForId = projectId;
        } else {
          this.context.projectLabel = `#${projectId}`;
          this._projectLabelForId = projectId;
        }
      } catch (_e) {
        this.context.projectLabel = `#${projectId}`;
        this._projectLabelForId = projectId;
      } finally {
        this._refreshHeaderSafe();
      }

      return this.context.projectLabel;
    })();

    try {
      return await this._projectLabelLoading;
    } finally {
      this._projectLabelLoading = null;
    }
  }

  _setActiveSection(section) {
    this.activeSection = section || null;
    if (typeof this.onSectionChange === "function") {
      this.onSectionChange(this.activeSection);
    }
    this._refreshHeaderSafe();
  }

  async show(v, { section, isTopsView = false, pageTitle = null } = {}) {
    const prevView = this.currentView;
    if (prevView && prevView !== v) {
      try {
        if (typeof prevView.destroy === "function") {
          await prevView.destroy();
        } else if (typeof prevView.dispose === "function") {
          await prevView.dispose();
        }
      } catch (e) {
        console.warn("[router] previous view cleanup failed:", e);
      } finally {
        this.currentView = null;
        this.activeView = null;
      }
    }

    this._cleanupTransientOverlays();

    // update header-context BEFORE header refresh
    this.context.ui = this.context.ui || {};
    this.context.ui.isTopsView = !!isTopsView;
    this.context.ui.pageTitle = pageTitle;

    try {
      const lane = await this._ensureProjectContextQuicklane();
      lane?.setEnabled?.(!!isTopsView);
    } catch (_e) {
      // ignore
    }

    this._setActiveSection(section);

    await this.ensureAppSettingsLoaded({ force: false });
    await this.ensureCurrentProjectLabelLoaded({ force: false });

    try {
      const lane = await this._ensureProjectContextQuicklane();
      lane?.setContext?.({
        projectId: this.currentProjectId || this.lastTopsProjectId || null,
        meetingId: this.currentMeetingId || this.lastTopsMeetingId || null,
        projectLabel: this.context.projectLabel || null,
      });
    } catch (_e) {
      // ignore
    }

    this.contentRoot.innerHTML = "";
    const e = v.render();
    this.contentRoot.appendChild(e);
    if (v.load) await v.load();
    this.currentView = v;
    this.activeView = v;

    this._refreshHeaderSafe();
    this._emitContextChange();
  }

  async showProjects() {
    const mod = await import("../views/ProjectsView.js");
    const V = mod.default;
    this.currentMeetingId = null;
    await this.show(new V({ router: this }), { section: "projects", isTopsView: false });
  }

  async showFirmsPool(projectId) {
    const mod = await import("../views/FirmsPoolView.js");
    const V = mod.default;
    this.currentProjectId = projectId || this.currentProjectId || null;
    this.currentMeetingId = null;
    await this.show(new V({ router: this, projectId: this.currentProjectId }), {
      section: "firmsPool",
      isTopsView: false,
    });
  }

  async showHome() {
    const mod = await import("../views/HomeView.js");
    const V = mod.default;
    this.currentProjectId = null;
    this.currentMeetingId = null;
    await this.show(new V({ router: this }), { section: "home", isTopsView: false });
  }

  async showProjectForm({ projectId } = {}) {
    const mod = await import("../views/ProjectFormView.js");
    const V = mod.default;

    this.currentMeetingId = null;

    const effectiveProjectId =
      projectId === undefined ? this.currentProjectId || null : projectId || null;

    if (effectiveProjectId) {
      this.currentProjectId = effectiveProjectId;
    } else {
      this.currentProjectId = null;
    }

    await this.show(new V({ router: this, projectId: effectiveProjectId }), {
      section: "projects",
      isTopsView: false,
    });
  }

  async showMeetings(projectId, { printSelectionMode = false, printKind = null } = {}) {
    const mod = await import("../views/MeetingsView.js");
    const V = mod.default;

    this.currentProjectId = projectId || null;
    this.currentMeetingId = null;
    await this.show(
      new V({
        router: this,
        projectId,
        printSelectionMode: !!printSelectionMode,
        printKind: printKind || null,
      }),
      { section: "meetings", isTopsView: false }
    );
  }

  async showTops(meetingId, projectId, options = {}) {
    const mod = await import("../views/TopsView.js");
    const V = mod.default;

    const opts = options && typeof options === "object" ? options : {};
    const readOnly = !!opts.readOnly;

    this.currentProjectId = projectId || this.currentProjectId || null;
    this.currentMeetingId = meetingId || null;
    this.lastTopsProjectId = this.currentProjectId || null;
    this.lastTopsMeetingId = this.currentMeetingId || null;

    await this.show(new V({ router: this, meetingId, projectId, readOnly }), {
      section: "meetings",
      isTopsView: true,
      pageTitle: "Protokoll",
    });
  }

  async showFirms() {
    const mod = await import("../views/FirmsView.js");
    const V = mod.default;

    this.currentMeetingId = null;
    await this.show(new V({ router: this }), { section: "firms", isTopsView: false });
  }

  async showProjectFirms(projectId) {
    const mod = await import("../views/ProjectFirmsView.js");
    const V = mod.default;

    this.currentProjectId = projectId || this.currentProjectId || null;
    await this.show(new V({ router: this, projectId: this.currentProjectId }), {
      section: "projectFirms",
      isTopsView: false,
    });
  }

  async showSettings() {
    const mod = await import("../views/SettingsView.js");
    const V = mod.default;

    await this.show(new V({ router: this }), { section: "settings", isTopsView: false });
  }

  async showArchive() {
    const mod = await import("../views/ArchiveView.js");
    const V = mod.default;

    this.currentMeetingId = null;
    await this.show(new V({ router: this }), { section: "archive", isTopsView: false });
  }

  // … Rest unverändert …
  // (Participants/Print Modal Code bleibt wie gehabt)

  async _ensureParticipantsModals() {
    if (this._participantsModals) return this._participantsModals;
    if (this._participantsModalsLoading) return await this._participantsModalsLoading;

    this._participantsModalsLoading = (async () => {
      const mod = await import("../ui/ParticipantsModals.js");
      const C = mod.default;
      this._participantsModals = new C({ router: this });
      return this._participantsModals;
    })();

    try {
      return await this._participantsModalsLoading;
    } finally {
      this._participantsModalsLoading = null;
    }
  }

  async openCandidatesModal({ projectId } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    if (!effectiveProjectId) {
      alert("Projekt-Kontext fehlt.");
      return;
    }
    this.currentProjectId = effectiveProjectId;
    const pm = await this._ensureParticipantsModals();
    await pm.openCandidates({ projectId: effectiveProjectId });
  }

  async openParticipantsModal({ projectId, meetingId } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    const effectiveMeetingId = meetingId || this.currentMeetingId || null;
    if (!effectiveProjectId) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }
    if (!effectiveMeetingId) {
      alert("Bitte zuerst eine Besprechung öffnen.");
      return;
    }
    this.currentProjectId = effectiveProjectId;
    this.currentMeetingId = effectiveMeetingId;
    const pm = await this._ensureParticipantsModals();
    await pm.openParticipants({ projectId: effectiveProjectId, meetingId: effectiveMeetingId });
  }

  async _ensurePrintModal() {
    if (this._printModal) return this._printModal;
    if (this._printModalLoading) return await this._printModalLoading;

    this._printModalLoading = (async () => {
      const mod = await import("../ui/PrintModal.js");
      const PrintModal = mod.default;
      this._printModal = new PrintModal({ router: this });
      return this._printModal;
    })();

    try {
      return await this._printModalLoading;
    } finally {
      this._printModalLoading = null;
    }
  }

  _cleanupStalePrintModalOverlays({ keepPreview = false } = {}) {
    try {
      const nodes = Array.from(
        document.querySelectorAll('[data-bbm-print-overlay], .bbm-print-overlay')
      );
      for (const el of nodes) {
        const kind = String(el?.getAttribute?.("data-bbm-print-overlay") || "").toLowerCase();
        if (keepPreview && kind === "preview") continue;
        try {
          el.remove();
        } catch (_e) {
          // ignore
        }
      }
    } catch (_e) {
      // ignore
    }
  }

  async closePrintModal({ keepPreview = false } = {}) {
    const pm = this._printModal;
    if (!pm) {
      this._cleanupStalePrintModalOverlays({ keepPreview });
      return;
    }
    try {
      if (typeof pm.close === "function") {
        pm.close({ keepPreview });
      }
    } catch (_e) {
      // ignore
    } finally {
      this._cleanupStalePrintModalOverlays({ keepPreview });
    }
  }

  _captureContextForPrintReturn() {
    return {
      section: this.activeSection || null,
      isTopsView: !!this.context?.ui?.isTopsView,
      projectId: this.currentProjectId || null,
      meetingId: this.currentMeetingId || null,
    };
  }

  async _restoreContextAfterPrintSelection(context, fallbackProjectId) {
    const c = context || {};
    const fallbackProject = fallbackProjectId || this.currentProjectId || null;

    try {
      if (c.isTopsView && c.projectId && c.meetingId) {
        await this.showTops(c.meetingId, c.projectId);
        return;
      }
      if (c.section === "home") {
        await this.showHome();
        return;
      }
      if (c.section === "projects") {
        await this.showProjects();
        return;
      }
      if (c.section === "settings") {
        await this.showSettings();
        return;
      }
      if (c.section === "firms") {
        await this.showFirms();
        return;
      }
      if (c.section === "archive") {
        await this.showArchive();
        return;
      }
      if (c.section === "projectFirms") {
        await this.showProjectFirms(c.projectId || fallbackProject);
        return;
      }
      if (c.section === "firmsPool") {
        await this.showProjectFirms(c.projectId || fallbackProject);
        return;
      }
      if (c.section === "meetings") {
        await this.showMeetings(c.projectId || fallbackProject);
        return;
      }
      if (fallbackProject) {
        await this.showMeetings(fallbackProject);
      } else {
        await this.showProjects();
      }
    } catch (_e) {
      if (fallbackProject) {
        await this.showMeetings(fallbackProject);
      } else {
        await this.showProjects();
      }
    }
  }

  async openMeetingsForPrintSelection({ projectId, printKind } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    if (!effectiveProjectId) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }

    const kind = printKind === "todo" ? "todo" : "firms";
    this._printSelectionState = {
      active: true,
      projectId: effectiveProjectId,
      printKind: kind,
      returnContext: this._captureContextForPrintReturn(),
    };

    await this.showMeetings(effectiveProjectId, {
      printSelectionMode: true,
      printKind: kind,
    });
  }

  async cancelPrintSelection({ restore = true } = {}) {
    const state = this._printSelectionState || null;
    if (!state) return;

    this._printSelectionState = null;
    if (!restore) return;
    await this._restoreContextAfterPrintSelection(
      state.returnContext,
      state.projectId || this.currentProjectId || null
    );
  }

  async completePrintSelection({ meetingId, projectId } = {}) {
    const state = this._printSelectionState || null;
    const selectedMeetingId = meetingId || null;
    const effectiveProjectId = projectId || state?.projectId || this.currentProjectId || null;
    if (!state || !state.active || !effectiveProjectId || !selectedMeetingId) {
      return false;
    }

    try {
      if (state.printKind === "todo") {
        await this.openTodoPrintPreview({
          projectId: effectiveProjectId,
          meetingId: selectedMeetingId,
        });
      } else {
        await this.printFirmsDirect({
          projectId: effectiveProjectId,
          meetingId: selectedMeetingId,
        });
      }
    } finally {
      const returnContext = state.returnContext || null;
      this._printSelectionState = null;
      await this._restoreContextAfterPrintSelection(returnContext, effectiveProjectId);
    }
    return true;
  }

  async openPrintModal({ projectId } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    if (!effectiveProjectId) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }
    this.currentProjectId = effectiveProjectId;
    const pm = await this._ensurePrintModal();
    try {
      if (typeof pm.close === "function") {
        pm.close();
      }
    } catch (_e) {
      // ignore
    } finally {
      this._cleanupStalePrintModalOverlays();
    }
    await pm.openPrint({ projectId: effectiveProjectId });
  }

  async promptNextMeetingSettings({ defaultDateIso } = {}) {
    const pm = await this._ensurePrintModal();
    try {
      if (typeof pm.close === "function") {
        pm.close();
      }
    } catch (_e) {
      // ignore
    } finally {
      this._cleanupStalePrintModalOverlays();
    }
    if (typeof pm?.promptNextMeetingSettings !== "function") {
      return { ok: false, cancelled: true };
    }
    return await pm.promptNextMeetingSettings({ defaultDateIso });
  }

  async openMeetingPrintPreview({ projectId, meetingId, mode } = {}) {
    const pm = await this._ensurePrintModal();
    if (typeof pm?.printMeetingPreview !== "function") {
      alert("PrintModal unterstützt keine Protokoll-Vorschau (printMeetingPreview fehlt).");
      return;
    }
    try {
      await pm.printMeetingPreview({ projectId, meetingId, mode });
    } finally {
      await this.closePrintModal({ keepPreview: true });
    }
  }

  async openStoredProtocolPreview({ filePath, title } = {}) {
    const pm = await this._ensurePrintModal();
    if (typeof pm?.openExistingPdfPreview !== "function") {
      alert("PrintModal unterstützt keine gespeicherte PDF-Vorschau.");
      return false;
    }
    try {
      await pm.openExistingPdfPreview({ filePath, title: title || "Protokoll (Vorschau)" });
      return true;
    } finally {
      await this.closePrintModal({ keepPreview: true });
    }
  }

  async openPrintVorabzug({ projectId, meetingId } = {}) {
    const pm = await this._ensurePrintModal();
    if (typeof pm?.printVorabzug !== "function") {
      alert("PrintModal unterstützt keinen Vorabzug (printVorabzug fehlt).");
      return;
    }
    try {
      await pm.printVorabzug({ projectId, meetingId });
    } finally {
      await this.closePrintModal({ keepPreview: true });
    }
  }

  async openTodoPrintPreview({ projectId, meetingId } = {}) {
    const pm = await this._ensurePrintModal();
    if (typeof pm?.openTodoPrintPreview !== "function") {
      alert("PrintModal unterstützt kein ToDo-PDF.");
      return;
    }
    try {
      await pm.openTodoPrintPreview({ projectId, meetingId });
    } finally {
      await this.closePrintModal({ keepPreview: true });
    }
  }

  async openTopListAllPrintPreview({ projectId, meetingId } = {}) {
    const pm = await this._ensurePrintModal();
    if (typeof pm?.openTopListAllPreview !== "function") {
      alert("PrintModal unterstützt keine Top-Liste(alle)-Vorschau.");
      return;
    }
    try {
      await pm.openTopListAllPreview({ projectId, meetingId });
    } finally {
      await this.closePrintModal({ keepPreview: true });
    }
  }

  async openFirmsPrintPreview({ projectId, meetingId } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    if (!effectiveProjectId) {
      alert("Bitte zuerst ein Projekt ausw\u00e4hlen.");
      return;
    }
    this.currentProjectId = effectiveProjectId;
    if (meetingId) this.currentMeetingId = meetingId;
    const pm = await this._ensurePrintModal();
    if (typeof pm?.openFirmsPrintPreview !== "function") {
      alert("PrintModal unterst\u00fctzt keine Firmenliste.");
      return;
    }
    try {
      await pm.openFirmsPrintPreview({ projectId: effectiveProjectId, meetingId: meetingId || null });
    } finally {
      await this.closePrintModal({ keepPreview: true });
    }
  }

  async openStoredFirmsPdfSelection({ projectId } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    if (!effectiveProjectId) {
      alert("Bitte zuerst ein Projekt ausw\u00e4hlen.");
      return;
    }
    this.currentProjectId = effectiveProjectId;
    const pm = await this._ensurePrintModal();
    if (typeof pm?.openStoredFirmsPdfSelection !== "function") {
      alert("PrintModal unterst\u00fctzt keine gespeicherten Firmenlisten.");
      return;
    }
    try {
      await pm.openStoredFirmsPdfSelection({ projectId: effectiveProjectId });
    } finally {
      await this.closePrintModal({ keepPreview: false });
    }
  }

  async printClosedMeetingDirect({ projectId, meetingId } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    if (!effectiveProjectId) {
      alert("Bitte zuerst ein Projekt auswählen.");
      return;
    }
    this.currentProjectId = effectiveProjectId;
    if (meetingId) this.currentMeetingId = meetingId;
    const pm = await this._ensurePrintModal();
    if (typeof pm?.printClosedMeetingDirect !== "function") {
      alert("PrintModal unterstützt keinen Protokoll-Direktdruck.");
      return;
    }
    try {
      const res = await pm.printClosedMeetingDirect({ projectId: effectiveProjectId, meetingId: meetingId || null });
      return res;
    } finally {
      await this.closePrintModal({ keepPreview: false });
    }
  }

  async printFirmsDirect({ projectId, meetingId } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    if (!effectiveProjectId) {
      alert("Bitte zuerst ein Projekt ausw\u00e4hlen.");
      return;
    }
    this.currentProjectId = effectiveProjectId;
    if (meetingId) this.currentMeetingId = meetingId;
    const pm = await this._ensurePrintModal();
    if (typeof pm?.printFirmsDirect !== "function") {
      alert("PrintModal unterst\u00fctzt keine Firmenliste.");
      return;
    }
    try {
      const res = await pm.printFirmsDirect({ projectId: effectiveProjectId, meetingId: meetingId || null });
      return res;
    } finally {
      await this.closePrintModal({ keepPreview: false });
    }
  }

  async printTodoDirect({ projectId, meetingId } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    if (!effectiveProjectId) {
      alert("Bitte zuerst ein Projekt ausw\u00e4hlen.");
      return;
    }
    this.currentProjectId = effectiveProjectId;
    if (meetingId) this.currentMeetingId = meetingId;
    const pm = await this._ensurePrintModal();
    if (typeof pm?.printTodoDirect !== "function") {
      alert("PrintModal unterst\u00fctzt keine ToDo-Liste.");
      return;
    }
    try {
      const res = await pm.printTodoDirect({ projectId: effectiveProjectId, meetingId: meetingId || null });
      return res;
    } finally {
      await this.closePrintModal({ keepPreview: false });
    }
  }

  async printTopListAllDirect({ projectId, meetingId } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    if (!effectiveProjectId) {
      alert("Bitte zuerst ein Projekt ausw\u00e4hlen.");
      return;
    }
    this.currentProjectId = effectiveProjectId;
    if (meetingId) this.currentMeetingId = meetingId;
    const pm = await this._ensurePrintModal();
    if (typeof pm?.printTopListAllDirect !== "function") {
      alert("PrintModal unterst\u00fctzt keine Top-Liste.");
      return;
    }
    try {
      const res = await pm.printTopListAllDirect({ projectId: effectiveProjectId, meetingId: meetingId || null });
      return res;
    } finally {
      await this.closePrintModal({ keepPreview: false });
    }
  }

  async _ensureProjectContextQuicklane() {
    if (this._projectContextLane) return this._projectContextLane;
    if (this._projectContextLaneLoading) return await this._projectContextLaneLoading;

      this._projectContextLaneLoading = (async () => {
        const mod = await import("../ui/ProjectContextQuicklane.js");
        const Lane = mod.default;
        this._projectContextLane = new Lane({ router: this });
        return this._projectContextLane;
      })();

    try {
      return await this._projectContextLaneLoading;
    } finally {
      this._projectContextLaneLoading = null;
    }
  }

  async openProjectContextQuicklane(opts = {}) {
    const lane = await this._ensureProjectContextQuicklane();
    lane?.open?.(opts && typeof opts === "object" ? opts : {});
  }

  async openProjectFormModal({ projectId } = {}) {
    const effectiveProjectId = projectId || this.currentProjectId || null;
    if (!effectiveProjectId) return;
    if (this._projectFormModal) return;

    const cleanup = () => {
      this._projectFormModal = null;
    };

    try {
      const mod = await import("../views/ProjectFormView.js");
      const ProjectFormView = mod.default;

      const view = new ProjectFormView({
        router: this,
        projectId: effectiveProjectId,
        mode: "modal",
        onClose: cleanup,
        onSaved: async () => {
          await this.ensureCurrentProjectLabelLoaded({ force: true });
          const lane = await this._ensureProjectContextQuicklane();
          lane?.setContext?.({
            projectId: this.currentProjectId || this.lastTopsProjectId || null,
            meetingId: this.currentMeetingId || this.lastTopsMeetingId || null,
            projectLabel: this.context.projectLabel || null,
          });
          this._refreshHeaderSafe();
          cleanup();
        },
      });

      this._projectFormModal = view;
      view.render();
      await view.load();
      await view.openModal();
    } catch (err) {
      console.error("[router] project form modal failed:", err);
      cleanup();
    }
  }

  async _ensureHelpModal() {
    if (this._helpModal) return this._helpModal;
    if (this._helpModalLoading) return await this._helpModalLoading;

    this._helpModalLoading = (async () => {
      const mod = await import("../ui/HelpModal.js");
      const HelpModal = mod.default;
      this._helpModal = new HelpModal();
      return this._helpModal;
    })();

    try {
      return await this._helpModalLoading;
    } finally {
      this._helpModalLoading = null;
    }
  }

  async openHelpModal() {
    const hm = await this._ensureHelpModal();
    hm.open();
  }
}
