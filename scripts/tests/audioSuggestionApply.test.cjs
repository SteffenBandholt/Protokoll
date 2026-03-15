const { SuggestionApplyService } = require("../../src/main/services/audio/SuggestionApplyService.js");

function createSuggestionRepo(initialSuggestions) {
  const map = new Map(
    (Array.isArray(initialSuggestions) ? initialSuggestions : []).map((item) => [item.id, { ...item }])
  );

  return {
    _map: map,
    getById(id) {
      const row = map.get(id);
      return row ? { ...row } : null;
    },
    markApplied({ suggestionId, appliedTargetTopId = null, appliedParentTopId = null, usedOverride = false }) {
      const row = map.get(suggestionId);
      if (!row) throw new Error("Vorschlag nicht gefunden");
      if (String(row.status) !== "pending") {
        throw new Error("Vorschlag kann nicht übernommen werden");
      }
      Object.assign(row, {
        status: "applied",
        applied_at: "2026-03-15T12:00:00.000Z",
        applied_target_top_id: appliedTargetTopId,
        applied_parent_top_id: appliedParentTopId,
        applied_with_override: usedOverride ? 1 : 0,
        apply_error: null,
      });
      return { ...row };
    },
    setApplyError({ suggestionId, errorMessage }) {
      const row = map.get(suggestionId);
      if (!row) throw new Error("Vorschlag nicht gefunden");
      row.apply_error = String(errorMessage || "");
      return { ...row };
    },
  };
}

function createTestContext({ meetingClosed = false, suggestions = [], meetingProjectId = "project-1", items = [], meetingTops = {} } = {}) {
  const meetingsRepo = {
    getMeetingById(meetingId) {
      return {
        id: meetingId,
        project_id: meetingProjectId,
        is_closed: meetingClosed ? 1 : 0,
      };
    },
  };

  const meetingTopsRepo = {
    getMeetingTop(meetingId, topId) {
      const row = meetingTops[String(topId)];
      return row ? { meeting_id: meetingId, top_id: topId, ...row } : null;
    },
  };

  const audioSuggestionsRepo = createSuggestionRepo(suggestions);

  const createdTops = [];
  const updatedMeetingFields = [];
  const listState = items.map((item) => ({ ...item }));
  let idCounter = 1;

  const topService = {
    listByMeeting() {
      return listState.map((item) => ({ ...item }));
    },
    createTop({ projectId, meetingId, parentTopId, level, title }) {
      const created = {
        id: `created-${idCounter++}`,
        project_id: projectId,
        meeting_id: meetingId,
        parent_top_id: parentTopId || null,
        level,
        number: 99 + createdTops.length,
        title,
        is_hidden: 0,
      };
      createdTops.push({ ...created });
      listState.push({ ...created });
      meetingTops[created.id] = { longtext: "" };
      return { ...created };
    },
    updateMeetingFields({ meetingId, topId, patch }) {
      updatedMeetingFields.push({ meetingId, topId, patch: { ...patch } });
      if (!meetingTops[topId]) meetingTops[topId] = {};
      Object.assign(meetingTops[topId], patch);
      return {
        row: {
          meeting_id: meetingId,
          top_id: topId,
          ...meetingTops[topId],
        },
      };
    },
  };

  const service = new SuggestionApplyService({
    audioSuggestionsRepo,
    meetingsRepo,
    meetingTopsRepo,
  });
  service.topService = topService;

  return {
    service,
    audioSuggestionsRepo,
    createdTops,
    updatedMeetingFields,
    listState,
    meetingTops,
  };
}

module.exports = (run, { assert }) => {
  run("SuggestionApplyService append_to_top hängt Text an bestehenden Langtext an", () => {
    const suggestion = {
      id: "s-append",
      meeting_id: "meeting-1",
      project_id: "project-1",
      status: "pending",
      type: "append_to_top",
      target_top_id: "top-1",
      text_suggestion: "Neue Ergänzung",
    };
    const ctx = createTestContext({
      suggestions: [suggestion],
      items: [
        { id: "top-1", project_id: "project-1", level: 1, title: "Fundament", number: 1, is_hidden: 0 },
      ],
      meetingTops: {
        "top-1": { longtext: "Bestehender Langtext" },
      },
    });

    const result = ctx.service.applySuggestion({ suggestionId: suggestion.id });

    assert.equal(result.suggestion.status, "applied");
    assert.equal(ctx.updatedMeetingFields.length, 1);
    assert.equal(
      ctx.updatedMeetingFields[0].patch.longtext,
      "Bestehender Langtext\nNeue Ergänzung"
    );
  });

  run("SuggestionApplyService create_child_top legt neuen TOP unter gültigem Parent an", () => {
    const suggestion = {
      id: "s-child",
      meeting_id: "meeting-1",
      project_id: "project-1",
      status: "pending",
      type: "create_child_top",
      parent_top_id: "top-parent",
      title_suggestion: "Gerüstprüfung",
      text_suggestion: "Prüfung nächste Woche durchführen.",
    };
    const ctx = createTestContext({
      suggestions: [suggestion],
      items: [
        { id: "top-parent", project_id: "project-1", level: 1, title: "Rohbau", number: 2, is_hidden: 0 },
      ],
    });

    const result = ctx.service.applySuggestion({ suggestionId: suggestion.id });

    assert.equal(result.suggestion.status, "applied");
    assert.equal(ctx.createdTops.length, 1);
    assert.equal(ctx.createdTops[0].parent_top_id, "top-parent");
    assert.equal(ctx.createdTops[0].level, 2);
    assert.equal(ctx.createdTops[0].title, "Gerüstprüfung");
    assert.equal(ctx.updatedMeetingFields[0].topId, ctx.createdTops[0].id);
    assert.equal(ctx.updatedMeetingFields[0].patch.longtext, "Prüfung nächste Woche durchführen.");
  });

  run("SuggestionApplyService manual_assign_child_top erzeugt 'Manuell zuordnen' nur einmal und nutzt ihn wieder", () => {
    const suggestions = [
      {
        id: "s-manual-1",
        meeting_id: "meeting-1",
        project_id: "project-1",
        status: "pending",
        type: "manual_assign_child_top",
        title_suggestion: "Statikunterlagen",
        text_suggestion: "Statikunterlagen fehlen noch.",
      },
      {
        id: "s-manual-2",
        meeting_id: "meeting-1",
        project_id: "project-1",
        status: "pending",
        type: "manual_assign_child_top",
        title_suggestion: "Noch offen",
        text_suggestion: "Weiterer offener Punkt.",
      },
    ];
    const ctx = createTestContext({ suggestions });

    ctx.service.applySuggestion({ suggestionId: "s-manual-1" });
    ctx.service.applySuggestion({ suggestionId: "s-manual-2" });

    const manualRoots = ctx.listState.filter((item) => item.title === "Manuell zuordnen");
    const manualChildren = ctx.createdTops.filter((item) => item.parent_top_id === manualRoots[0]?.id);

    assert.equal(manualRoots.length, 1);
    assert.equal(manualChildren.length, 2);
  });

  run("SuggestionApplyService lehnt Übernahme für geschlossene Meetings ab und hinterlässt pending + apply_error", () => {
    const suggestion = {
      id: "s-closed",
      meeting_id: "meeting-1",
      project_id: "project-1",
      status: "pending",
      type: "append_to_top",
      target_top_id: "top-1",
      text_suggestion: "Text",
    };
    const ctx = createTestContext({
      meetingClosed: true,
      suggestions: [suggestion],
      items: [
        { id: "top-1", project_id: "project-1", level: 1, title: "Fundament", number: 1, is_hidden: 0 },
      ],
      meetingTops: {
        "top-1": { longtext: "Alt" },
      },
    });

    assert.throws(() => ctx.service.applySuggestion({ suggestionId: suggestion.id }), /geschlossen/i);
    assert.equal(ctx.audioSuggestionsRepo.getById(suggestion.id).status, "pending");
    assert.match(ctx.audioSuggestionsRepo.getById(suggestion.id).apply_error, /geschlossen/i);
  });

  run("SuggestionApplyService lehnt veraltete oder fremde Ziele sauber ab", () => {
    const suggestion = {
      id: "s-stale",
      meeting_id: "meeting-1",
      project_id: "project-2",
      status: "pending",
      type: "append_to_top",
      target_top_id: "missing-top",
      text_suggestion: "Text",
    };
    const ctx = createTestContext({
      suggestions: [suggestion],
      items: [],
      meetingProjectId: "project-1",
    });

    assert.throws(
      () => ctx.service.applySuggestion({ suggestionId: suggestion.id }),
      /gehört nicht zum aktuellen Projekt|nicht mehr Teil der offenen Besprechung/i
    );
    assert.equal(ctx.audioSuggestionsRepo.getById(suggestion.id).status, "pending");
    assert.ok(ctx.audioSuggestionsRepo.getById(suggestion.id).apply_error);
  });

  run("SuggestionApplyService validiert Override-Parent serverseitig", () => {
    const suggestion = {
      id: "s-override",
      meeting_id: "meeting-1",
      project_id: "project-1",
      status: "pending",
      type: "create_child_top",
      parent_top_id: "top-parent",
      title_suggestion: "Kind",
      text_suggestion: "Text",
    };
    const ctx = createTestContext({
      suggestions: [suggestion],
      items: [
        { id: "top-parent", project_id: "project-1", level: 1, title: "Rohbau", number: 2, is_hidden: 0 },
      ],
    });

    assert.throws(
      () => ctx.service.applySuggestion({ suggestionId: suggestion.id, overrideParentTopId: "unknown-parent" }),
      /override-parent|nicht mehr teil/i
    );
    assert.equal(ctx.audioSuggestionsRepo.getById(suggestion.id).status, "pending");
    assert.match(ctx.audioSuggestionsRepo.getById(suggestion.id).apply_error, /Override-Parent/i);
  });

  run("SuggestionApplyService verhindert erneute Nutzung bereits applied/rejected Vorschläge", () => {
    const appliedCtx = createTestContext({
      suggestions: [
        {
          id: "s-applied",
          meeting_id: "meeting-1",
          project_id: "project-1",
          status: "applied",
          type: "append_to_top",
          target_top_id: "top-1",
          text_suggestion: "Text",
        },
      ],
    });
    const rejectedCtx = createTestContext({
      suggestions: [
        {
          id: "s-rejected",
          meeting_id: "meeting-1",
          project_id: "project-1",
          status: "rejected",
          type: "append_to_top",
          target_top_id: "top-1",
          text_suggestion: "Text",
        },
      ],
    });

    assert.throws(() => appliedCtx.service.applySuggestion({ suggestionId: "s-applied" }), /bereits übernommen/i);
    assert.throws(() => rejectedCtx.service.applySuggestion({ suggestionId: "s-rejected" }), /bereits verworfen/i);
    assert.equal(appliedCtx.audioSuggestionsRepo.getById("s-applied").apply_error, undefined);
    assert.equal(rejectedCtx.audioSuggestionsRepo.getById("s-rejected").apply_error, undefined);
  });
};
