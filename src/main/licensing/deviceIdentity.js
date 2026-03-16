// src/main/licensing/deviceIdentity.js

const os = require("os");
const crypto = require("crypto");

let cachedMachineId = null;

function generateMachineFingerprint() {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  const cpus = os.cpus().map((c) => c.model).join("|");

  const raw = `${hostname}|${platform}|${arch}|${cpus}`;

  return crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex");
}

function getMachineId() {
  if (!cachedMachineId) {
    cachedMachineId = generateMachineFingerprint();
  }

  return cachedMachineId;
}

module.exports = {
  getMachineId,
};