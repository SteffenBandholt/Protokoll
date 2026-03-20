const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { app } = require("electron");
const { spawn } = require("child_process");

function _fileExists(filePath) {
  if (!filePath) return false;
  try {
    return fs.statSync(filePath).isFile();
  } catch (_err) {
    return false;
  }
}

function _directoryExists(dirPath) {
  if (!dirPath) return false;
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch (_err) {
    return false;
  }
}

function _resolveExistingFile(candidates, fileNames = []) {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;

    if (_fileExists(value)) return value;

    if (_directoryExists(value)) {
      for (const fileName of fileNames) {
        const derived = path.join(value, fileName);
        if (_fileExists(derived)) return derived;
      }
    }
  }
  return null;
}

function _findExecutableOnPath(executableName) {
  const pathValue = String(process.env.PATH || "");
  const segments = pathValue.split(path.delimiter).filter(Boolean);
  return _resolveExistingFile(segments.map((segment) => path.join(segment, executableName)));
}

function _getResourcesRoot() {
  if (process.resourcesPath) return process.resourcesPath;
  try {
    return app?.isPackaged ? process.resourcesPath : null;
  } catch (_err) {
    return null;
  }
}

function _runProcess(command, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `Prozess fehlgeschlagen (${code})`));
    });
  });
}

function _postMultipart({ host, port, path: requestPath, fields = {}, file }) {
  return new Promise((resolve, reject) => {
    const boundary = `----bbm-whisper-${Date.now().toString(16)}-${Math.random()
      .toString(16)
      .slice(2)}`;

    const req = http.request(
      {
        host,
        port,
        path: requestPath,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += String(chunk || "");
        });
        res.on("end", () => {
          resolve({ status: res.statusCode || 0, body });
        });
      }
    );

    req.on("error", (err) => reject(err));

    const writeField = (name, value) => {
      req.write(`--${boundary}\r\n`);
      req.write(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
      req.write(String(value ?? ""));
      req.write("\r\n");
    };

    for (const [name, value] of Object.entries(fields || {})) {
      writeField(name, value);
    }

    const finalize = () => {
      req.write(`--${boundary}--\r\n`);
      req.end();
    };

    if (!file?.filePath) {
      finalize();
      return;
    }

    const fileName = path.basename(file.filePath);
    req.write(`--${boundary}\r\n`);
    req.write(
      `Content-Disposition: form-data; name="${file.fieldName || "file"}"; filename="${fileName}"\r\n`
    );
    req.write("Content-Type: application/octet-stream\r\n\r\n");

    const stream = fs.createReadStream(file.filePath);
    stream.on("error", (err) => reject(err));
    stream.on("end", () => {
      req.write("\r\n");
      finalize();
    });
    stream.pipe(req, { end: false });
  });
}

function _waitForHttp({ host, port, timeoutMs = 6000 }) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.request(
        {
          host,
          port,
          path: "/",
          method: "GET",
        },
        (res) => {
          res.resume();
          resolve(true);
        }
      );
      req.on("error", () => {
        if (Date.now() - start >= timeoutMs) {
          reject(new Error("whisper-server nicht erreichbar"));
          return;
        }
        setTimeout(tryOnce, 200);
      });
      req.end();
    };
    tryOnce();
  });
}

function _audioLog(message, extra = null) {
  if (extra && typeof extra === "object") {
    console.info("[AUDIO] Transcribe", message, extra);
    return;
  }
  console.info("[AUDIO] Transcribe", message);
}

function _isTruthString(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw);
}

class WhisperCppEngine {
  constructor(options = {}) {
    this.workspaceRoot =
      String(options.workspaceRoot || "").trim() || path.resolve(__dirname, "../../../../..");
    this.defaultLanguage = String(options.defaultLanguage || "de").trim() || "de";
    this.serverHost = String(process.env.BBM_WHISPER_SERVER_HOST || "127.0.0.1").trim();
    this.serverPort = Number(process.env.BBM_WHISPER_SERVER_PORT || 8080);
    this._serverState = { process: null, modelPath: null };
  }

  _getExecutableCandidates() {
    const exeName = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
    const resourcesRoot = _getResourcesRoot();
    const packaged = resourcesRoot
      ? [path.join(resourcesRoot, "audio", "whisper"), path.join(resourcesRoot, "audio", "whisper", exeName)]
      : [];
    return [
      process.env.BBM_WHISPER_CPP_PATH,
      process.env.WHISPER_CPP_PATH,
      ...packaged,
      path.join(this.workspaceRoot, "dev", "tools", "whisper.cpp"),
      path.join(this.workspaceRoot, "dev", "tools", "whisper.cpp", "Release"),
      path.join(this.workspaceRoot, "vendor", "whisper.cpp", exeName),
      path.join(this.workspaceRoot, "tools", "whisper.cpp", exeName),
      path.join(this.workspaceRoot, "bin", exeName),
      _findExecutableOnPath(exeName),
    ];
  }

  _getModelCandidates(executablePath, modelFileName = "ggml-base.bin") {
    const executableDir = executablePath ? path.dirname(executablePath) : null;
    const resourcesRoot = _getResourcesRoot();
    const packaged = resourcesRoot
      ? [
          path.join(resourcesRoot, "audio", "models"),
          path.join(resourcesRoot, "audio", "models", modelFileName),
        ]
      : [];
    return [
      process.env.BBM_WHISPER_MODEL_PATH,
      process.env.WHISPER_MODEL_PATH,
      ...packaged,
      path.join(this.workspaceRoot, "dev", "models"),
      path.join(this.workspaceRoot, "dev", "models", "whisper"),
      executableDir ? path.join(executableDir, "models", modelFileName) : null,
      executableDir ? path.join(executableDir, "..", "models", modelFileName) : null,
      path.join(this.workspaceRoot, "models", modelFileName),
      path.join(this.workspaceRoot, "vendor", "whisper.cpp", "models", modelFileName),
    ];
  }

  _getServerExecutableCandidates() {
    const exeName = process.platform === "win32" ? "whisper-server.exe" : "whisper-server";
    const resourcesRoot = _getResourcesRoot();
    const packaged = resourcesRoot
      ? [path.join(resourcesRoot, "audio", "whisper"), path.join(resourcesRoot, "audio", "whisper", exeName)]
      : [];
    return [
      process.env.BBM_WHISPER_SERVER_PATH,
      process.env.WHISPER_SERVER_PATH,
      ...packaged,
      path.join(this.workspaceRoot, "dev", "tools", "whisper.cpp"),
      path.join(this.workspaceRoot, "dev", "tools", "whisper.cpp", "Release"),
      path.join(this.workspaceRoot, "vendor", "whisper.cpp", exeName),
      path.join(this.workspaceRoot, "tools", "whisper.cpp", exeName),
      path.join(this.workspaceRoot, "bin", exeName),
      _findExecutableOnPath(exeName),
    ];
  }

  _getServerExecutablePath() {
    const exeName = process.platform === "win32" ? "whisper-server.exe" : "whisper-server";
    return _resolveExistingFile(this._getServerExecutableCandidates(), [
      exeName,
      path.join("Release", exeName),
      path.join("build", "bin", exeName),
      path.join("build", "bin", "Release", exeName),
      path.join("bin", exeName),
    ]);
  }

  async _ensureServerRunning({ serverPath, modelPath }) {
    if (this._serverState.process && !this._serverState.process.killed) {
      if (this._serverState.modelPath !== modelPath) {
        try {
          await _postMultipart({
            host: this.serverHost,
            port: this.serverPort,
            path: "/load",
            fields: { model: modelPath },
          });
          this._serverState.modelPath = modelPath;
          _audioLog("server model switch", { modelPath });
        } catch (err) {
          _audioLog("server model switch failed", { error: err?.message || String(err) });
          return false;
        }
      }
      return true;
    }

    const threads = Math.max(1, os.cpus()?.length || 1);
    const args = [
      "--host",
      this.serverHost,
      "--port",
      String(this.serverPort),
      "-m",
      modelPath,
      "-t",
      String(threads),
    ];

    const child = spawn(serverPath, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.on("exit", () => {
      if (this._serverState.process === child) {
        this._serverState.process = null;
        this._serverState.modelPath = null;
      }
    });

    this._serverState.process = child;
    this._serverState.modelPath = modelPath;
    try {
      await _waitForHttp({ host: this.serverHost, port: this.serverPort });
      _audioLog("server ready", { host: this.serverHost, port: this.serverPort, modelPath });
      return true;
    } catch (err) {
      _audioLog("server start failed", { error: err?.message || String(err) });
      try {
        child.kill();
      } catch (_ignore) {
        // ignore
      }
      this._serverState.process = null;
      this._serverState.modelPath = null;
      return false;
    }
  }

  async _transcribeViaServer({ modelPath, preparedPath, effectiveLanguage, serverPath }) {
    const ok = await this._ensureServerRunning({ serverPath, modelPath });
    if (!ok) {
      throw new Error("whisper-server nicht verfuegbar");
    }

    const response = await _postMultipart({
      host: this.serverHost,
      port: this.serverPort,
      path: "/inference",
      fields: {
        temperature: "0.0",
        temperature_inc: "0.2",
        response_format: "json",
        language: effectiveLanguage,
      },
      file: { fieldName: "file", filePath: preparedPath },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`whisper-server Fehler: ${response.body || response.status}`);
    }

    let text = "";
    let segments = [];
    try {
      const parsed = JSON.parse(response.body || "{}");
      text = String(parsed.text || parsed.transcription || parsed.result || "").trim();
      if (Array.isArray(parsed.segments)) segments = parsed.segments;
    } catch (_err) {
      text = String(response.body || "").trim();
    }

    if (!text) {
      throw new Error("whisper-server hat ein leeres Transkript geliefert.");
    }

    return { text, segments };
  }

  _getFfmpegCandidates() {
    const exeName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const resourcesRoot = _getResourcesRoot();
    const packaged = resourcesRoot
      ? [path.join(resourcesRoot, "audio", "ffmpeg"), path.join(resourcesRoot, "audio", "ffmpeg", exeName)]
      : [];
    return [
      process.env.BBM_FFMPEG_PATH,
      process.env.FFMPEG_PATH,
      ...packaged,
      path.join(this.workspaceRoot, "dev", "tools", "ffmpeg"),
      path.join(this.workspaceRoot, "dev", "tools", "ffmpeg", "bin"),
      _findExecutableOnPath(exeName),
    ];
  }

  _getAvailabilityForModel(modelFileName = "ggml-base.bin") {
    const exeName = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
    const ffmpegName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const executablePath = _resolveExistingFile(this._getExecutableCandidates(), [
      exeName,
      path.join("Release", exeName),
      path.join("build", "bin", exeName),
      path.join("build", "bin", "Release", exeName),
      path.join("bin", exeName),
    ]);
    const modelPath = _resolveExistingFile(this._getModelCandidates(executablePath, modelFileName), [
      modelFileName,
      path.join("models", modelFileName),
    ]);
    const ffmpegPath = _resolveExistingFile(this._getFfmpegCandidates(), [
      ffmpegName,
      path.join("bin", ffmpegName),
    ]);

    return {
      available: !!(executablePath && modelPath),
      executablePath,
      modelPath,
      ffmpegPath,
    };
  }

  getAvailability() {
    return this._getAvailabilityForModel("ggml-base.bin");
  }

  getModelAvailability(modelFileName = "ggml-base.bin") {
    const availability = this._getAvailabilityForModel(modelFileName);
    return {
      available: !!availability.available,
      modelPath: availability.modelPath,
      executablePath: availability.executablePath,
    };
  }

  _ensureAvailable(modelFileName = "ggml-base.bin") {
    const availability = this._getAvailabilityForModel(modelFileName);
    if (_isTruthString(process.env.BBM_DEV_AUDIO_FFMPEG_LOG)) {
      _audioLog("ffmpeg-check", {
        available: !!availability.ffmpegPath,
        ffmpegPath: availability.ffmpegPath || null,
      });
    }
    if (availability.available) return availability;

    const missing = [];
    if (!availability.executablePath) {
      missing.push("whisper.cpp executable fehlt (BBM_WHISPER_CPP_PATH)");
    }
    if (!availability.modelPath) {
      missing.push(
        `whisper.cpp Modell fehlt (BBM_WHISPER_MODEL_PATH, z. B. ${modelFileName})`
      );
    }

    throw new Error(
      `Lokale Transkription ist vorbereitet, aber noch nicht lauffaehig: ${missing.join("; ")}`
    );
  }

  async _prepareInput(filePath, ffmpegPath) {
    const ext = path.extname(String(filePath || "")).toLowerCase();
    if (ext === ".wav") {
      return { preparedPath: filePath, cleanup: async () => {} };
    }

    if (!ffmpegPath) {
      throw new Error(
        "Fuer Nicht-WAV-Dateien wird ffmpeg benoetigt. Entweder WAV importieren oder BBM_FFMPEG_PATH setzen."
      );
    }

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "bbm-audio-"));
    const preparedPath = path.join(tempDir, "normalized.wav");

    try {
      await _runProcess(ffmpegPath, [
        "-y",
        "-i",
        filePath,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        preparedPath,
      ]);
    } catch (err) {
      throw new Error(`Audio-Vorverarbeitung mit ffmpeg fehlgeschlagen: ${err?.message || err}`);
    }

    return {
      preparedPath,
      cleanup: async () => {
        try {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (_err) {
          // ignore cleanup errors
        }
      },
    };
  }

  async transcribe({ filePath, language, modelFileName } = {}) {
    const sourcePath = String(filePath || "").trim();
    if (!sourcePath) throw new Error("filePath required");
    if (!_fileExists(sourcePath)) {
      throw new Error(`Audiodatei nicht gefunden: ${sourcePath}`);
    }

    const availability = this._ensureAvailable(modelFileName || "ggml-base.bin");
    const effectiveLanguage = String(language || this.defaultLanguage || "de").trim() || "de";
    const outputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "bbm-whisper-"));

    let prepared = null;
    try {
      prepared = await this._prepareInput(sourcePath, availability.ffmpegPath);
      const serverPath = this._getServerExecutablePath();
      let fullText = "";
      let segments = [];

      if (serverPath) {
        try {
          _audioLog("server transcribe", {
            host: this.serverHost,
            port: this.serverPort,
            modelPath: availability.modelPath,
          });
          const serverResult = await this._transcribeViaServer({
            modelPath: availability.modelPath,
            preparedPath: prepared.preparedPath,
            effectiveLanguage,
            serverPath,
          });
          fullText = serverResult.text;
          segments = serverResult.segments || [];
        } catch (err) {
          _audioLog("server fallback to cli", { error: err?.message || String(err) });
          const outputBase = path.join(outputDir, "transcript");

          await _runProcess(availability.executablePath, [
            "-m",
            availability.modelPath,
            "-f",
            prepared.preparedPath,
            "-l",
            effectiveLanguage,
            "-otxt",
            "-of",
            outputBase,
          ]);

          const transcriptFile = `${outputBase}.txt`;
          if (!_fileExists(transcriptFile)) {
            throw new Error("whisper.cpp hat keine Transcript-Datei erzeugt.");
          }

          fullText = String(await fs.promises.readFile(transcriptFile, "utf8")).trim();
          if (!fullText) {
            throw new Error("whisper.cpp hat ein leeres Transkript geliefert.");
          }
        }
      } else {
        const outputBase = path.join(outputDir, "transcript");

        await _runProcess(availability.executablePath, [
          "-m",
          availability.modelPath,
          "-f",
          prepared.preparedPath,
          "-l",
          effectiveLanguage,
          "-otxt",
          "-of",
          outputBase,
        ]);

        const transcriptFile = `${outputBase}.txt`;
        if (!_fileExists(transcriptFile)) {
          throw new Error("whisper.cpp hat keine Transcript-Datei erzeugt.");
        }

        fullText = String(await fs.promises.readFile(transcriptFile, "utf8")).trim();
        if (!fullText) {
          throw new Error("whisper.cpp hat ein leeres Transkript geliefert.");
        }
      }

      return {
        engine: "whisper.cpp",
        language: effectiveLanguage,
        fullText,
        segments,
        raw: {
          executablePath: availability.executablePath,
          modelPath: availability.modelPath,
          ffmpegPath: availability.ffmpegPath || null,
        },
      };
    } finally {
      if (prepared?.cleanup) {
        await prepared.cleanup();
      }
      try {
        await fs.promises.rm(outputDir, { recursive: true, force: true });
      } catch (_err) {
        // ignore cleanup errors
      }
    }
  }
}

function createWhisperCppEngine(options) {
  return new WhisperCppEngine(options);
}

module.exports = {
  WhisperCppEngine,
  createWhisperCppEngine,
};
