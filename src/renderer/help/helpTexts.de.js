// src/renderer/help/helpTexts.de.js

export const quickStart = `# Erste Schritte

## 1) Projekt öffnen oder anlegen
- Home → Projekte
- Projekt auswählen oder „Neu“ anlegen → Speichern

## 2) Firmen dem Projekt zuordnen
- Projekt öffnen → Projektfirmen
- Firma auswählen → zum Projekt hinzufügen
Tipp: Nur zugeordnete Firmen wirken im Projekt (z.B. Personenpool/Firmenliste).

## 3) Teilnehmer auswählen
- Teilnehmer öffnen
- Links „Personenpool“: alle Personen aus den dem Projekt zugeordneten Firmen
- Doppelklick auf eine Person → wird rechts bei „Teilnehmer“ übernommen
Hinweis: Unten steht „Auswahl mit Doppelklick“.

## 4) ToDo Liste (TOPs) pflegen
- ToDo Liste öffnen
- TOP anlegen oder anklicken zum Bearbeiten
- Felder: Kurztext, Langtext, Datum, Status, Verantwortlich
- Verantwortlich = zuständig für den TOP (muss nicht zwingend Teilnehmer sein)

## 5) Protokolle / Besprechungen
- Protokolle öffnen: Ein Klick markiert, Doppelklick öffnet
- Geschlossene Protokolle sind nur lesbar (readonly)
- Nach dem Schließen bleibt die Darstellung im Protokoll-PDF fix

## 6) PDFs erzeugen
- Vorabzug: zeigt den Zustand zum Zeitpunkt des Drucks
- Protokoll-PDF: final (nach dem Schließen)
- Firmenliste (PDF): enthält die dem Projekt zugeordneten Firmen
- Speicherort Protokolle: Einstellungen → Druckeinstellungen → PDF-Einstellungen → „Speicherort Protokolle“

## 7) Druckeinstellungen / Firmenliste sortieren
- In Firmenliste: Zeile markieren
- Schieben: Pfeiltasten bewegen die markierte Zeile, Enter beendet
- Umbenennen: markierte Zeile bearbeiten
- Löschen: markierte Zeile entfernen`;

export const glossary = [
  { term: "Projekt", definition: "Ein Vorgang/Baustelle. Alles (TOPs, Protokolle, Firmen, Teilnehmer) hängt daran." },
  { term: "Firma", definition: "Stammdaten einer Firma. Alle Firmen existieren unabhängig von Projekten." },
  { term: "Projektfirma", definition: "Eine Firma, die einem Projekt zugeordnet ist. Nur Projektfirmen wirken im Projekt." },
  { term: "Mitarbeiter", definition: "Personen, die zu einer Firma gehören." },
  { term: "Personenpool", definition: "Alle Mitarbeiter der Projektfirmen. Von hier werden Teilnehmer ausgewählt." },
  { term: "Teilnehmer", definition: "Personen, die für eine Besprechung/Protokoll geführt werden und in Listen erscheinen." },
  { term: "Verantwortlich", definition: "Zuständige Person für einen TOP. Kann ein Teilnehmer sein, muss es aber nicht." },
  { term: "TOP / ToDo", definition: "Ein Punkt in der ToDo-Liste bzw. im Protokoll." },
  { term: "Vorabzug", definition: "PDF-Zwischenstand. Zeigt den Zustand zum Zeitpunkt des Drucks." },
  { term: "Protokoll schließen", definition: "Protokoll wird final und schreibgeschützt; Protokoll-PDF bleibt danach konsistent." },
  { term: "Firmenliste (PDF)", definition: "PDF-Liste der dem Projekt zugeordneten Firmen, sortierbar über Firmenliste-Einstellungen." },
];

const helpTextsDe = { quickStart, glossary };

export default helpTextsDe;
