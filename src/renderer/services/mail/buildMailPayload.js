import { MailPayload } from "./MailPayload.js";

export function buildMailPayload({
  to = [],
  cc = [],
  bcc = [],
  subject = "",
  body = "",
  attachments = [],
  projectId = null,
  meetingId = null,
  projectNumber = "",
  projectShortName = "",
  protocolTitle = "",
  meetingIndex = "",
  meetingDate = "",
} = {}) {
  const payload = new MailPayload();

  payload.to = Array.isArray(to) ? to.filter(Boolean) : [];
  payload.cc = Array.isArray(cc) ? cc.filter(Boolean) : [];
  payload.bcc = Array.isArray(bcc) ? bcc.filter(Boolean) : [];
  payload.subject = String(subject || "").trim();
  payload.body = String(body || "");
  payload.attachments = Array.isArray(attachments) ? attachments.filter(Boolean) : [];

  payload.projectId = projectId || null;
  payload.meetingId = meetingId || null;

  payload.projectNumber = String(projectNumber || "").trim();
  payload.projectShortName = String(projectShortName || "").trim();
  payload.protocolTitle = String(protocolTitle || "").trim();
  payload.meetingIndex = String(meetingIndex || "").trim();
  payload.meetingDate = String(meetingDate || "").trim();

  return payload;
}
