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

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function saveLicenseData(licenseData) {
  const filePath = getLicenseFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const data = {
    ...(licenseData && typeof licenseData === "object" ? licenseData : {}),
    importedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadLicense() {
  const filePath = getLicenseFilePath();

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return data;
  } catch {
    return null;
  }
}

function hasLicense() {
  const filePath = getLicenseFilePath();
  return fs.existsSync(filePath);
}

module.exports = {
  saveLicense,
  saveLicenseData,
  loadLicense,
  hasLicense,
};
