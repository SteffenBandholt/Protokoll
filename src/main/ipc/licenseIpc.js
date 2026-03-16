const fs = require("fs");
const { app, BrowserWindow, dialog, ipcMain } = require("electron");

const { checkLicense, getStatus } = require("../licensing/licenseService");
const { getMachineId } = require("../licensing/deviceIdentity");
const { saveLicenseData } = require("../licensing/licenseStorage");
const { verifyLicense } = require("../licensing/licenseVerifier");

const LICENSE_FILE_FILTER = [
  {
    name: "BBM Lizenz",
    extensions: ["bbmlic", "json"],
  },
];

function _getExpiryInfo(validUntil) {
  const raw = String(validUntil || "").trim();
  if (!raw) {
    return {
      daysRemaining: null,
      expiresSoon: false,
      expired: false,
    };
  }

  const expiry = new Date(raw);
  if (Number.isNaN(expiry.getTime())) {
    return {
      daysRemaining: null,
      expiresSoon: false,
      expired: false,
    };
  }

  const diffMs = expiry.getTime() - Date.now();
  const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  const expired = diffMs < 0;
  const expiresSoon = !expired && daysRemaining <= 14;

  return {
    daysRemaining,
    expiresSoon,
    expired,
  };
}

function _toStatusPayload(result) {
  const license = result?.license && typeof result.license === "object" ? result.license : {};
  const expiryInfo = _getExpiryInfo(license.validUntil);
  const payload = {
    valid: !!result?.valid,
    reason: String(result?.reason || ""),
    customerName: String(
      license.customerName || license.customer || license.customer_name || license.customer_name_full || ""
    ).trim(),
    licenseId: String(license.licenseId || license.id || "").trim(),
    edition: String(license.edition || "").trim(),
    validUntil: String(license.validUntil || "").trim(),
    features: Array.isArray(license.features) ? license.features : [],
    machineId: String(getMachineId() || "").trim(),
    appVersion: String(app?.getVersion?.() || "").trim(),
    daysRemaining: expiryInfo.daysRemaining,
    expiresSoon: expiryInfo.expiresSoon,
    expired: expiryInfo.expired,
  };

  payload.diagnosticsText = _formatDiagnosticsText(payload);
  return payload;
}

function _formatDiagnosticsText(payload = {}) {
  const valid = !!payload.valid;
  const reason = String(payload.reason || "").trim();
  const features = Array.isArray(payload.features) ? payload.features : [];

  return [
    `Lizenzstatus: ${valid ? "gueltig" : "ungueltig"}`,
    `Grund: ${reason || "-"}`,
    `Kunde: ${String(payload.customerName || "").trim() || "-"}`,
    `Lizenz-ID: ${String(payload.licenseId || "").trim() || "-"}`,
    `Edition: ${String(payload.edition || "").trim() || "-"}`,
    `Gueltig bis: ${String(payload.validUntil || "").trim() || "-"}`,
    `Machine-ID: ${String(payload.machineId || "").trim() || "-"}`,
    `App-Version: ${String(payload.appVersion || "").trim() || "-"}`,
    `Features: ${features.length ? features.join(",") : "-"}`,
  ].join("\n");
}

function _readLicenseFile(filePath) {
  let parsed;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    parsed = JSON.parse(raw);
  } catch (err) {
    const parseError = new Error("Lizenzdatei ist kein gueltiges JSON.");
    parseError.code = "INVALID_FORMAT";
    throw parseError;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const err = new Error("Lizenzdatei hat ein ungueltiges Format.");
    err.code = "INVALID_FORMAT";
    throw err;
  }

  if (!parsed.license || typeof parsed.license !== "object" || !parsed.signature) {
    const err = new Error("Lizenzdatei muss license und signature enthalten.");
    err.code = "INVALID_FORMAT";
    throw err;
  }

  return parsed;
}

async function _pickLicenseFile(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win || null, {
    properties: ["openFile"],
    filters: LICENSE_FILE_FILTER,
    title: "Lizenzdatei auswaehlen",
  });

  if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
    return null;
  }

  return String(result.filePaths[0] || "").trim();
}

function registerLicenseIpc() {
  ipcMain.handle("license:get-status", async () => {
    try {
      const status = getStatus({ fresh: true });
      return { ok: true, ..._toStatusPayload(status) };
    } catch (err) {
      return {
        ok: false,
        error: err?.message || String(err),
        ..._toStatusPayload({ valid: false, reason: "INVALID_FORMAT" }),
      };
    }
  });

  ipcMain.handle("license:import", async (event, payload) => {
    try {
      const data = payload && typeof payload === "object" ? payload : {};
      let filePath = String(data.filePath || "").trim();

      if (!filePath) {
        filePath = await _pickLicenseFile(event);
        if (!filePath) return { ok: true, canceled: true };
      }

      const licenseData = _readLicenseFile(filePath);
      const validation = verifyLicense(licenseData);
      if (!validation?.valid) {
        return {
          ok: false,
          filePath,
          ..._toStatusPayload(validation),
          error: `Lizenz konnte nicht importiert werden (${validation?.reason || "INVALID_FORMAT"}).`,
        };
      }

      saveLicenseData(licenseData);

      const status = checkLicense();
      return {
        ok: true,
        filePath,
        ..._toStatusPayload(status),
      };
    } catch (err) {
      const code = String(err?.code || "INVALID_FORMAT").trim() || "INVALID_FORMAT";
      return {
        ok: false,
        error: err?.message || String(err),
        ..._toStatusPayload({ valid: false, reason: code }),
      };
    }
  });

  ipcMain.handle("license:get-diagnostics", async () => {
    try {
      const status = _toStatusPayload(getStatus({ fresh: true }));
      return {
        ok: true,
        ...status,
        diagnosticsText: _formatDiagnosticsText(status),
      };
    } catch (err) {
      const fallback = _toStatusPayload({ valid: false, reason: "INVALID_FORMAT" });
      return {
        ok: false,
        error: err?.message || String(err),
        ...fallback,
        diagnosticsText: _formatDiagnosticsText(fallback),
      };
    }
  });
}

module.exports = {
  registerLicenseIpc,
};
