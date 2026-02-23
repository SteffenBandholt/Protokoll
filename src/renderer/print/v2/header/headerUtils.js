function _el(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function _formatDateIso(value) {
  const s = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "";
  const parts = s.split("-");
  const y = parts[0] || "";
  const m = parts[1] || "";
  const d = parts[2] || "";
  return d + "." + m + "." + y;
}

function _parseBool(value, fallback = false) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return fallback;
  if (["1", "true", "yes", "ja", "on"].includes(s)) return true;
  if (["0", "false", "no", "nein", "off"].includes(s)) return false;
  return fallback;
}

function _protocolTitle(settings) {
  const raw = String(settings?.["pdf.protocolTitle"] || "").trim();
  return raw || "Besprechung";
}

function _projectLabel(project) {
  if (!project) return "Projekt: -";
  const nr = String(project.project_number || project.projectNumber || "").trim();
  const name = String(project.name || "").trim();
  if (nr && name) return "Projekt: " + nr + " - " + name;
  if (nr) return "Projekt: " + nr;
  if (name) return "Projekt: " + name;
  return "Projekt: -";
}

function _meetingLabel(meeting, settings) {
  return _protocolLine(meeting, settings, { withColon: true });
}

function _protocolLine(meeting, settings, { withColon = true } = {}) {
  const title = _protocolTitle(settings);
  if (!meeting) return title;
  const nr =
    meeting.meeting_index ??
    meeting.meetingIndex ??
    meeting.index ??
    meeting.number ??
    "";
  const dateRaw =
    meeting.meeting_date ||
    meeting.meetingDate ||
    meeting.date ||
    meeting.created_at ||
    meeting.createdAt ||
    meeting.updated_at ||
    meeting.updatedAt ||
    "";
  const date = _formatDateIso(dateRaw);
  const parts = [];
  if (nr) parts.push("#" + nr);
  if (date) parts.push("vom " + date);
  if (!parts.length) return title;
  const prefix = title + (withColon ? ":" : "");
  return prefix + " " + parts.join(" ");
}

function _meetingMeta(meeting) {
  if (!meeting) return "";
  const place = String(meeting.place || meeting.location || "").trim();
  const time = String(meeting.time || meeting.meeting_time || "").trim();
  const extra = String(meeting.extra || meeting.note || "").trim();
  const parts = [place, time, extra].filter((p) => String(p || "").trim());
  return parts.join(" | ");
}

function _footerLines(settings) {
  const useUserData = _parseBool(settings?.["pdf.footerUseUserData"], false);
  if (!useUserData) return [];
  const footerPlace = String(settings?.["pdf.footerPlace"] || "").trim();
  const footerDate = String(settings?.["pdf.footerDate"] || "").trim();
  const footerName1 = String(settings?.["pdf.footerName1"] || "").trim();
  const footerName2 = String(settings?.["pdf.footerName2"] || "").trim();
  const footerRecorder = String(settings?.["pdf.footerRecorder"] || "").trim();
  const footerStreet = String(settings?.["pdf.footerStreet"] || "").trim();
  const footerZip = String(settings?.["pdf.footerZip"] || "").trim();
  const footerCity = String(settings?.["pdf.footerCity"] || "").trim();

  const linePlaceDate = [footerPlace, footerDate].filter((v) => v).join(", ");
  const lineNames = [footerName1, footerName2].filter((v) => v).join(", ");
  const lineZipCity = [footerZip, footerCity].filter((v) => v).join(" ").trim();

  const lines = [
    lineNames,
    footerStreet,
    lineZipCity,
    footerRecorder,
    linePlaceDate,
  ].filter((v) => v);
  return lines.slice(0, 4);
}

export const headerUtils = {
  el: _el,
  formatDateIso: _formatDateIso,
  parseBool: _parseBool,
  protocolTitle: _protocolTitle,
  projectLabel: _projectLabel,
  meetingLabel: _meetingLabel,
  protocolLine: _protocolLine,
  meetingMeta: _meetingMeta,
  footerLines: _footerLines,
};
