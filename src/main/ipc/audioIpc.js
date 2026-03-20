const { BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");

const meetingsRepo = require("../db/meetingsRepo");
const meetingTopsRepo = require("../db/meetingTopsRepo");
const audioImportsRepo = require("../db/audioImportsRepo");
const transcriptsRepo = require("../db/transcriptsRepo");
const audioSuggestionsRepo = require("../db/audioSuggestionsRepo");
const audioTermCorrectionsRepo = require("../db/audioTermCorrectionsRepo");
const appSettingsRepo = require("../db/appSettingsRepo");
const { createAudioImportService } = require("../services/audio/AudioImportService");
const { createTranscriptionService } = require("../services/audio/TranscriptionService");
const {
  createTranscriptSegmentationService,
} = require("../services/audio/TranscriptSegmentationService");
const { createMeetingMappingService } = require("../services/audio/MeetingMappingService");
const { createSuggestionApplyService } = require("../services/audio/SuggestionApplyService");
const { createWhisperCppEngine } = require("../services/audio/engines/WhisperCppEngine");
const {
  LICENSE_FEATURES,
  enforceLicensedFeature,
  toLicenseErrorPayload,
} = require("../licensing/featureGuard");
const { isDevAudioSuggestionsEnabled } = require("../licensing/featureGuard");

const AUDIO_FILE_FILTER = [
  {
    name: "Audio",
    extensions: ["mp3", "mp4", "wav", "m4a", "aac", "ogg", "flac", "wma"],
  },
];

function _buildApplyMessage(result) {
  const mode = String(result?.mode || "").trim();
  if (mode === "append_to_top") {
    return "Vorschlag wurde als Ergänzung übernommen.";
  }
  if (mode === "create_child_top") {
    return "Vorschlag wurde als neuer Unterpunkt übernommen.";
  }
  if (mode === "manual_assign_child_top") {
    return "Vorschlag wurde unter dem gewählten Bereich angelegt.";
  }
  return "Vorschlag wurde übernommen.";
}

function _ensureAudioLicensed() {
  enforceLicensedFeature(LICENSE_FEATURES.AUDIO);
}

function _toAudioErrorPayload(err) {
  if (err?.licenseError || String(err?.message || "").startsWith("LICENSE_")) {
    return toLicenseErrorPayload(err);
  }

  return { ok: false, error: err?.stack || err?.message || String(err) };
}

function _inferAudioExt(mimeType) {
  const normalized = String(mimeType || "").toLowerCase().trim();
  if (normalized.includes("audio/webm")) return ".webm";
  if (normalized.includes("audio/ogg")) return ".ogg";
  if (normalized.includes("audio/wav")) return ".wav";
  if (normalized.includes("audio/mpeg")) return ".mp3";
  if (normalized.includes("audio/mp4")) return ".m4a";
  return ".webm";
}

function registerAudioIpc() {
  const transcriptionEngine = createWhisperCppEngine();
  const audioImportService = createAudioImportService({ meetingsRepo, audioImportsRepo });
  const transcriptionService = createTranscriptionService({
    meetingsRepo,
    audioImportsRepo,
    transcriptsRepo,
    engine: transcriptionEngine,
    appSettingsRepo,
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
      _ensureAudioLicensed();
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
      return _toAudioErrorPayload(err);
    }
  });

  ipcMain.handle("audio:whisperModelsStatus", async () => {
    try {
      const base = transcriptionEngine.getModelAvailability("ggml-base.bin");
      const small = transcriptionEngine.getModelAvailability("ggml-small.bin");
      const medium = transcriptionEngine.getModelAvailability("ggml-medium.bin");
      const large = transcriptionEngine.getModelAvailability("ggml-large.bin");

      const toModelState = (fileName, availability) => {
        const modelPath = availability?.modelPath || null;
        const executablePath = availability?.executablePath || null;
        const available = !!availability?.available;
        let missingReason = null;
        if (!available) {
          if (!executablePath) {
            missingReason = "Whisper-Executable fehlt.";
          } else if (!modelPath) {
            missingReason = `Modell fehlt: ${fileName}`;
          } else {
            missingReason = "Whisper-Runtime nicht verfuegbar.";
          }
        }
        return { fileName, available, missingReason };
      };
      return {
        ok: true,
        models: {
          fast: toModelState("ggml-base.bin", base),
          balanced: toModelState("ggml-small.bin", small),
          best: toModelState("ggml-medium.bin", medium),
          large: toModelState("ggml-large.bin", large),
        },
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("audio:transcribe", async (_evt, payload) => {
    try {
      _ensureAudioLicensed();
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
      return _toAudioErrorPayload(err);
    }
  });

  ipcMain.handle("audio:transcribeBlob", async (_evt, payload) => {
    try {
      _ensureAudioLicensed();
      const meetingId = String(payload?.meetingId || "").trim();
      if (!meetingId) return { ok: false, error: "meetingId fehlt" };
      const projectId = payload?.projectId || null;
      const base64 = String(payload?.base64 || "").trim();
      if (!base64) return { ok: false, error: "audioPayload fehlt" };

      const mimeType = String(payload?.mimeType || "audio/webm").trim() || "audio/webm";
      const ext = _inferAudioExt(mimeType);
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "bbm-dictation-"));
      const filePath = path.join(tempDir, `dictation${ext}`);
      const buffer = Buffer.from(base64, "base64");
      await fs.promises.writeFile(filePath, buffer);

      const audioImport = audioImportService.importAudio({
        meetingId,
        projectId,
        filePath,
        processingMode: "dictation",
      });

      const result = await transcriptionService.transcribe({ audioImportId: audioImport.id });
      return { ok: true, audioImport, ...result };
    } catch (err) {
      return _toAudioErrorPayload(err);
    }
  });

  ipcMain.handle("audio:analyze", async (_evt, payload) => {
    try {
      _ensureAudioLicensed();
      if (!isDevAudioSuggestionsEnabled()) {
        return {
          ok: false,
          error:
            "Audio-Mapping ist deaktiviert. Bitte die feldgebundene Spracheingabe (Diktat) verwenden.",
        };
      }
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
      return _toAudioErrorPayload(err);
    }
  });

  ipcMain.handle("audio:getSuggestions", async (_evt, payload) => {
    try {
      _ensureAudioLicensed();
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
      return _toAudioErrorPayload(err);
    }
  });

  ipcMain.handle("audio:createDemoSuggestion", async (_evt, payload) => {
    try {
      _ensureAudioLicensed();
      const meetingId = String(payload?.meetingId || "").trim();
      const demoType = String(payload?.demoType || "").trim();
      if (!meetingId) return { ok: false, error: "meetingId fehlt" };
      if (!demoType) return { ok: false, error: "demoType fehlt" };

      const result = mappingService.createDemoSuggestion({ meetingId, demoType });
      const list = audioSuggestionsRepo.listByMeeting(meetingId, { status: "pending" });
      return { ok: true, ...result, list };
    } catch (err) {
      return _toAudioErrorPayload(err);
    }
  });

  ipcMain.handle("audio:applySuggestion", async (_evt, payload) => {
    try {
      _ensureAudioLicensed();
      const suggestionId = String(payload?.suggestionId || "").trim();
      if (!suggestionId) return { ok: false, error: "suggestionId fehlt" };

      const overrideParentTopId = String(payload?.overrideParentTopId || "").trim() || null;
      const result = suggestionApplyService.applySuggestion({
        suggestionId,
        overrideParentTopId,
      });

      return { ok: true, ...result, message: _buildApplyMessage(result?.result) };
    } catch (err) {
      return _toAudioErrorPayload(err);
    }
  });

  ipcMain.handle("audio:rejectSuggestion", async (_evt, payload) => {
    try {
      _ensureAudioLicensed();
      const suggestionId = String(payload?.suggestionId || "").trim();
      if (!suggestionId) return { ok: false, error: "suggestionId fehlt" };

      const suggestion = audioSuggestionsRepo.getById(suggestionId);
      if (!suggestion) return { ok: false, error: "Vorschlag nicht gefunden" };
      const updatedSuggestion = audioSuggestionsRepo.markRejected({ suggestionId });
      return { ok: true, suggestion: updatedSuggestion, message: "Vorschlag verworfen." };
    } catch (err) {
      return _toAudioErrorPayload(err);
    }
  });

  ipcMain.handle("audio:termCorrectionsList", async (_evt, payload) => {
    try {
      _ensureAudioLicensed();
      const projectId = String(payload?.projectId || "").trim();
      if (!projectId) return { ok: false, error: "projectId fehlt" };
      const list = audioTermCorrectionsRepo.listByProject(projectId);
      return { ok: true, list };
    } catch (err) {
      return _toAudioErrorPayload(err);
    }
  });

  ipcMain.handle("audio:termCorrectionUpsert", async (_evt, payload) => {
    try {
      _ensureAudioLicensed();
      const projectId = String(payload?.projectId || "").trim();
      const wrongTerm = String(payload?.wrongTerm || "").trim();
      const correctTerm = String(payload?.correctTerm || "").trim();
      if (!projectId) return { ok: false, error: "projectId fehlt" };
      if (!wrongTerm) return { ok: false, error: "wrongTerm fehlt" };
      if (!correctTerm) return { ok: false, error: "correctTerm fehlt" };

      const entry = audioTermCorrectionsRepo.upsertCorrection({
        projectId,
        wrongTerm,
        correctTerm,
      });
      return { ok: true, entry };
    } catch (err) {
      return _toAudioErrorPayload(err);
    }
  });
}

module.exports = {
  registerAudioIpc,
};
