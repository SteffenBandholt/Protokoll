const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const FILE_NAME = "license.json";

function getLicenseFilePath() {
  const userData = app.getPath("userData");
  return path.join(userData, FILE_NAME);
}

function saveLicense(licenseObject, machineId) {
  const filePath = getLicenseFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const data = {
    license: licenseObject,
    machineId,
    activatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function saveLicenseData(licenseData) {
  const filePath = getLicenseFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const data = {
    ...(licenseData && typeof licenseData === "object" ? licenseData : {}),
    importedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function loadLicense() {
  const filePath = getLicenseFilePath();

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_err) {
    return null;
  }
}

function hasLicense() {
  return fs.existsSync(getLicenseFilePath());
}

module.exports = {
  saveLicense,
  saveLicenseData,
  loadLicense,
  hasLicense,
  getLicenseFilePath,
};
