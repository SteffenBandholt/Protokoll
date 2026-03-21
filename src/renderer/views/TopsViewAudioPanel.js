import AudioSuggestionsPanel from "../ui/AudioSuggestionsPanel.js";

export function attachTopsViewAudioPanel(TopsViewClass) {
  Object.assign(TopsViewClass.prototype, {
    _getAudioPanel() {
      if (!this._audioPanel) {
        this._audioPanel = new AudioSuggestionsPanel();
      }
      return this._audioPanel;
    },

    _applyAudioReadOnlyState() {
      const ro = !!this.isReadOnly;
      const busy = !!this._busy;
      if (this.btnAudioAnalyze) {
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
      }
      this._updateDictationButtons();
    },

    _closeAudioPanelIfOpen() {
      if (this._audioPanel && typeof this._audioPanel.close === "function") {
        this._audioPanel.close();
      }
    },

    _destroyAudioResources() {
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
    },
  });
}
