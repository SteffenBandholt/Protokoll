// src/main/domain/ResponsibilityService.js
//
// Domain-Service für TOP-Verantwortlichkeiten
// Fachliche Quelle:
// - MASTERPROMPT_Verantwortung
// - MASTERPROMPT_Teilnehmer
// - MASTERPROMPT_TOPs
//
// Aufgabe dieses Services:
// - fachlich prüfen, OB und WER als verantwortlich gesetzt werden darf
// - KEINE Datenbanklogik
// - KEINE UI-Logik
// - KEINE Ampel-Logik
//
// DB bleibt Quelle der Wahrheit, Service entscheidet über ERLAUBNISSE

class ResponsibilityService {
  /**
   * @param {{
   *   topsRepo: {
   *     getTopById: Function
   *   },
   *   meetingsRepo: {
   *     getMeetingById: Function
   *   },
   *   participantsRepo: {
   *     getCompanyById?: Function
   *   }
   * }} deps
   */
  constructor(deps) {
    if (!deps || typeof deps !== "object") {
      throw new Error("ResponsibilityService: deps required");
    }

    const { topsRepo, meetingsRepo } = deps;

    if (!topsRepo || typeof topsRepo.getTopById !== "function") {
      throw new Error("ResponsibilityService: topsRepo.getTopById required");
    }

    if (!meetingsRepo || typeof meetingsRepo.getMeetingById !== "function") {
      throw new Error("ResponsibilityService: meetingsRepo.getMeetingById required");
    }

    this.topsRepo = topsRepo;
    this.meetingsRepo = meetingsRepo;
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------

  /**
   * Setzt oder ändert die verantwortliche Firma eines TOPs.
   *
   * Fachliche Regeln:
   * - Nur in offener Besprechung erlaubt
   * - Alte TOPs: Verantwortlichkeit DARF geändert werden
   * - Neue TOPs: Verantwortlichkeit frei wählbar
   * - Verantwortlich ist IMMER eine Firma (nicht Person)
   * - Anwesenheit der Firma in der Besprechung ist NICHT erforderlich
   *
   * @param {{
   *   topId: string,
   *   companyId: string | null
   * }} input
   */
  setResponsibility(input) {
    if (!input || typeof input !== "object") {
      throw new Error("ResponsibilityService.setResponsibility: input required");
    }

    const { topId, companyId } = input;

    this._assertNonEmptyString("topId", topId);

    // companyId darf NULL sein (Verantwortung entfernen)
    if (companyId !== null) {
      this._assertNonEmptyString("companyId", companyId);
    }

    const top = this.topsRepo.getTopById(topId);
    if (!top) {
      throw new Error("TOP nicht gefunden");
    }

    const meeting = this.meetingsRepo.getMeetingById(top.meeting_id);
    if (!meeting) {
      throw new Error("Besprechung nicht gefunden");
    }

    if (meeting.is_closed) {
      throw new Error(
        "Besprechung ist geschlossen – Verantwortlichkeit ist schreibgeschützt"
      );
    }

    // ❗ Keine weitere fachliche Einschränkung:
    // - Firma muss nicht anwesend sein
    // - Firma kann auch deaktiviert sein
    // - Verantwortung ≠ Teilnahme

    return {
      ok: true,
      responsibility: {
        topId,
        companyId
      }
    };
  }

  // ------------------------------------------------------------
  // Hilfsfunktionen
  // ------------------------------------------------------------

  _assertNonEmptyString(field, value) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`ResponsibilityService: ${field} required`);
    }
  }
}

/**
 * Factory-Funktion (empfohlen für Tests & saubere Abhängigkeiten)
 */
function createResponsibilityService(deps) {
  return new ResponsibilityService(deps);
}

module.exports = {
  ResponsibilityService,
  createResponsibilityService
};
