// src/renderer/utils/pdfProtocolNaming.js

function sanitizeFileSegment(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatProtocolDate(value) {
  const raw = String(value || "").trim();
  if (raw) {
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;

    const de = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (de) return `${de[1]}.${de[2]}.${de[3]}`;
  }

  const dt = value instanceof Date ? value : new Date(value || Date.now());
  const safe = Number.isNaN(dt.getTime()) ? new Date() : dt;
  const dd = String(safe.getDate()).padStart(2, "0");
  const mm = String(safe.getMonth() + 1).padStart(2, "0");
  const yyyy = String(safe.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

function normalizeMeetingIndex(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "#-";
  return raw.startsWith("#") ? raw : `#${raw}`;
}

export function buildProtocolPdfFileName({
  projectNumber,
  projectShort,
  protocolTitle,
  meetingIndex,
  meetingDate,
} = {}) {
  const numberPart = sanitizeFileSegment(projectNumber || "");
  const shortPart = sanitizeFileSegment(projectShort || "");
  const titlePart = sanitizeFileSegment(protocolTitle || "Protokoll");
  const indexPart = sanitizeFileSegment(normalizeMeetingIndex(meetingIndex));
  const datePart = formatProtocolDate(meetingDate);

  const parts = [numberPart, shortPart, titlePart, `${indexPart} - ${datePart}`].filter(Boolean);
  const base = parts.join("_").trim() || `Protokoll_${datePart}`;
  return `${base}.pdf`;
}

export { sanitizeFileSegment, formatProtocolDate, normalizeMeetingIndex };
