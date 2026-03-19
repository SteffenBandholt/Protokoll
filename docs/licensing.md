# Licensing in BBM

## Zugehörige Dateien
- `C:\01_Projekte\Protokoll\src\main\licensing\licenseService.js`
  Einstieg für Lizenzstatus, Lizenzpflicht und Feature-Prüfung.
- `C:\01_Projekte\Protokoll\src\main\licensing\licenseVerifier.js`
  Signaturprüfung, Produktprüfung, Ablaufdatum, Machine-ID und Public-Key-Laden.
- `C:\01_Projekte\Protokoll\src\main\licensing\licenseStorage.js`
  Lesen und Schreiben der lokalen Lizenzdatei im `userData`-Verzeichnis.
- `C:\01_Projekte\Protokoll\src\main\licensing\deviceIdentity.js`
  Lokale Machine-ID-Erzeugung und Persistenz.
- `C:\01_Projekte\Protokoll\src\main\licensing\public_key.pem`
  Öffentlicher Schlüssel für die Verifikation. Nur Public Key, niemals Private Key.

## Wo `public_key.pem` hingehört
Die Datei liegt lokal unter:
- `C:\01_Projekte\Protokoll\src\main\licensing\public_key.pem`

Im Repository liegt nur eine Platzhalterdatei.
Für echte Verifikation muss sie lokal oder im Build-Prozess durch den echten öffentlichen Schlüssel ersetzt werden.
Es dürfen keine privaten Schlüssel ins Repository eingecheckt werden.

## Was aktuell schon funktioniert
- Lizenzdatei wird lokal geladen und geprüft.
- `requireFeature(feature)` verwendet bei jedem Aufruf eine frische Lizenzprüfung.
- Signatur-, Ablauf-, Produkt- und Machine-ID-Prüfung sind zentral in `licenseVerifier.js` gebündelt.
- Fehlende oder noch nicht ersetzte `public_key.pem` wird kontrolliert als ungültige Lizenzbasis behandelt.
- Build-Konfiguration baut nur noch `nsis` und ist auf `asar: true` umgestellt.
- `license:get-status` liefert zusätzlich Ablaufhinweise:
  - `daysRemaining` wird als aufgerundete Tagesdifferenz zwischen `validUntil` und `jetzt` berechnet.
  - `expired` ist `true`, wenn `validUntil` bereits in der Vergangenheit liegt.
  - `expiresSoon` ist `true`, wenn die Lizenz noch nicht abgelaufen ist, aber in 14 Tagen oder weniger endet.
- `license:get-diagnostics` liefert einen kompakten Support-Block mit Status, Grund, Kunde, Lizenz-ID, Edition, Ablaufdatum, Machine-ID, App-Version und Features.
- Im Entwicklungsbereich der App gibt es eine interne Maske `Lizenz erstellen`, die ueber das externe Tool unter `C:\license-tool` eine `.bbmlic` erzeugt.

## Lizenzmodi
- Es gibt genau zwei unterstuetzte Modi:
  - `binding = none`
    - Soft-Lizenz
    - keine harte Rechnerbindung
    - Verifikation prueft Signatur, Produkt, Ablaufdatum und Features
  - `binding = machine`
    - Vollversion (rechnergebunden)
    - Verifikation prueft zusaetzlich die Machine-ID des Zielrechners
- Fehlt `binding` in einer bestehenden Lizenz, wird aus Rueckwaertskompatibilitaet `none` angenommen.
- Fuer `binding = machine` gibt es zusaetzlich eine Lizenzanforderung als JSON-Datei vom Zielrechner.


## Derzeit geschuetzte Features
- `pdf.export`
  Sperrt die zentrale PDF-Erzeugung in `C:\01_Projekte\Protokoll\src\main\ipc\printIpc.js` direkt im Main-Prozess. PDF-Ausgaben erhalten dort zusaetzlich eine sichtbare Lizenzkennung mit Kunde und Lizenz-ID.
- `project.export`
  Schuetzt den Projekt-Export in `C:\01_Projekte\Protokoll\src\main\ipc\projectTransferIpc.js`. Der Export-Manifestblock traegt dabei ebenfalls die Lizenzkennung.
- `mail.outlookDraft`
  Schuetzt den Outlook-Entwurf in `C:\01_Projekte\Protokoll\src\main\main.js` vor dem eigentlichen Mail-Aufruf.

## Was noch offen ist
- Ein echter öffentlicher Schlüssel muss lokal bereitgestellt werden.
- Eine produktive Lizenzaktivierung oder Serveranbindung ist nicht Teil dieser Basis.
- Es gibt noch keine UI-geführte Lizenzverwaltung in dieser Doku.


## Lizenz-Erstellung im Entwicklungsbereich
- Die Lizenz-Erstellung und Lizenz-Verlaengerung sind nur im internen Entwicklungsbereich der ungepackten App verfuegbar.
- Verwendet wird ausschliesslich das externe Tool:
  - `C:\license-tool\generate-license.cjs`
- Die App schreibt eine Eingabe-JSON nach:
  - `C:\license-tool\input\`
- Die erzeugte `.bbmlic` landet in:
  - `C:\license-tool\output\`
- Bestehende `.bbmlic` koennen im Entwicklungsbereich geladen, geprueft und als neue verlaengerte Lizenz erneut erzeugt werden.
- In der internen Maske kann der Lizenzmodus explizit gesetzt werden:
  - `Soft-Lizenz` -> `binding = none`
  - `Vollversion (rechnergebunden)` -> `binding = machine`
- Beim Erzeugen schreibt die App `binding` in die Eingabe fuer `C:\license-tool`.
- Bei `binding = machine` wird die aktuelle lokale Machine-ID in die Generator-Eingabe uebernommen.
- Fuer Vollversionen auf einem anderen Zielrechner ist daher weiterhin eine separate Machine-ID-Anforderung fuer diesen Rechner noetig.
- Typischer Vollversions-Ablauf:
  1. App auf dem Zielrechner starten
  2. Im Lizenzbereich `Lizenzanforderung erzeugen`
  3. JSON-Datei an den Entwickler geben
  4. Im Entwicklungsbereich `Lizenzanforderung laden`
  5. Vollversion erzeugen und anschliessend importieren
- Im Bereich `Lizenz erstellen / verlaengern` gibt es zusaetzlich Schnellvorlagen, die nur Formularfelder vorbelegen:
  - `30 Tage Test`
    - `product = bbm-protokoll`
    - `edition = test`
    - `binding = none`
    - `durationDays = 30`
    - `validFrom = heute`
    - `validUntil = validFrom + 30 Tage`
    - `features = app, pdf, export, mail`
    - `maxDevices = 2`
  - `1 Jahr Standard`
    - `product = bbm-protokoll`
    - `edition = standard`
    - `binding = none`
    - `durationDays = 365`
    - `validFrom = heute`
    - `validUntil = validFrom + 365 Tage`
    - `features = app, pdf, export`
    - `maxDevices = 1`
  - `1 Jahr Pro`
    - `product = bbm-protokoll`
    - `edition = pro`
    - `binding = machine`
    - `durationDays = 365`
    - `validFrom = heute`
    - `validUntil = validFrom + 365 Tage`
    - `features = app, pdf, export, mail`
    - `maxDevices = 1`
- Setzbare Felder in der UI:
  - `product`
  - `customerName`
  - `licenseId`
  - `edition`
  - `issuedAt` (nur lesend aus geladener Lizenz)
  - `validFrom`
  - `validUntil`
  - optional `durationDays`
  - `maxDevices`
  - `features`
  - `notes`
- `private_key.pem` bleibt weiterhin ausschliesslich im `license-tool` unter:
  - `C:\license-tool\keys\private_key.pem`

Hinweis: Im internen Entwicklungsbereich ist `licenseId` frei editierbar und wird beim Erzeugen der Lizenz unveraendert an das `license-tool` uebergeben.
Im Entwicklungsbereich wird beim Anlegen einer neuen Lizenz automatisch ein Vorschlag im Format `BBM-YYYY-XXXX` gesetzt (z. B. `BBM-2026-0001`). Die Lizenznummer bleibt jederzeit manuell aenderbar.
