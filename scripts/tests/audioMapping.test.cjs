const {
  TranscriptSegmentationService,
} = require("../../src/main/services/audio/TranscriptSegmentationService.js");
const {
  MeetingMappingService,
} = require("../../src/main/services/audio/MeetingMappingService.js");

function createAnalyzeContext({ transcriptText, tops }) {
  const createdSuggestions = [];
  const transcriptWrites = [];
  const importUpdates = [];

  const service = new MeetingMappingService({
    meetingsRepo: {
      getMeetingById(meetingId) {
        return {
          id: meetingId,
          project_id: "project-1",
          is_closed: 0,
        };
      },
    },
    audioImportsRepo: {
      getById(audioImportId) {
        return {
          id: audioImportId,
          meeting_id: "meeting-1",
          project_id: "project-1",
        };
      },
      updateStatus(payload) {
        importUpdates.push({ ...payload });
      },
    },
    transcriptsRepo: {
      getByAudioImportId() {
        return {
          audio_import_id: "audio-1",
          engine: "test-engine",
          language: "de",
          full_text: transcriptText,
        };
      },
      upsertTranscript(payload) {
        transcriptWrites.push({ ...payload });
      },
    },
    audioSuggestionsRepo: {
      deletePendingByAudioImport() {},
      createSuggestion(payload) {
        const created = { id: `suggestion-${createdSuggestions.length + 1}`, ...payload };
        createdSuggestions.push(created);
        return created;
      },
    },
    segmentationService: new TranscriptSegmentationService(),
    meetingTopsRepo: {
      listJoinedByMeeting() {
        return (tops || []).map((row) => ({ ...row }));
      },
    },
  });

  return {
    service,
    createdSuggestions,
    transcriptWrites,
    importUpdates,
  };
}

module.exports = (run, { assert }) => {
  run("TranscriptSegmentationService zerlegt konservativ an Satz- und Themenwechseln", () => {
    const service = new TranscriptSegmentationService();
    const segments = service.segmentTranscript({
      full_text:
        "Bei Fundament fehlt noch die Freigabe.\n\nAußerdem noch ein Thema: Statikunterlagen fehlen noch.",
    });

    assert.equal(segments.length, 2);
    assert.match(segments[0].text, /Fundament/i);
    assert.equal(segments[1].hasTopicChangeSignal, true);
    assert.match(segments[1].text, /Statikunterlagen/i);
  });

  run("MeetingMappingService erzeugt append_to_top bei sicherem Treffer", () => {
    const ctx = createAnalyzeContext({
      transcriptText: "Bei Fundament fehlt noch die Freigabe.",
      tops: [
        {
          id: "top-fundament",
          project_id: "project-1",
          parent_top_id: null,
          level: 1,
          number: 2,
          title: "Fundament",
          longtext: "Bestand",
          is_hidden: 0,
        },
      ],
    });

    const result = ctx.service.analyze({ audioImportId: "audio-1" });

    assert.equal(result.stub, false);
    assert.equal(ctx.createdSuggestions.length, 1);
    assert.equal(ctx.createdSuggestions[0].type, "append_to_top");
    assert.equal(ctx.createdSuggestions[0].targetTopId, "top-fundament");
    assert.match(ctx.createdSuggestions[0].mappingReason, /phrase_bei|top_title_match/i);
    assert.equal(ctx.importUpdates[0].status, "analyzed");
    assert.ok(ctx.transcriptWrites[0].segmentsJson);
  });

  run("MeetingMappingService erzeugt create_child_top bei 'Neuer Punkt unter ...'", () => {
    const ctx = createAnalyzeContext({
      transcriptText: "Neuer Punkt unter Rohbau: Gerüstprüfung nächste Woche.",
      tops: [
        {
          id: "top-rohbau",
          project_id: "project-1",
          parent_top_id: null,
          level: 1,
          number: 3,
          title: "Rohbau",
          longtext: "",
          is_hidden: 0,
        },
      ],
    });

    ctx.service.analyze({ audioImportId: "audio-1" });

    assert.equal(ctx.createdSuggestions.length, 1);
    assert.equal(ctx.createdSuggestions[0].type, "create_child_top");
    assert.equal(ctx.createdSuggestions[0].parentTopId, "top-rohbau");
    assert.match(ctx.createdSuggestions[0].titleSuggestion, /Gerüstprüfung|Geruestpruefung|nächste Woche/i);
  });

  run("MeetingMappingService nutzt den aktiven TOP-Anker für kurze Folgeaussagen", () => {
    const ctx = createAnalyzeContext({
      transcriptText: [
        "Beim Fundament fehlt noch die Freigabe.",
        "Der Statiker hat dazu noch nichts geschickt.",
        "Die Unterlagen kommen morgen.",
      ].join("\n\n"),
      tops: [
        {
          id: "top-fundament",
          project_id: "project-1",
          parent_top_id: null,
          level: 1,
          number: 2,
          title: "Fundament",
          longtext: "",
          is_hidden: 0,
        },
      ],
    });

    ctx.service.analyze({ audioImportId: "audio-1" });

    assert.equal(ctx.createdSuggestions.length, 3);
    assert.deepEqual(
      ctx.createdSuggestions.map((item) => item.type),
      ["append_to_top", "append_to_top", "append_to_top"]
    );
    assert.deepEqual(
      ctx.createdSuggestions.map((item) => item.targetTopId),
      ["top-fundament", "top-fundament", "top-fundament"]
    );
    assert.match(ctx.createdSuggestions[1].mappingReason, /context_anchor_append/i);
    assert.match(ctx.createdSuggestions[2].mappingReason, /context_anchor_append/i);
  });

  run("MeetingMappingService ersetzt den Anker bei sicherem neuem TOP-Treffer", () => {
    const ctx = createAnalyzeContext({
      transcriptText: [
        "Beim Fundament fehlt noch die Freigabe.",
        "Zum Thema Termine verschiebt sich die Betonage.",
      ].join(" "),
      tops: [
        {
          id: "top-fundament",
          project_id: "project-1",
          parent_top_id: null,
          level: 1,
          number: 2,
          title: "Fundament",
          longtext: "",
          is_hidden: 0,
        },
        {
          id: "top-termine",
          project_id: "project-1",
          parent_top_id: null,
          level: 1,
          number: 4,
          title: "Termine",
          longtext: "",
          is_hidden: 0,
        },
      ],
    });

    ctx.service.analyze({ audioImportId: "audio-1" });

    assert.equal(ctx.createdSuggestions.length, 2);
    assert.equal(ctx.createdSuggestions[0].type, "append_to_top");
    assert.equal(ctx.createdSuggestions[0].targetTopId, "top-fundament");
    assert.equal(ctx.createdSuggestions[1].type, "append_to_top");
    assert.equal(ctx.createdSuggestions[1].targetTopId, "top-termine");
    assert.match(ctx.createdSuggestions[1].mappingReason, /phrase_zum_thema|top_title_match/i);
  });

  run("MeetingMappingService verwirft den Anker bei explizitem neuen Punkt", () => {
    const ctx = createAnalyzeContext({
      transcriptText: [
        "Beim Fundament fehlt noch die Freigabe.",
        "Außerdem neuer Punkt unter Rohbau: Gerüstprüfung nächste Woche.",
      ].join("\n\n"),
      tops: [
        {
          id: "top-fundament",
          project_id: "project-1",
          parent_top_id: null,
          level: 1,
          number: 2,
          title: "Fundament",
          longtext: "",
          is_hidden: 0,
        },
        {
          id: "top-rohbau",
          project_id: "project-1",
          parent_top_id: null,
          level: 1,
          number: 3,
          title: "Rohbau",
          longtext: "",
          is_hidden: 0,
        },
      ],
    });

    ctx.service.analyze({ audioImportId: "audio-1" });

    assert.equal(ctx.createdSuggestions.length, 2);
    assert.equal(ctx.createdSuggestions[0].type, "append_to_top");
    assert.equal(ctx.createdSuggestions[0].targetTopId, "top-fundament");
    assert.equal(ctx.createdSuggestions[1].type, "create_child_top");
    assert.equal(ctx.createdSuggestions[1].parentTopId, "top-rohbau");
  });

  run("MeetingMappingService leitet unsichere Inhalte nach 'Manuell zuordnen'", () => {
    const ctx = createAnalyzeContext({
      transcriptText: "Statikunterlagen fehlen noch.",
      tops: [
        {
          id: "top-fundament",
          project_id: "project-1",
          parent_top_id: null,
          level: 1,
          number: 2,
          title: "Fundament",
          longtext: "Bestand",
          is_hidden: 0,
        },
      ],
    });

    ctx.service.analyze({ audioImportId: "audio-1" });

    assert.equal(ctx.createdSuggestions.length, 1);
    assert.equal(ctx.createdSuggestions[0].type, "manual_assign_child_top");
    assert.match(ctx.createdSuggestions[0].mappingReason, /manual_assign/i);
  });
};
