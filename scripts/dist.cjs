#!/usr/bin/env node
/**
 * scripts/dist.cjs
 *
 * Liest channel.json im Repo-Root:
 *   { "channel": "DEV" }    -> DEV Build (separate appId, Name, Artefakte + DEV Badge)
 *   { "channel": "STABLE" } -> Stable Build (keine -DEV-Erweiterung, kein Badge)
 *
 * WICHTIG:
 * - Kein ${target} Macro (electron-builder kennt das nicht).
 * - DEV/Stable wird über extraMetadata.buildChannel in die gepackte package.json eingebrannt.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (_e) {
    return null;
  }
}

function writeJsonAtomic(p, data) {
  const dir = path.dirname(p);
  const tmp = path.join(dir, `.tmp-${path.basename(p)}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, p);
}

function normalizeChannel(v) {
  const s = String(v || "").trim().toUpperCase();
  return s === "DEV" ? "DEV" : "STABLE";
}

function findRepoRoot(start) {
  let cur = path.resolve(start || process.cwd());
  const root = path.parse(cur).root;
  while (true) {
    const pkg = path.join(cur, "package.json");
    if (fs.existsSync(pkg)) return cur;
    if (cur === root) break;
    cur = path.dirname(cur);
  }
  return null;
}

function main() {
  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) {
    console.error("[dist] Fehler: package.json nicht gefunden (Repo-Root).");
    process.exit(1);
  }

  const pkgPath = path.join(repoRoot, "package.json");
  const pkg = readJsonSafe(pkgPath);
  if (!pkg) {
    console.error("[dist] Fehler: package.json konnte nicht gelesen werden.");
    process.exit(1);
  }

  const baseBuild = pkg.build || {};
  const baseVersion = String(pkg.version || "").trim() || "0.0.0";

  // channel.json
  const channelPath = path.join(repoRoot, "channel.json");
  const channelJson = readJsonSafe(channelPath) || { channel: "DEV" };
  const channel = normalizeChannel(channelJson.channel);
  const isDev = channel === "DEV";

  // Stable Defaults (aus package.json build/appId + productName)
  const stableAppId = String(baseBuild.appId || "").trim() || "de.bbm.protokoll";
  const stableProductName = String(baseBuild.productName || "").trim() || "BBM";

  // Derived DEV
  const devAppId = stableAppId.toLowerCase().endsWith(".dev") ? stableAppId : `${stableAppId}.dev`;
  const devProductName = /\(dev\)/i.test(stableProductName) ? stableProductName : `${stableProductName} (DEV)`;

  const appId = isDev ? devAppId : stableAppId;
  const productName = isDev ? devProductName : stableProductName;

  const prefix = isDev ? "BBM-DEV" : "BBM";
  const nsisName = `${prefix}-${baseVersion}-Setup.\${ext}`;

  // Override-Config für electron-builder (als separate Config-Datei)
  const override = {
    ...baseBuild,
    appId,
    productName,
    extraMetadata: {
      ...(baseBuild.extraMetadata || {}),
      // ✅ wird in die gepackte package.json geschrieben
      buildChannel: channel,
    },
    // ✅ pro Target eigene artifactName (kein ${target})
    nsis: {
      ...(baseBuild.nsis || {}),
      artifactName: nsisName,
    },
  };

  const tmpConfigPath = path.join(repoRoot, "dist", `builder-config-${Date.now()}.json`);
  writeJsonAtomic(tmpConfigPath, override);

  console.log("======================================");
  console.log(" BBM DIST");
  console.log(" Kanal:   ", channel);
  console.log(" Version: ", baseVersion);
  console.log(" appId:   ", appId);
  console.log(" Name:    ", productName);
  console.log(" NSIS:    ", nsisName);
  console.log("======================================");

  const cliJs = path.join(repoRoot, "node_modules", "electron-builder", "out", "cli", "cli.js");
  if (!fs.existsSync(cliJs)) {
    console.error("[dist] Fehler: electron-builder CLI nicht gefunden:", cliJs);
    process.exit(1);
  }

  console.log("[dist] Starte electron-builder...");
  console.log("[dist] node", cliJs);

  const child = spawn(process.execPath, [cliJs, "--config", tmpConfigPath], {
    cwd: repoRoot,
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("close", (code) => {
    console.log("[dist] Exitcode:", code);
    try {
      fs.unlinkSync(tmpConfigPath);
    } catch (_e) {}
    process.exit(code || 0);
  });
}

main();
