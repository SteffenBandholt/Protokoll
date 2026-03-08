// src/renderer/utils/pdfProtocolsDir.js

export function defaultProtocolsDir() {
  return "C:\\Downloads";
}

export async function resolveProtocolsDir({ settings = null, api = null, router = null, persistIfMissing = false } = {}) {
  const dbApi = api || window.bbmDb || {};
  let resolvedSettings = settings || router?.context?.settings || {};
  let dir = String(resolvedSettings?.["pdf.protocolsDir"] || "").trim();
  let hadStoredValue = !!dir;

  if (!dir && typeof dbApi.appSettingsGetMany === "function") {
    const res = await dbApi.appSettingsGetMany(["pdf.protocolsDir"]);
    if (res?.ok) {
      const fromDb = String(res?.data?.["pdf.protocolsDir"] || "").trim();
      if (fromDb) {
        dir = fromDb;
        hadStoredValue = true;
        resolvedSettings = { ...resolvedSettings, "pdf.protocolsDir": dir };
      }
    }
  }

  if (!dir) {
    dir = defaultProtocolsDir();
    resolvedSettings = { ...resolvedSettings, "pdf.protocolsDir": dir };
    if (!hadStoredValue && persistIfMissing && typeof dbApi.appSettingsSetMany === "function") {
      await dbApi.appSettingsSetMany({ "pdf.protocolsDir": dir });
    }
  }

  if (router?.context) {
    router.context.settings = {
      ...(router.context.settings || {}),
      "pdf.protocolsDir": dir,
    };
  }

  return { dir, settings: resolvedSettings, hadStoredValue };
}
