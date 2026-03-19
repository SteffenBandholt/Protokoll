// src/main/licensing/licenseStorage.js

const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { getMachineId } = require("./deviceIdentity");

function getLicenseFilePath() {
  const userData = app.getPath("userData");
  return path.join(userData, "license.json");
}

function loadLicense() {
  try {
    const filePath = getLicenseFilePath();

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[licenseStorage] load failed:", err?.message || err);
    return null;
  }
}

function saveLicense(licensePayload) {
  const filePath = getLicenseFilePath();
  const machineId = getMachineId();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const stored = {
    ...licensePayload,
    machineId,
    installedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    filePath,
    JSON.stringify(stored, null, 2),
    "utf8"
  );

  console.log("[LICENSE] saveLicense", {
    filePath,
    machineId,
    hasLicense: !!stored?.license,
    hasSignature: !!stored?.signature,
  });

  return stored;
}

function deleteLicense() {
  const filePath = getLicenseFilePath();

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return true;
}

module.exports = {
  loadLicense,
  saveLicense,
  deleteLicense,
  getLicenseFilePath,
};
