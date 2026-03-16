const { loadLicense } = require("./licenseStorage");
const { verifyLicense } = require("./licenseVerifier");

let cachedStatus = null;

function checkLicense() {
  const licenseData = loadLicense();
  cachedStatus = verifyLicense(licenseData);
  return cachedStatus;
}

function getStatus() {
  if (!cachedStatus) {
    return checkLicense();
  }

  return cachedStatus;
}

function refreshStatus() {
  return checkLicense();
}

function requireValidLicense() {
  const result = checkLicense();

  if (!result.valid) {
    throw new Error(`LICENSE_INVALID:${result.reason}`);
  }

  return result.license;
}

function requireFeature(feature) {
  const license = requireValidLicense();

  if (!Array.isArray(license.features) || !license.features.includes(feature)) {
    throw new Error(`FEATURE_NOT_ALLOWED:${feature}`);
  }

  return true;
}

module.exports = {
  checkLicense,
  getStatus,
  refreshStatus,
  requireValidLicense,
  requireFeature
};