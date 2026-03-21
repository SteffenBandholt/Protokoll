import { applyPopupButtonStyle, applyPopupCardStyle } from "../ui/popupButtonStyles.js";
import { openNumberGapDialog } from "../ui/dialogs/NumberGapDialog.js";

export function attachTopsViewMeetingWorkflow(TopsViewClass) {
  Object.assign(TopsViewClass.prototype, {
    _writeCreateMeetingEditParticipants(val) {
      // Merker (optional) – aktuell nur für den Create-Flow relevant.
      this._createMeetingEditParticipants = !!val;
    },

    _openCreateMeetingModal({ dateISO, keyword = "", editParticipants = true } = {}) {
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
          r.style.display = "grid";
          r.style.gridTemplateColumns = "96px 1fr";
          r.style.gap = "6px 10px";
          r.style.alignItems = "center";
          r.style.marginBottom = "10px";
          const label = document.createElement("div");
          label.textContent = labelText;
          label.style.fontWeight = "600";
          label.style.fontSize = "13px";
          r.appendChild(label);
          inputEl.style.width = "100%";
          inputEl.style.boxSizing = "border-box";
          inputEl.style.padding = "8px 10px";
          inputEl.style.borderRadius = "8px";
          inputEl.style.border = "1px solid #ddd";
          r.appendChild(inputEl);
          return r;
        };

        const now = new Date();
        const defaultDate = dateISO || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
          now.getDate()
        ).padStart(2, "0")}`;
        const inpDate = document.createElement("input");
        inpDate.type = "date";
        inpDate.value = defaultDate;
        panel.appendChild(row("Datum", inpDate));

        const inpKw = document.createElement("input");
        inpKw.type = "text";
        inpKw.value = keyword || "";
        inpKw.placeholder = "optional";
        panel.appendChild(row("Schlagwort", inpKw));

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = !!editParticipants;
        chk.id = "editPart";
        const chkLabel = document.createElement("label");
        chkLabel.htmlFor = "editPart";
        chkLabel.textContent = "Teilnehmer nach dem Anlegen bearbeiten";
        chkLabel.style.display = "flex";
        chkLabel.style.alignItems = "center";
        chkLabel.style.gap = "8px";
        chkLabel.style.fontSize = "13px";
        chkLabel.style.padding = "4px 0 10px";
        chkLabel.insertBefore(chk, chkLabel.firstChild);
        panel.appendChild(chkLabel);

        const btnRow = document.createElement("div");
        btnRow.style.display = "flex";
        btnRow.style.justifyContent = "flex-end";
        btnRow.style.gap = "10px";
        btnRow.style.marginTop = "12px";

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
          } catch (e) {}
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

        // Fokus
        setTimeout(() => {
          try {
            inpDate.focus();
          } catch (e) {}
        }, 0);
      });
    },

    async _createMeetingFromIdle() {
      const api = window.bbmDb || {};
      if (typeof api.meetingsCreate !== "function") {
        alert("meetingsCreate ist nicht verfügbar (Preload/IPC fehlt).");
        return;
      }

      const pid = this.projectId;
      if (!pid) {
        alert("Kein Projekt ausgewählt.");
        return;
      }

      // Zwischendialog: Datum wählen + entscheiden, ob Teilnehmer-Popup geöffnet werden soll.
      // (Datum wird NICHT automatisch übernommen, sondern muss bestätigt werden.)
      let dateISO = this._todayISO(); // Vorschlag (User kann ändern)
      let keyword = "";
      let editParticipants = true;

      const modalRes = await this._openCreateMeetingModal({ dateISO, keyword, editParticipants });
      if (!modalRes) return;

      const pickedISO = String(modalRes.dateISO || "").trim();
      if (/^\\d{4}-\\d{2}-\\d{2}$/.test(pickedISO)) dateISO = pickedISO;
      keyword = String(modalRes.keyword || "").trim();
      editParticipants = modalRes.editParticipants !== false;
      this._writeCreateMeetingEditParticipants(editParticipants);

      // nextIndex ermitteln
      let nextIndex = 1;
      if (typeof api.meetingsListByProject === "function") {
        try {
          const res = await api.meetingsListByProject(pid);
          if (res && res.ok) {
            const list = Array.isArray(res.list) ? res.list : [];
            const maxIdx = list.reduce((mx, x) => Math.max(mx, Number(x.meeting_index || 0)), 0);
            nextIndex = (maxIdx || 0) + 1;
          }
        } catch (e) {
          // ignore
        }
      }

      const dd = this._isoToDDMMYYYY(dateISO);
      const idx = `#${nextIndex}`;
      const title = keyword ? `${idx} ${dd} - ${keyword}` : `${idx} ${dd}`;

      const createRes = await api.meetingsCreate({ projectId: pid, title });
      if (!createRes || !createRes.ok) {
        const msg = createRes && createRes.error ? createRes.error : "Besprechung anlegen fehlgeschlagen";
        console.error("[TopsView] meetingsCreate failed", { pid, dateISO, keyword, title, error: msg });
        alert("Besprechung konnte nicht angelegt werden.");
        return;
      }

      const mid = createRes && createRes.meeting ? createRes.meeting.id : null;
      if (!mid) {
        alert("Besprechung angelegt, aber keine ID erhalten.");
        return;
      }

      // Tops öffnen
      this.router.currentProjectId = pid;
      this.router.currentMeetingId = mid;
      await this.router.showTops(mid, pid);

      // optional Teilnehmer bearbeiten
      if (editParticipants && this.router && typeof this.router.openParticipantsModal === "function") {
        try {
          await this.router.openParticipantsModal({ projectId: pid, meetingId: mid });
        } catch (e) {
          console.warn("[TopsView] openParticipantsModal failed:", e);
        }
      }
    },

    async _enterIdleAfterClose() {
      // Nach dem fachlichen Beenden des Protokolls im TopsView bleiben und Idle anzeigen.
      this._closeAudioPanelIfOpen();
      this.meetingId = null;
      this.meetingMeta = null;
      this.selectedTopId = null;
      this.selectedTop = null;
      this.isReadOnly = false;

      await this._refreshIdleProtocolPresence();
      this._renderIdleState();
    },

    async _findOpenMeetingIdForProject() {
      const pid = this.projectId || this.router?.currentProjectId || null;
      const api = window.bbmDb || {};
      if (!pid || typeof api.meetingsListByProject !== "function") return null;

      try {
        const res = await api.meetingsListByProject(pid);
        if (!res?.ok) return null;
        const list = Array.isArray(res.list) ? res.list : [];
        const openMeeting = list.find((m) => Number(m?.is_closed) === 0);
        return openMeeting?.id || null;
      } catch (err) {
        console.warn("[TopsView] _findOpenMeetingIdForProject failed:", err);
        return null;
      }
    },

    async _closeViewOnly() {
      const pid = this.projectId || this.router?.currentProjectId || null;
      const isClosedMeeting = Number(this.meetingMeta?.is_closed) === 1 || !!this.isReadOnly;

      if (isClosedMeeting) {
        const openMeetingId = await this._findOpenMeetingIdForProject();
        if (openMeetingId) {
          await this.router?.showTops?.(openMeetingId, pid);
          return;
        }
      }

      await this.router?.showProjects?.();
    },

    _clearGapPopup() {
      if (this._gapPopupClose) {
        const close = this._gapPopupClose;
        this._gapPopupClose = null;
        close();
        return;
      }
      if (this._gapPopupOverlay && this._gapPopupOverlay.parentElement) {
        this._gapPopupOverlay.parentElement.removeChild(this._gapPopupOverlay);
      }
      this._gapPopupOverlay = null;
    },

    _setMarkedTopIds(ids) {
      this._markTopIds = new Set((ids || []).map((x) => Number(x)).filter((x) => Number.isFinite(x)));
      if (this.listEl) this._renderListOnly();
    },

    _clearMarkedTopIds() {
      this._markTopIds = new Set();
      if (this.listEl) this._renderListOnly();
    },

    _buildGapDetailsText(gap) {
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

      const parent = (this.items || []).find((t) => String(t.id) === String(parentTopId));
      const parentNum = parent?.displayNumber ?? parent?.number ?? "";
      const parentTitle = parent?.title ? String(parent.title) : "";
      const parentLabel = parent ? `${parentNum ? `${parentNum}. ` : ""}${parentTitle || "TOP"}` : `TOP ${parentTopId}`;

      return [
        `Betroffene Ebene: Level ${lvl}`,
        `Unter TOP ${parentLabel} fehlt Nummer ${missingNumber}.`,
        `Vorschlag: Letzten TOP (Nr. ${lastNumber}) in die Lücke setzen.`,
      ];
    },

    async _showNumberGapPopup({ gap, onConfirm, onCancel }) {
      this._clearGapPopup();
      const { overlay, close } = openNumberGapDialog({
        gap,
        lines: this._buildGapDetailsText(gap),
        applyPopupButtonStyle,
        applyPopupCardStyle,
        onConfirm,
        onCancel,
        onClose: () => {
          this._gapPopupOverlay = null;
          this._gapPopupClose = null;
        },
      });
      this._gapPopupOverlay = overlay;
      this._gapPopupClose = close;
    },

    async _handleClickEndMeeting() {
      if (!(await this._warnAboutManualAssignBeforeClose())) return;

      const defDate = this._computeNextMeetingDefaultDateIso();
      const promptRes = await this.router?.promptNextMeetingSettings?.({
        defaultDateIso: defDate,
      });
      if (promptRes?.cancelled) return;
      const nextMeetingInput = promptRes?.data || {};

      const closePayload = {
        meetingId: this.meetingId,
        pdf_show_ampel: this.showAmpelInList ? 1 : 0,
        nextMeeting: {
          enabled: String(nextMeetingInput["print.nextMeeting.enabled"] ?? "").trim(),
          date: String(nextMeetingInput["print.nextMeeting.date"] || "").trim(),
          time: String(nextMeetingInput["print.nextMeeting.time"] || "").trim(),
          place: String(nextMeetingInput["print.nextMeeting.place"] || "").trim(),
          extra: String(nextMeetingInput["print.nextMeeting.extra"] || "").trim(),
        },
      };

      const attemptClose = async () => {
        const projIdForPrint = this.projectId || this.router?.currentProjectId || null;
        const meetingIdForPrint = this.meetingId;
        try {
          if (typeof window.bbmDb?.topsPurgeTrashedByMeeting === "function") {
            const purgeRes = await window.bbmDb.topsPurgeTrashedByMeeting({
              meetingId: this.meetingId,
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
            alert(`Hinweis beim Schließen:\n${res.warnings.join("\n")}`);
          }

          // Reihenfolge: Protokoll -> Firmenliste -> ToDo-Liste (alles Datei-Druck, keine Vorschau)
          const { printResults, allPrinted, lastClosedMeetingForEmail } =
            await this._runDirectPrintsAfterClose({
              projectId: projIdForPrint,
              meetingId: meetingIdForPrint,
              meetingMeta: this.meetingMeta,
            });

          this._lastClosedMeetingForEmail = res?.meeting
            ? { ...res.meeting, id: res.meeting.id || meetingIdForPrint }
            : lastClosedMeetingForEmail;

          if (allPrinted) {
            await this._maybePromptSendAfterClose({ printResults, meeting: this._lastClosedMeetingForEmail });
          } else {
            await this._enterIdleAfterClose();
          }
          return;
        }

        if (res?.errorCode === "NUM_GAP") {
          const gap = (res.gaps || [])[0] || null;
          this._setMarkedTopIds(res.markTopIds || []);
          await this._showNumberGapPopup({
            gap,
            onCancel: () => {
              this._clearMarkedTopIds();
            },
            onConfirm: async () => {
              const fixRes = await window.bbmDb.meetingTopsFixNumberGap({
                meetingId: this.meetingId,
                level: gap?.level,
                parentTopId: gap?.parentTopId ?? null,
                fromTopId: gap?.lastTopId,
                toNumber: gap?.missingNumber,
              });

              if (!fixRes?.ok) {
                alert(fixRes?.error || fixRes?.errorCode || "Reparatur fehlgeschlagen");
                return;
              }

              this._clearGapPopup();
              this._clearMarkedTopIds();
              await this.reloadList(true);
              await attemptClose();
            },
          });
          return;
        }

        alert(res?.error || "Schließen fehlgeschlagen");
      };

      await attemptClose();

      // Nach erfolgreichem Schließen: automatische Druckläufe (Protokoll, Firmenliste, ToDo-Liste, Top-Liste)
      await this._runAutoPrintModal({
        projectId: this.projectId || this.router?.currentProjectId || null,
        meetingId: this.meetingId || this.router?.currentMeetingId || null,
      });

      await this._enterIdleAfterClose();
    },
  });
}
