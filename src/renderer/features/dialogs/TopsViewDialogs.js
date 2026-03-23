import { applyPopupButtonStyle, applyPopupCardStyle } from "../../ui/popupButtonStyles.js";

export class TopsViewDialogs {
  constructor({ view }) {
    this.view = view;
  }

  clearGapPopup() {
    if (this.view._gapPopupOverlay && this.view._gapPopupOverlay.parentElement) {
      this.view._gapPopupOverlay.parentElement.removeChild(this.view._gapPopupOverlay);
    }
    this.view._gapPopupOverlay = null;
  }

  buildGapDetailsText(gap) {
    const lvl = Number(gap?.level || 0);
    const missingNumber = gap?.missingNumber ?? "?";
    const lastNumber = gap?.lastNumber ?? "?";
    const parentTopId = gap?.parentTopId ?? null;

    if (!parentTopId) {
      return [
        `Betroffene Ebene: Level ${lvl}`,
        `Bei Level 1 fehlt Nummer ${missingNumber}.`,
        `Vorschlag: Letzten TOP (Nr. ${lastNumber}) in die Lücke setzen.`,
      ];
    }

    const parent = (this.view.items || []).find((t) => String(t.id) === String(parentTopId));
    const parentNum = parent?.displayNumber ?? parent?.number ?? "";
    const parentTitle = parent?.title ? String(parent.title) : "";
    const parentLabel = parent ? `${parentNum ? `${parentNum}. ` : ""}${parentTitle || "TOP"}` : `TOP ${parentTopId}`;

    return [
      `Betroffene Ebene: Level ${lvl}`,
      `Unter TOP ${parentLabel} fehlt Nummer ${missingNumber}.`,
      `Vorschlag: Letzten TOP (Nr. ${lastNumber}) in die Lücke setzen.`,
    ];
  }

  async showNumberGapPopup({ gap, onConfirm, onCancel }) {
    this.clearGapPopup();

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
    intro.textContent = "Das Protokoll kann erst geschlossen werden, wenn die Nummerierung lückenlos ist.";
    intro.style.marginBottom = "8px";
    content.appendChild(intro);

    const lines = this.buildGapDetailsText(gap);
    for (const line of lines) {
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

    btnCancel.onclick = () => {
      this.clearGapPopup();
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
        this.clearGapPopup();
        if (typeof onCancel === "function") onCancel();
      }
    };
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      this.clearGapPopup();
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

    this.view._gapPopupOverlay = overlay;
  }

  openCreateMeetingModal({ dateISO, keyword = "", editParticipants = true } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,0.35)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "9999";

      const panel = document.createElement("div");
      panel.style.background = "#fff";
      panel.style.borderRadius = "12px";
      panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
      panel.style.width = "min(520px, calc(100vw - 32px))";
      panel.style.padding = "16px";

      const h = document.createElement("div");
      h.textContent = "Neue Besprechung";
      h.style.fontWeight = "700";
      h.style.fontSize = "16px";
      h.style.marginBottom = "12px";
      panel.appendChild(h);

      const row = (labelText, inputEl) => {
        const r = document.createElement("div");
        r.style.display = "flex";
        r.style.flexDirection = "column";
        r.style.gap = "6px";
        r.style.marginBottom = "12px";

        const lab = document.createElement("div");
        lab.textContent = labelText;
        lab.style.fontSize = "12px";
        lab.style.color = "#444";
        r.appendChild(lab);

        r.appendChild(inputEl);
        return r;
      };

      const inpDate = document.createElement("input");
      inpDate.type = "date";
      if (typeof dateISO === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateISO)) inpDate.value = dateISO;
      inpDate.style.padding = "10px 12px";
      inpDate.style.borderRadius = "10px";
      inpDate.style.border = "1px solid rgba(0,0,0,0.2)";
      panel.appendChild(row("Datum der Besprechung", inpDate));

      const inpKw = document.createElement("input");
      inpKw.type = "text";
      inpKw.placeholder = "Schlagwort (optional)";
      inpKw.value = String(keyword || "");
      inpKw.style.padding = "10px 12px";
      inpKw.style.borderRadius = "10px";
      inpKw.style.border = "1px solid rgba(0,0,0,0.2)";
      panel.appendChild(row("Schlagwort", inpKw));

      const chkWrap = document.createElement("label");
      chkWrap.style.display = "flex";
      chkWrap.style.alignItems = "center";
      chkWrap.style.gap = "10px";
      chkWrap.style.margin = "6px 0 14px 0";
      chkWrap.style.userSelect = "none";

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = !!editParticipants;

      const chkText = document.createElement("div");
      chkText.textContent = "Teilnehmer nach dem Anlegen öffnen";
      chkText.style.fontSize = "13px";

      chkWrap.appendChild(chk);
      chkWrap.appendChild(chkText);
      panel.appendChild(chkWrap);

      const btnRow = document.createElement("div");
      btnRow.style.display = "flex";
      btnRow.style.justifyContent = "flex-end";
      btnRow.style.gap = "10px";

      const btnCancel = document.createElement("button");
      btnCancel.textContent = "Abbrechen";
      btnCancel.style.padding = "10px 14px";
      btnCancel.style.borderRadius = "10px";
      btnCancel.style.border = "1px solid rgba(0,0,0,0.2)";
      btnCancel.style.background = "#fff";

      const btnOk = document.createElement("button");
      btnOk.textContent = "Übernehmen";
      btnOk.style.padding = "10px 14px";
      btnOk.style.borderRadius = "10px";
      btnOk.style.border = "1px solid rgba(0,0,0,0.2)";
      btnOk.style.background = "#fff";
      btnOk.style.fontWeight = "700";

      btnRow.appendChild(btnCancel);
      btnRow.appendChild(btnOk);
      panel.appendChild(btnRow);

      const cleanup = (res) => {
        try {
          overlay.remove();
        } catch (e) {
          // ignore
        }
        resolve(res);
      };

      btnCancel.onclick = () => cleanup(null);
      overlay.onclick = (ev) => {
        if (ev.target === overlay) cleanup(null);
      };

      const submit = () => {
        const vDate = String(inpDate.value || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(vDate)) {
          alert("Bitte ein gültiges Datum auswählen.");
          return;
        }
        cleanup({
          dateISO: vDate,
          keyword: String(inpKw.value || "").trim(),
          editParticipants: !!chk.checked,
        });
      };

      btnOk.onclick = submit;
      inpDate.onkeydown = (ev) => {
        if (ev.key === "Enter") submit();
        if (ev.key === "Escape") cleanup(null);
      };
      inpKw.onkeydown = (ev) => {
        if (ev.key === "Enter") submit();
        if (ev.key === "Escape") cleanup(null);
      };
      document.addEventListener("keydown", function escHandler(ev) {
        if (ev.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          cleanup(null);
        }
      });

      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      setTimeout(() => {
        try {
          inpDate.focus();
        } catch (e) {
          // ignore
        }
      }, 0);
    });
  }
}
