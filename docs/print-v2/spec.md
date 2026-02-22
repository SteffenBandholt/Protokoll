# Print V2 – Spezifikation (Arbeitsstand)

## Ziel
Ein gemeinsames Layout-Gerüst für ALLE PDF-Typen:
- Seite 1: GlobalHeader -> FullHeader -> Body-Blocks (mode-spezifisch) -> Liste
- Seite 2+: MiniHeader -> Fortsetzung des aktuellen Blocks

## Header-Definition
- GlobalHeader: Logos + Linie (nur Seite 1)
- FullHeader: fixe Geometrie (40mm zwischen Linie1 und Linie2)
- MiniHeader: Text + 3mm + Linie + 3mm (Seite 2+)

## Blocks (nur Version A)
- participantsTable (splitbar)
- variableTextBetween (max 300 Zeichen / max 4 Zeilen, Fließtext, nicht splitbar)
- topsList (splitbar)
- Schlussblöcke nach Tops:
  1) Legende: neuer Top (blau) / im Soll-fertig (grün) / im Verzug-wichtig (rot)
  2) nächste Besprechung (aus nextMeeting)
  3) Aufgestellt: Ort, den Datum + 4-5 Zeilen Nutzerdaten

## Modes
- protocol / preview: participants -> textBetween -> tops -> Schlussblöcke
- firms / todo / topsAll: Liste (ohne participants/textBetween/schluss)
- headerTest: bleibt als Entwicklungsmodus/Referenz (wird später ggf. entfernt)

## Abnahme (Golden)
Je Mode 1-2 Seiten als PNG in docs/print-v2/golden/
