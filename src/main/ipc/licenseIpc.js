const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { saveLicenseData } = require("../licensing/licenseStorage");
const { getMachineId } = require("../licensing/deviceIdentity");
const { verifyLicense } = require("../licensing/licenseVerifier");
const { refreshStatus, getStatus } = require("../licensing/licenseService");

const LICENSE_FILE_FILTER = [
  {
    name: "BBM Lizenz",
    extensions: ["bbmlic", "json"],
  },
];

const LICENSE_TOOL_ROOT = "C:\\license-tool";
const LICENSE_TOOL_INPUT_DIR = path.join(LICENSE_TOOL_ROOT, "input");
const LICENSE_TOOL_OUTPUT_DIR = path.join(LICENSE_TOOL_ROOT, "output");
const LICENSE_TOOL_SCRIPT = path.join(LICENSE_TOOL_ROOT, "generate-license.cjs");
const LICENSE_TOOL_PRIVATE_KEY = path.join(LICENSE_TOOL_ROOT, "keys", "private_key.pem");

let registered = false;

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

function _toStatusPayload(status) {
  const license = status?.license && typeof status.license === "object" ? status.license : {};
  const expiry = _getExpiryInfo(license.validUntil);
  const payload = {
    valid: !!status?.valid,
    reason: String(status?.reason || ""),
    customerName: String(
      license.customerName || license.customer || license.customer_name || license.customer_name_full || ""
    ).trim(),
    licenseId: String(license.licenseId || license.id || "").trim(),
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
  return payload;
}

function _pickWindow(event) {
  try {
    return BrowserWindow.fromWebContents(event.sender) || null;
  } catch (_err) {
    return null;
  }
}

function _readLicenseFile(filePath) {
  let parsed;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    parsed = JSON.parse(raw);
  } catch (_err) {
    const err = new Error("INVALID_FORMAT");
    err.code = "INVALID_FORMAT";
    throw err;
  }

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

function _toEditableLicensePayload(parsed = {}, filePath = "") {
  const license = parsed?.license && typeof parsed.license === "object" ? parsed.license : {};
  const issuedAt = String(license.issuedAt || "").trim();
  const validFrom = String(license.validFrom || "").trim() || (issuedAt ? issuedAt.slice(0, 10) : "");

  return {
    filePath: String(filePath || "").trim(),
    product: String(license.product || "").trim(),
    customerName: String(license.customerName || "").trim(),
    licenseId: String(license.licenseId || "").trim(),
    edition: String(license.edition || "").trim(),
    issuedAt,
    validFrom,
    validUntil: String(license.validUntil || "").trim(),
    maxDevices:
      typeof license.maxDevices === "number"
        ? license.maxDevices
        : Number.isFinite(Number(license.maxDevices))
          ? Number(license.maxDevices)
          : 1,
    features: Array.isArray(license.features)
      ? license.features.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
    notes: String(license.notes || "").trim(),
  };
}

function _isDevLicenseGenerationAllowed() {
  return !app.isPackaged;
}

function _sanitizeFilePart(value, fallback = "license") {
  const clean = String(value || "").trim() || fallback;
  const withoutInvalidPathChars = clean
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return Array.from(withoutInvalidPathChars)
    .map((char) => (char.charCodeAt(0) < 32 ? "_" : char))
    .join("")
    .slice(0, 120);
}

function _normalizeIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const ts = new Date(`${raw}T00:00:00Z`).getTime();
  if (Number.isNaN(ts)) return "";
  return raw;
}

function _computeValidUntil(validFrom, durationDays) {
  const start = _normalizeIsoDate(validFrom);
  const days = Number(durationDays);
  if (!start || !Number.isFinite(days) || days < 1) return "";
  const dt = new Date(`${start}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + Math.floor(days));
  return dt.toISOString().slice(0, 10);
}

function _validateGenerationPayload(raw = {}) {
  const product = String(raw?.product || "bbm-protokoll").trim() || "bbm-protokoll";
  const customerName = String(raw?.customerName || "").trim();
  const licenseId = String(raw?.licenseId || "").trim();
  const edition = String(raw?.edition || "test").trim() || "test";
  const validFrom = _normalizeIsoDate(raw?.validFrom);
  const durationDays =
    raw?.durationDays === "" || raw?.durationDays === null || raw?.durationDays === undefined
      ? null
      : Number(raw.durationDays);
  const explicitValidUntil = _normalizeIsoDate(raw?.validUntil);
  const validUntil = explicitValidUntil || _computeValidUntil(validFrom, durationDays);
  const maxDevices = Number(raw?.maxDevices);
  const features = Array.isArray(raw?.features)
    ? raw.features.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const notes = String(raw?.notes || "").trim();

  if (!customerName) throw new Error("CUSTOMER_NAME_REQUIRED");
  if (!licenseId) throw new Error("LICENSE_ID_REQUIRED");
  if (!validFrom) throw new Error("VALID_FROM_REQUIRED");
  if (!validUntil) throw new Error("VALID_UNTIL_REQUIRED");
  if (new Date(`${validUntil}T00:00:00Z`).getTime() < new Date(`${validFrom}T00:00:00Z`).getTime()) {
    throw new Error("VALID_UNTIL_BEFORE_VALID_FROM");
  }
  if (!Number.isFinite(maxDevices) || maxDevices < 1) throw new Error("MAX_DEVICES_INVALID");
  if (!features.length) throw new Error("FEATURES_REQUIRED");

  return {
    product,
    customerName,
    licenseId,
    edition,
    validFrom,
    validUntil,
    durationDays: Number.isFinite(durationDays) && durationDays > 0 ? Math.floor(durationDays) : null,
    maxDevices: Math.floor(maxDevices),
    features,
    notes,
  };
}

async function _runLicenseTool(inputPath) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [LICENSE_TOOL_SCRIPT, inputPath], {
      cwd: LICENSE_TOOL_ROOT,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        const err = new Error(stderr.trim() || stdout.trim() || `Generator fehlgeschlagen (Exit ${code}).`);
        err.code = "GENERATOR_FAILED";
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

function _extractGeneratedPath(runResult, inputData) {
  const text = `${runResult?.stdout || ""}\n${runResult?.stderr || ""}`;
  const match = text.match(/[A-Z]:\\[^\r\n]+\.bbmlic/);
  if (match && fs.existsSync(match[0])) return match[0];

  const fileName = `${_sanitizeFilePart(inputData.licenseId, "license")}_${_sanitizeFilePart(
    inputData.customerName,
    "customer"
  )}.bbmlic`;
  const fallbackPath = path.join(LICENSE_TOOL_OUTPUT_DIR, fileName);
  return fs.existsSync(fallbackPath) ? fallbackPath : "";
}

function registerLicenseIpc() {
  if (registered) return;
  registered = true;

  const getStatusHandler = async () => {
    try {
      const status = getStatus({ fresh: true });
      return { ok: true, ..._toStatusPayload(status) };
    } catch (err) {
      const payload = _toStatusPayload({ valid: false, reason: "INVALID_FORMAT" });
      return { ok: false, error: err?.message || String(err), ...payload };
    }
  };

  const refreshStatusHandler = async () => {
    try {
      const status = refreshStatus();
      return { ok: true, ..._toStatusPayload(status) };
    } catch (err) {
      const payload = _toStatusPayload({ valid: false, reason: "INVALID_FORMAT" });
      return { ok: false, error: err?.message || String(err), ...payload };
    }
  };

  const getDiagnosticsHandler = async () => {
    try {
      const payload = _toStatusPayload(refreshStatus());
      return { ok: true, ...payload };
    } catch (err) {
      const payload = _toStatusPayload({ valid: false, reason: "INVALID_FORMAT" });
      return { ok: false, error: err?.message || String(err), ...payload };
    }
  };

  const importHandler = async (event, payload) => {
    try {
      const data = payload && typeof payload === "object" ? payload : {};
      let filePath = String(data.filePath || "").trim();

      if (!filePath) {
        const result = await dialog.showOpenDialog(_pickWindow(event), {
          title: "Lizenzdatei auswaehlen",
          properties: ["openFile"],
          filters: LICENSE_FILE_FILTER,
        });
        if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
          return { ok: true, canceled: true };
        }
        filePath = String(result.filePaths[0] || "").trim();
      }

      const licenseData = _readLicenseFile(filePath);
      const validation = verifyLicense(licenseData);
      if (!validation?.valid) {
        return {
          ok: false,
          filePath,
          error: validation.reason || "INVALID_FORMAT",
          reason: validation.reason || "INVALID_FORMAT",
          ..._toStatusPayload(validation),
        };
      }

      saveLicenseData(licenseData);
      const status = refreshStatus();
      return {
        ok: true,
        filePath,
        ..._toStatusPayload(status),
      };
    } catch (err) {
      const reason = String(err?.code || err?.message || "INVALID_FORMAT").trim() || "INVALID_FORMAT";
      return {
        ok: false,
        error: reason,
        reason,
        ..._toStatusPayload({ valid: false, reason }),
      };
    }
  };

  const loadForEditHandler = async (event) => {
    if (!_isDevLicenseGenerationAllowed()) {
      return { ok: false, error: "LICENSE_GENERATION_NOT_ALLOWED" };
    }

    try {
      const result = await dialog.showOpenDialog(_pickWindow(event), {
        title: "Bestehende Lizenz laden",
        properties: ["openFile"],
        filters: LICENSE_FILE_FILTER,
      });
      if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
        return { ok: true, canceled: true };
      }

      const filePath = String(result.filePaths[0] || "").trim();
      const parsed = _readLicenseFile(filePath);
      return {
        ok: true,
        ..._toEditableLicensePayload(parsed, filePath),
      };
    } catch (err) {
      const reason = String(err?.code || err?.message || "INVALID_FORMAT").trim() || "INVALID_FORMAT";
      return { ok: false, error: reason };
    }
  };

  const generateHandler = async (_event, raw) => {
    if (!_isDevLicenseGenerationAllowed()) {
      return { ok: false, error: "LICENSE_GENERATION_NOT_ALLOWED" };
    }

    try {
      if (!fs.existsSync(LICENSE_TOOL_ROOT)) return { ok: false, error: "LICENSE_TOOL_NOT_FOUND" };
      if (!fs.existsSync(LICENSE_TOOL_SCRIPT)) return { ok: false, error: "LICENSE_TOOL_SCRIPT_MISSING" };
      if (!fs.existsSync(LICENSE_TOOL_PRIVATE_KEY)) return { ok: false, error: "PRIVATE_KEY_MISSING" };

      const inputData = _validateGenerationPayload(raw || {});
      await fs.promises.mkdir(LICENSE_TOOL_INPUT_DIR, { recursive: true });
      await fs.promises.mkdir(LICENSE_TOOL_OUTPUT_DIR, { recursive: true });

      const inputFileName = `${Date.now()}-${_sanitizeFilePart(inputData.licenseId, "license")}.json`;
      const inputPath = path.join(LICENSE_TOOL_INPUT_DIR, inputFileName);
      await fs.promises.writeFile(
        inputPath,
        JSON.stringify(
          {
            product: inputData.product,
            customerName: inputData.customerName,
            licenseId: inputData.licenseId,
            edition: inputData.edition,
            validFrom: inputData.validFrom,
            validUntil: inputData.validUntil,
            maxDevices: inputData.maxDevices,
            features: inputData.features,
            notes: inputData.notes,
          },
          null,
          2
        ),
        "utf8"
      );

      const runResult = await _runLicenseTool(inputPath);
      const outputPath = _extractGeneratedPath(runResult, inputData);
      if (!outputPath) {
        return { ok: false, error: "OUTPUT_FILE_NOT_FOUND" };
      }

      return {
        ok: true,
        inputPath,
        outputPath,
        outputDir: LICENSE_TOOL_OUTPUT_DIR,
        customerName: inputData.customerName,
        licenseId: inputData.licenseId,
        validFrom: inputData.validFrom,
        validUntil: inputData.validUntil,
        features: inputData.features,
      };
    } catch (err) {
      return {
        ok: false,
        error: String(err?.message || err || "LICENSE_GENERATION_FAILED").trim() || "LICENSE_GENERATION_FAILED",
      };
    }
  };

  const openOutputDirHandler = async (_event, raw) => {
    if (!_isDevLicenseGenerationAllowed()) {
      return { ok: false, error: "LICENSE_GENERATION_NOT_ALLOWED" };
    }

    const outputPath = String(raw?.outputPath || "").trim();
    const dirPath = outputPath ? path.dirname(outputPath) : LICENSE_TOOL_OUTPUT_DIR;
    try {
      const result = await shell.openPath(dirPath);
      if (result) return { ok: false, error: result };
      return { ok: true, dirPath };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  };

  ipcMain.handle("license:get-status", getStatusHandler);
  ipcMain.handle("license:getStatus", getStatusHandler);
  ipcMain.handle("license:refresh-status", refreshStatusHandler);
  ipcMain.handle("license:refreshStatus", refreshStatusHandler);
  ipcMain.handle("license:get-diagnostics", getDiagnosticsHandler);
  ipcMain.handle("license:import", importHandler);
  ipcMain.handle("license:load-for-edit", loadForEditHandler);
  ipcMain.handle("license:generate", generateHandler);
  ipcMain.handle("license:open-output-dir", openOutputDirHandler);
}

module.exports = {
  registerLicenseIpc,
};
