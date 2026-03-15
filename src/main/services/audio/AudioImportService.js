const path = require("path");

class AudioImportService {
  constructor({ meetingsRepo, audioImportsRepo }) {
    if (!meetingsRepo) throw new Error("AudioImportService: meetingsRepo required");
    if (!audioImportsRepo) throw new Error("AudioImportService: audioImportsRepo required");

    this.meetingsRepo = meetingsRepo;
    this.audioImportsRepo = audioImportsRepo;
  }

  importAudio({ meetingId, filePath, processingMode = "review" }) {
    if (!meetingId) throw new Error("meetingId required");
    if (!filePath) throw new Error("filePath required");

    const meeting = this.meetingsRepo.getMeetingById(meetingId);
    if (!meeting) throw new Error("Besprechung nicht gefunden");
    if (Number(meeting.is_closed) === 1) {
      throw new Error("Besprechung ist geschlossen - Audioimport nicht erlaubt");
    }

    const ext = path.extname(String(filePath || "")).toLowerCase();
    const mimeType = ({
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
      ".ogg": "audio/ogg",
      ".flac": "audio/flac",
      ".wma": "audio/x-ms-wma",
    })[ext] || "application/octet-stream";

    return this.audioImportsRepo.createImport({
      meetingId: meeting.id,
      projectId: meeting.project_id,
      filePath: String(filePath),
      originalFileName: path.basename(String(filePath)),
      mimeType,
      processingMode,
      status: "imported",
    });
  }
}

function createAudioImportService(deps) {
  return new AudioImportService(deps);
}

module.exports = {
  AudioImportService,
  createAudioImportService,
};
