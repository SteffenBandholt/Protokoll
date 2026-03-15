const NEW_POINT_PATTERN =
  /\b(?:neuer punkt|au[sß]erdem|zus[aä]tzlich|noch ein thema|weiterer punkt)\b/i;

class MeetingMappingService {
  constructor({
    meetingsRepo,
    audioImportsRepo,
    transcriptsRepo,
    audioSuggestionsRepo,
    segmentationService,
    meetingTopsRepo,
  }) {
    if (!meetingsRepo) throw new Error("MeetingMappingService: meetingsRepo required");
    if (!audioImportsRepo) throw new Error("MeetingMappingService: audioImportsRepo required");
    if (!transcriptsRepo) throw new Error("MeetingMappingService: transcriptsRepo required");
    if (!audioSuggestionsRepo) throw new Error("MeetingMappingService: audioSuggestionsRepo required");
    if (!segmentationService) {
      throw new Error("MeetingMappingService: segmentationService required");
    }
    if (!meetingTopsRepo) {
      throw new Error("MeetingMappingService: meetingTopsRepo required");
    }

    this.meetingsRepo = meetingsRepo;
    this.audioImportsRepo = audioImportsRepo;
    this.transcriptsRepo = transcriptsRepo;
    this.audioSuggestionsRepo = audioSuggestionsRepo;
    this.segmentationService = segmentationService;
    this.meetingTopsRepo = meetingTopsRepo;
  }

  _normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("de-DE")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^\p{L}\p{N}\s./-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  _safeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  _uniqueTerms(values) {
    return Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .map((value) => this._normalize(value))
          .filter((value) => value && value.length >= 2)
      )
    );
  }

  _topLabel(cardEntry) {
    if (!cardEntry) return "";
    const number = this._safeText(cardEntry.number);
    const title = this._safeText(cardEntry.title);
    if (number && title) return `${number} ${title}`;
    return title || number || String(cardEntry.topId || "").trim();
  }

  _getMeetingOrThrow(meetingId) {
    const meeting = this.meetingsRepo.getMeetingById(meetingId);
    if (!meeting) throw new Error("Besprechung nicht gefunden");
    if (Number(meeting.is_closed) === 1) {
      throw new Error("Besprechung ist geschlossen - Analyse nicht erlaubt");
    }
    return meeting;
  }

  _createDemoAudioImport(meeting, demoType) {
    return this.audioImportsRepo.createImport({
      meetingId: meeting.id,
      projectId: meeting.project_id,
      filePath: `demo://${demoType}`,
      originalFileName: `demo-${demoType}.txt`,
      mimeType: "text/plain",
      processingMode: "review",
      status: "analyzed",
    });
  }

  _pickAppendTarget(meetingId) {
    const rows = this.meetingTopsRepo.listJoinedByMeeting(meetingId) || [];
    const filtered = rows.filter((row) => {
      return (
        Number(row?.is_hidden || 0) !== 1 &&
        this._normalize(row?.title) !== "manuell zuordnen"
      );
    });

    const preferred = filtered.find((row) => this._safeText(row?.longtext)) || filtered[0] || null;
    if (!preferred?.id) {
      throw new Error("Kein bestehender TOP für append_to_top gefunden");
    }
    return preferred;
  }

  _pickParentTarget(meetingId) {
    const rows = this.meetingTopsRepo.listJoinedByMeeting(meetingId) || [];
    const levelOne =
      rows.find((row) => {
        return (
          Number(row?.level) === 1 &&
          Number(row?.is_hidden || 0) !== 1 &&
          this._normalize(row?.title) !== "manuell zuordnen"
        );
      }) || null;

    if (levelOne?.id) return levelOne;

    const anyVisible = rows.find((row) => Number(row?.is_hidden || 0) !== 1) || null;
    if (!anyVisible?.id) throw new Error("Kein Parent-TOP für create_child_top gefunden");
    return anyVisible;
  }

  _buildWorkingCard(meetingId) {
    const rows = this.meetingTopsRepo.listJoinedByMeeting(meetingId) || [];
    const byId = new Map();
    const visibleRows = rows.filter((row) => Number(row?.is_hidden || 0) !== 1);

    for (const row of visibleRows) {
      byId.set(String(row.id), row);
    }

    return visibleRows
      .map((row) => {
        const parent = byId.get(String(row.parent_top_id || "").trim()) || null;
        const title = this._safeText(row.title);
        const number = this._safeText(row.number);
        const longtext = this._safeText(row.longtext);
        const titleTerms = title.split(/\s+/).filter((part) => part.length >= 3);
        const longtextTerms = longtext.split(/\s+/).filter((part) => part.length >= 5).slice(0, 6);

        return {
          topId: row.id,
          number,
          title,
          level: Number(row.level || 0),
          parentTopId: row.parent_top_id || null,
          parentTitle: this._safeText(parent?.title || ""),
          longtext,
          searchTerms: this._uniqueTerms([
            title,
            number,
            parent?.title,
            ...titleTerms,
            ...longtextTerms,
          ]),
          normalizedTitle: this._normalize(title),
          normalizedParentTitle: this._normalize(parent?.title || ""),
        };
      })
      .filter((entry) => entry.topId && entry.title);
  }

  _findDirectTopMatch(segmentNormalized, rawSegment, workingCard) {
    const rawLower = String(rawSegment || "").toLocaleLowerCase("de-DE");
    const byNumber = workingCard
      .filter((entry) => entry.number && rawLower.includes(String(entry.number).toLocaleLowerCase("de-DE")))
      .sort((a, b) => String(b.number).length - String(a.number).length)[0];
    if (byNumber) {
      return {
        entry: byNumber,
        reason: `top_number_match:${byNumber.number}`,
      };
    }

    const byTitle = workingCard
      .filter((entry) => entry.normalizedTitle && segmentNormalized.includes(entry.normalizedTitle))
      .sort((a, b) => b.normalizedTitle.length - a.normalizedTitle.length)[0];
    if (byTitle) {
      return {
        entry: byTitle,
        reason: `top_title_match:${byTitle.title}`,
      };
    }

    return null;
  }

  _findParentMatch(segmentNormalized, workingCard) {
    return (
      workingCard
        .filter((entry) => entry.normalizedTitle && segmentNormalized.includes(entry.normalizedTitle))
        .sort((a, b) => b.normalizedTitle.length - a.normalizedTitle.length)[0] || null
    );
  }

  _extractTargetFromPhrases(segmentNormalized, workingCard) {
    const patterns = [
      { regex: /\bunter\s+(.+?)(?:$|[,:.;])/i, mode: "child", reason: "phrase_unter" },
      { regex: /\bbei\s+(.+?)(?:$|[,:.;])/i, mode: "append", reason: "phrase_bei" },
      { regex: /\bbeim\s+(.+?)(?:$|[,:.;])/i, mode: "append", reason: "phrase_beim" },
      { regex: /\bzum thema\s+(.+?)(?:$|[,:.;])/i, mode: "append", reason: "phrase_zum_thema" },
    ];

    for (const pattern of patterns) {
      const match = segmentNormalized.match(pattern.regex);
      if (!match || !match[1]) continue;
      const phraseTarget = this._normalize(match[1]);
      if (!phraseTarget) continue;

      const entry =
        workingCard
          .filter((item) => item.normalizedTitle && phraseTarget.includes(item.normalizedTitle))
          .sort((a, b) => b.normalizedTitle.length - a.normalizedTitle.length)[0] || null;

      if (entry) {
        return { entry, mode: pattern.mode, reason: `${pattern.reason}:${entry.title}` };
      }
    }

    return null;
  }

  _hasNewPointSignal(segmentText) {
    return NEW_POINT_PATTERN.test(String(segmentText || ""));
  }

  _stripLeadingContext(segmentText) {
    return String(segmentText || "")
      .replace(/^(?:neuer punkt|au[sß]erdem|zus[aä]tzlich|noch ein thema|weiterer punkt)\s*[:,-]?\s*/i, "")
      .replace(/^(?:unter|bei|beim|zum thema)\s+[^:.;,-]+[:,-]?\s*/i, "")
      .trim();
  }

  _buildSuggestedTitle(segmentText) {
    const cleaned = this._stripLeadingContext(segmentText).replace(/[.!?;]+$/g, "").trim();
    if (!cleaned) return "Neuer Punkt";

    const basis = cleaned.includes(":") ? cleaned.split(":").pop().trim() : cleaned;
    const words = basis.split(/\s+/).filter(Boolean).slice(0, 7);
    const compact = words.join(" ").trim();
    if (!compact) return "Neuer Punkt";
    return compact.length > 80 ? `${compact.slice(0, 77).trim()}...` : compact;
  }

  _mapSegment(segment, workingCard, context = {}) {
    const segmentText = this._safeText(segment?.text || "");
    if (!segmentText) return null;

    const segmentNormalized = this._normalize(segmentText);
    const hasNewPointSignal = this._hasNewPointSignal(segmentText);
    const directTop = this._findDirectTopMatch(segmentNormalized, segmentText, workingCard);
    const phraseTarget = this._extractTargetFromPhrases(segmentNormalized, workingCard);
    const currentAnchor =
      context.anchorTopId
        ? workingCard.find((entry) => String(entry.topId) === String(context.anchorTopId))
        : null;

    if (phraseTarget?.entry && phraseTarget.mode === "child") {
      return {
        type: "create_child_top",
        parentTopId: phraseTarget.entry.topId,
        titleSuggestion: this._buildSuggestedTitle(segmentText),
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: phraseTarget.reason,
        anchorTopId: phraseTarget.entry.topId,
      };
    }

    if (directTop && hasNewPointSignal) {
      return {
        type: "create_child_top",
        parentTopId: directTop.entry.topId,
        titleSuggestion: this._buildSuggestedTitle(segmentText),
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: `new_point_under_existing:${directTop.reason}`,
        anchorTopId: directTop.entry.topId,
      };
    }

    if (phraseTarget?.entry && phraseTarget.mode === "append") {
      return {
        type: "append_to_top",
        targetTopId: phraseTarget.entry.topId,
        titleSuggestion: null,
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: phraseTarget.reason,
        anchorTopId: phraseTarget.entry.topId,
      };
    }

    if (directTop) {
      return {
        type: "append_to_top",
        targetTopId: directTop.entry.topId,
        titleSuggestion: null,
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: directTop.reason,
        anchorTopId: directTop.entry.topId,
      };
    }

    if (hasNewPointSignal && currentAnchor) {
      return {
        type: "create_child_top",
        parentTopId: currentAnchor.topId,
        titleSuggestion: this._buildSuggestedTitle(segmentText),
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: `context_new_point:${currentAnchor.title}`,
        anchorTopId: currentAnchor.topId,
      };
    }

    if (!hasNewPointSignal && currentAnchor && Number(segment?.wordCount || 0) <= 22) {
      return {
        type: "append_to_top",
        targetTopId: currentAnchor.topId,
        titleSuggestion: null,
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: `context_anchor_append:${currentAnchor.title}`,
        anchorTopId: currentAnchor.topId,
      };
    }

    return {
      type: "manual_assign_child_top",
      titleSuggestion: this._buildSuggestedTitle(segmentText),
      textSuggestion: segmentText,
      sourceExcerpt: segmentText,
      mappingReason: hasNewPointSignal
        ? "manual_assign_new_point_without_safe_parent"
        : "manual_assign_no_safe_match",
      anchorTopId: currentAnchor?.topId || null,
    };
  }

  _createSuggestionPayload({ audioImportId, meeting, mapped }) {
    return {
      audioImportId,
      meetingId: meeting.id,
      projectId: meeting.project_id,
      type: mapped.type,
      targetTopId: mapped.targetTopId || null,
      parentTopId: mapped.parentTopId || null,
      titleSuggestion: mapped.titleSuggestion || null,
      textSuggestion: mapped.textSuggestion || "",
      sourceExcerpt: mapped.sourceExcerpt || "",
      confidence: null,
      status: "pending",
      mappingReason: mapped.mappingReason || "phase5_rule_based",
    };
  }

  createDemoSuggestion({ meetingId, demoType }) {
    if (!meetingId) throw new Error("meetingId required");
    const mode = String(demoType || "").trim();
    if (!mode) throw new Error("demoType required");

    const meeting = this._getMeetingOrThrow(meetingId);
    const audioImport = this._createDemoAudioImport(meeting, mode);

    if (mode === "append_to_top") {
      const target = this._pickAppendTarget(meeting.id);
      const targetLabel = this._topLabel({
        topId: target.id,
        number: target.number,
        title: target.title,
      });
      const suggestion = this.audioSuggestionsRepo.createSuggestion({
        audioImportId: audioImport.id,
        meetingId: meeting.id,
        projectId: meeting.project_id,
        type: "append_to_top",
        targetTopId: target.id,
        titleSuggestion: "Test: Bestehenden TOP ergänzen",
        textSuggestion: `Demo-Append: Dieser Text soll an den bestehenden Langtext von "${targetLabel}" angehängt werden.`,
        sourceExcerpt: `Stub-Ziel für append_to_top: ${targetLabel}`,
        confidence: 0.99,
        status: "pending",
        mappingReason: "phase3_demo_append",
      });
      return {
        suggestions: [suggestion],
        message: `Demo-Vorschlag für append_to_top wurde für "${targetLabel}" angelegt.`,
      };
    }

    if (mode === "create_child_top") {
      const parent = this._pickParentTarget(meeting.id);
      const parentLabel = this._topLabel({
        topId: parent.id,
        number: parent.number,
        title: parent.title,
      });
      const suggestion = this.audioSuggestionsRepo.createSuggestion({
        audioImportId: audioImport.id,
        meetingId: meeting.id,
        projectId: meeting.project_id,
        type: "create_child_top",
        parentTopId: parent.id,
        titleSuggestion: "Test-Unterpunkt für create_child_top",
        textSuggestion: `Demo-Child: Dieser neue TOP soll unter "${parentLabel}" angelegt werden.`,
        sourceExcerpt: `Stub-Parent für create_child_top: ${parentLabel}`,
        confidence: 0.99,
        status: "pending",
        mappingReason: "phase3_demo_child",
      });
      return {
        suggestions: [suggestion],
        message: `Demo-Vorschlag für create_child_top wurde unter "${parentLabel}" angelegt.`,
      };
    }

    if (mode === "manual_assign_child_top") {
      const suggestion = this.audioSuggestionsRepo.createSuggestion({
        audioImportId: audioImport.id,
        meetingId: meeting.id,
        projectId: meeting.project_id,
        type: "manual_assign_child_top",
        titleSuggestion: "Test: Manuell zuordnen",
        textSuggestion:
          "Demo-Manuell: Dieser Vorschlag soll unter dem Bereich 'Manuell zuordnen' angelegt werden.",
        sourceExcerpt: "Stub-Ziel: Manuell zuordnen",
        confidence: 0.5,
        status: "pending",
        mappingReason: "phase3_demo_manual_assign",
      });
      return {
        suggestions: [suggestion],
        message: "Demo-Vorschlag für manual_assign_child_top wurde angelegt.",
      };
    }

    throw new Error(`Unbekannter demoType: ${mode}`);
  }

  analyze({ audioImportId }) {
    if (!audioImportId) throw new Error("audioImportId required");

    const audioImport = this.audioImportsRepo.getById(audioImportId);
    if (!audioImport) throw new Error("Audio-Import nicht gefunden");

    const meeting = this._getMeetingOrThrow(audioImport.meeting_id);
    const transcript = this.transcriptsRepo.getByAudioImportId(audioImportId);
    if (!transcript?.full_text) {
      throw new Error("Kein Transkript für den Audio-Import vorhanden");
    }

    const segments = this.segmentationService.segmentTranscript(transcript);
    const workingCard = this._buildWorkingCard(meeting.id);

    this.transcriptsRepo.upsertTranscript({
      audioImportId,
      engine: transcript.engine,
      language: transcript.language,
      fullText: transcript.full_text,
      segmentsJson: JSON.stringify(segments),
    });

    this.audioSuggestionsRepo.deletePendingByAudioImport(audioImportId);

    const created = [];
    let anchorTopId = null;
    for (const segment of segments) {
      const mapped = this._mapSegment(segment, workingCard, { anchorTopId });
      if (!mapped) continue;

      const suggestion = this.audioSuggestionsRepo.createSuggestion(
        this._createSuggestionPayload({
          audioImportId,
          meeting,
          mapped,
        })
      );
      created.push(suggestion);
      anchorTopId = mapped.anchorTopId || anchorTopId;
    }

    this.audioImportsRepo.updateStatus({
      audioImportId,
      status: "analyzed",
      errorMessage: null,
    });

    return {
      suggestions: created,
      segmentCount: segments.length,
      stub: false,
      message:
        "Transkript wurde segmentiert und konservativ gegen die bestehende TOP-Struktur geprüft. Unsichere Inhalte wurden nach 'Manuell zuordnen' geleitet.",
    };
  }
}

function createMeetingMappingService(deps) {
  return new MeetingMappingService(deps);
}

module.exports = {
  MeetingMappingService,
  createMeetingMappingService,
};
