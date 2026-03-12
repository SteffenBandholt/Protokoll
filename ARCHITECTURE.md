# ARCHITECTURE.md

<<<<<<< Updated upstream
<<<<<<< Updated upstream
Dieses Dokument beschreibt die aktuelle Architektur der App.

---

# Renderer

UI und Interaktionen laufen im Renderer.

Wichtige Dateien:

src/renderer/views
src/renderer/ui
src/renderer/app

---

# Router

Router verbindet Renderer und Main-Prozess.

src/renderer/app/Router.js

---

# Main-Prozess

Systemzugriffe laufen im Main-Prozess.

src/main/main.js

---

# Drucksystem

Der produktive PDF-Druck läuft über:

PrintModal.js

Nicht über print/v2.

print/v2 enthält Layout-Komponenten, die teilweise vom Renderer genutzt werden können, ist aber kein vollständiger Druckworkflow.

---

# PDF-Dateien

Erzeugt werden:
=======
=======
>>>>>>> Stashed changes
Vor Änderungen an Workflow, Druck, Routing oder TOP-Logik diese Datei lesen.

Für Arbeitsregeln gilt AGENTS.md.
Für Projektkontext gilt UEBERGABE.txt.

============================================================
Renderer
============================================================

UI-Komponenten:

src/renderer/ui/

Views:

src/renderer/views/

Routing:

src/renderer/app/Router.js

============================================================
Main-Prozess
============================================================

IPC-Handler:

src/main/ipc/

PDF / Druck:

printIpc.js

============================================================
Drucklogik
============================================================
Dokumenttypen:
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

- Protokoll
- Firmenliste
- ToDo-Liste

<<<<<<< Updated upstream
<<<<<<< Updated upstream
Speicherorte:

Protokoll → /Protokolle
Listen → /Listen

---

# Mailversand

Der Mailversand erzeugt:

- Outlook Draft

oder

- Fallback

Anhänge müssen exakt der Auswahl im Versandpopup entsprechen.

---

# Wichtig

Bei Fehlern immer zuerst prüfen:

- welche Datei tatsächlich aktiv ist
- welcher Renderer die Ausgabe erzeugt
- wo der Rückgabepfad endet
=======
=======
>>>>>>> Stashed changes
Regeln:

Offene Besprechung
→ Vorschau

Geschlossene Besprechung
→ PDF-Datei im Projektordner

============================================================
Workflow
============================================================

Protokoll beenden:

1. Meeting schließen
2. Protokoll-PDF erzeugen
3. Idle-Status

============================================================
TOP-LOGIK
============================================================

Neuer TOP:

- blau
- Stern

Übernommener TOP geändert:

- blau
- Stern

# Textbaustein für ARCHITECTURE.md

============================================================
DRUCKARCHITEKTUR (STAND AKTUELL)
============================================================

Produktiver Druckpfad

Die aktuelle PDF-Erzeugung läuft vollständig über die Altlogik in PrintModal.js.

Dokumenttypen:

- Protokoll
- Firmenliste
- ToDo-Liste

Ablauf

Renderer:
PrintModal.js

→ ruft

window.bbmPrint.printPdf(...)

→ IPC:
src/main/ipc/printIpc.js

→ tatsächliche PDF-Erzeugung

Hauptfunktionen

_printMeeting()    → Protokoll
_printFirmsPdf()   → Firmenliste
_printTodoPdf()    → ToDo-Liste

Alle drei Funktionen rufen am Ende dieselbe Druckschnittstelle auf:

window.bbmPrint.printPdf()

============================================================
AUTOMATISCHER DRUCKWORKFLOW
============================================================

Beim Klick auf

"Protokoll beenden"

werden automatisch drei PDFs nacheinander erzeugt:

1. Protokoll → Projektordner
2. Firmenliste → Projektordner / Listen
3. ToDo-Liste → Projektordner / Listen

Dieser Ablauf wird aktuell über die bestehende Altlogik gesteuert.

Wichtig:

- keine Vorschau
- direkter Dateidruck
- feste Reihenfolge

============================================================
MANUELLER DRUCK
============================================================

Über den Header:

"Drucken"

werden Vorschauen erzeugt für:

- Protokoll
- Firmenliste
- ToDo-Liste

Diese laufen ebenfalls über PrintModal.

============================================================
PRINT/V2
============================================================

Im Repository existiert ein neuer Ansatz:

src/renderer/print/v2/

Dieser enthält eine geplante vereinheitlichte Druckpipeline für Layout und Rendering.

Aktueller Status:

- nicht produktiv angebunden
- wird aktuell von keinem Workflow verwendet

Die bestehende Anwendung nutzt ausschließlich die Altlogik über PrintModal.

============================================================
LANGFRISTIGE ZIELRICHTUNG
============================================================

Langfristig könnte die Ausgabeerzeugung schrittweise auf die print/v2-Pipeline umgestellt werden.

Dabei sollte gelten:

- Workflow/Trigger bleiben getrennt von Rendering
- Rendering erfolgt über eine gemeinsame Pipeline
- Dokumenttypen werden über Parameter gesteuert
  (z. B. protocol, firms, todo)

Dieser Umbau ist aktuell nicht umgesetzt.

============================================================
WICHTIG FÜR ÄNDERUNGEN
============================================================

Bei Anpassungen am Drucksystem gilt:

- Änderungen zuerst im bestehenden PrintModal-Workflow prüfen
- print/v2 nur verwenden, wenn bewusst ein Refactor geplant ist
- automatische PDF-Erzeugung bei "Protokoll beenden" darf nicht beschädigt werden

============================================================
ZIEL
============================================================

Änderungen sollen möglichst lokal erfolgen.

<<<<<<< Updated upstream
Keine Änderungen an globaler Drucklogik ohne Auftrag.
>>>>>>> Stashed changes
=======
Keine Änderungen an globaler Drucklogik ohne Auftrag.
>>>>>>> Stashed changes
