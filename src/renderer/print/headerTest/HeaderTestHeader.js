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
  const header = _el("div", `stdHeader ${variant}${variant === "full" ? " htFullHeader" : ""}`);

  const left = _el("div", "ht-header-left");
  const meetingLine = _el("div", "ht-meeting", _meetingLabel(data?.meeting));
  const projectLine = _el("div", "ht-project", _projectLabel(data?.project));

  left.appendChild(meetingLine);
  const meta = _meetingMeta(data?.meeting);
  if (meta) left.appendChild(_el("div", "ht-meta", meta));
  left.appendChild(projectLine);

  const right = _el("div", "ht-header-right");
  right.appendChild(_el("div", "ht-page", `Seite ${pageNo} / ${totalPages}`));
  right.appendChild(_el("div", "ht-mode", headerTestConfig.modeLabel));

  if (variant === "full") {
    const textBlock = _el("div", "fullHeaderTextBlock");
    const row = _el("div", "fullHeaderRow");
    row.append(left, right);
    textBlock.appendChild(row);
    header.append(
      textBlock,
      _el("div", "htSpaceFullProject"),
      _el("div", "htDivider htFullDivider")
    );
    const line2 = header.querySelector(".htFullDivider");
    if (line2) line2.setAttribute("data-ht", "line2");
    return header;
  }

  const miniHeader = _el("div", "htMiniHeader");
  const miniRow = _el("div", "htMiniTextRow");
  const miniLeft = _el("div", "miniLeft", _meetingLabel(data?.meeting));
  const miniRight = _el(
    "div",
    "miniRight",
    `${_projectLabel(data?.project)} | Seite ${pageNo} / ${totalPages} | ${String(
      headerTestConfig.modeLabel || "KOPF-TEST"
    ).toUpperCase()}`
  );
  miniRow.append(miniLeft, miniRight);
  miniRow.setAttribute("data-ht", "miniText");

  const dividerWrap = _el("div", "htDividerWrap");
  const miniDivider = _el("div", "htDivider htMiniDivider");
  miniDivider.setAttribute("data-ht", "miniLine");
  dividerWrap.appendChild(miniDivider);

  miniHeader.append(
    miniRow,
    _el("div", "htMiniGapTextLine"),
    dividerWrap,
    _el("div", "htMiniGapLineList")
  );
  header.appendChild(miniHeader);
  return header;
}
