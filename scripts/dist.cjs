// scripts/dist.cjs
// Baut STABLE oder DEV basierend auf build/channel.json.
// DEV ist sichtbar: Installername BBM-DEV-... und DEV-Badge in der App (BBM_CHANNEL=DEV).

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const channelPath = path.join(root, "build", "channel.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const pkg = readJson(pkgPath);
const version = String(pkg.version || "").trim() || "0.0.0";

let channel = "stable";
try {
  const cfg = readJson(channelPath);
  channel = String(cfg.channel || "stable").trim().toLowerCase();
} catch {
  channel = "stable";
}

const isDev = channel === "dev";

const cfg = isDev
  ? {
      label: "DEV",
      appId: "de.bbm.protokoll.dev",
      productName: "BBM (DEV)",
      artifactName: `BBM-DEV-${version}-Setup.\${ext}`,
      envChannel: "DEV",
    }
  : {
      label: "STABLE",
      appId: "de.bbm.protokoll",
      productName: "BBM",
      artifactName: `BBM-${version}-Setup.\${ext}`,
      envChannel: "STABLE",
    };

console.log("======================================");
console.log(" BBM DIST");
console.log(` Kanal:    ${cfg.label}`);
console.log(` Version:  ${version}`);
console.log(` appId:    ${cfg.appId}`);
console.log(` Name:     ${cfg.productName}`);
console.log("======================================");

const env = {
  ...process.env,
  BBM_CHANNEL: cfg.envChannel,
  ELECTRON_BUILDER_APP_ID: cfg.appId,
  ELECTRON_BUILDER_PRODUCT_NAME: cfg.productName,
  ELECTRON_BUILDER_ARTIFACT_NAME: cfg.artifactName,
};

const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
const res = cp.spawnSync(cmd, ["electron-builder"], { stdio: "inherit", cwd: root, env });
process.exit(res.status ?? 1);
