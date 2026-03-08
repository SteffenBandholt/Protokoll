import { buildProtocolPdfFileInfo } from "../utils/protocolPdfNaming.js";

export function findProtocolPdf({ meeting, project, settings } = {}) {
  const baseDir = String(settings?.["pdf.protocolsDir"] || "").trim();
  if (!baseDir || !meeting || !project) return null;

  return buildProtocolPdfFileInfo({
    baseDir,
    project,
    settings,
    meeting,
  });
}

