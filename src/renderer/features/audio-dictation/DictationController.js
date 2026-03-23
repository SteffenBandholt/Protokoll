import { TranscriptionService } from "../../services/audio/TranscriptionService.js";

export class DictationController {
  constructor({ view, ensureAudioAvailable }) {
    this.view = view;
    this.ensureAudioAvailable =
      typeof ensureAudioAvailable === "function" ? ensureAudioAvailable : async () => true;

    this._audioDictationBusy = false;
    this._audioDictationActive = false;
    this._audioDictationTarget = null;
    this._audioRecorder = null;
    this._audioStream = null;
    this._lastDictation = null;

    this._termCorrections = new Map();
    this._termCorrectionsLoaded = false;
    this._termCorrectionsLoading = null;
    this._termPromptEl = null;
    this._pendingTermPrompt = null;
    this.transcriptionService = new TranscriptionService();
  }

  updateButtons({ readOnly = null, busy = null, meetingId = null } = {}) {
    const view = this.view || {};
    const btnShort = view.btnTitleDictate;
    const btnLong = view.btnLongDictate;
    const ro = readOnly === null ? !!view.isReadOnly : !!readOnly;
    const isBusy = busy === null ? !!view._busy : !!busy;
    const hasMeeting = !!(meetingId === null ? view.meetingId : meetingId);
    const licensed = !!view._audioLicensed || !!view._audioDevOverride;
    const audioLocked = !licensed;
    const disabledBase = ro || isBusy || !hasMeeting || !view.selectedTop || audioLocked;

    const applyBtnState = (btn, isTarget) => {
      if (!btn) return;
      const active = this._audioDictationActive && isTarget;
      const disallowBecauseOtherTarget = this._audioDictationActive && !isTarget;
      btn.disabled = disabledBase || this._audioDictationBusy || disallowBecauseOtherTarget;
      btn.textContent = active ? "Stopp" : "Diktat";
      btn.style.opacity = btn.disabled ? "0.65" : "1";
      if (audioLocked && view._audioLicenseMessage) {
        btn.title = view._audioLicenseMessage;
      }
    };

    applyBtnState(btnShort, this._audioDictationTarget === "shortText");
    applyBtnState(btnLong, this._audioDictationTarget === "longText");
  }

  async start({ target, meetingId, projectId } = {}) {
    const tgt = target === "longText" ? "longText" : "shortText";
    if (this._audioDictationBusy) return;

    const prevTarget = this._audioDictationTarget;
    if (this._audioDictationActive) {
      await this._stopFieldDictation();
      this.updateButtons({ meetingId });
      if (prevTarget === tgt) {
        return;
      }
    }

    await this._startFieldDictation({ target: tgt, meetingId, projectId });
  }

  async _startFieldDictation({ target, meetingId, projectId }) {
    const view = this.view || {};
    const hasTop = !!(view.selectedTop || view.selectedTopId);
    if (!hasTop) return;
    if (!meetingId) {
      alert("Kein aktives Protokoll gefunden. Diktat nicht m\u00f6glich.");
      return;
    }

    const audioReady = await this.ensureAudioAvailable({ alertOnFailure: true, force: false });
    if (!audioReady) return;

    this._audioDictationTarget = target;
    this._audioDictationActive = true;
    this._audioDictationBusy = false;
    this.updateButtons({ meetingId });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._audioStream = stream;
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      this._audioRecorder = recorder;

      recorder.ondataavailable = (evt) => {
        if (evt?.data && evt.data.size > 0) chunks.push(evt.data);
      };

      recorder.onstop = async () => {
        const blob =
          chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" }) : null;
        await this._handleDictationBlob(blob, { target, meetingId, projectId });
      };

      recorder.start();
    } catch (err) {
      this._audioDictationActive = false;
      this._audioDictationTarget = null;
      alert(err?.message || "Audio-Aufnahme nicht m\u00f6glich.");
      this.updateButtons({ meetingId });
    }
  }

  async _stopFieldDictation() {
    if (this._audioRecorder) {
      try {
        if (this._audioRecorder.state === "recording") {
          this._audioRecorder.stop();
        }
      } catch (_err) {}
    }
    if (this._audioStream) {
      try {
        this._audioStream.getTracks().forEach((track) => track.stop());
      } catch (_err) {}
    }
    this._audioRecorder = null;
    this._audioStream = null;
    this._audioDictationActive = false;
    this._audioDictationTarget = null;
    this.updateButtons();
  }

  async _handleDictationBlob(blob, meta) {
    this._audioDictationActive = false;
    this._audioDictationBusy = true;
    this.updateButtons({ meetingId: meta?.meetingId });

    try {
      if (!blob) {
        return;
      }
      const base64 = await this._blobToBase64(blob);
      const res = await this.transcriptionService.transcribeBlob({
        base64,
        mimeType: blob.type || "audio/webm",
        meetingId: meta?.meetingId,
        projectId: meta?.projectId || null,
      });
      if (!res?.ok) {
        alert(res?.error || "Transkription fehlgeschlagen.");
        return;
      }

      const transcriptText =
        res?.transcript?.full_text ??
        res?.transcript?.fullText ??
        res?.full_text ??
        res?.fullText ??
        res?.transcriptText ??
        res?.text ??
        "";

      const cleaned = this._cleanupDictationText(transcriptText || "");
      await this._applyDictationTextToField(cleaned, meta?.target);
    } catch (err) {
      alert(err?.message || "Transkription fehlgeschlagen.");
    } finally {
      this._audioDictationBusy = false;
      this._audioDictationTarget = null;
      this.updateButtons({ meetingId: meta?.meetingId });
    }
  }

  async _blobToBase64(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

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

    cleaned = this._applyDictationDictionary(cleaned);
    cleaned = this._applyProjectTermCorrections(cleaned);
    return cleaned;
  }

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
    out = this._applyProjectTermCorrections(out);
    return out;
  }

  _applyProjectTermCorrections(text) {
    if (!this._termCorrections || this._termCorrections.size === 0) return text;
    let out = String(text || "");
    this._termCorrections.forEach((correctTerm, wrongTerm) => {
      if (!wrongTerm || !correctTerm) return;
      const pattern = new RegExp(`\\b${wrongTerm.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi");
      out = out.replace(pattern, (match) => {
        const first = match[0];
        if (first && first === first.toUpperCase()) {
          return correctTerm[0].toUpperCase() + correctTerm.slice(1);
        }
        return correctTerm;
      });
    });
    return out;
  }

  _normalizeTerm(term) {
    return String(term || "").trim().toLocaleLowerCase("de-DE");
  }

  _deriveShortTextFromDictation(text) {
    const view = this.view || {};
    const raw = String(text || "").trim();
    if (!raw) return "";
    const maxLen = typeof view._titleMax === "function" ? view._titleMax() : 100;
    const stopwords = ["also", "und", "oder", "aber", "dann", "ja", "nein"];
    let firstSentence = raw.split(/[.!?]/)[0] || raw;
    firstSentence = firstSentence.replace(/\s+/g, " ").trim();
    const words = firstSentence.split(" ").filter(Boolean);
    while (words.length > 0 && stopwords.includes(words[0].toLocaleLowerCase("de-DE"))) {
      words.shift();
    }
    const candidate = words.join(" ");
    return typeof view._clampStr === "function" ? view._clampStr(candidate, maxLen) : candidate;
  }

  async _applyDictationTextToField(text, target) {
    const view = this.view || {};
    const tgt = target === "longText" ? "longText" : "shortText";
    const shortField = view.inpTitle;
    const longField = view.taLongtext;

    if (tgt === "shortText" && shortField) {
      const normalized = typeof view._normTitle === "function" ? view._normTitle(text) : text;
      shortField.value =
        typeof view._clampStr === "function"
          ? view._clampStr(normalized, view._titleMax?.() || 100)
          : normalized;
      shortField.focus?.();
    } else if (tgt === "longText" && longField) {
      const current = String(longField.value || "");
      const joined = current ? `${current.replace(/\s+$/g, "")}\n${text}` : text;
      const normalized = typeof view._normLong === "function" ? view._normLong(joined) : joined;
      longField.value =
        typeof view._clampStr === "function"
          ? view._clampStr(normalized || "", view._longMax?.() || 500)
          : normalized || "";
      longField.focus?.();
      if (shortField) {
        const currentShort = String(shortField.value || "").trim();
        if (!currentShort || currentShort === "(ohne Bezeichnung)") {
          const derived = this._deriveShortTextFromDictation(text);
          if (derived) {
            shortField.value =
              typeof view._clampStr === "function"
                ? view._clampStr(derived, view._titleMax?.() || 100)
                : derived;
          }
        }
      }
    }

    this._lastDictation = { target: tgt, text: String(text || "") };
    if (typeof view._updateCharCounters === "function") {
      view._updateCharCounters();
    }
  }

  async loadProjectTermCorrections(force = false) {
    if (!force && this._termCorrectionsLoaded) return this._termCorrections;
    if (!force && this._termCorrectionsLoading) return this._termCorrectionsLoading;

    const task = (async () => {
      this._termCorrections = new Map();
      const pid = this.view?.projectId || null;
      if (!pid) {
        this._termCorrectionsLoaded = true;
        return this._termCorrections;
      }

      const api = window.bbmDb || {};
      if (typeof api.audioTermCorrectionsList !== "function") {
        this._termCorrectionsLoaded = true;
        return this._termCorrections;
      }

      try {
        const res = await api.audioTermCorrectionsList({ projectId: pid });
        if (res?.ok && Array.isArray(res?.list)) {
          res.list.forEach((entry) => {
            const wrong = this._normalizeTerm(entry?.wrong_term || entry?.wrongTerm || "");
            const correct = String(entry?.correct_term || entry?.correctTerm || "").trim();
            if (wrong && correct) this._termCorrections.set(wrong, correct);
          });
        }
      } catch (_err) {
        // ignore load errors for now
      } finally {
        this._termCorrectionsLoaded = true;
        this._termCorrectionsLoading = null;
      }

      return this._termCorrections;
    })();

    this._termCorrectionsLoading = task;
    return task;
  }

  _detectSimpleTermCorrection(target, currentValue) {
    if (!this._lastDictation || this._lastDictation.target !== target) return null;
    const before = this._normalizeTerm(this._lastDictation.text);
    const after = this._normalizeTerm(currentValue);
    if (!before || !after || before === after) return null;

    const beforeWords = before.split(/\s+/).filter(Boolean);
    const afterWords = after.split(/\s+/).filter(Boolean);
    if (beforeWords.length !== afterWords.length) return null;

    let wrongTerm = null;
    let correctTerm = null;
    for (let i = 0; i < beforeWords.length; i += 1) {
      if (beforeWords[i] !== afterWords[i]) {
        if (wrongTerm) return null;
        wrongTerm = beforeWords[i];
        correctTerm = afterWords[i];
      }
    }

    if (!wrongTerm || !correctTerm) return null;
    if (wrongTerm.length < 3 || correctTerm.length < 3) return null;

    const normalizedWrong = this._normalizeTerm(wrongTerm);
    if (this._termCorrections.has(normalizedWrong)) return null;

    return { wrongTerm, correctTerm };
  }

  _showTermCorrectionPrompt({ wrongTerm, correctTerm, target, hostEl }) {
    if (!hostEl || typeof hostEl.getBoundingClientRect !== "function") {
      this._pendingTermPrompt = { wrongTerm, correctTerm, target };
      return;
    }

    this._pendingTermPrompt = null;
    if (this._termPromptEl) {
      try {
        this._termPromptEl.remove();
      } catch (_err) {}
      this._termPromptEl = null;
    }

    const rect = hostEl.getBoundingClientRect();
    const prompt = document.createElement("div");
    prompt.style.position = "absolute";
    prompt.style.left = `${Math.round(rect.left + window.scrollX)}px`;
    prompt.style.top = `${Math.round(rect.bottom + window.scrollY + 4)}px`;
    prompt.style.background = "#fff";
    prompt.style.border = "1px solid #cfd8dc";
    prompt.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
    prompt.style.padding = "8px";
    prompt.style.fontSize = "10pt";
    prompt.style.zIndex = "9999";
    prompt.style.display = "flex";
    prompt.style.alignItems = "center";
    prompt.style.gap = "8px";

    const label = document.createElement("div");
    label.textContent = `Korrektur merken? "${wrongTerm}" \u2192 "${correctTerm}"`;
    prompt.appendChild(label);

    const btnYes = document.createElement("button");
    btnYes.type = "button";
    btnYes.textContent = "Ja";
    btnYes.style.border = "1px solid #cfd8dc";
    btnYes.style.background = "#f7f9fb";
    btnYes.style.cursor = "pointer";

    const btnNo = document.createElement("button");
    btnNo.type = "button";
    btnNo.textContent = "Nein";
    btnNo.style.border = "1px solid #cfd8dc";
    btnNo.style.background = "#fff";
    btnNo.style.cursor = "pointer";

    const cleanup = () => {
      if (this._termPromptEl) {
        try {
          this._termPromptEl.remove();
        } catch (_err) {}
        this._termPromptEl = null;
      }
    };

    btnYes.onclick = async () => {
      const api = window.bbmDb || {};
      if (typeof api.audioTermCorrectionUpsert === "function" && this.view?.projectId) {
        try {
          const res = await api.audioTermCorrectionUpsert({
            projectId: this.view.projectId,
            wrongTerm,
            correctTerm,
          });
          if (res?.ok && res?.entry) {
            const wrong = this._normalizeTerm(res.entry.wrong_term || res.entry.wrongTerm || wrongTerm);
            const correct = String(res.entry.correct_term || res.entry.correctTerm || correctTerm).trim();
            if (wrong && correct) {
              this._termCorrections.set(wrong, correct);
            }
          }
        } catch (_err) {
          // ignore failure to store correction
        }
      }
      cleanup();
    };

    btnNo.onclick = () => cleanup();

    prompt.appendChild(btnYes);
    prompt.appendChild(btnNo);
    document.body.appendChild(prompt);
    this._termPromptEl = prompt;
  }

  maybeOfferTermCorrection(target, value, hostEl) {
    const correction = this._detectSimpleTermCorrection(target, value);
    if (correction) {
      this._showTermCorrectionPrompt({ ...correction, target, hostEl });
    }
  }

  tryShowPendingTermPrompt() {
    if (!this._pendingTermPrompt) return;
    const target = this._pendingTermPrompt.target === "longText" ? "longText" : "shortText";
    const host =
      target === "longText" ? this.view?.taLongtext || null : this.view?.inpTitle || null;
    if (host) {
      this._showTermCorrectionPrompt({ ...this._pendingTermPrompt, target, hostEl: host });
    }
  }

  onTopCleared() {
    this._stopFieldDictation();
    if (this._termPromptEl) {
      try {
        this._termPromptEl.remove();
      } catch (_err) {}
    }
    this._termPromptEl = null;
    this._pendingTermPrompt = null;
    this._lastDictation = null;
    this._audioDictationTarget = null;
    this._audioDictationActive = false;
    this._audioDictationBusy = false;
  }

  destroy() {
    this._stopFieldDictation();
    if (this._termPromptEl) {
      try {
        this._termPromptEl.remove();
      } catch (_err) {}
    }
    this._termPromptEl = null;
    this._pendingTermPrompt = null;
    this._lastDictation = null;
  }
}
