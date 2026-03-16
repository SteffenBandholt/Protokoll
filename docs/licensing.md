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

## Was noch offen ist
- Ein echter öffentlicher Schlüssel muss lokal bereitgestellt werden.
- Eine produktive Lizenzaktivierung oder Serveranbindung ist nicht Teil dieser Basis.
- Es gibt noch keine UI-geführte Lizenzverwaltung in dieser Doku.
