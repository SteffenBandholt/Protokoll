export default class AudioSuggestionsPanel {
  constructor() {
    this.overlay = null;
    this.card = null;
    this.header = null;
    this.body = null;
    this._parentOverrideBySuggestionId = new Map();
    this._selectedSuggestionId = null;
    this._position = null;
    this._dragState = null;
    this._onDragMove = this._handleDragMove.bind(this);
    this._onDragEnd = this._handleDragEnd.bind(this);
    this._onWindowResize = this._handleWindowResize.bind(this);
    this.state = {
      title: "Sprachdatei auswerten",
      modeLabel: "Prüfmodus",
      busy: false,
      statusMessage: "",
      audioImport: null,
      transcript: null,
      parentOptions: [],
      suggestions: [],
      onImportAudio: null,
      onCreateDemoSuggestion: null,
      onApplySuggestion: null,
      onFocusSuggestion: null,
      onRejectSuggestion: null,
    };
  }

  open(nextState = {}) {
    this.state = { ...this.state, ...nextState };
    if (!this.overlay) this._mount();
    this._render();
  }

  update(nextState = {}) {
    if (!this.overlay) {
      this.open(nextState);
      return;
    }
    this.state = { ...this.state, ...nextState };
    this._render();
  }

  close() {
    if (!this.overlay) return;
    this._stopDragging();
    window.removeEventListener("resize", this._onWindowResize);
    this.overlay.remove();
    this.overlay = null;
    this.card = null;
    this.header = null;
    this.body = null;
  }

  destroy() {
    this.close();
  }

  _pickSuggestionValue(suggestion, keys) {
    for (const key of keys) {
      const value = suggestion?.[key];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }
    return "";
  }

  _formatTopLabel(numberValue, titleValue, idValue) {
    const number = String(numberValue || "").trim();
    const title = String(titleValue || "").trim();
    const id = String(idValue || "").trim();
    if (number && title) return `${number} ${title}`;
    return title || number || id || "-";
  }

  _getTargetInfo(suggestion) {
    const type = String(suggestion?.type || "").trim();
    if (type === "append_to_top") {
      return `Ziel-TOP: ${this._formatTopLabel(
        this._pickSuggestionValue(suggestion, ["target_top_number", "targetTopNumber"]),
        this._pickSuggestionValue(suggestion, ["target_top_title", "targetTopTitle"]),
        this._pickSuggestionValue(suggestion, ["target_top_id", "targetTopId"])
      )}`;
    }
    if (type === "create_child_top") {
      return `Parent-TOP: ${this._formatTopLabel(
        this._pickSuggestionValue(suggestion, ["parent_top_number", "parentTopNumber"]),
        this._pickSuggestionValue(suggestion, ["parent_top_title", "parentTopTitle"]),
        this._pickSuggestionValue(suggestion, ["parent_top_id", "parentTopId"])
      )}`;
    }
    if (type === "manual_assign_child_top") {
      return "Zielbereich: Manuell zuordnen";
    }
    return "Ziel: -";
  }

  _getSuggestionOrigin(suggestion) {
    const reason = String(suggestion?.mapping_reason || suggestion?.mappingReason || "").trim();
    if (!reason) return "Herkunft: Vorschlag";
    if (reason.startsWith("phase3_demo_")) return "Herkunft: Demo-Vorschlag";
    return "Herkunft: Echtes Transkript";
  }

  _getSuggestionId(suggestion) {
    return String(suggestion?.id || "").trim();
  }

  _canOverrideParent(suggestion) {
    const type = String(suggestion?.type || "").trim();
    return type === "create_child_top" || type === "manual_assign_child_top";
  }

  _getOverrideParentTopId(suggestion) {
    const id = this._getSuggestionId(suggestion);
    if (!id) return "";
    return String(this._parentOverrideBySuggestionId.get(id) || "").trim();
  }

  _setOverrideParentTopId(suggestion, parentTopId) {
    const id = this._getSuggestionId(suggestion);
    if (!id) return;
    const normalized = String(parentTopId || "").trim();
    if (normalized) this._parentOverrideBySuggestionId.set(id, normalized);
    else this._parentOverrideBySuggestionId.delete(id);
  }

  _getDefaultParentOptionLabel(suggestion) {
    const type = String(suggestion?.type || "").trim();
    if (type === "create_child_top") {
      return `Aktueller Parent: ${this._formatTopLabel(
        this._pickSuggestionValue(suggestion, ["parent_top_number", "parentTopNumber"]),
        this._pickSuggestionValue(suggestion, ["parent_top_title", "parentTopTitle"]),
        this._pickSuggestionValue(suggestion, ["parent_top_id", "parentTopId"])
      )}`;
    }
    if (type === "manual_assign_child_top") {
      return "Standard: Manuell zuordnen";
    }
    return "Standard";
  }

  _markSuggestionSelected(suggestion) {
    const id = this._getSuggestionId(suggestion);
    this._selectedSuggestionId = id || null;
  }

  _formatAudioErrorMessage(message) {
    const raw = String(message || "").trim();
    if (!raw) return "";

    const normalized = raw.toLocaleLowerCase("de-DE");
    if (normalized.includes("whisper.cpp executable fehlt")) {
      return "Whisper-Runtime fehlt. Bitte BBM_WHISPER_CPP_PATH oder WHISPER_CPP_PATH prüfen.";
    }
    if (normalized.includes("modell fehlt")) {
      return "Whisper-Modell fehlt. Bitte BBM_WHISPER_MODEL_PATH oder WHISPER_MODEL_PATH setzen.";
    }
    if (normalized.includes("ffmpeg")) {
      return "ffmpeg fehlt für dieses Audioformat. Entweder WAV verwenden oder BBM_FFMPEG_PATH setzen.";
    }
    if (
      normalized.includes("nicht unterstütztes audioformat") ||
      normalized.includes("nicht unterstütztes audioformat")
    ) {
      return "Audioformat nicht unterstützt. Bitte WAV, MP3, M4A, AAC, OGG, FLAC oder WMA verwenden.";
    }
    return raw;
  }

  _mount() {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0, 0, 0, 0.08)";
    overlay.style.zIndex = "13000";
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) this.close();
    });

    const card = document.createElement("div");
    card.style.position = "absolute";
    card.style.width = "min(960px, calc(100vw - 32px))";
    card.style.maxHeight = "min(84vh, 900px)";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.background = "#ffffff";
    card.style.borderRadius = "12px";
    card.style.boxShadow = "0 20px 50px rgba(0, 0, 0, 0.25)";
    card.style.overflow = "hidden";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "14px 18px";
    header.style.borderBottom = "1px solid #e0e0e0";
    header.style.cursor = "move";
    header.style.userSelect = "none";
    header.title = "Zum Verschieben ziehen";
    header.addEventListener("mousedown", (event) => this._startDragging(event));

    const heading = document.createElement("div");
    heading.dataset.role = "audio-panel-title";
    heading.style.fontSize = "18px";
    heading.style.fontWeight = "700";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "Schließen";
    closeBtn.style.border = "1px solid #cfd8dc";
    closeBtn.style.background = "#f7f9fb";
    closeBtn.style.borderRadius = "6px";
    closeBtn.style.padding = "6px 10px";
    closeBtn.style.cursor = "pointer";
    closeBtn.onclick = () => this.close();

    header.append(heading, closeBtn);

    const body = document.createElement("div");
    body.style.padding = "18px";
    body.style.overflow = "auto";
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "16px";

    card.append(header, body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.card = card;
    this.header = header;
    this.body = body;
    window.addEventListener("resize", this._onWindowResize);
    this._applyCardPosition();
  }

  _render() {
    if (!this.overlay || !this.body) return;

    const titleEl = this.card?.querySelector?.('[data-role="audio-panel-title"]');
    if (titleEl) titleEl.textContent = String(this.state.title || "Sprachdatei auswerten");

    this.body.innerHTML = "";

    const toolbar = document.createElement("div");
    toolbar.style.display = "flex";
    toolbar.style.alignItems = "center";
    toolbar.style.justifyContent = "space-between";
    toolbar.style.gap = "12px";
    toolbar.style.flexWrap = "wrap";

    const modeBox = document.createElement("div");
    modeBox.style.display = "flex";
    modeBox.style.flexDirection = "column";
    modeBox.style.gap = "4px";

    const modeLabel = document.createElement("div");
    modeLabel.textContent = `Modus: ${String(this.state.modeLabel || "Prüfmodus")}`;
    modeLabel.style.fontWeight = "600";

    const modeHint = document.createElement("div");
    modeHint.textContent = "Version 1 arbeitet ausschließlich im Prüfmodus.";
    modeHint.style.fontSize = "12px";
    modeHint.style.color = "#546e7a";

    modeBox.append(modeLabel, modeHint);

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = this.state.busy ? "Bitte warten..." : "Audio auswählen und auswerten";
    importBtn.disabled = !!this.state.busy;
    importBtn.style.border = "1px solid rgba(0,0,0,0.25)";
    importBtn.style.background = "#1565c0";
    importBtn.style.color = "#fff";
    importBtn.style.borderRadius = "8px";
    importBtn.style.padding = "8px 12px";
    importBtn.style.cursor = importBtn.disabled ? "default" : "pointer";
    importBtn.onclick = async () => {
      if (typeof this.state.onImportAudio === "function") {
        await this.state.onImportAudio();
      }
    };

    toolbar.append(modeBox, importBtn);
    this.body.appendChild(toolbar);

    const demoWrap = document.createElement("div");
    demoWrap.style.display = "flex";
    demoWrap.style.flexDirection = "column";
    demoWrap.style.gap = "8px";

    const demoTitle = document.createElement("div");
    demoTitle.textContent = "Gezielte Demo-Vorschläge";
    demoTitle.style.fontWeight = "600";

    const demoActions = document.createElement("div");
    demoActions.style.display = "flex";
    demoActions.style.gap = "8px";
    demoActions.style.flexWrap = "wrap";

    const demoButtons = [
      {
        type: "append_to_top",
        label: "Test: Bestehenden TOP ergänzen",
      },
      {
        type: "create_child_top",
        label: "Test: Neuen TOP anlegen",
      },
      {
        type: "manual_assign_child_top",
        label: "Test: Manuell zuordnen",
      },
    ];

    for (const item of demoButtons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.label;
      btn.disabled = !!this.state.busy;
      btn.style.border = "1px solid #ffb74d";
      btn.style.background = "#fff3e0";
      btn.style.color = "#e65100";
      btn.style.borderRadius = "8px";
      btn.style.padding = "8px 12px";
      btn.style.cursor = btn.disabled ? "default" : "pointer";
      btn.onclick = async () => {
        if (typeof this.state.onCreateDemoSuggestion === "function") {
          await this.state.onCreateDemoSuggestion(item.type);
        }
      };
      demoActions.appendChild(btn);
    }

    demoWrap.append(demoTitle, demoActions);
    this.body.appendChild(demoWrap);

    if (this.state.statusMessage) {
      const statusBox = document.createElement("div");
      statusBox.textContent = this._formatAudioErrorMessage(this.state.statusMessage);
      statusBox.style.border = "1px solid #bbdefb";
      statusBox.style.background = "#e3f2fd";
      statusBox.style.color = "#0d47a1";
      statusBox.style.borderRadius = "8px";
      statusBox.style.padding = "10px 12px";
      this.body.appendChild(statusBox);
    }

    if (this.state.audioImport || this.state.transcript) {
      const transcriptWrap = document.createElement("section");
      transcriptWrap.style.display = "flex";
      transcriptWrap.style.flexDirection = "column";
      transcriptWrap.style.gap = "8px";
      transcriptWrap.style.border = "1px solid #d7ccc8";
      transcriptWrap.style.background = "#faf7f5";
      transcriptWrap.style.borderRadius = "10px";
      transcriptWrap.style.padding = "12px";

      const transcriptTitle = document.createElement("div");
      transcriptTitle.textContent = "Transkriptionsstatus";
      transcriptTitle.style.fontWeight = "700";
      transcriptWrap.appendChild(transcriptTitle);

      if (this.state.audioImport) {
        const importInfo = document.createElement("div");
        const fileName = String(
          this.state.audioImport.original_file_name ||
            this.state.audioImport.originalFileName ||
            this.state.audioImport.file_path ||
            this.state.audioImport.filePath ||
            "Audiodatei"
        );
        const importStatus = String(this.state.audioImport.status || "-");
        importInfo.textContent = `Import: ${fileName} | Status: ${importStatus}`;
        importInfo.style.fontSize = "13px";
        transcriptWrap.appendChild(importInfo);

        const importError = String(this.state.audioImport.error_message || "").trim();
        if (importError) {
          const errorBox = document.createElement("div");
          errorBox.textContent = `Fehler: ${this._formatAudioErrorMessage(importError)}`;
          errorBox.style.fontSize = "12px";
          errorBox.style.color = "#b71c1c";
          errorBox.style.whiteSpace = "pre-wrap";
          transcriptWrap.appendChild(errorBox);
        }
      }

      if (this.state.transcript) {
        const transcriptMeta = document.createElement("div");
        const engine = String(this.state.transcript.engine || "-");
        const language = String(this.state.transcript.language || "-");
        transcriptMeta.textContent = `Engine: ${engine} | Sprache: ${language}`;
        transcriptMeta.style.fontSize = "13px";
        transcriptWrap.appendChild(transcriptMeta);

        const rawTranscript = String(this.state.transcript.full_text || "").trim();
        if (rawTranscript) {
          const rawTitle = document.createElement("div");
          rawTitle.textContent = "Rohes Transkript:";
          rawTitle.style.fontSize = "12px";
          rawTitle.style.fontWeight = "600";
          rawTitle.style.color = "#546e7a";

          const rawBox = document.createElement("div");
          rawBox.textContent = rawTranscript;
          rawBox.style.whiteSpace = "pre-wrap";
          rawBox.style.maxHeight = "180px";
          rawBox.style.overflow = "auto";
          rawBox.style.borderLeft = "3px solid #80cbc4";
          rawBox.style.paddingLeft = "8px";

          transcriptWrap.append(rawTitle, rawBox);
        }
      }

      this.body.appendChild(transcriptWrap);
    }

    const suggestions = Array.isArray(this.state.suggestions) ? this.state.suggestions : [];
    const groups = [
      {
        key: "append_to_top",
        label: "Ergänzungen zu bestehenden TOPs",
      },
      {
        key: "create_child_top",
        label: "Neue TOPs",
      },
      {
        key: "manual_assign_child_top",
        label: "Manuell zuordnen",
      },
    ];

    if (!suggestions.length) {
      const empty = document.createElement("div");
      empty.textContent =
        "Noch keine Vorschl?ge vorhanden. Die Transkription kann bereits real laufen, die TOP-Zuordnung bleibt in diesem Stand noch Platzhalter.";
      empty.style.border = "1px dashed #cfd8dc";
      empty.style.borderRadius = "8px";
      empty.style.padding = "14px";
      empty.style.color = "#455a64";
      this.body.appendChild(empty);
      return;
    }

    for (const group of groups) {
      const items = suggestions.filter((suggestion) => suggestion?.type === group.key);
      if (!items.length) continue;

      const section = document.createElement("section");
      section.style.display = "flex";
      section.style.flexDirection = "column";
      section.style.gap = "10px";

      const title = document.createElement("h3");
      title.textContent = `${group.label} (${items.length})`;
      title.style.margin = "0";
      title.style.fontSize = "16px";
      title.style.fontWeight = "700";

      section.appendChild(title);

      for (const suggestion of items) {
        const card = document.createElement("div");
        const suggestionId = this._getSuggestionId(suggestion);
        const isSelectedSuggestion =
          !!suggestionId && suggestionId === String(this._selectedSuggestionId || "").trim();
        card.style.border = "1px solid #e0e0e0";
        card.style.borderRadius = "10px";
        card.style.padding = "12px";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.gap = "8px";
        card.style.background = isSelectedSuggestion ? "#f4f9ff" : "#fff";
        if (isSelectedSuggestion) {
          card.style.border = "1px solid #64b5f6";
        }
        card.addEventListener("mousedown", () => {
          this._markSuggestionSelected(suggestion);
        });

        const head = document.createElement("div");
        head.style.display = "flex";
        head.style.alignItems = "center";
        head.style.justifyContent = "space-between";
        head.style.gap = "12px";
        head.style.flexWrap = "wrap";

        const main = document.createElement("div");
        main.style.display = "flex";
        main.style.flexDirection = "column";
        main.style.gap = "4px";

        const titleEl = document.createElement("div");
        titleEl.textContent = String(
          suggestion.title_suggestion ||
            suggestion.titleSuggestion ||
            suggestion.text_suggestion ||
            suggestion.textSuggestion ||
            "Vorschlag"
        );
        titleEl.style.fontWeight = "700";

        const metaEl = document.createElement("div");
        const confidenceRaw = Number(suggestion.confidence);
        const confidence = Number.isFinite(confidenceRaw)
          ? `${Math.round(confidenceRaw * 100)}%`
          : "-";
        metaEl.textContent = `Typ: ${suggestion.type} | Konfidenz: ${confidence}`;
        metaEl.style.fontSize = "12px";
        metaEl.style.color = "#607d8b";

        const originEl = document.createElement("div");
        originEl.textContent = this._getSuggestionOrigin(suggestion);
        originEl.style.fontSize = "12px";
        originEl.style.color = "#2e7d32";
        originEl.style.fontWeight = "600";

        main.append(titleEl, metaEl, originEl);

        const targetEl = document.createElement("div");
        targetEl.textContent = this._getTargetInfo(suggestion);
        targetEl.style.fontSize = "12px";
        targetEl.style.color = "#5d4037";
        targetEl.style.background = "#fff8e1";
        targetEl.style.border = "1px solid #ffe0b2";
        targetEl.style.borderRadius = "6px";
        targetEl.style.padding = "6px 8px";
        main.appendChild(targetEl);

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "8px";
        actions.style.flexWrap = "wrap";

        const btnFocus = document.createElement("button");
        btnFocus.type = "button";
        btnFocus.textContent =
          String(suggestion?.type || "").trim() === "append_to_top"
            ? "Zum Ziel springen"
            : "Zum Parent springen";
        btnFocus.disabled = !!this.state.busy;
        btnFocus.style.border = "1px solid #90caf9";
        btnFocus.style.background = "#e3f2fd";
        btnFocus.style.color = "#0d47a1";
        btnFocus.style.borderRadius = "6px";
        btnFocus.style.padding = "6px 10px";
        btnFocus.style.cursor = btnFocus.disabled ? "default" : "pointer";
        btnFocus.onclick = async () => {
          this._markSuggestionSelected(suggestion);
          if (typeof this.state.onFocusSuggestion === "function") {
            await this.state.onFocusSuggestion(suggestion, {
              overrideParentTopId: this._getOverrideParentTopId(suggestion) || null,
            });
          }
          this._render();
        };

        const btnApply = document.createElement("button");
        btnApply.type = "button";
        btnApply.textContent = "Übernehmen";
        btnApply.disabled = !!this.state.busy;
        btnApply.style.border = "1px solid #2e7d32";
        btnApply.style.background = "#2e7d32";
        btnApply.style.color = "#fff";
        btnApply.style.borderRadius = "6px";
        btnApply.style.padding = "6px 10px";
        btnApply.style.cursor = btnApply.disabled ? "default" : "pointer";
        btnApply.onclick = async () => {
          this._markSuggestionSelected(suggestion);
          if (typeof this.state.onApplySuggestion === "function") {
            await this.state.onApplySuggestion(suggestion, {
              overrideParentTopId: this._getOverrideParentTopId(suggestion) || null,
            });
          }
        };

        const btnReject = document.createElement("button");
        btnReject.type = "button";
        btnReject.textContent = "Verwerfen";
        btnReject.disabled = !!this.state.busy;
        btnReject.style.border = "1px solid #b0bec5";
        btnReject.style.background = "#eceff1";
        btnReject.style.color = "#263238";
        btnReject.style.borderRadius = "6px";
        btnReject.style.padding = "6px 10px";
        btnReject.style.cursor = btnReject.disabled ? "default" : "pointer";
        btnReject.onclick = async () => {
          this._markSuggestionSelected(suggestion);
          if (typeof this.state.onRejectSuggestion === "function") {
            await this.state.onRejectSuggestion(suggestion);
          }
        };

        actions.append(btnFocus, btnApply, btnReject);
        head.append(main, actions);

        const body = document.createElement("div");
        body.style.display = "flex";
        body.style.flexDirection = "column";
        body.style.gap = "4px";

        const previewTitle = document.createElement("div");
        previewTitle.textContent = `Titel: ${String(
          suggestion.title_suggestion || suggestion.titleSuggestion || "(ohne Titelvorschlag)"
        )}`;
        previewTitle.style.fontSize = "13px";
        previewTitle.style.color = "#37474f";

        const previewLabel = document.createElement("div");
        previewLabel.textContent = "Textvorschau:";
        previewLabel.style.fontSize = "12px";
        previewLabel.style.fontWeight = "600";
        previewLabel.style.color = "#546e7a";

        const text = document.createElement("div");
        text.textContent = String(
          suggestion.text_suggestion || suggestion.textSuggestion || "(ohne Textvorschlag)"
        );
        text.style.whiteSpace = "pre-wrap";
        text.style.borderLeft = "3px solid #bbdefb";
        text.style.paddingLeft = "8px";

        body.append(previewTitle, previewLabel, text);

        const excerptRaw = String(
          suggestion.source_excerpt || suggestion.sourceExcerpt || ""
        ).trim();
        if (excerptRaw) {
          const excerpt = document.createElement("div");
          excerpt.textContent = `Quelle: ${excerptRaw}`;
          excerpt.style.fontSize = "12px";
          excerpt.style.color = "#546e7a";
          excerpt.style.whiteSpace = "pre-wrap";
          body.appendChild(excerpt);
        }

        const mappingReasonRaw = String(
          suggestion.mapping_reason || suggestion.mappingReason || ""
        ).trim();
        if (mappingReasonRaw) {
          const mappingReasonEl = document.createElement("div");
          mappingReasonEl.textContent = `Regelbasis: ${mappingReasonRaw}`;
          mappingReasonEl.style.fontSize = "12px";
          mappingReasonEl.style.color = "#6a1b9a";
          mappingReasonEl.style.whiteSpace = "pre-wrap";
          body.appendChild(mappingReasonEl);
        }

        const applyErrorRaw = String(suggestion.apply_error || suggestion.applyError || "").trim();
        if (applyErrorRaw) {
          const applyErrorEl = document.createElement("div");
          applyErrorEl.textContent = `Letzter Übernahmefehler: ${applyErrorRaw}`;
          applyErrorEl.style.fontSize = "12px";
          applyErrorEl.style.color = "#b71c1c";
          applyErrorEl.style.background = "#ffebee";
          applyErrorEl.style.border = "1px solid #ffcdd2";
          applyErrorEl.style.borderRadius = "6px";
          applyErrorEl.style.padding = "6px 8px";
          applyErrorEl.style.whiteSpace = "pre-wrap";
          body.appendChild(applyErrorEl);
        }

        if (this._canOverrideParent(suggestion)) {
          const overrideWrap = document.createElement("div");
          overrideWrap.style.display = "flex";
          overrideWrap.style.flexDirection = "column";
          overrideWrap.style.gap = "6px";
          overrideWrap.style.marginTop = "4px";

          const overrideLabel = document.createElement("label");
          overrideLabel.textContent = "Alternativen Parent wählen:";
          overrideLabel.style.fontSize = "12px";
          overrideLabel.style.fontWeight = "600";
          overrideLabel.style.color = "#455a64";

          const select = document.createElement("select");
          select.disabled = !!this.state.busy;
          select.style.border = "1px solid #cfd8dc";
          select.style.borderRadius = "6px";
          select.style.padding = "6px 8px";
          select.style.background = "#fff";

          const defaultOption = document.createElement("option");
          defaultOption.value = "";
          defaultOption.textContent = this._getDefaultParentOptionLabel(suggestion);
          select.appendChild(defaultOption);

          for (const option of Array.isArray(this.state.parentOptions) ? this.state.parentOptions : []) {
            const opt = document.createElement("option");
            opt.value = String(option?.id || "");
            opt.textContent = String(option?.label || option?.title || option?.id || "");
            if (!opt.value) continue;
            select.appendChild(opt);
          }

          select.value = this._getOverrideParentTopId(suggestion);
          select.onchange = async () => {
            this._markSuggestionSelected(suggestion);
            this._setOverrideParentTopId(suggestion, select.value);
            if (typeof this.state.onFocusSuggestion === "function") {
              await this.state.onFocusSuggestion(suggestion, {
                overrideParentTopId: this._getOverrideParentTopId(suggestion) || null,
              });
            }
            this._render();
          };

          overrideWrap.append(overrideLabel, select);
          body.appendChild(overrideWrap);
        }

        card.append(head, body);
        section.appendChild(card);
      }

      this.body.appendChild(section);
    }

    this._applyCardPosition();
  }

  _getViewportPadding() {
    return 16;
  }

  _applyCardPosition() {
    if (!this.card) return;

    const rect = this.card.getBoundingClientRect();
    const width = rect.width || this.card.offsetWidth || 0;
    const height = rect.height || this.card.offsetHeight || 0;
    const padding = this._getViewportPadding();

    let left = this._position?.left;
    let top = this._position?.top;

    if (!Number.isFinite(left) || !Number.isFinite(top)) {
      left = Math.max(padding, Math.round((window.innerWidth - width) / 2));
      top = Math.max(padding, Math.round((window.innerHeight - height) / 2));
    }

    const maxLeft = Math.max(padding, window.innerWidth - width - padding);
    const maxTop = Math.max(padding, window.innerHeight - height - padding);
    left = Math.min(Math.max(padding, left), maxLeft);
    top = Math.min(Math.max(padding, top), maxTop);

    this._position = { left, top };
    this.card.style.left = `${left}px`;
    this.card.style.top = `${top}px`;
  }

  _startDragging(event) {
    if (!this.card || event.button !== 0) return;
    if (event.target?.closest?.("button")) return;

    const rect = this.card.getBoundingClientRect();
    this._dragState = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    if (this.header) this.header.style.cursor = "grabbing";
    window.addEventListener("mousemove", this._onDragMove);
    window.addEventListener("mouseup", this._onDragEnd);
    event.preventDefault();
  }

  _handleDragMove(event) {
    if (!this._dragState || !this.card) return;

    this._position = {
      left: event.clientX - this._dragState.offsetX,
      top: event.clientY - this._dragState.offsetY,
    };
    this._applyCardPosition();
  }

  _handleDragEnd() {
    this._stopDragging();
  }

  _stopDragging() {
    window.removeEventListener("mousemove", this._onDragMove);
    window.removeEventListener("mouseup", this._onDragEnd);
    this._dragState = null;
    if (this.header) this.header.style.cursor = "move";
  }

  _handleWindowResize() {
    this._applyCardPosition();
  }
}
