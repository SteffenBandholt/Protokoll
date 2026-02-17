// src/main/ipc/printIpc.js
//
// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.1
//
// ============================================================
// INVARIANT (DO NOT BREAK) – ONE PRINT PATH RULE
// ------------------------------------------------------------
// Renderer -> bbmDb.printHtmlToPdf -> IPC "print:htmlToPdf" -> printIpc.js
// Kein paralleler/zweiter Pfad, der heimlich genutzt wird.
// ============================================================
//
// Druck: HTML -> PDF via Chromium printToPDF
// Phase 1.1: nur Rendering/Optik (Footer Seite X/Y), keine Business-Logik.

const { BrowserWindow, ipcMain, app } = require("electron");
const fs = require("fs");
const path = require("path");

function sanitizeFileName(name) {
  const s = String(name || "").trim() || "BBM.pdf";
  const safe = s
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

function uniquePath(dir, fileName) {
  const base = sanitizeFileName(fileName);
  const full = path.join(dir, base);
  if (!fs.existsSync(full)) return full;

  const ext = path.extname(base) || ".pdf";
  const stem = base.slice(0, base.length - ext.length);

  for (let i = 2; i < 9999; i++) {
    const p = path.join(dir, `${stem} (${i})${ext}`);
    if (!fs.existsSync(p)) return p;
  }
  return path.join(dir, `${stem} (${Date.now()})${ext}`);
}

function buildFooterTemplate() {
  // Chromium ersetzt pageNumber/totalPages/date automatisch (nur in header/footer templates!)
  return `
    <div style="width:100%; font-size:9px; color:#666; padding:0 18mm; box-sizing:border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <div></div>
        <div></div>
        <div>Seite <span class="pageNumber"></span> / <span class="totalPages"></span></div>
      </div>
    </div>
  `;
}

function buildHeaderTemplate() {
  // wir nutzen den PDF-Header im HTML selbst -> hier bewusst leer
  return `<div></div>`;
}

async function htmlToPdf({ html, fileName, bbmVersion, targetDir, baseDir, projectNumber, overwrite } = {}) {
  if (!html) throw new Error("html fehlt");

  const downloads = app.getPath("downloads");
  const tempDir = app.getPath("temp");
  let outBaseDir = targetDir === "temp" ? tempDir : downloads;
  if (targetDir && targetDir !== "temp") {
    outBaseDir = targetDir;
  } else if (baseDir) {
    outBaseDir = baseDir;
  }
  let outDir = outBaseDir;
  if (projectNumber && targetDir !== "temp") {
    outDir = path.join(outBaseDir, "bbm", String(projectNumber));
  }
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = overwrite
    ? path.join(outDir, sanitizeFileName(fileName || "BBM.pdf"))
    : uniquePath(outDir, fileName || "BBM.pdf");

  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 900,
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    const url = `data:text/html;charset=utf-8,${encodeURIComponent(String(html))}`;
    await win.loadURL(url);

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: "A4",

      // Footer Seite X/Y + BBM 1.0 + Datum (Chromium)
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(),
      footerTemplate: buildFooterTemplate(),

      // In Electron/Chromium sind margins in inches (wenn unterstützt)
      margin: {
        top: 0.0, // ~0mm
        bottom: 1.1, // ~28mm (Footer Platz)
        left: 0.7, // ~18mm
        right: 0.7, // ~18mm
      },
    });

    fs.writeFileSync(outPath, pdfBuffer);
    return outPath;
  } finally {
    try {
      win.close();
    } catch (_e) {
      // ignore
    }
  }
}

function registerPrintIpc() {
  ipcMain.handle("print:htmlToPdf", async (_evt, payload) => {
    try {
      const p = payload || {};
      const outPath = await htmlToPdf({
        html: p.html,
        fileName: p.fileName,
        bbmVersion: p.bbmVersion,
        targetDir: p.targetDir,
        baseDir: p.baseDir,
        projectNumber: p.projectNumber,
        overwrite: p.overwrite,
      });
      return { ok: true, filePath: outPath };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
}

module.exports = { registerPrintIpc };
