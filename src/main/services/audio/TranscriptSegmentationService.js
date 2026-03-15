const TOPIC_CHANGE_PATTERNS = [
  /\bneuer punkt\b/i,
  /\bau[sß]erdem\b/i,
  /\bzus[aä]tzlich\b/i,
  /\bnoch ein thema\b/i,
  /\bweiterer punkt\b/i,
];

function _splitBySentenceBoundary(text) {
  return String(text || "")
    .split(/(?<=[.!?;])\s+/)
    .map((part) => String(part || "").trim())
    .filter(Boolean);
}

function _splitByTopicSignals(text) {
  return String(text || "")
    .split(/\s+(?=(?:neuer punkt|au[ßs]erdem|zus[aä]tzlich|noch ein thema|weiterer punkt)\b)/i)
    .map((part) => String(part || "").trim())
    .filter(Boolean);
}

class TranscriptSegmentationService {
  _normalizeText(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  _isTopicChange(text) {
    return TOPIC_CHANGE_PATTERNS.some((pattern) => pattern.test(String(text || "")));
  }

  _appendSegment(segments, text, meta = {}) {
    const cleaned = String(text || "").trim();
    if (!cleaned) return;

    segments.push({
      index: segments.length,
      text: cleaned,
      wordCount: cleaned.split(/\s+/).filter(Boolean).length,
      hasTopicChangeSignal: this._isTopicChange(cleaned),
      source: meta.source || "transcript",
    });
  }

  segmentTranscript(transcript) {
    const normalized = this._normalizeText(transcript?.full_text || "");
    if (!normalized) return [];

    const paragraphs = normalized
      .split(/\n\s*\n/)
      .map((part) => this._normalizeText(part))
      .filter(Boolean);

    const segments = [];

    for (const paragraph of paragraphs) {
      const sentenceParts = _splitBySentenceBoundary(paragraph);
      if (!sentenceParts.length) continue;

      let buffer = "";
      for (const sentence of sentenceParts) {
        const topicParts = _splitByTopicSignals(sentence);
        for (const part of topicParts) {
          const cleanedPart = this._normalizeText(part);
          if (!cleanedPart) continue;

          const shouldFlush =
            buffer &&
            (cleanedPart.length > 140 ||
              this._isTopicChange(cleanedPart) ||
              /\b(?:unter|bei|beim|zum thema)\b/i.test(cleanedPart));

          if (shouldFlush) {
            this._appendSegment(segments, buffer, { source: "sentence" });
            buffer = cleanedPart;
            continue;
          }

          buffer = buffer ? `${buffer} ${cleanedPart}` : cleanedPart;
        }
      }

      if (buffer) {
        this._appendSegment(segments, buffer, { source: "paragraph" });
      }
    }

    return segments;
  }
}

function createTranscriptSegmentationService() {
  return new TranscriptSegmentationService();
}

module.exports = {
  TranscriptSegmentationService,
  createTranscriptSegmentationService,
};
