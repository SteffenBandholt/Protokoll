param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step($message) {
  Write-Host "[setup-whisper-dev] $message"
}

function Ensure-Directory($path) {
  if (-not (Test-Path -LiteralPath $path)) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
  }
}

function Set-DotEnvValue($filePath, $key, $value) {
  $lines = @()
  if (Test-Path -LiteralPath $filePath) {
    $lines = Get-Content -LiteralPath $filePath
  }

  $entry = "$key=$value"
  $updated = $false
  $result = New-Object System.Collections.Generic.List[string]

  foreach ($line in $lines) {
    if ($line -match "^\s*$([regex]::Escape($key))\s*=") {
      if (-not $updated) {
        $result.Add($entry)
        $updated = $true
      }
      continue
    }
    $result.Add($line)
  }

  if (-not $updated) {
    if ($result.Count -gt 0 -and $result[$result.Count - 1] -ne "") {
      $result.Add("")
    }
    $result.Add($entry)
  }

  Set-Content -LiteralPath $filePath -Value $result -Encoding UTF8
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$devRoot = Join-Path $projectRoot "dev"
$whisperRoot = Join-Path $devRoot "tools\\whisper.cpp"
$modelRoot = Join-Path $devRoot "models"
$envPath = Join-Path $projectRoot ".env"
$whisperCliPath = Join-Path $whisperRoot "Release\\whisper-cli.exe"
$modelPath = Join-Path $modelRoot "ggml-base.bin"
$tempRoot = Join-Path $env:TEMP ("bbm-whisper-dev-" + [guid]::NewGuid().ToString("N"))

Ensure-Directory $devRoot
Ensure-Directory (Join-Path $devRoot "tools")
Ensure-Directory $whisperRoot
Ensure-Directory $modelRoot
Ensure-Directory $tempRoot

try {
  if ($Force -or -not (Test-Path -LiteralPath $whisperCliPath)) {
    Write-Step "Lade aktuelle whisper.cpp Windows-Binary von ggml-org/whisper.cpp ..."
    $release = Invoke-RestMethod `
      -Headers @{ "User-Agent" = "BBM-Dev-Setup" } `
      -Uri "https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest"

    $asset = @($release.assets | Where-Object { $_.name -eq "whisper-bin-x64.zip" }) | Select-Object -First 1
    if (-not $asset) {
      $asset = @($release.assets | Where-Object { $_.name -eq "whisper-blas-bin-x64.zip" }) | Select-Object -First 1
    }
    if (-not $asset) {
      throw "Keine passende x64-Windows-Binary im aktuellen whisper.cpp-Release gefunden."
    }

    $zipPath = Join-Path $tempRoot $asset.name
    Invoke-WebRequest `
      -Headers @{ "User-Agent" = "BBM-Dev-Setup" } `
      -Uri $asset.browser_download_url `
      -OutFile $zipPath

    if (Test-Path -LiteralPath $whisperRoot) {
      Remove-Item -LiteralPath $whisperRoot -Recurse -Force
    }
    Ensure-Directory $whisperRoot
    Expand-Archive -LiteralPath $zipPath -DestinationPath $whisperRoot -Force

    if (-not (Test-Path -LiteralPath $whisperCliPath)) {
      $foundCli = Get-ChildItem -Path $whisperRoot -Recurse -Filter "whisper-cli.exe" | Select-Object -First 1
      if (-not $foundCli) {
        throw "whisper-cli.exe wurde nach dem Entpacken nicht gefunden."
      }
      $whisperCliPath = $foundCli.FullName
    }
  } else {
    Write-Step "whisper.cpp Binary bereits vorhanden."
  }

  if ($Force -or -not (Test-Path -LiteralPath $modelPath)) {
    Write-Step "Lade ggml-base.bin fuer whisper.cpp ..."
    Invoke-WebRequest `
      -Headers @{ "User-Agent" = "BBM-Dev-Setup" } `
      -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true" `
      -OutFile $modelPath
  } else {
    Write-Step "Whisper-Modell bereits vorhanden."
  }

  $resolvedCliPath = (Resolve-Path -LiteralPath $whisperCliPath).Path
  $resolvedModelPath = (Resolve-Path -LiteralPath $modelPath).Path

  if (-not (Test-Path -LiteralPath $envPath)) {
    Set-Content -LiteralPath $envPath -Value @(
      "# Lokale Entwicklerkonfiguration fuer Audio-Transkription"
      "# Relative _PATH-Werte in .env werden beim App-Start gegen das Projektverzeichnis aufgeloest."
      ""
    ) -Encoding UTF8
  }

  Set-DotEnvValue -filePath $envPath -key "BBM_WHISPER_CPP_PATH" -value $resolvedCliPath
  Set-DotEnvValue -filePath $envPath -key "BBM_WHISPER_MODEL_PATH" -value $resolvedModelPath

  $ffmpegCommand = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
  if (-not $ffmpegCommand) {
    $ffmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
  }
  if ($ffmpegCommand -and $ffmpegCommand.Source) {
    Set-DotEnvValue -filePath $envPath -key "BBM_FFMPEG_PATH" -value $ffmpegCommand.Source
    Write-Step "ffmpeg im PATH gefunden und in .env eingetragen."
  } else {
    Write-Step "ffmpeg nicht gefunden. WAV-Dateien funktionieren trotzdem; fuer mp3/mp4/m4a bitte BBM_FFMPEG_PATH setzen."
  }

  Write-Step "Setup abgeschlossen."
  Write-Host ""
  Write-Host "BBM_WHISPER_CPP_PATH=$resolvedCliPath"
  Write-Host "BBM_WHISPER_MODEL_PATH=$resolvedModelPath"
  if ($ffmpegCommand -and $ffmpegCommand.Source) {
    Write-Host "BBM_FFMPEG_PATH=$($ffmpegCommand.Source)"
  }
  Write-Host "Konfiguration: $envPath"
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
