const path = require("path");

function sanitizeDirName(name) {
  const s = String(name || "").trim() || "Projekt";
  return s
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function resolveProjectFolderName(project = {}) {
  const number = String(
    project?.project_number ||
      project?.projectNumber ||
      project?.number ||
      ""
  ).trim();
  const short = String(project?.short || "").trim();
  const name = String(project?.name || "").trim();
  const label = short || name || "Projekt";
  const rawFolder = number ? `${number} - ${label}` : label;
  return sanitizeDirName(rawFolder);
}

function buildStoragePreviewPaths({ baseDir, project } = {}) {
  const normalizedBase = String(baseDir || "").trim();
  const projectFolder = resolveProjectFolderName(project || {});
  const projectBaseDir = path.join(normalizedBase, "bbm", projectFolder);
  return {
    baseDir: normalizedBase,
    projectFolder,
    protocolsDir: path.join(projectBaseDir, "Protokolle"),
    previewDir: path.join(projectBaseDir, "Vorabzug"),
    listsDir: path.join(projectBaseDir, "Listen"),
  };
}

module.exports = {
  sanitizeDirName,
  resolveProjectFolderName,
  buildStoragePreviewPaths,
};
