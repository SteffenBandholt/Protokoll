export function attachAudioFeature(view) {
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

  Object.assign(view, {
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

      this.audioSuggestionsFlow?.applyReadOnlyState?.(this.isReadOnly, this._busy);
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
          this.audioSuggestionsFlow?.applyReadOnlyState?.(this.isReadOnly, this._busy);
          return this._audioDevOverride;
        }

        try {
          const res = await api.devAudioUnlockStatus();
          const enabled = !!res?.ok && !!res?.enabled;
          const fallback = enabled ? false : await readDevFallback();
          this._audioDevOverride = enabled;
          this._audioDevOverrideChecked = true;
          this.dictationController?.updateButtons();
          this.audioSuggestionsFlow?.applyReadOnlyState?.(this.isReadOnly, this._busy);
          if (fallback) {
            this._audioDevOverride = true;
            this.dictationController?.updateButtons();
            this.audioSuggestionsFlow?.applyReadOnlyState?.(this.isReadOnly, this._busy);
            return true;
          }
          return enabled;
        } catch (_err) {
          this._audioDevOverride = await readDevFallback();
          this._audioDevOverrideChecked = true;
          this.dictationController?.updateButtons();
          this.audioSuggestionsFlow?.applyReadOnlyState?.(this.isReadOnly, this._busy);
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
  });
}
