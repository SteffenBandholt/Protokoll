const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");

const FILE_NAME = "machine.json";

function getMachineFilePath() {
  const userData = app.getPath("userData");
  return path.join(userData, FILE_NAME);
}

function generateMachineId() {
  return crypto.randomBytes(16).toString("hex");
}

function getMachineId() {
  const filePath = getMachineFilePath();

  // existiert bereits
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (data.machineId) {
        return data.machineId;
      }
    } catch {
      // Datei kaputt → neu erzeugen
    }
  }

  // neue ID erzeugen
  const machineId = generateMachineId();

  const data = {
    machineId,
    createdAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  return machineId;
}

module.exports = {
  getMachineId,
};
