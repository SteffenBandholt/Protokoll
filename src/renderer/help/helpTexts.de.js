// src/renderer/help/helpTexts.de.js

export const quickStart = `# BBM – Baubesprechungsmanager

## Erste Schritte

- **1. Nutzerdaten eingeben**
  - Sidebar **Einstellungen → Nutzereinstellungen**
  - Die Nutzerdaten werden auf dem Protokoll im Seitenkopf gedruckt

- **2. Firma anlegen**
  - **2.1 Firmen (extern)** (projektübergreifend)
    - Sidebar **Firmen (extern)**
    - **Name 1** (Pflichtfeld)
    - **Kurzbez.**: „Rufname“ der Firma; wird im Protokoll als „verantwortlich“ eingetragen und dem Projekt über den Firmenpool zugeordnet
  - **2.2 Firmen (intern)** (projektintern)
    - Projekt wählen
    - **Name 1** (Pflichtfeld)
    - Im Header **Firmen (intern)** wählen
    - **Kurzbez.**: „Rufname“ der Firma; wird im Protokoll als „verantwortlich“ eingetragen und ist dem Projekt automatisch zugeordnet

- **3. Mitarbeiter anlegen**
  - **3.1** Mitarbeiter (extern) bei Firmen (extern) hinzufügen
  - **3.2** Mitarbeiter (intern) bei Firmen (intern) hinzufügen

- **4. Projekt anlegen**
  - **4.1** Sidebar **Start → Neues Projekt anlegen**
  - **4.2** **Projekte → Projekt anlegen**
    - Bezeichnung (Pflichtfeld): **Projektbezeichnung**

- **5. Protokoll anlegen**
  - Sidebar: Protokoll wird automatisch angelegt
  - Projekt auswählen
  - Neuer Titel und neue TOPs werden im geöffneten Protokoll **blau** angezeigt
  - Titel und TOPs aus vorherigen Protokollen haben **schwarzen** Text
  - **Protokoll schließen** beendet die Bearbeitung (nur noch **read only**)
  - Erneute Wahl des Projektes legt ein neues Protokoll an; das vorherige ist als **read only** eingefügt. TOPs können bedingt bearbeitet werden:
    - Langtext: kann geändert werden (blauer Text)
    - Fertig bis; Status; Verantw. kann geändert werden
`;

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
