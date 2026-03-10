# ARCHITECTURE.md

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

- Protokoll
- Firmenliste
- ToDo-Liste

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