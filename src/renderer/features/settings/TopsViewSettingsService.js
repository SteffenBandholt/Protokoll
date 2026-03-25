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

  async loadLongtextSetting() {
    if (this.view._longtextSettingLoaded) return;
    const key = "tops.showLongtextInList";
    const api = window.bbmDb || {};
    if (typeof api.appSettingsGetMany === "function") {
      const res = await api.appSettingsGetMany([key]);
      if (res?.ok) {
        const data = res.data || {};
        this.view.showLongtextInList = this.view._parseBool(data[key], this.view.showLongtextInList);
      }
      this.view._longtextSettingLoaded = true;
      this.view._emitLongtextStateChanged();
      return;
    }

    try {
      const raw = window.localStorage?.getItem?.(key);
      if (raw != null) {
        this.view.showLongtextInList = this.view._parseBool(raw, this.view.showLongtextInList);
      }
    } catch (_e) {
      // ignore
    }
    this.view._longtextSettingLoaded = true;
    this.view._emitLongtextStateChanged();
  }

  async saveLongtextSetting() {
    const key = "tops.showLongtextInList";
    const api = window.bbmDb || {};
    if (typeof api.appSettingsSetMany === "function") {
      await api.appSettingsSetMany({ [key]: this.view.showLongtextInList ? "1" : "0" });
      return;
    }
    try {
      window.localStorage?.setItem?.(key, this.view.showLongtextInList ? "1" : "0");
    } catch (_e) {
      // ignore
    }
  }
}
