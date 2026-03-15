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
        String(row?.title || "").trim().toLocaleLowerCase("de-DE") !== "manuell zuordnen"
      );
    });

    const preferred =
      filtered.find((row) => String(row?.longtext || "").trim()) ||
      filtered[0] ||
      null;

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
          String(row?.title || "").trim().toLocaleLowerCase("de-DE") !== "manuell zuordnen"
        );
      }) || null;

    if (levelOne?.id) return levelOne;

    const anyVisible = rows.find((row) => Number(row?.is_hidden || 0) !== 1) || null;
    if (!anyVisible?.id) throw new Error("Kein Parent-TOP für create_child_top gefunden");
    return anyVisible;
  }

  _formatTopLabel(top) {
    if (!top) return "";
    const number = String(top.number || "").trim();
    const title = String(top.title || "").trim();
    if (number && title) return `${number} ${title}`;
    return title || number || String(top.id || "").trim();
  }

  createDemoSuggestion({ meetingId, demoType }) {
    if (!meetingId) throw new Error("meetingId required");
    const mode = String(demoType || "").trim();
    if (!mode) throw new Error("demoType required");

    const meeting = this._getMeetingOrThrow(meetingId);
    const audioImport = this._createDemoAudioImport(meeting, mode);

    if (mode === "append_to_top") {
      const target = this._pickAppendTarget(meeting.id);
      const targetLabel = this._formatTopLabel(target);
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
      const parentLabel = this._formatTopLabel(parent);
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
        textSuggestion: "Demo-Manuell: Dieser Vorschlag soll unter dem Bereich 'Manuell zuordnen' angelegt werden.",
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
    const segments = this.segmentationService.segmentTranscript(transcript);

    this.audioSuggestionsRepo.deletePendingByAudioImport(audioImportId);
    const placeholderSuggestion = this.audioSuggestionsRepo.createSuggestion({
      audioImportId,
      meetingId: meeting.id,
      projectId: meeting.project_id,
      type: "manual_assign_child_top",
      titleSuggestion: "Audioimport prüfen",
      textSuggestion: `Phase-3-Platzhalter für "${audioImport.original_file_name || "Audiodatei"}".`,
      sourceExcerpt: String(transcript?.full_text || "").trim(),
      confidence: 0,
      status: "pending",
      mappingReason: "phase3_stub",
    });
    this.audioImportsRepo.updateStatus({
      audioImportId,
      status: "analyzed",
      errorMessage: null,
    });

    return {
      suggestions: [placeholderSuggestion],
      segmentCount: segments.length,
      stub: true,
      message: "Segmentierung und Mapping bleiben in Phase 4 noch Platzhalter. Es wurde ein pr?fbarer Demo-Vorschlag erzeugt.",
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
