# ARCHITECTURE.md

## Zweck

Diese Datei beschreibt die Zielrichtung für die schrittweise Weiterentwicklung der bestehenden Electron-/Vanilla-JS-Anwendung zu einer besser wartbaren React-Architektur.

Sie ist keine Aufforderung für einen Big-Bang-Umbau. Alle Änderungen erfolgen inkrementell und mit möglichst geringem Risiko.

---

## Ausgangslage

Die aktuelle Anwendung ist eine Electron-App mit klassischem Renderer-Aufbau und stark DOM-zentrierter UI-Logik.

Bekannte Struktur:

- src/main/ enthält Electron-Main-Prozess und Preload.
- src/main/preload.js stellt die Bridge zu Renderer- und IPC-Funktionen bereit.
- src/renderer/main.js baut die Renderer-App-Shell auf.
- src/renderer/app/Router.js steuert Navigation, Kontextverwaltung und View-Wechsel.
- src/renderer/views/ enthält Seitenlogik als Klassen.
- src/renderer/ui/ enthält UI-Bausteine, Modals, Popups und Hilfslogik.
- src/renderer/features/ enthält fachliche Teilfunktionen.
- src/renderer/ui/react/ ist ein vorhandener React-Integrationspfad und soll als Referenz geprüft werden.

Die bestehende Struktur bleibt während der Migration zunächst gültig.

---

## Zielarchitektur

Die Zielrichtung ist eine schrittweise entkoppelte Architektur mit klaren Schichten:

1. UI
2. View-Koordination
3. Services
4. Infrastruktur

React ist die zukünftige UI-Schicht im Renderer. Die übrigen Schichten werden nicht in einem Schritt ersetzt, sondern kontrolliert weiterentwickelt.

---

## Schichtenmodell

### UI

Die UI-Schicht rendert Oberflächen und verwaltet lokalen UI-Zustand.

Zielbild:

- React-Komponenten für Darstellung
- deklaratives Rendering statt direkter DOM-Verkettung
- klar definierte Eingaben und Ausgaben
- möglichst wenige direkte Seiteneffekte

### View-Koordination

Diese Schicht verbindet Navigation, View-Lifecycle, Benutzerfluss und lokale Orchestrierung.

Zielbild:

- bestehende View-Klassen dürfen übergangsweise bestehen bleiben
- Views werden schrittweise zu Koordinatoren statt zu kompletten DOM-Erzeugern
- React-Inseln werden von bestehenden Views oder Host-Komponenten eingebettet

### Services

Diese Schicht bündelt fachliche Logik, Datenaufbereitung und wiederverwendbare Anwendungsabläufe.

Zielbild:

- Business-Logik bleibt aus der Darstellung herausgelöst
- vorhandene Logik wird bevorzugt weiterverwendet statt neu gebaut
- bei Bedarf entstehen kleine Adapter zwischen View-Koordination und bestehender Logik

### Infrastruktur

Diese Schicht umfasst Electron, Preload, IPC, Datenzugriff und andere technische Integrationen.

Zielbild:

- window.bbmDb, window.bbmPrint und window.bbmMail bleiben zunächst gültige Integrationspunkte
- Preload-Bridge und IPC werden nicht parallel zur UI-Migration groß umgebaut
- Infrastrukturänderungen erfolgen nur, wenn ein konkreter Migrationsschritt sie zwingend braucht

---

## Architekturprinzipien

### 1. Inselstrategie statt Komplettumbau

React wird zunächst als klar abgegrenzte Insel in die bestehende Renderer-Struktur integriert.

Bevorzugte erste Kandidaten:

- Dialoge
- Popups
- Auswahlkomponenten
- lokal gekapselte UI-Bereiche
- kleine Teilbereiche einzelner Views

Nicht als erste Kandidaten:

- kompletter Router
- globale App-Shell
- flächiger Austausch aller View-Klassen
- globale Zustandsneustrukturierung in einem Schritt

### 2. Trennung von Darstellung, Koordination und Infrastruktur

Neue UI-Bausteine sollen Darstellung und lokalen Zustand übernehmen, ohne fachliche Logik, Datenzugriffe und Infrastruktur unnötig eng zu vermischen.

### 3. Bestehende Integrationen respektieren

Vorhandene Integrationen wie Router-Methoden, View-Lifecycle-Muster und Preload-APIs werden zunächst respektiert und nur bei klarer Notwendigkeit angepasst.

### 4. Adapter statt harter Brüche

Wo Legacy-Code und React zusammenarbeiten, sind kleine Adapter oder Host-Schichten erwünscht, solange sie den Übergang vereinfachen und das Risiko senken.

### 5. Lokaler Zustand vor globalem Store

Neue React-Schritte sollen zuerst mit lokalem Komponenten-Zustand, klaren Props und bei echtem Bedarf mit begrenztem Context arbeiten. Ein globaler Store ist kein früher Standard-Schritt.

---

## Migrationsrichtung

### Phase 1 - React-Inseln

React wird für kleine, isolierte UI-Bausteine eingeführt.

### Phase 2 - View-Teilbereiche

Abgegrenzte Bereiche bestehender Views werden schrittweise mit React gerendert.

### Phase 3 - Entkopplung

View-Koordination, Darstellung und Services werden sauberer getrennt, ohne die App-Struktur großflächig neu zu bauen.

### Phase 4 - Spätere größere Schritte

Erst wenn ausreichend stabile Teilmigrationen existieren, werden router-nahe, shell-nahe oder globalere Strukturfragen neu bewertet.

---

## Unerwünschte Muster

Vermeiden:

- Big-Bang-Migrationen
- gleichzeitigen Umbau mehrerer Schichten ohne Zwang
- frühe Router-Neuerfindung
- flächige Shell-Umbauten
- neue Frameworks oder State-Manager ohne klaren Nutzen
- Refactors, die nur moderner aussehen, aber keine sichere Verbesserung bringen

---

## Definition of Done aus Architektursicht

Ein Migrationsschritt ist architektonisch gelungen, wenn:

1. der Schritt klar abgegrenzt ist
2. das Risiko begrenzt bleibt
3. keine unnötigen globalen Umbauten stattfinden
4. die Rolle von UI, Koordination, Services und Infrastruktur nachvollziehbarer wird
5. bestehendes Verhalten im betroffenen Bereich erhalten bleibt
6. das Ergebnis als Vorlage für weitere kleine Schritte dienen kann

---

## Verwandte Dokumente

Diese Architektur wird durch folgende Dokumente konkretisiert:

- AGENTS.md beschreibt Regelwerk, Guardrails und Arbeitsmodus.
- MIGRATION_PLAN.md beschreibt Phasen, nächste Schritte und Definition of Done.
