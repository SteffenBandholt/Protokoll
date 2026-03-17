# Audio / KI in BBM

## Ueberblick
Die Audio-/KI-Funktion ist ein zusaetzlicher Eingabekanal fuer offene Protokolle.
Sie erzeugt keine freien Protokolle, sondern arbeitet in einer konservativen Kette:

1. Audio-Datei importieren
2. Transkript lokal erzeugen
3. Transkript in kleine Abschnitte segmentieren
4. Abschnitte gegen die aktuelle TOP-Struktur mappen
5. Strukturierte Vorschlaege speichern
6. Vorschlaege manuell pruefen und ueber bestehende Domain-Logik anwenden

Die bestehende Meeting-/TOP-Business-Logik bleibt fuehrend.
Print-/Close-Workflow und Nummernlogik werden nicht durch die Audio-Funktion umgangen.

## Datenfluss
`Audio -> audio_imports -> TranscriptionService -> transcripts -> TranscriptSegmentationService -> MeetingMappingService -> audio_suggestions -> SuggestionApplyService -> TopService`

## Wichtige Bausteine
- `C:\01_Projekte\Protokoll\src\main\services\audio\AudioImportService.js`
  Validiert Meeting, Projektbezug, Dateipfad und Format. Legt `audio_imports` an.
- `C:\01_Projekte\Protokoll\src\main\services\audio\TranscriptionService.js`
  Orchestriert die lokale Transkription und schreibt `transcripts`.
- `C:\01_Projekte\Protokoll\src\main\services\audio\engines\WhisperCppEngine.js`
  Adapter fuer lokale `whisper.cpp`-Ausfuehrung.
- `C:\01_Projekte\Protokoll\src\renderer\ui\AudioSuggestionsPanel.js`
  UI fuer Import, Status, Transkript, Vorschlaege und manuelle Pruefung.

## Persistenz
- `audio_imports`
  Importstatus, Dateipfad, Meeting-/Projektbezug
- `transcripts`
  Volltext, Engine, Sprache, optionale Segmente
- `audio_suggestions`
  Strukturierte Vorschlaege, Status, Mapping-Grund, schlanke Apply-Nachvollziehbarkeit

## Dev-Runtime
Fuer echte lokale Transkription in der Entwicklerumgebung nutzt BBM bevorzugt:

- `BBM_WHISPER_CPP_PATH`
- `BBM_WHISPER_MODEL_PATH`
- `BBM_FFMPEG_PATH`

Als Fallback werden weiterhin akzeptiert:

- `WHISPER_CPP_PATH`
- `WHISPER_MODEL_PATH`
- `FFMPEG_PATH`

Wenn in `.env` relative `_PATH`-Werte stehen, werden sie beim Start gegen das Projektverzeichnis aufgeloest.

## Empfohlene lokale Ablage
- `C:\01_Projekte\Protokoll\dev\tools\whisper.cpp\Release\whisper-cli.exe`
- `C:\01_Projekte\Protokoll\dev\models\ggml-base.bin`
- optional `C:\01_Projekte\Protokoll\dev\tools\ffmpeg\bin\ffmpeg.exe`

Die App findet diese Orte jetzt auch ohne gesetzte Variablen als Dev-Fallback.

## Setup fuer Entwickler
### Schnellster Weg
Im Projektverzeichnis ausfuehren:

```powershell
npm run setup:whisper:dev
```

Das Skript macht nur Dev-Setup:

1. Es laedt die aktuelle offizielle x64-Windows-Binary von `ggml-org/whisper.cpp`.
2. Es laedt `ggml-base.bin`.
3. Es schreibt die lokalen Pfade in `.env`.
4. Wenn `ffmpeg` bereits im PATH liegt, traegt es zusaetzlich `BBM_FFMPEG_PATH` ein.

### Manuell
Falls das Setup-Skript nicht verwendet wird:

1. `whisper-cli.exe` lokal bereitstellen
2. `ggml-base.bin` lokal bereitstellen
3. Optional `ffmpeg.exe` lokal bereitstellen
4. In `.env` oder der Shell setzen:

```dotenv
BBM_WHISPER_CPP_PATH=dev/tools/whisper.cpp/Release/whisper-cli.exe
BBM_WHISPER_MODEL_PATH=dev/models/ggml-base.bin
# BBM_FFMPEG_PATH=C:/Tools/ffmpeg/bin/ffmpeg.exe
```

`C:\01_Projekte\Protokoll\.env.example` zeigt die erwartete Form.

## Lokaler Testablauf
### Minimaltest ohne ffmpeg
1. `npm run setup:whisper:dev`
2. `npm start`
3. Offenes Protokoll oeffnen
4. `Sprachdatei auswerten` starten
5. `C:\01_Projekte\Protokoll\dev\audio-samples\demo-meeting.wav` importieren
6. Transkription starten
7. Transkript im Audio-Panel pruefen

### Optional fuer Nicht-WAV
Fuer `mp3`, `mp4`, `m4a`, `aac`, `ogg`, `flac`, `wma` muss `ffmpeg` verfuegbar sein:

- bevorzugt ueber `BBM_FFMPEG_PATH`
- alternativ ueber `FFMPEG_PATH`
- oder direkt im `PATH`

Ohne `ffmpeg` bleibt der Fehlerpfad bewusst klar:
`Fuer Nicht-WAV-Dateien wird ffmpeg benoetigt. Entweder WAV importieren oder BBM_FFMPEG_PATH setzen.`

## Typische Fehlerbilder
- Whisper-Runtime fehlt
  `BBM_WHISPER_CPP_PATH` pruefen. Fallback: `WHISPER_CPP_PATH`.
- Whisper-Modell fehlt
  `BBM_WHISPER_MODEL_PATH` pruefen. Fallback: `WHISPER_MODEL_PATH`.
- ffmpeg fehlt
  Fuer Nicht-WAV-Dateien `BBM_FFMPEG_PATH` setzen oder WAV verwenden.
- Audioformat nicht unterstuetzt
  Der Import akzeptiert nur die in `AudioImportService` hinterlegten Endungen.

## Debug-Hinweise
Die Services schreiben schlanke Statuslogs im Format:

- `[AUDIO] Import`
- `[AUDIO] Transcribe`
- `[AUDIO] Segment`
- `[AUDIO] Map`
- `[AUDIO] Apply`

## Bewusst noch nicht geloest
Dieser Schritt deckt nur die Entwicklerumgebung ab.
Nicht enthalten:

- Bundling von `whisper.cpp` fuer Endnutzer
- Installer-Integration
- automatische Ersteinrichtung fuer weitergegebene Apps
- Cloud-Alternativen
- neue Mapping-Logik
- Automatikmodi
