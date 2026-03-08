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

export function findProtocolPdf({ meeting, project, settings } = {}) {
  const baseDir = String(settings?.["pdf.protocolsDir"] || "").trim();
  if (!baseDir || !meeting || !project) return null;

  const projectNumber = cleanPart(
    project?.project_number ?? project?.projectNumber ?? project?.number ?? ""
  );
  const projectShort = cleanPart(project?.short ?? project?.short_name ?? project?.name ?? "");
  const projectName = cleanPart(project?.name ?? project?.project_name ?? projectShort);
  const protocolTitle = cleanPart(settings?.["pdf.protocolTitle"] || "Protokoll");
  const meetingIndex = cleanPart(
    meeting?.meeting_index ?? meeting?.meetingIndex ?? meeting?.index ?? meeting?.number ?? ""
  );
  const meetingDateDot = formatDateDot(
    meeting?.meeting_date ??
      meeting?.meetingDate ??
      meeting?.date ??
      meeting?.created_at ??
      meeting?.createdAt ??
      ""
  );

  if (!projectNumber || !protocolTitle || !meetingIndex || !meetingDateDot) return null;

  const fileName = projectShort
    ? `${projectNumber}_${projectShort}_${protocolTitle}_#${meetingIndex} - ${meetingDateDot}.pdf`
    : `${projectNumber}_${protocolTitle}_#${meetingIndex} - ${meetingDateDot}.pdf`;

  const projectFolderName = projectNumber && projectName
    ? `${projectNumber} - ${projectName}`
    : (projectName || projectNumber);

  const normalizedBase = baseDir.replace(/[\\/]+$/g, "");
  const filePath = `${normalizedBase}/bbm/${projectFolderName}/Protokolle/${fileName}`;

  return {
    fileName,
    filePath,
  };
}
