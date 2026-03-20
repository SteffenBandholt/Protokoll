import { useMemo, useState } from "react";

const mockProjects = [
  {
    id: "p-1024",
    number: "1024",
    short: "Musterpark",
    name: "Musterpark West",
    meetings: 6,
    city: "Berlin",
    status: "Aktiv",
    updatedAt: "2026-02-14",
    owner: "S. Krueger",
  },
  {
    id: "p-2047",
    number: "2047",
    short: "Skyline",
    name: "Skyline Tower",
    meetings: 12,
    city: "Hamburg",
    status: "In Review",
    updatedAt: "2026-02-07",
    owner: "M. Jansen",
  },
  {
    id: "p-3198",
    number: "3198",
    short: "Campus",
    name: "Campus Nord",
    meetings: 3,
    city: "Muenchen",
    status: "Aktiv",
    updatedAt: "2026-01-29",
    owner: "L. Hoffmann",
  },
  {
    id: "p-4012",
    number: "4012",
    short: "Hafen",
    name: "Hafen City",
    meetings: 8,
    city: "Koeln",
    status: "On Hold",
    updatedAt: "2026-01-12",
    owner: "P. Seidel",
  },
  {
    id: "p-5870",
    number: "5870",
    short: "Quartier",
    name: "Quartier Sued",
    meetings: 10,
    city: "Stuttgart",
    status: "Aktiv",
    updatedAt: "2026-02-02",
    owner: "A. Weber",
  },
];

const mockMeetings = [
  {
    id: "m-410",
    project: "Musterpark West",
    index: 12,
    title: "Baubesprechung",
    date: "2026-02-18",
    status: "Offen",
    owner: "S. Krueger",
    tasks: 7,
  },
  {
    id: "m-396",
    project: "Skyline Tower",
    index: 5,
    title: "Koordination Ausbau",
    date: "2026-02-10",
    status: "Geschlossen",
    owner: "M. Jansen",
    tasks: 0,
  },
  {
    id: "m-384",
    project: "Campus Nord",
    index: 3,
    title: "Planungsrunde",
    date: "2026-02-05",
    status: "Offen",
    owner: "L. Hoffmann",
    tasks: 4,
  },
  {
    id: "m-372",
    project: "Hafen City",
    index: 8,
    title: "Schnittstellen Meeting",
    date: "2026-01-28",
    status: "Geschlossen",
    owner: "P. Seidel",
    tasks: 0,
  },
  {
    id: "m-360",
    project: "Quartier Sued",
    index: 7,
    title: "Baubesprechung",
    date: "2026-01-20",
    status: "Offen",
    owner: "A. Weber",
    tasks: 2,
  },
];

const navItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "projects", label: "Projekte" },
  { id: "meetings", label: "Protokolle" },
  { id: "firms", label: "Firmen" },
  { id: "archive", label: "Archiv" },
  { id: "settings", label: "Einstellungen" },
];

function ProjectsPage({ projects }) {
  const hasProjects = projects.length > 0;

  return (
    <section className="page">
      <header className="page-header">
        <div className="page-title-wrap">
          <div className="page-title">Projekte</div>
          <div className="page-subtitle">
            Uebersicht und schneller Zugriff auf laufende Projekte.
          </div>
        </div>
        <div className="page-actions">
          <div className="search">
            <span className="search-icon">Suche</span>
            <input
              className="search-input"
              placeholder="Projekt, Ort oder Nummer"
              type="text"
            />
          </div>
          <button className="btn" type="button">
            Filter
          </button>
        </div>
      </header>

      {!hasProjects && (
        <div className="card empty-state">
          <div className="empty-title">Noch keine Projekte</div>
          <div className="empty-subtitle">
            Lege ein neues Projekt an, um hier eine Uebersicht zu sehen.
          </div>
        </div>
      )}

      {hasProjects && (
        <section className="project-grid">
          {projects.map((project) => (
            <article className="card project-card" key={project.id}>
              <div className="project-header">
                <div>
                  <div className="project-number">Nr. {project.number}</div>
                  <div className="project-title">{project.short}</div>
                  <div className="project-subtitle">{project.name}</div>
                </div>
                <span
                  className={`status-pill status-${project.status.replace(/\s+/g, "-")}`}
                >
                  {project.status}
                </span>
              </div>
              <div className="project-meta">
                <div>
                  <span className="meta-label">Ort</span>
                  <span className="meta-value">{project.city}</span>
                </div>
                <div>
                  <span className="meta-label">Protokolle</span>
                  <span className="meta-value">{project.meetings}</span>
                </div>
                <div>
                  <span className="meta-label">Letztes Update</span>
                  <span className="meta-value">{project.updatedAt}</span>
                </div>
                <div>
                  <span className="meta-label">Owner</span>
                  <span className="meta-value">{project.owner}</span>
                </div>
              </div>
              <div className="project-actions">
                <button className="btn" type="button">
                  Protokolle
                </button>
                <button className="btn" type="button">
                  Details
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

function MeetingsPage({ meetings }) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(meetings[0]?.id || null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return meetings;
    return meetings.filter((item) =>
      [item.project, item.title, String(item.index)]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [meetings, query]);

  const activeMeeting = meetings.find((item) => item.id === activeId) || null;
  const hasMeetings = meetings.length > 0;
  const hasResults = filtered.length > 0;

  return (
    <section className="page">
      <header className="page-header">
        <div className="page-title-wrap">
          <div className="page-title">Protokolle</div>
          <div className="page-subtitle">
            Aktive und abgeschlossene Besprechungen im Ueberblick.
          </div>
        </div>
        <div className="page-actions">
          <div className="search">
            <span className="search-icon">Suche</span>
            <input
              className="search-input"
              placeholder="Projekt, Titel oder Nummer"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button className="btn" type="button">
            Filter
          </button>
        </div>
      </header>

      {!hasMeetings && (
        <div className="card empty-state">
          <div className="empty-title">Noch keine Protokolle</div>
          <div className="empty-subtitle">
            Sobald Besprechungen angelegt sind, erscheinen sie hier.
          </div>
        </div>
      )}

      {hasMeetings && (
        <div className="meetings-shell">
          <section className="card meetings-list">
            <div className="meetings-list-title">Letzte Protokolle</div>
            {!hasResults && (
              <div className="empty-subtitle meetings-empty">
                Keine Treffer fuer den aktuellen Filter.
              </div>
            )}
            {hasResults && (
              <ul className="meetings-items">
                {filtered.map((meeting) => (
                  <li key={meeting.id}>
                    <button
                      className={`meetings-item ${
                        meeting.id === activeId ? "is-active" : ""
                      }`}
                      type="button"
                      onClick={() => setActiveId(meeting.id)}
                    >
                      <div>
                        <div className="meetings-title">
                          #{meeting.index} · {meeting.title}
                        </div>
                        <div className="meetings-subtitle">{meeting.project}</div>
                      </div>
                      <div className="meetings-meta">
                        <span className="status-pill status-${meeting.status}">
                          {meeting.status}
                        </span>
                        <span className="meetings-date">{meeting.date}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card meetings-detail">
            <div className="meetings-detail-title">Auswahl</div>
            {activeMeeting ? (
              <div className="meetings-detail-body">
                <div>
                  <div className="meta-label">Projekt</div>
                  <div className="meta-value">{activeMeeting.project}</div>
                </div>
                <div>
                  <div className="meta-label">Protokoll</div>
                  <div className="meta-value">
                    #{activeMeeting.index} · {activeMeeting.title}
                  </div>
                </div>
                <div>
                  <div className="meta-label">Status</div>
                  <div className="meta-value">{activeMeeting.status}</div>
                </div>
                <div>
                  <div className="meta-label">Owner</div>
                  <div className="meta-value">{activeMeeting.owner}</div>
                </div>
                <div>
                  <div className="meta-label">Aufgaben</div>
                  <div className="meta-value">{activeMeeting.tasks}</div>
                </div>
              </div>
            ) : (
              <div className="empty-subtitle">Kein Protokoll ausgewaehlt.</div>
            )}
            <div className="meetings-detail-actions">
              <button className="btn" type="button">
                Protokoll oeffnen
              </button>
              <button className="btn btn-primary" type="button">
                Vorschau
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("projects");
  const projects = mockProjects;
  const meetings = mockMeetings;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-mark">BBM</div>
          <div className="brand-sub">Projektsteuerung</div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <button
              className={`nav-item ${item.id === activePage ? "is-active" : ""}`}
              type="button"
              key={item.id}
              onClick={() => setActivePage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item is-ghost" type="button">
            Feedback senden
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="topbar">
          <div className="topbar-title">Portfolio</div>
          <div className="topbar-actions">
            <button className="btn btn-ghost" type="button">
              Export
            </button>
            <button className="btn btn-primary" type="button">
              + Neues Projekt
            </button>
          </div>
        </div>

        {activePage === "projects" && <ProjectsPage projects={projects} />}
        {activePage === "meetings" && <MeetingsPage meetings={meetings} />}
        {activePage !== "projects" && activePage !== "meetings" && (
          <section className="page">
            <header className="page-header">
              <div className="page-title-wrap">
                <div className="page-title">{navItems.find((i) => i.id === activePage)?.label}</div>
                <div className="page-subtitle">Platzhalter fuer die Zielansicht.</div>
              </div>
            </header>
            <div className="card empty-state">
              <div className="empty-title">In Arbeit</div>
              <div className="empty-subtitle">
                Diese Seite ist im Spike noch nicht ausgearbeitet.
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
