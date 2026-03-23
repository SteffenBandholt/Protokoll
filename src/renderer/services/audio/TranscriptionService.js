export class TranscriptionService {
  constructor(api = window?.bbmDb || {}) {
    this.api = api;
  }

  ensureSuggestionsAvailable() {
    const hasTranscribe = typeof this.api.audioTranscribe === "function";
    const hasAnalyze = typeof this.api.audioAnalyze === "function";
    if (!hasTranscribe || !hasAnalyze) {
      throw new Error("Audio-Funktionen sind nicht verf\u00fcgbar.");
    }
    return true;
  }

  async transcribeBlob({ base64, mimeType, meetingId, projectId }) {
    if (typeof this.api.audioTranscribeBlob !== "function") {
      throw new Error("Audio-Transkription ist nicht verf\u00fcgbar.");
    }
    return this.api.audioTranscribeBlob({
      base64,
      mimeType,
      meetingId,
      projectId,
    });
  }

  async transcribe({ audioImportId }) {
    this.ensureSuggestionsAvailable();
    return this.api.audioTranscribe({ audioImportId });
  }

  async analyze({ audioImportId, processingMode }) {
    if (typeof this.api.audioAnalyze !== "function") {
      throw new Error("Audio-Funktionen sind nicht verf\u00fcgbar.");
    }
    return this.api.audioAnalyze({ audioImportId, processingMode });
  }
}
