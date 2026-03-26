# MIGRATION_PLAN.md

## Ziel

Die bestehende Electron-/Vanilla-JS-Anwendung wird schrittweise in eine besser wartbare React-Architektur überführt, ohne Big-Bang-Refactor und ohne die laufende App unnötig zu destabilisieren.

Dieser Plan beschreibt die bevorzugte Reihenfolge der Migration.

---

## Grundsatz

Die Migration erfolgt in kleinen, überprüfbaren Schritten.

Jeder Schritt soll:
- fachlich klein sein
- technisch reversibel sein
- möglichst wenig globale Abhängigkeiten berühren
- nach Möglichkeit manuell einfach testbar sein

Nicht Ziel dieses Plans:
- alles sofort nach React umzubauen
- den bestehenden Router früh zu ersetzen
- die gesamte App-Shell in einem Schritt neu zu bauen
- neue Komplexität durch überstürzte Architekturentscheidungen einzuführen

---

## Aktuelle Ausgangslage

Bekannte zentrale Bereiche:

- `src/main/main.js`  
  Electron-Main-Prozess

- `src/main/preload.js`  
  Bridge zu Renderer-Funktionen (`window.bbmDb`, `window.bbmPrint`, `window.bbmMail`)

- `src/renderer/main.js`  
  Start der Renderer-App und Aufbau der Shell

- `src/renderer/app/Router.js`  
  Navigation, Kontext, View-Wechsel

- `src/renderer/views/`  
  Bestehende Seitenklassen

- `src/renderer/ui/`  
  UI-Bausteine, Modals, Hilfsfunktionen

- `src/renderer/ui/react/`  
  Bereits vorhandene React-Integration, bevorzugt als Blaupause zu prüfen

---

## Migrationsprinzip

Die Migration verläuft in vier Phasen:

1. React-Inseln für kleine UI-Elemente
2. React für abgegrenzte Teilbereiche einzelner Views
3. Entkopplung von View-Logik und UI-Struktur
4. Erst danach größere Strukturentscheidungen

---

## Phase 1 – Kleine React-Inseln

### Ziel
React zunächst nur dort einsetzen, wo das Risiko niedrig ist und der Nutzen direkt sichtbar wird.

### Geeignete Kandidaten
- Dialoge
- Popups
- Auswahlkomponenten
- Bestätigungs- oder Entscheidungs-Flows
- lokal zustandsbehaftete UI-Bausteine

### Anforderungen
- kein Eingriff in globalen Router, wenn vermeidbar
- möglichst keine Änderungen an IPC-/Preload-Schnittstellen
- Business-Logik bleibt außerhalb, wenn möglich
- bestehende React-Mechanik unter `src/renderer/ui/react/` wiederverwenden

### Ergebnis dieser Phase
- mindestens 1 bis 3 funktionierende React-Inseln
- wiederverwendbares Integrationsmuster
- erste belastbare Erfahrung, wie React sauber im Legacy-Renderer eingebettet wird

---

## Phase 2 – Teilbereiche einzelner Views

### Ziel
Nicht mehr nur einzelne Dialoge, sondern klar eingegrenzte Bereiche innerhalb bestehender Views mit React rendern.

### Geeignete Kandidaten
- Seitenbereiche mit klaren Props und lokalem Zustand
- UI-Abschnitte mit wiederkehrender Darstellung
- Bereiche, die aktuell viel DOM-Code enthalten, aber wenig globale Kopplung haben

### Anforderungen
- bestehende View-Klasse darf übergangsweise Host/Container bleiben
- React übernimmt primär Rendering und lokalen UI-Zustand
- Datenzugriffe bleiben zunächst in vorhandenen Flows oder werden in kleine Adapter ausgelagert

### Ergebnis dieser Phase
- erste hybride Views
- weniger DOM-Zusammenbau in View-Klassen
- klarere Grenze zwischen Koordination und Darstellung

---

## Phase 3 – Entkopplung und Konsolidierung

### Ziel
Die Legacy-View-Klassen schrittweise vereinfachen und wiederverwendbare Muster schaffen.

### Fokus
- UI-Rendering weiter aus Klassen herauslösen
- Seiteneffekte, Datenzugriffe und Koordination klarer trennen
- Hilfsfunktionen oder Adapter schaffen, wo Legacy und React zusammenarbeiten müssen

### Anforderungen
- keine unkontrollierte Parallelstruktur
- keine neue Architekturkomplexität ohne klaren Nutzen
- Wiederverwendung bereits etablierter React-Integrationsmuster

### Ergebnis dieser Phase
- weniger schwergewichtige View-Klassen
- bessere Wartbarkeit
- klarere technische Zuständigkeiten

---

## Phase 4 – Größere Architekturentscheidungen

### Ziel
Erst auf Basis stabiler Teilergebnisse prüfen, ob größere Umbauten sinnvoll sind.

### Mögliche Themen
- Router-nahe Migration
- globalere Zustandsorganisation
- Umbau von Shell-/Layout-Bereichen
- Vereinheitlichung alter und neuer UI-Strukturen

### Bedingung
Diese Phase startet nicht automatisch, sondern nur wenn die vorherigen Phasen stabile und sinnvolle Grundlagen geliefert haben.

---

## Konkrete Reihenfolge für die nächsten Schritte

### Schritt 1
Bestehende React-Integration prüfen und als Referenz festhalten.

Zu untersuchen:
- `src/renderer/ui/react/ClosedProtocolSelector.js`
- `src/renderer/ui/react/loadReactRuntime.js`

Ziel:
- verstehen, wie React aktuell eingebunden wird
- entscheiden, was davon für weitere React-Inseln wiederverwendet werden soll

### Schritt 2
Einen kleinen, isolierten Dialog-/Popup-/Auswahl-Flow als erste echte React-Insel auswählen.

Kriterien:
- klein
- lokal
- wenig globale Abhängigkeiten
- wenig Router-Kopplung
- einfach manuell testbar

### Schritt 3
Genau diesen Kandidaten auf React umstellen, ohne Router- oder Business-Logik unnötig zu verändern.

### Schritt 4
Manuell prüfen:
- App startet
- betroffener Flow öffnet korrekt
- Speichern/Auswahl/Abbruch funktioniert wie vorher
- keine offensichtlichen UI- oder Konsolenfehler

### Schritt 5
Das entstandene Integrationsmuster dokumentieren und als Vorlage für den nächsten Kandidaten verwenden.

---

## Entscheidungskriterien für jeden einzelnen Migrationsschritt

Wenn mehrere Optionen bestehen, ist zu bevorzugen:

1. der kleinere Eingriff
2. der Eingriff mit weniger globalen Seiteneffekten
3. der Eingriff mit weniger Router-/Shell-Abhängigkeit
4. der Eingriff mit besserer manueller Testbarkeit
5. der Eingriff, der ein wiederverwendbares Muster erzeugt

---

## Was vorerst nicht angefasst werden soll

Solange nicht zwingend nötig, vermeiden:

- kompletter Austausch von `src/renderer/app/Router.js`
- Umbau der gesamten App-Shell aus `src/renderer/main.js`
- Einführung eines globalen State-Management-Frameworks
- großflächige Datei-Umsortierungen
- gleichzeitige Migration mehrerer großer Views
- Mischung aus React-Migration und allgemeiner Schönheitsreparatur

---

## Definition of Done pro Migrationsschritt

Ein Schritt gilt nur dann als abgeschlossen, wenn:

1. der betroffene Bereich klar abgegrenzt war
2. die App weiter startet
3. der betroffene Flow weiter funktioniert
4. Änderungen klein und nachvollziehbar geblieben sind
5. relevante Checks versucht und dokumentiert wurden
6. ein einfacher manueller Test beschrieben wurde
7. klar ist, ob das Muster für weitere Schritte taugt

---

## Pflichtausgabe für jeden umgesetzten Schritt

Nach jeder Umsetzung soll geliefert werden:

- welche Dateien geändert wurden
- was funktional geändert wurde
- welche Prüfungen ausgeführt wurden
- welche Risiken offen bleiben
- wie ein Nicht-Entwickler die Änderung manuell testen kann

---

## Nächster unmittelbarer Fokus

Der nächste praktische Fokus ist **nicht**:
- Router-Ersatz
- globaler State
- Komplettumbau einer großen View

Der nächste praktische Fokus ist:
- vorhandene React-Integration prüfen
- einen kleinen realen Kandidaten auswählen
- genau einen ersten sauberen React-Insel-Schritt umsetzen