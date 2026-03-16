// src/main/ipc/licenseIpc.js

const { ipcMain, dialog } = require("electron");
const fs = require("fs");

const { saveLicense, loadLicense, deleteLicense } = require("../licensing/licenseStorage");
const { verifyLicense } = require("../licensing/licenseVerifier");
const { refreshStatus, getStatus } = require("../licensing/licenseService");

function registerLicenseIpc() {

  ipcMain.handle("license:get-status", async () => {
    try {
      const status = getStatus();
      return { ok: true, status };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("license:import", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "Lizenzdatei auswählen",
        properties: ["openFile"],
        filters: [
          { name: "BBM Lizenz", extensions: ["bbmlic", "json"] }
        ]
      });

      if (result.canceled || !result.filePaths.length) {
        return { ok: false, canceled: true };
      }

      const filePath = result.filePaths[0];
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);

      const verification = verifyLicense(parsed);

      if (!verification.valid) {
        return {
          ok: false,
          licenseError: true,
          reason: verification.reason,
          message: "Lizenz ist ungültig."
        };
      }

      saveLicense(parsed);

      const status = refreshStatus();

      return {
        ok: true,
        status
      };

    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("license:delete", async () => {
    try {
      deleteLicense();
      const status = refreshStatus();

      return {
        ok: true,
        status
      };

    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("license:get-installed", async () => {
    try {
      const license = loadLicense();
      return { ok: true, license };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

}

module.exports = {
  registerLicenseIpc,
};