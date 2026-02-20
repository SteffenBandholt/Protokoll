// src/main/print/printWindow.js
//
// Print window for Option A (Hidden Print Window).
// Uses a dedicated print preload that exposes a small, stable API to the print renderer.
//

const { BrowserWindow, app } = require("electron");
const path = require("path");
const url = require("url");

function getPrintAppUrl() {
  // Dedicated print HTML entry
  const filePath = path.join(app.getAppPath(), "src", "renderer", "print", "index.html");
  return url.format({
    protocol: "file:",
    slashes: true,
    pathname: filePath,
  });
}

function createPrintWindow(opts = {}) {
  const debug = !!opts.debug;

  // Dedicated PRELOAD for print window (must exist!)
  const preloadPath = path.join(app.getAppPath(), "src", "main", "preload", "printPreload.js");

  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    show: debug, // DEV: show the print window
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  try {
    win.setMenuBarVisibility(false);
  } catch (_e) {}

  if (debug) {
    win.webContents.once("did-finish-load", () => {
      try {
        win.webContents.openDevTools({ mode: "detach" });
      } catch (_e) {}
    });
  }

  return win;
}

module.exports = { createPrintWindow, getPrintAppUrl };