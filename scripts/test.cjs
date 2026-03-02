const assert = require("node:assert/strict");
const path = require("node:path");
const {
  sanitizeDirName,
  resolveProjectFolderName,
  buildStoragePreviewPaths,
} = require("../src/main/ipc/projectStoragePaths");

let failed = false;

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed = true;
    console.error(`not ok - ${name}`);
    console.error(err?.stack || err?.message || err);
  }
}

run("sanitizeDirName ersetzt ungueltige Zeichen", () => {
  const out = sanitizeDirName('A<B>:C"D/E\\F|G?H*');
  assert.equal(out, "A_B__C_D_E_F_G_H_");
});

run("resolveProjectFolderName bildet Nummer + Label", () => {
  const out = resolveProjectFolderName({
    project_number: "P-42",
    short: "Rohbau Nord",
  });
  assert.equal(out, "P-42 - Rohbau Nord");
});

run("buildStoragePreviewPaths erzeugt Zielordner", () => {
  const out = buildStoragePreviewPaths({
    baseDir: "C:\\Daten",
    project: { project_number: "12", short: "Test" },
  });
  assert.equal(out.projectFolder, "12 - Test");
  assert.equal(out.protocolsDir, path.join("C:\\Daten", "bbm", "12 - Test", "Protokolle"));
  assert.equal(out.previewDir, path.join("C:\\Daten", "bbm", "12 - Test", "Vorabzug"));
  assert.equal(out.listsDir, path.join("C:\\Daten", "bbm", "12 - Test", "Listen"));
});

if (failed) {
  process.exitCode = 1;
} else {
  console.log("Alle Tests bestanden.");
}
