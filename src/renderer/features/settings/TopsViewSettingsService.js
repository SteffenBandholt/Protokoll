export class TopsViewSettingsService {
  constructor({ view }) {
    this.view = view;
  }

  async loadAmpelSetting() {
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany !== "function") {
      this.view.showAmpelInList = true;
      this.view._applyAmpelVisibility();
      if (typeof this.view._updateAmpelToggleUi === "function") this.view._updateAmpelToggleUi();
      this.view._emitAmpelStateChanged();
      return;
    }

    const res = await api.appSettingsGetMany(["tops.ampelEnabled"]);
    if (!res?.ok) {
      this.view.showAmpelInList = true;
      this.view._applyAmpelVisibility();
      if (typeof this.view._updateAmpelToggleUi === "function") this.view._updateAmpelToggleUi();
      this.view._emitAmpelStateChanged();
      return;
    }

    const data = res.data || {};
    this.view.showAmpelInList = this.view._parseBool(data["tops.ampelEnabled"], true);
    this.view._applyAmpelVisibility();
    if (typeof this.view._updateAmpelToggleUi === "function") this.view._updateAmpelToggleUi();
    this.view._emitAmpelStateChanged();
  }

  async saveAmpelSetting() {
    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany !== "function") return;

    const res = await api.appSettingsSetMany({
      "tops.ampelEnabled": this.view.showAmpelInList ? "true" : "false",
    });
    if (!res?.ok) {
      alert(res?.error || "Speichern fehlgeschlagen");
    }
  }
}
