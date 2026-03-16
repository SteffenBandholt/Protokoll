# Audio / KI in BBM

## Überblick
Die Audio-/KI-Funktion ist ein zusätzlicher Eingabekanal für offene Protokolle.
Sie erzeugt keine freien Protokolle, sondern arbeitet in einer konservativen Kette:

1. Audio-Datei importieren
2. Transkript lokal erzeugen
3. Transkript in kleine Abschnitte segmentieren
4. Abschnitte gegen die aktuelle TOP-Struktur mappen
5. strukturierte Vorschläge speichern
6. Vorschläge manuell prüfen und über bestehende Domain-Logik anwenden

Die bestehende Meeting-/TOP-Business-Logik bleibt führend.
Print-/Close-Workflow und Nummernlogik werden nicht durch die Audio-Funktion umgangen.

## Datenfluss
`Audio -> audio_imports -> TranscriptionService -> transcripts -> TranscriptSegmentationService -> MeetingMappingService -> audio_suggestions -> SuggestionApplyService -> TopService`

## Wichtige Bausteine
- `C:\01_Projekte\Protokoll\src\main\services\audio\AudioImportService.js`
  Validiert Meeting, Projektbezug, Dateipfad und Format. Legt `audio_imports` an.
- `C:\01_Projekte\Protokoll\src\main\services\audio\TranscriptionService.js`
  Orchestriert die lokale Transkription und schreibt `transcripts`.
- `C:\01_Projekte\Protokoll\src\main\services\audio\engines\WhisperCppEngine.js`
  Adapter für lokale `whisper.cpp`-Ausführung.
- `C:\01_Projekte\Protokoll\src\main\services\audio\TranscriptSegmentationService.js`
  Zerlegt das Transkript regelbasiert in kleine Sinnabschnitte.
- `C:\01_Projekte\Protokoll\src\main\services\audio\MeetingMappingService.js`
  Baut die TOP-Arbeitskarte und erzeugt konservative Vorschläge.
- `C:\01_Projekte\Protokoll\src\main\services\audio\SuggestionApplyService.js`
  Wendet Vorschläge robust über bestehende Domain-Services an.
- `C:\01_Projekte\Protokoll\src\renderer\ui\AudioSuggestionsPanel.js`
  UI für Import, Status, Transkript, Vorschläge und manuelle Prüfung.

## Persistenz
- `audio_imports`
  Importstatus, Dateipfad, Meeting-/Projektbezug
- `transcripts`
  Volltext, Engine, Sprache, optionale Segmente
- `audio_suggestions`
  strukturierte Vorschläge, Status, Mapping-Grund, schlanke Apply-Nachvollziehbarkeit

## Runtime-Voraussetzungen
Für echte lokale Transkription werden aktuell diese Pfade unterstützt:

- `BBM_WHISPER_CPP_PATH`
  Pfad zur `whisper-cli` bzw. `whisper-cli.exe`
- `BBM_WHISPER_MODEL_PATH`
  Pfad zum Modell, z. B. `ggml-base.bin`
- `BBM_FFMPEG_PATH`
  Optional, aber nötig für Nicht-`wav`-Dateien

Zusätzlich unterstützt der Adapter als Fallback auch:
- `WHISPER_CPP_PATH`
- `WHISPER_MODEL_PATH`
- `FFMPEG_PATH`

## Entwickler-Quickstart
1. Offenes Protokoll öffnen
2. `Sprachdatei auswerten` starten
3. Zum schnellen Test `C:\01_Projekte\Protokoll\dev\audio-samples\demo-meeting.wav` verwenden
4. Falls keine Runtime vorhanden ist, Demo-Vorschläge im Panel nutzen
5. Logs im Terminal nach `[AUDIO] ...` filtern

## Typische Fehlerbilder
- Whisper runtime fehlt
  `BBM_WHISPER_CPP_PATH` oder `WHISPER_CPP_PATH` prüfen
- Modell fehlt
  `BBM_WHISPER_MODEL_PATH` oder `WHISPER_MODEL_PATH` prüfen
- ffmpeg fehlt
  Für `mp3`, `m4a`, `aac`, `ogg`, `flac`, `wma` entweder `wav` verwenden oder `BBM_FFMPEG_PATH` setzen
- Audioformat nicht unterstützt
  Der Import akzeptiert nur die in `AudioImportService` hinterlegten Endungen

## Debug-Hinweise
Die Services schreiben schlanke Statuslogs im Format:
- `[AUDIO] Import`
- `[AUDIO] Transcribe`
- `[AUDIO] Segment`
- `[AUDIO] Map`
- `[AUDIO] Apply`

Die Logs sind bewusst knapp gehalten und sollen vor allem den aktuellen Verarbeitungsschritt und Fehlerpfad sichtbar machen.
