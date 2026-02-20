// src/main/preload/printPreload.js
//
// Minimal bridge for the Print Window (Option A).
// Exposes a robust API for printApp.js, even if naming differs.
//
// Provides:
// - onInit(callback): receives payload from main ("print:init")
// - ready(jobId): signals main ("print:ready")
// - getData(payload): ipc invoke "print:getData"
// Also provides aliases: window.bbmPrint, window.printBridge, window.printApi

const { contextBridge, ipcRenderer } = require("electron");

function makeApi() {
  return {
    onInit: (cb) => {
      if (typeof cb !== "function") return;
      ipcRenderer.removeAllListeners("print:init");
      ipcRenderer.on("print:init", (_evt, payload) => cb(payload));
    },
    ready: (jobIdOrMsg) => {
      // allow ready(jobId) or ready({jobId,...})
      const msg =
        typeof jobIdOrMsg === "object" && jobIdOrMsg
          ? jobIdOrMsg
          : { jobId: jobIdOrMsg };
      ipcRenderer.send("print:ready", msg);
    },
    getData: async (payload) => {
      return ipcRenderer.invoke("print:getData", payload || {});
    },
    // sometimes useful for debugging
    _invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
    _send: (channel, payload) => ipcRenderer.send(channel, payload),
  };
}

const api = makeApi();

// Expose under multiple names to match whatever printApp.js expects.
contextBridge.exposeInMainWorld("bbmPrint", api);
contextBridge.exposeInMainWorld("printBridge", api);
contextBridge.exposeInMainWorld("printApi", api);