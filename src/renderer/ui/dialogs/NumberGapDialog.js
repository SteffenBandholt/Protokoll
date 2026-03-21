export function openNumberGapDialog({
  gap,
  lines,
  applyPopupButtonStyle,
  applyPopupCardStyle,
  onConfirm,
  onCancel,
  onClose,
} = {}) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.35)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "20000";
  overlay.tabIndex = -1;

  const card = document.createElement("div");
  card.style.width = "min(560px, 92vw)";
  card.style.maxHeight = "80vh";
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.background = "#fff";
  card.style.borderRadius = "10px";
  card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
  applyPopupCardStyle(card);

  const header = document.createElement("div");
  header.style.padding = "14px 16px 10px 16px";
  header.style.borderBottom = "1px solid rgba(0,0,0,0.08)";
  header.style.fontWeight = "700";
  header.textContent = "Nummernlücke gefunden";

  const content = document.createElement("div");
  content.style.padding = "12px 16px";
  content.style.overflow = "auto";
  content.style.flex = "1 1 auto";
  content.style.lineHeight = "1.4";

  const intro = document.createElement("div");
  intro.textContent =
    "Das Protokoll kann erst geschlossen werden, wenn die Nummerierung lückenlos ist.";
  intro.style.marginBottom = "8px";
  content.appendChild(intro);

  const safeLines = Array.isArray(lines) ? lines : [];
  for (const line of safeLines) {
    const p = document.createElement("div");
    p.textContent = line;
    p.style.marginBottom = "6px";
    content.appendChild(p);
  }

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.justifyContent = "flex-end";
  footer.style.gap = "8px";
  footer.style.padding = "10px 16px";
  footer.style.borderTop = "1px solid rgba(0,0,0,0.08)";
  footer.style.background = "rgba(255,255,255,0.98)";

  const btnCancel = document.createElement("button");
  btnCancel.textContent = "Abbrechen";
  applyPopupButtonStyle(btnCancel, { variant: "neutral" });

  const btnOk = document.createElement("button");
  btnOk.textContent = "Letzten TOP in Lücke setzen";
  applyPopupButtonStyle(btnOk, { variant: "primary" });
  const canRepair = !!gap?.lastTopId;
  btnOk.disabled = !canRepair;
  btnOk.style.opacity = canRepair ? "1" : "0.55";

  const close = () => {
    try {
      if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
    } catch (_e) {
      // ignore
    }
    if (typeof onClose === "function") onClose();
  };

  btnCancel.onclick = () => {
    close();
    if (typeof onCancel === "function") onCancel();
  };

  btnOk.onclick = async () => {
    if (!gap?.lastTopId) {
      alert("Reparatur nicht möglich: letzter TOP nicht ermittelt");
      return;
    }
    if (typeof onConfirm === "function") await onConfirm();
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      close();
      if (typeof onCancel === "function") onCancel();
    }
  };
  overlay.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    close();
    if (typeof onCancel === "function") onCancel();
  });

  footer.append(btnCancel, btnOk);
  card.append(header, content, footer);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  try {
    overlay.focus();
  } catch (_e) {
    // ignore
  }

  return { overlay, close };
}
