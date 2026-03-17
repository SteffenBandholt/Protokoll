# Lizenzsignatur

## Public Key in der App

Die App prueft Lizenzdateien lokal mit einem echten Ed25519-Public-Key.

Standardquelle:
- `src/main/licensing/public_key.pem`

Override fuer Dev/Produktion:
- `BBM_LICENSE_PUBLIC_KEY`
  - kompletter PEM-Inhalt direkt als Umgebungsvariable
- `BBM_LICENSE_PUBLIC_KEY_PATH`
  - Pfad auf eine PEM-Datei; wird vor dem gebuendelten Key bevorzugt

Aufloesungsreihenfolge im Code:
1. `BBM_LICENSE_PUBLIC_KEY`
2. `BBM_LICENSE_PUBLIC_KEY_PATH`
3. gebuendelter Key in `src/main/licensing/public_key.pem`

## Signieren von Lizenzen

Das externe `license-tool` signiert mit dem Private Key:
- `C:\license-tool\keys\private_key.pem`

Der aktuell gebuendelte Public Key in der App wurde aus genau diesem Private Key abgeleitet. Dadurch kann eine mit dem vorhandenen `license-tool` erzeugte `.bbmlic` lokal erfolgreich geprueft werden.

## Verifikation in der App

Die Signaturpruefung passiert in:
- `src/main/licensing/licenseVerifier.js`

Ablauf:
1. Lizenzstruktur validieren
2. Produktkennung `bbm-protokoll` pruefen
3. Public Key aus Env oder Bundle laden
4. kanonische Lizenzdaten gegen die Base64-Signatur verifizieren
5. Machine-ID und Ablaufdatum pruefen

Manipulierte Daten nach dem Signieren fuehren zu `INVALID_SIGNATURE`.

## Lokale Tests

1. Gueltige Lizenz erzeugen:
   - im Dev-Dialog der App Lizenz erzeugen
   - oder `license-tool` mit `C:\license-tool\keys\private_key.pem` verwenden
2. Gueltige Lizenz importieren:
   - App -> Einstellungen -> Lizenzierung -> Lizenz importieren
3. Ungueltige Lizenz pruefen:
   - eine gueltige `.bbmlic` oeffnen
   - z. B. `features` oder `validUntil` aendern
   - Datei erneut importieren
   - Ergebnis muss `INVALID_SIGNATURE` bzw. ein Lizenzfehler sein

## Key-Rotation

Wenn ein anderer produktiver Private Key verwendet werden soll, gibt es zwei saubere Wege:
- neuen Public Key in `src/main/licensing/public_key.pem` einchecken
- oder den Key ausserhalb des Repos bereitstellen und per `BBM_LICENSE_PUBLIC_KEY_PATH` bzw. `BBM_LICENSE_PUBLIC_KEY` injizieren

Die Verifikation bleibt in allen Faellen echt; es gibt keinen Bypass fuer "immer gueltig".
