export class ProtocolTitleService {
  constructor({ formatDate } = {}) {
    this.formatDate = typeof formatDate === "function" ? formatDate : () => "";
  }

  buildTitleModel({ meetingId, meetingMeta, isReadOnly, idleHasProtocols }) {
    if (!meetingId) {
      return {
        label: "Protokoll",
        lines: [
          {
            text: idleHasProtocols ? "kein Protokoll aktiv" : "kein Protokoll vorhanden",
            color: "#616161",
            fontWeight: "700",
          },
        ],
        title: "",
        cursor: "default",
      };
    }

    const isClosedMeeting = Number(meetingMeta?.is_closed) === 1 || !!isReadOnly;
    const parts = this.parseMeetingTitleParts(meetingMeta);
    const firstLineBase =
      parts.meetingIndex && parts.meetingDateText
        ? `${parts.meetingIndex} - ${parts.meetingDateText}`
        : parts.meetingIndex || parts.meetingDateText || "";
    const firstLineSafe = firstLineBase || "Protokoll";
    const accentColor = isClosedMeeting ? "#b71c1c" : "#1b5e20";
    const firstLineText = isClosedMeeting ? `${firstLineSafe} (geschlossen) read only`.trim() : firstLineSafe;

    const lines = [
      {
        text: firstLineText,
        color: accentColor,
        fontWeight: "700",
      },
    ];

    if (parts.meetingKeyword) {
      lines.push({
        text: parts.meetingKeyword,
        color: accentColor,
        fontWeight: "700",
      });
    }

    return {
      label: "Protokoll",
      lines,
      title: [firstLineText, parts.meetingKeyword].filter(Boolean).join(" | "),
      cursor: "pointer",
    };
  }

  parseMeetingTitleParts(meetingMeta) {
    const meetingIndexRaw = Number(meetingMeta?.meeting_index);
    const hasMeetingIndex = Number.isFinite(meetingIndexRaw) && meetingIndexRaw > 0;
    const meetingIndexInt = hasMeetingIndex ? Math.trunc(meetingIndexRaw) : 0;
    const meetingIndex = hasMeetingIndex ? `#${meetingIndexInt}` : "";
    let meetingTitle = String(meetingMeta?.title || "").trim();

    if (hasMeetingIndex) {
      const leadingIndexPattern = new RegExp(`^#\\s*${meetingIndexInt}(?:\\s*[-–—:]\\s*|\\s+)`, "i");
      if (leadingIndexPattern.test(meetingTitle)) {
        meetingTitle = meetingTitle.replace(leadingIndexPattern, "").trim();
      } else if (new RegExp(`^#\\s*${meetingIndexInt}$`, "i").test(meetingTitle)) {
        meetingTitle = "";
      }
    }

    const titleNormalized = meetingTitle.replace(/^#\d+\s*(?:-\s*)?/i, "").trim();
    let meetingDateText = "";
    let meetingKeyword = "";

    if (titleNormalized) {
      const directDate = titleNormalized.match(/^(\d{2}\.\d{2}\.\d{4})(?:\s*-\s*(.*))?$/);
      if (directDate) {
        meetingDateText = directDate[1];
        meetingKeyword = String(directDate[2] || "").trim();
      } else {
        const dateInText = titleNormalized.match(/(\d{2}\.\d{2}\.\d{4})/);
        if (dateInText) {
          meetingDateText = dateInText[1];
          const index = titleNormalized.indexOf(dateInText[1]);
          const after = titleNormalized.slice(index + dateInText[1].length).replace(/^\s*-\s*/, "").trim();
          meetingKeyword = after;
        } else {
          meetingKeyword = titleNormalized;
        }
      }
    }

    if (!meetingDateText) {
      const meta = meetingMeta || {};
      meetingDateText = this.formatDate(
        meta.meeting_date || meta.meetingDate || meta.date || meta.created_at || meta.createdAt || meta.updated_at || meta.updatedAt || ""
      );
    }

    if (meetingKeyword) {
      meetingKeyword = meetingKeyword.replace(/^#\d+\s*(?:-\s*)?/i, "").trim();
    }

    return {
      meetingIndex,
      meetingDateText: String(meetingDateText || "").trim(),
      meetingKeyword: String(meetingKeyword || "").trim(),
    };
  }
}
