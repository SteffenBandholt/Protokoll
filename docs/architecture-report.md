# Architektur-Report (Renderer)

## 1) Aufbau von Views/Screens

### Typische Dateien/Ordner
- `src/renderer/views/` enthält die Screens als Klassen (z. B. `HomeView.js`, `ProjectsView.js`, `MeetingsView.js`, `TopsView.js`, `FirmsView.js`, `ProjectFirmsView.js`, `SettingsView.js`, `ArchiveView.js`).
- `src/renderer/app/Router.js` ist die zentrale Navigations- und Kontextinstanz (`currentProjectId`, `currentMeetingId`).
- `src/renderer/main.js` baut App-Shell (Header/Sidebar/Content), initialisiert den Router und verdrahtet Sidebar-Buttons.

### Typisches View-Muster
- Üblich ist Klassenaufbau mit `constructor(...)`, `render()`, `async load()`; optional `destroy()`.
- Beispiele:
  - `src/renderer/views/HomeView.js:3` / `src/renderer/views/HomeView.js:9`
  - `src/renderer/views/MeetingsView.js:5` / `src/renderer/views/MeetingsView.js:61` / `src/renderer/views/MeetingsView.js:175`
  - `src/renderer/views/ProjectsView.js:13` / `src/renderer/views/ProjectsView.js:364` / `src/renderer/views/ProjectsView.js:397` / `src/renderer/views/ProjectsView.js:736`

### Routing/Aufruf (mit konkreten Beispielen)
- Router wird in `src/renderer/main.js:323` erstellt und initial mit `router.showHome()` gestartet (`src/renderer/main.js:560`).
- Sidebar triggert Router-Methoden direkt, z. B.:
  - `src/renderer/main.js:451` (`router.showHome()`)
  - `src/renderer/main.js:452` (`router.showProjects()`)
  - `src/renderer/main.js:454` (`router.showMeetings(...)`)
  - `src/renderer/main.js:496` (`router.showFirms()`)
  - `src/renderer/main.js:497` (`router.showSettings()`)
- `Router.js` lädt Views lazy via dynamischem Import und rendert sie zentral über `show(...)`:
  - zentrale Renderpipeline: `src/renderer/app/Router.js:326`
  - View-Imports: `src/renderer/app/Router.js:378`, `src/renderer/app/Router.js:396`, `src/renderer/app/Router.js:425`, `src/renderer/app/Router.js:434`, `src/renderer/app/Router.js:467`
  - konkrete Routenmethoden: `src/renderer/app/Router.js:377` bis `src/renderer/app/Router.js:474`
- Vor View-Wechsel wird die vorige View aufgeräumt (`destroy`/`dispose`) und danach neu gerendert (`src/renderer/app/Router.js:326`, `src/renderer/app/Router.js:355`).

## 2) Umsetzung von Popups/Modals

### Verwendete Helper/Funktionen/Klassen
- Shared Styling-Helper:
  - `applyPopupButtonStyle`: `src/renderer/ui/popupButtonStyles.js:3`
  - `applyPopupCardStyle`: `src/renderer/ui/popupButtonStyles.js:19`
- Zentrale Modal-Klassen im `ui`-Bereich:
  - `ParticipantsModals`: `src/renderer/ui/ParticipantsModals.js:20`
  - `PrintModal`: `src/renderer/ui/PrintModal.js:31`
  - `HelpModal`: `src/renderer/ui/HelpModal.js:8`
- Router-Lazy-Loader für Modals:
  - `_ensureParticipantsModals`: `src/renderer/app/Router.js:485`
  - `_ensurePrintModal`: `src/renderer/app/Router.js:531`
  - `_ensureHelpModal`: `src/renderer/app/Router.js:575`

### Typischer Open/Close-Flow
- Öffnen:
  - per Router-API, z. B. `openCandidatesModal` (`src/renderer/app/Router.js:503`), `openParticipantsModal` (`src/renderer/app/Router.js:514`), `openHelpModal` (`src/renderer/app/Router.js:593`), `openPrintModal` (`src/renderer/app/Router.js:549`)
  - Modal setzt Overlay auf sichtbar (`display = "flex"`) und fokussiert es, z. B. `ParticipantsModals` (`src/renderer/ui/ParticipantsModals.js:74`), `HelpModal` (`src/renderer/ui/HelpModal.js:336`), `PrintModal` (`src/renderer/ui/PrintModal.js:833`)
- Schließen:
  - Backdrop-Klick (`if (e.target === overlay)`), Escape-Key, Close/Cancel-Button
  - typischerweise `display = "none"` oder Entfernen aus DOM
  - Beispiele: `ParticipantsModals.close()` (`src/renderer/ui/ParticipantsModals.js:120`), `HelpModal.close()` (`src/renderer/ui/HelpModal.js:345`), `PrintModal.close()` (`src/renderer/ui/PrintModal.js:1613`)

### Zusätzlich beobachtete Popup-Erzeugung
- Start-Popup „Was ist neu/geändert“ direkt in `main.js` (nicht als eigene UI-Klasse): `src/renderer/main.js:11`, Styling über `applyPopupCardStyle`/`applyPopupButtonStyle` (`src/renderer/main.js:39`, `src/renderer/main.js:79`).

## 3) Wiederkehrende Konventionen (kurz, konkret)

- Klassische Vanilla-JS-View-Klassen mit `render()/load()` statt Framework-Komponenten (z. B. `src/renderer/views/MeetingsView.js:61`, `src/renderer/views/MeetingsView.js:175`).
- Zentrale Navigation ausschließlich über Router-Methoden und Router-Kontext (`src/renderer/app/Router.js:377`, `src/renderer/app/Router.js:433`, `src/renderer/app/Router.js:447`).
- Lazy Loading via `import(...)` für Views und zentrale UI-Modals (`src/renderer/app/Router.js:378`, `src/renderer/app/Router.js:490`, `src/renderer/app/Router.js:536`).
- Modal-Pattern ist konsistent: fixed Overlay + hoher `z-index` + Backdrop/Escape + sichtbarer Footer mit Actions (z. B. `src/renderer/ui/ParticipantsModals.js:148`, `src/renderer/ui/HelpModal.js:21`).
- Button/Card-Styling wird oft über Shared-Helper vereinheitlicht (`src/renderer/ui/popupButtonStyles.js:3`, `src/renderer/ui/popupButtonStyles.js:19`).
- Guards vor Aktionen: fehlender Projekt-/Meeting-Kontext führt zu klaren Alerts statt stiller Fehler (z. B. `src/renderer/app/Router.js:503`, `src/renderer/main.js:463`, `src/renderer/main.js:471`).

## 4) Ausreißer gegenüber dem Hauptstil (nur benannt)

- `ProjectFirmsView` hängt mehrere Overlays direkt in den View-Root statt in `document.body` (`src/renderer/views/ProjectFirmsView.js:1102`).
- `ProjectsView` öffnet `ProjectFormView` modal direkt per eigener Steuerlogik statt über `Router.showProjectForm(...)` (`src/renderer/views/ProjectsView.js:35`, `src/renderer/views/ProjectsView.js:63`, `src/renderer/views/ProjectsView.js:65`).
- `MeetingsView` und `TopsView` instanziieren `PrintModal` direkt für Preview/Vorabzug, parallel zum Router-Modalzugang (`src/renderer/views/MeetingsView.js:299`, `src/renderer/views/TopsView.js:1244`).
- `main.js` enthält ein eigenes Ad-hoc-Overlay (`maybeShowWhatsNew`) im Bootstrap-Code statt dedizierter UI-Klasse (`src/renderer/main.js:11`).
- `Router` entfernt beim View-Wechsel defensiv „hängende“ Overlays global (`_cleanupTransientOverlays`), was vom sonst lokalen Modal-Lifecycle abweicht (`src/renderer/app/Router.js:67`).
- `ProjectsViewNew` ist als Screen vorhanden, aber in der Sidebar nicht direkt verdrahtet (`src/renderer/app/Router.js:384` vs. Navigation in `src/renderer/main.js:451` bis `src/renderer/main.js:498`).

## Kurze Empfehlungen (ohne Codeänderungen)

- Modal-Verantwortung pro Feature klar einem Ort zuordnen (Router-zentral oder View-lokal, nicht gemischt).
- Für neue Screens das Standardmuster `constructor + render + load (+ destroy)` beibehalten.
- Für neue Popups immer `applyPopupButtonStyle`/`applyPopupCardStyle` verwenden.
- Overlay-Lifecycle vereinheitlichen (entweder `display`-Toggle oder DOM-Removal, nicht beides quer).
- Modal-Mountpoint vereinheitlichen (`document.body` oder klar dokumentierte Alternative).
- Router-Kontextprüfungen (`projectId`, `meetingId`) als verbindliches Vorlagenmuster weiterführen.
- Zusätzliche Navigationseinträge nur dann hinzufügen, wenn ein Screen produktiv vorgesehen ist.
- Ad-hoc-Startpopups möglichst in dedizierte UI-Module auslagern (architektonische Klarheit).
- Outlier-Fälle in `docs/UI-TECH-CONTRACT.md` knapp dokumentieren, damit Abweichungen bewusst bleiben.
