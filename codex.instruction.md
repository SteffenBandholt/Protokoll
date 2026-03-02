# codex.instruction.md
Projekt: **baubesprechungs-manager** (Electron + Node.js + SQLite)

Ziel: Codex soll **effizient** arbeiten (wenig Verbrauch) und **keine ungewollten Refactors** machen.

---

## 1) Grundregeln (immer)
1. **Kein Repo-Scan.** Arbeite nur an Dateien, die im Prompt explizit genannt werden.
2. **Kein node_modules / build / dist / Logs / DB-Dateien lesen oder ändern.**
3. **Minimaler Patch:** Gib Änderungen als **unified diff** aus (so klein wie möglich).
4. **Nicht umformatieren.** Keine kosmetischen Änderungen, keine „Rewrite“-Aktionen.
5. **Keine neuen Dependencies** und keine Umbauten (Architektur/Framework), außer ausdrücklich verlangt.
6. **Wenn Kontext fehlt:** Frage nach der **nächsten konkreten Datei**, statt selbst zu suchen.

---

## 2) Kontext-Sparmodus (Token-Schutz)
- **Immer Low-Context.** Erst Datei(en) lesen, dann Aufgabe.
- **Nach großen Tasks:** Session **resetten**, damit Kontext nicht wächst.
- **Aufgaben klein schneiden:** 1 Feature/Bug pro Prompt.

---

## 3) Empfohlene CLI-Einstellungen (Kurz)
Wenn möglich, verwende standardmäßig:
- `codex --no-plan`  (verhindert teures Agent-Planning)

Für sehr kleine/gezielte Tasks zusätzlich (falls verfügbar):
- `--quick`

Wenn dein Codex keine solchen Flags kennt: ignorieren und nur die Regeln oben befolgen.

---

## 4) Pflicht: .codexignore (damit nichts „versehentlich“ gescannt wird)
Lege im Repo-Root eine Datei **.codexignore** an mit:

```
node_modules
build
dist
out
coverage
Cache
GPUCache
Code Cache
*.log
*.db
*.bak
legacy-import
```

---

## 5) Output-Format
Codex soll **entweder**:
- **A)** nur einen **minimalen unified diff** liefern, oder
- **B)** bei Review-Aufgaben eine kurze Bullet-Liste mit Findings (ohne Code), wenn ausdrücklich „Review-only“ verlangt ist.

---

## 6) Prompt-Schablone (so sollst du jeden Auftrag ausführen)
**Schritt 1 (Lesen):**
> Read only: `<file1>`, `<file2>`.

**Schritt 2 (Aufgabe):**
> Do `<task>`.  
> Constraints: minimal diff, no repo scan, no reformat, no new deps.  
> Output: unified diff only.

---

## 7) Verbote (hart)
Codex DARF NICHT:
- „Improve the whole project“ / „Refactor the repo“ / „Search for issues everywhere“
- Dateien ändern, die nicht im Prompt stehen
- package.json/build config ändern, wenn nicht explizit beauftragt
- DB-Dateien anfassen

---

## 8) Kurze Checkliste für dich (vor jedem Run)
- Bin ich im richtigen Ordner (z.B. `src/main/print` statt Repo-Root)?
- Habe ich nur die relevanten Dateien genannt?
- Fordere ich „minimal unified diff“?
- Nutze ich `--no-plan`?
