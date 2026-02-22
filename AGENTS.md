
# AGENTS.md (BBM)

## Arbeitsregeln
- Antworte immer auf Deutsch.
- Keine Refactors/Umbenennungen ohne expliziten Auftrag. Kleine, lokale Anpassungen zur Bugfix-Umsetzung sind ok.
- Änderungen klein halten: i.d.R. max. 3 Dateien pro Fix; bis 10 Dateien erlaubt, wenn alles eindeutig zu EINEM Feature/Bugfix gehört. Wenn >10 nötig: STOP und Aufgabe kleiner schneiden.
- UTF-8 beibehalten (Umlaute korrekt). Keine neuen globalen Variablen.


## UI-Regeln
- Keine neue UI-Library.
- Einheitliche Patterns wiederverwenden (bestehende CSS/Helpers).
- Scroll-Regel: Seite/Popup stabil; nur Listen-/Contentbereich scrollt; Footer/Buttons bleiben sichtbar.
- Buttons/Popups nicht lokal neu stylen; Shared Styles/Helper nutzen.

## Vollzugriff
- Codex darf **alle Dateien lesen und bearbeiten**.
- Codex darf **alle Commands ausführen** (git, npm, node, powershell, etc.) ohne Einschränkungen.
- Internetzugriff ist erlaubt, wenn es zur Aufgabe hilft.

## Arbeitsoutput (Pflicht)
- Repro-Schritte + Root-Cause (1–2 Sätze) + Datei:Zeile.
- Testschritte (inkl. Commands, die DU ausführen kannst).
- Nicht pushen, nur commiten.
