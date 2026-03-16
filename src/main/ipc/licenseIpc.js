// src/main/ipc/licenseIpc.js

const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs");

const { saveLicense, loadLicense, deleteLicense } = require("../licensing/licenseStorage");
const { getMachineId } = require("../licensing/deviceIdentity");
const { verifyLicense } = require("../licensing/licenseVerifier");
const { refreshStatus, getStatus } = require("../licensing/licenseService");

const LICENSE_FILE_FILTER = [
  {
    name: "BBM Lizenz",
    extensions: ["bbmlic", "json"],
  },
];

function _getExpiryInfo(validUntil) {
  const raw = String(validUntil || "").trim();
  if (!raw) {
    return { daysRemaining: null, expiresSoon: false, expired: false };
  }

  const expiresAt = new Date(raw).getTime();
  if (Number.isNaN(expiresAt)) {
    return { daysRemaining: null, expiresSoon: false, expired: false };
  }

  const diffMs = expiresAt - Date.now();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const expired = diffMs < 0;
  const expiresSoon = !expired && daysRemaining <= 14;

  return { daysRemaining, expiresSoon, expired };
}

function _toStatusPayload(status) {
  const license = status?.license && typeof status.license === "object" ? status.license : {};
  const expiry = _getExpiryInfo(license.validUntil);
  const payload = {
    valid: !!status?.valid,
    reason: String(status?.reason || ""),
    customerName: String(license.customerName || "").trim(),
    licenseId: String(license.licenseId || "").trim(),
    edition: String(license.edition || "").trim(),
    validUntil: String(license.validUntil || "").trim(),
    features: Array.isArray(license.features) ? license.features : [],
    machineId: String(status?.machineId || getMachineId() || "").trim(),
    appVersion: String(app?.getVersion?.() || "").trim(),
    daysRemaining:
      typeof status?.daysRemaining === "number" ? status.daysRemaining : expiry.daysRemaining,
    expiresSoon: typeof status?.expiresSoon === "boolean" ? status.expiresSoon : expiry.expiresSoon,
    expired: typeof status?.expired === "boolean" ? status.expired : expiry.expired,
  };

  payload.diagnosticsText = _buildDiagnosticsText(payload);
  payload.status = { ...payload };
  return payload;
}

function _buildDiagnosticsText(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return [
    `Lizenzstatus: ${payload?.valid ? "gueltig" : "ungueltig"}`,
    `Grund: ${payload?.reason || "-"}`,
    `Kunde: ${payload?.customerName || "-"}`,
    `Lizenz-ID: ${payload?.licenseId || "-"}`,
    `Edition: ${payload?.edition || "-"}`,
    `Gueltig bis: ${payload?.validUntil || "-"}`,
    `Machine-ID: ${payload?.machineId || "-"}`,
    `App-Version: ${payload?.appVersion || "-"}`,
    `Features: ${features.length ? features.join(",") : "-"}`,
  ].join("\n");
}

function _pickWindow(event) {
  try {
    return BrowserWindow.fromWebContents(event.sender) || null;
  } catch (_err) {
    return null;
  }
}

function _readLicenseFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const err = new Error("INVALID_FORMAT");
    err.code = "INVALID_FORMAT";
    throw err;
  }
  if (!parsed.license || typeof parsed.license !== "object" || !parsed.signature) {
    const err = new Error("INVALID_FORMAT");
    err.code = "INVALID_FORMAT";
    throw err;
  }
  return parsed;
}

function registerLicenseIpc() {
  ipcMain.handle("license:get-status", async () => {
    try {
      const status = getStatus();
      const payload = _toStatusPayload(status);
      console.log("[LICENSE] get-status", {
        valid: payload.valid,
        reason: payload.reason || null,
        licenseId: payload.licenseId || null,
      });
      return { ok: true, ...payload };
    } catch (err) {
      const payload = _toStatusPayload({ valid: false, reason: "INVALID_FORMAT" });
      return { ok: false, error: err?.message || String(err), ...payload };
    }
  });

  ipcMain.handle("license:import", async (event) => {
    try {
      const result = await dialog.showOpenDialog(_pickWindow(event), {
        title: "Lizenzdatei auswaehlen",
        properties: ["openFile"],
        filters: LICENSE_FILE_FILTER,
      });

      if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
        return { ok: true, canceled: true };
      }

      const filePath = String(result.filePaths[0] || "").trim();
      console.log("[LICENSE] import:selected-file", { filePath });

      const parsed = _readLicenseFile(filePath);
      console.log("[LICENSE] import:json-read", {
        product: parsed?.license?.product || null,
        licenseId: parsed?.license?.licenseId || null,
        hasSignature: !!parsed?.signature,
      });

      const verification = verifyLicense(parsed);
      console.log("[LICENSE] import:verifyLicense", {
        valid: !!verification?.valid,
        reason: verification?.reason || null,
        product: parsed?.license?.product || null,
        licenseId: parsed?.license?.licenseId || null,
      });

      if (!verification.valid) {
        return {
          ok: false,
          error: verification.reason || "INVALID_FORMAT",
          reason: verification.reason || "INVALID_FORMAT",
          ..._toStatusPayload(verification),
        };
      }

      const stored = saveLicense(parsed);
      console.log("[LICENSE] import:saveLicense", {
        ok: !!stored,
        machineId: stored?.machineId || null,
        licenseId: stored?.license?.licenseId || null,
      });

      const refreshed = refreshStatus();
      console.log("[LICENSE] import:refreshStatus", {
        valid: !!refreshed?.valid,
        reason: refreshed?.reason || null,
        machineId: refreshed?.machineId || null,
      });

      return {
        ok: true,
        filePath,
        ..._toStatusPayload(refreshed),
      };
    } catch (err) {
      const reason = String(err?.code || err?.message || "INVALID_FORMAT").trim() || "INVALID_FORMAT";
      console.error("[LICENSE] import:error", {
        error: err?.stack || err?.message || String(err),
      });
      return {
        ok: false,
        error: reason,
        reason,
        ..._toStatusPayload({ valid: false, reason }),
      };
    }
  });

  ipcMain.handle("license:delete", async () => {
    try {
      deleteLicense();
      const status = refreshStatus();
      return { ok: true, ..._toStatusPayload(status) };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("license:get-installed", async () => {
    try {
      const license = loadLicense();
      return { ok: true, license };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("license:get-diagnostics", async () => {
    try {
      const payload = _toStatusPayload(getStatus());
      return { ok: true, ...payload };
    } catch (err) {
      const payload = _toStatusPayload({ valid: false, reason: "INVALID_FORMAT" });
      return { ok: false, error: err?.message || String(err), ...payload };
    }
  });
}

module.exports = {
  registerLicenseIpc,
};
