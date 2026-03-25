import { MailFlow } from "../mail/MailFlow.js";

export class CloseMeetingOutputFlow {
  constructor({ view, router }) {
    this.view = view;
    this.router = router;
    this.mailFlow = new MailFlow({ view, router });
  }

  async run() {
    if (!(await this.view.audioSuggestionsFlow?.warnAboutManualAssignBeforeClose?.())) return;

    const defDate = this.view._computeNextMeetingDefaultDateIso();
    const promptRes = await this.router?.promptNextMeetingSettings?.({
      defaultDateIso: defDate,
    });
    if (promptRes?.cancelled) return;
    const nextMeetingInput = promptRes?.data || {};

    const closePayload = {
      meetingId: this.view.meetingId,
      pdf_show_ampel: this.view.showAmpelInList ? 1 : 0,
      nextMeeting: {
        enabled: String(nextMeetingInput["print.nextMeeting.enabled"] ?? "").trim(),
        date: String(nextMeetingInput["print.nextMeeting.date"] || "").trim(),
        time: String(nextMeetingInput["print.nextMeeting.time"] || "").trim(),
        place: String(nextMeetingInput["print.nextMeeting.place"] || "").trim(),
        extra: String(nextMeetingInput["print.nextMeeting.extra"] || "").trim(),
      },
    };

    const attemptClose = async () => {
      const projIdForPrint = this.view.projectId || this.router?.currentProjectId || null;
      const meetingIdForPrint = this.view.meetingId;
      try {
        if (typeof window.bbmDb?.topsPurgeTrashedByMeeting === "function") {
          const purgeRes = await window.bbmDb.topsPurgeTrashedByMeeting({
            meetingId: this.view.meetingId,
          });
          if (purgeRes?.ok === false) {
            console.warn("[tops] purgeTrashedByMeeting failed before close:", purgeRes.error);
          }
        }
      } catch (err) {
        console.warn("[tops] purgeTrashedByMeeting error before close:", err);
      }

      const res = await window.bbmDb.meetingsClose(closePayload);
      if (res?.ok) {
        if (Array.isArray(res?.warnings) && res.warnings.length > 0) {
          alert(`Hinweis beim Schlie\u00dfen:\n${res.warnings.join("\n")}`);
        }

        const printResults = {
          protocol: { ok: false, filePath: "" },
          firms: { ok: false, filePath: "" },
          todo: { ok: false, filePath: "" },
          tops: { ok: false, filePath: "" },
        };

        try {
          if (typeof this.router?.printClosedMeetingDirect === "function") {
            const r = await this.router.printClosedMeetingDirect({
              projectId: projIdForPrint,
              meetingId: meetingIdForPrint,
            });
            printResults.protocol.ok = r?.ok !== false;
            printResults.protocol.filePath = r?.filePath || r?.path || "";
          }
        } catch (err) {
          console.warn("[tops] Protokoll-PDF nach Schlie\u00dfen fehlgeschlagen:", err);
          alert("Protokoll-PDF konnte nach dem Schlie\u00dfen nicht erzeugt werden.");
        }

        try {
          if (typeof this.router?.printFirmsDirect === "function") {
            const r = await this.router.printFirmsDirect({
              projectId: projIdForPrint,
              meetingId: meetingIdForPrint,
            });
            printResults.firms.ok = r?.ok !== false;
            printResults.firms.filePath = r?.filePath || r?.path || "";
          }
        } catch (err) {
          console.warn("[tops] Firmenliste-PDF nach Schlie\u00dfen fehlgeschlagen:", err);
          alert("Firmenliste-PDF konnte nach dem Schlie\u00dfen nicht erzeugt werden.");
        }

        try {
          if (typeof this.router?.printTodoDirect === "function") {
            const r = await this.router.printTodoDirect({
              projectId: projIdForPrint,
              meetingId: meetingIdForPrint,
            });
            printResults.todo.ok = r?.ok !== false;
            printResults.todo.filePath = r?.filePath || r?.path || "";
          }
        } catch (err) {
          console.warn("[tops] ToDo-PDF nach Schlie\u00dfen fehlgeschlagen:", err);
          alert("ToDo-PDF konnte nach dem Schlie\u00dfen nicht erzeugt werden.");
        }

        try {
          if (typeof this.router?.printTopListAllDirect === "function") {
            const r = await this.router.printTopListAllDirect({
              projectId: projIdForPrint,
              meetingId: meetingIdForPrint,
            });
            printResults.tops.ok = r?.ok !== false;
            printResults.tops.filePath = r?.filePath || r?.path || "";
          }
        } catch (err) {
          console.warn("[tops] Top-Liste-PDF nach Schlie\u00dfen fehlgeschlagen:", err);
          alert("Top-Liste-PDF konnte nach dem Schlie\u00dfen nicht erzeugt werden.");
        }

        const allPrinted =
          printResults.protocol.ok !== false &&
          printResults.firms.ok !== false &&
          printResults.todo.ok !== false &&
          printResults.tops.ok !== false;

        this.view._lastClosedMeetingForEmail = res?.meeting
          ? { ...res.meeting, id: res.meeting.id || meetingIdForPrint }
          : { ...(this.view.meetingMeta || {}), id: meetingIdForPrint };

        if (allPrinted) {
          await this.mailFlow.maybePromptSendAfterClose({
            printResults,
            meeting: this.view._lastClosedMeetingForEmail,
          });
        } else {
          await this.view._enterIdleAfterClose();
        }
        return;
      }

      if (res?.errorCode === "NUM_GAP") {
        const gap = (res.gaps || [])[0] || null;
        await this.view.dialogs.handleNumberGap({
          gap,
          markTopIds: res.markTopIds || [],
          onResolved: async () => {
            await attemptClose();
          },
        });
        return;
      }

      alert(res?.error || "Schlie\u00dfen fehlgeschlagen");
    };

    await attemptClose();

    await this.view._enterIdleAfterClose();
  }

  _openMailClient() {
    const subject = encodeURIComponent("Baubesprechung");
    const body = encodeURIComponent("Hallo,\n\n");
    const href = `mailto:?subject=${subject}&body=${body}`;
    try {
      window.location.href = href;
    } catch (e) {
      console.warn("[TopsView] mailto failed:", e);
    }
  }

  openMailClient() {
    return this._openMailClient();
  }

  getSelectedClosedMeetingForEmail() {
    if (this.view._lastClosedMeetingForEmail && this.view._lastClosedMeetingForEmail.id) {
      return this.view._lastClosedMeetingForEmail;
    }
    if (this.view.meetingMeta && Number(this.view.meetingMeta.is_closed) === 1) {
      return { ...this.view.meetingMeta, id: this.view.meetingId };
    }
    return null;
  }

  async maybePromptSendAfterClose({ printResults, meeting }) {
    return this.mailFlow.maybePromptSendAfterClose({ printResults, meeting });
  }

  async openSendMailAfterClose({ printResults, meeting }) {
    return this.mailFlow.openSendMailAfterClose({ printResults, meeting });
  }
}
