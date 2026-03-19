const fs = require("fs");
const path = require("path");

const MIME_BY_EXT = {
  ".mp3": "audio/mpeg",
  ".mp4": "audio/mp4",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
  ".flac": "audio/flac",
  ".wma": "audio/x-ms-wma",
};

function _audioLog(message, extra = null) {
  if (extra && typeof extra === "object") {
    console.info("[AUDIO] Import", message, extra);
    return;
  }
  console.info("[AUDIO] Import", message);
}

class AudioImportService {
  constructor({ meetingsRepo, audioImportsRepo }) {
    if (!meetingsRepo) throw new Error("AudioImportService: meetingsRepo required");
    if (!audioImportsRepo) throw new Error("AudioImportService: audioImportsRepo required");

    this.meetingsRepo = meetingsRepo;
    this.audioImportsRepo = audioImportsRepo;
  }

  _validateMeeting({ meetingId, projectId = null }) {
    const meeting = this.meetingsRepo.getMeetingById(meetingId);
    if (!meeting) throw new Error("Besprechung nicht gefunden");
    if (Number(meeting.is_closed) === 1) {
      throw new Error("Besprechung ist geschlossen - Audioimport nicht erlaubt");
    }

    const expectedProjectId = String(meeting.project_id || "").trim();
    const givenProjectId = String(projectId || "").trim();
    if (givenProjectId && expectedProjectId && expectedProjectId !== givenProjectId) {
      throw new Error("Projektbezug der Audiodatei passt nicht zur geöffneten Besprechung");
    }

    return meeting;
  }

  _validateFile(filePath) {
    const normalizedPath = path.resolve(String(filePath || "").trim());
    if (!normalizedPath) throw new Error("filePath required");

    let stats;
    try {
      stats = fs.statSync(normalizedPath);
    } catch (_err) {
      throw new Error(`Audiodatei nicht gefunden: ${normalizedPath}`);
    }
    if (!stats.isFile()) {
      throw new Error(`Audiodatei ist keine reguläre Datei: ${normalizedPath}`);
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) {
      throw new Error(`Nicht unterstütztes Audioformat: ${ext || "unbekannt"}`);
    }

    return {
      filePath: normalizedPath,
      fileName: path.basename(normalizedPath),
      mimeType,
    };
  }

  importAudio({ meetingId, projectId = null, filePath, processingMode = "review" }) {
    if (!meetingId) throw new Error("meetingId required");
    if (!filePath) throw new Error("filePath required");

    _audioLog("start", { meetingId, processingMode });
    try {
      const meeting = this._validateMeeting({ meetingId, projectId });
      const fileInfo = this._validateFile(filePath);
      const audioImport = this.audioImportsRepo.createImport({
        meetingId: meeting.id,
        projectId: meeting.project_id,
        filePath: fileInfo.filePath,
        originalFileName: fileInfo.fileName,
        mimeType: fileInfo.mimeType,
        processingMode,
        status: "imported",
      });
      _audioLog("stored", {
        audioImportId: audioImport?.id || null,
        fileName: fileInfo.fileName,
        mimeType: fileInfo.mimeType,
      });
      return audioImport;
    } catch (err) {
      _audioLog("failed", { meetingId, error: err?.message || String(err) });
      const message = String(err?.message || err);
      if (
        /^(Besprechung|Projektbezug|Audiodatei|Nicht unterst|filePath required)/i.test(message)
      ) {
        throw err;
      }
      throw new Error(`Audio-Import konnte nicht gespeichert werden: ${message}`);
    }
  }
}

function createAudioImportService(deps) {
  return new AudioImportService(deps);
}

module.exports = {
  AudioImportService,
  createAudioImportService,
};
