const NEW_POINT_PATTERN =
  /\b(?:neuer top|neuer punkt|neuer unterpunkt|unterpunkt unter|zusaetzlicher top|weiterer punkt|ausserdem|noch ein thema|zusaetzlich)\b/i;
const ACTIVE_ANCHOR_MAX_WORDS = 12;
const TRAILING_STOP_WORDS = new Set([
  "mit",
  "ist",
  "sind",
  "wird",
  "werden",
  "war",
  "waren",
  "muss",
  "muessen",
  "soll",
  "sollen",
  "noch",
  "zu",
  "auf",
  "fuer",
  "von",
  "im",
  "am",
  "an",
  "der",
  "die",
  "das",
  "und",
  "oder",
  "bei",
  "beim",
  "zum",
  "zur",
  "des",
  "den",
  "dem",
]);

function _audioLog(message, extra = null) {
  if (extra && typeof extra === "object") {
    console.info("[AUDIO] Map", message, extra);
    return;
  }
  console.info("[AUDIO] Map", message);
}

class MeetingMappingService {
  constructor({
    meetingsRepo,
    audioImportsRepo,
    transcriptsRepo,
    audioSuggestionsRepo,
    segmentationService,
    meetingTopsRepo,
  }) {
    if (!meetingsRepo) throw new Error("MeetingMappingService: meetingsRepo required");
    if (!audioImportsRepo) throw new Error("MeetingMappingService: audioImportsRepo required");
    if (!transcriptsRepo) throw new Error("MeetingMappingService: transcriptsRepo required");
    if (!audioSuggestionsRepo) throw new Error("MeetingMappingService: audioSuggestionsRepo required");
    if (!segmentationService) {
      throw new Error("MeetingMappingService: segmentationService required");
    }
    if (!meetingTopsRepo) {
      throw new Error("MeetingMappingService: meetingTopsRepo required");
    }

    this.meetingsRepo = meetingsRepo;
    this.audioImportsRepo = audioImportsRepo;
    this.transcriptsRepo = transcriptsRepo;
    this.audioSuggestionsRepo = audioSuggestionsRepo;
    this.segmentationService = segmentationService;
    this.meetingTopsRepo = meetingTopsRepo;
  }

  _normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("de-DE")
      .replace(/[\u00e4\u00c4]/g, "ae")
      .replace(/[\u00f6\u00d6]/g, "oe")
      .replace(/[\u00fc\u00dc]/g, "ue")
      .replace(/\u00df/g, "ss")
      .replace(/Ã¤/g, "ae")
      .replace(/Ã¶/g, "oe")
      .replace(/Ã¼/g, "ue")
      .replace(/ÃŸ/g, "ss")
      .replace(/[^\p{L}\p{N}\s./-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  _safeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  _uniqueTerms(values) {
    return Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .map((value) => this._normalize(value))
          .filter((value) => value && value.length >= 2)
      )
    );
  }

  _topLabel(cardEntry) {
    if (!cardEntry) return "";
    const number = this._safeText(cardEntry.number);
    const title = this._safeText(cardEntry.title);
    if (number && title) return `${number} ${title}`;
    return title || number || String(cardEntry.topId || "").trim();
  }

  _getMeetingOrThrow(meetingId) {
    const meeting = this.meetingsRepo.getMeetingById(meetingId);
    if (!meeting) throw new Error("Besprechung nicht gefunden");
    if (Number(meeting.is_closed) === 1) {
      throw new Error("Besprechung ist geschlossen - Analyse nicht erlaubt");
    }
    return meeting;
  }

  _createDemoAudioImport(meeting, demoType) {
    return this.audioImportsRepo.createImport({
      meetingId: meeting.id,
      projectId: meeting.project_id,
      filePath: `demo://${demoType}`,
      originalFileName: `demo-${demoType}.txt`,
      mimeType: "text/plain",
      processingMode: "review",
      status: "analyzed",
    });
  }

  _pickAppendTarget(meetingId) {
    const rows = this.meetingTopsRepo.listJoinedByMeeting(meetingId) || [];
    const filtered = rows.filter((row) => {
      return (
        Number(row?.is_hidden || 0) !== 1 &&
        this._normalize(row?.title) !== "manuell zuordnen"
      );
    });

    const preferred = filtered.find((row) => this._safeText(row?.longtext)) || filtered[0] || null;
    if (!preferred?.id) {
      throw new Error("Kein bestehender TOP fuer append_to_top gefunden");
    }
    return preferred;
  }

  _pickParentTarget(meetingId) {
    const rows = this.meetingTopsRepo.listJoinedByMeeting(meetingId) || [];
    const levelOne =
      rows.find((row) => {
        return (
          Number(row?.level) === 1 &&
          Number(row?.is_hidden || 0) !== 1 &&
          this._normalize(row?.title) !== "manuell zuordnen"
        );
      }) || null;

    if (levelOne?.id) return levelOne;

    const anyVisible = rows.find((row) => Number(row?.is_hidden || 0) !== 1) || null;
    if (!anyVisible?.id) throw new Error("Kein Parent-TOP fuer create_child_top gefunden");
    return anyVisible;
  }

  _buildWorkingCard(meetingId) {
    const rows = this.meetingTopsRepo.listJoinedByMeeting(meetingId) || [];
    const byId = new Map();
    const visibleRows = rows.filter((row) => Number(row?.is_hidden || 0) !== 1);

    for (const row of visibleRows) {
      byId.set(String(row.id), row);
    }

    return visibleRows
      .map((row) => {
        const parent = byId.get(String(row.parent_top_id || "").trim()) || null;
        const title = this._safeText(row.title);
        const number = this._safeText(row.number);
        const longtext = this._safeText(row.longtext);
        const titleTerms = title.split(/\s+/).filter((part) => part.length >= 3);
        const longtextTerms = longtext.split(/\s+/).filter((part) => part.length >= 5).slice(0, 6);

        return {
          topId: row.id,
          number,
          title,
          level: Number(row.level || 0),
          parentTopId: row.parent_top_id || null,
          parentTitle: this._safeText(parent?.title || ""),
          longtext,
          searchTerms: this._uniqueTerms([
            title,
            number,
            parent?.title,
            ...titleTerms,
            ...longtextTerms,
          ]),
          normalizedTitle: this._normalize(title),
          normalizedParentTitle: this._normalize(parent?.title || ""),
        };
      })
      .filter((entry) => entry.topId && entry.title);
  }

  _findWorkingCardByTopNumber(topNumber, workingCard) {
    const normalizedNumber = this._safeText(topNumber).replace(/\//g, ".");
    if (!normalizedNumber) return null;

    return (
      workingCard
        .filter((entry) => this._safeText(entry.number).replace(/\//g, ".") === normalizedNumber)
        .sort((a, b) => String(b.number).length - String(a.number).length)[0] || null
    );
  }

  _findDirectTopMatch(segmentNormalized, rawSegment, workingCard) {
    const rawLower = String(rawSegment || "").toLocaleLowerCase("de-DE");
    const byNumber = workingCard
      .filter((entry) => entry.number && rawLower.includes(String(entry.number).toLocaleLowerCase("de-DE")))
      .sort((a, b) => String(b.number).length - String(a.number).length)[0];
    if (byNumber) {
      return {
        entry: byNumber,
        reason: `top_number_match:${byNumber.number}`,
      };
    }

    const byTitle = workingCard
      .filter((entry) => entry.normalizedTitle && segmentNormalized.includes(entry.normalizedTitle))
      .sort((a, b) => b.normalizedTitle.length - a.normalizedTitle.length)[0];
    if (byTitle) {
      return {
        entry: byTitle,
        reason: `top_title_match:${byTitle.title}`,
      };
    }

    return null;
  }

  _findParentMatch(segmentNormalized, workingCard) {
    return (
      workingCard
        .filter((entry) => entry.normalizedTitle && segmentNormalized.includes(entry.normalizedTitle))
        .sort((a, b) => b.normalizedTitle.length - a.normalizedTitle.length)[0] || null
    );
  }

  _extractTargetFromPhrases(segmentNormalized, workingCard) {
    const patterns = [
      { regex: /\bunter\s+(.+?)(?:$|[,:.;])/i, mode: "child", reason: "phrase_unter" },
      { regex: /\bbei\s+(.+?)(?:$|[,:.;])/i, mode: "append", reason: "phrase_bei" },
      { regex: /\bbeim\s+(.+?)(?:$|[,:.;])/i, mode: "append", reason: "phrase_beim" },
      { regex: /\bzum thema\s+(.+?)(?:$|[,:.;])/i, mode: "append", reason: "phrase_zum_thema" },
    ];

    for (const pattern of patterns) {
      const match = segmentNormalized.match(pattern.regex);
      if (!match || !match[1]) continue;
      const phraseTarget = this._normalize(match[1]);
      if (!phraseTarget) continue;

      const entry =
        workingCard
          .filter((item) => item.normalizedTitle && phraseTarget.includes(item.normalizedTitle))
          .sort((a, b) => b.normalizedTitle.length - a.normalizedTitle.length)[0] || null;

      if (entry) {
        return { entry, mode: pattern.mode, reason: `${pattern.reason}:${entry.title}` };
      }
    }

    return null;
  }

  _extractSpokenTopReference(segmentNormalized, workingCard) {
    const patterns = [
      {
        regex: /\b(?:gehe zu|weiter mit|zum thema)\s+top\s+(\d+(?:[./]\d+)*)\b/i,
        kind: "context_switch",
        reasonPrefix: "spoken_context_switch",
      },
      {
        regex: /\b(?:zu|bei|unter)\s+top\s+(\d+(?:[./]\d+)*)\b/i,
        kind: "direct_reference",
        reasonPrefix: "spoken_top_reference",
      },
      {
        regex: /\btop\s+(\d+(?:[./]\d+)*)\b/i,
        kind: "direct_reference",
        reasonPrefix: "spoken_top_reference",
      },
    ];

    for (const pattern of patterns) {
      const match = segmentNormalized.match(pattern.regex);
      if (!match || !match[1]) continue;
      const number = this._safeText(match[1]).replace(/\//g, ".");
      const entry = this._findWorkingCardByTopNumber(number, workingCard);
      if (!entry) continue;
      return {
        entry,
        number,
        kind: pattern.kind,
        reason: `${pattern.reasonPrefix}:${number}`,
      };
    }

    return null;
  }

  _hasNewPointSignal(segmentText) {
    return NEW_POINT_PATTERN.test(this._normalize(segmentText));
  }

  _hasNewTopSignal(segmentText) {
    const normalized = this._normalize(segmentText);
    return /\b(?:neuer top|neuer punkt|zusaetzlicher top)\b/i.test(normalized);
  }

  _hasNewChildSignal(segmentText) {
    const normalized = this._normalize(segmentText);
    return /\b(?:neuer unterpunkt|unterpunkt unter top|unterpunkt)\b/i.test(normalized);
  }

  _extractTitleDirective(segmentText) {
    const cleaned = this._safeText(segmentText);
    if (!cleaned) return null;

    const match = cleaned.match(
      /(?:^|[.!?;]\s*)(?:neuer titel|titel|ueberschrift|überschrift)\s*[:,-]?\s+(.+?)(?=(?:[.!?;]+(?:\s|$)|$))/i
    );
    if (!match || !match[1]) return null;

    const title = this._safeText(match[1]).replace(/[.!?;]+$/g, "").trim();
    if (!title) return null;

    return {
      title,
      matchText: match[0],
    };
  }

  _stripLeadingContext(segmentText) {
    return String(segmentText || "")
      .replace(
        /^(?:gehe zu|weiter mit|zum thema)\s+top\s+\d+(?:[./]\d+)*\s*[.!?;,:-]?\s*/i,
        ""
      )
      .replace(/^(?:zu|bei|unter)\s+top\s+\d+(?:[./]\d+)*\s*[.!?;,:-]?\s*/i, "")
      .replace(/^top\s+\d+(?:[./]\d+)*\s*[.!?;,:-]?\s*/i, "")
      .replace(
        /^(?:neuer top|neuer punkt|zusaetzlicher top|neuer unterpunkt|unterpunkt(?:\s+unter\s+top\s+\d+(?:[./]\d+)*)?)\s*[.!?;,:-]?\s*/i,
        ""
      )
      .replace(/^(?:ausserdem|zusaetzlich|noch ein thema|weiterer punkt)\s*[:,-]?\s*/i, "")
      .replace(/^(?:unter|bei|beim|zum thema)\s+[^:.;,-]+[:,-]?\s*/i, "")
      .replace(/^[.!?;,:-]+\s*/g, "")
      .trim();
  }

  _stripStructureCommands(segmentText, titleDirective = null) {
    let cleaned = this._safeText(segmentText);
    if (!cleaned) return "";

    const patterns = [
      /^(?:gehe zu|weiter mit|zum thema)\s+top\s+\d+(?:[./]\d+)*\s*[.!?;,:-]?\s*/i,
      /^(?:zu|bei|unter)\s+top\s+\d+(?:[./]\d+)*\s*[.!?;,:-]?\s*/i,
      /^top\s+\d+(?:[./]\d+)*\s*[.!?;,:-]?\s*/i,
      /^(?:neuer top|neuer punkt|zusaetzlicher top)\s*[.!?;,:-]?\s*/i,
      /^(?:neuer unterpunkt|unterpunkt(?:\s+unter\s+top\s+\d+(?:[./]\d+)*)?)\s*[.!?;,:-]?\s*/i,
      /^(?:ausserdem|zusaetzlich|noch ein thema|weiterer punkt)\s*[:,-]?\s*/i,
      /^(?:neuer titel|titel|ueberschrift|überschrift)\s*[:,-]?\s+.+?(?=(?:[.!?;]+(?:\s|$)|$))/i,
    ];

    let changed = true;
    while (changed) {
      changed = false;
      const trimmed = cleaned.replace(/^[.!?;,:-]+\s*/g, "").trim();
      if (trimmed !== cleaned) {
        cleaned = trimmed;
        changed = true;
      }

      for (const pattern of patterns) {
        const next = cleaned.replace(pattern, "").trim();
        if (next !== cleaned) {
          cleaned = next;
          changed = true;
        }
      }

      if (titleDirective?.matchText && cleaned.includes(titleDirective.matchText)) {
        cleaned = cleaned.replace(titleDirective.matchText, " ").replace(/\s+/g, " ").trim();
        changed = true;
      }
    }

    return cleaned.replace(/^[.!?;,:-]+\s*/g, "").trim();
  }

  _buildSuggestedTitle(segmentText) {
    const cleaned = this._cleanupTranscribedText(this._stripLeadingContext(segmentText))
      .replace(/[.!?;]+$/g, "")
      .trim();
    return this._deriveTitleFromText(cleaned);
  }

  _cleanupTranscribedText(text) {
    let cleaned = this._safeText(text);
    if (!cleaned) return "";

    cleaned = cleaned.replace(/\s{2,}/g, " ");
    cleaned = cleaned.replace(/\s+([,.;:!?])/g, "$1");
    cleaned = cleaned.replace(/([,.;:!?])([^\s])/g, "$1 $2");
    cleaned = cleaned.replace(/([,.;:!?])\1+/g, "$1");
    cleaned = cleaned.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
    cleaned = cleaned.replace(/\)\s*(\w)/g, ") $1");
    cleaned = cleaned.replace(/\s+$/g, "").trim();

    if (/^[a-z\u00e4\u00f6\u00fc]/.test(cleaned)) {
      cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
    }

    cleaned = this._applyDomainDictionary(cleaned);
    return cleaned;
  }

  _applyDomainDictionary(text) {
    let out = String(text || "");
    const replaceWord = (pattern, replacement) => {
      out = out.replace(pattern, (match) => {
        const first = match[0];
        if (first && first === first.toUpperCase()) {
          return replacement[0].toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
    };

    replaceWord(/\brohrbau\b/gi, "Rohbau");
    replaceWord(/\bschallung\b/gi, "Schalung");
    replaceWord(/\bbewehrung\b/gi, "Bewehrung");
    replaceWord(/\bbetonage\b/gi, "Betonage");
    replaceWord(/\bfreigabe\b/gi, "Freigabe");
    replaceWord(/\bnachtrag\b/gi, "Nachtrag");
    replaceWord(/\bschacht\s?hoehen\b/gi, "Schachthöhen");
    replaceWord(/\bschachthoehen\b/gi, "Schachthöhen");
    replaceWord(/\bschachthohen\b/gi, "Schachthöhen");
    replaceWord(/\bsohlen\b/gi, "Sohlen");
    replaceWord(/\babsteckung\b/gi, "Absteckung");
    replaceWord(/\bgeruestpruefung\b/gi, "Gerüstprüfung");
    replaceWord(/\bgeruest pruefung\b/gi, "Gerüstprüfung");
    replaceWord(/\bstatik\b/gi, "Statik");
    replaceWord(/\bbauzaun\b/gi, "Bauzaun");

    out = out.replace(/\bSchachthöhen\s+Sohlen\b/gi, "Schachthöhen (Sohlen)");
    return out;
  }

  _deriveTitleFromText(text) {
    const cleaned = this._cleanupTranscribedText(text).replace(/^[.!?;,:-]+\s*/g, "").trim();
    if (!cleaned) return "Neuer Punkt";

    const dotIndex = cleaned.indexOf(".");
    const commaIndex = cleaned.indexOf(",");
    const cutIndex = dotIndex >= 0 ? dotIndex : commaIndex >= 0 ? commaIndex : -1;

    let title =
      cutIndex >= 0
        ? cleaned.slice(0, cutIndex).trim()
        : cleaned.length > 80
        ? cleaned.slice(0, 80).trim()
        : cleaned;

    title = title.replace(/[.!?;,]+$/g, "").trim();
    if (!title) return "Neuer Punkt";

    const words = title.split(/\s+/).filter(Boolean);
    while (words.length > 2) {
      const last = this._normalize(words[words.length - 1]);
      if (!TRAILING_STOP_WORDS.has(last)) break;
      words.pop();
    }
    const compact = words.join(" ").trim();
    if (compact.length >= 6) return compact;
    return title;
  }

  _shouldUseActiveAnchor(segment, { hasNewPointSignal, directTop, phraseTarget, currentAnchor }) {
    if (!currentAnchor) return false;
    if (hasNewPointSignal) return false;
    if (directTop || phraseTarget?.entry) return false;

    const wordCount = Number(segment?.wordCount || 0);
    if (!Number.isFinite(wordCount) || wordCount <= 0 || wordCount > ACTIVE_ANCHOR_MAX_WORDS) {
      return false;
    }

    if (segment?.hasTopicChangeSignal) return false;

    return true;
  }

  _mapSpokenStructureSegment(segment, workingCard, context = {}, options = {}) {
    const segmentText = this._safeText(segment?.text || "");
    if (!segmentText) return null;

    const segmentNormalized = this._normalize(segmentText);
    const spokenTop = this._extractSpokenTopReference(segmentNormalized, workingCard);
    const currentAnchor =
      context.anchorTopId
        ? workingCard.find((entry) => String(entry.topId) === String(context.anchorTopId))
        : null;
    const titleDirective = this._extractTitleDirective(segmentText);
    const hasNewChildSignal = this._hasNewChildSignal(segmentText);
    const hasNewTopSignal = this._hasNewTopSignal(segmentText);
    const strippedContent = this._stripStructureCommands(segmentText, titleDirective);
    const parentCandidate = spokenTop?.entry || currentAnchor || null;
    const titleSuggestion =
      titleDirective?.title || this._buildSuggestedTitle(strippedContent || segmentText);

    if (hasNewChildSignal || hasNewTopSignal) {
      if (!spokenTop && !titleDirective && options.phraseTarget?.entry) {
        return null;
      }

      if (!parentCandidate?.topId && !titleDirective && !spokenTop) {
        return null;
      }

      if (parentCandidate?.topId) {
        return {
          type: "create_child_top",
          parentTopId: parentCandidate.topId,
          titleSuggestion,
          textSuggestion: strippedContent,
          sourceExcerpt: segmentText,
          mappingReason: hasNewChildSignal
            ? `spoken_new_child:${this._topLabel(parentCandidate)}`
            : `spoken_new_point:${this._topLabel(parentCandidate)}`,
          nextAnchorTopId: parentCandidate.topId,
        };
      }

      return {
        type: "manual_assign_child_top",
        titleSuggestion,
        textSuggestion: strippedContent,
        sourceExcerpt: segmentText,
        mappingReason: hasNewChildSignal
          ? "spoken_new_child_without_safe_parent"
          : "spoken_new_point_without_safe_parent",
        nextAnchorTopId: null,
      };
    }

    if (!spokenTop?.entry) return null;

    if (!strippedContent) {
      return {
        nextAnchorTopId: spokenTop.entry.topId,
        mappingReason: spokenTop.reason,
      };
    }

    return {
      type: "append_to_top",
      targetTopId: spokenTop.entry.topId,
      titleSuggestion: null,
      textSuggestion: strippedContent,
      sourceExcerpt: segmentText,
      mappingReason: spokenTop.reason,
      nextAnchorTopId: spokenTop.entry.topId,
    };
  }

  _mapSegment(segment, workingCard, context = {}) {
    const segmentText = this._safeText(segment?.text || "");
    if (!segmentText) return null;

    const segmentNormalized = this._normalize(segmentText);
    const phraseTarget = this._extractTargetFromPhrases(segmentNormalized, workingCard);
    const spokenStructure = this._mapSpokenStructureSegment(segment, workingCard, context, {
      phraseTarget,
    });
    if (spokenStructure) return spokenStructure;

    const hasNewPointSignal = this._hasNewPointSignal(segmentText);
    const directTop = this._findDirectTopMatch(segmentNormalized, segmentText, workingCard);
    const currentAnchor =
      context.anchorTopId
        ? workingCard.find((entry) => String(entry.topId) === String(context.anchorTopId))
        : null;
    const allowAnchorAppend = this._shouldUseActiveAnchor(segment, {
      hasNewPointSignal,
      directTop,
      phraseTarget,
      currentAnchor,
    });

    if (phraseTarget?.entry && phraseTarget.mode === "child") {
      return {
        type: "create_child_top",
        parentTopId: phraseTarget.entry.topId,
        titleSuggestion: this._buildSuggestedTitle(segmentText),
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: phraseTarget.reason,
        nextAnchorTopId: phraseTarget.entry.topId,
      };
    }

    if (directTop && hasNewPointSignal) {
      return {
        type: "create_child_top",
        parentTopId: directTop.entry.topId,
        titleSuggestion: this._buildSuggestedTitle(segmentText),
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: `new_point_under_existing:${directTop.reason}`,
        nextAnchorTopId: directTop.entry.topId,
      };
    }

    if (phraseTarget?.entry && phraseTarget.mode === "append") {
      return {
        type: "append_to_top",
        targetTopId: phraseTarget.entry.topId,
        titleSuggestion: null,
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: phraseTarget.reason,
        nextAnchorTopId: phraseTarget.entry.topId,
      };
    }

    if (directTop) {
      return {
        type: "append_to_top",
        targetTopId: directTop.entry.topId,
        titleSuggestion: null,
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: directTop.reason,
        nextAnchorTopId: directTop.entry.topId,
      };
    }

    if (allowAnchorAppend) {
      return {
        type: "append_to_top",
        targetTopId: currentAnchor.topId,
        titleSuggestion: null,
        textSuggestion: segmentText,
        sourceExcerpt: segmentText,
        mappingReason: `context_anchor_append:${currentAnchor.title}`,
        nextAnchorTopId: currentAnchor.topId,
      };
    }

    return {
      type: "manual_assign_child_top",
      titleSuggestion: this._buildSuggestedTitle(segmentText),
      textSuggestion: segmentText,
      sourceExcerpt: segmentText,
      mappingReason: hasNewPointSignal
        ? "manual_assign_new_point_without_safe_parent"
        : "manual_assign_no_safe_match",
      nextAnchorTopId: null,
    };
  }

  _createSuggestionPayload({ audioImportId, meeting, mapped }) {
    return {
      audioImportId,
      meetingId: meeting.id,
      projectId: meeting.project_id,
      type: mapped.type,
      targetTopId: mapped.targetTopId || null,
      parentTopId: mapped.parentTopId || null,
      titleSuggestion: mapped.titleSuggestion || null,
      textSuggestion: mapped.textSuggestion || "",
      sourceExcerpt: mapped.sourceExcerpt || "",
      confidence: null,
      status: "pending",
      mappingReason: mapped.mappingReason || "phase5_rule_based",
    };
  }

  createDemoSuggestion({ meetingId, demoType }) {
    if (!meetingId) throw new Error("meetingId required");
    const mode = String(demoType || "").trim();
    if (!mode) throw new Error("demoType required");

    const meeting = this._getMeetingOrThrow(meetingId);
    const audioImport = this._createDemoAudioImport(meeting, mode);

    if (mode === "append_to_top") {
      const target = this._pickAppendTarget(meeting.id);
      const targetLabel = this._topLabel({
        topId: target.id,
        number: target.number,
        title: target.title,
      });
      const suggestion = this.audioSuggestionsRepo.createSuggestion({
        audioImportId: audioImport.id,
        meetingId: meeting.id,
        projectId: meeting.project_id,
        type: "append_to_top",
        targetTopId: target.id,
        titleSuggestion: "Test: Bestehenden TOP ergaenzen",
        textSuggestion: `Demo-Append: Dieser Text soll an den bestehenden Langtext von "${targetLabel}" angehaengt werden.`,
        sourceExcerpt: `Stub-Ziel fuer append_to_top: ${targetLabel}`,
        confidence: 0.99,
        status: "pending",
        mappingReason: "phase3_demo_append",
      });
      return {
        suggestions: [suggestion],
        message: `Demo-Vorschlag fuer append_to_top wurde fuer "${targetLabel}" angelegt.`,
      };
    }

    if (mode === "create_child_top") {
      const parent = this._pickParentTarget(meeting.id);
      const parentLabel = this._topLabel({
        topId: parent.id,
        number: parent.number,
        title: parent.title,
      });
      const suggestion = this.audioSuggestionsRepo.createSuggestion({
        audioImportId: audioImport.id,
        meetingId: meeting.id,
        projectId: meeting.project_id,
        type: "create_child_top",
        parentTopId: parent.id,
        titleSuggestion: "Test-Unterpunkt fuer create_child_top",
        textSuggestion: `Demo-Child: Dieser neue TOP soll unter "${parentLabel}" angelegt werden.`,
        sourceExcerpt: `Stub-Parent fuer create_child_top: ${parentLabel}`,
        confidence: 0.99,
        status: "pending",
        mappingReason: "phase3_demo_child",
      });
      return {
        suggestions: [suggestion],
        message: `Demo-Vorschlag fuer create_child_top wurde unter "${parentLabel}" angelegt.`,
      };
    }

    if (mode === "manual_assign_child_top") {
      const suggestion = this.audioSuggestionsRepo.createSuggestion({
        audioImportId: audioImport.id,
        meetingId: meeting.id,
        projectId: meeting.project_id,
        type: "manual_assign_child_top",
        titleSuggestion: "Test: Manuell zuordnen",
        textSuggestion:
          "Demo-Manuell: Dieser Vorschlag soll unter dem Bereich 'Manuell zuordnen' angelegt werden.",
        sourceExcerpt: "Stub-Ziel: Manuell zuordnen",
        confidence: 0.5,
        status: "pending",
        mappingReason: "phase3_demo_manual_assign",
      });
      return {
        suggestions: [suggestion],
        message: "Demo-Vorschlag fuer manual_assign_child_top wurde angelegt.",
      };
    }

    throw new Error(`Unbekannter demoType: ${mode}`);
  }

  analyze({ audioImportId }) {
    if (!audioImportId) throw new Error("audioImportId required");

    _audioLog("start", { audioImportId });

    const audioImport = this.audioImportsRepo.getById(audioImportId);
    if (!audioImport) throw new Error("Audio-Import nicht gefunden");

    const meeting = this._getMeetingOrThrow(audioImport.meeting_id);
    const transcript = this.transcriptsRepo.getByAudioImportId(audioImportId);
    if (!transcript?.full_text) {
      throw new Error("Kein Transkript fuer den Audio-Import vorhanden");
    }

    const segments = this.segmentationService.segmentTranscript(transcript);
    const workingCard = this._buildWorkingCard(meeting.id);
    _audioLog("context", {
      audioImportId,
      segmentCount: segments.length,
      workingCardCount: workingCard.length,
    });

    this.transcriptsRepo.upsertTranscript({
      audioImportId,
      engine: transcript.engine,
      language: transcript.language,
      fullText: transcript.full_text,
      segmentsJson: JSON.stringify(segments),
    });

    this.audioSuggestionsRepo.deletePendingByAudioImport(audioImportId);

    const created = [];
    let anchorTopId = null;
    for (const segment of segments) {
      const mapped = this._mapSegment(segment, workingCard, { anchorTopId });
      if (!mapped) continue;

      if (Object.prototype.hasOwnProperty.call(mapped, "nextAnchorTopId")) {
        anchorTopId = mapped.nextAnchorTopId || null;
      }

      if (!mapped.type) {
        continue;
      }

      const suggestion = this.audioSuggestionsRepo.createSuggestion(
        this._createSuggestionPayload({
          audioImportId,
          meeting,
          mapped,
        })
      );
      created.push(suggestion);
    }

    this.audioImportsRepo.updateStatus({
      audioImportId,
      status: "analyzed",
      errorMessage: null,
    });

    _audioLog("completed", {
      audioImportId,
      createdSuggestions: created.length,
      segmentCount: segments.length,
    });

    return {
      suggestions: created,
      segmentCount: segments.length,
      stub: false,
      message:
        "Transkript wurde segmentiert und konservativ gegen die bestehende TOP-Struktur geprueft. Unsichere Inhalte wurden nach 'Manuell zuordnen' geleitet.",
    };
  }
}

function createMeetingMappingService(deps) {
  return new MeetingMappingService(deps);
}

module.exports = {
  MeetingMappingService,
  createMeetingMappingService,
};
