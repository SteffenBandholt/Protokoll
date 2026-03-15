const path = require("node:path");

function loadRepoWithDb(db) {
  const repoPath = path.resolve(__dirname, "../../src/main/db/audioSuggestionsRepo.js");
  const databasePath = path.resolve(__dirname, "../../src/main/db/database.js");

  const oldRepo = require.cache[repoPath];
  const oldDatabase = require.cache[databasePath];

  delete require.cache[repoPath];
  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: {
      initDatabase: () => db,
    },
  };

  try {
    return require(repoPath);
  } finally {
    delete require.cache[repoPath];
    if (oldDatabase) require.cache[databasePath] = oldDatabase;
    else delete require.cache[databasePath];
    if (oldRepo) require.cache[repoPath] = oldRepo;
  }
}

function createFakeDb() {
  const suggestions = new Map();
  const tops = new Map([
    ["top-1", { id: "top-1", title: "Fundament", number: 2 }],
    ["top-2", { id: "top-2", title: "Rohbau", number: 3 }],
  ]);

  const withJoinFields = (row) => {
    if (!row) return undefined;
    const target = tops.get(String(row.target_top_id || "")) || null;
    const parent = tops.get(String(row.parent_top_id || "")) || null;
    return {
      ...row,
      target_top_title: target?.title || null,
      target_top_number: target?.number || null,
      parent_top_title: parent?.title || null,
      parent_top_number: parent?.number || null,
    };
  };

  return {
    suggestions,
    insertSuggestion(overrides = {}) {
      suggestions.set(String(overrides.id || "suggestion-1"), {
        id: overrides.id || "suggestion-1",
        audio_import_id: overrides.audio_import_id || "audio-1",
        meeting_id: overrides.meeting_id || "meeting-1",
        project_id: overrides.project_id || "project-1",
        type: overrides.type || "append_to_top",
        target_top_id: overrides.target_top_id === undefined ? "top-1" : overrides.target_top_id,
        parent_top_id: overrides.parent_top_id === undefined ? null : overrides.parent_top_id,
        title_suggestion: overrides.title_suggestion || null,
        text_suggestion: overrides.text_suggestion || "Text",
        source_excerpt: overrides.source_excerpt || "Quelle",
        confidence: overrides.confidence === undefined ? null : overrides.confidence,
        status: overrides.status || "pending",
        mapping_reason: overrides.mapping_reason || "test",
        applied_at: null,
        rejected_at: null,
        applied_target_top_id: null,
        applied_parent_top_id: null,
        applied_with_override: 0,
        apply_error: null,
        created_at: "2026-03-15T10:00:00.000Z",
        updated_at: "2026-03-15T10:00:00.000Z",
      });
    },
    prepare(sql) {
      const normalized = String(sql || "").replace(/\s+/g, " ").trim().toLowerCase();

      if (normalized.startsWith("select s.*,") && normalized.includes("from audio_suggestions s")) {
        return {
          get(suggestionId) {
            return withJoinFields(suggestions.get(String(suggestionId)) || null);
          },
        };
      }

      if (normalized.startsWith("update audio_suggestions set status = 'applied'")) {
        return {
          run(appliedAt, appliedTargetTopId, appliedParentTopId, appliedWithOverride, updatedAt, suggestionId) {
            const row = suggestions.get(String(suggestionId));
            if (!row || String(row.status) !== "pending") return { changes: 0 };
            Object.assign(row, {
              status: "applied",
              applied_at: appliedAt,
              rejected_at: null,
              applied_target_top_id: appliedTargetTopId,
              applied_parent_top_id: appliedParentTopId,
              applied_with_override: appliedWithOverride,
              apply_error: null,
              updated_at: updatedAt,
            });
            return { changes: 1 };
          },
        };
      }

      if (normalized.startsWith("update audio_suggestions set status = 'rejected'")) {
        return {
          run(rejectedAt, updatedAt, suggestionId) {
            const row = suggestions.get(String(suggestionId));
            if (!row || String(row.status) !== "pending") return { changes: 0 };
            Object.assign(row, {
              status: "rejected",
              rejected_at: rejectedAt,
              apply_error: null,
              updated_at: updatedAt,
            });
            return { changes: 1 };
          },
        };
      }

      if (normalized.startsWith("update audio_suggestions set apply_error = ?")) {
        return {
          run(errorMessage, updatedAt, suggestionId) {
            const row = suggestions.get(String(suggestionId));
            if (!row) return { changes: 0 };
            Object.assign(row, {
              apply_error: errorMessage,
              updated_at: updatedAt,
            });
            return { changes: 1 };
          },
        };
      }

      throw new Error(`Unsupported SQL in fake DB: ${sql}`);
    },
  };
}

module.exports = (run, { assert }) => {
  run("audioSuggestionsRepo markApplied setzt Status und Trace-Daten", () => {
    const db = createFakeDb();
    db.insertSuggestion({ id: "apply-1", target_top_id: "top-1" });
    const repo = loadRepoWithDb(db);

    const updated = repo.markApplied({
      suggestionId: "apply-1",
      appliedTargetTopId: "top-created",
      appliedParentTopId: "top-2",
      usedOverride: true,
    });

    assert.equal(updated.status, "applied");
    assert.equal(updated.applied_target_top_id, "top-created");
    assert.equal(updated.applied_parent_top_id, "top-2");
    assert.equal(Number(updated.applied_with_override), 1);
    assert.equal(updated.apply_error, null);
    assert.ok(updated.applied_at);
  });

  run("audioSuggestionsRepo markRejected erlaubt nur pending -> rejected", () => {
    const db = createFakeDb();
    db.insertSuggestion({ id: "reject-1" });
    const repo = loadRepoWithDb(db);

    const updated = repo.markRejected({ suggestionId: "reject-1" });
    assert.equal(updated.status, "rejected");
    assert.ok(updated.rejected_at);

    assert.throws(() => repo.markRejected({ suggestionId: "reject-1" }), /bereits verworfen/i);
  });

  run("audioSuggestionsRepo verhindert erneutes Anwenden bereits übernommener Vorschläge", () => {
    const db = createFakeDb();
    db.insertSuggestion({ id: "apply-2", status: "applied" });
    const repo = loadRepoWithDb(db);

    assert.throws(
      () => repo.markApplied({ suggestionId: "apply-2", appliedTargetTopId: "x" }),
      /bereits übernommen/i
    );
  });

  run("audioSuggestionsRepo speichert Apply-Fehler ohne Statuswechsel", () => {
    const db = createFakeDb();
    db.insertSuggestion({ id: "error-1" });
    const repo = loadRepoWithDb(db);

    const updated = repo.setApplyError({
      suggestionId: "error-1",
      errorMessage: "Parent-TOP ist nicht mehr Teil der offenen Besprechung",
    });

    assert.equal(updated.status, "pending");
    assert.equal(updated.apply_error, "Parent-TOP ist nicht mehr Teil der offenen Besprechung");
  });
};
