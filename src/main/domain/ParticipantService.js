// src/main/domain/ParticipantService.js
//
// Domain-Service für Teilnehmer
// Fachliche Quelle:
// - MASTERPROMPT_Teilnehmer
// - MASTERPROMPT_Verantwortung
//
// Regeln:
// - Stammliste ist Quelle der Personen/Firmen
// - Projekt- & Besprechungsteilnehmer sind Ableitungen
// - Keine physischen Deletes
// - Geschlossene Besprechungen sind read-only

class ParticipantService {
  constructor(deps) {
    const {
      participantsRepo,
      projectParticipantsRepo,
      meetingParticipantsRepo,
      meetingsRepo,
    } = deps || {};

    if (!participantsRepo) throw new Error("participantsRepo fehlt");
    if (!projectParticipantsRepo) throw new Error("projectParticipantsRepo fehlt");
    if (!meetingParticipantsRepo) throw new Error("meetingParticipantsRepo fehlt");
    if (!meetingsRepo) throw new Error("meetingsRepo fehlt");

    this.participantsRepo = participantsRepo;
    this.projectParticipantsRepo = projectParticipantsRepo;
    this.meetingParticipantsRepo = meetingParticipantsRepo;
    this.meetingsRepo = meetingsRepo;
  }

  // --------------------------------------------------
  // Stammliste (global)
  // --------------------------------------------------

  listMasterParticipants({ includeArchived = false } = {}) {
    return this.participantsRepo.listParticipants({ includeArchived });
  }

  saveMasterParticipant(data) {
    // name Pflicht, alles andere optional
    return this.participantsRepo.saveParticipant(data);
  }

  archiveMasterParticipant(participantId) {
    // Soft-Delete: überall nur ausblenden
    return this.participantsRepo.archiveParticipant(participantId);
  }

  unarchiveMasterParticipant(participantId) {
    return this.participantsRepo.unarchiveParticipant(participantId);
  }

  // --------------------------------------------------
  // Projekt-Teilnehmer
  // --------------------------------------------------

  listProjectParticipants(projectId) {
    this._assertId(projectId, "projectId");
    return this.projectParticipantsRepo.getPicklist(projectId);
  }

  setProjectMembership(projectId, participantId, patch) {
    this._assertId(projectId, "projectId");
    this._assertId(participantId, "participantId");

    return this.projectParticipantsRepo.setMembership(
      projectId,
      participantId,
      patch
    );
  }

  // --------------------------------------------------
  // Besprechungs-Teilnehmer
  // --------------------------------------------------

  listMeetingParticipants(meetingId) {
    this._assertId(meetingId, "meetingId");
    return this.meetingParticipantsRepo.listMeetingParticipants(meetingId);
  }

  setMeetingParticipant(meetingId, participantId, data) {
    this._assertId(meetingId, "meetingId");
    this._assertId(participantId, "participantId");

    const meeting = this.meetingsRepo.getMeetingById
      ? this.meetingsRepo.getMeetingById(meetingId)
      : null;

    if (!meeting) {
      throw new Error("Besprechung nicht gefunden");
    }

    if (meeting.is_closed) {
      throw new Error(
        "Besprechung ist geschlossen – Teilnehmer sind schreibgeschützt"
      );
    }

    return this.meetingParticipantsRepo.setMeetingParticipant(
      meetingId,
      participantId,
      data
    );
  }

  // --------------------------------------------------
  // Ableitungslogik (fachlich wichtig)
  // --------------------------------------------------

  /**
   * Wird beim Anlegen einer neuen Besprechung aufgerufen.
   * Reihenfolge:
   * 1. Vorherige Besprechung
   * 2. Fallback: Projektteilnehmer
   */
  seedParticipantsForNewMeeting(meetingId, projectId) {
    this._assertId(meetingId, "meetingId");
    this._assertId(projectId, "projectId");

    const seeded =
      this.meetingParticipantsRepo.seedMeetingParticipantsFromPreviousMeeting(
        meetingId,
        projectId
      );

    if (!seeded) {
      this.meetingParticipantsRepo.seedMeetingParticipantsFromProject(
        meetingId,
        projectId
      );
    }
  }

  // --------------------------------------------------
  // Intern
  // --------------------------------------------------

  _assertId(value, name) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`${name} fehlt`);
    }
  }
}

/**
 * Factory-Funktion (empfohlen für Tests & saubere DI)
 */
function createParticipantService(deps) {
  return new ParticipantService(deps);
}

module.exports = {
  ParticipantService,
  createParticipantService,
};
