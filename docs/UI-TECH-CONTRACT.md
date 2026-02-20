# UI-TECH-CONTRACT – BBM (verbindlich)
Version: 1.0.1  
Gültig ab: 2026-01-25  
Status: ACTIVE  
Owner: Projekt (Repo)

Dieser Vertrag ist verbindlich für jede Änderung im BBM.
Jeder GPT/Entwickler muss ihn vor der Arbeit lesen und einhalten.

---

## 0) Grundsatz
Alles, was nicht ausdrücklich Ziel ist, bleibt unverändert.
Keine „Neben-Verbesserungen“.

Wenn etwas unklar ist: GENAU 1 Frage stellen, dann STOP bis Antwort.

---

## 1) Verbote (MUST NOT)
- MUST NOT: globale Event-Hacks (window/document/body als “Trick”, capture:true global)
- MUST NOT: prototype patches / EventTarget.prototype / “InputUnblocker”
- MUST NOT: Refactor-Marathon / Umstrukturierung ohne Auftrag
- MUST NOT: Router/Shell/main.js/CSS anfassen, wenn nicht explizit Teil des Ziels

### 1.1 Allowlist für bestehende App-Events (Klarstellung)
Diese Events sind im Projekt bereits etabliert und sind **erlaubt**, sofern **ohne capture:true** und ohne globale “Tricks”:
- `bbm:router-context`
- `bbm:header-refresh`

Alles andere an neuen globalen Events gilt als Event-Hack und ist verboten, wenn nicht explizit beauftragt.

---

## 2) Output-Regeln (MUST)
- MUST: Wenn eine Datei geändert wird, wird die KOMPLETTE Datei geliefert (keine Ausschnitte).
- MUST: Keine verdeckten Änderungen außerhalb des Scopes.

---

## 2.1) Repo-weite Änderungen / Encoding-Schutz (MUST)
- MUST: Repo-weite Änderungen (Skripte, Injektionen, Formatierungen) dürfen nur in einem separaten Branch erfolgen.
- MUST: Vor jedem Commit solcher Änderungen ist `git diff --stat` Pflicht.
- MUST: Wenn `git diff --stat` mehr als die erwarteten Dateien/Zeilen zeigt: STOP. Erst trennen, kein „Augen zu und durch“.
- MUST: Wenn Zeichen wie `Ã¶`, `âœ…`, kaputte Umlaute o.ä. im Diff auftauchen: STOP. Encoding-/BOM-Problem zuerst lösen, nicht mit Feature vermischen.
- MUST NOT: Automatisches „Header überall rein“-Scripting ohne anschließende Diff-Sichtprüfung.

---

## 3) KREBS-CHECK (MUST)
Vor Start und nach jedem größeren Schritt ausführen:

A) __bbm-Reste (muss 0 Treffer sein)
Get-ChildItem -Recurse -File -Path .\src | Select-String -SimpleMatch "__bbm" | Select-Object Path,LineNumber,Line

B) Prototyp-/Event-Hacks (muss 0 Treffer sein)
Get-ChildItem -Recurse -File -Path .\src | Select-String -Pattern "prototype\.(stopPropagation|preventDefault|addEventListener)|EventTarget\.prototype|InputUnblocker" | Select-Object Path,LineNumber,Line

Wenn A oder B Treffer: STOP. Erst bereinigen, kein Feature.

---

## 4) NEVER-BLOCK-UI (MUST) – gilt für ALLE Views
Problem: Nach Save/Delete bleibt View blockiert (disabled/saving-state) und wird erst nach View-Wechsel wieder bedienbar.
Das ist verboten.

### 4.1 Busy-State (MUST)
- MUST: Jede Save/Delete-Operation setzt ein Busy-Flag (z.B. savingX/deletingX).
- MUST: Busy-Flag wird IMMER in `finally` zurückgesetzt (ohne Ausnahme).
- MUST: Während Busy müssen alle relevanten Inputs/Buttons disabled sein; danach wieder enabled.
- MUST: Abhängige Bereiche (Sub-Forms) werden während Save/Delete des Parent ebenfalls disabled/enabled.

### 4.2 Delete-Regel (kritisch) (MUST)
Nach erfolgreichem Delete:
1) MUST: UI sofort lokal aktualisieren (optimistisch)
   - Item aus Liste entfernen
   - Selection/Detail-State bereinigen
   - UI re-rendern
2) MUST: UI sofort entblocken (Busy=false in finally)
3) MUST: reload/refresh nur im Hintergrund nachziehen (ohne await)

### 4.3 Save-Regel (MUST)
- SHOULD: Save darf await reload nutzen, wenn garantiert schnell/stabil.
- MUST: Wenn reload potentiell hängt/zu lange dauert: UI im finally entblocken und reload im Hintergrund nachziehen.

### 4.4 Verbotene Anti-Patterns (MUST NOT)
- MUST NOT: UI-Entblocken nur bei Erfolg, nicht bei Fehlern.
- MUST NOT: `await reload()` im Busy-State, wenn Reload hängen kann (führt zu “View blockiert”).
- MUST NOT: Fix über globale Events / Workarounds.

---

## 5) Soft-Delete (wenn im Projektstandard vorhanden)
- MUST: Keine Hard-Deletes.
- MUST: Soft-Delete via removed_at/archived_at.
- MUST: Lösch-Blockaden müssen sauber als Fehler zurückkommen (kein silent fail).

---

## 6) Test-Mindeststandard (MUST)
Nach jedem Fix:
- Repro vorher/nachher
- Positivtest: funktioniert
- Negativtest: blockt korrekt (wo Regeln das verlangen)
- MUST: Nach Save/Delete sofort wieder Create/Edit möglich (ohne View-Wechsel)

---

## 7) Scope-Schutz (MUST)
Alles was NICHT Ziel ist: unverändert lassen.
Keine “Nice-to-have” Ergänzungen.

---

## 8) Sidebar-Invarianten: Kandidaten & Teilnehmer (MUST)
Ziel: Diese Funktionen dürfen durch spätere Features (z.B. PDF-Druck) **nicht “verschwinden”**.

- MUST: Die Sidebar-Aktionen **„Kandidaten“** und **„Teilnehmer“** sind feste Bestandteile der App-Navigation/Sidebar.
- MUST: Implementierungen neuer Features dürfen diese Buttons **nicht entfernen**, **nicht umbenennen** und **nicht durch alternative Wege ersetzen** (z.B. versteckte Menüs).
- MUST: Kontext-Regeln bleiben stabil:
  - Kandidaten: nur nutzbar bei aktivem Projekt (`router.currentProjectId`)
  - Teilnehmer: nur nutzbar bei aktivem Projekt **und** aktivem Meeting (`router.currentProjectId` + `router.currentMeetingId`)
- MUST: Beim Wechsel von Projekten/Meetings muss die Sidebar zuverlässig anhand Router-Kontext aktualisieren (bestehende Mechanik beibehalten).

---

## 9) Änderungslog
- 1.0.0 (2026-01-25): Initial – NEVER-BLOCK-UI + KREBS + Output-Regeln
- 1.0.1 (2026-01-25): Schutz gegen Repo-weite Massenänderungen / Encoding-Schäden (Diff-Stat Pflicht)
- 1.0.1 (2026-01-27): Klarstellung Allowlist globaler App-Events + Sidebar-Invarianten Kandidaten/Teilnehmer

---

## 10) Feature-Flag (Beta Firmen/Mitarbeiter v2)
- Flag-Name: `useNewCompanyWorkflow`
- Storage-Key (localStorage): `bbm.useNewCompanyWorkflow`
- Default: `false`
- Aktueller Stand: nur globaler Umschalter im UI, noch keine Routing-/Workflow-Umschaltung.

## 11)Ampel-Regel für PDF (Vorabzug & Protokoll)
Die Ampel wird im PDF nur dann angezeigt, wenn sie für den jeweiligen Druckmodus aktiviert ist (Vorabzug folgt dem Nutzer-Toggle; 
beim endgültigen Protokoll kann die Einstellung beim Schließen der Besprechung „eingefroren“ sein und dann gilt dieser gespeicherte Wert). 
Ampeln werden nur für TOP Level 2–4 gedruckt; Level 1 bekommt keine Ampel. Die Ampelfarbe wird pro TOP wie folgt bestimmt: 
Für Blatt-TOPs (ohne Kinder) richtet sich die Farbe nach Status und ggf. 
Fälligkeitsdatum: blockiert → blau, verzug → rot, erledigt → grün; 
bei offen/in Arbeit gibt es nur dann eine Ampel, wenn ein Fälligkeitsdatum gesetzt ist: 
überfällig/Heute → rot, 1–10 Tage → orange, >10 Tage → grün; ohne Datum gibt es keine Ampel. 
Für Eltern-TOPs (mit Kindern) wird die Ampel aus den Kindern aggregiert: 
es gilt die Priorität blau > rot > orange > grün (wenn irgendein Kind blau ist, ist der Eltern-TOP blau usw.). 
Die Darstellung im PDF ist ein kleiner Punkt in der Meta-Spalte; wenn keine Farbe ermittelt wird, 
wird keine Ampel (oder ein leerer Punkt) ausgegeben.