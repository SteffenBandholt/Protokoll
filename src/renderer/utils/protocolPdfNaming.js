function cleanPart(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateDot(value) {
  const raw = String(value || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}.${m}.${y}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function buildProtocolPdfFileName({
  projectNumber = "",
  projectShortName = "",
  protocolTitle = "",
  meetingIndex = "",
  meetingDate = "",
} = {}) {
  const projectNumberClean = cleanPart(projectNumber);
  const projectShortClean = cleanPart(projectShortName);
  const protocolTitleClean = cleanPart(protocolTitle || "Protokoll");
  const meetingIndexClean = cleanPart(meetingIndex);
  const meetingDateDot = formatDateDot(meetingDate);

  if (!projectNumberClean || !protocolTitleClean || !meetingIndexClean || !meetingDateDot) {
    return "";
  }

  return projectShortClean
    ? `${projectNumberClean}_${projectShortClean}_${protocolTitleClean}_#${meetingIndexClean} - ${meetingDateDot}.pdf`
    : `${projectNumberClean}_${protocolTitleClean}_#${meetingIndexClean} - ${meetingDateDot}.pdf`;
}

export function buildProtocolPdfFileInfo({
  baseDir = "",
  project = null,
  settings = null,
  meeting = null,
} = {}) {
  const projectNumber = cleanPart(
    project?.project_number ?? project?.projectNumber ?? project?.number ?? ""
  );
  const projectShortName = cleanPart(project?.short ?? project?.short_name ?? project?.name ?? "");
  const projectName = cleanPart(project?.name ?? project?.project_name ?? projectShortName);
  const protocolTitle = cleanPart(settings?.["pdf.protocolTitle"] || "Protokoll");
  const meetingIndex = cleanPart(
    meeting?.meeting_index ?? meeting?.meetingIndex ?? meeting?.index ?? meeting?.number ?? ""
  );
  const meetingDate =
    meeting?.meeting_date ??
    meeting?.meetingDate ??
    meeting?.date ??
    meeting?.created_at ??
    meeting?.createdAt ??
    "";

  const fileName = buildProtocolPdfFileName({
    projectNumber,
    projectShortName,
    protocolTitle,
    meetingIndex,
    meetingDate,
  });
  if (!fileName) return null;

  const projectFolderName = projectNumber && projectName
    ? `${projectNumber} - ${projectName}`
    : (projectName || projectNumber);

  const normalizedBase = String(baseDir || "").replace(/[\\/]+$/g, "");
  const filePath = normalizedBase
    ? `${normalizedBase}/bbm/${projectFolderName}/Protokolle/${fileName}`
    : "";

  return {
    fileName,
    filePath,
    projectNumber,
    projectShortName,
    protocolTitle,
    meetingIndex,
  };
}
