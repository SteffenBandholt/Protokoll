// src/main/domain/AmpelService.js
//
// Domain-Service für Ampellogik von TOPs
// Fachliche Quelle:
// - MASTERPROMPT_Ampellogik_TOPs (final, angepasst gemäß deiner letzten Vorgabe)
//
// Aufgabe:
// - aus einem TOP (und optional seinen Kindern)
//   eine Ampelfarbe bestimmen
//
// KEINE DB-Zugriffe
// KEINE Statusänderungen
// KEINE UI-Logik

const DAY_MS = 24 * 60 * 60 * 1000;

function toLocalDateOnly(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function parseYmdToLocalDateOnly(ymd) {
  if (!ymd) return null;
  const s = String(ymd).slice(0, 10); // "YYYY-MM-DD"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const dt = new Date(y, mo, da, 0, 0, 0, 0);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

class AmpelService {
  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------

  /**
   * Berechnet die Ampel eines einzelnen TOPs
   *
   * Regeln (gemäß deinem letzten Stand):
   * - blockiert -> blau (übersteuert alles)
   * - verzug -> rot
   * - erledigt -> gruen
   * - offen + kein due_date -> null (keine Ampel)
   * - offen + due_date:
   *    - heute >= due_date -> rot
   *    - 1..10 Tage Rest -> orange
   *    - > 10 Tage Rest -> gruen
   * - in arbeit + due_date: gleiche Datumslogik (rot/orange/gruen)
   * - in arbeit + kein due_date -> null
   *
   * @param {{
   *   status: string,
   *   due_date: string | null
   * }} top
   *
   * @param {Date} [now]
   *
   * @returns {{ color: 'gruen'|'orange'|'rot'|'blau'|null, reason: string }}
   */
  evaluateTop(top, now = new Date()) {
    if (!top || typeof top !== "object") {
      throw new Error("AmpelService.evaluateTop: top required");
    }

    const status = String(top.status || "").trim().toLowerCase();
    const dueDate = parseYmdToLocalDateOnly(top.due_date);
    const today = toLocalDateOnly(now) || toLocalDateOnly(new Date());

    // 1) Blockiert -> Blau
    if (status === "blockiert") {
      return { color: "blau", reason: "TOP ist blockiert" };
    }

    // 2) Verzug -> Rot
    if (status === "verzug") {
      return { color: "rot", reason: "Status ist Verzug" };
    }

    // 3) Erledigt -> Grün
    if (status === "erledigt") {
      return { color: "gruen", reason: "TOP ist erledigt" };
    }

    // 4) Datumslogik nur für offen / in arbeit (gemäß deinem Stand)
    const isDateRelevant = status === "offen" || status === "in arbeit";
    if (!isDateRelevant) {
      return { color: null, reason: "Status ohne Ampellogik" };
    }

    // 5) Kein Fertig-bis -> keine Ampel
    if (!dueDate) {
      return { color: null, reason: "Kein Fertig-bis-Datum" };
    }

    // diffDays: Resttage ab HEUTE (0 = heute)
    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / DAY_MS);

    // 6) Heute >= due_date -> Rot
    if (diffDays <= 0) {
      return { color: "rot", reason: "Termin erreicht oder überschritten" };
    }

    // 7) 1..10 Tage -> Orange
    if (diffDays <= 10) {
      return { color: "orange", reason: "Termin innerhalb von 10 Tagen" };
    }

    // 8) > 10 Tage -> Grün (WICHTIG: nicht null)
    return { color: "gruen", reason: "Mehr als 10 Tage Rest" };
  }

  /**
   * Berechnet die Ampel eines Eltern-TOPs
   * → kritischste Ampel der Kinder (nur visuell)
   *
   * Priorität:
   * blau > rot > orange > gruen > null
   *
   * @param {Array<{ color: string|null }>} childAmpels
   */
  aggregateChildren(childAmpels) {
    if (!Array.isArray(childAmpels) || childAmpels.length === 0) {
      return { color: null, reason: "Keine Kinder" };
    }

    const priority = ["blau", "rot", "orange", "gruen"];

    for (const p of priority) {
      if (childAmpels.some((a) => a && a.color === p)) {
        return { color: p, reason: `Kritischster Status aus Kindern: ${p}` };
      }
    }

    return { color: null, reason: "Keine kritischen Kinder" };
  }
}

/**
 * Factory
 */
function createAmpelService() {
  return new AmpelService();
}

module.exports = {
  AmpelService,
  createAmpelService,
};
