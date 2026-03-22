// src/main/ipc/participantsIpc.js
const { ipcMain } = require("electron");
const { initDatabase } = require("../db/database");

function normalizeKind(kind) {
  if (kind === "project_person" || kind === "global_person") return kind;
  return null;
}

function keyOf(kind, personId) {
  return `${kind}::${String(personId)}`;
}

function normalizeActive(value, fallback = 1) {
  if (value === undefined || value === null || value === "") return Number(fallback) ? 1 : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  const n = Number(value);
  if (Number.isFinite(n)) return n === 0 ? 0 : 1;
  const s = String(value).trim().toLowerCase();
  if (["0", "false", "off", "nein", "inactive"].includes(s)) return 0;
  if (["1", "true", "on", "ja", "active"].includes(s)) return 1;
  return Number(fallback) ? 1 : 0;
}

function removePersonFromOpenMeetings(dbConn, { projectId, kind, personId }) {
  if (!projectId || !kind || !personId) return 0;
  const info = dbConn
    .prepare(
      `
      DELETE FROM meeting_participants
      WHERE kind = ?
        AND person_id = ?
        AND meeting_id IN (
          SELECT id
          FROM meetings
          WHERE project_id = ?
            AND is_closed = 0
        )
    `
    )
    .run(kind, String(personId), projectId);
  return Number(info?.changes || 0);
}

function _participantsInitKey(meetingId) {
  return `meetingParticipants.initialized.${String(meetingId || "").trim()}`;
}

function _isParticipantsInitialized(dbConn, meetingId) {
  const key = _participantsInitKey(meetingId);
  const row = dbConn.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key);
  if (!row) return false;
  const s = String(row.value ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function _markParticipantsInitialized(dbConn, meetingId) {
  const key = _participantsInitKey(meetingId);
  const now = new Date().toISOString();
  dbConn
    .prepare(
      `
      INSERT INTO app_settings (key, value, created_at, updated_at)
      VALUES (?, '1', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value='1', updated_at=excluded.updated_at
    `
    )
    .run(key, now, now);
}

/**
 * Default-Übernahme aus letzter geschlossener Besprechung:
 * - Wird absichtlich serverseitig „lazy“ beim ersten meetingParticipants:list gemacht,
 *   falls für das Meeting noch keine Teilnehmer existieren.
 */
function ensureMeetingParticipantsDefaults(dbConn, meetingId) {
  const meeting = dbConn
    .prepare(`SELECT id, project_id, is_closed FROM meetings WHERE id = ?`)
    .get(meetingId);

  if (!meeting) {
    return { ok: false, error: "Besprechung nicht gefunden." };
  }

  if (Number(meeting.is_closed) === 1) {
    // Geschlossene Besprechung: keine Default-Initialisierung
    return { ok: true, meeting };
  }

  const cnt = dbConn
    .prepare(`SELECT COUNT(*) AS cnt FROM meeting_participants WHERE meeting_id = ?`)
    .get(meetingId)?.cnt;

  if (Number(cnt) > 0) {
    return { ok: true, meeting };
  }

  if (_isParticipantsInitialized(dbConn, meetingId)) {
    return { ok: true, meeting };
  }

  const lastClosed = dbConn
    .prepare(
      `
      SELECT id
      FROM meetings
      WHERE project_id = ? AND is_closed = 1
      ORDER BY meeting_index DESC
      LIMIT 1
    `
    )
    .get(meeting.project_id);

  if (!lastClosed?.id) {
    // keine geschlossene Besprechung vorhanden -> initial leer
    return { ok: true, meeting };
  }

  const insertFrom = dbConn.prepare(`
    INSERT INTO meeting_participants (
      meeting_id, kind, person_id, is_present, is_in_distribution, created_at, updated_at
    )
    SELECT
      ? AS meeting_id,
      kind,
      person_id,
      is_present,
      is_in_distribution,
      (strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS created_at,
      (strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS updated_at
    FROM meeting_participants
    WHERE meeting_id = ?
  `);

  const tx = dbConn.transaction(() => {
    // falls doch irgendwas drin ist (Race), vorher sauber löschen
    dbConn.prepare(`DELETE FROM meeting_participants WHERE meeting_id = ?`).run(meetingId);
    insertFrom.run(meetingId, lastClosed.id);
  });

  tx();
  _markParticipantsInitialized(dbConn, meetingId);

  return { ok: true, meeting };
}

function listProjectCandidatesEnriched(dbConn, projectId) {
  return dbConn
    .prepare(
      `
      SELECT
        pc.kind AS kind,
        pc.person_id AS personId,
        COALESCE(pc.is_active, 1) AS is_active,

        CASE
          WHEN pc.kind = 'project_person' THEN COALESCE(pp.name, '')
          ELSE COALESCE(p.name, '')
        END AS name,

        CASE
          WHEN pc.kind = 'project_person' THEN COALESCE(pp.rolle, pp.funktion, '')
          ELSE COALESCE(p.rolle, p.funktion, '')
        END AS rolle,

        CASE
          WHEN pc.kind = 'project_person' THEN COALESCE(pf.short, pf.name, '')
          ELSE COALESCE(f.short, f.name, '')
        END AS firm,

        CASE
          WHEN EXISTS (
            SELECT 1
            FROM meetings m
            INNER JOIN meeting_participants mp ON mp.meeting_id = m.id
            WHERE m.project_id = pc.project_id
              AND m.is_closed = 0
              AND mp.kind = pc.kind
              AND mp.person_id = pc.person_id
          ) THEN 1
          ELSE 0
        END AS isRemovalBlocked

      FROM project_candidates pc
      LEFT JOIN project_persons pp
        ON pc.kind = 'project_person' AND pp.id = pc.person_id
      LEFT JOIN project_firms pf
        ON pp.project_firm_id = pf.id
      LEFT JOIN persons p
        ON pc.kind = 'global_person' AND p.id = pc.person_id
      LEFT JOIN firms f
        ON p.firm_id = f.id

      WHERE pc.project_id = ?

      ORDER BY firm COLLATE NOCASE, name COLLATE NOCASE
    `
    )
    .all(projectId);
}

function listMeetingParticipantsEnriched(dbConn, meetingId) {
  return dbConn
    .prepare(
      `
      SELECT
        mp.kind AS kind,
        mp.person_id AS personId,
        mp.is_present AS isPresent,
        mp.is_in_distribution AS isInDistribution,

        CASE
          WHEN mp.kind = 'project_person' THEN COALESCE(pp.name, '')
          ELSE COALESCE(p.name, '')
        END AS name_raw,

        CASE
          WHEN mp.kind = 'project_person' THEN COALESCE(pp.rolle, pp.funktion, '')
          ELSE COALESCE(p.rolle, p.funktion, '')
        END AS rolle_raw,

        CASE
          WHEN mp.kind = 'project_person' THEN COALESCE(pp.funktion, '')
          ELSE COALESCE(p.phone, '')
        END AS funk_raw,

        CASE
          WHEN mp.kind = 'project_person' THEN COALESCE(pp.email, '')
          ELSE COALESCE(p.email, '')
        END AS email_raw,

        CASE
          WHEN mp.kind = 'project_person' THEN COALESCE(pf.short, pf.name, '')
          ELSE COALESCE(f.short, f.name, '')
        END AS firm_raw,

        COALESCE(
          CASE
            WHEN mp.kind = 'project_person' THEN COALESCE(pp.name, '')
            ELSE COALESCE(p.name, '')
          END,
          mp.person_id,
          ''
        ) AS name,

        COALESCE(
          CASE
            WHEN mp.kind = 'project_person' THEN COALESCE(pp.rolle, pp.funktion, '')
            ELSE COALESCE(p.rolle, p.funktion, '')
          END,
          ''
        ) AS rolle,

        COALESCE(
          CASE
            WHEN mp.kind = 'project_person' THEN COALESCE(pp.funktion, '')
            ELSE COALESCE(p.phone, '')
          END,
          ''
        ) AS funk,

        COALESCE(
          CASE
            WHEN mp.kind = 'project_person' THEN COALESCE(pp.email, '')
            ELSE COALESCE(p.email, '')
          END,
          ''
        ) AS email,

        COALESCE(
          CASE
            WHEN mp.kind = 'project_person' THEN COALESCE(pf.short, pf.name, '')
            ELSE COALESCE(f.short, f.name, '')
          END,
          '[entfernt]'
        ) AS firm

      FROM meeting_participants mp
      LEFT JOIN meetings m
        ON m.id = mp.meeting_id
      LEFT JOIN project_persons pp
        ON mp.kind = 'project_person' AND pp.id = mp.person_id
      LEFT JOIN project_firms pf
        ON pp.project_firm_id = pf.id
      LEFT JOIN persons p
        ON mp.kind = 'global_person' AND p.id = mp.person_id
      LEFT JOIN firms f
        ON p.firm_id = f.id

      WHERE mp.meeting_id = ?

      ORDER BY firm COLLATE NOCASE, name COLLATE NOCASE
    `
    )
    .all(meetingId);
}

function listProjectParticipantsPool(dbConn, projectId) {
  // Pool ist nur UI-Basis (nicht persistiert) -> filtert Soft-Deletes weg
  return dbConn
    .prepare(
      `
      SELECT
        'project_person' AS kind,
        pp.id AS personId,
        pp.name AS name,
        COALESCE(pp.email, '') AS email,
        COALESCE(pp.rolle, pp.funktion, '') AS rolle,
        COALESCE(pf.short, pf.name, '') AS firm,
        pp.project_firm_id AS firmId,
        COALESCE(pf.is_active, 1) AS firm_is_active,
        COALESCE(pc.is_active, 1) AS is_active
      FROM project_persons pp
      INNER JOIN project_firms pf ON pf.id = pp.project_firm_id
      LEFT JOIN project_candidates pc
        ON pc.project_id = pf.project_id
       AND pc.kind = 'project_person'
       AND pc.person_id = pp.id
      WHERE pf.project_id = ?
        AND pf.removed_at IS NULL
        AND pp.removed_at IS NULL

      UNION ALL

      SELECT
        'global_person' AS kind,
        p.id AS personId,
        p.name AS name,
        COALESCE(p.email, '') AS email,
        COALESCE(p.rolle, p.funktion, '') AS rolle,
        COALESCE(f.short, f.name, '') AS firm,
        f.id AS firmId,
        COALESCE(pgf.is_active, 1) AS firm_is_active,
        COALESCE(pc.is_active, 1) AS is_active
      FROM project_global_firms pgf
      INNER JOIN firms f ON f.id = pgf.firm_id
      INNER JOIN persons p ON p.firm_id = f.id
      LEFT JOIN project_candidates pc
        ON pc.project_id = pgf.project_id
       AND pc.kind = 'global_person'
       AND pc.person_id = p.id
      WHERE pgf.project_id = ?
        AND pgf.removed_at IS NULL
        AND f.removed_at IS NULL
        AND p.removed_at IS NULL

      ORDER BY firm COLLATE NOCASE, name COLLATE NOCASE
    `
    )
    .all(projectId, projectId);
}

function registerParticipantsIpc() {
  // ============================================================
  // Pool / Lookup
  // ============================================================
  ipcMain.handle("projectParticipants:pool", (event, data) => {
    try {
      const projectId = data?.projectId;
      if (!projectId) return { ok: false, error: "projectId fehlt." };

      const db = initDatabase();
      const items = listProjectParticipantsPool(db, projectId);
      return { ok: true, items };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // ============================================================
  // Kandidaten (Projekt)
  // ============================================================
  ipcMain.handle("projectCandidates:list", (event, data) => {
    try {
      const projectId = data?.projectId;
      if (!projectId) return { ok: false, error: "projectId fehlt." };

      const db = initDatabase();
      const items = listProjectCandidatesEnriched(db, projectId);
      return { ok: true, items };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("projectCandidates:set", (event, data) => {
    try {
      const projectId = data?.projectId;
      const rawItems = Array.isArray(data?.items) ? data.items : null;
      if (!projectId) return { ok: false, error: "projectId fehlt." };
      if (!rawItems) return { ok: false, error: "items fehlt." };

      const db = initDatabase();

      // normalisieren + deduplizieren
      const normalized = [];
      const seen = new Set();
      for (const it of rawItems) {
        const kind = normalizeKind(it?.kind);
        const personId = it?.personId ?? it?.person_id; // tolerant
        if (!kind || !personId) continue;
        const k = keyOf(kind, personId);
        if (seen.has(k)) continue;
        seen.add(k);
        normalized.push({
          kind,
          personId: String(personId),
          isActive: normalizeActive(it?.isActive ?? it?.is_active, 1),
        });
      }

      const existing = db
        .prepare(`
          SELECT
            kind,
            person_id AS personId,
            COALESCE(is_active, 1) AS is_active
          FROM project_candidates
          WHERE project_id = ?
        `)
        .all(projectId);
      const existingActiveByKey = new Map(
        existing.map((x) => [keyOf(x.kind, x.personId), normalizeActive(x?.is_active, 1)])
      );

      const newKeys = new Set(normalized.map((x) => keyOf(x.kind, x.personId)));
      const removed = existing.filter((x) => !newKeys.has(keyOf(x.kind, x.personId)));

      // KRITISCHE REGEL: Entfernen blockiert, wenn Person Teilnehmer in irgendeiner offenen Besprechung ist.
      const checkOpen = db.prepare(
        `
        SELECT m.id, m.meeting_index
        FROM meetings m
        INNER JOIN meeting_participants mp ON mp.meeting_id = m.id
        WHERE m.project_id = ?
          AND m.is_closed = 0
          AND mp.kind = ?
          AND mp.person_id = ?
        LIMIT 1
      `
      );

      for (const r of removed) {
        const hit = checkOpen.get(projectId, r.kind, r.personId);
        if (hit) {
          return {
            ok: false,
            error:
              `Entfernen blockiert: Person ist Teilnehmer in einer offenen Besprechung (Index ${hit.meeting_index}).`,
          };
        }
      }

      const delAll = db.prepare(`DELETE FROM project_candidates WHERE project_id = ?`);
      const ins = db.prepare(
        `
        INSERT INTO project_candidates (
          project_id, kind, person_id, is_active, created_at, updated_at
        )
        VALUES (
          ?, ?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ','now')), (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )
      `
      );

      const tx = db.transaction(() => {
        delAll.run(projectId);
        for (const it of normalized) {
          const nextIsActive = normalizeActive(it?.isActive, 1);
          ins.run(projectId, it.kind, it.personId, nextIsActive);
        }
      });

      tx();

      // Bei Deaktivierung: aus allen offenen Besprechungen dieses Projekts entfernen.
      for (const it of normalized) {
        const key = keyOf(it.kind, it.personId);
        const prev = existingActiveByKey.has(key) ? existingActiveByKey.get(key) : 1;
        const next = normalizeActive(it?.isActive, 1);
        if (prev === 1 && next === 0) {
          removePersonFromOpenMeetings(db, {
            projectId,
            kind: it.kind,
            personId: it.personId,
          });
        }
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("projectCandidates:setActive", (event, data) => {
    try {
      const projectId = data?.projectId;
      const kind = normalizeKind(data?.kind);
      const personId = data?.personId ?? data?.person_id;
      const isActive = normalizeActive(data?.isActive ?? data?.is_active, 1);

      if (!projectId) return { ok: false, error: "projectId fehlt." };
      if (!kind) return { ok: false, error: "kind fehlt/ungueltig." };
      if (!personId) return { ok: false, error: "personId fehlt." };

      const db = initDatabase();
      const now = new Date().toISOString();
      const pid = String(personId);
      let info = null;

      const tx = db.transaction(() => {
        info = db
          .prepare(
            `
            UPDATE project_candidates
            SET is_active = ?, updated_at = ?
            WHERE project_id = ?
              AND kind = ?
              AND person_id = ?
          `
          )
          .run(isActive, now, projectId, kind, pid);

        if (Number(info?.changes || 0) > 0) return;

        db
          .prepare(
            `
            INSERT INTO project_candidates (
              project_id, kind, person_id, is_active, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `
          )
          .run(projectId, kind, pid, isActive, now, now);

        info = { changes: 1 };
      });

      tx();

      if (isActive === 0) {
        removePersonFromOpenMeetings(db, {
          projectId,
          kind,
          personId: pid,
        });
      }

      return {
        ok: true,
        result: {
          changed: Number(info?.changes || 0),
          projectId,
          kind,
          personId: pid,
          is_active: isActive,
        },
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  // ============================================================
  // Teilnehmer (Meeting)
  // ============================================================
  ipcMain.handle("meetingParticipants:list", (event, data) => {
    try {
      const meetingId = data?.meetingId;
      if (!meetingId) return { ok: false, error: "meetingId fehlt." };

      const db = initDatabase();

      // Default-Übernahme (lazy) für neue offene Meetings, wenn noch leer
      const ensure = ensureMeetingParticipantsDefaults(db, meetingId);
      if (!ensure.ok) return ensure;

      const meeting = ensure.meeting;
      const items = listMeetingParticipantsEnriched(db, meetingId);

      return { ok: true, items, isClosed: Number(meeting.is_closed) === 1 };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("meetingParticipants:set", (event, data) => {
    try {
      const meetingId = data?.meetingId;
      const rawItems = Array.isArray(data?.items) ? data.items : null;
      if (!meetingId) return { ok: false, error: "meetingId fehlt." };
      if (!rawItems) return { ok: false, error: "items fehlt." };

      const db = initDatabase();

      const meeting = db
        .prepare(`SELECT id, is_closed FROM meetings WHERE id = ?`)
        .get(meetingId);

      if (!meeting) return { ok: false, error: "Besprechung nicht gefunden." };
      if (Number(meeting.is_closed) === 1) {
        return { ok: false, error: "Besprechung ist geschlossen (read-only)." };
      }

      // normalisieren + deduplizieren
      const normalized = [];
      const seen = new Set();
      for (const it of rawItems) {
        const kind = normalizeKind(it?.kind);
        const personId = it?.personId ?? it?.person_id;
        if (!kind || !personId) continue;

        const k = keyOf(kind, personId);
        if (seen.has(k)) continue;
        seen.add(k);

        const isPresent = it?.isPresent ?? it?.is_present ?? 0;
        const isInDistribution = it?.isInDistribution ?? it?.is_in_distribution ?? 0;

        normalized.push({
          kind,
          personId: String(personId),
          isPresent: Number(!!isPresent),
          isInDistribution: Number(!!isInDistribution),
        });
      }

      const delAll = db.prepare(`DELETE FROM meeting_participants WHERE meeting_id = ?`);
      const ins = db.prepare(
        `
        INSERT INTO meeting_participants (
          meeting_id, kind, person_id, is_present, is_in_distribution, created_at, updated_at
        )
        VALUES (
          ?, ?, ?, ?, ?,
          (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )
      `
      );

      const tx = db.transaction(() => {
        delAll.run(meetingId);
        for (const it of normalized) {
          ins.run(meetingId, it.kind, it.personId, it.isPresent, it.isInDistribution);
        }
      });

      tx();
      // Expliziter Save (auch "leere Auswahl") gilt als initialisiert,
      // damit beim nächsten Laden keine Default-Übernahme mehr darüberläuft.
      _markParticipantsInitialized(db, meetingId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
}

module.exports = { registerParticipantsIpc };
