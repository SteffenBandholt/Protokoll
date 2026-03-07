const { ipcMain } = require("electron");
const projectSettingsRepo = require("../db/projectSettingsRepo");

const ALLOWED_KEYS = new Set([
  "pdf.protocolTitle",
  "pdf.footerPlace",
  "pdf.footerDate",
  "pdf.footerName1",
  "pdf.footerName2",
  "pdf.footerRecorder",
  "pdf.footerStreet",
  "pdf.footerZip",
  "pdf.footerCity",
  "pdf.footerUseUserData",
]);

function _normalizeProjectId(data) {
  const value = String(data?.projectId ?? data?.project_id ?? data?.id ?? "").trim();
  if (!value) throw new Error("projectId required");
  return value;
}

function _cleanKeys(keys) {
  return (Array.isArray(keys) ? keys : [])
    .map((key) => String(key || "").trim())
    .filter((key) => ALLOWED_KEYS.has(key));
}

function _cleanPatch(patch) {
  const out = {};
  for (const [rawKey, rawValue] of Object.entries(patch || {})) {
    const key = String(rawKey || "").trim();
    if (!ALLOWED_KEYS.has(key)) continue;
    out[key] = rawValue == null ? "" : String(rawValue);
  }
  return out;
}

function registerProjectSettingsIpc() {
  ipcMain.handle("projectSettings:getMany", (_evt, data) => {
    try {
      const projectId = _normalizeProjectId(data || {});
      const keys = _cleanKeys(data?.keys);
      return { ok: true, data: projectSettingsRepo.getMany(projectId, keys) };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("projectSettings:setMany", (_evt, data) => {
    try {
      const projectId = _normalizeProjectId(data || {});
      const patch = _cleanPatch(data?.patch || {});
      projectSettingsRepo.setMany(projectId, patch);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
}

module.exports = { registerProjectSettingsIpc, PROJECT_PRINT_SETTINGS_KEYS: [...ALLOWED_KEYS] };
