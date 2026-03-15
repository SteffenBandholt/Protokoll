const { BrowserWindow, dialog, ipcMain } = require("electron");

const meetingsRepo = require("../db/meetingsRepo");
const meetingTopsRepo = require("../db/meetingTopsRepo");
const audioImportsRepo = require("../db/audioImportsRepo");
const transcriptsRepo = require("../db/transcriptsRepo");
const audioSuggestionsRepo = require("../db/audioSuggestionsRepo");
const { createAudioImportService } = require("../services/audio/AudioImportService");
const { createTranscriptionService } = require("../services/audio/TranscriptionService");
const {
  createTranscriptSegmentationService,
} = require("../services/audio/TranscriptSegmentationService");
const { createMeetingMappingService } = require("../services/audio/MeetingMappingService");
const { createSuggestionApplyService } = require("../services/audio/SuggestionApplyService");
const { createWhisperCppEngine } = require("../services/audio/engines/WhisperCppEngine");

const AUDIO_FILE_FILTER = [
  {
    name: "Audio",
    extensions: ["mp3", "wav", "m4a", "aac", "ogg", "flac", "wma"],
  },
];

function registerAudioIpc() {
  const transcriptionEngine = createWhisperCppEngine();
  const audioImportService = createAudioImportService({ meetingsRepo, audioImportsRepo });
  const transcriptionService = createTranscriptionService({
    meetingsRepo,
    audioImportsRepo,
    transcriptsRepo,
    engine: transcriptionEngine,
  });
  const segmentationService = createTranscriptSegmentationService();
  const mappingService = createMeetingMappingService({
    meetingsRepo,
    meetingTopsRepo,
    audioImportsRepo,
    transcriptsRepo,
    audioSuggestionsRepo,
    segmentationService,
  });
  const suggestionApplyService = createSuggestionApplyService({
    audioSuggestionsRepo,
  });

  ipcMain.handle("audio:import", async (evt, payload) => {
    try {
      const data = payload && typeof payload === "object" ? payload : {};
      const meetingId = String(data.meetingId || "").trim();
      if (!meetingId) return { ok: false, error: "meetingId fehlt" };

      let filePath = String(data.filePath || "").trim();
      if (!filePath) {
        const win = BrowserWindow.fromWebContents(evt.sender);
        const res = await dialog.showOpenDialog(win || null, {
          properties: ["openFile"],
          filters: AUDIO_FILE_FILTER,
          title: "Sprachdatei auswählen",
        });
        if (res.canceled || !Array.isArray(res.filePaths) || !res.filePaths[0]) {
          return { ok: true, canceled: true };
        }
        filePath = String(res.filePaths[0] || "").trim();
      }

      const audioImport = audioImportService.importAudio({
        meetingId,
        projectId: data.projectId || null,
        filePath,
        processingMode: data.processingMode || "review",
      });

      return { ok: true, audioImport };
    } catch (err) {
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  ipcMain.handle("audio:transcribe", async (_evt, payload) => {
    try {
      const audioImportId = String(payload?.audioImportId || "").trim();
      if (!audioImportId) return { ok: false, error: "audioImportId fehlt" };
      const result = await transcriptionService.transcribe({ audioImportId });
      return { ok: true, ...result };
    } catch (err) {
      if (payload?.audioImportId) {
        try {
          audioImportsRepo.updateStatus({
            audioImportId: payload.audioImportId,
            status: "failed",
            errorMessage: err?.message || String(err),
          });
        } catch (_ignore) {
          // ignore follow-up errors
        }
      }
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  ipcMain.handle("audio:analyze", async (_evt, payload) => {
    try {
      const audioImportId = String(payload?.audioImportId || "").trim();
      if (!audioImportId) return { ok: false, error: "audioImportId fehlt" };
      const result = mappingService.analyze({
        audioImportId,
        processingMode: payload?.processingMode || "review",
      });
      const list = audioSuggestionsRepo.listByAudioImport(audioImportId, { status: "pending" });
      return { ok: true, ...result, list };
    } catch (err) {
      if (payload?.audioImportId) {
        try {
          audioImportsRepo.updateStatus({
            audioImportId: payload.audioImportId,
            status: "failed",
            errorMessage: err?.message || String(err),
          });
        } catch (_ignore) {
          // ignore follow-up errors
        }
      }
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  ipcMain.handle("audio:getSuggestions", async (_evt, payload) => {
    try {
      const data = payload && typeof payload === "object" ? payload : {};
      const audioImportId = String(data.audioImportId || "").trim();
      const meetingId = String(data.meetingId || "").trim();
      const status = String(data.status || "pending").trim() || undefined;

      let list = [];
      let audioImport = null;
      let transcript = null;
      if (audioImportId) {
        list = audioSuggestionsRepo.listByAudioImport(audioImportId, { status });
        audioImport = audioImportsRepo.getById(audioImportId);
        transcript = transcriptsRepo.getByAudioImportId(audioImportId);
      } else if (meetingId) {
        list = audioSuggestionsRepo.listByMeeting(meetingId, { status });
        const imports = audioImportsRepo.listByMeeting(meetingId);
        audioImport =
          imports.find((entry) => !String(entry?.file_path || "").startsWith("demo://")) ||
          imports[0] ||
          null;
        transcript = audioImport?.id ? transcriptsRepo.getByAudioImportId(audioImport.id) : null;
      } else {
        return { ok: false, error: "meetingId oder audioImportId fehlt" };
      }

      return { ok: true, list, audioImport, transcript };
    } catch (err) {
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  ipcMain.handle("audio:createDemoSuggestion", async (_evt, payload) => {
    try {
      const meetingId = String(payload?.meetingId || "").trim();
      const demoType = String(payload?.demoType || "").trim();
      if (!meetingId) return { ok: false, error: "meetingId fehlt" };
      if (!demoType) return { ok: false, error: "demoType fehlt" };

      const result = mappingService.createDemoSuggestion({ meetingId, demoType });
      const list = audioSuggestionsRepo.listByMeeting(meetingId, { status: "pending" });
      return { ok: true, ...result, list };
    } catch (err) {
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  ipcMain.handle("audio:applySuggestion", async (_evt, payload) => {
    try {
      const suggestionId = String(payload?.suggestionId || "").trim();
      if (!suggestionId) return { ok: false, error: "suggestionId fehlt" };

      const overrideParentTopId = String(payload?.overrideParentTopId || "").trim() || null;
      const result = suggestionApplyService.applySuggestion({
        suggestionId,
        overrideParentTopId,
      });

      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });

  ipcMain.handle("audio:rejectSuggestion", async (_evt, payload) => {
    try {
      const suggestionId = String(payload?.suggestionId || "").trim();
      if (!suggestionId) return { ok: false, error: "suggestionId fehlt" };

      const suggestion = audioSuggestionsRepo.getById(suggestionId);
      if (!suggestion) return { ok: false, error: "Vorschlag nicht gefunden" };

      const updatedSuggestion = audioSuggestionsRepo.updateStatus({
        suggestionId,
        status: "rejected",
      });

      return { ok: true, suggestion: updatedSuggestion };
    } catch (err) {
      return { ok: false, error: err?.stack || err?.message || String(err) };
    }
  });
}

module.exports = {
  registerAudioIpc,
};
