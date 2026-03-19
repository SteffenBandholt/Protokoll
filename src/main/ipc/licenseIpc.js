// src/main/ipc/licenseIpc.js

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const { saveLicense, loadLicense, deleteLicense } = require("../licensing/licenseStorage");
const { getMachineId } = require("../licensing/deviceIdentity");
const { verifyLicense } = require("../licensing/licenseVerifier");
const { refreshStatus } = require("../licensing/licenseService");

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
  const binding = String(license.binding || status?.binding || "").trim().toLowerCase() || "none";
  const expiry = _getExpiryInfo(license.validUntil);
  const payload = {
    valid: !!status?.valid,
    reason: String(status?.reason || ""),
    customerName: String(license.customerName || "").trim(),
    licenseId: String(license.licenseId || "").trim(),
    edition: String(license.edition || "").trim(),
    validUntil: String(license.validUntil || "").trim(),
    features: Array.isArray(license.features) ? license.features : [],
    binding,
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

function _buildDiagnosticsText(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return [
    `Lizenzstatus: ${payload?.valid ? "gueltig" : "ungueltig"}`,
    `Grund: ${payload?.reason || "-"}`,
    `Kunde: ${payload?.customerName || "-"}`,
    `Lizenz-ID: ${payload?.licenseId || "-"}`,
    `Edition: ${payload?.edition || "-"}`,
    `Binding: ${payload?.binding || "none"}`,
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

function _readLicenseRequestFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const err = new Error("INVALID_FORMAT");
    err.code = "INVALID_FORMAT";
    throw err;
  }
  const product = String(parsed.product || "").trim();
  const machineId = String(parsed.machineId || "").trim();
  if (!product || !machineId) {
    const err = new Error("INVALID_FORMAT");
    err.code = "INVALID_FORMAT";
    throw err;
  }
  return {
    filePath: String(filePath || "").trim(),
    product,
    machineId,
    appVersion: String(parsed.appVersion || "").trim(),
    createdAt: String(parsed.createdAt || "").trim(),
    customerHint: String(parsed.customerHint || "").trim(),
    deviceName: String(parsed.deviceName || "").trim(),
  };
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
    binding: String(license.binding || "").trim().toLowerCase() || "none",
    boundMachineId: String(license.machineId || parsed?.machineId || "").trim(),
    issuedAt,
    validFrom,
    validUntil: String(license.validUntil || "").trim(),
    maxDevices:
      typeof license.maxDevices === "number"
        ? license.maxDevices
        : Number.isFinite(Number(license.maxDevices))
          ? Number(license.maxDevices)
          : 1,
    features: Array.isArray(license.features) ? license.features.map((v) => String(v || "").trim()).filter(Boolean) : [],
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
    .map((ch) => (ch.charCodeAt(0) < 32 ? "_" : ch))
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
  const binding = String(raw?.binding || "").trim().toLowerCase() || "none";
  const validFrom = _normalizeIsoDate(raw?.validFrom);
  const durationDays =
    raw?.durationDays === "" || raw?.durationDays === null || raw?.durationDays === undefined
      ? null
      : Number(raw.durationDays);
  const explicitValidUntil = _normalizeIsoDate(raw?.validUntil);
  const validUntil = explicitValidUntil || _computeValidUntil(validFrom, durationDays);
  const maxDevices = Number(raw?.maxDevices);
  const features = Array.isArray(raw?.features)
    ? raw.features.map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  const notes = String(raw?.notes || "").trim();

  if (!customerName) throw new Error("CUSTOMER_NAME_REQUIRED");
  if (!licenseId) throw new Error("LICENSE_ID_REQUIRED");
  if (!["none", "machine"].includes(binding)) throw new Error("BINDING_INVALID");
  if (!validFrom) throw new Error("VALID_FROM_REQUIRED");
  if (!validUntil) throw new Error("VALID_UNTIL_REQUIRED");
  if (new Date(`${validUntil}T00:00:00Z`).getTime() < new Date(`${validFrom}T00:00:00Z`).getTime()) {
    throw new Error("VALID_UNTIL_BEFORE_VALID_FROM");
  }
  if (!Number.isFinite(maxDevices) || maxDevices < 1) throw new Error("MAX_DEVICES_INVALID");
  if (!features.length) throw new Error("FEATURES_REQUIRED");

  const requestedMachineId = String(raw?.machineId || "").trim();
  const currentMachineId = binding === "machine" ? requestedMachineId || String(getMachineId() || "").trim() : "";
  if (binding === "machine" && !currentMachineId) throw new Error("MACHINE_ID_REQUIRED_FOR_BINDING");

  return {
    product,
    customerName,
    licenseId,
    edition,
    binding,
    validFrom,
    validUntil,
    durationDays: Number.isFinite(durationDays) && durationDays > 0 ? Math.floor(durationDays) : null,
    maxDevices: Math.floor(maxDevices),
    features,
    notes,
    machineId: currentMachineId || "",
  };
}

async function _runLicenseTool(inputPath, { timeoutMs = 10000 } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [LICENSE_TOOL_SCRIPT, inputPath], {
      cwd: LICENSE_TOOL_ROOT,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    let timeoutHandle = null;

    const done = (result, isReject = false) => {
      if (finished) return;
      finished = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (isReject) return reject(result);
      return resolve(result);
    };

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    child.on("error", (err) => done(err, true));
    child.on("close", (code) => {
      if (code !== 0) {
        const err = new Error(stderr.trim() || stdout.trim() || `Generator fehlgeschlagen (Exit ${code}).`);
        err.code = "GENERATOR_FAILED";
        return done(err, true);
      }
      done({ stdout, stderr, exitCode: code });
    });

    timeoutHandle = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
      done({ stdout, stderr, timedOut: true, exitCode: null });
    }, timeoutMs);
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
  ipcMain.handle("license:get-status", async () => {
    try {
      const status = refreshStatus();
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
      const payload = _toStatusPayload(refreshStatus());
      return { ok: true, ...payload };
    } catch (err) {
      const payload = _toStatusPayload({ valid: false, reason: "INVALID_FORMAT" });
      return { ok: false, error: err?.message || String(err), ...payload };
    }
  });

  ipcMain.handle("license:create-request", async (event, raw) => {
    try {
      const machineId = String(getMachineId() || "").trim();
      if (!machineId) return { ok: false, error: "MACHINE_ID_REQUIRED_FOR_BINDING" };

      const product = String(raw?.product || "bbm-protokoll").trim() || "bbm-protokoll";
      const customerHint = String(raw?.customerHint || "").trim();
      const createdAt = new Date().toISOString();
      const appVersion = String(app?.getVersion?.() || "").trim();
      const deviceName = String(os.hostname() || "").trim();
      const shortMachineId = machineId.slice(0, 8) || "machine";
      const suggestedName = `BBM_Lizenzanfrage_${createdAt.slice(0, 10)}_${shortMachineId}${customerHint ? `_${_sanitizeFilePart(customerHint, "kunde")}` : ""}.json`;

      const result = await dialog.showSaveDialog(_pickWindow(event), {
        title: "Lizenzanforderung speichern",
        defaultPath: suggestedName,
        filters: [{ name: "Lizenzanforderung", extensions: ["json"] }],
      });
      if (result.canceled || !result.filePath) return { ok: true, canceled: true };

      const payload = {
        product,
        machineId,
        appVersion,
        createdAt,
        customerHint,
        deviceName,
      };
      await fs.promises.writeFile(result.filePath, JSON.stringify(payload, null, 2), "utf8");
      return { ok: true, filePath: result.filePath, ...payload };
    } catch (err) {
      return { ok: false, error: String(err?.code || err?.message || "REQUEST_SAVE_FAILED").trim() || "REQUEST_SAVE_FAILED" };
    }
  });

  ipcMain.handle("license:load-request-for-generate", async (event) => {
    if (!_isDevLicenseGenerationAllowed()) {
      return { ok: false, error: "LICENSE_GENERATION_NOT_ALLOWED" };
    }
    try {
      const result = await dialog.showOpenDialog(_pickWindow(event), {
        title: "Lizenzanforderung laden",
        properties: ["openFile"],
        filters: [{ name: "Lizenzanforderung", extensions: ["json"] }],
      });
      if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
        return { ok: true, canceled: true };
      }
      return { ok: true, ..._readLicenseRequestFile(String(result.filePaths[0] || "").trim()) };
    } catch (err) {
      const reason = String(err?.code || err?.message || "INVALID_FORMAT").trim() || "INVALID_FORMAT";
      return { ok: false, error: reason };
    }
  });

  ipcMain.handle("license:load-for-edit", async (event) => {
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
  });

  ipcMain.handle("license:generate", async (_event, raw) => {
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
            binding: inputData.binding,
            validFrom: inputData.validFrom,
            validUntil: inputData.validUntil,
            maxDevices: inputData.maxDevices,
            features: inputData.features,
            notes: inputData.notes,
            ...(inputData.binding === "machine" && inputData.machineId
              ? { machineId: inputData.machineId }
              : {}),
          },
          null,
          2
        ),
        "utf8"
      );

      const runResult = await _runLicenseTool(inputPath);
      const outputPath = _extractGeneratedPath(runResult, inputData);
      if (!outputPath) {
        if (runResult?.timedOut) {
          return { ok: false, error: "GENERATOR_TIMEOUT" };
        }
        return { ok: false, error: "OUTPUT_FILE_NOT_FOUND" };
      }

      return {
        ok: true,
        inputPath,
        outputPath,
        outputDir: LICENSE_TOOL_OUTPUT_DIR,
        customerName: inputData.customerName,
        licenseId: inputData.licenseId,
        binding: inputData.binding,
        machineId: inputData.binding === "machine" ? inputData.machineId : "",
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
  });

  ipcMain.handle("license:open-output-dir", async (_event, raw) => {
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
  });
}

module.exports = {
  registerLicenseIpc,
};
