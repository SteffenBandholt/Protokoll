const { getStatus, requireFeature } = require("./licenseService");

const LICENSE_FEATURES = Object.freeze({
  PDF_EXPORT: "pdf.export",
  PROJECT_EXPORT: "project.export",
  MAIL_OUTLOOK_DRAFT: "mail.outlookDraft",
});

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
    isTest: !!(license.isTest || license.test || license.testLicense),
    raw: license,
  };
}

function createLicenseBadgeText(licenseInfo = {}) {
  const parts = [];
  if (licenseInfo.customerName) parts.push(licenseInfo.customerName);
  if (licenseInfo.licenseId) parts.push(`Lizenz ${licenseInfo.licenseId}`);
  if (licenseInfo.edition) parts.push(licenseInfo.edition);
  if (licenseInfo.isTest) parts.push("TEST");
  return parts.join(" | ");
}

function _decorateLicenseError(err, status) {
  const message = String(err?.message || err || "").trim();
  const decorated = new Error("Lizenzpruefung fehlgeschlagen.");
  decorated.licenseError = true;
  decorated.status = status || getStatus({ fresh: true });

  if (message.startsWith("LICENSE_INVALID:")) {
    decorated.code = "LICENSE_INVALID";
    decorated.reason = message.slice("LICENSE_INVALID:".length) || decorated.status?.reason || "NO_LICENSE";
    decorated.feature = null;
    decorated.message = `Lizenz ungueltig oder nicht vorhanden (${decorated.reason}).`;
    return decorated;
  }

  if (message.startsWith("FEATURE_NOT_ALLOWED:")) {
    decorated.code = "FEATURE_NOT_ALLOWED";
    decorated.feature = message.slice("FEATURE_NOT_ALLOWED:".length) || "";
    decorated.reason = decorated.status?.reason || "FEATURE_NOT_ALLOWED";
    decorated.message = decorated.feature
      ? `Lizenz erlaubt die Funktion '${decorated.feature}' nicht.`
      : "Lizenz erlaubt diese Funktion nicht.";
    return decorated;
  }

  decorated.code = "LICENSE_INVALID";
  decorated.reason = decorated.status?.reason || "NO_LICENSE";
  decorated.feature = null;
  decorated.message = message || decorated.message;
  return decorated;
}

function enforceLicensedFeature(feature) {
  try {
    requireFeature(feature);
    return _extractLicenseInfo(getStatus({ fresh: true }));
  } catch (err) {
    throw _decorateLicenseError(err);
  }
}

function toLicenseErrorPayload(err) {
  if (!err?.licenseError) {
    return {
      ok: false,
      error: err?.message || String(err),
    };
  }

  const status = err.status || { valid: false, reason: err.reason || "NO_LICENSE" };
  const licenseInfo = _extractLicenseInfo(status);

  return {
    ok: false,
    error: err.message,
    code: err.code,
    reason: err.reason || status.reason || "NO_LICENSE",
    feature: err.feature || null,
    valid: false,
    customerName: licenseInfo.customerName,
    licenseId: licenseInfo.licenseId,
    edition: licenseInfo.edition,
    validUntil: licenseInfo.validUntil,
    features: licenseInfo.features,
  };
}

module.exports = {
  LICENSE_FEATURES,
  createLicenseBadgeText,
  enforceLicensedFeature,
  toLicenseErrorPayload,
};
