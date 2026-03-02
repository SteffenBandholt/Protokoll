# Release- und Hotfix-Workflow (lokal, ohne Remote)

Ziel: ausgelieferte Versionen sauber wiederfinden, Hotfixes gezielt bauen und den Fix danach in allen relevanten Branches haben.

## Branches
- `main` = stabil / ausgeliefert
- `develop` = laufende Entwicklung

## Merksatz
- Bugfix fuer Nutzer: **vom Tag starten** -> PATCH hoch (`x.y.Z`)
- Neue Features: in `develop` -> bei Release MINOR hoch (`x.Y.0`)

## 1) Release einfrieren (Setup bauen)
```powershell
git switch main
git status

# Version setzen (Beispiel)
npm version 1.0.2 --no-git-tag-version

npm ci
npm run lint
if (Test-Path .\dist) { Remove-Item -Recurse -Force .\dist }
npm run dist

git add package.json package-lock.json
git commit -m "Release 1.0.2"
git tag -a v1.0.2 -m "Release 1.0.2"
```

Optional:
```powershell
git tag --list
git show v1.0.2
```

## 2) Hotfix fuer eine ausgelieferte Version (z. B. v1.0.2)
```powershell
git switch --detach v1.0.2
git switch -c hotfix/1.0.3
```

Bug fixen, testen, Version patchen:
```powershell
npm start
npm version patch --no-git-tag-version

git add package.json package-lock.json <geaenderte_dateien>
git commit -m "Fix: <kurzbeschreibung> (1.0.3)"

if (Test-Path .\dist) { Remove-Item -Recurse -Force .\dist }
npm run dist
```

## 3) Fix "ueberall drin" machen
### a) In `main` uebernehmen + taggen
```powershell
git switch main
git merge --no-ff hotfix/1.0.3
git tag -a v1.0.3 -m "Release 1.0.3"
```

### b) Auch nach `develop` uebernehmen (damit Fix nicht verloren geht)
```powershell
git log --oneline hotfix/1.0.3
git switch develop
git cherry-pick <commit-hash>
```

Optional:
```powershell
git branch -d hotfix/1.0.3
```

---

## Trigger fuer Codex (dein Sprachmuster)
Wenn du schreibst:
- **"Wir muessen einen Bug in Version X.Y.Z entfernen"**

dann gilt standardmaessig:
1. Exakten Stand per Tag `vX.Y.Z` auschecken
2. Hotfix-Branch `hotfix/X.Y.(Z+1)` erstellen
3. Fix bauen/testen, PATCH-Version erhoehen
4. Setup fuer Nutzer bauen
5. Hotfix in `main` mergen + neuen Tag setzen
6. Fix per `cherry-pick` nach `develop` holen

Damit ist der Fix in der ausgelieferten Linie **und** in der Entwicklung enthalten.
