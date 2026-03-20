// src/main/ipc/projectTransferIpc.js
//
// Exportiert ein Projekt als ZIP und entfernt es anschließend lokal.
// Enthält nur Export – Import ist nicht Teil dieses Prompts.

const { ipcMain, app, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const yauzl = require("yauzl");
const extract = require("extract-zip");

const { initDatabase } = require("../db/database");
const { appSettingsGetMany } = require("../db/appSettingsRepo");
const projectsRepo = require("../db/projectsRepo");
const { buildStoragePreviewPaths, sanitizeDirName, resolveProjectFolderName } = require("./projectStoragePaths");

function _getExportRoot() {
  const settings = appSettingsGetMany(["pdf.protocolsDir"]) || {};
  const baseDir = String(settings["pdf.protocolsDir"] || "").trim() || app.getPath("downloads");
  return path.join(baseDir, "bbm", "export");
}

function _isPathInside(childPath, parentPath) {
  const absChild = path.resolve(String(childPath || ""));
  const absParent = path.resolve(String(parentPath || ""));
  return absChild == absParent || absChild.startsWith(absParent + path.sep);
}

function _sanitizeFilePart(value, fallback = "Projekt") {
  const clean = String(value || "").trim() || fallback;
  return sanitizeDirName(clean).replace(/\s+/g, "-");
}

function _fetchProjectData(projectId) {
  const db = initDatabase();

  const meetings = db.prepare("SELECT * FROM meetings WHERE project_id = ?").all(projectId);
  const meetingIds = meetings.map((m) => m.id).filter(Boolean);

  const tops = db.prepare("SELECT * FROM tops WHERE project_id = ?").all(projectId);

  const meetingTops =
    meetingIds.length === 0
      ? []
      : db
          .prepare(
            `SELECT * FROM meeting_tops WHERE meeting_id IN (${meetingIds.map(() => "?").join(",")})`
          )
          .all(...meetingIds);

  const meetingParticipants =
    meetingIds.length === 0
      ? []
      : db
          .prepare(
            `SELECT * FROM meeting_participants WHERE meeting_id IN (${meetingIds
              .map(() => "?")
              .join(",")})`
          )
          .all(...meetingIds);

  const projectFirms = db.prepare("SELECT * FROM project_firms WHERE project_id = ?").all(projectId);
  const projectFirmIds = projectFirms.map((f) => f.id).filter(Boolean);

  const projectPersons =
    projectFirmIds.length === 0
      ? []
      : db
          .prepare(
            `SELECT * FROM project_persons WHERE project_firm_id IN (${projectFirmIds
              .map(() => "?")
              .join(",")})`
          )
          .all(...projectFirmIds);

  const projectCandidates = db
    .prepare("SELECT * FROM project_candidates WHERE project_id = ?")
    .all(projectId);

  const projectGlobalFirms = db
    .prepare("SELECT * FROM project_global_firms WHERE project_id = ?")
    .all(projectId);

  const projectSettings = db
    .prepare("SELECT key, value FROM project_settings WHERE project_id = ?")
    .all(projectId);

  return {
    meetings,
    meetingTops,
    meetingParticipants,
    tops,
    projectFirms,
    projectPersons,
    projectCandidates,
    projectGlobalFirms,
    projectSettings,
  };
}

async function _countFilesRecursive(dirPath) {
  let count = 0;
  const stack = [dirPath];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    let entries = [];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else count += 1;
    }
  }
  return count;
}

async function _createExportZip({ exportPath, projectDir, manifest, payloads }) {
  await fs.promises.mkdir(path.dirname(exportPath), { recursive: true });

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(exportPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    for (const part of payloads) {
      archive.append(JSON.stringify(part.data || {}, null, 2), { name: part.name });
    }

    if (projectDir && fs.existsSync(projectDir)) {
      archive.directory(projectDir, "project-folder");
    } else {
      // Stelle sicher, dass project-folder im ZIP existiert (auch leer)
      archive.append("", { name: "project-folder/" });
    }

    archive.finalize();
  });
}

function _validateExportZip(exportPath) {
  return new Promise((resolve, reject) => {
    try {
      const stat = fs.statSync(exportPath);
      if (!stat.isFile() || stat.size <= 0) return resolve({ ok: false, error: "Exportdatei leer." });
    } catch (err) {
      return resolve({ ok: false, error: err?.message || "Exportdatei fehlt." });
    }

    const expect = { manifest: false, projectFolder: false };

    yauzl.open(exportPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return resolve({ ok: false, error: err?.message || "ZIP konnte nicht geöffnet werden." });

      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        const name = entry.fileName || "";
        if (name === "manifest.json") expect.manifest = true;
        if (name.startsWith("project-folder/")) expect.projectFolder = true;
        zipfile.readEntry();
      });

      zipfile.on("error", (zipErr) => {
        resolve({ ok: false, error: zipErr?.message || "ZIP-Fehler." });
      });

      zipfile.on("end", () => {
        if (expect.manifest && expect.projectFolder) {
          resolve({ ok: true });
        } else {
          const missing = [];
          if (!expect.manifest) missing.push("manifest.json");
          if (!expect.projectFolder) missing.push("project-folder");
          resolve({ ok: false, error: `ZIP unvollständig: ${missing.join(", ")}` });
        }
      });
    });
  });
}

async function _readJsonSafe(filePath, label) {
  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: `${label || "JSON"} ungÃ¼ltig: ${err?.message || err}` };
  }
}

function _rowExists(db, table, id) {
  const row = db.prepare(`SELECT 1 AS one FROM ${table} WHERE id = ? LIMIT 1`).get(id);
  return !!row;
}

async function _extractZipToTemp(filePath, tempDir) {
  await fs.promises.mkdir(tempDir, { recursive: true });
  await extract(filePath, { dir: tempDir });
}

async function _readJsonIfExists(filePath, label) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return { ok: true, data: null };
  } catch (_e) {
    return { ok: true, data: null };
  }
  return _readJsonSafe(filePath, label);
}

function _insertRow(db, table, row) {
  if (!row || typeof row !== "object") return;
  const cols = Object.keys(row);
  if (!cols.length) return;
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
  db.prepare(sql).run(cols.map((k) => row[k] ?? null));
}

function _insertRows(db, table, rows = []) {
  for (const r of rows) _insertRow(db, table, r);
}

function _sanitizeProjectRow(project) {
  if (!project || typeof project !== "object") return null;
  const map = {
    id: project.id,
    project_number: project.project_number ?? project.projectNumber ?? project.number ?? null,
    name: project.name ?? null,
    short: project.short ?? project.projectShortName ?? null,
    street: project.street ?? null,
    zip: project.zip ?? null,
    city: project.city ?? null,
    project_lead: project.project_lead ?? project.projectLead ?? null,
    project_lead_phone: project.project_lead_phone ?? project.projectLeadPhone ?? null,
    start_date: project.start_date ?? project.startDate ?? null,
    end_date: project.end_date ?? project.endDate ?? null,
    notes: project.notes ?? null,
    archived_at: project.archived_at ?? project.archivedAt ?? null,
  };
  // Entferne undefined, damit INSERT nur vorhandene Spalten schreibt
  const cleaned = {};
  Object.entries(map).forEach(([k, v]) => {
    if (v !== undefined) cleaned[k] = v === null ? null : v;
  });
  return cleaned;
}

async function _importProjectZip(filePath) {
  if (!filePath) return { ok: false, error: "filePath required" };

  const absPath = path.resolve(String(filePath));
  try {
    const stat = await fs.promises.stat(absPath);
    if (!stat.isFile()) return { ok: false, error: "Datei nicht gefunden." };
  } catch (err) {
    return { ok: false, error: err?.message || "Datei nicht lesbar." };
  }

  const basicValidation = await _validateExportZip(absPath);
  if (!basicValidation.ok) return basicValidation;

  const tempDir = path.join(app.getPath("temp"), `bbm-import-${Date.now()}-${process.pid}`);
  try {
    await _extractZipToTemp(absPath, tempDir);

    const manifestPath = path.join(tempDir, "manifest.json");
    const dataDir = path.join(tempDir, "data");

    const manifestRes = await _readJsonSafe(manifestPath, "manifest");
    if (!manifestRes.ok) return { ok: false, error: manifestRes.error };
    const manifest = manifestRes.data || {};

    // Neue Exportstruktur: getrennte JSON-Dateien unter data/
    const payload = {};
    const projectJson = await _readJsonIfExists(path.join(dataDir, "project.json"), "project.json");
    if (projectJson.ok && projectJson.data?.project) {
      payload.project = projectJson.data.project;
    }
    const settingsJson = await _readJsonIfExists(path.join(dataDir, "settings.json"), "settings.json");
    if (settingsJson.ok) payload.projectSettings = settingsJson.data?.projectSettings || [];
    const meetingsJson = await _readJsonIfExists(path.join(dataDir, "meetings.json"), "meetings.json");
    if (meetingsJson.ok) payload.meetings = meetingsJson.data?.meetings || [];
    const topsJson = await _readJsonIfExists(path.join(dataDir, "tops.json"), "tops.json");
    if (topsJson.ok) payload.tops = topsJson.data?.tops || [];
    const mtJson = await _readJsonIfExists(path.join(dataDir, "meeting_tops.json"), "meeting_tops.json");
    if (mtJson.ok) payload.meetingTops = mtJson.data?.meeting_tops || [];
    const mpJson = await _readJsonIfExists(path.join(dataDir, "meeting_participants.json"), "meeting_participants.json");
    if (mpJson.ok) payload.meetingParticipants = mpJson.data?.meeting_participants || [];
    const pfJson = await _readJsonIfExists(path.join(dataDir, "project_firms.json"), "project_firms.json");
    if (pfJson.ok) payload.projectFirms = pfJson.data?.project_firms || [];
    const ppJson = await _readJsonIfExists(path.join(dataDir, "project_persons.json"), "project_persons.json");
    if (ppJson.ok) payload.projectPersons = ppJson.data?.project_persons || [];
    const pcJson = await _readJsonIfExists(path.join(dataDir, "project_candidates.json"), "project_candidates.json");
    if (pcJson.ok) payload.projectCandidates = pcJson.data?.project_candidates || [];
    const pgfJson = await _readJsonIfExists(path.join(dataDir, "project_global_firms.json"), "project_global_firms.json");
    if (pgfJson.ok) payload.projectGlobalFirms = pgfJson.data?.project_global_firms || [];

    const project = payload.project;
    if (!project?.id) return { ok: false, error: "Projekt-ID fehlt im Export." };

    const projectNumber = project.project_number ?? project.projectNumber ?? manifest.projectNumber ?? null;
    const projectShortName = project.short ?? project.projectShortName ?? manifest.projectShortName ?? null;

    const db = initDatabase();
    if (_rowExists(db, "projects", project.id)) {
      return { ok: false, error: "Projekt existiert bereits (ID)." };
    }
    if (projectNumber) {
      const dup = db.prepare("SELECT id FROM projects WHERE project_number = ? LIMIT 1").get(projectNumber);
      if (dup) return { ok: false, error: "Projekt mit gleicher Projektnummer existiert bereits." };
    }

    const projectFolderSource = path.join(tempDir, "project-folder");
    try {
      const s = await fs.promises.stat(projectFolderSource);
      if (!s.isDirectory()) throw new Error("project-folder fehlt.");
    } catch (err) {
      return { ok: false, error: "project-folder fehlt im Export." };
    }

    const settings = appSettingsGetMany(["pdf.protocolsDir"]) || {};
    const baseDir = String(settings["pdf.protocolsDir"] || "").trim() || app.getPath("downloads");
    const projectFolderName = resolveProjectFolderName({
      project_number: projectNumber,
      short: projectShortName,
      name: project.name,
    });
    const targetDir = path.join(baseDir, "bbm", projectFolderName);
    if (fs.existsSync(targetDir)) {
      return { ok: false, error: "Projektordner existiert bereits." };
    }

    const tx = db.transaction(() => {
      const sanitizedProject = _sanitizeProjectRow(project);
      if (!sanitizedProject?.id) throw new Error("Projektdaten unvollst?ndig (id fehlt).");
      _insertRow(db, "projects", sanitizedProject);
      const pid = sanitizedProject.id;
      const withPid = (rows = []) => rows.map((r) => ({ ...(r || {}), project_id: pid }));

      _insertRows(db, "project_settings", withPid(payload.projectSettings || []));
      _insertRows(db, "project_firms", withPid(payload.projectFirms || []));
      _insertRows(db, "project_persons", payload.projectPersons || []);
      _insertRows(db, "project_candidates", withPid(payload.projectCandidates || []));
      _insertRows(db, "project_global_firms", withPid(payload.projectGlobalFirms || []));
      _insertRows(db, "meetings", withPid(payload.meetings || []));
      _insertRows(db, "tops", withPid(payload.tops || []));
      _insertRows(db, "meeting_tops", payload.meetingTops || []);
      _insertRows(db, "meeting_participants", payload.meetingParticipants || []);
    });

    tx();

    await fs.promises.mkdir(path.dirname(targetDir), { recursive: true });
    await fs.promises.cp(projectFolderSource, targetDir, { recursive: true });

    return {
      ok: true,
      projectId: project.id,
      projectNumber,
      projectShortName,
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  } finally {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (_e) {
      // ignore cleanup errors
    }
  }
}

function registerProjectTransferIpc() {
  ipcMain.handle("projectTransfer:export", async (_evt, raw) => {
    const projectId = raw?.projectId ?? raw?.project_id ?? raw?.id ?? null;
    if (!projectId) return { ok: false, error: "projectId required" };

    try {
      const project = projectsRepo.getById(projectId);
      if (!project) throw new Error("Projekt nicht gefunden.");

      const exportRoot = _getExportRoot();
      const baseDir = path.dirname(path.dirname(exportRoot)); // <baseDir>/bbm/export -> <baseDir>
      const storage = buildStoragePreviewPaths({ baseDir, project });
      const projectDir = path.dirname(storage.previewDir); // .../bbm/<Projektordner>

      const fileNumber = _sanitizeFilePart(
        project.project_number ?? project.projectNumber ?? project.number ?? project.id
      );
      const fileShort = _sanitizeFilePart(project.short ?? project.name ?? "Projekt");
      const exportName = `${fileNumber}-${fileShort}-export.zip`;
      const exportPath = path.join(exportRoot, exportName);

      const data = _fetchProjectData(projectId);
      const exportedAt = new Date().toISOString();
      const counts = {
        meetings: data.meetings.length,
        tops: data.tops.length,
        meetingTops: data.meetingTops.length,
        meetingParticipants: data.meetingParticipants.length,
        projectFirms: data.projectFirms.length,
        projectPersons: data.projectPersons.length,
        projectCandidates: data.projectCandidates.length,
        projectGlobalFirms: data.projectGlobalFirms.length,
        projectSettings: data.projectSettings.length,
      };

      const filesCount = projectDir && fs.existsSync(projectDir) ? await _countFilesRecursive(projectDir) : 0;

      const manifest = {
        formatVersion: 2,
        exportDate: exportedAt,
        appVersion: app.getVersion ? app.getVersion() : "",
        projectId,
        projectNumber: project.project_number ?? project.projectNumber ?? null,
        projectShortName: project.short ?? null,
        projectName: project.name ?? null,
        projectFolder: {
          baseDir: storage.baseDir,
          folder: storage.projectFolder,
        },
        counts: {
          ...counts,
          filesCount,
        },
      };

      const payloads = [
        { name: "data/project.json", data: { project } },
        { name: "data/settings.json", data: { projectSettings: data.projectSettings || [] } },
        { name: "data/meetings.json", data: { meetings: data.meetings || [] } },
        { name: "data/tops.json", data: { tops: data.tops || [] } },
        { name: "data/meeting_tops.json", data: { meeting_tops: data.meetingTops || [] } },
        { name: "data/meeting_participants.json", data: { meeting_participants: data.meetingParticipants || [] } },
        { name: "data/project_firms.json", data: { project_firms: data.projectFirms || [] } },
        { name: "data/project_persons.json", data: { project_persons: data.projectPersons || [] } },
        { name: "data/project_candidates.json", data: { project_candidates: data.projectCandidates || [] } },
        { name: "data/project_global_firms.json", data: { project_global_firms: data.projectGlobalFirms || [] } },
      ];

      await _createExportZip({
        exportPath,
        projectDir,
        manifest,
        payloads,
      });

      const validation = await _validateExportZip(exportPath);
      if (!validation.ok) {
        return { ok: false, error: validation.error || "Exportvalidierung fehlgeschlagen." };
      }

      // Erst nach erfolgreicher Validierung löschen
      projectsRepo.deleteForever(projectId);
      if (projectDir && fs.existsSync(projectDir)) {
        await fs.promises.rm(projectDir, { recursive: true, force: true });
      }

      return {
        ok: true,
        exportPath,
        projectId,
        projectNumber: project.project_number ?? project.projectNumber ?? null,
        projectShortName: project.short ?? null,
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("projectTransfer:import", async (_evt, raw) => {
    const filePath = typeof raw === "string" ? raw : raw?.filePath || raw?.path || null;
    return _importProjectZip(filePath);
  });

  ipcMain.handle("projectTransfer:listExports", async () => {
    const exportRoot = _getExportRoot();
    try {
      await fs.promises.mkdir(exportRoot, { recursive: true });
      const entries = await fs.promises.readdir(exportRoot, { withFileTypes: true });
      const list = [];
      for (const ent of entries) {
        if (!ent.isFile()) continue;
        if (!String(ent.name || "").toLowerCase().endsWith(".zip")) continue;
        const fullPath = path.join(exportRoot, ent.name);
        try {
          const stat = await fs.promises.stat(fullPath);
          if (!stat.isFile()) continue;
          list.push({
            fileName: ent.name,
            filePath: fullPath,
            size: stat.size || 0,
            mtimeMs: stat.mtimeMs || 0,
          });
        } catch (_e) {
          // ignore unreadable entries
        }
      }
      list.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
      return { ok: true, exportRoot, list };
    } catch (err) {
      return { ok: false, error: err?.message || "Export-Ordner konnte nicht gelesen werden." };
    }
  });


  ipcMain.handle("projectTransfer:openExportFolder", async () => {
    const exportRoot = _getExportRoot();
    try {
      await fs.promises.mkdir(exportRoot, { recursive: true });
      const errorText = await shell.openPath(exportRoot);
      if (errorText) return { ok: false, error: errorText };
      return { ok: true, exportRoot };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("projectTransfer:importFromExport", async (_evt, raw) => {
    const exportRoot = _getExportRoot();
    const filePath = raw?.filePath || (raw?.fileName ? path.join(exportRoot, raw.fileName) : null);
    if (!filePath) return { ok: false, error: "filePath required" };
    if (!_isPathInside(filePath, exportRoot)) {
      return { ok: false, error: "Dateipfad liegt nicht im Export-Ordner." };
    }

    const res = await _importProjectZip(filePath);
    if (!res?.ok) return res;

    try {
      await fs.promises.rm(filePath, { force: true });
    } catch (err) {
      return { ok: false, error: err?.message || "Import ok, aber Exportdatei konnte nicht gel?scht werden." };
    }

    return { ...res, deleted: true };
  });
}

module.exports = { registerProjectTransferIpc };

