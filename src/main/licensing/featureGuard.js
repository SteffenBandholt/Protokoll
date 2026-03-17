const { app } = require("electron");
const { getStatus, requireFeature } = require("./licenseService");

const LICENSE_FEATURES = {
  APP: "app",
  PDF: "pdf",
  EXPORT: "export",
  MAIL: "mail",
  MAIL_OUTLOOK_DRAFT: "mail",
  AUDIO: "audio",
};

function _extractLicenseInfo(status) {
  const license = status?.license && typeof status.license === "object" ? status.license : {};
  return {
    customerName: String(license.customerName || "").trim(),
    licenseId: String(license.licenseId || "").trim(),
    edition: String(license.edition || "standard").trim(),
    validUntil: String(license.validUntil || "").trim(),
    features: Array.isArray(license.features) ? license.features : [],
    appVersion: String(app?.getVersion?.() || "").trim(),
  };
}

function createLicenseBadgeText(licenseInfo = {}) {
  const year = new Date().getFullYear();
  const version = String(licenseInfo?.appVersion || "").trim();
  const customerName = String(licenseInfo?.customerName || "").trim();
  const prefix = `© BBM ${year}${version ? ` - v${version}` : ""}`;
  if (customerName) return `${prefix} | Lizenziert fuer: ${customerName}`;
  return `${prefix} | Standardlizenz`;
}

function enforceLicensedFeature(feature) {
  requireFeature(feature);
  return _extractLicenseInfo(getStatus());
}

function toLicenseErrorPayload(err) {
  const message = String(err?.message || "Lizenzfehler.");
  return {
    ok: false,
    licenseError: true,
    code: "LICENSE_ERROR",
    reason: "UNKNOWN",
    error: message,
    message,
    status: getStatus(),
  };
}

module.exports = {
  LICENSE_FEATURES,
  createLicenseBadgeText,
  enforceLicensedFeature,
  toLicenseErrorPayload,
};
