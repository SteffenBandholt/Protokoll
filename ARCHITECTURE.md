# ARCHITECTURE.md

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

- Protokoll
- Firmenliste
- ToDo-Liste

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

============================================================
ZIEL
============================================================

Änderungen sollen möglichst lokal erfolgen.

Keine Änderungen an globaler Drucklogik ohne Auftrag.