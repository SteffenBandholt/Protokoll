import { applyPopupButtonStyle, applyPopupCardStyle } from "../../ui/popupButtonStyles.js";

export class MailFlow {
  constructor({ view, router }) {
    this.view = view;
    this.router = router;
  }

  async maybePromptSendAfterClose({ printResults, meeting }) {
    await this.openSendMailAfterClose({ printResults, meeting });
  }

  async openSendMailAfterClose({ printResults, meeting }) {
    const MainHeader = (await import("../../ui/MainHeader.js")).default;
    const headerHelper = new MainHeader({ router: this.router });
    const meetingRef =
      meeting ||
      (typeof this.view.getSelectedClosedMeetingForEmail === "function"
        ? this.view.getSelectedClosedMeetingForEmail()
        : null) || { id: this.view.meetingId };
    const meetingId = meetingRef?.id || this.view.meetingId || null;

    const recOptions = await headerHelper._getMeetingRecipientOptions(meetingId);
    const allRecipients = recOptions.all || [];
    const distRecipients =
      (recOptions.anyDistributionField && recOptions.distribution.length ? recOptions.distribution : allRecipients) ||
      [];
    let selectedRecipients = [...distRecipients];

    const { projectNumber, projectShortName } = await headerHelper._getCurrentProjectMailContext();
    const protocolTitle = await headerHelper._resolveProtocolTitleForEmail(
      this.view.projectId || this.router?.currentProjectId
    );
    const emailTemplate = await headerHelper._getStoredEmailTemplate();
    const templateContext = headerHelper._buildEmailTemplateContext({
      projectNumber,
      projectShortName,
      protocolTitle,
      meeting: meetingRef,
    });
    const baseSubject =
      headerHelper._applyEmailSubjectTemplate(emailTemplate.subject || "", templateContext) ||
      headerHelper._buildFallbackEmailSubject({ projectNumber, projectShortName, mailType: "" }) ||
      headerHelper._defaultMeetingEmailSubject(templateContext);
    const baseBody =
      (emailTemplate.body || "").trim() ||
      "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie das neue Protokoll f\u00fcr das oben genannte Projekt mit der Bitte um Beachtung und Veranlassung.";

    const attachments = [
      { key: "protocol", label: "Protokoll", path: printResults?.protocol?.filePath || "" },
      { key: "firms", label: "Firmenliste", path: printResults?.firms?.filePath || "" },
      { key: "todo", label: "ToDo-Liste", path: printResults?.todo?.filePath || "" },
      { key: "tops", label: "Top-Liste", path: printResults?.tops?.filePath || "" },
    ];

    if (!attachments[0].path) {
      try {
        const lookup = await headerHelper._buildProtocolPdfLookupPayload(
          meetingRef,
          this.view.projectId || this.router?.currentProjectId
        );
        if (lookup && window.bbmPrint?.findStoredProtocolPdf) {
          const found = await window.bbmPrint.findStoredProtocolPdf(lookup);
          if (found?.ok && found?.filePath) attachments[0].path = String(found.filePath || "");
        }
      } catch (_e) {
        // ignore
      }
    }

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.45)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "13000";
    overlay.tabIndex = -1;

    const card = document.createElement("div");
    applyPopupCardStyle(card);
    card.style.width = "min(720px, 94vw)";
    card.style.maxHeight = "90vh";
    card.style.display = "grid";
    card.style.gridTemplateRows = "auto 1fr auto";
    card.style.rowGap = "14px";
    card.style.padding = "16px";

    const title = document.createElement("div");
    title.textContent = "Protokoll versenden";
    title.style.fontWeight = "700";
    title.style.fontSize = "16px";

    const content = document.createElement("div");
    content.style.display = "grid";
    content.style.gridTemplateColumns = "1fr 1fr";
    content.style.gap = "14px";
    content.style.overflow = "auto";

    const recWrap = document.createElement("div");
    recWrap.style.display = "flex";
    recWrap.style.flexDirection = "column";
    recWrap.style.gap = "8px";

    const recTitle = document.createElement("div");
    recTitle.textContent = "Empf\u00e4nger";
    recTitle.style.fontWeight = "700";

    const recActions = document.createElement("div");
    recActions.style.display = "flex";
    recActions.style.flexWrap = "wrap";
    recActions.style.gap = "6px";

    const mkRecAction = (label, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      applyPopupButtonStyle(btn, { variant: "neutral" });
      btn.style.padding = "4px 8px";
      btn.onclick = handler;
      return btn;
    };

    const applyRecipientSelection = (list) => {
      selectedRecipients = [...list];
      Array.from(recList.querySelectorAll("input[type=checkbox]")).forEach((cb) => {
        cb.checked = selectedRecipients.includes(cb.value);
      });
    };

    recActions.append(
      mkRecAction("Alle", () => applyRecipientSelection(allRecipients)),
      mkRecAction("Keine", () => applyRecipientSelection([]))
    );

    const recList = document.createElement("div");
    recList.style.display = "flex";
    recList.style.flexDirection = "column";
    recList.style.gap = "4px";
    recList.style.maxHeight = "220px";
    recList.style.overflow = "auto";

    const mkRecRow = (email) => {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = email;
      cb.checked = selectedRecipients.includes(email);
      cb.onchange = () => {
        if (cb.checked) {
          if (!selectedRecipients.includes(email)) selectedRecipients.push(email);
        } else {
          selectedRecipients = selectedRecipients.filter((x) => x !== email);
        }
      };
      const text = document.createElement("span");
      text.textContent = email;
      row.append(cb, text);
      return row;
    };

    const uniqueAll = Array.from(new Set(allRecipients));
    if (uniqueAll.length) {
      uniqueAll.forEach((mail) => recList.appendChild(mkRecRow(mail)));
    } else {
      const hint = document.createElement("div");
      hint.textContent = "Keine Empf\u00e4nger gefunden.";
      hint.style.opacity = "0.7";
      recList.appendChild(hint);
    }

    recWrap.append(recTitle, recActions, recList);

    const attWrap = document.createElement("div");
    attWrap.style.display = "flex";
    attWrap.style.flexDirection = "column";
    attWrap.style.gap = "8px";

    const attTitle = document.createElement("div");
    attTitle.textContent = "Anh\u00e4nge";
    attTitle.style.fontWeight = "700";

    const attList = document.createElement("div");
    attList.style.display = "flex";
    attList.style.flexDirection = "column";
    attList.style.gap = "6px";

    attachments.forEach((att) => {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.onchange = () => {
        att.selected = cb.checked;
      };
      att.selected = true;
      const text = document.createElement("span");
      text.textContent = att.label + (att.path ? "" : " (Pfad fehlt)");
      row.append(cb, text);
      attList.appendChild(row);
    });

    attWrap.append(attTitle, attList);

    const subjectLabel = document.createElement("div");
    subjectLabel.textContent = "Betreff";
    subjectLabel.style.fontWeight = "700";
    subjectLabel.style.gridColumn = "1 / -1";

    const subjectInput = document.createElement("input");
    subjectInput.type = "text";
    subjectInput.value = baseSubject;
    subjectInput.style.width = "100%";
    subjectInput.style.maxWidth = "100%";
    subjectInput.style.boxSizing = "border-box";
    subjectInput.style.padding = "8px";
    subjectInput.style.gridColumn = "1 / -1";

    const bodyLabel = document.createElement("div");
    bodyLabel.textContent = "Mailtext";
    bodyLabel.style.fontWeight = "700";
    bodyLabel.style.gridColumn = "1 / -1";

    const bodyInput = document.createElement("textarea");
    bodyInput.value = baseBody;
    bodyInput.style.width = "100%";
    bodyInput.style.maxWidth = "100%";
    bodyInput.style.boxSizing = "border-box";
    bodyInput.style.minHeight = "180px";
    bodyInput.style.padding = "8px";
    bodyInput.style.gridColumn = "1 / -1";

    content.append(recWrap, attWrap);
    content.append(subjectLabel, subjectInput, bodyLabel, bodyInput);
    content.style.gridTemplateColumns = "1fr 1fr";
    content.style.gridTemplateRows = "auto auto auto auto";
    content.style.gridAutoFlow = "row";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "10px";

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = "Abbrechen";
    applyPopupButtonStyle(btnCancel, { variant: "neutral" });

    const btnSend = document.createElement("button");
    btnSend.type = "button";
    btnSend.textContent = "Mit Outlook / Mailprogramm \u00f6ffnen";
    applyPopupButtonStyle(btnSend, { variant: "primary" });

    const closeOverlay = () => {
      try {
        overlay.remove();
      } catch (_e) {
        // ignore
      }
    };

    const collectAttachments = () => attachments.filter((a) => a.selected && a.path).map((a) => a.path);

    btnSend.onclick = async () => {
      btnSend.disabled = true;
      try {
        await headerHelper._openMailClient("", {
          recipients: selectedRecipients,
          subject: subjectInput.value,
          body: bodyInput.value,
          attachments: collectAttachments(),
          meeting: meetingRef,
        });
      } catch (err) {
        console.error("[tops] send mail failed:", err);
      } finally {
        closeOverlay();
        await this.view._enterIdleAfterClose();
      }
    };

    btnCancel.onclick = async () => {
      closeOverlay();
      await this.view._enterIdleAfterClose();
    };

    actions.append(btnCancel, btnSend);

    card.append(title, content, actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    try {
      overlay.focus();
    } catch (_e) {
      // ignore
    }
  }
}
