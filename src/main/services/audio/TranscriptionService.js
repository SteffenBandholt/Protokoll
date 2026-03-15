class TranscriptionService {
  constructor({ meetingsRepo, audioImportsRepo, transcriptsRepo }) {
    if (!meetingsRepo) throw new Error("TranscriptionService: meetingsRepo required");
    if (!audioImportsRepo) throw new Error("TranscriptionService: audioImportsRepo required");
    if (!transcriptsRepo) throw new Error("TranscriptionService: transcriptsRepo required");

    this.meetingsRepo = meetingsRepo;
    this.audioImportsRepo = audioImportsRepo;
    this.transcriptsRepo = transcriptsRepo;
  }

  transcribe({ audioImportId }) {
    if (!audioImportId) throw new Error("audioImportId required");

    const audioImport = this.audioImportsRepo.getById(audioImportId);
    if (!audioImport) throw new Error("Audio-Import nicht gefunden");

    const meeting = this.meetingsRepo.getMeetingById(audioImport.meeting_id);
    if (!meeting) throw new Error("Besprechung nicht gefunden");
    if (Number(meeting.is_closed) === 1) {
      throw new Error("Besprechung ist geschlossen - Transkription nicht erlaubt");
    }

    const transcript = this.transcriptsRepo.upsertTranscript({
      audioImportId,
      engine: "stub",
      language: "de",
      fullText: `Platzhalter-Transkript für "${audioImport.original_file_name || "Audiodatei"}".`,
      segmentsJson: "[]",
    });

    this.audioImportsRepo.updateStatus({
      audioImportId,
      status: "transcribed",
      errorMessage: null,
    });

    return {
      transcript,
      stub: true,
      message: "Transkription ist in Phase 3 noch ein Platzhalter.",
    };
  }
}

function createTranscriptionService(deps) {
  return new TranscriptionService(deps);
}

module.exports = {
  TranscriptionService,
  createTranscriptionService,
};
