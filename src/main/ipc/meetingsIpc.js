// TECH-CONTRACT (verbindlich): docs/UI-TECH-CONTRACT.md
// CONTRACT-VERSION: 1.0.0
// src/main/ipc/meetingsIpc.js

const { ipcMain } = require("electron");

const meetingsRepo = require("../db/meetingsRepo");
const meetingTopsRepo = require("../db/meetingTopsRepo");
const { createMeetingService } = require("../domain/MeetingService");

function registerMeetingsIpc() {
  const meetingService = createMeetingService({ meetingsRepo, meetingTopsRepo });

  ipcMain.handle("meetings:listByProject", (_e, projectId) => {
    try {
      const list = meetingsRepo.listByProject(projectId);
      return { ok: true, list };
    } catch (err) {
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  ipcMain.handle("meetings:create", (_e, data) => {
    try {
      const meeting = meetingService.createMeeting({
        projectId: data?.projectId,
        title: data?.title,
      });
      return { ok: true, meeting };
    } catch (err) {
      console.error("[meetings:create] failed", {
        projectId: data?.projectId ?? null,
        title: data?.title ?? null,
        error: err?.stack || err?.message || String(err),
      });
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  // akzeptiert:
  // - invoke("meetings:close", "<id>")
  // - invoke("meetings:close", { meetingId: "<id>" })
  ipcMain.handle("meetings:close", (_e, payload) => {
    try {
      const res = meetingService.closeMeeting(payload);
      if (res && res.ok === false) return res;
      return { ok: true, ...res };
    } catch (err) {
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  ipcMain.handle("meetings:updateTitle", (_e, payload) => {
    try {
      const meetingId = String(payload?.meetingId || payload?.id || "").trim();
      const title = String(payload?.title || "").trim();
      if (!meetingId) return { ok: false, error: "meetingId fehlt" };
      const result = meetingsRepo.updateMeetingTitle({ meetingId, title });
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  ipcMain.handle("meetings:listProjectTasks", (_e, payload) => {
    try {
      const d = payload && typeof payload === "object" ? payload : { projectId: payload };
      const projectId = d.projectId ?? d.project_id ?? d.id ?? null;
      if (!projectId) return { ok: false, error: "projectId fehlt" };
      const statusFilter = d.statusFilter ?? d.status ?? null;
      const list = meetingService.listProjectTasks(projectId, statusFilter);
      return { ok: true, list };
    } catch (err) {
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  console.log("[main] meetings IPC registered");
}

module.exports = { registerMeetingsIpc };
