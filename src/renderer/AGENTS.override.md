# AGENTS.override.md (src/renderer)

## Renderer/Views: extra strikt
- Keine neuen UI-Patterns erfinden. Wenn etwas fehlt: bestehende Patterns erweitern, nicht neu bauen.
- Layout: keine "random px" inline; wenn möglich bestehende Klassen/Styles nutzen.
- Klick/Doppelklick: Click = selektieren/markieren, DblClick = öffnen/bearbeiten (wenn nicht anders spezifiziert).
- Popups: Header + Content (scrollbar) + Footer (fix). Kein "Popup scrollt komplett".

## Bugfix-Disziplin
- TDZ/Scope/async Fehler minimal fixen (keine Umstrukturierung der ganzen render()).
- Bei render(): keine doppelten DOM-Knoten/Listener bei erneutem render.
