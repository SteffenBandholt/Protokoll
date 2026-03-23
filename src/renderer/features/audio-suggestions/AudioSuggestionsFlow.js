import { TranscriptionService } from "../../services/audio/TranscriptionService.js";
import AudioSuggestionsPanel from "../../ui/AudioSuggestionsPanel.js";

export class AudioSuggestionsFlow {
  constructor({ view }) {
    this.view = view;
    this._audioPanel = null;
    this._audioPanelBusy = false;
    this._audioPanelStatusMessage = "";
    this._audioSuggestionMarkTimer = null;
    this.transcriptionService = new TranscriptionService();
  }

  _getAudioPanel() {
    if (!this._audioPanel) {
      this._audioPanel = new AudioSuggestionsPanel();
    }
    return this._audioPanel;
  }

  _buildLockedAudioPanelState(message) {
    return {
      title: "Sprachdatei auswerten",
      modeLabel: "Pruefmodus",
      busy: false,
      statusMessage: String(message || this.view?._audioLicenseMessage || "").trim(),
      suggestions: [],
      audioImport: null,
      transcript: null,
      parentOptions: this._getAudioParentOptions(),
      onImportAudio: async () => {},
      onCreateDemoSuggestion: async () => {},
      onApplySuggestion: async () => {},
      onFocusSuggestion: async () => {},
      onRejectSuggestion: async () => {},
    };
  }

  applyReadOnlyState(ro, busy) {
    if (!this.view?.btnAudioAnalyze) return;
    const audioLocked = !this.view?._audioLicensed && !this.view?._audioDevOverride;
    const allowLegacy = !!this.view?._audioSuggestionsDevEnabled;
    this.view.btnAudioAnalyze.disabled = ro || busy || !this.view?.meetingId || audioLocked || !allowLegacy;
    this.view.btnAudioAnalyze.style.opacity = this.view.btnAudioAnalyze.disabled ? "0.65" : "1";
    this.view.btnAudioAnalyze.style.display = allowLegacy ? "" : "none";
    this.view.btnAudioAnalyze.title = audioLocked
      ? this.view?._audioLicenseMessage
      : allowLegacy
      ? "Audio-Suggestions (DEV)"
      : "Audio-Mapping ist deaktiviert";
  }

  async _loadAudioSuggestions() {
    if (!(await this.view._ensureAudioAvailable({ alertOnFailure: false }))) {
      return { suggestions: [], audioImport: null, transcript: null };
    }

    if (!this.view?.meetingId || typeof window?.bbmDb?.audioGetSuggestions !== "function") {
      return { suggestions: [], audioImport: null, transcript: null };
    }

    const res = await window.bbmDb.audioGetSuggestions({
      meetingId: this.view.meetingId,
      status: "pending",
    });
    if (!res?.ok) throw new Error(res?.error || "Vorschl?ge konnten nicht geladen werden.");
    return {
      suggestions: Array.isArray(res.list) ? res.list : [],
      audioImport: res.audioImport || null,
      transcript: res.transcript || null,
    };
  }

  async refresh(options = {}) {
    const panel = this._getAudioPanel();
    const forceMessage =
      options && Object.prototype.hasOwnProperty.call(options, "statusMessage")
        ? options.statusMessage
        : undefined;

    if (!(await this.view._loadAudioLicenseState())) {
      panel.update(
        this._buildLockedAudioPanelState(
          forceMessage !== undefined ? String(forceMessage || "") : this.view?._audioLicenseMessage
        )
      );
      return;
    }

    try {
      const audioState = await this._loadAudioSuggestions();
      const suggestions = Array.isArray(audioState?.suggestions) ? audioState.suggestions : [];
      const fallbackMessage = suggestions.length
        ? ""
        : "Aktuell liegen keine Vorschl?ge vor. Die Transkription ist real angebunden, die Zuordnungslogik bleibt noch Platzhalter.";
      panel.update({
        title: "Sprachdatei auswerten",
        modeLabel: "Pr?fmodus",
        busy: !!this._audioPanelBusy,
        statusMessage:
          forceMessage !== undefined
            ? String(forceMessage || "")
            : (this._audioPanelStatusMessage || fallbackMessage),
        suggestions,
        audioImport: audioState?.audioImport || null,
        transcript: audioState?.transcript || null,
        parentOptions: this._getAudioParentOptions(),
        onImportAudio: async () => this._runAudioImportFlow(),
        onCreateDemoSuggestion: async (demoType) => this._createDemoAudioSuggestion(demoType),
        onApplySuggestion: async (suggestion, extra = {}) => this._applyAudioSuggestion(suggestion, extra),
        onFocusSuggestion: async (suggestion, extra = {}) => this._focusAudioSuggestion(suggestion, extra),
        onRejectSuggestion: async (suggestion) => this._rejectAudioSuggestion(suggestion),
      });
    } catch (err) {
      panel.update({
        title: "Sprachdatei auswerten",
        modeLabel: "Pr?fmodus",
        busy: !!this._audioPanelBusy,
        statusMessage: err?.message || String(err),
        suggestions: [],
        audioImport: null,
        transcript: null,
        parentOptions: this._getAudioParentOptions(),
        onImportAudio: async () => this._runAudioImportFlow(),
        onCreateDemoSuggestion: async (demoType) => this._createDemoAudioSuggestion(demoType),
        onApplySuggestion: async (suggestion, extra = {}) => this._applyAudioSuggestion(suggestion, extra),
        onFocusSuggestion: async (suggestion, extra = {}) => this._focusAudioSuggestion(suggestion, extra),
        onRejectSuggestion: async (suggestion) => this._rejectAudioSuggestion(suggestion),
      });
    }
  }

  async open() {
    if (!this.view?.meetingId || this.view?.isReadOnly) return;
    const panel = this._getAudioPanel();

    if (!(await this.view._loadAudioLicenseState())) {
      panel.open(this._buildLockedAudioPanelState(this.view?._audioLicenseMessage));
      return;
    }
    if (!(await this.view._loadAudioSuggestionsDevFlag())) {
      alert("Audio-Suggestions sind nur in der Entwicklung verfuegbar.");
      return;
    }

    panel.open({
      title: "Sprachdatei auswerten",
      modeLabel: "Pr?fmodus",
      busy: !!this._audioPanelBusy,
      statusMessage: this._audioPanelStatusMessage,
      suggestions: [],
      audioImport: null,
      transcript: null,
      parentOptions: this._getAudioParentOptions(),
      onImportAudio: async () => this._runAudioImportFlow(),
      onCreateDemoSuggestion: async (demoType) => this._createDemoAudioSuggestion(demoType),
      onApplySuggestion: async (suggestion, extra = {}) => this._applyAudioSuggestion(suggestion, extra),
      onFocusSuggestion: async (suggestion, extra = {}) => this._focusAudioSuggestion(suggestion, extra),
      onRejectSuggestion: async (suggestion) => this._rejectAudioSuggestion(suggestion),
    });
    await this.refresh();
  }

  async _runAudioImportFlow() {
    if (!this.view?.meetingId || this.view?.isReadOnly) return;
    if (!(await this.view._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (typeof api.audioImport !== "function") {
      alert("Audio-Funktionen sind nicht verf\u00fcgbar.");
      return;
    }
    try {
      this.transcriptionService.ensureSuggestionsAvailable();
    } catch (err) {
      alert(err?.message || "Audio-Funktionen sind nicht verf\u00fcgbar.");
      return;
    }

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Sprachdatei wird importiert...";
    await this.refresh({ statusMessage: this._audioPanelStatusMessage });

    try {
      const importRes = await api.audioImport({
        meetingId: this.view.meetingId,
        projectId: this.view.projectId || this.view.router?.currentProjectId || null,
        processingMode: "review",
      });
      if (importRes?.canceled) {
        this._audioPanelStatusMessage = "Auswahl abgebrochen.";
        return;
      }
      if (!importRes?.ok || !importRes.audioImport?.id) {
        throw new Error(importRes?.error || "Audio-Import fehlgeschlagen.");
      }

      const audioImportId = importRes.audioImport.id;
      this._audioPanelStatusMessage = "Lokale Transkription wird gestartet...";
      await this.refresh({ statusMessage: this._audioPanelStatusMessage });

      const transcribeRes = await this.transcriptionService.transcribe({ audioImportId });
      if (!transcribeRes?.ok) {
        throw new Error(transcribeRes?.error || "Transkription fehlgeschlagen.");
      }

      this._audioPanelStatusMessage = "Zuordnungslogik wird als Platzhalter ausgef\u00fchrt...";
      await this.refresh({ statusMessage: this._audioPanelStatusMessage });

      const analyzeRes = await this.transcriptionService.analyze({
        audioImportId,
        processingMode: "review",
      });
      if (!analyzeRes?.ok) {
        throw new Error(analyzeRes?.error || "Analyse fehlgeschlagen.");
      }

      this._audioPanelStatusMessage =
        analyzeRes?.message ||
        "Transkript gespeichert. Die TOP-Zuordnung bleibt in diesem Stand noch ein klar markierter Platzhalter.";
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this.refresh({ statusMessage: this._audioPanelStatusMessage });
    }
  }

  async _createDemoAudioSuggestion(demoType) {
    if (!this.view?.meetingId || this.view?.isReadOnly) return;
    if (!(await this.view._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (typeof api.audioCreateDemoSuggestion !== "function") {
      alert("audioCreateDemoSuggestion ist nicht verf\u00fcgbar.");
      return;
    }

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Demo-Vorschlag wird angelegt...";
    await this.refresh({ statusMessage: this._audioPanelStatusMessage });

    try {
      const res = await api.audioCreateDemoSuggestion({
        meetingId: this.view.meetingId,
        demoType,
      });
      if (!res?.ok) {
        throw new Error(res?.error || "Demo-Vorschlag konnte nicht angelegt werden.");
      }
      this._audioPanelStatusMessage = res?.message || "Demo-Vorschlag wurde zur Pr\u00fcfung angelegt.";
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this.refresh({ statusMessage: this._audioPanelStatusMessage });
    }
  }

  async _applyAudioSuggestion(suggestion, options = {}) {
    if (!(await this.view._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (typeof api.audioApplySuggestion !== "function") {
      alert("audioApplySuggestion ist nicht verf?gbar.");
      return;
    }

    const suggestionId = String(suggestion?.id || "").trim();
    if (!suggestionId) return;

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Vorschlag wird \u00fcbernommen...";
    await this.refresh({ statusMessage: this._audioPanelStatusMessage });

    try {
      const res = await api.audioApplySuggestion({
        suggestionId,
        overrideParentTopId: String(options?.overrideParentTopId || "").trim() || null,
      });
      if (!res?.ok) {
        throw new Error(res?.error || "Vorschlag konnte nicht \u00fcbernommen werden.");
      }
      this._audioPanelStatusMessage = String(res?.message || "Vorschlag \u00fcbernommen.");
      await this.view.reloadList(true);
      await this._focusAudioSuggestion(suggestion, options);
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this.refresh({ statusMessage: this._audioPanelStatusMessage });
    }
  }

  async _rejectAudioSuggestion(suggestion) {
    if (!(await this.view._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (typeof api.audioRejectSuggestion !== "function") {
      alert("audioRejectSuggestion ist nicht verf\u00fcgbar.");
      return;
    }

    const suggestionId = String(suggestion?.id || "").trim();
    if (!suggestionId) return;

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Vorschlag wird verworfen...";
    await this.refresh({ statusMessage: this._audioPanelStatusMessage });

    try {
      const res = await api.audioRejectSuggestion({ suggestionId });
      if (!res?.ok) {
        throw new Error(res?.error || "Vorschlag konnte nicht verworfen werden.");
      }
      this._audioPanelStatusMessage = String(res?.message || "Vorschlag verworfen.");
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this.refresh({ statusMessage: this._audioPanelStatusMessage });
    }
  }

  async _focusAudioSuggestion(suggestion, options = {}) {
    const overrideParentTopId = String(options?.overrideParentTopId || "").trim() || null;
    const type = String(suggestion?.type || "").trim();

    let targetTopId = null;
    if (type === "append_to_top") {
      targetTopId = String(suggestion?.target_top_id || suggestion?.targetTopId || "").trim() || null;
    } else if (overrideParentTopId) {
      targetTopId = overrideParentTopId;
    } else if (type === "create_child_top") {
      targetTopId = String(suggestion?.parent_top_id || suggestion?.parentTopId || "").trim() || null;
    } else if (type === "manual_assign_child_top") {
      targetTopId = String(this._findManualAssignTop()?.id || "").trim() || null;
    }

    if (!targetTopId) return;
    const target = this.view._findTopById(targetTopId);
    if (!target) return;

    this.view.selectedTopId = target.id;
    this.view.selectedTop = target;
    this.view._userSelectedTop = true;
    this.view.applyEditBoxState();
    this.view.dictationController?.updateButtons();
    this.view._updateMoveControls();
    this.view._updateDeleteControls();
    this.view._updateCreateChildControls();
    this.view._setMarkedTopIds([target.id]);

    if (this._audioSuggestionMarkTimer) {
      clearTimeout(this._audioSuggestionMarkTimer);
      this._audioSuggestionMarkTimer = null;
    }
    this._audioSuggestionMarkTimer = setTimeout(() => {
      this.view._clearMarkedTopIds();
      this._audioSuggestionMarkTimer = null;
    }, 2500);

    this.view._renderListOnly();
    requestAnimationFrame(() => this.view._scrollListToSelectedAndEnd());
  }

  _manualAssignTitle() {
    return "Manuell zuordnen";
  }

  _normalizeManualAssignTitle(value) {
    return String(value || "").trim().toLocaleLowerCase("de-DE");
  }

  _findManualAssignTop() {
    const target = this._normalizeManualAssignTitle(this._manualAssignTitle());
    return (
      (this.view?.items || []).find((item) => {
        return Number(item?.level) === 1 && this._normalizeManualAssignTitle(item?.title) === target;
      }) || null
    );
  }

  _hasManualAssignChildren() {
    const manualAssignTop = this._findManualAssignTop();
    if (!manualAssignTop?.id) return false;
    const itemById = new Map((this.view?.items || []).map((item) => [String(item.id), item]));
    const rootId = String(manualAssignTop.id);
    return (this.view?.items || []).some((item) => {
      if (Number(item?.is_hidden || 0) === 1) return false;
      let parentId = String(item?.parent_top_id || "").trim();
      while (parentId) {
        if (parentId === rootId) return true;
        parentId = String(itemById.get(parentId)?.parent_top_id || "").trim();
      }
      return false;
    });
  }

  _getAudioParentOptions() {
    const list = Array.isArray(this.view?.items) ? this.view.items : [];
    return list
      .filter((item) => {
        const level = Number(item?.level || 0);
        return Number(item?.is_hidden || 0) !== 1 && level >= 1 && level < 4;
      })
      .map((item) => {
        const level = Math.max(1, Number(item?.level || 1));
        const prefix = level > 1 ? `${"  ".repeat(level - 1)}- ` : "";
        const number = String(item?.number || "").trim();
        const title = String(item?.title || "").trim();
        const label = `${prefix}${number ? `${number} ` : ""}${title || item?.id || ""}`.trim();
        return {
          id: String(item.id),
          label,
          level,
        };
      });
  }

  async warnAboutManualAssignBeforeClose() {
    if (!this._hasManualAssignChildren()) return true;
    return window.confirm(
      "Im Bereich 'Manuell zuordnen' befinden sich noch nicht zugeordnete Punkte.\n\nTrotzdem abschließen?"
    );
  }

  onEnterIdleAfterClose() {
    if (this._audioPanel && typeof this._audioPanel.close === "function") {
      this._audioPanel.close();
    }
  }

  onTopCleared() {
    if (this._audioSuggestionMarkTimer) {
      clearTimeout(this._audioSuggestionMarkTimer);
      this._audioSuggestionMarkTimer = null;
    }
  }

  destroy() {
    try {
      if (this._audioPanel && typeof this._audioPanel.destroy === "function") {
        this._audioPanel.destroy();
      }
    } catch (_err) {
      // ignore cleanup issues
    }
    if (this._audioSuggestionMarkTimer) {
      clearTimeout(this._audioSuggestionMarkTimer);
      this._audioSuggestionMarkTimer = null;
    }
    this._audioPanel = null;
  }
}
