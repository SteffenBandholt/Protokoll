# MIGRATION_PLAN.md

## Ziel

Die bestehende Electron-/Vanilla-JS-Anwendung wird schrittweise in eine besser wartbare React-Architektur überführt, ohne Big-Bang-Refactor und ohne die laufende App unnötig zu destabilisieren.

Dieser Plan beschreibt die bevorzugte Reihenfolge der Migration und die kleinsten sinnvollen nächsten Schritte.

---

## Grundsatz

Die Migration erfolgt in kleinen, überprüfbaren Schritten.

Jeder Schritt soll:

- fachlich klein sein
- technisch reversibel sein
- möglichst wenig globale Abhängigkeiten berühren
- möglichst einfach manuell testbar sein

Nicht Ziel dieses Plans:

- alles sofort nach React umzubauen
- den bestehenden Router früh zu ersetzen
- die gesamte App-Shell in einem Schritt neu zu bauen
- neue Komplexität durch übereilte Architekturentscheidungen einzuführen

---

## Phasen

### Phase 1 - React-Inseln

React wird zuerst für kleine, isolierte UI-Bausteine eingeführt.

Bevorzugte Kandidaten:

- Dialoge
- Popups
- Auswahlkomponenten
- Bestätigungs- oder Entscheidungs-Flows
- lokal zustandsbehaftete UI-Bausteine

Leitplanken:

- kein unnötiger Eingriff in Router, IPC oder App-Shell
- bestehende Business-Logik bleibt möglichst außerhalb der React-Insel
- vorhandene Muster unter src/renderer/ui/react/ zuerst prüfen und wiederverwenden

### Phase 2 - View-Teilbereiche

Nach ersten stabilen Inseln werden klar abgegrenzte Teilbereiche einzelner Views mit React gerendert.

Bevorzugte Kandidaten:

- UI-Sektionen mit klaren Props
- Bereiche mit lokalem Zustand
- Abschnitte mit wenig Router-Kopplung und wenig globalen Seiteneffekten

Leitplanken:

- bestehende View-Klassen dürfen vorerst Host oder Koordinator bleiben
- React übernimmt zunächst primär Rendering und lokalen UI-Zustand

### Phase 3 - Entkopplung

Auf Basis funktionierender Teilmigrationen werden View-Koordination, UI und Services sauberer getrennt.

Ziele:

- schwergewichtige View-Klassen schrittweise vereinfachen
- Seiteneffekte, Datenzugriffe und UI besser entkoppeln
- wiederverwendbare React-Integrationsmuster festigen

### Phase 4 - Spätere größere Schritte

Erst danach werden größere Strukturentscheidungen geprüft.

Mögliche Themen:

- router-nahe Migration
- globalere Zustandsorganisation
- Shell- oder Layout-Umbauten
- weitere Vereinheitlichung alter und neuer UI-Strukturen

Diese Phase startet nur bei klarer Notwendigkeit und nicht automatisch.

---

## Konkrete nächste Schritte

### Schritt 1 - Bestehende Struktur analysieren

Vor dem ersten funktionalen React-Schritt wird die bestehende React-Integration im Repository geprüft.

Referenzen:

- src/renderer/ui/react/
- src/renderer/ui/react/ClosedProtocolSelector.js
- src/renderer/ui/react/loadReactRuntime.js

Ziel:

- verstehen, wie React aktuell eingebunden wird
- wiederverwendbare Muster identifizieren
- unnötige neue Integrationsvarianten vermeiden

### Schritt 2 - Ersten kleinen Kandidaten wählen

Es wird genau ein kleiner, isolierter Kandidat für den ersten praktischen React-Schritt ausgewählt.

Auswahlkriterien:

- klein
- lokal
- wenig globale Abhängigkeiten
- wenig Router-Kopplung
- einfach manuell testbar

### Schritt 3 - Kandidaten lokal migrieren

Nur der gewählte Kandidat wird auf eine React-Insel umgestellt, ohne Router, Shell, IPC oder allgemeine Business-Logik unnötig zu verändern.

### Schritt 4 - Muster dokumentieren

Das dabei entstandene Integrationsmuster wird knapp dokumentiert und als Vorlage für den nächsten kleinen Schritt verwendet.

---

## Entscheidungskriterien für jeden Migrationsschritt

Wenn mehrere Optionen bestehen, ist zu bevorzugen:

1. der kleinere Eingriff
2. der Eingriff mit weniger globalen Seiteneffekten
3. der Eingriff mit weniger Router-, Shell- und IPC-Abhängigkeit
4. der Eingriff mit besserer manueller Testbarkeit
5. der Eingriff, der ein wiederverwendbares Muster erzeugt

---

## Was vorerst nicht angefasst werden soll

Solange nicht zwingend nötig, vermeiden:

- kompletter Austausch von src/renderer/app/Router.js
- Umbau der gesamten App-Shell aus src/renderer/main.js
- Einführung eines globalen State-Management-Frameworks
- großflächige Datei-Umsortierungen
- gleichzeitige Migration mehrerer großer Views
- Vermischung von React-Migration und allgemeiner Schönheitsreparatur

---

## Definition of Done pro Schritt

Ein Schritt gilt nur dann als abgeschlossen, wenn:

1. der betroffene Bereich klar abgegrenzt war
2. das bestehende Verhalten im betroffenen Bereich erhalten bleibt
3. Router, Shell, IPC und Business-Logik nur bei klarer Notwendigkeit berührt wurden
4. relevante Checks versucht und dokumentiert wurden
5. ein einfacher manueller Test beschrieben wurde
6. die Änderung klein und nachvollziehbar geblieben ist
7. klar ist, ob das Muster für weitere Schritte taugt

---

## Verwandte Dokumente

Dieser Plan wird durch folgende Dokumente unterstützt:

- AGENTS.md definiert Regelwerk, Arbeitsmodus und Guardrails.
- ARCHITECTURE.md beschreibt Zielbild, Schichten und Migrationsrichtung.

Alle drei Dokumente unterstützen dieselbe Richtung: schrittweise Entkopplung und Vorbereitung auf React ohne Big-Bang-Umbau.
