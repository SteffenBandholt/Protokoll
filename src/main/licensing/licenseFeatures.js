const LICENSE_FEATURES = Object.freeze({
  APP: "app",
  PDF: "pdf",
  EXPORT: "export",
  MAIL: "mail",
  MAIL_OUTLOOK_DRAFT: "mail",
  AUDIO: "audio",
});

const STANDARD_LICENSE_FEATURES = Object.freeze([
  LICENSE_FEATURES.APP,
  LICENSE_FEATURES.PDF,
  LICENSE_FEATURES.EXPORT,
  LICENSE_FEATURES.MAIL,
]);

const OPTIONAL_LICENSE_FEATURES = Object.freeze([LICENSE_FEATURES.AUDIO]);

const STANDARD_LICENSE_FEATURE_SET = new Set(STANDARD_LICENSE_FEATURES);
const OPTIONAL_LICENSE_FEATURE_SET = new Set(OPTIONAL_LICENSE_FEATURES);

function _normalizeFeatureValue(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeOptionalLicensedFeatures(features) {
  if (!Array.isArray(features)) return [];

  const normalized = [];
  const seen = new Set();

  features.forEach((value) => {
    const feature = _normalizeFeatureValue(value);
    if (!feature || !OPTIONAL_LICENSE_FEATURE_SET.has(feature) || seen.has(feature)) return;
    seen.add(feature);
    normalized.push(feature);
  });

  return normalized;
}

function normalizeLicensedFeatures(features) {
  return [...STANDARD_LICENSE_FEATURES, ...normalizeOptionalLicensedFeatures(features)];
}

function isStandardLicensedFeature(feature) {
  return STANDARD_LICENSE_FEATURE_SET.has(_normalizeFeatureValue(feature));
}

function isOptionalLicensedFeature(feature) {
  return OPTIONAL_LICENSE_FEATURE_SET.has(_normalizeFeatureValue(feature));
}

module.exports = {
  LICENSE_FEATURES,
  STANDARD_LICENSE_FEATURES,
  OPTIONAL_LICENSE_FEATURES,
  normalizeLicensedFeatures,
  normalizeOptionalLicensedFeatures,
  isStandardLicensedFeature,
  isOptionalLicensedFeature,
};
