export function sendMailPayload(payload) {
  const to = Array.isArray(payload?.to) ? payload.to.filter(Boolean) : [];
  const cc = Array.isArray(payload?.cc) ? payload.cc.filter(Boolean) : [];
  const bcc = Array.isArray(payload?.bcc) ? payload.bcc.filter(Boolean) : [];
  const subject = String(payload?.subject || "").trim();

  let body = String(payload?.body || "");
  const attachments = Array.isArray(payload?.attachments) ? payload.attachments.filter(Boolean) : [];

  if (attachments.length) {
    const hint =
      "\n\n---\n" +
      "Anhaenge fuer den Versand:\n" +
      attachments.join("\n");
    if (
      !body.includes("PDF-Datei f\u00fcr den Versand:") &&
      !body.includes("Anhaenge fuer den Versand:")
    ) {
      body += hint;
    }
  }

  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  if (cc.length) params.push(`cc=${encodeURIComponent(cc.join(","))}`);
  if (bcc.length) params.push(`bcc=${encodeURIComponent(bcc.join(","))}`);

  const toPart = to.length ? to.join(",") : "";
  const query = params.length ? `?${params.join("&")}` : "";
  const mailto = `mailto:${encodeURIComponent(toPart)}${query}`;

  window.location.href = mailto;
}
