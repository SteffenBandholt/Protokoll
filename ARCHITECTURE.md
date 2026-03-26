# ARCHITECTURE.md

## Zweck

Diese Datei beschreibt die Zielrichtung für die schrittweise Weiterentwicklung der bestehenden Electron-/Vanilla-JS-Anwendung zu einer besser wartbaren React-Architektur.

Sie ist keine Aufforderung für einen Big-Bang-Umbau.  
Alle Änderungen erfolgen inkrementell und mit möglichst geringem Risiko.

---

## Ausgangslage

Die aktuelle Anwendung ist eine Electron-App mit klassischem Renderer-Aufbau und stark DOM-zentrierter UI-Logik.

Bekannte Struktur:

- `src/main/`  
  Electron-Main-Prozess und Preload

- `src/main/preload.js`  
  Bridge zwischen Renderer und Electron-/IPC-Funktionen  
  Exponiert u. a.:
  - `window.bbmDb`
  - `window.bbmPrint`
  - `window.bbmMail`

- `src/renderer/main.js`  
  Aufbau der Renderer-App-Shell, globale UI-Initialisierung, Header/Sidebar-Verdrahtung

- `src/renderer/app/Router.js`  
  Navigation, Kontextverwaltung, View-Wechsel, Lazy-Loading von Views

- `src/renderer/views/`  
  Seitenlogik als Klassen

- `src/renderer/ui/`  
  UI-Bausteine, Modals, Popups, Hilfslogik

- `src/renderer/features/`  
  fachliche Teilfunktionen

Es existiert bereits mindestens ein React-Integrationspfad unter:

- `src/renderer/ui/react/`

Dieser vorhandene React-Pfad ist bevorzugt als Blaupause zu prüfen, bevor neue Integrationsmuster eingeführt werden.

---

## Zielarchitektur

### Kurzfassung

Die Anwendung soll schrittweise in eine Struktur überführt werden, in der:

1. React UI-Rendering und lokalen UI-Zustand übernimmt
2. Legacy-Business-Logik nicht unnötig neu erfunden wird
3. Electron-/IPC-Zugriffe klar getrennt bleiben
4. bestehende Legacy-Bereiche kontrolliert weiterlaufen können
5. neue React-Bausteine parallel zu Legacy-Views eingeführt werden können

---

## Architekturprinzipien

### 1. Inselstrategie statt Komplettumbau

React wird zunächst als klar abgegrenzte Insel in die bestehende App integriert.

Geeignete erste Kandidaten:
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

---

### 2. Trennung von UI und Seiteneffekten

Ziel ist eine klarere Trennung zwischen:

- Rendering
- lokalem UI-Zustand
- fachlicher Logik
- Datenzugriff
- Electron-/IPC-Kommunikation

React-Komponenten sollen möglichst nicht direkt alle Seiteneffekte und Infrastrukturdetails in sich bündeln.

---

### 3. Bestehende Integrationen respektieren

Vorhandene Integrationen wie:

- `window.bbmDb`
- `window.bbmPrint`
- `window.bbmMail`
- bestehende Router-Methoden
- bestehende View-Lifecycle-Muster

werden zunächst respektiert und nur dann angepasst, wenn es für einen konkreten Migrationsschritt nötig ist.

---

### 4. Adapter statt harter Brüche

Wo Legacy und React zusammenarbeiten müssen, sind kleine Adapter oder Brücken erlaubt und erwünscht.

Beispiele:
- Legacy-Code öffnet eine React-Komponente in einem Dialog-Container
- Router übergibt Kontextdaten an eine React-Insel
- React ruft bestehende Actions/Services auf, statt Business-Logik neu zu erfinden

Nicht erwünscht:
- globale Architekturbrüche ohne Not
- gleichzeitiger Austausch mehrerer Schichten

---

### 5. Lokaler Zustand vor globalem Store

Es soll nicht vorschnell ein globaler Store eingeführt werden.

Reihenfolge:
1. lokaler Komponenten-Zustand
2. props / klarer Datendurchfluss
3. gezielte Context-Nutzung nur bei echtem Bedarf
4. globaler Store erst dann, wenn die Problemgröße das wirklich rechtfertigt

---

## Zielbild pro Schicht

### UI / Darstellung
Soll zunehmend in React-Komponenten liegen.

Eigenschaften:
- deklaratives Rendering
- lokale Zustandsverwaltung
- nachvollziehbare Ein-/Ausgaben
- möglichst wenig direkte DOM-Manipulation

---

### View-Komposition
Legacy-Views dürfen übergangsweise bestehen bleiben, sollen aber nach und nach eher zu Containern/Koordinatoren werden statt komplettes DOM selbst zusammenzubauen.

Langfristige Richtung:
- View-Klasse koordiniert
- React rendert UI-Teilbereiche
- Seiteneffekte und Datenzugriffe werden gezielter ausgelagert

---

### Routing / Navigation
Der bestehende Router bleibt zunächst bestehen.

Ziel:
- keine frühe Router-Neuerfindung
- React-Komponenten werden zunächst innerhalb der bestehenden Navigationsstruktur verwendet
- Router-Ablösung erst dann, wenn ein signifikanter Teil der UI bereits stabil in React läuft

---

### Datenzugriff / IPC
Preload-Bridge und IPC-Schnittstellen bleiben vorerst die maßgebliche Infrastruktur.

Ziel:
- keine direkte Vermischung von React-Migration und IPC-Neudesign
- bestehende IPC-Zugriffe möglichst stabil halten
- falls nötig, dünne Service-/Adapter-Schicht zwischen UI und `window.bbm*` schaffen

---

## Empfohlene Migrationsreihenfolge

### Phase 1 – React-Inseln
- kleine Dialoge
- Popups
- Auswahl- oder Bestätigungs-Flows
- einzelne lokale UI-Bausteine

### Phase 2 – Teilbereiche einzelner Views
- begrenzte UI-Sektionen mit klaren Props
- wenig Router-Kopplung
- wenig globale Seiteneffekte

### Phase 3 – Koordination und Entkopplung
- View-Klassen vereinfachen
- Logik sauberer zwischen UI, Services und Koordination trennen
- wiederverwendbare React-Bausteine etablieren

### Phase 4 – Größere Strukturanpassungen
- erst jetzt über Router-Nähe, globaleren Zustand oder Shell-Umbau nachdenken
- nur auf Basis echter Notwendigkeit, nicht aus Dogma

---

## Erlaubte Muster

Bevorzugt:

- React als isolierte Render-Insel
- kleine Host-/Mount-Funktionen für React-Komponenten
- Übergabe klarer Parameter statt versteckter Globals
- Wiederverwendung vorhandener React-Loader-/Bootstrap-Muster
- Legacy-Callback oder Adapter, wenn dadurch das Risiko sinkt

Ebenfalls okay:
- temporäre Mischformen, wenn sie sauber eingegrenzt sind
- schmale Brücken zwischen Legacy und React

---

## Unerwünschte Muster

Vermeiden:

- direkte Großumbauten über mehrere Architektur-Schichten gleichzeitig
- großflächige DOM-Manipulation innerhalb neuer React-Komponenten
- unklare Mischzustände ohne klaren Besitz von State
- neue Abhängigkeiten oder Frameworks ohne klaren Mehrwert
- Refactors, die nur „moderner aussehen“, aber das Risiko erhöhen
- das Nachbauen des bestehenden Chaos in React-Komponenten

---

## Definition einer guten React-Insel

Eine React-Insel ist gut, wenn sie:

1. klar abgegrenzt ist
2. einen kleinen, verständlichen Zweck hat
3. wenig globale Abhängigkeiten besitzt
4. keine Änderung am globalen Router erzwingt
5. bestehende Business-Logik weiterverwenden kann
6. mit wenig Seiteneffekten integrierbar ist
7. sich leicht manuell testen lässt

---

## Definition of Done für Architektursicht

Ein Migrationsschritt ist architektonisch gelungen, wenn:

1. React-Anteil sinnvoll erweitert wurde
2. Risiko begrenzt blieb
3. keine unnötigen globalen Umbauten passiert sind
4. Legacy-/React-Grenzen nachvollziehbar sind
5. bestehendes Verhalten erhalten blieb
6. die Änderung eine Blaupause für weitere Schritte liefert

---

## Entscheidungskriterien bei mehreren Optionen

Wenn es mehrere technische Wege gibt, ist zu bevorzugen:

1. der kleinere und reversiblere Eingriff
2. der Weg mit weniger Router-/Shell-Kopplung
3. der Weg mit weniger IPC-/Infrastrukturänderung
4. der Weg, der vorhandene React-Muster wiederverwendet
5. der Weg, der manuell leicht testbar ist

---

## Dokumentationspflicht bei neuen Mustern

Wenn ein neuer React-Integrationsweg eingeführt wird, soll dokumentiert werden:

- wo er verwendet wird
- wie Legacy-Code ihn aufruft
- welche Daten reingehen
- welche Events/Callbacks rausgehen
- ob das Muster für weitere Migrationen taugt

---

## Praktische Leitfrage vor jeder größeren Änderung

Vor jeder Änderung soll geprüft werden:

- Ist das wirklich der kleinste sinnvolle Schritt?
- Muss dafür Router, Shell oder IPC angefasst werden?
- Gibt es schon ein bestehendes React-Muster im Projekt?
- Kann dieselbe Wirkung mit einer kleineren React-Insel erreicht werden?
- Wird hier echte Struktur verbessert oder nur Technik ausgetauscht?

---

## Schlussregel

Das Ziel ist nicht, möglichst schnell „alles in React“ zu haben.

Das Ziel ist:
- weniger Kopplung
- besser wartbare UI
- kontrollierte Migration
- stabile App während des Umbaus
- wiederverwendbare Migrationsmuster statt hektischer Komplettsanierung