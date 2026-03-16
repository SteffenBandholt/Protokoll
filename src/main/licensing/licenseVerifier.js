// src/main/licensing/licenseVerifier.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getMachineId } = require("./deviceIdentity");

const PUBLIC_KEY_PATH = path.join(__dirname, "public_key.pem");
const EXPECTED_PRODUCT = "bbm-protokoll";

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function readPublicKey() {
  if (!fs.existsSync(PUBLIC_KEY_PATH)) {
    throw new Error(`PUBLIC_KEY_MISSING:${PUBLIC_KEY_PATH}`);
  }

  return fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
}

function verifySignature(license, signature) {
  try {
    const publicKey = readPublicKey();
    const canonical = canonicalize(license);
    const signatureBuffer = Buffer.from(String(signature || ""), "base64");

    return crypto.verify(
      null,
      Buffer.from(canonical, "utf8"),
      publicKey,
      signatureBuffer
    );
  } catch (_err) {
    return false;
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
    return { valid: false, reason: "WRONG_PRODUCT" };
  }

  const signatureValid = verifySignature(license, signature);
  if (!signatureValid) {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }

  const currentMachineId = getMachineId();
  if (machineId && machineId !== currentMachineId) {
    return { valid: false, reason: "WRONG_MACHINE" };
  }

  const now = Date.now();
  const expiresAt = new Date(license.validUntil).getTime();
  if (Number.isNaN(expiresAt)) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  if (now > expiresAt) {
    return {
      valid: false,
      reason: "LICENSE_EXPIRED",
      license,
    };
  }

  const msRemaining = expiresAt - now;
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  const expiresSoon = daysRemaining <= 14;

  return {
    valid: true,
    reason: null,
    license,
    machineId: currentMachineId,
    expiresSoon,
    daysRemaining,
    expired: false,
  };
}

module.exports = {
  verifyLicense,
};