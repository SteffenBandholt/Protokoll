const fs = require("node:fs");
const crypto = require("node:crypto");

const { canonicalize, verifyLicense } = require("../../src/main/licensing/licenseVerifier");

function withEnv(name, value, fn) {
  const hadValue = Object.prototype.hasOwnProperty.call(process.env, name);
  const previous = process.env[name];
  if (value === undefined || value === null) delete process.env[name];
  else process.env[name] = String(value);

  try {
    return fn();
  } finally {
    if (hadValue) process.env[name] = previous;
    else delete process.env[name];
  }
}

function buildLicense(features = ["app", "pdf", "export", "mail"]) {
  return {
    schemaVersion: 1,
    product: "bbm-protokoll",
    licenseId: "TEST-001",
    customerName: "Testkunde",
    edition: "standard",
    issuedAt: "2026-03-17",
    validUntil: "2099-12-31",
    maxDevices: 1,
    features,
  };
}

function signLicense(license, privateKey) {
  return crypto.sign(null, Buffer.from(canonicalize(license), "utf8"), privateKey).toString("base64");
}

module.exports = function licenseVerifierTests(run, { assert }) {
  run("licenseVerifier akzeptiert gueltige Signaturen mit konfiguriertem Public Key", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
    const license = buildLicense();
    const signature = signLicense(license, privateKey);

    withEnv("BBM_LICENSE_PUBLIC_KEY", publicKeyPem, () => {
      withEnv("BBM_LICENSE_PUBLIC_KEY_PATH", undefined, () => {
        const result = verifyLicense({ license, signature });
        assert.equal(result.valid, true);
      });
    });
  });

  run("licenseVerifier weist manipulierte Lizenzen trotz gueltiger Signaturquelle ab", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
    const license = buildLicense();
    const signature = signLicense(license, privateKey);
    const manipulated = { ...license, features: [...license.features, "audio"] };

    withEnv("BBM_LICENSE_PUBLIC_KEY", publicKeyPem, () => {
      withEnv("BBM_LICENSE_PUBLIC_KEY_PATH", undefined, () => {
        const result = verifyLicense({ license: manipulated, signature });
        assert.equal(result.valid, false);
        assert.equal(result.reason, "INVALID_SIGNATURE");
      });
    });
  });

  run("gebuendelter Public Key passt zum lokalen license-tool Private Key", () => {
    const privateKeyPath = "C:\\license-tool\\keys\\private_key.pem";
    if (!fs.existsSync(privateKeyPath)) return;

    const privateKeyPem = fs.readFileSync(privateKeyPath, "utf8");
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const license = buildLicense(["app", "pdf", "export", "mail", "audio"]);
    const signature = signLicense(license, privateKey);

    withEnv("BBM_LICENSE_PUBLIC_KEY", undefined, () => {
      withEnv("BBM_LICENSE_PUBLIC_KEY_PATH", undefined, () => {
        const result = verifyLicense({ license, signature });
        assert.equal(result.valid, true);
      });
    });
  });
};
