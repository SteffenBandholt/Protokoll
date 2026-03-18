const fs = require("fs");
const os = require("os");
const path = require("path");
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
    const exeName = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
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
    return { available: !!modelPath, modelPath };
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

      const fullText = String(await fs.promises.readFile(transcriptFile, "utf8")).trim();
      if (!fullText) {
        throw new Error("whisper.cpp hat ein leeres Transkript geliefert.");
      }

      return {
        engine: "whisper.cpp",
        language: effectiveLanguage,
        fullText,
        segments: [],
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
