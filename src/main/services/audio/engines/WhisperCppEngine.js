const fs = require("fs");
const os = require("os");
const path = require("path");
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

class WhisperCppEngine {
  constructor(options = {}) {
    this.workspaceRoot =
      String(options.workspaceRoot || "").trim() || path.resolve(__dirname, "../../../../..");
    this.defaultLanguage = String(options.defaultLanguage || "de").trim() || "de";
  }

  _getExecutableCandidates() {
    const exeName = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
    return [
      process.env.BBM_WHISPER_CPP_PATH,
      process.env.WHISPER_CPP_PATH,
      path.join(this.workspaceRoot, "dev", "tools", "whisper.cpp"),
      path.join(this.workspaceRoot, "dev", "tools", "whisper.cpp", "Release"),
      path.join(this.workspaceRoot, "vendor", "whisper.cpp", exeName),
      path.join(this.workspaceRoot, "tools", "whisper.cpp", exeName),
      path.join(this.workspaceRoot, "bin", exeName),
      _findExecutableOnPath(exeName),
    ];
  }

  _getModelCandidates(executablePath) {
    const executableDir = executablePath ? path.dirname(executablePath) : null;
    return [
      process.env.BBM_WHISPER_MODEL_PATH,
      process.env.WHISPER_MODEL_PATH,
      path.join(this.workspaceRoot, "dev", "models"),
      path.join(this.workspaceRoot, "dev", "models", "whisper"),
      executableDir ? path.join(executableDir, "models", "ggml-base.bin") : null,
      executableDir ? path.join(executableDir, "..", "models", "ggml-base.bin") : null,
      path.join(this.workspaceRoot, "models", "ggml-base.bin"),
      path.join(this.workspaceRoot, "vendor", "whisper.cpp", "models", "ggml-base.bin"),
    ];
  }

  _getFfmpegCandidates() {
    const exeName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    return [
      process.env.BBM_FFMPEG_PATH,
      process.env.FFMPEG_PATH,
      path.join(this.workspaceRoot, "dev", "tools", "ffmpeg"),
      path.join(this.workspaceRoot, "dev", "tools", "ffmpeg", "bin"),
      _findExecutableOnPath(exeName),
    ];
  }

  getAvailability() {
    const exeName = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
    const ffmpegName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const executablePath = _resolveExistingFile(this._getExecutableCandidates(), [
      exeName,
      path.join("Release", exeName),
      path.join("build", "bin", exeName),
      path.join("build", "bin", "Release", exeName),
      path.join("bin", exeName),
    ]);
    const modelPath = _resolveExistingFile(this._getModelCandidates(executablePath), [
      "ggml-base.bin",
      path.join("models", "ggml-base.bin"),
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

  _ensureAvailable() {
    const availability = this.getAvailability();
    if (availability.available) return availability;

    const missing = [];
    if (!availability.executablePath) {
      missing.push("whisper.cpp executable fehlt (BBM_WHISPER_CPP_PATH)");
    }
    if (!availability.modelPath) {
      missing.push("whisper.cpp Modell fehlt (BBM_WHISPER_MODEL_PATH, z. B. ggml-base.bin)");
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

  async transcribe({ filePath, language } = {}) {
    const sourcePath = String(filePath || "").trim();
    if (!sourcePath) throw new Error("filePath required");
    if (!_fileExists(sourcePath)) {
      throw new Error(`Audiodatei nicht gefunden: ${sourcePath}`);
    }

    const availability = this._ensureAvailable();
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
