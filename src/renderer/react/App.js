const React = window.React;

const pick = (value) => (value == null ? "" : String(value).trim());

const getProjectNumber = (p) => pick(p?.project_number ?? p?.projectNumber ?? "");

const getProjectTitle = (p) => {
  const short = pick(p?.short);
  const name = pick(p?.name);
  return short || name || "(ohne Name)";
};

const getProjectSubtitle = (p) => {
  const short = pick(p?.short);
  const name = pick(p?.name);
  if (short && name) return name;
  const city = pick(p?.city);
  return city || "";
};

const getProjectMeta = (p) => {
  const number = getProjectNumber(p);
  if (number) return `Nr. ${number}`;
  return "";
};

const getMeetingTitle = (m) => {
  const title = pick(m?.title);
  if (title) return title;
  const idx = pick(m?.meeting_index ?? m?.meetingIndex ?? "");
  return idx ? `Protokoll #${idx}` : "(ohne Titel)";
};

const getMeetingDate = (m) => {
  const raw = pick(m?.meeting_date ?? m?.meetingDate ?? m?.date ?? m?.created_at ?? m?.createdAt);
  return raw ? raw.slice(0, 10) : "";
};

const isMeetingClosed = (m) => {
  const raw = Number(m?.is_closed ?? m?.isClosed ?? 0);
  return raw === 1;
};

export default function App() {
  const { useEffect, useMemo, useState } = React || {};
  const [view, setView] = useState("projects");
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const [projectsState, setProjectsState] = useState(() => ({
    loading: true,
    error: "",
    projects: [],
  }));

  const [meetingsState, setMeetingsState] = useState(() => ({
    loading: false,
    error: "",
    meetings: [],
  }));

  const canOpenLegacy = typeof window.__bbmReactBridge?.openProjectMeetings === "function";
  const canOpenMeeting = typeof window.__bbmReactBridge?.openMeetingTops === "function";

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const api = window.bbmDb || {};
        if (typeof api.projectsList !== "function") {
          if (alive) {
            setProjectsState({
              loading: false,
              error: "projectsList ist nicht verfuegbar (Preload/IPC fehlt).",
              projects: [],
            });
          }
          return;
        }

        const res = await api.projectsList();
        if (!alive) return;
        if (!res?.ok) {
          setProjectsState({
            loading: false,
            error: res?.error || "Fehler beim Laden der Projekte.",
            projects: [],
          });
          return;
        }

        setProjectsState({
          loading: false,
          error: "",
          projects: Array.isArray(res.list) ? res.list : [],
        });
      } catch (err) {
        if (!alive) return;
        setProjectsState({
          loading: false,
          error: err?.message || "Fehler beim Laden der Projekte.",
          projects: [],
        });
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const loadMeetings = async () => {
      if (view !== "meetings") return;

      const projectId = selectedProjectId ? String(selectedProjectId) : "";
      if (!projectId) {
        setMeetingsState({
          loading: false,
          error: "Bitte zuerst ein Projekt auswaehlen.",
          meetings: [],
        });
        return;
      }

      try {
        const api = window.bbmDb || {};
        if (typeof api.meetingsListByProject !== "function") {
          setMeetingsState({
            loading: false,
            error: "meetingsListByProject ist nicht verfuegbar (Preload/IPC fehlt).",
            meetings: [],
          });
          return;
        }

        setMeetingsState({ loading: true, error: "", meetings: [] });
        const res = await api.meetingsListByProject(projectId);
        if (!alive) return;
        if (!res?.ok) {
          setMeetingsState({
            loading: false,
            error: res?.error || "Fehler beim Laden der Protokolle.",
            meetings: [],
          });
          return;
        }

        setMeetingsState({
          loading: false,
          error: "",
          meetings: Array.isArray(res.list) ? res.list : [],
        });
      } catch (err) {
        if (!alive) return;
        setMeetingsState({
          loading: false,
          error: err?.message || "Fehler beim Laden der Protokolle.",
          meetings: [],
        });
      }
    };

    loadMeetings();
    return () => {
      alive = false;
    };
  }, [view, selectedProjectId]);

  const projects = projectsState.projects || [];
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => String(p?.id ?? "") === String(selectedProjectId)) || null;
  }, [projects, selectedProjectId]);

  const openMeetingsForProject = (p) => {
    const pid = String(p?.id ?? "").trim();
    if (!pid) return;
    setSelectedProjectId(pid);
    setView("meetings");
  };

  const openLegacyProject = (p, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (!canOpenLegacy) return;
    const pid = String(p?.id ?? "").trim();
    if (!pid) return;
    window.__bbmReactBridge.openProjectMeetings(pid);
  };

  const openLegacyMeeting = (m, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (!canOpenMeeting) return;
    const mid = String(m?.id ?? "").trim();
    const pid = String(selectedProjectId ?? "").trim();
    if (!mid || !pid) return;
    window.__bbmReactBridge.openMeetingTops({ projectId: pid, meetingId: mid });
  };

  const handleProjectSelectChange = (e) => {
    const next = String(e?.target?.value || "").trim();
    if (!next) return;
    setSelectedProjectId(next);
  };

  const header = view === "projects"
    ? React.createElement(
        "div",
        { className: "react-topbar" },
        React.createElement(
          "div",
          { className: "react-title-wrap" },
          React.createElement("h1", { className: "react-title" }, "Projekte"),
          React.createElement(
            "p",
            { className: "react-subtitle" },
            "Alle Projekte im Ueberblick. React-Modus (Pilot)."
          )
        )
      )
    : React.createElement(
        "div",
        { className: "react-topbar" },
        React.createElement(
          "div",
          { className: "react-title-wrap" },
          React.createElement("h1", { className: "react-title" }, "Protokolle"),
          React.createElement(
            "p",
            { className: "react-subtitle" },
            selectedProject
              ? `Projekt: ${getProjectTitle(selectedProject)}`
              : "Bitte zuerst ein Projekt auswaehlen."
          )
        ),
        React.createElement(
          "div",
          { className: "react-header-actions" },
          React.createElement(
            "button",
            {
              type: "button",
              className: "react-btn react-btn-ghost",
              onClick: () => setView("projects"),
            },
            "Zurueck zu Projekte"
          )
        )
      );

  const renderProjectCard = (p) => {
    const title = getProjectTitle(p);
    const subtitle = getProjectSubtitle(p);
    const meta = getProjectMeta(p);

    return React.createElement(
      "div",
      {
        className: "react-card react-card-clickable",
        key: String(p?.id ?? title),
        role: "button",
        tabIndex: 0,
        onClick: () => openMeetingsForProject(p),
        onKeyDown: (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          openMeetingsForProject(p);
        },
      },
      React.createElement("div", { className: "react-card-meta" }, meta || " "),
      React.createElement("h3", { className: "react-card-title" }, title),
      subtitle
        ? React.createElement("div", { className: "react-card-meta" }, subtitle)
        : null,
      React.createElement(
        "div",
        { className: "react-card-actions" },
        React.createElement(
          "button",
          {
            type: "button",
            className: "react-btn react-btn-small",
            disabled: !canOpenLegacy,
            onClick: (e) => openLegacyProject(p, e),
            title: canOpenLegacy
              ? "Projekt im Standardmodus oeffnen"
              : "Standardmodus ist nicht verfuegbar",
          },
          "Im Standard oeffnen"
        )
      )
    );
  };

  const renderMeetingCard = (m) => {
    const title = getMeetingTitle(m);
    const date = getMeetingDate(m);
    const closed = isMeetingClosed(m);

    return React.createElement(
      "div",
      { className: "react-card react-meeting-card", key: String(m?.id ?? title) },
      React.createElement(
        "div",
        { className: "react-meeting-head" },
        React.createElement("div", { className: "react-meeting-title" }, title),
        React.createElement(
          "span",
          { className: `react-status ${closed ? "is-closed" : "is-open"}` },
          closed ? "geschlossen" : "offen"
        )
      ),
      React.createElement(
        "div",
        { className: "react-meeting-meta" },
        date ? `Datum: ${date}` : "Datum: (unbekannt)"
      ),
      React.createElement(
        "div",
        { className: "react-meeting-actions" },
        React.createElement(
          "button",
          {
            type: "button",
            className: "react-btn react-btn-small",
            disabled: !canOpenMeeting,
            onClick: (e) => openLegacyMeeting(m, e),
            title: canOpenMeeting
              ? "Protokoll im Standardmodus oeffnen"
              : "Standardmodus ist nicht verfuegbar",
          },
          "Im Standard oeffnen"
        )
      )
    );
  };

  const projectsContent = projectsState.loading
    ? React.createElement("div", { className: "react-loading" }, "Lade Projekte...")
    : projectsState.error
      ? React.createElement("div", { className: "react-empty" }, projectsState.error)
      : projects.length
        ? React.createElement(
            "div",
            { className: "react-project-grid" },
            projects.map(renderProjectCard)
          )
        : React.createElement(
            "div",
            { className: "react-empty" },
            "Noch keine Projekte vorhanden."
          );

  const meetings = meetingsState.meetings || [];
  const meetingsContent = meetingsState.loading
    ? React.createElement("div", { className: "react-loading" }, "Lade Protokolle...")
    : meetingsState.error
      ? React.createElement("div", { className: "react-empty" }, meetingsState.error)
      : React.createElement(
          "div",
          { className: "react-meetings-body" },
          projects.length
            ? React.createElement(
                "div",
                { className: "react-project-switch" },
                React.createElement("span", { className: "react-project-switch-label" }, "Projekt"),
                React.createElement(
                  "select",
                  {
                    className: "react-select",
                    value: selectedProjectId || "",
                    onChange: handleProjectSelectChange,
                  },
                  projects.map((p) =>
                    React.createElement(
                      "option",
                      { key: String(p?.id ?? ""), value: String(p?.id ?? "") },
                      getProjectTitle(p)
                    )
                  )
                )
              )
            : null,
          meetings.length
            ? React.createElement(
                "div",
                { className: "react-meetings-list" },
                meetings.map(renderMeetingCard)
              )
            : React.createElement(
                "div",
                { className: "react-empty" },
                "Keine Protokolle vorhanden."
              )
        );

  const content = view === "projects" ? projectsContent : meetingsContent;

  return React.createElement(
    "div",
    { className: "react-shell" },
    React.createElement(
      "aside",
      { className: "react-sidebar" },
      React.createElement("div", { className: "react-brand" }, "BBM"),
      React.createElement(
        "nav",
        { className: "react-nav" },
        React.createElement(
          "button",
          {
            className: `react-nav-item ${view === "projects" ? "is-active" : ""}`,
            type: "button",
            onClick: () => setView("projects"),
          },
          "Projekte"
        ),
        React.createElement(
          "button",
          {
            className: `react-nav-item ${view === "meetings" ? "is-active" : ""}`,
            type: "button",
            onClick: () => setView("meetings"),
          },
          "Protokolle"
        ),
        React.createElement(
          "div",
          { className: "react-nav-hint" },
          "React-Modus ist aktiv. Weitere Seiten folgen schrittweise."
        )
      )
    ),
    React.createElement(
      "main",
      { className: "react-main" },
      header,
      content
    )
  );
}
