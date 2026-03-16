const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getMachineId } = require("./deviceIdentity");

const PUBLIC_KEY_PATH = path.join(__dirname, "public_key.pem");

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

function verifySignature(licenseObject, signature) {
  const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");

  const canonical = canonicalize(licenseObject);

  const signatureBuffer = Buffer.from(signature, "base64");

  return crypto.verify(
    null,
    Buffer.from(canonical, "utf8"),
    publicKey,
    signatureBuffer
  );
}

function verifyLicense(licenseData) {
  if (!licenseData) {
    return { valid: false, reason: "NO_LICENSE" };
  }

  const { license, signature, machineId } = licenseData;

  if (!license || !signature) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  // Signatur prüfen
  const signatureValid = verifySignature(license, signature);

  if (!signatureValid) {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }

  // Ablaufdatum prüfen
  const now = new Date();
  const expiry = new Date(license.validUntil);

  if (now > expiry) {
    return { valid: false, reason: "LICENSE_EXPIRED" };
  }

  // Produkt prüfen
  if (license.product !== "bbm-protokoll") {
    return { valid: false, reason: "WRONG_PRODUCT" };
  }

  // Machine-ID prüfen
  const currentMachineId = getMachineId();

  if (machineId && machineId !== currentMachineId) {
    return { valid: false, reason: "WRONG_MACHINE" };
  }

  return {
    valid: true,
    license
  };
}

module.exports = {
  verifyLicense
};