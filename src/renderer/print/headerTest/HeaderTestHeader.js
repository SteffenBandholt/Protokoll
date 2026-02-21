import { headerTestConfig } from "./headerTestConfig.js";

function _el(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function _formatDateIso(value) {
  const s = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

function _projectLabel(project) {
  if (!project) return "Projekt: -";
  const nr = String(project.project_number || project.projectNumber || "").trim();
  const name = String(project.name || "").trim();
  if (nr && name) return `Projekt: ${nr} - ${name}`;
  if (nr) return `Projekt: ${nr}`;
  if (name) return `Projekt: ${name}`;
  return "Projekt: -";
}

function _meetingLabel(meeting) {
  if (!meeting) return "Besprechung: -";
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
  const nrPart = nr ? `#${nr}` : "";
  const parts = ["Besprechung", nrPart, date ? `(${date})` : ""]
    .filter((p) => String(p || "").trim())
    .join(" ");
  return parts || "Besprechung: -";
}

function _meetingMeta(meeting) {
  if (!meeting) return "";
  const place = String(meeting.place || meeting.location || "").trim();
  const time = String(meeting.time || meeting.meeting_time || "").trim();
  const extra = String(meeting.extra || meeting.note || "").trim();
  const parts = [place, time, extra].filter((p) => String(p || "").trim());
  return parts.join(" | ");
}

export function renderHeaderTestHeader({ variant = "full", data, pageNo, totalPages } = {}) {
  const cfg = variant === "mini" ? headerTestConfig.mini : headerTestConfig.full;
  const header = _el("div", `ht-header ${variant}`);
  header.style.minHeight = `${cfg.minHeightMm}mm`;

  const left = _el("div", "ht-header-left");
  left.appendChild(_el("div", "ht-project", _projectLabel(data?.project)));
  left.appendChild(_el("div", "ht-meeting", _meetingLabel(data?.meeting)));

  const meta = _meetingMeta(data?.meeting);
  if (meta) left.appendChild(_el("div", "ht-meta", meta));

  const right = _el("div", "ht-header-right");
  right.appendChild(_el("div", "ht-page", `Seite ${pageNo} / ${totalPages}`));
  right.appendChild(_el("div", "ht-mode", headerTestConfig.modeLabel));
  right.appendChild(_el("div", "ht-title", cfg.title));

  header.append(left, right);
  return header;
}
