// scripts/dist.cjs
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const channelPath = path.join(root, "build", "channel.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// ------------------------------------------------------------
// Version lesen
// ------------------------------------------------------------
let pkg;
try {
  pkg = readJson(pkgPath);
} catch (e) {
  console.error("[dist] Kann package.json nicht lesen:", e?.message || e);
  process.exit(1);
}

const version = String(pkg.version || "").trim() || "0.0.0";

// ------------------------------------------------------------
// Kanal lesen (dev / stable)
// ------------------------------------------------------------
let channel = "stable";
try {
  const data = readJson(channelPath);
  channel = String(data.channel || "stable").trim().toLowerCase();
} catch {
  channel = "stable";
}

const isDev = channel === "dev";

// ------------------------------------------------------------
// Build-Konfiguration
// ------------------------------------------------------------
const prefix = isDev ? `BBM-DEV-${version}` : `BBM-${version}`;
const appId = isDev ? "de.bbm.protokoll.dev" : "de.bbm.protokoll";
const productName = isDev ? "BBM (DEV)" : "BBM";
const envChannel = isDev ? "DEV" : "STABLE";

// electron-builder Makros als Literaltext
const artifactNsis = prefix + "-Setup.${ext}";
const artifactPortable = prefix + ".${ext}";

console.log("======================================");
console.log(" BBM DIST");
console.log(" Kanal:   ", envChannel);
console.log(" Version: ", version);
console.log(" appId:   ", appId);
console.log(" Name:    ", productName);
console.log(" NSIS:    ", artifactNsis);
console.log(" Portable:", artifactPortable);
console.log("======================================");

// ------------------------------------------------------------
// ENV für Build
// ------------------------------------------------------------
const env = {
  ...process.env,
  BBM_CHANNEL: envChannel
};

// ------------------------------------------------------------
// electron-builder CLI finden
// ------------------------------------------------------------
const builderJs = path.join(
  root,
  "node_modules",
  "electron-builder",
  "out",
  "cli",
  "cli.js"
);

if (!fs.existsSync(builderJs)) {
  console.error("[dist] electron-builder nicht gefunden.");
  console.error("Bitte zuerst im Repo-Ordner ausführen:");
  console.error("npm install");
  process.exit(1);
}

console.log("[dist] Starte electron-builder...");
console.log("[dist] node", builderJs);

// ------------------------------------------------------------
// CLI Argumente
// ------------------------------------------------------------
const args = [
  builderJs,

  // grundlegende Metadaten
  `--config.appId=${appId}`,
  `--config.productName=${productName}`,

  // DEV/STABLE Kennung in package.json der App
  `--config.extraMetadata.bbmChannel=${envChannel}`,

  // Dateinamen
  `--config.nsis.artifactName=${artifactNsis}`,
  `--config.portable.artifactName=${artifactPortable}`
];

// ------------------------------------------------------------
// Builder starten
// ------------------------------------------------------------
const res = cp.spawnSync(process.execPath, args, {
  cwd: root,
  env,
  stdio: "inherit",
  windowsHide: false
});

if (res.error) {
  console.error("[dist] Spawn Fehler:", res.error?.message || res.error);
}

console.log("[dist] Exitcode:", res.status);
process.exit(typeof res.status === "number" ? res.status : 1);