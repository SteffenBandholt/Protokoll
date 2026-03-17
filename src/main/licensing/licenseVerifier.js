const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getMachineId } = require("./deviceIdentity");

const BUNDLED_PUBLIC_KEY_PATH = path.join(__dirname, "public_key.pem");
const EXPECTED_PRODUCT = "bbm-protokoll";

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function _validatePublicKey(publicKey, sourceLabel) {
  const normalized = String(publicKey || "").trim();
  if (
    !normalized ||
    !normalized.includes("-----BEGIN PUBLIC KEY-----") ||
    normalized.includes("PLACEHOLDER_REPLACE_WITH_REAL_PUBLIC_KEY")
  ) {
    const err = new Error(`PUBLIC_KEY_INVALID:${sourceLabel}`);
    err.code = "PUBLIC_KEY_INVALID";
    throw err;
  }

  return normalized;
}

function _readPublicKeyFromEnvContent() {
  const value = String(process.env.BBM_LICENSE_PUBLIC_KEY || "").trim();
  if (!value) return null;

  return {
    publicKey: _validatePublicKey(value, "env:BBM_LICENSE_PUBLIC_KEY"),
    source: "env:BBM_LICENSE_PUBLIC_KEY",
  };
}

function _readPublicKeyFromFile(filePath, sourceLabel = filePath) {
  const normalizedPath = String(filePath || "").trim();
  if (!normalizedPath) return null;
  if (!fs.existsSync(normalizedPath)) {
    const err = new Error(`PUBLIC_KEY_MISSING:${sourceLabel}`);
    err.code = "PUBLIC_KEY_MISSING";
    throw err;
  }

  const publicKey = fs.readFileSync(normalizedPath, "utf8");
  return {
    publicKey: _validatePublicKey(publicKey, sourceLabel),
    source: sourceLabel,
  };
}

function readPublicKey() {
  const envContent = _readPublicKeyFromEnvContent();
  if (envContent) return envContent;

  const envPath = String(process.env.BBM_LICENSE_PUBLIC_KEY_PATH || "").trim();
  if (envPath) {
    return _readPublicKeyFromFile(envPath, `env:BBM_LICENSE_PUBLIC_KEY_PATH:${envPath}`);
  }

  return _readPublicKeyFromFile(BUNDLED_PUBLIC_KEY_PATH, BUNDLED_PUBLIC_KEY_PATH);
}

function verifySignature(license, signature) {
  try {
    const { publicKey, source } = readPublicKey();
    const canonical = canonicalize(license);
    const signatureBuffer = Buffer.from(String(signature || ""), "base64");

    return {
      valid: crypto.verify(null, Buffer.from(canonical, "utf8"), publicKey, signatureBuffer),
      reason: null,
      source,
    };
  } catch (err) {
    return {
      valid: false,
      reason: err?.code || "INVALID_SIGNATURE",
      source: String(err?.message || "").split(":").slice(1).join(":") || null,
    };
  }
}

function isIsoDateString(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const parsed = new Date(raw);
  return !Number.isNaN(parsed.getTime());
}

function verifyLicense(licenseData) {
  if (!licenseData) {
    return { valid: false, reason: "NO_LICENSE" };
  }

  const { license, signature, machineId } = licenseData;

  if (!license || typeof license !== "object" || !signature) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  const requiredFields = [
    "schemaVersion",
    "product",
    "licenseId",
    "customerName",
    "edition",
    "issuedAt",
    "validUntil",
    "maxDevices",
    "features",
  ];

  for (const field of requiredFields) {
    const value = license[field];
    const missing =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (missing) {
      return { valid: false, reason: "INVALID_FORMAT" };
    }
  }

  if (!Array.isArray(license.features)) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  if (typeof license.maxDevices !== "number" || license.maxDevices < 1) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  if (!isIsoDateString(license.issuedAt) || !isIsoDateString(license.validUntil)) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  if (license.product !== EXPECTED_PRODUCT) {
    return { valid: false, reason: "WRONG_PRODUCT", license };
  }

  const signatureCheck = verifySignature(license, signature);
  if (!signatureCheck.valid) {
    return {
      valid: false,
      reason: signatureCheck.reason || "INVALID_SIGNATURE",
      license,
      publicKeySource: signatureCheck.source || null,
    };
  }

  const currentMachineId = getMachineId();
  if (machineId && machineId !== currentMachineId) {
    return { valid: false, reason: "WRONG_MACHINE", license, machineId: currentMachineId };
  }

  const expiresAt = new Date(license.validUntil).getTime();
  if (Number.isNaN(expiresAt)) {
    return { valid: false, reason: "INVALID_FORMAT", license };
  }

  const now = Date.now();
  if (now > expiresAt) {
    return {
      valid: false,
      reason: "LICENSE_EXPIRED",
      license,
      machineId: currentMachineId,
      publicKeySource: signatureCheck.source || null,
      expired: true,
    };
  }

  const msRemaining = expiresAt - now;
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return {
    valid: true,
    reason: null,
    license,
    machineId: currentMachineId,
    publicKeySource: signatureCheck.source || null,
    expiresSoon: daysRemaining <= 14,
    daysRemaining,
    expired: false,
  };
}

module.exports = {
  canonicalize,
  readPublicKey,
  verifySignature,
  verifyLicense,
};
