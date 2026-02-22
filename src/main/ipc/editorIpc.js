const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const EDITOR_WIN_W = 820;
const EDITOR_WIN_H = 700;

const openEditors = new Map();

function registerEditorIpc({ getMainWindow } = {}) {
  ipcMain.handle("editor:open", (event, payload) => {
    return new Promise((resolve) => {
      const parent =
        BrowserWindow.fromWebContents(event.sender) ||
        (typeof getMainWindow === "function" ? getMainWindow() : null);
      const preloadPath = path.join(app.getAppPath(), "src", "main", "preload.js");
      const editorHtmlPath = path.join(app.getAppPath(), "src", "renderer", "editor.html");

      const win = new BrowserWindow({
        width: EDITOR_WIN_W,
        height: EDITOR_WIN_H,
        modal: !!parent,
        parent: parent || undefined,
        show: false,
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          devTools: !app.isPackaged,
        },
      });

      const wcId = win.webContents.id;
      openEditors.set(wcId, { resolve, payload, win });

      win.once("ready-to-show", () => {
        if (!win.isDestroyed()) win.show();
      });

      win.on("closed", () => {
        const entry = openEditors.get(wcId);
        if (entry) {
          entry.resolve({ status: "closed" });
          openEditors.delete(wcId);
        }
      });

      win.loadFile(editorHtmlPath);
    });
  });

  ipcMain.handle("editor:getInit", (event) => {
    const entry = openEditors.get(event.sender.id);
    return entry?.payload || null;
  });

  ipcMain.handle("editor:done", (event, result) => {
    const entry = openEditors.get(event.sender.id);
    if (!entry) return { ok: false };
    openEditors.delete(event.sender.id);
    try {
      entry.resolve(result || { status: "done" });
    } finally {
      if (entry.win && !entry.win.isDestroyed()) entry.win.close();
    }
    return { ok: true };
  });
}

module.exports = { registerEditorIpc };
