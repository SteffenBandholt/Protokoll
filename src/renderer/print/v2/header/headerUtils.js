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

function _protocolTitleFromSettings(settings) {
  const raw = String(settings?.["pdf.protocolTitle"] || "").trim();
  return raw || "Protokoll";
}

function _docLabelFromMode(mode) {
  const m = String(mode || "").trim();
  if (m === "preview" || m === "vorabzug") return "Vorabzug";
  if (m === "protocol") return "Protokoll";
  if (m === "topsAll") return "Liste aller Top´s im Projekt";
  if (m === "firms") return "Firmenliste";
  if (m === "todo") return "ToDo-Liste";
  if (m === "headerTest") return "Kopf-Test";
  return "Dokument";
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

function _projectNameLine(project) {
  if (!project) return "-";
  const nr = String(project.project_number || project.projectNumber || "").trim();
  const name = String(project.name || "").trim();
  if (nr && name) return nr + " - " + name;
  if (nr) return nr;
  if (name) return name;
  return "-";
}

function _meetingLabel(meeting, titlePrefix) {
  return _protocolLine({ meeting, titlePrefix });
}

function _protocolLine(meetingOrOpts, settingsMaybe, optionsMaybe = {}) {
  let meeting = meetingOrOpts;
  let settings = settingsMaybe;
  let titlePrefix = optionsMaybe?.titlePrefix || "";
  if (
    meetingOrOpts &&
    typeof meetingOrOpts === "object" &&
    (Object.prototype.hasOwnProperty.call(meetingOrOpts, "meeting") ||
      Object.prototype.hasOwnProperty.call(meetingOrOpts, "settings") ||
      Object.prototype.hasOwnProperty.call(meetingOrOpts, "titlePrefix"))
  ) {
    meeting = meetingOrOpts.meeting;
    settings = meetingOrOpts.settings;
    titlePrefix = meetingOrOpts.titlePrefix || "";
  }

  const title = String(titlePrefix || "").trim() || _protocolTitleFromSettings(settings);
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
  const nrText = nr ? "#" + String(nr) : "";
  if (nrText && date) return title + " : " + nrText + " vom " + date;
  if (nrText) return title + " : " + nrText;
  if (date) return title + " : vom " + date;
  return title;
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

function _resolveHeaderTitle({ data, settings, meeting, modeLabel } = {}) {
  const profile = data?.printProfile || {};
  const titleMode = String(profile?.header?.titleMode || "").trim();
  const protocolTitle = String(data?.protocolTitle || "").trim() || _protocolTitleFromSettings(settings);
  if (titleMode === "documentLabel") {
    const fromProfile = String(profile?.documentLabel || "").trim();
    const fromMode = _docLabelFromMode(data?.mode);
    return fromProfile || String(modeLabel || "").trim() || fromMode;
  }
  if (titleMode === "baseTitle") return protocolTitle;
  return _protocolLine({ meeting, settings, titlePrefix: protocolTitle });
}

function _listStandLine({ data, meeting } = {}) {
  const mode = String(data?.mode || "").trim();
  if (!(mode === "firms" || mode === "todo" || mode === "topsAll" || mode === "protocol")) return "";
  // In der v2-Vollkopfzeile sollen für Protokoll/Vorabzug keine Nummer-/Datumszeilen angezeigt werden.
  if (mode === "protocol" || mode === "preview") return "";

  const meetingIndex =
    meeting?.meeting_index ?? meeting?.meetingIndex ?? meeting?.index ?? meeting?.number ?? "";

  const dateRaw =
    meeting?.meeting_date ||
    meeting?.meetingDate ||
    meeting?.date ||
    meeting?.created_at ||
    meeting?.createdAt ||
    meeting?.updated_at ||
    meeting?.updatedAt ||
    "";
  const meetingDate = _formatDateIso(dateRaw);

  const idxText = meetingIndex ? `Nummer:  #${meetingIndex}` : "Nummer:  #-";
  const dateText = meetingDate ? `Datum:   ${meetingDate}` : "Datum:   -";

  return `${idxText}\n${dateText}`;
}

function _resolveBranding({ data } = {}) {
  const profile = data?.printProfile || {};
  const enabled = !!profile?.branding?.enabled;
  const label = String(profile?.branding?.label || "").trim();
  if (!enabled || !label) return "";
  return label;
}

export const headerUtils = {
  el: _el,
  formatDateIso: _formatDateIso,
  parseBool: _parseBool,
  protocolTitleFromSettings: _protocolTitleFromSettings,
  protocolTitle: _protocolTitleFromSettings,
  projectLabel: _projectLabel,
  projectNameLine: _projectNameLine,
  meetingLabel: _meetingLabel,
  protocolLine: _protocolLine,
  meetingMeta: _meetingMeta,
  footerLines: _footerLines,
  resolveHeaderTitle: _resolveHeaderTitle,
  listStandLine: _listStandLine,
  resolveBranding: _resolveBranding,
};
