const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getMachineId } = require("./deviceIdentity");

const PUBLIC_KEY_PATH = path.join(__dirname, "public_key.pem");

function getPublicKeyPath() {
  return PUBLIC_KEY_PATH;
}

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

function loadPublicKey() {
  if (!fs.existsSync(PUBLIC_KEY_PATH)) {
    const err = new Error(`Öffentlicher Lizenzschlüssel fehlt: ${PUBLIC_KEY_PATH}`);
    err.code = "PUBLIC_KEY_MISSING";
    throw err;
  }

  const publicKey = String(fs.readFileSync(PUBLIC_KEY_PATH, "utf8") || "").trim();
  if (!publicKey) {
    const err = new Error(`Öffentlicher Lizenzschlüssel ist leer: ${PUBLIC_KEY_PATH}`);
    err.code = "PUBLIC_KEY_MISSING";
    throw err;
  }

  if (
    !publicKey.includes("-----BEGIN PUBLIC KEY-----") ||
    publicKey.includes("PLACEHOLDER_REPLACE_WITH_REAL_PUBLIC_KEY")
  ) {
    const err = new Error(`Öffentlicher Lizenzschlüssel ist noch nicht produktiv hinterlegt: ${PUBLIC_KEY_PATH}`);
    err.code = "PUBLIC_KEY_INVALID";
    throw err;
  }

  return publicKey;
}

function verifySignature(licenseObject, signature) {
  const publicKey = loadPublicKey();
  const canonical = canonicalize(licenseObject);
  const signatureBuffer = Buffer.from(signature, "base64");

  return crypto.verify(null, Buffer.from(canonical, "utf8"), publicKey, signatureBuffer);
}

function verifyLicense(licenseData) {
  if (!licenseData) {
    return { valid: false, reason: "NO_LICENSE" };
  }

  const { license, signature, machineId } = licenseData;

  if (!license || !signature) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  let signatureValid = false;
  try {
    signatureValid = verifySignature(license, signature);
  } catch (err) {
    return { valid: false, reason: err?.code || "PUBLIC_KEY_INVALID" };
  }

  if (!signatureValid) {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }

  const now = new Date();
  const expiry = new Date(license.validUntil);
  if (Number.isNaN(expiry.getTime())) {
    return { valid: false, reason: "INVALID_VALID_UNTIL" };
  }
  if (now > expiry) {
    return { valid: false, reason: "LICENSE_EXPIRED" };
  }

  if (license.product !== "bbm-protokoll") {
    return { valid: false, reason: "WRONG_PRODUCT" };
  }

  const currentMachineId = getMachineId();
  if (machineId && machineId !== currentMachineId) {
    return { valid: false, reason: "WRONG_MACHINE" };
  }

  return {
    valid: true,
    license,
  };
}

module.exports = {
  canonicalize,
  getPublicKeyPath,
  loadPublicKey,
  verifyLicense,
  verifySignature,
};
