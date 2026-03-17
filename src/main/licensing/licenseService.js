const { loadLicense } = require("./licenseStorage");
const { verifyLicense } = require("./licenseVerifier");

let cachedStatus = null;

function checkLicense() {
  const licenseData = loadLicense();
  cachedStatus = verifyLicense(licenseData);
  return cachedStatus;
}

function getStatus({ fresh = false } = {}) {
  if (fresh || !cachedStatus) {
    return checkLicense();
  }

  return cachedStatus;
}

function refreshStatus() {
  return checkLicense();
}

function requireValidLicense({ fresh = false } = {}) {
  const result = getStatus({ fresh });

  if (!result.valid) {
    throw new Error(`LICENSE_INVALID:${result.reason}`);
  }

  return result.license;
}

function requireFeature(feature) {
  const normalizedFeature = String(feature || "").trim();
  if (!normalizedFeature) {
    throw new Error("FEATURE_NOT_ALLOWED:");
  }

  const license = requireValidLicense({ fresh: true });
  const features = Array.isArray(license?.features) ? license.features : [];

  if (!features.includes(normalizedFeature)) {
    throw new Error(`FEATURE_NOT_ALLOWED:${normalizedFeature}`);
  }

  return true;
}

module.exports = {
  checkLicense,
  getStatus,
  refreshStatus,
  requireValidLicense,
  requireFeature,
};
