export function attachTopsViewPrint(TopsViewClass) {
  Object.assign(TopsViewClass.prototype, {
    async _runDirectPrintsAfterClose({ projectId, meetingId, meetingMeta }) {
      // Reihenfolge: Protokoll -> Firmenliste -> ToDo-Liste -> Top-Liste (alle)
      const printResults = {
        protocol: { ok: false, filePath: "" },
        firms: { ok: false, filePath: "" },
        todo: { ok: false, filePath: "" },
        tops: { ok: false, filePath: "" },
      };

      try {
        if (typeof this.router?.printClosedMeetingDirect === "function") {
          const r = await this.router.printClosedMeetingDirect({ projectId, meetingId });
          printResults.protocol.ok = r?.ok !== false;
          printResults.protocol.filePath = r?.filePath || r?.path || "";
        }
      } catch (err) {
        console.warn("[tops] Protokoll-PDF nach Schließen fehlgeschlagen:", err);
        alert("Protokoll-PDF konnte nach dem Schließen nicht erzeugt werden.");
      }

      try {
        if (typeof this.router?.printFirmsDirect === "function") {
          const r = await this.router.printFirmsDirect({ projectId, meetingId });
          printResults.firms.ok = r?.ok !== false;
          printResults.firms.filePath = r?.filePath || r?.path || "";
        }
      } catch (err) {
        console.warn("[tops] Firmenliste-PDF nach Schließen fehlgeschlagen:", err);
        alert("Firmenliste-PDF konnte nach dem Schließen nicht erzeugt werden.");
      }

      try {
        if (typeof this.router?.printTodoDirect === "function") {
          const r = await this.router.printTodoDirect({ projectId, meetingId });
          printResults.todo.ok = r?.ok !== false;
          printResults.todo.filePath = r?.filePath || r?.path || "";
        }
      } catch (err) {
        console.warn("[tops] ToDo-PDF nach Schließen fehlgeschlagen:", err);
        alert("ToDo-PDF konnte nach dem Schließen nicht erzeugt werden.");
      }

      try {
        if (typeof this.router?.printTopListAllDirect === "function") {
          const r = await this.router.printTopListAllDirect({ projectId, meetingId });
          printResults.tops.ok = r?.ok !== false;
          printResults.tops.filePath = r?.filePath || r?.path || "";
        }
      } catch (err) {
        console.warn("[tops] Top-Liste-PDF nach Schließen fehlgeschlagen:", err);
        alert("Top-Liste-PDF konnte nach dem Schließen nicht erzeugt werden.");
      }

      const allPrinted =
        printResults.protocol.ok !== false &&
        printResults.firms.ok !== false &&
        printResults.todo.ok !== false &&
        printResults.tops.ok !== false;

      const lastClosedMeetingForEmail = this._lastClosedMeetingForEmail
        ? this._lastClosedMeetingForEmail
        : meetingMeta
        ? { ...(meetingMeta || {}), id: meetingId }
        : { id: meetingId };

      return { printResults, allPrinted, lastClosedMeetingForEmail };
    },

    async _runAutoPrintModal({ projectId, meetingId }) {
      try {
        const pm =
          typeof this.router?._ensurePrintModal === "function" ? await this.router._ensurePrintModal() : null;

        if (pm && projectId && meetingId) {
          if (typeof pm.printClosedMeetingDirect === "function") {
            await pm.printClosedMeetingDirect({ projectId, meetingId });
          }
          if (typeof pm._printFirmsPdf === "function") {
            await pm._printFirmsPdf({ projectId, meetingId, preview: false });
          }
          if (typeof pm._printTodoPdf === "function") {
            await pm._printTodoPdf({ projectId, meetingId, preview: false });
          }
          if (typeof pm._printTopListAllPdf === "function") {
            await pm._printTopListAllPdf({ projectId, meetingId, preview: false });
          }
        }
      } catch (errPrint) {
        console.error("[TopsView] auto-print after close failed:", errPrint);
      }
    },
  });
}
