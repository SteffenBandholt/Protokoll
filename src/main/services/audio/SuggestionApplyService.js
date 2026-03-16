const defaultTopsRepo = require("../../db/topsRepo");
const defaultMeetingsRepo = require("../../db/meetingsRepo");
const defaultMeetingTopsRepo = require("../../db/meetingTopsRepo");
const { createTopService } = require("../../domain/TopService");

const MANUAL_ASSIGN_TITLE = "Manuell zuordnen";

function _normalizeText(value) {
  return String(value || "").trim();
}

function _normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function _audioLog(message, extra = null) {
  if (extra && typeof extra === "object") {
    console.info("[AUDIO] Apply", message, extra);
    return;
  }
  console.info("[AUDIO] Apply", message);
}

class SuggestionApplyService {
  constructor({
    audioSuggestionsRepo,
    topsRepo = defaultTopsRepo,
    meetingsRepo = defaultMeetingsRepo,
    meetingTopsRepo = defaultMeetingTopsRepo,
  }) {
    if (!audioSuggestionsRepo) {
      throw new Error("SuggestionApplyService: audioSuggestionsRepo required");
    }

    this.audioSuggestionsRepo = audioSuggestionsRepo;
    this.meetingsRepo = meetingsRepo;
    this.meetingTopsRepo = meetingTopsRepo;
    this.topService = createTopService({ topsRepo, meetingsRepo, meetingTopsRepo });
  }

  _getOpenMeetingOrThrow(meetingId) {
    const meeting = this.meetingsRepo.getMeetingById(meetingId);
    if (!meeting) throw new Error("Besprechung nicht gefunden");
    if (Number(meeting.is_closed) === 1) {
      throw new Error("Besprechung ist geschlossen - Übernahme nicht erlaubt");
    }
    return meeting;
  }

  _listMeetingTops(meetingId) {
    return this.topService.listByMeeting(meetingId) || [];
  }

  _findTopInMeeting(meetingId, topId) {
    const list = this._listMeetingTops(meetingId);
    return list.find((item) => String(item.id) === String(topId)) || null;
  }

  _getSuggestionOrThrow(suggestionId) {
    const suggestion = this.audioSuggestionsRepo.getById(suggestionId);
    if (!suggestion) throw new Error("Vorschlag nicht gefunden");
    return suggestion;
  }

  _assertSuggestionPending(suggestion, actionLabel = "übernommen") {
    const status = _normalizeStatus(suggestion?.status);
    if (status === "rejected") {
      throw new Error(`Vorschlag wurde bereits verworfen und kann nicht ${actionLabel} werden.`);
    }
    if (status === "applied") {
      throw new Error(`Vorschlag wurde bereits übernommen und kann nicht erneut ${actionLabel} werden.`);
    }
    if (status && status !== "pending") {
      throw new Error(
        `Vorschlag ist nicht mehr im Status pending (${status}) und kann nicht ${actionLabel} werden.`
      );
    }
  }

  _assertSuggestionBelongsToMeeting(meeting, suggestion) {
    if (String(suggestion?.meeting_id || "") !== String(meeting?.id || "")) {
      throw new Error("Vorschlag gehört nicht zur aktuellen Besprechung");
    }
    if (String(suggestion?.project_id || "") !== String(meeting?.project_id || "")) {
      throw new Error("Vorschlag gehört nicht zum aktuellen Projekt");
    }
  }

  _appendLongtext(existingLongtext, extraText) {
    const current =
      existingLongtext === null || existingLongtext === undefined
        ? ""
        : String(existingLongtext);
    const addition = _normalizeText(extraText);
    if (!addition) return current;
    return current ? `${current}\n${addition}` : addition;
  }

  _findManualAssignRoots(meetingId) {
    const list = this._listMeetingTops(meetingId);
    const normalizedTitle = MANUAL_ASSIGN_TITLE.toLocaleLowerCase("de-DE");
    return list.filter((item) => {
      const title = String(item?.title || "").trim().toLocaleLowerCase("de-DE");
      return Number(item?.level) === 1 && title === normalizedTitle;
    });
  }

  _ensureManualAssignRoot(meeting) {
    const existing = this._findManualAssignRoots(meeting.id);
    if (existing.length > 1) {
      throw new Error(
        "Der Bereich 'Manuell zuordnen' ist mehrfach vorhanden. Bitte Besprechung prüfen."
      );
    }
    if (existing[0]) return existing[0];

    this.topService.createTop({
      projectId: meeting.project_id,
      meetingId: meeting.id,
      parentTopId: null,
      level: 1,
      title: MANUAL_ASSIGN_TITLE,
    });

    const createdRoots = this._findManualAssignRoots(meeting.id);
    if (createdRoots.length !== 1) {
      throw new Error("Der Bereich 'Manuell zuordnen' konnte nicht eindeutig ermittelt werden.");
    }
    return createdRoots[0];
  }

  _getValidActiveTop({ meeting, topId, label }) {
    if (!topId) throw new Error(`${label} fehlt`);

    const top = this._findTopInMeeting(meeting.id, topId);
    if (!top) {
      throw new Error(`${label} ist nicht mehr Teil der offenen Besprechung`);
    }
    if (String(top.project_id || "") !== String(meeting.project_id || "")) {
      throw new Error(`${label} gehört nicht zum aktuellen Projekt`);
    }
    if (Number(top.is_hidden || 0) === 1) {
      throw new Error(`${label} ist nicht mehr aktiv`);
    }
    return top;
  }

  _getValidParentTop({ meeting, topId, label = "Parent-TOP" }) {
    const parent = this._getValidActiveTop({ meeting, topId, label });
    const level = Number(parent.level || 0);
    if (!Number.isFinite(level) || level < 1) {
      throw new Error(`${label} hat eine ungültige Ebene`);
    }
    if (level >= 4) {
      throw new Error(`${label} liegt zu tief in der Hierarchie und kann kein Kind aufnehmen`);
    }
    return parent;
  }

  _buildApplyTrace({ suggestion, result, usedOverride }) {
    if (result?.mode === "append_to_top") {
      return {
        appliedTargetTopId: result.topId,
        appliedParentTopId: null,
        usedOverride: false,
      };
    }

    if (result?.mode === "create_child_top" || result?.mode === "manual_assign_child_top") {
      return {
        appliedTargetTopId: result.topId,
        appliedParentTopId: result.parentTopId || null,
        usedOverride: !!usedOverride,
      };
    }

    return {
      appliedTargetTopId: suggestion?.target_top_id || null,
      appliedParentTopId: suggestion?.parent_top_id || null,
      usedOverride: !!usedOverride,
    };
  }

  _applyAppendToTop({ meeting, suggestion }) {
    const target = this._getValidActiveTop({
      meeting,
      topId: suggestion.target_top_id,
      label: "Ziel-TOP",
    });

    const meetingTop = this.meetingTopsRepo.getMeetingTop(meeting.id, target.id);
    if (!meetingTop) throw new Error("Ziel-TOP ist nicht mehr Teil der Besprechung");

    const combinedLongtext = this._appendLongtext(meetingTop.longtext, suggestion.text_suggestion);

    const res = this.topService.updateMeetingFields({
      meetingId: meeting.id,
      topId: target.id,
      patch: {
        longtext: combinedLongtext,
      },
    });

    return {
      mode: "append_to_top",
      topId: target.id,
      targetTitle: target.title || "",
      meetingTop: res?.row || res,
    };
  }

  _applyCreateChildTop({ meeting, suggestion, overrideParentTopId = null }) {
    const parentTopId = overrideParentTopId || suggestion.parent_top_id;
    const parent = this._getValidParentTop({
      meeting,
      topId: parentTopId,
      label: overrideParentTopId ? "Override-Parent" : "Parent-TOP",
    });

    const created = this.topService.createTop({
      projectId: meeting.project_id,
      meetingId: meeting.id,
      parentTopId: parent.id,
      level: Number(parent.level) + 1,
      title: _normalizeText(suggestion.title_suggestion) || "(ohne Bezeichnung)",
    });

    const nextLongtext = _normalizeText(suggestion.text_suggestion);
    if (nextLongtext) {
      this.topService.updateMeetingFields({
        meetingId: meeting.id,
        topId: created.id,
        patch: {
          longtext: nextLongtext,
        },
      });
    }

    return {
      mode: "create_child_top",
      topId: created.id,
      parentTopId: parent.id,
      parentTitle: parent.title || "",
    };
  }

  _applyManualAssignChildTop({ meeting, suggestion, overrideParentTopId = null }) {
    const parent = overrideParentTopId
      ? this._getValidParentTop({
          meeting,
          topId: overrideParentTopId,
          label: "Override-Parent",
        })
      : this._ensureManualAssignRoot(meeting);

    if (!parent?.id) throw new Error("Manuell-zuordnen-Parent konnte nicht ermittelt werden");

    const created = this.topService.createTop({
      projectId: meeting.project_id,
      meetingId: meeting.id,
      parentTopId: parent.id,
      level: Number(parent.level) + 1,
      title: _normalizeText(suggestion.title_suggestion) || "(ohne Bezeichnung)",
    });

    const nextLongtext = _normalizeText(suggestion.text_suggestion);
    if (nextLongtext) {
      this.topService.updateMeetingFields({
        meetingId: meeting.id,
        topId: created.id,
        patch: {
          longtext: nextLongtext,
        },
      });
    }

    return {
      mode: "manual_assign_child_top",
      topId: created.id,
      parentTopId: parent.id,
      parentTitle: parent.title || MANUAL_ASSIGN_TITLE,
    };
  }

  applySuggestion({ suggestionId, overrideParentTopId = null }) {
    if (!suggestionId) throw new Error("suggestionId required");

    const normalizedOverrideParentTopId = String(overrideParentTopId || "").trim() || null;
    const suggestion = this._getSuggestionOrThrow(suggestionId);
    _audioLog("start", {
      suggestionId,
      type: suggestion?.type || null,
      overrideParentTopId: normalizedOverrideParentTopId,
    });
    this._assertSuggestionPending(suggestion, "übernommen");

    try {
      const meeting = this._getOpenMeetingOrThrow(suggestion.meeting_id);
      this._assertSuggestionBelongsToMeeting(meeting, suggestion);

      let result = null;
      if (suggestion.type === "append_to_top") {
        result = this._applyAppendToTop({ meeting, suggestion });
      } else if (suggestion.type === "create_child_top") {
        result = this._applyCreateChildTop({
          meeting,
          suggestion,
          overrideParentTopId: normalizedOverrideParentTopId,
        });
      } else if (suggestion.type === "manual_assign_child_top") {
        result = this._applyManualAssignChildTop({
          meeting,
          suggestion,
          overrideParentTopId: normalizedOverrideParentTopId,
        });
      } else {
        throw new Error(`Unbekannter Vorschlagstyp: ${suggestion.type}`);
      }

      const updatedSuggestion = this.audioSuggestionsRepo.markApplied({
        suggestionId,
        ...this._buildApplyTrace({
          suggestion,
          result,
          usedOverride: !!normalizedOverrideParentTopId,
        }),
      });

      _audioLog("completed", {
        suggestionId,
        type: suggestion?.type || null,
        appliedTargetTopId: updatedSuggestion?.applied_target_top_id || null,
        appliedParentTopId: updatedSuggestion?.applied_parent_top_id || null,
        usedOverride: Number(updatedSuggestion?.applied_with_override || 0) === 1,
      });

      return {
        suggestion: updatedSuggestion,
        result,
      };
    } catch (err) {
      const latestSuggestion = this.audioSuggestionsRepo.getById(suggestionId);
      if (latestSuggestion && _normalizeStatus(latestSuggestion.status) === "pending") {
        this.audioSuggestionsRepo.setApplyError({
          suggestionId,
          errorMessage: err?.message || String(err),
        });
      }
      _audioLog("failed", {
        suggestionId,
        type: suggestion?.type || null,
        error: err?.message || String(err),
      });
      throw err;
    }
  }
}

function createSuggestionApplyService(deps) {
  return new SuggestionApplyService(deps);
}

module.exports = {
  MANUAL_ASSIGN_TITLE,
  SuggestionApplyService,
  createSuggestionApplyService,
};
