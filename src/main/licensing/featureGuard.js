const { app } = require("electron");
const { requireFeature, getStatus } = require("./licenseService");
const {
  LICENSE_FEATURES,
  normalizeLicensedFeatures,
  isStandardLicensedFeature,
} = require("./licenseFeatures");

function _extractLicenseInfo(status) {
  const license = status?.license && typeof status.license === "object" ? status.license : {};

  return {
    customerName: String(
      license.customerName || license.customer || license.customer_name || license.customer_name_full || ""
    ).trim(),
    licenseId: String(license.licenseId || license.id || "").trim(),
    edition: String(license.edition || "").trim(),
    validUntil: String(license.validUntil || "").trim(),
    features: normalizeLicensedFeatures(license.features),
    appVersion: String(app?.getVersion?.() || "").trim(),
  };
}

function createLicenseBadgeText(licenseInfo = {}) {
  const year = new Date().getFullYear();
  const version = String(licenseInfo?.appVersion || "").trim();
  const customerName = String(licenseInfo?.customerName || "").trim();
  const licenseId = String(licenseInfo?.licenseId || "").trim();
  const edition = String(licenseInfo?.edition || "").trim();

  const parts = [`(c) BBM ${year}`];
  if (version) parts.push(`v${version}`);
  parts.push(`Lizenz: ${customerName || licenseId || "-"}`);
  if (edition) parts.push(edition);
  return parts.join(" | ");
}

function _readEnvFlag(name) {
  const raw = String(process.env[name] || "").trim().toLowerCase();
  if (!raw) return null;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return null;
}

function isDevAudioOverrideEnabled() {
  // Dev override: set BBM_DEV_UNLOCK_AUDIO=true (DEV only).
  const explicit = _readEnvFlag("BBM_DEV_UNLOCK_AUDIO");
  if (explicit === true) return !app.isPackaged;
  if (explicit === false) return false;
  return !app.isPackaged;
}

function isDevAudioSuggestionsEnabled() {
  // Dev-only legacy audio suggestions flow.
  const explicit = _readEnvFlag("BBM_DEV_ENABLE_AUDIO_SUGGESTIONS");
  if (explicit === true) return !app.isPackaged;
  if (explicit === false) return false;
  return false;
}

function enforceLicensedFeature(feature) {
  const normalizedFeature = String(feature || "").trim().toLowerCase();
  if (normalizedFeature === LICENSE_FEATURES.AUDIO && isDevAudioOverrideEnabled()) {
    return _extractLicenseInfo(getStatus({ fresh: true }));
  }
  if (isStandardLicensedFeature(normalizedFeature)) {
    return _extractLicenseInfo(getStatus({ fresh: true }));
  }

  try {
    requireFeature(normalizedFeature);
    return _extractLicenseInfo(getStatus({ fresh: true }));
  } catch (err) {
    const rawMessage = String(err?.message || "");
    if (rawMessage.startsWith("LICENSE_INVALID:") || rawMessage.startsWith("FEATURE_NOT_ALLOWED:")) {
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
    case "PUBLIC_KEY_MISSING":
    case "PUBLIC_KEY_INVALID":
      return "Lizenzpruefung ist lokal nicht vollstaendig eingerichtet.";
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
    case LICENSE_FEATURES.PDF:
      return "PDF-Erzeugung ist fuer diese Lizenz nicht freigeschaltet.";
    case LICENSE_FEATURES.EXPORT:
      return "Export ist fuer diese Lizenz nicht freigeschaltet.";
    case LICENSE_FEATURES.MAIL:
      return "Mail-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
    case LICENSE_FEATURES.AUDIO:
      return "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
    case LICENSE_FEATURES.APP:
      return "Diese Funktion ist fuer diese Lizenz nicht freigeschaltet.";
    default:
      return `Feature nicht freigeschaltet: ${feature}`;
  }
}

module.exports = {
  LICENSE_FEATURES,
  createLicenseBadgeText,
  enforceLicensedFeature,
  isDevAudioOverrideEnabled,
  isDevAudioSuggestionsEnabled,
  toLicenseErrorPayload,
};
