function _buildDefaultStatus() {
  return {
    valid: true,
    reason: "STANDARD",
    license: {
      customerName: "",
      licenseId: "",
      edition: "standard",
      validUntil: "",
      features: [],
    },
  };
}

function checkLicense() {
  return _buildDefaultStatus();
}

function getStatus() {
  return _buildDefaultStatus();
}

function requireFeature(_feature) {
  return _buildDefaultStatus();
}

module.exports = {
  checkLicense,
  getStatus,
  requireFeature,
};
