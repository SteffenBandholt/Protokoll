function _audioLog(message, extra = null) {
  if (extra && typeof extra === "object") {
    console.info("[AUDIO] Transcribe", message, extra);
    return;
  }
  console.info("[AUDIO] Transcribe", message);
}

const MODEL_SETTING_KEY = "audio.whisper.quality";

class TranscriptionService {
  constructor({ meetingsRepo, audioImportsRepo, transcriptsRepo, engine, appSettingsRepo }) {
    if (!meetingsRepo) throw new Error("TranscriptionService: meetingsRepo required");
    if (!audioImportsRepo) throw new Error("TranscriptionService: audioImportsRepo required");
    if (!transcriptsRepo) throw new Error("TranscriptionService: transcriptsRepo required");
    if (!engine) throw new Error("TranscriptionService: engine required");

    this.meetingsRepo = meetingsRepo;
    this.audioImportsRepo = audioImportsRepo;
    this.transcriptsRepo = transcriptsRepo;
    this.engine = engine;
    this.appSettingsRepo = appSettingsRepo || null;
  }

  _resolveModelFileName() {
    if (!this.appSettingsRepo || typeof this.appSettingsRepo.appSettingsGetMany !== "function") {
      return "ggml-base.bin";
    }
    const data = this.appSettingsRepo.appSettingsGetMany([MODEL_SETTING_KEY]) || {};
    const raw = String(data[MODEL_SETTING_KEY] || "").trim().toLowerCase();
    if (raw === "large") return "ggml-large.bin";
    if (raw === "best") return "ggml-medium.bin";
    if (raw === "balanced") return "ggml-small.bin";
    return "ggml-base.bin";
  }

  _loadOpenMeeting(audioImport) {
    const meeting = this.meetingsRepo.getMeetingById(audioImport.meeting_id);
    if (!meeting) throw new Error("Besprechung nicht gefunden");
    if (Number(meeting.is_closed) === 1) {
      throw new Error("Besprechung ist geschlossen - Transkription nicht erlaubt");
    }
    if (String(meeting.project_id || "") !== String(audioImport.project_id || "")) {
      throw new Error("Projektbezug des Audio-Imports ist inkonsistent");
    }
    return meeting;
  }

  async transcribe({ audioImportId, language = "de" }) {
    if (!audioImportId) throw new Error("audioImportId required");

    _audioLog("start", { audioImportId, language });
    const audioImport = this.audioImportsRepo.getById(audioImportId);
    if (!audioImport) throw new Error("Audio-Import nicht gefunden");

    this._loadOpenMeeting(audioImport);
    this.audioImportsRepo.updateStatus({
      audioImportId,
      status: "transcribing",
      errorMessage: null,
    });

    try {
      const result = await this.engine.transcribe({
        filePath: audioImport.file_path,
        language,
        modelFileName: this._resolveModelFileName(),
        audioImport,
      });

      const transcript = this.transcriptsRepo.upsertTranscript({
        audioImportId,
        engine: result.engine || "whisper.cpp",
        language: result.language || null,
        fullText: result.fullText || "",
        segmentsJson: JSON.stringify(Array.isArray(result.segments) ? result.segments : []),
      });

      this.audioImportsRepo.updateStatus({
        audioImportId,
        status: "transcribed",
        errorMessage: null,
      });

      _audioLog("completed", {
        audioImportId,
        engine: result.engine || "whisper.cpp",
        language: result.language || null,
        textLength: String(result.fullText || "").length,
      });

      return {
        transcript,
        stub: false,
        engine: result.engine || "whisper.cpp",
        message: "Lokale Transkription erfolgreich abgeschlossen.",
      };
    } catch (err) {
      this.audioImportsRepo.updateStatus({
        audioImportId,
        status: "failed",
        errorMessage: err?.message || String(err),
      });
      _audioLog("failed", { audioImportId, error: err?.message || String(err) });
      throw err;
    }
  }
}

function createTranscriptionService(deps) {
  return new TranscriptionService(deps);
}

module.exports = {
  TranscriptionService,
  createTranscriptionService,
};
