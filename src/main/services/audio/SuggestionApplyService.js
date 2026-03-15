const defaultTopsRepo = require("../../db/topsRepo");
const defaultMeetingsRepo = require("../../db/meetingsRepo");
const defaultMeetingTopsRepo = require("../../db/meetingTopsRepo");
const { createTopService } = require("../../domain/TopService");

const MANUAL_ASSIGN_TITLE = "Manuell zuordnen";

function _normalizeText(value) {
  return String(value || "").trim();
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

  _appendLongtext(existingLongtext, extraText) {
    const current =
      existingLongtext === null || existingLongtext === undefined
        ? ""
        : String(existingLongtext);
    const addition = _normalizeText(extraText);
    if (!addition) return current;
    return current ? `${current}\n${addition}` : addition;
  }

  _findManualAssignRoot(meetingId) {
    const list = this._listMeetingTops(meetingId);
    const normalizedTitle = MANUAL_ASSIGN_TITLE.toLocaleLowerCase("de-DE");
    return (
      list.find((item) => {
        const title = String(item?.title || "").trim().toLocaleLowerCase("de-DE");
        return Number(item?.level) === 1 && title === normalizedTitle;
      }) || null
    );
  }

  _ensureManualAssignRoot(meeting) {
    const existing = this._findManualAssignRoot(meeting.id);
    if (existing) return existing;

    return this.topService.createTop({
      projectId: meeting.project_id,
      meetingId: meeting.id,
      parentTopId: null,
      level: 1,
      title: MANUAL_ASSIGN_TITLE,
    });
  }

  _applyAppendToTop({ meeting, suggestion }) {
    const targetTopId = suggestion.target_top_id;
    if (!targetTopId) throw new Error("targetTopId fehlt");

    const meetingTop = this.meetingTopsRepo.getMeetingTop(meeting.id, targetTopId);
    if (!meetingTop) throw new Error("Ziel-TOP ist nicht Teil der Besprechung");

    const combinedLongtext = this._appendLongtext(
      meetingTop.longtext,
      suggestion.text_suggestion
    );

    const res = this.topService.updateMeetingFields({
      meetingId: meeting.id,
      topId: targetTopId,
      patch: {
        longtext: combinedLongtext,
      },
    });

    return {
      mode: "append_to_top",
      topId: targetTopId,
      meetingTop: res?.row || res,
    };
  }

  _applyCreateChildTop({ meeting, suggestion, overrideParentTopId = null }) {
    const parentTopId = overrideParentTopId || suggestion.parent_top_id;
    if (!parentTopId) throw new Error("parentTopId fehlt");

    const parent = this._findTopInMeeting(meeting.id, parentTopId);
    if (!parent) throw new Error("Parent-TOP nicht gefunden");

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
    };
  }

  _applyManualAssignChildTop({ meeting, suggestion, overrideParentTopId = null }) {
    const parent =
      (overrideParentTopId && this._findTopInMeeting(meeting.id, overrideParentTopId)) ||
      this._ensureManualAssignRoot(meeting);

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

    const suggestion = this.audioSuggestionsRepo.getById(suggestionId);
    if (!suggestion) throw new Error("Vorschlag nicht gefunden");
    const status = String(suggestion.status || "").trim().toLowerCase();
    if (status === "rejected") {
      throw new Error("Vorschlag wurde bereits verworfen");
    }
    if (status === "applied") {
      throw new Error("Vorschlag wurde bereits übernommen");
    }

    const meeting = this._getOpenMeetingOrThrow(suggestion.meeting_id);

    let result = null;
    if (suggestion.type === "append_to_top") {
      result = this._applyAppendToTop({ meeting, suggestion });
    } else if (suggestion.type === "create_child_top") {
      result = this._applyCreateChildTop({ meeting, suggestion, overrideParentTopId });
    } else if (suggestion.type === "manual_assign_child_top") {
      result = this._applyManualAssignChildTop({ meeting, suggestion, overrideParentTopId });
    } else {
      throw new Error(`Unbekannter Vorschlagstyp: ${suggestion.type}`);
    }

    const updatedSuggestion = this.audioSuggestionsRepo.updateStatus({
      suggestionId,
      status: "applied",
    });

    return {
      suggestion: updatedSuggestion,
      result,
    };
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
