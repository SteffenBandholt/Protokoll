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
