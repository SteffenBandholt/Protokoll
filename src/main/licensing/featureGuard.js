// src/main/licensing/featureGuard.js

const { app } = require("electron");
const { requireFeature, getStatus } = require("./licenseService");

const LICENSE_FEATURES = {
  APP: "app",
  PDF: "pdf",
  EXPORT: "export",
  MAIL: "mail",
  MAIL_OUTLOOK_DRAFT: "mail",
  AUDIO: "audio",
};

const ALWAYS_INCLUDED_FEATURES = new Set([
  LICENSE_FEATURES.APP,
  LICENSE_FEATURES.PDF,
  LICENSE_FEATURES.EXPORT,
  LICENSE_FEATURES.MAIL,
]);

function _isAlwaysIncludedFeature(feature) {
  return ALWAYS_INCLUDED_FEATURES.has(String(feature || "").trim().toLowerCase());
}

function _extractLicenseInfo(status) {
  const license = status?.license && typeof status.license === "object" ? status.license : {};

  return {
    customerName: String(
      license.customerName || license.customer || license.customer_name || license.customer_name_full || ""
    ).trim(),
    licenseId: String(license.licenseId || license.id || "").trim(),
    edition: String(license.edition || "").trim(),
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
  if (customerName) {
    return `${prefix} | Lizenziert für: ${customerName}`;
  }
  return `${prefix} | Keine gültige Lizenz`;
}

function enforceLicensedFeature(feature) {
  if (_isAlwaysIncludedFeature(feature)) {
    return _extractLicenseInfo(safeGetStatus());
  }

  try {
    requireFeature(feature);
    return _extractLicenseInfo(getStatus({ fresh: true }));
  } catch (err) {
    const rawMessage = String(err?.message || "");
    const isLicenseError =
      rawMessage.startsWith("LICENSE_INVALID:") ||
      rawMessage.startsWith("FEATURE_NOT_ALLOWED:");

    if (isLicenseError) {
      err.licenseError = true;
    }

    throw err;
  }
}

function toLicenseErrorPayload(err) {
  const message = String(err?.message || "");

  if (message.startsWith("LICENSE_INVALID:")) {
    const reason = message.slice("LICENSE_INVALID:".length) || "UNKNOWN";
    const errorMessage = mapLicenseReasonToMessage(reason);
    return {
      ok: false,
      licenseError: true,
      code: "LICENSE_INVALID",
      reason,
      error: errorMessage,
      message: errorMessage,
      status: safeGetStatus(),
    };
  }

  if (message.startsWith("FEATURE_NOT_ALLOWED:")) {
    const feature = message.slice("FEATURE_NOT_ALLOWED:".length) || "unknown";
    const errorMessage = mapFeatureToMessage(feature);
    return {
      ok: false,
      licenseError: true,
      code: "FEATURE_NOT_ALLOWED",
      reason: feature,
      error: errorMessage,
      message: errorMessage,
      status: safeGetStatus(),
    };
  }

  return {
    ok: false,
    licenseError: true,
    code: "LICENSE_ERROR",
    reason: "UNKNOWN",
    error: "Lizenzfehler.",
    message: "Lizenzfehler.",
    status: safeGetStatus(),
  };
}

function safeGetStatus() {
  try {
    return getStatus();
  } catch (_err) {
    return null;
  }
}

function mapLicenseReasonToMessage(reason) {
  switch (reason) {
    case "NO_LICENSE":
      return "Keine Lizenz installiert.";
    case "INVALID_FORMAT":
      return "Lizenzdatei ist ungueltig.";
    case "INVALID_SIGNATURE":
      return "Lizenzsignatur ist ungueltig.";
    case "WRONG_PRODUCT":
      return "Diese Lizenz gehoert zu einem anderen Produkt.";
    case "WRONG_MACHINE":
      return "Diese Lizenz gehoert zu einem anderen Rechner.";
    case "LICENSE_EXPIRED":
      return "Die Lizenz ist abgelaufen.";
    default:
      return "Lizenz ist ungueltig.";
  }
}

function mapFeatureToMessage(feature) {
  switch (feature) {
    case LICENSE_FEATURES.AUDIO:
      return "Audio ist fuer diese Lizenz nicht freigeschaltet.";
    default:
      return `Feature nicht freigeschaltet: ${feature}`;
  }
}

module.exports = {
  LICENSE_FEATURES,
  createLicenseBadgeText,
  enforceLicensedFeature,
  toLicenseErrorPayload,
};
