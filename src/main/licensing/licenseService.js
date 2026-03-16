const { loadLicense } = require("./licenseStorage");
const { verifyLicense } = require("./licenseVerifier");

let cachedStatus = null;

function checkLicense() {
  const licenseData = loadLicense();
  cachedStatus = verifyLicense(licenseData);
  console.log("[LICENSE] checkLicense", {
    hasLicense: !!licenseData?.license,
    hasSignature: !!licenseData?.signature,
    machineId: licenseData?.machineId || null,
    result: cachedStatus?.reason || (cachedStatus?.valid ? "VALID" : "UNKNOWN"),
  });
  return cachedStatus;
}

function getStatus() {
  if (!cachedStatus) {
    return checkLicense();
  }

  return cachedStatus;
}

function refreshStatus() {
  const status = checkLicense();
  console.log("[LICENSE] refreshStatus", {
    valid: !!status?.valid,
    reason: status?.reason || null,
  });
  return status;
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
