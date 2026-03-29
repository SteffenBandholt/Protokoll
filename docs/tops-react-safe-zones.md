# Tops React Safe Zones

## 1. Aktuelle stabile Basis

Der aktuelle stabile Stand im Tops-Bereich ist die verbindliche Basis für weitere Migrationen.
React darf nur dort eingesetzt werden, wo bereits klar abgegrenzte, UI-nahe Inseln möglich sind.
Der bestehende Idle-State ist ein zulässiges Beispiel für diesen Ansatz.

## 2. No-Touch-Zone

Folgende Bereiche bleiben vorerst vollständig Legacy und werden nicht migriert:

- Tops-Editbox
- Metaspalte
- Save-/Patch-Verhalten
- readOnly-Logik
- Status-Logik
- Ampel-Logik
- Responsible-Logik
- Nummerierung
- Abschluss- und Folgeregeln

## 3. Safe-Zones für React

React darf im Tops-Bereich nur isolierte Anzeige- und Bedieninseln übernehmen, wenn sie keine Fachlogik enthalten:

- Idle-State ohne aktives Meeting
- rein visuelle Hinweis- und Leerzustände
- kleine UI-Container mit klaren, rohen Callbacks
- Darstellung bereits vorhandener Werte ohne eigene Regelableitung

Leitlinie:

- React zeigt an.
- Legacy entscheidet.
- React löst rohe UI-Aktionen aus.
- Fachregeln bleiben außerhalb von React.

## 4. Verbotene Änderungen

Für künftige Codex-Schritte sind im Tops-Bereich verboten:

- neue Fachlogik in React
- Migration der Editbox
- Änderungen an Save/Patch
- Änderungen an readOnly
- Änderungen an Status, Ampel, Responsible oder Nummerierung
- neue Ableitungen für Sichtbarkeit oder Sperren
- Umbau der Legacy-Kernlogik als Teil der UI-Migration

## 5. Freigaberegel für künftige Codex-Schritte

Ein neuer Tops-React-Schritt ist nur dann freigabefähig, wenn alle Punkte erfüllt sind:

- Die Änderung betrifft nur eine klar abgegrenzte UI-Insel.
- Die Änderung berührt keine Editbox- oder Fachlogik.
- Der Legacy-Kern bleibt Owner aller Regeln.
- Der Datenfluss bleibt unverändert.
- Der Schritt kann lokal geprüft werden, ohne andere Tops-Pfade umzubauen.

Wenn eine Änderung mehr als reine Anzeige oder rohe UI-Interaktion betrifft, gehört sie nicht in die laufende React-Migration.
