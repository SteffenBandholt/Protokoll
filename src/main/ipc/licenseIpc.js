const { ipcMain } = require("electron");
const { checkLicense } = require("../licensing/licenseService");

let registered = false;

function registerLicenseIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("license:getStatus", async () => {
    return { ok: true, status: checkLicense() };
  });

  ipcMain.handle("license:refreshStatus", async () => {
    return { ok: true, status: checkLicense() };
  });
}

module.exports = {
  registerLicenseIpc,
};
