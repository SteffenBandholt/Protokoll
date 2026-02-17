// src/main/db/meetingsRepo.js
const { initDatabase } = require("./database");
const { randomUUID } = require("crypto");

function getMeetingById(meetingId) {
  const db = initDatabase();
  return db.prepare(`
    SELECT
      id,
      project_id,
      meeting_index,
      title,
      is_closed,
      pdf_show_ampel,
      todo_snapshot_json,
      created_at,
      updated_at
    FROM meetings
    WHERE id = @id
  `).get({ id: meetingId });
}

function listByProject(projectId) {
  const db = initDatabase();
  return db.prepare(`
    SELECT
      id,
      project_id,
      meeting_index,
      title,
      is_closed,
      pdf_show_ampel,
      todo_snapshot_json,
      created_at,
      updated_at
    FROM meetings
    WHERE project_id = @projectId
    ORDER BY meeting_index ASC
  `).all({ projectId });
}

function getOpenMeetingByProject(projectId) {
  const db = initDatabase();
  return db.prepare(`
    SELECT
      id,
      project_id,
      meeting_index,
      title,
      is_closed,
      pdf_show_ampel,
      todo_snapshot_json,
      created_at,
      updated_at
    FROM meetings
    WHERE project_id = @projectId
      AND is_closed = 0
    ORDER BY meeting_index DESC
    LIMIT 1
  `).get({ projectId });
}

function getLastClosedMeetingByProject(projectId) {
  const db = initDatabase();
  return db.prepare(`
    SELECT
      id,
      project_id,
      meeting_index,
      title,
      is_closed,
      pdf_show_ampel,
      todo_snapshot_json,
      created_at,
      updated_at
    FROM meetings
    WHERE project_id = @projectId
      AND is_closed = 1
    ORDER BY meeting_index DESC
    LIMIT 1
  `).get({ projectId });
}

function getNextMeetingIndex(projectId) {
  const db = initDatabase();
  const row = db.prepare(`
    SELECT COALESCE(MAX(meeting_index), 0) + 1 AS next
    FROM meetings
    WHERE project_id = @projectId
  `).get({ projectId });
  return row.next;
}

function createMeeting({ projectId, title }) {
  const db = initDatabase();
  if (!projectId) throw new Error("projectId required");

  const id = randomUUID();
  const meetingIndex = getNextMeetingIndex(projectId);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO meetings (
      id,
      project_id,
      meeting_index,
      title,
      is_closed,
      pdf_show_ampel,
      todo_snapshot_json,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @projectId,
      @meetingIndex,
      @title,
      0,
      NULL,
      NULL,
      @now,
      @now
    )
  `).run({
    id,
    projectId,
    meetingIndex,
    title: title || null,
    now,
  });

  return getMeetingById(id);
}

function closeMeeting(meetingId, { pdfShowAmpel, todoSnapshotJson } = {}) {
  const db = initDatabase();
  if (!meetingId) throw new Error("meetingId required");

  const now = new Date().toISOString();
  const frozenAmpel = pdfShowAmpel === undefined ? null : (pdfShowAmpel ? 1 : 0);
  const snapshotRaw =
    todoSnapshotJson === undefined || todoSnapshotJson === null
      ? null
      : String(todoSnapshotJson);

  const info = db.prepare(`
    UPDATE meetings
    SET is_closed = 1, updated_at = @now, pdf_show_ampel = @pdfShowAmpel, todo_snapshot_json = @todoSnapshotJson
    WHERE id = @id AND is_closed = 0
  `).run({ id: meetingId, now, pdfShowAmpel: frozenAmpel, todoSnapshotJson: snapshotRaw });

  return { changed: info.changes, meeting: getMeetingById(meetingId) };
}

module.exports = {
  getMeetingById,
  listByProject,
  getOpenMeetingByProject,
  getLastClosedMeetingByProject,
  createMeeting,
  closeMeeting,
};
