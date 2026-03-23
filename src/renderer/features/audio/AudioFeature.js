import AudioSuggestionsPanel from "../../ui/AudioSuggestionsPanel.js";

export function attachAudioFeature(view) {
  view._audioPanel = null;
  view._audioPanelBusy = false;
  view._audioPanelStatusMessage = "";
  view._audioLicensed = false;
  view._audioLicenseChecked = false;
  view._audioLicenseMessage = "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
  view._audioLicenseLoading = null;
  view._audioDevOverride = false;
  view._audioDevOverrideChecked = false;
  view._audioDevOverrideLoading = null;
  view._audioSuggestionsDevEnabled = false;
  view._audioSuggestionsDevChecked = false;
  view._audioSuggestionsDevLoading = null;
  view._audioSuggestionMarkTimer = null;

  Object.assign(view, {
    _getAudioPanel() {
      if (!this._audioPanel) {
        this._audioPanel = new AudioSuggestionsPanel();
      }
      return this._audioPanel;
    },

    _formatAudioLicenseMessage(status = null) {
      if (status?.valid) {
        return "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
      }

      const reason = String(status?.reason || "").trim();
      switch (reason) {
        case "NO_LICENSE":
          return "Audio erfordert eine gueltige Lizenz.";
        case "LICENSE_EXPIRED":
          return "Audio ist gesperrt, weil die Lizenz abgelaufen ist.";
        case "WRONG_MACHINE":
          return "Audio ist gesperrt, weil diese Lizenz zu einem anderen Rechner gehoert.";
        case "PUBLIC_KEY_INVALID":
        case "PUBLIC_KEY_MISSING":
          return "Audio bleibt gesperrt, weil die lokale Signaturpruefung nicht vollstaendig eingerichtet ist.";
        default:
          return "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
      }
    },

    _buildLockedAudioPanelState(message) {
      return {
        title: "Sprachdatei auswerten",
        modeLabel: "Pruefmodus",
        busy: false,
        statusMessage: String(message || this._audioLicenseMessage || "").trim(),
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
    },

    _setAudioLicenseState(licensed, message = "") {
      this._audioLicensed = !!licensed;
      this._audioLicenseChecked = true;
      this._audioLicenseMessage = this._audioLicensed
        ? ""
        : (String(message || "").trim() || "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.");
      this.dictationController?.updateButtons();

      if (this.root) {
        this.applyEditBoxState();
      }

      if (this._audioPanel && !this._audioLicensed) {
        this._audioPanelBusy = false;
        this._audioPanelStatusMessage = this._audioLicenseMessage;
        this._audioPanel.update(this._buildLockedAudioPanelState(this._audioPanelStatusMessage));
      }
    },

    async _loadAudioLicenseState(force = false) {
      if (!force && this._audioLicenseChecked) return this._audioLicensed;
      if (!force && this._audioLicenseLoading) return this._audioLicenseLoading;

      const task = (async () => {
        const devOverride = await this._loadAudioDevOverrideState(force);
        await this._loadAudioSuggestionsDevFlag(force);
        if (devOverride) {
          this._setAudioLicenseState(true, "");
          return true;
        }

        const api = window.bbmDb || {};
        if (typeof api.licenseGetStatus !== "function") {
          this._setAudioLicenseState(false, "Lizenzstatus ist nicht verfuegbar. Audio bleibt gesperrt.");
          return false;
        }

        try {
          const res = await api.licenseGetStatus();
          const features = Array.isArray(res?.features)
            ? res.features.map((value) => String(value || "").trim().toLowerCase())
            : [];
          const licensed = !!res?.ok && !!res?.valid && features.includes("audio");
          this._setAudioLicenseState(licensed, this._formatAudioLicenseMessage(res));
          return licensed;
        } catch (_err) {
          this._setAudioLicenseState(false, "Lizenzstatus konnte nicht geladen werden. Audio bleibt gesperrt.");
          return false;
        } finally {
          this._audioLicenseLoading = null;
        }
      })();

      this._audioLicenseLoading = task;
      return task;
    },

    async _loadAudioDevOverrideState(force = false) {
      if (!force && this._audioDevOverrideChecked) return this._audioDevOverride;
      if (!force && this._audioDevOverrideLoading) return this._audioDevOverrideLoading;

      const task = (async () => {
        const api = window.bbmDb || {};
        const readDevFallback = async () => {
          if (typeof api.appGetBuildChannel === "function") {
            try {
              const res = await api.appGetBuildChannel();
              const channel = String(res?.channel || "").trim().toLowerCase();
              if (res?.ok && channel === "dev") return true;
            } catch (_err) {
              // ignore
            }
          }
          if (typeof api.appIsPackaged !== "function") return false;
          try {
            const packaged = await api.appIsPackaged();
            return packaged === false;
          } catch (_err) {
            return false;
          }
        };

        if (typeof api.devAudioUnlockStatus !== "function") {
          this._audioDevOverride = await readDevFallback();
          this._audioDevOverrideChecked = true;
          this.dictationController?.updateButtons();
          return this._audioDevOverride;
        }

        try {
          const res = await api.devAudioUnlockStatus();
          const enabled = !!res?.ok && !!res?.enabled;
          const fallback = enabled ? false : await readDevFallback();
          this._audioDevOverride = enabled;
          this._audioDevOverrideChecked = true;
          this.dictationController?.updateButtons();
          if (fallback) {
            this._audioDevOverride = true;
            this.dictationController?.updateButtons();
            return true;
          }
          return enabled;
        } catch (_err) {
          this._audioDevOverride = await readDevFallback();
          this._audioDevOverrideChecked = true;
          this.dictationController?.updateButtons();
          return this._audioDevOverride;
        } finally {
          this._audioDevOverrideLoading = null;
        }
      })();

      this._audioDevOverrideLoading = task;
      return task;
    },

    async _loadAudioSuggestionsDevFlag(force = false) {
      if (!force && this._audioSuggestionsDevChecked) return this._audioSuggestionsDevEnabled;
      if (!force && this._audioSuggestionsDevLoading) return this._audioSuggestionsDevLoading;

      const task = (async () => {
        const api = window.bbmDb || {};
        if (typeof api.devAudioSuggestionsEnabled !== "function") {
          this._audioSuggestionsDevEnabled = false;
          this._audioSuggestionsDevChecked = true;
          this._applyReadOnlyState();
          return this._audioSuggestionsDevEnabled;
        }

        try {
          const res = await api.devAudioSuggestionsEnabled();
          this._audioSuggestionsDevEnabled = !!res?.ok && !!res?.enabled;
          this._audioSuggestionsDevChecked = true;
          this._applyReadOnlyState();
          return this._audioSuggestionsDevEnabled;
        } catch (_err) {
          this._audioSuggestionsDevEnabled = false;
          this._audioSuggestionsDevChecked = true;
          this._applyReadOnlyState();
          return this._audioSuggestionsDevEnabled;
        } finally {
          this._audioSuggestionsDevLoading = null;
        }
      })();

      this._audioSuggestionsDevLoading = task;
      return task;
    },

    async _ensureAudioAvailable({ alertOnFailure = true, force = false } = {}) {
      const licensed = await this._loadAudioLicenseState(force);
      if (licensed) return true;

      if (alertOnFailure) {
        alert(this._audioLicenseMessage || "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.");
      }
      return false;
    },

    _manualAssignTitle() {
      return "Manuell zuordnen";
    },

    _normalizeManualAssignTitle(value) {
      return String(value || "").trim().toLocaleLowerCase("de-DE");
    },

    _findManualAssignTop() {
      const target = this._normalizeManualAssignTitle(this._manualAssignTitle());
      return (
        (this.items || []).find((item) => {
          return Number(item?.level) === 1 && this._normalizeManualAssignTitle(item?.title) === target;
        }) || null
      );
    },

    _hasManualAssignChildren() {
      const manualAssignTop = this._findManualAssignTop();
      if (!manualAssignTop?.id) return false;
      const itemById = new Map((this.items || []).map((item) => [String(item.id), item]));
      const rootId = String(manualAssignTop.id);
      return (this.items || []).some((item) => {
        if (Number(item?.is_hidden || 0) === 1) return false;
        let parentId = String(item?.parent_top_id || "").trim();
        while (parentId) {
          if (parentId === rootId) return true;
          parentId = String(itemById.get(parentId)?.parent_top_id || "").trim();
        }
        return false;
      });
    },

    _getAudioParentOptions() {
      const list = Array.isArray(this.items) ? this.items : [];
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
    },

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
      const target = this._findTopById(targetTopId);
      if (!target) return;

      this.selectedTopId = target.id;
      this.selectedTop = target;
      this._userSelectedTop = true;
      this.applyEditBoxState();
      this.dictationController?.updateButtons();
      this._updateMoveControls();
      this._updateDeleteControls();
      this._updateCreateChildControls();
      this._setMarkedTopIds([target.id]);

      if (this._audioSuggestionMarkTimer) {
        clearTimeout(this._audioSuggestionMarkTimer);
        this._audioSuggestionMarkTimer = null;
      }
      this._audioSuggestionMarkTimer = setTimeout(() => {
        this._clearMarkedTopIds();
        this._audioSuggestionMarkTimer = null;
      }, 2500);

      this._renderListOnly();
      requestAnimationFrame(() => this._scrollListToSelectedAndEnd());
    },

    async _warnAboutManualAssignBeforeClose() {
      if (!this._hasManualAssignChildren()) return true;
      return window.confirm(
        "Im Bereich 'Manuell zuordnen' befinden sich noch nicht zugeordnete Punkte.\n\nTrotzdem abschließen?"
      );
    },

    async _loadAudioSuggestions() {
      if (!(await this._ensureAudioAvailable({ alertOnFailure: false }))) {
        return { suggestions: [], audioImport: null, transcript: null };
      }

      if (!this.meetingId || typeof window?.bbmDb?.audioGetSuggestions !== "function") {
        return { suggestions: [], audioImport: null, transcript: null };
      }

      const res = await window.bbmDb.audioGetSuggestions({
        meetingId: this.meetingId,
        status: "pending",
      });
      if (!res?.ok) throw new Error(res?.error || "Vorschläge konnten nicht geladen werden.");
      return {
        suggestions: Array.isArray(res.list) ? res.list : [],
        audioImport: res.audioImport || null,
        transcript: res.transcript || null,
      };
    },

    async _refreshAudioPanel(options = {}) {
      const panel = this._getAudioPanel();
      const forceMessage =
        options && Object.prototype.hasOwnProperty.call(options, "statusMessage")
          ? options.statusMessage
          : undefined;

      if (!(await this._loadAudioLicenseState())) {
        panel.update(
          this._buildLockedAudioPanelState(
            forceMessage !== undefined ? String(forceMessage || "") : this._audioLicenseMessage
          )
        );
        return;
      }

      try {
        const audioState = await this._loadAudioSuggestions();
        const suggestions = Array.isArray(audioState?.suggestions) ? audioState.suggestions : [];
        const fallbackMessage = suggestions.length
          ? ""
          : "Aktuell liegen keine Vorschläge vor. Die Transkription ist real angebunden, die Zuordnungslogik bleibt noch Platzhalter.";
        panel.update({
          title: "Sprachdatei auswerten",
          modeLabel: "Prüfmodus",
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
          modeLabel: "Prüfmodus",
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
    },

    async _openAudioPanel() {
      if (!this.meetingId || this.isReadOnly) return;
      const panel = this._getAudioPanel();

      if (!(await this._loadAudioLicenseState())) {
        panel.open(this._buildLockedAudioPanelState(this._audioLicenseMessage));
        return;
      }
      if (!(await this._loadAudioSuggestionsDevFlag())) {
        alert("Audio-Suggestions sind nur in der Entwicklung verfügbar.");
        return;
      }

      panel.open({
        title: "Sprachdatei auswerten",
        modeLabel: "Prüfmodus",
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
      await this._refreshAudioPanel();
    },

    async _runAudioImportFlow() {
      if (!this.meetingId || this.isReadOnly) return;
      if (!(await this._ensureAudioAvailable())) return;
      const api = window.bbmDb || {};
      if (
        typeof api.audioImport !== "function" ||
        typeof api.audioTranscribe !== "function" ||
        typeof api.audioAnalyze !== "function"
      ) {
        alert("Audio-Funktionen sind nicht verfügbar.");
        return;
      }

      this._audioPanelBusy = true;
      this._audioPanelStatusMessage = "Sprachdatei wird importiert...";
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

      try {
        const importRes = await api.audioImport({
          meetingId: this.meetingId,
          projectId: this.projectId || this.router?.currentProjectId || null,
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
        await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

        const transcribeRes = await api.audioTranscribe({ audioImportId });
        if (!transcribeRes?.ok) {
          throw new Error(transcribeRes?.error || "Transkription fehlgeschlagen.");
        }

        this._audioPanelStatusMessage = "Zuordnungslogik wird als Platzhalter ausgeführt...";
        await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

        const analyzeRes = await api.audioAnalyze({
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
        await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
      }
    },

    async _createDemoAudioSuggestion(demoType) {
      if (!this.meetingId || this.isReadOnly) return;
      if (!(await this._ensureAudioAvailable())) return;
      const api = window.bbmDb || {};
      if (typeof api.audioCreateDemoSuggestion !== "function") {
        alert("audioCreateDemoSuggestion ist nicht verfügbar.");
        return;
      }

      this._audioPanelBusy = true;
      this._audioPanelStatusMessage = "Demo-Vorschlag wird angelegt...";
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

      try {
        const res = await api.audioCreateDemoSuggestion({
          meetingId: this.meetingId,
          demoType,
        });
        if (!res?.ok) {
          throw new Error(res?.error || "Demo-Vorschlag konnte nicht angelegt werden.");
        }
        this._audioPanelStatusMessage = res?.message || "Demo-Vorschlag wurde zur Prüfung angelegt.";
      } catch (err) {
        this._audioPanelStatusMessage = err?.message || String(err);
      } finally {
        this._audioPanelBusy = false;
        await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
      }
    },

    async _applyAudioSuggestion(suggestion, options = {}) {
      if (!(await this._ensureAudioAvailable())) return;
      const api = window.bbmDb || {};
      if (typeof api.audioApplySuggestion !== "function") {
        alert("audioApplySuggestion ist nicht verfügbar.");
        return;
      }

      const suggestionId = String(suggestion?.id || "").trim();
      if (!suggestionId) return;

      this._audioPanelBusy = true;
      this._audioPanelStatusMessage = "Vorschlag wird übernommen...";
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

      try {
        const res = await api.audioApplySuggestion({
          suggestionId,
          overrideParentTopId: String(options?.overrideParentTopId || "").trim() || null,
        });
        if (!res?.ok) {
          throw new Error(res?.error || "Vorschlag konnte nicht übernommen werden.");
        }
        this._audioPanelStatusMessage = String(res?.message || "Vorschlag übernommen.");
        await this.reloadList(true);
        await this._focusAudioSuggestion(suggestion, options);
      } catch (err) {
        this._audioPanelStatusMessage = err?.message || String(err);
      } finally {
        this._audioPanelBusy = false;
        await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
      }
    },

    async _rejectAudioSuggestion(suggestion) {
      if (!(await this._ensureAudioAvailable())) return;
      const api = window.bbmDb || {};
      if (typeof api.audioRejectSuggestion !== "function") {
        alert("audioRejectSuggestion ist nicht verfügbar.");
        return;
      }

      const suggestionId = String(suggestion?.id || "").trim();
      if (!suggestionId) return;

      this._audioPanelBusy = true;
      this._audioPanelStatusMessage = "Vorschlag wird verworfen...";
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

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
        await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
      }
    },

    _applyAudioReadOnlyState(ro, busy) {
      if (!this.btnAudioAnalyze) return;
      const audioLocked = !this._audioLicensed && !this._audioDevOverride;
      const allowLegacy = !!this._audioSuggestionsDevEnabled;
      this.btnAudioAnalyze.disabled = ro || busy || !this.meetingId || audioLocked || !allowLegacy;
      this.btnAudioAnalyze.style.opacity = this.btnAudioAnalyze.disabled ? "0.65" : "1";
      this.btnAudioAnalyze.style.display = allowLegacy ? "" : "none";
      this.btnAudioAnalyze.title = audioLocked
        ? this._audioLicenseMessage
        : allowLegacy
        ? "Audio-Suggestions (DEV)"
        : "Audio-Mapping ist deaktiviert";
      this.dictationController?.updateButtons();
    },

    _audioOnTopCleared() {
      if (this._termPromptCleanup) this._termPromptCleanup();
      this._pendingTermPrompt = null;
    },

    _audioOnEnterIdleAfterClose() {
      if (this._audioPanel && typeof this._audioPanel.close === "function") {
        this._audioPanel.close();
      }
    },

    async _audioDestroy() {
      try {
        if (this._audioPanel && typeof this._audioPanel.destroy === "function") {
          await this._audioPanel.destroy();
        }
      } catch (_err) {
        // ignore cleanup issues
      }
      if (this._audioSuggestionMarkTimer) {
        clearTimeout(this._audioSuggestionMarkTimer);
        this._audioSuggestionMarkTimer = null;
      }
      this._audioPanel = null;
    },
  });
}
