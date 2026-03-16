const { loadLicense } = require("./licenseStorage");
const { verifyLicense } = require("./licenseVerifier");

let cachedResult = null;

function checkLicense() {
  const licenseData = loadLicense();
  cachedResult = verifyLicense(licenseData);
  return cachedResult;
}

function getStatus() {
  if (!cachedResult) {
    checkLicense();
  }
  return cachedResult;
}

function requireValidLicense() {
  const result = getStatus();

  if (!result.valid) {
    throw new Error(`LICENSE_INVALID:${result.reason}`);
  }

  return result.license;
}

function requireFeature(feature) {
  const license = requireValidLicense();

  if (!license.features || !license.features.includes(feature)) {
    throw new Error(`FEATURE_NOT_ALLOWED:${feature}`);
  }

  return true;
}
function requireFeature(feature) {

  // immer aktuelle Lizenz prüfen
  const result = verifyLicense(loadLicense());

  if (!result.valid) {
    throw new Error(`LICENSE_INVALID:${result.reason}`);
  }

  const license = result.license;

  if (!license.features || !license.features.includes(feature)) {
    throw new Error(`FEATURE_NOT_ALLOWED:${feature}`);
  }

  return true;
}
module.exports = {
  checkLicense,
  getStatus,
  requireValidLicense,
  requireFeature
};