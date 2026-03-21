export function openProjectTasksDialog({
  projectId,
  loadTasks,
  applyPopupButtonStyle,
  applyPopupCardStyle,
  formatDateToDdMmYyyy,
  formatStatus,
  onClose,
} = {}) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.35)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "1400";
  overlay.tabIndex = -1;

  const card = document.createElement("div");
  applyPopupCardStyle(card);
  card.style.width = "min(900px, calc(100vw - 24px))";
  card.style.maxHeight = "80vh";
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.overflow = "hidden";
  card.style.background = "#fff";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "10px";
  header.style.padding = "12px 16px";
  header.style.borderBottom = "1px solid #e2e8f0";

  const title = document.createElement("div");
  title.textContent = "Projekt-Aufgaben";
  title.style.fontWeight = "800";

  const btnClose = document.createElement("button");
  btnClose.type = "button";
  btnClose.textContent = "X";
  applyPopupButtonStyle(btnClose);
  btnClose.style.marginLeft = "auto";

  const close = () => {
    try {
      if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
    } catch (_e) {
      // ignore
    }
    if (typeof onClose === "function") onClose();
  };

  btnClose.onclick = () => close();
  header.append(title, btnClose);

  const body = document.createElement("div");
  body.style.flex = "1 1 auto";
  body.style.overflow = "auto";
  body.style.padding = "12px 16px";
  body.textContent = "Lade...";

  const renderTasks = (rows) => {
    body.innerHTML = "";
    const list = Array.isArray(rows) ? rows : [];
    title.textContent = `Projekt-Aufgaben (${list.length})`;

    if (!list.length) {
      const empty = document.createElement("div");
      empty.textContent = "Keine Aufgaben vorhanden.";
      empty.style.opacity = "0.75";
      body.appendChild(empty);
      return;
    }

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "8px";

    const mkMeta = (label, value) => {
      const el = document.createElement("div");
      el.textContent = `${label}: ${value}`;
      return el;
    };

    for (const t of list) {
      const item = document.createElement("div");
      item.style.border = "1px solid #e5e7eb";
      item.style.borderRadius = "8px";
      item.style.padding = "8px 10px";
      item.style.display = "grid";
      item.style.gap = "6px";

      const titleEl = document.createElement("div");
      titleEl.textContent = String(t?.title || t?.short_text || t?.shortText || "(ohne Bezeichnung)");
      titleEl.style.fontWeight = "600";

      const meta = document.createElement("div");
      meta.style.display = "flex";
      meta.style.flexWrap = "wrap";
      meta.style.gap = "8px";
      meta.style.fontSize = "12px";
      meta.style.color = "#374151";

      const resp = String(t?.responsible_label || t?.responsibleLabel || "").trim() || "-";
      const dueRaw = t?.due_date ?? t?.dueDate ?? "";
      const due = (formatDateToDdMmYyyy ? formatDateToDdMmYyyy(dueRaw) : "")
        || String(dueRaw || "").trim()
        || "-";
      const statusRaw = String(t?.status || "").trim();
      const status = formatStatus ? formatStatus(statusRaw) : statusRaw;
      const meetingRef = String(t?.meeting_id ?? t?.meetingId ?? "").trim() || "-";

      if (statusRaw && statusRaw.toLowerCase() !== "erledigt") {
        item.style.borderColor = "#b6d4ff";
        item.style.background = "#eef7ff";
      }

      meta.append(mkMeta("Verantw.", resp));
      meta.append(mkMeta("Faellig", due));
      meta.append(mkMeta("Status", status));
      meta.append(mkMeta("Meeting", meetingRef));

      item.append(titleEl, meta);
      wrap.appendChild(item);
    }

    body.appendChild(wrap);
  };

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    close();
  });

  card.append(header, body);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  try {
    overlay.focus();
  } catch (_e) {
    // ignore
  }

  Promise.resolve()
    .then(async () => {
      if (typeof loadTasks !== "function") {
        body.textContent = "Aufgaben konnten nicht geladen werden.";
        return;
      }
      if (!projectId) {
        body.textContent = "Projekt nicht gefunden.";
        return;
      }
      const res = await loadTasks();
      if (!res?.ok) {
        body.textContent = res?.error || "Aufgaben konnten nicht geladen werden.";
        return;
      }
      renderTasks(res.list || []);
    })
    .catch((err) => {
      body.textContent = err?.message || "Aufgaben konnten nicht geladen werden.";
    });

  return { overlay, close };
}
