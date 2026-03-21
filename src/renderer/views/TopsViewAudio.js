export function initTopsViewAudioState(view) {
  view._audioPanel = null;
  view._audioPanelBusy = false;
  view._audioPanelStatusMessage = "";
  view._audioDictationBusy = false;
  view._audioDictationActive = false;
  view._audioDictationTarget = null;
  view._audioRecorder = null;
  view._audioStream = null;
  view._lastDictation = null;
  view._termCorrections = new Map();
  view._termPromptEl = null;
  view._termPromptCleanup = null;
  view._pendingTermPrompt = null;
  view._audioLicensed = false;
  view._audioLicenseChecked = false;
  view._audioLicenseMessage = "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
  view._audioLicenseLoading = null;
  view._audioDevOverride = false;
  view._audioDevOverrideChecked = false;
  view._audioDevOverrideLoading = null;
  view._audioSuggestionsDevEnabled = false;
  view._audioSuggestionsDevChecked = false;
  view._audioSuggestionsDevLoading = null;
  view._audioSuggestionMarkTimer = null;
}

export function attachTopsViewAudio(TopsViewClass) {
  Object.assign(TopsViewClass.prototype, {
  _formatAudioLicenseMessage(status = null) {
    if (status?.valid) {
      return "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
    }

    const reason = String(status?.reason || "").trim();
    switch (reason) {
      case "NO_LICENSE":
        return "Audio erfordert eine gueltige Lizenz.";
      case "LICENSE_EXPIRED":
        return "Audio ist gesperrt, weil die Lizenz abgelaufen ist.";
      case "WRONG_MACHINE":
        return "Audio ist gesperrt, weil diese Lizenz zu einem anderen Rechner gehoert.";
      case "PUBLIC_KEY_INVALID":
      case "PUBLIC_KEY_MISSING":
        return "Audio bleibt gesperrt, weil die lokale Signaturpruefung nicht vollstaendig eingerichtet ist.";
      default:
        return "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.";
    }
  },

  _buildLockedAudioPanelState(message) {
    return {
      title: "Sprachdatei auswerten",
      modeLabel: "Pruefmodus",
      busy: false,
      statusMessage: String(message || this._audioLicenseMessage || "").trim(),
      suggestions: [],
      audioImport: null,
      transcript: null,
      parentOptions: this._getAudioParentOptions(),
      onImportAudio: async () => {},
      onCreateDemoSuggestion: async () => {},
      onApplySuggestion: async () => {},
      onFocusSuggestion: async () => {},
      onRejectSuggestion: async () => {},
    };
  },

  _setAudioLicenseState(licensed, message = "") {
    this._audioLicensed = !!licensed;
    this._audioLicenseChecked = true;
    this._audioLicenseMessage = this._audioLicensed
      ? ""
      : (String(message || "").trim() || "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.");
    this._updateDictationButtons();

    if (this.root) {
      this.applyEditBoxState();
    }

    if (this._audioPanel && !this._audioLicensed) {
      this._audioPanelBusy = false;
      this._audioPanelStatusMessage = this._audioLicenseMessage;
      this._audioPanel.update(this._buildLockedAudioPanelState(this._audioPanelStatusMessage));
    }
  },

  async _loadAudioLicenseState(force = false) {
    if (!force && this._audioLicenseChecked) return this._audioLicensed;
    if (!force && this._audioLicenseLoading) return this._audioLicenseLoading;

    const task = (async () => {
      const devOverride = await this._loadAudioDevOverrideState(force);
      await this._loadAudioSuggestionsDevFlag(force);
      if (devOverride) {
        this._setAudioLicenseState(true, "");
        return true;
      }

      const api = window.bbmDb || {};
      if (typeof api.licenseGetStatus !== "function") {
        this._setAudioLicenseState(false, "Lizenzstatus ist nicht verfuegbar. Audio bleibt gesperrt.");
        return false;
      }

      try {
        const res = await api.licenseGetStatus();
        const features = Array.isArray(res?.features)
          ? res.features.map((value) => String(value || "").trim().toLowerCase())
          : [];
        const licensed = !!res?.ok && !!res?.valid && features.includes("audio");
        this._setAudioLicenseState(licensed, this._formatAudioLicenseMessage(res));
        return licensed;
      } catch (_err) {
        this._setAudioLicenseState(false, "Lizenzstatus konnte nicht geladen werden. Audio bleibt gesperrt.");
        return false;
      } finally {
        this._audioLicenseLoading = null;
      }
    })();

    this._audioLicenseLoading = task;
    return task;
  },

  async _loadAudioDevOverrideState(force = false) {
    if (!force && this._audioDevOverrideChecked) return this._audioDevOverride;
    if (!force && this._audioDevOverrideLoading) return this._audioDevOverrideLoading;

    const task = (async () => {
      const api = window.bbmDb || {};
      const readDevFallback = async () => {
        if (typeof api.appGetBuildChannel === "function") {
          try {
            const res = await api.appGetBuildChannel();
            const channel = String(res?.channel || "").trim().toLowerCase();
            if (res?.ok && channel === "dev") return true;
          } catch (_err) {
            // ignore
          }
        }
        if (typeof api.appIsPackaged !== "function") return false;
        try {
          const packaged = await api.appIsPackaged();
          return packaged === false;
        } catch (_err) {
          return false;
        }
      };

      if (typeof api.devAudioUnlockStatus !== "function") {
        this._audioDevOverride = await readDevFallback();
        this._audioDevOverrideChecked = true;
        this._updateDictationButtons();
        return this._audioDevOverride;
      }

      try {
        const res = await api.devAudioUnlockStatus();
        const enabled = !!res?.ok && !!res?.enabled;
        const fallback = enabled ? false : await readDevFallback();
        this._audioDevOverride = enabled;
        this._audioDevOverrideChecked = true;
        this._updateDictationButtons();
        if (fallback) {
          this._audioDevOverride = true;
          this._updateDictationButtons();
          return true;
        }
        return enabled;
      } catch (_err) {
        this._audioDevOverride = await readDevFallback();
        this._audioDevOverrideChecked = true;
        this._updateDictationButtons();
        return this._audioDevOverride;
      } finally {
        this._audioDevOverrideLoading = null;
      }
    })();

    this._audioDevOverrideLoading = task;
    return task;
  },

  async _loadAudioSuggestionsDevFlag(force = false) {
    if (!force && this._audioSuggestionsDevChecked) return this._audioSuggestionsDevEnabled;
    if (!force && this._audioSuggestionsDevLoading) return this._audioSuggestionsDevLoading;

    const task = (async () => {
      const api = window.bbmDb || {};
      if (typeof api.devAudioSuggestionsEnabled !== "function") {
        this._audioSuggestionsDevEnabled = false;
        this._audioSuggestionsDevChecked = true;
        this._applyReadOnlyState();
        return this._audioSuggestionsDevEnabled;
      }

      try {
        const res = await api.devAudioSuggestionsEnabled();
        this._audioSuggestionsDevEnabled = !!res?.ok && !!res?.enabled;
        this._audioSuggestionsDevChecked = true;
        this._applyReadOnlyState();
        return this._audioSuggestionsDevEnabled;
      } catch (_err) {
        this._audioSuggestionsDevEnabled = false;
        this._audioSuggestionsDevChecked = true;
        this._applyReadOnlyState();
        return this._audioSuggestionsDevEnabled;
      } finally {
        this._audioSuggestionsDevLoading = null;
      }
    })();

    this._audioSuggestionsDevLoading = task;
    return task;
  },

  async _ensureAudioAvailable({ alertOnFailure = true, force = false } = {}) {
    const licensed = await this._loadAudioLicenseState(force);
    if (licensed) return true;

    if (alertOnFailure) {
      alert(this._audioLicenseMessage || "Audio-Funktion ist fuer diese Lizenz nicht freigeschaltet.");
    }
    return false;
  },

  _updateDictationButtons() {
    const effectiveTop = this.selectedTop || this._findTopById?.(this.selectedTopId) || null;
    if (!this.selectedTop && effectiveTop) this.selectedTop = effectiveTop;
    const baseDisabled = !!this._audioDictationBusy;
    const audioLocked = !this._audioLicensed && !this._audioDevOverride;
    const isRecording = !!this._audioDictationActive;
    const activeTarget = this._audioDictationTarget;

    if (this.btnTitleDictate) {
      const disabled = baseDisabled || audioLocked || (isRecording && activeTarget !== "shortText");
      this.btnTitleDictate.disabled = disabled;
      this.btnTitleDictate.style.opacity = disabled ? "0.6" : "1";
      this.btnTitleDictate.textContent =
        isRecording && activeTarget === "shortText" ? "Stop" : "Diktat";
      this.btnTitleDictate.style.background =
        isRecording && activeTarget === "shortText" ? "#ffebee" : "#f7f9fb";
      this.btnTitleDictate.style.color =
        isRecording && activeTarget === "shortText" ? "#b71c1c" : "#0b4db4";
      this.btnTitleDictate.title = audioLocked
        ? this._audioLicenseMessage
        : "Spracheingabe fuer Kurztext";
    }

    if (this.btnLongDictate) {
      const disabled = baseDisabled || audioLocked || (isRecording && activeTarget !== "longText");
      this.btnLongDictate.disabled = disabled;
      this.btnLongDictate.style.opacity = disabled ? "0.6" : "1";
      this.btnLongDictate.textContent =
        isRecording && activeTarget === "longText" ? "Stop" : "Diktat";
      this.btnLongDictate.style.background =
        isRecording && activeTarget === "longText" ? "#ffebee" : "#f7f9fb";
      this.btnLongDictate.style.color =
        isRecording && activeTarget === "longText" ? "#b71c1c" : "#0b4db4";
      this.btnLongDictate.title = audioLocked
        ? this._audioLicenseMessage
        : "Spracheingabe fuer Langtext";
    }
  },

  _applyDictationTextToField(targetField, transcriptText) {
    const text = String(transcriptText || "").trim();
    if (!text) return;

    if (targetField === "shortText") {
      const next = this._normTitle(text);
      if (this.inpTitle) {
        this.inpTitle.value = this._clampStr(next, this._titleMax());
        this.inpTitle.focus();
        this.inpTitle.select?.();
      }
      this._lastDictation = { field: "shortText", text: next, at: Date.now() };
    } else if (targetField === "longText") {
      const current = this.taLongtext ? String(this.taLongtext.value || "") : "";
      const joined = current ? `${current.replace(/\s+$/g, "")}\n${text}` : text;
      const next = this._normLong(joined);
      if (this.taLongtext) {
        this.taLongtext.value = this._clampStr(next, this._longMax());
        this.taLongtext.focus();
      }
      this._lastDictation = { field: "longText", text: text, at: Date.now() };
    }

    this._updateCharCounters();
  },

  _cleanupDictationText(text) {
    let cleaned = String(text || "").trim();
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

    return this._applyDictationDictionary(cleaned);
  },

  _normalizeTerm(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  },

  _applyDictationDictionary(text) {
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
    replaceWord(/\bschacht\s?hoehen\b/gi, "SchachthÃ¶hen");
    replaceWord(/\bschachthoehen\b/gi, "SchachthÃ¶hen");
    replaceWord(/\bschachthohen\b/gi, "SchachthÃ¶hen");
    replaceWord(/\bsohlen\b/gi, "Sohlen");
    replaceWord(/\babsteckung\b/gi, "Absteckung");
    replaceWord(/\bgeruestpruefung\b/gi, "GerÃ¼stprÃ¼fung");
    replaceWord(/\bgeruest pruefung\b/gi, "GerÃ¼stprÃ¼fung");
    replaceWord(/\bstatik\b/gi, "Statik");
    replaceWord(/\bbauzaun\b/gi, "Bauzaun");

    out = out.replace(/\bSchachthÃ¶hen\s+Sohlen\b/gi, "SchachthÃ¶hen (Sohlen)");
    out = this._applyProjectTermCorrections(out);
    return out;
  },

  _applyProjectTermCorrections(text) {
    let out = String(text || "");
    if (!this._termCorrections || this._termCorrections.size === 0) return out;

    for (const [wrongTerm, correctTerm] of this._termCorrections.entries()) {
      if (!wrongTerm || !correctTerm) continue;
      const pattern = new RegExp(`\\b${wrongTerm.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi");
      out = out.replace(pattern, (match) => {
        const first = match[0];
        if (first && first === first.toUpperCase()) {
          return correctTerm[0].toUpperCase() + correctTerm.slice(1);
        }
        return correctTerm;
      });
    }

    return out;
  },

  async _loadProjectTermCorrections(force = false) {
    if (!this.projectId) return;
    if (!force && this._termCorrections?.size) return;
    const api = window.bbmDb || {};
    if (typeof api.audioTermCorrectionsList !== "function") return;

    try {
      const res = await api.audioTermCorrectionsList({ projectId: this.projectId });
      if (!res?.ok) return;
      const map = new Map();
      const list = Array.isArray(res.list) ? res.list : [];
      for (const row of list) {
        const wrong = String(row?.wrong_term || row?.wrongTerm || "").trim();
        const correct = String(row?.correct_term || row?.correctTerm || "").trim();
        if (!wrong || !correct) continue;
        map.set(this._normalizeTerm(wrong), correct);
      }
      this._termCorrections = map;
    } catch (_err) {
      // ignore
    }
  },

  _detectSimpleTermCorrection(originalText, editedText) {
    const original = this._cleanupDictationText(originalText);
    const edited = this._cleanupDictationText(editedText);
    if (!original || !edited) return null;
    if (original === edited) return null;

    const wordRe = /[\p{L}\p{N}\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df-]+/gu;
    const origWords = original.match(wordRe) || [];
    const editWords = edited.match(wordRe) || [];
    if (origWords.length === 0 || editWords.length === 0) return null;
    if (origWords.length !== editWords.length) return null;

    let diffIndex = -1;
    for (let i = 0; i < origWords.length; i += 1) {
      if (origWords[i].toLowerCase() !== editWords[i].toLowerCase()) {
        if (diffIndex !== -1) return null;
        diffIndex = i;
      }
    }
    if (diffIndex === -1) return null;

    const wrongTerm = origWords[diffIndex].trim();
    const correctTerm = editWords[diffIndex].trim();
    if (!wrongTerm || !correctTerm) return null;
    if (wrongTerm.length < 3 || correctTerm.length < 3) return null;
    if (wrongTerm.length > 40 || correctTerm.length > 40) return null;
    if (wrongTerm.toLowerCase() === correctTerm.toLowerCase()) return null;

    return { wrongTerm, correctTerm };
  },

  _showTermCorrectionPrompt({ field, wrongTerm, correctTerm, anchorEl }) {
    if (!anchorEl) return;
    if (this._termPromptEl) {
      this._termPromptEl.remove();
      this._termPromptEl = null;
    }

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "10px";
    wrap.style.marginTop = "4px";
    wrap.style.padding = "4px 8px";
    wrap.style.border = "1px solid #ffe0b2";
    wrap.style.background = "#fff8e1";
    wrap.style.borderRadius = "6px";
    wrap.style.fontSize = "12px";
    wrap.style.color = "#5d4037";
    wrap.style.zIndex = "5";

    const text = document.createElement("div");
    text.textContent = `Korrektur merken? '${wrongTerm}' â†’ '${correctTerm}'`;

    const btnYes = document.createElement("button");
    btnYes.type = "button";
    btnYes.textContent = "Merken";
    btnYes.style.border = "1px solid #cfd8dc";
    btnYes.style.background = "#f7f9fb";
    btnYes.style.borderRadius = "6px";
    btnYes.style.padding = "3px 8px";
    btnYes.style.cursor = "pointer";

    const btnNo = document.createElement("button");
    btnNo.type = "button";
    btnNo.textContent = "Nein";
    btnNo.style.border = "1px solid #cfd8dc";
    btnNo.style.background = "#f7f9fb";
    btnNo.style.borderRadius = "6px";
    btnNo.style.padding = "3px 8px";
    btnNo.style.cursor = "pointer";

    wrap.append(text, btnYes, btnNo);
    anchorEl.insertAdjacentElement("afterend", wrap);
    this._termPromptEl = wrap;

    const cleanup = () => {
      if (this._termPromptEl) this._termPromptEl.remove();
      this._termPromptEl = null;
      if (this._termPromptCleanup) this._termPromptCleanup = null;
    };

    btnNo.onclick = () => cleanup();
    btnYes.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.audioTermCorrectionUpsert === "function" && this.projectId) {
        await api.audioTermCorrectionUpsert({
          projectId: this.projectId,
          wrongTerm,
          correctTerm,
        });
        this._termCorrections.set(this._normalizeTerm(wrongTerm), correctTerm);
      }
      cleanup();
    };

    this._termPromptCleanup = cleanup;
  },

  _maybeOfferTermCorrection(field, newValue, anchorEl) {
    const last = this._lastDictation;
    if (!last || last.field !== field) return;
    const maxAgeMs = 10 * 60 * 1000;
    if (Date.now() - (last.at || 0) > maxAgeMs) {
      this._lastDictation = null;
      return;
    }

    const correction = this._detectSimpleTermCorrection(last.text || "", newValue || "");
    this._lastDictation = null;
    if (!correction) return;

    const normalizedWrong = this._normalizeTerm(correction.wrongTerm);
    if (this._termCorrections.has(normalizedWrong)) return;
    this._pendingTermPrompt = {
      field,
      wrongTerm: correction.wrongTerm,
      correctTerm: correction.correctTerm,
      topId: this.selectedTop?.id ?? null,
      at: Date.now(),
    };
    this._showTermCorrectionPrompt({
      field,
      wrongTerm: correction.wrongTerm,
      correctTerm: correction.correctTerm,
      anchorEl,
    });
  },

  _tryShowPendingTermPrompt() {
    const pending = this._pendingTermPrompt;
    if (!pending) return;
    if (!this.selectedTop || !this._sameTopId(this.selectedTop.id, pending.topId)) return;
    if (Date.now() - (pending.at || 0) > 2 * 60 * 1000) {
      this._pendingTermPrompt = null;
      return;
    }
    const anchorEl = pending.field === "shortText" ? this.inpTitle : this.taLongtext;
    if (!anchorEl) return;
    this._showTermCorrectionPrompt({
      field: pending.field,
      wrongTerm: pending.wrongTerm,
      correctTerm: pending.correctTerm,
      anchorEl,
    });
    this._pendingTermPrompt = null;
  },

  _deriveShortTextFromDictation(text) {
    const cleaned = this._cleanupDictationText(text).replace(/^[.!?;,:-]+\s*/g, "").trim();
    if (!cleaned) return "";

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
    if (!title) return cleaned;

    const stop = new Set([
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

    const words = title.split(/\s+/).filter(Boolean);
    while (words.length > 2) {
      const last = words[words.length - 1].toLowerCase();
      if (!stop.has(last)) break;
      words.pop();
    }
    const compact = words.join(" ").trim();
    if (compact.length >= 6) return compact;
    return title;
  },

  async _runFieldDictation(targetField) {
    if (this._audioDictationActive && this._audioDictationTarget === targetField) {
      await this._stopFieldDictation();
      return;
    }
    await this._startFieldDictation(targetField);
  },

  async _startFieldDictation(targetField) {
    if (!(await this._ensureAudioAvailable())) return;
    if (this._audioDictationBusy || this._audioDictationActive) return;
    if (!this.selectedTop) {
      const fallbackTop = this._findTopById?.(this.selectedTopId) || null;
      if (fallbackTop) this.selectedTop = fallbackTop;
    }
    if (!this.selectedTop) {
      alert("Bitte zuerst einen TOP auswaehlen.");
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      alert("Mikrofonaufnahme wird nicht unterstuetzt.");
      return;
    }

    this._audioDictationBusy = true;
    this._updateDictationButtons();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      const mimeType =
        preferredTypes.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event?.data && event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        await this._handleDictationBlob(blob, recorder._bbmTargetField || targetField);
      };

      recorder.start();
      recorder._bbmTargetField = targetField;
      this._audioRecorder = recorder;
      this._audioStream = stream;
      this._audioDictationActive = true;
      this._audioDictationTarget = targetField;
    } catch (err) {
      alert(err?.message || String(err));
    } finally {
      this._audioDictationBusy = false;
      this._updateDictationButtons();
    }
  },

  async _stopFieldDictation() {
    if (!this._audioRecorder) return;
    try {
      this._audioRecorder.stop();
    } catch (_err) {
      // ignore
    }
    if (this._audioStream) {
      this._audioStream.getTracks().forEach((track) => track.stop());
    }
    this._audioRecorder = null;
    this._audioStream = null;
    this._audioDictationActive = false;
    this._audioDictationTarget = null;
    this._updateDictationButtons();
  },

  async _handleDictationBlob(blob, targetField) {
    if (!blob || !blob.size) {
      alert("Aufnahme ist leer.");
      return;
    }

    const api = window.bbmDb || {};
    if (typeof api.audioTranscribeBlob !== "function") {
      alert("Audio-Transkription ist nicht verfuegbar.");
      return;
    }

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || "");
        const payload = result.includes(",") ? result.split(",").pop() : result;
        resolve(payload || "");
      };
      reader.onerror = () => reject(reader.error || new Error("Datei konnte nicht gelesen werden"));
      reader.readAsDataURL(blob);
    });

    this._audioDictationBusy = true;
    this._updateDictationButtons();

    try {
      const res = await api.audioTranscribeBlob({
        meetingId: this.meetingId,
        projectId: this.projectId || null,
        mimeType: blob.type || "audio/webm",
        base64,
      });
      if (!res?.ok) {
        throw new Error(res?.error || "Transkription fehlgeschlagen.");
      }
      const transcriptText = String(res?.transcript?.full_text || "").trim();
      if (!transcriptText) {
        alert("Transkription ist leer.");
        return;
      }
      const cleanedText = this._cleanupDictationText(transcriptText);
      if (targetField === "shortText") {
        const shortText = this._deriveShortTextFromDictation(cleanedText) || cleanedText;
        this._applyDictationTextToField("shortText", shortText);
      } else {
        this._applyDictationTextToField(targetField || "longText", cleanedText);
      }
    } catch (err) {
      alert(err?.message || String(err));
    } finally {
      this._audioDictationBusy = false;
      this._updateDictationButtons();
    }
  },

  _manualAssignTitle() {
    return "Manuell zuordnen";
  },

  _normalizeManualAssignTitle(value) {
    return String(value || "").trim().toLocaleLowerCase("de-DE");
  },

  _findManualAssignTop() {
    const target = this._normalizeManualAssignTitle(this._manualAssignTitle());
    return (
      (this.items || []).find((item) => {
        return Number(item?.level) === 1 && this._normalizeManualAssignTitle(item?.title) === target;
      }) || null
    );
  },

  _hasManualAssignChildren() {
    const manualAssignTop = this._findManualAssignTop();
    if (!manualAssignTop?.id) return false;
    const itemById = new Map((this.items || []).map((item) => [String(item.id), item]));
    const rootId = String(manualAssignTop.id);
    return (this.items || []).some((item) => {
      if (Number(item?.is_hidden || 0) === 1) return false;
      let parentId = String(item?.parent_top_id || "").trim();
      while (parentId) {
        if (parentId === rootId) return true;
        parentId = String(itemById.get(parentId)?.parent_top_id || "").trim();
      }
      return false;
    });
  },

  _getAudioParentOptions() {
    const list = Array.isArray(this.items) ? this.items : [];
    return list
      .filter((item) => {
        const level = Number(item?.level || 0);
        return Number(item?.is_hidden || 0) !== 1 && level >= 1 && level < 4;
      })
      .map((item) => {
        const level = Math.max(1, Number(item?.level || 1));
        const prefix = level > 1 ? `${"  ".repeat(level - 1)}- ` : "";
        const number = String(item?.number || "").trim();
        const title = String(item?.title || "").trim();
        const label = `${prefix}${number ? `${number} ` : ""}${title || item?.id || ""}`.trim();
        return {
          id: String(item.id),
          label,
          level,
        };
      });
  },

  async _focusAudioSuggestion(suggestion, options = {}) {
    const overrideParentTopId = String(options?.overrideParentTopId || "").trim() || null;
    const type = String(suggestion?.type || "").trim();

    let targetTopId = null;
    if (type === "append_to_top") {
      targetTopId = String(suggestion?.target_top_id || suggestion?.targetTopId || "").trim() || null;
    } else if (overrideParentTopId) {
      targetTopId = overrideParentTopId;
    } else if (type === "create_child_top") {
      targetTopId = String(suggestion?.parent_top_id || suggestion?.parentTopId || "").trim() || null;
    } else if (type === "manual_assign_child_top") {
      targetTopId = String(this._findManualAssignTop()?.id || "").trim() || null;
    }

    if (!targetTopId) return;
    const target = this._findTopById(targetTopId);
    if (!target) return;

    this.selectedTopId = target.id;
    this.selectedTop = target;
    this._userSelectedTop = true;
    this.applyEditBoxState();
    this._updateDictationButtons();
    this._updateMoveControls();
    this._updateDeleteControls();
    this._updateCreateChildControls();
    this._setMarkedTopIds([target.id]);

    if (this._audioSuggestionMarkTimer) {
      clearTimeout(this._audioSuggestionMarkTimer);
      this._audioSuggestionMarkTimer = null;
    }
    this._audioSuggestionMarkTimer = setTimeout(() => {
      this._clearMarkedTopIds();
      this._audioSuggestionMarkTimer = null;
    }, 2500);

    this._renderListOnly();
    requestAnimationFrame(() => this._scrollListToSelectedAndEnd());
  },

  async _warnAboutManualAssignBeforeClose() {
    if (!this._hasManualAssignChildren()) return true;
    return window.confirm(
      "Im Bereich 'Manuell zuordnen' befinden sich noch nicht zugeordnete Punkte.\n\nTrotzdem abschlieÃŸen?"
    );
  },

  async _loadAudioSuggestions() {
    if (!(await this._ensureAudioAvailable({ alertOnFailure: false }))) {
      return { suggestions: [], audioImport: null, transcript: null };
    }

    if (!this.meetingId || typeof window?.bbmDb?.audioGetSuggestions !== "function") {
      return { suggestions: [], audioImport: null, transcript: null };
    }

    const res = await window.bbmDb.audioGetSuggestions({
      meetingId: this.meetingId,
      status: "pending",
    });
    if (!res?.ok) throw new Error(res?.error || "Vorschl?ge konnten nicht geladen werden.");
    return {
      suggestions: Array.isArray(res.list) ? res.list : [],
      audioImport: res.audioImport || null,
      transcript: res.transcript || null,
    };
  },

  async _refreshAudioPanel(options = {}) {
    const panel = this._getAudioPanel();
    const forceMessage =
      options && Object.prototype.hasOwnProperty.call(options, "statusMessage")
        ? options.statusMessage
        : undefined;

    if (!(await this._loadAudioLicenseState())) {
      panel.update(
        this._buildLockedAudioPanelState(
          forceMessage !== undefined ? String(forceMessage || "") : this._audioLicenseMessage
        )
      );
      return;
    }

    try {
      const audioState = await this._loadAudioSuggestions();
      const suggestions = Array.isArray(audioState?.suggestions) ? audioState.suggestions : [];
      const fallbackMessage = suggestions.length
        ? ""
        : "Aktuell liegen keine Vorschl?ge vor. Die Transkription ist real angebunden, die Zuordnungslogik bleibt noch Platzhalter.";
      panel.update({
        title: "Sprachdatei auswerten",
        modeLabel: "Pr?fmodus",
        busy: !!this._audioPanelBusy,
        statusMessage:
          forceMessage !== undefined
            ? String(forceMessage || "")
            : (this._audioPanelStatusMessage || fallbackMessage),
        suggestions,
        audioImport: audioState?.audioImport || null,
        transcript: audioState?.transcript || null,
        parentOptions: this._getAudioParentOptions(),
        onImportAudio: async () => this._runAudioImportFlow(),
        onCreateDemoSuggestion: async (demoType) => this._createDemoAudioSuggestion(demoType),
        onApplySuggestion: async (suggestion, extra = {}) => this._applyAudioSuggestion(suggestion, extra),
        onFocusSuggestion: async (suggestion, extra = {}) => this._focusAudioSuggestion(suggestion, extra),
        onRejectSuggestion: async (suggestion) => this._rejectAudioSuggestion(suggestion),
      });
    } catch (err) {
      panel.update({
        title: "Sprachdatei auswerten",
        modeLabel: "Pr?fmodus",
        busy: !!this._audioPanelBusy,
        statusMessage: err?.message || String(err),
        suggestions: [],
        audioImport: null,
        transcript: null,
        parentOptions: this._getAudioParentOptions(),
        onImportAudio: async () => this._runAudioImportFlow(),
        onCreateDemoSuggestion: async (demoType) => this._createDemoAudioSuggestion(demoType),
        onApplySuggestion: async (suggestion, extra = {}) => this._applyAudioSuggestion(suggestion, extra),
        onFocusSuggestion: async (suggestion, extra = {}) => this._focusAudioSuggestion(suggestion, extra),
        onRejectSuggestion: async (suggestion) => this._rejectAudioSuggestion(suggestion),
      });
    }
  },

  async _openAudioPanel() {
    if (!this.meetingId || this.isReadOnly) return;
    const panel = this._getAudioPanel();

    if (!(await this._loadAudioLicenseState())) {
      panel.open(this._buildLockedAudioPanelState(this._audioLicenseMessage));
      return;
    }
    if (!(await this._loadAudioSuggestionsDevFlag())) {
      alert("Audio-Suggestions sind nur in der Entwicklung verfuegbar.");
      return;
    }

    panel.open({
      title: "Sprachdatei auswerten",
      modeLabel: "Pr?fmodus",
      busy: !!this._audioPanelBusy,
      statusMessage: this._audioPanelStatusMessage,
      suggestions: [],
      audioImport: null,
      transcript: null,
      parentOptions: this._getAudioParentOptions(),
      onImportAudio: async () => this._runAudioImportFlow(),
      onCreateDemoSuggestion: async (demoType) => this._createDemoAudioSuggestion(demoType),
      onApplySuggestion: async (suggestion, extra = {}) => this._applyAudioSuggestion(suggestion, extra),
      onFocusSuggestion: async (suggestion, extra = {}) => this._focusAudioSuggestion(suggestion, extra),
      onRejectSuggestion: async (suggestion) => this._rejectAudioSuggestion(suggestion),
    });
    await this._refreshAudioPanel();
  },

  async _runAudioImportFlow() {
    if (!this.meetingId || this.isReadOnly) return;
    if (!(await this._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (
      typeof api.audioImport !== "function" ||
      typeof api.audioTranscribe !== "function" ||
      typeof api.audioAnalyze !== "function"
    ) {
      alert("Audio-Funktionen sind nicht verfÃ¼gbar.");
      return;
    }

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Sprachdatei wird importiert...";
    await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

    try {
      const importRes = await api.audioImport({
        meetingId: this.meetingId,
        projectId: this.projectId || this.router?.currentProjectId || null,
        processingMode: "review",
      });
      if (importRes?.canceled) {
        this._audioPanelStatusMessage = "Auswahl abgebrochen.";
        return;
      }
      if (!importRes?.ok || !importRes.audioImport?.id) {
        throw new Error(importRes?.error || "Audio-Import fehlgeschlagen.");
      }

      const audioImportId = importRes.audioImport.id;
      this._audioPanelStatusMessage = "Lokale Transkription wird gestartet...";
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

      const transcribeRes = await api.audioTranscribe({ audioImportId });
      if (!transcribeRes?.ok) {
        throw new Error(transcribeRes?.error || "Transkription fehlgeschlagen.");
      }

      this._audioPanelStatusMessage = "Zuordnungslogik wird als Platzhalter ausgef?hrt...";
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

      const analyzeRes = await api.audioAnalyze({
        audioImportId,
        processingMode: "review",
      });
      if (!analyzeRes?.ok) {
        throw new Error(analyzeRes?.error || "Analyse fehlgeschlagen.");
      }

      this._audioPanelStatusMessage =
        analyzeRes?.message ||
        "Transkript gespeichert. Die TOP-Zuordnung bleibt in diesem Stand noch ein klar markierter Platzhalter.";
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
    }
  },

  async _createDemoAudioSuggestion(demoType) {
    if (!this.meetingId || this.isReadOnly) return;
    if (!(await this._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (typeof api.audioCreateDemoSuggestion !== "function") {
      alert("audioCreateDemoSuggestion ist nicht verfÃ¼gbar.");
      return;
    }

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Demo-Vorschlag wird angelegt...";
    await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

    try {
      const res = await api.audioCreateDemoSuggestion({
        meetingId: this.meetingId,
        demoType,
      });
      if (!res?.ok) {
        throw new Error(res?.error || "Demo-Vorschlag konnte nicht angelegt werden.");
      }
      this._audioPanelStatusMessage = res?.message || "Demo-Vorschlag wurde zur PrÃ¼fung angelegt.";
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
    }
  },

  async _applyAudioSuggestion(suggestion, options = {}) {
    if (!(await this._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (typeof api.audioApplySuggestion !== "function") {
      alert("audioApplySuggestion ist nicht verf?gbar.");
      return;
    }

    const suggestionId = String(suggestion?.id || "").trim();
    if (!suggestionId) return;

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Vorschlag wird ?bernommen...";
    await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

    try {
      const res = await api.audioApplySuggestion({
        suggestionId,
        overrideParentTopId: String(options?.overrideParentTopId || "").trim() || null,
      });
      if (!res?.ok) {
        throw new Error(res?.error || "Vorschlag konnte nicht ?bernommen werden.");
      }
      this._audioPanelStatusMessage = String(res?.message || "Vorschlag ?bernommen.");
      await this.reloadList(true);
      await this._focusAudioSuggestion(suggestion, options);
    } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
    }
  },

  async _rejectAudioSuggestion(suggestion) {
    if (!(await this._ensureAudioAvailable())) return;
    const api = window.bbmDb || {};
    if (typeof api.audioRejectSuggestion !== "function") {
      alert("audioRejectSuggestion ist nicht verfÃ¼gbar.");
      return;
    }

    const suggestionId = String(suggestion?.id || "").trim();
    if (!suggestionId) return;

    this._audioPanelBusy = true;
    this._audioPanelStatusMessage = "Vorschlag wird verworfen...";
    await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });

    try {
      const res = await api.audioRejectSuggestion({ suggestionId });
      if (!res?.ok) {
        throw new Error(res?.error || "Vorschlag konnte nicht verworfen werden.");
      }
      this._audioPanelStatusMessage = String(res?.message || "Vorschlag verworfen.");
  } catch (err) {
      this._audioPanelStatusMessage = err?.message || String(err);
    } finally {
      this._audioPanelBusy = false;
      await this._refreshAudioPanel({ statusMessage: this._audioPanelStatusMessage });
    }
  },
  });
}


