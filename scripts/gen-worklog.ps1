# scripts/gen-worklog.ps1
# Auto-Worklog aus Git: nimmt alle Commits seit letztem Tag (Tag),
# filtert nur Noise (chore/style/refactor/lint/format/...).

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

# letztes Tag holen (falls vorhanden)
$lastTag = ""
try { $lastTag = (git describe --tags --abbrev=0 2>$null).Trim() } catch { }

$range = if ($lastTag) { "$lastTag..HEAD" } else { "HEAD" }

# diese Typen NICHT anzeigen
$skipTypes = @("chore","style","refactor","lint","format","docs","test","ci","build","perf","wip")

$raw = (git log $range --no-merges --pretty=format:"%s") -split "`n"

$items = New-Object System.Collections.Generic.List[string]
foreach ($line in $raw) {
  $s = ($line -replace "`r","").Trim()
  if ([string]::IsNullOrWhiteSpace($s)) { continue }

  $m = [regex]::Match($s, '^([a-zA-Z]+)(\([^)]+\))?:\s*(.+)$')
  if ($m.Success) {
    $type = $m.Groups[1].Value.ToLower()
    $msg  = $m.Groups[3].Value.Trim()

    if ($skipTypes -contains $type) { continue }

    if ($type -eq "fix")  { $items.Add("- Fix: $msg"); continue }
    if ($type -eq "feat") { $items.Add("- Neu: $msg"); continue }

    $items.Add("- $msg")
    continue
  }

  # kein Prefix -> trotzdem aufnehmen (AUTOMATISCH)
  $items.Add("- $s")
}

if ($items.Count -eq 0) {
  $items.Add("- (keine Aenderungen seit letztem Tag)")
}

$outFile = Join-Path (Get-Location) "src\renderer\help\worklog.de.txt"
New-Item -ItemType Directory -Force -Path (Split-Path $outFile) | Out-Null

# UTF-8 ohne BOM schreiben
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($outFile, $items, $utf8NoBom)