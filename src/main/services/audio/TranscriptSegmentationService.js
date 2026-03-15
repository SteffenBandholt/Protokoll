class TranscriptSegmentationService {
  segmentTranscript(transcript) {
    const text = String(transcript?.full_text || "").trim();
    if (!text) return [];
    return [text];
  }
}

function createTranscriptSegmentationService() {
  return new TranscriptSegmentationService();
}

module.exports = {
  TranscriptSegmentationService,
  createTranscriptSegmentationService,
};
