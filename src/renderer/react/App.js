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
  const city = pick(p?.city);
  const parts = [];
  if (number) parts.push(`Nr. ${number}`);
  if (city) parts.push(`Ort: ${city}`);
  return parts.join(" · ");
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

const getMeetingIndex = (m) => pick(m?.meeting_index ?? m?.meetingIndex ?? "");

const isMeetingClosed = (m) => {
  const raw = Number(m?.is_closed ?? m?.isClosed ?? 0);
  return raw === 1;
};

const getTopId = (t) => pick(t?.id ?? "");
const getTopTitle = (t) => pick(t?.title) || "(ohne Bezeichnung)";
const getTopNumber = (t) => pick(t?.displayNumber ?? t?.number ?? "");
const getTopLevel = (t) => {
  const raw = Number(t?.level ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
};
const isTopHidden = (t) => Number(t?.is_hidden ?? t?.isHidden ?? 0) === 1;
const isTopImportant = (t) => Number(t?.is_important ?? t?.isImportant ?? 0) === 1;
const isTopTask = (t) => Number(t?.is_task ?? t?.isTask ?? 0) === 1;
const isTopDecision = (t) => Number(t?.is_decision ?? t?.isDecision ?? 0) === 1;
const getTopLongtext = (t) => pick(t?.longtext ?? t?.longText ?? "");
const getTopDueDate = (t) => pick(t?.due_date ?? t?.dueDate ?? "");

const formatDate = (raw) => {
  const value = pick(raw);
  if (!value) return "";
  return value.length >= 10 ? value.slice(0, 10) : value;
};

const sortMeetings = (list) => {
  const items = Array.isArray(list) ? [...list] : [];
  items.sort((a, b) => {
    const aDate = getMeetingDate(a);
    const bDate = getMeetingDate(b);
    if (aDate && bDate && aDate !== bDate) return aDate > bDate ? -1 : 1;
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    const aIdx = Number(getMeetingIndex(a) || 0);
    const bIdx = Number(getMeetingIndex(b) || 0);
    if (aIdx !== bIdx) return bIdx - aIdx;
    return 0;
  });
  return items;
};

const readReturnView = () => {
  try {
    const raw = String(window.localStorage?.getItem?.("bbm.reactReturnView") || "")
      .trim()
      .toLowerCase();
    return raw === "meetings" || raw === "projects" ? raw : "projects";
  } catch (_e) {
    return "projects";
  }
};

const readReturnProjectId = () => {
  try {
    const raw = String(window.localStorage?.getItem?.("bbm.reactReturnProjectId") || "").trim();
    return raw || null;
  } catch (_e) {
    return null;
  }
};

const clearReturnContext = () => {
  try {
    window.localStorage?.removeItem?.("bbm.reactReturnView");
    window.localStorage?.removeItem?.("bbm.reactReturnProjectId");
  } catch (_e) {
    // ignore
  }
};

export default function App() {
  const { useEffect, useMemo, useState } = React || {};
  const [view, setView] = useState(() => readReturnView());
  const [selectedProjectId, setSelectedProjectId] = useState(() => readReturnProjectId());
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [projectQuery, setProjectQuery] = useState("");

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

  const [topsState, setTopsState] = useState(() => ({
    loading: false,
    error: "",
    meeting: null,
    tops: [],
  }));

  const [selectedTopId, setSelectedTopId] = useState(null);

  const canOpenLegacy = typeof window.__bbmReactBridge?.openProjectMeetings === "function";
  const canOpenMeeting = typeof window.__bbmReactBridge?.openMeetingTops === "function";

  useEffect(() => {
    clearReturnContext();
  }, []);

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

  useEffect(() => {
    let alive = true;

    const loadTops = async () => {
      if (view !== "tops") return;

      const meetingId = String(selectedMeetingId || "").trim();
      if (!meetingId) {
        setTopsState({
          loading: false,
          error: "Bitte zuerst ein Protokoll auswaehlen.",
          meeting: null,
          tops: [],
        });
        return;
      }

      try {
        const api = window.bbmDb || {};
        if (typeof api.topsListByMeeting !== "function") {
          setTopsState({
            loading: false,
            error: "topsListByMeeting ist nicht verfuegbar (Preload/IPC fehlt).",
            meeting: null,
            tops: [],
          });
          return;
        }

        setTopsState({ loading: true, error: "", meeting: null, tops: [] });
        const res = await api.topsListByMeeting(meetingId);
        if (!alive) return;
        if (!res?.ok) {
          setTopsState({
            loading: false,
            error: res?.error || "Fehler beim Laden der TOPs.",
            meeting: null,
            tops: [],
          });
          return;
        }

        setTopsState({
          loading: false,
          error: "",
          meeting: res.meeting || null,
          tops: Array.isArray(res.list) ? res.list : [],
        });
      } catch (err) {
        if (!alive) return;
        setTopsState({
          loading: false,
          error: err?.message || "Fehler beim Laden der TOPs.",
          meeting: null,
          tops: [],
        });
      }
    };

    loadTops();
    return () => {
      alive = false;
    };
  }, [view, selectedMeetingId]);

  useEffect(() => {
    if (view !== "tops") return;
    const items = Array.isArray(topsState.tops) ? topsState.tops : [];
    if (!items.length) {
      if (selectedTopId) setSelectedTopId(null);
      return;
    }
    const selected = items.find((t) => getTopId(t) === String(selectedTopId || ""));
    if (!selected) {
      setSelectedTopId(items[0]?.id ?? null);
    }
  }, [view, topsState.tops]);

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

  const openReactMeeting = (m) => {
    const mid = String(m?.id ?? "").trim();
    if (!mid) return;
    setSelectedMeetingId(mid);
    setSelectedTopId(null);
    setView("tops");
  };

  const handleProjectSelectChange = (e) => {
    const next = String(e?.target?.value || "").trim();
    if (!next) return;
    setSelectedProjectId(next);
  };

  const switchToStandard = () => {
    try {
      window.localStorage?.setItem?.("bbm.uiReturnToReact", "1");
      window.localStorage?.setItem?.("bbm.reactReturnView", view);
      if (selectedProjectId) {
        window.localStorage?.setItem?.("bbm.reactReturnProjectId", String(selectedProjectId));
      }
      window.localStorage?.setItem?.("bbm.uiMode", "new");
    } catch (_e) {
      // ignore
    }
    try {
      window.location.reload();
    } catch (_e) {
      // ignore
    }
  };

  const badge = React.createElement("span", { className: "react-badge" }, "React Pilot");

  const query = String(projectQuery || "").trim().toLowerCase();
  const filteredProjects = query
    ? projects.filter((p) => {
        const hay = [
          getProjectNumber(p),
          pick(p?.short),
          pick(p?.name),
          pick(p?.city),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      })
    : projects;

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
            "Uebersicht und Einstieg in alle Projekte."
          )
        ),
        React.createElement(
          "div",
          { className: "react-header-actions" },
          badge,
          React.createElement(
            "button",
            {
              type: "button",
              className: "react-btn react-btn-ghost",
              onClick: switchToStandard,
            },
            "Standardmodus"
          )
        )
      )
    : view === "meetings"
    ? React.createElement(
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
          badge,
          React.createElement(
            "button",
            {
              type: "button",
              className: "react-btn react-btn-ghost",
              onClick: () => setView("projects"),
            },
            "Zurueck zu Projekte"
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "react-btn react-btn-ghost",
              onClick: switchToStandard,
            },
            "Standardmodus"
          )
        )
      )
    : React.createElement(
        "div",
        { className: "react-topbar react-topbar-tops" },
        React.createElement(
          "div",
          { className: "react-title-wrap" },
          React.createElement("h1", { className: "react-title" }, "TOPs"),
          React.createElement(
            "p",
            { className: "react-subtitle" },
            selectedProject
              ? `Projekt: ${getProjectTitle(selectedProject)}`
              : "Projektkontext nicht verfuegbar."
          )
        ),
        React.createElement(
          "div",
          { className: "react-header-actions" },
          badge,
          React.createElement(
            "button",
            {
              type: "button",
              className: "react-btn react-btn-ghost",
              onClick: () => setView("meetings"),
            },
            "Zurueck zu Protokolle"
          ),
          React.createElement(
            "button",
            {
              type: "button",
              className: "react-btn react-btn-ghost",
              onClick: switchToStandard,
            },
            "Standardmodus"
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
        ? React.createElement("div", { className: "react-card-subtitle" }, subtitle)
        : null,
      React.createElement(
        "div",
        { className: "react-card-actions" },
        React.createElement(
          "button",
          {
            type: "button",
            className: "react-btn react-btn-primary",
            onClick: (e) => {
              if (e?.stopPropagation) e.stopPropagation();
              openMeetingsForProject(p);
            },
          },
          "Protokolle anzeigen"
        ),
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
    const idx = getMeetingIndex(m);

    return React.createElement(
      "div",
      {
        className: "react-card react-meeting-card",
        key: String(m?.id ?? title),
      },
      React.createElement(
        "div",
        { className: "react-meeting-head" },
        React.createElement(
          "div",
          { className: "react-meeting-title" },
          title
        ),
        React.createElement(
          "div",
          { className: "react-meeting-head-meta" },
          idx ? React.createElement("span", { className: "react-meeting-index" }, `#${idx}`) : null,
          React.createElement(
            "span",
            { className: `react-status ${closed ? "is-closed" : "is-open"}` },
            closed ? "geschlossen" : "offen"
          )
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
            className: "react-btn react-btn-primary",
            onClick: () => openReactMeeting(m),
          },
          "Details oeffnen"
        ),
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
      : React.createElement(
          "div",
          { className: "react-projects-root" },
          React.createElement(
            "div",
            { className: "react-toolbar" },
            React.createElement(
              "div",
              { className: "react-search" },
              React.createElement("span", { className: "react-search-label" }, "Suche"),
              React.createElement("input", {
                className: "react-search-input",
                type: "text",
                placeholder: "Projekt suchen (Nr., Kurz, Name, Ort)",
                value: projectQuery,
                onChange: (e) => setProjectQuery(String(e?.target?.value || "")),
              })
            ),
            React.createElement(
              "div",
              { className: "react-count" },
              `${filteredProjects.length} Projekte`
            )
          ),
          filteredProjects.length
            ? React.createElement(
                "div",
                { className: "react-project-grid" },
                filteredProjects.map(renderProjectCard)
              )
            : React.createElement(
                "div",
                { className: "react-empty" },
                "Keine Projekte gefunden."
              )
        );

  const meetings = meetingsState.meetings || [];
  const sortedMeetings = sortMeetings(meetings);
  const meetingsContent = meetingsState.loading
    ? React.createElement("div", { className: "react-loading" }, "Lade Protokolle...")
    : meetingsState.error
      ? React.createElement("div", { className: "react-empty" }, meetingsState.error)
      : React.createElement(
          "div",
          { className: "react-meetings-body" },
          React.createElement(
            "div",
            { className: "react-meetings-toolbar" },
            React.createElement(
              "div",
              { className: "react-meetings-context" },
              React.createElement(
                "div",
                { className: "react-meetings-context-title" },
                selectedProject ? getProjectTitle(selectedProject) : "Projekt"
              ),
              React.createElement(
                "div",
                { className: "react-meetings-context-meta" },
                selectedProject ? getProjectMeta(selectedProject) : ""
              )
            ),
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
            React.createElement(
              "div",
              { className: "react-count" },
              `${sortedMeetings.length} Protokolle`
            )
          ),
          sortedMeetings.length
            ? React.createElement(
                "div",
                { className: "react-meetings-list" },
                sortedMeetings.map(renderMeetingCard)
              )
            : React.createElement(
                "div",
                { className: "react-empty" },
                "Keine Protokolle vorhanden."
              )
        );

  const topsMeeting = topsState.meeting
    || meetings.find((m) => String(m?.id ?? "") === String(selectedMeetingId ?? ""))
    || null;
  const topsItems = Array.isArray(topsState.tops) ? topsState.tops : [];
  const selectedTop = topsItems.find((t) => getTopId(t) === String(selectedTopId || "")) || null;
  const level1Count = topsItems.filter((t) => getTopLevel(t) === 1).length;
  const openMeetingStandard = () => {
    if (!topsMeeting) return;
    const pid = String(selectedProjectId ?? "").trim();
    const mid = String(topsMeeting?.id ?? selectedMeetingId ?? "").trim();
    if (!pid || !mid || !canOpenMeeting) return;
    window.__bbmReactBridge.openMeetingTops({ projectId: pid, meetingId: mid });
  };

  const renderTopItem = (t) => {
    const id = getTopId(t);
    const title = getTopTitle(t);
    const number = getTopNumber(t);
    const level = getTopLevel(t);
    const isSelected = id === String(selectedTopId || "");
    const classes = [
      "react-top-item",
      `level-${level}`,
      isSelected ? "is-selected" : "",
      isTopHidden(t) ? "is-hidden" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return React.createElement(
      "button",
      {
        key: id || `${title}-${level}`,
        type: "button",
        className: classes,
        onClick: () => setSelectedTopId(t?.id ?? null),
      },
      React.createElement(
        "div",
        { className: "react-top-item-title" },
        number ? `TOP ${number}` : `Level ${level}`
      ),
      React.createElement("div", { className: "react-top-item-text" }, title)
    );
  };

  const topsContent = topsState.loading
    ? React.createElement("div", { className: "react-loading" }, "Lade TOPs...")
    : topsState.error
      ? React.createElement("div", { className: "react-empty" }, topsState.error)
      : React.createElement(
          "div",
          { className: "react-tops-layout" },
          React.createElement(
            "section",
            { className: "react-tops-list" },
            React.createElement(
              "div",
              { className: "react-tops-list-head" },
              React.createElement("div", { className: "react-tops-list-title" }, "TOP-Liste"),
              React.createElement(
                "div",
                { className: "react-tops-list-meta" },
                `${topsItems.length} TOPs · ${level1Count} Ebene 1`
              )
            ),
            topsItems.length
              ? React.createElement(
                  "div",
                  { className: "react-tops-list-body" },
                  topsItems.map(renderTopItem)
                )
              : React.createElement("div", { className: "react-empty" }, "Keine TOPs vorhanden.")
          ),
          React.createElement(
            "section",
            { className: "react-tops-detail" },
            selectedTop
              ? React.createElement(
                  "div",
                  { className: "react-tops-detail-card" },
                  React.createElement(
                    "div",
                    { className: "react-tops-detail-head" },
                    React.createElement(
                      "div",
                      { className: "react-tops-detail-title" },
                      getTopTitle(selectedTop)
                    ),
                    React.createElement(
                      "div",
                      { className: "react-tops-detail-meta" },
                      getTopNumber(selectedTop)
                        ? `TOP ${getTopNumber(selectedTop)}`
                        : `Level ${getTopLevel(selectedTop)}`
                    )
                  ),
                  React.createElement(
                    "div",
                    { className: "react-tops-detail-tags" },
                    isTopImportant(selectedTop)
                      ? React.createElement("span", { className: "react-tag is-warn" }, "Wichtig")
                      : null,
                    isTopTask(selectedTop)
                      ? React.createElement("span", { className: "react-tag is-info" }, "Aufgabe")
                      : null,
                    isTopDecision(selectedTop)
                      ? React.createElement("span", { className: "react-tag is-info" }, "Entscheidung")
                      : null,
                    isTopHidden(selectedTop)
                      ? React.createElement("span", { className: "react-tag is-muted" }, "Ausgeblendet")
                      : null
                  ),
                  React.createElement(
                    "div",
                    { className: "react-tops-detail-body" },
                    React.createElement(
                      "div",
                      { className: "react-tops-detail-section" },
                      React.createElement(
                        "div",
                        { className: "react-tops-detail-label" },
                        "Kurztext"
                      ),
                      React.createElement(
                        "div",
                        { className: "react-tops-detail-value" },
                        getTopTitle(selectedTop)
                      )
                    ),
                    getTopLongtext(selectedTop)
                      ? React.createElement(
                          "div",
                          { className: "react-tops-detail-section" },
                          React.createElement(
                            "div",
                            { className: "react-tops-detail-label" },
                            "Langtext"
                          ),
                          React.createElement(
                            "div",
                            { className: "react-tops-detail-value" },
                            getTopLongtext(selectedTop)
                          )
                        )
                      : null,
                    getTopDueDate(selectedTop)
                      ? React.createElement(
                          "div",
                          { className: "react-tops-detail-section" },
                          React.createElement(
                            "div",
                            { className: "react-tops-detail-label" },
                            "Faellig"
                          ),
                          React.createElement(
                            "div",
                            { className: "react-tops-detail-value" },
                            formatDate(getTopDueDate(selectedTop))
                          )
                        )
                      : null
                  )
                )
              : React.createElement(
                  "div",
                  { className: "react-empty" },
                  "Bitte einen TOP auswaehlen."
                )
          ),
          React.createElement(
            "aside",
            { className: "react-tops-context" },
            React.createElement(
              "div",
              { className: "react-tops-context-card" },
              React.createElement("div", { className: "react-tops-context-title" }, "Meeting-Kontext"),
              React.createElement(
                "div",
                { className: "react-tops-context-row" },
                React.createElement("span", null, "Titel"),
                React.createElement(
                  "span",
                  null,
                  topsMeeting ? getMeetingTitle(topsMeeting) : "(unbekannt)"
                )
              ),
              React.createElement(
                "div",
                { className: "react-tops-context-row" },
                React.createElement("span", null, "Datum"),
                React.createElement(
                  "span",
                  null,
                  formatDate(getMeetingDate(topsMeeting)) || "(unbekannt)"
                )
              ),
              React.createElement(
                "div",
                { className: "react-tops-context-row" },
                React.createElement("span", null, "Status"),
                React.createElement(
                  "span",
                  { className: `react-status ${isMeetingClosed(topsMeeting) ? "is-closed" : "is-open"}` },
                  isMeetingClosed(topsMeeting) ? "geschlossen" : "offen"
                )
              ),
              React.createElement(
                "div",
                { className: "react-tops-context-actions" },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "react-btn react-btn-small",
                    disabled: !canOpenMeeting,
                    onClick: openMeetingStandard,
                  },
                  "Im Standard oeffnen"
                )
              )
            )
          )
        );

  const content = view === "projects" ? projectsContent : view === "meetings" ? meetingsContent : topsContent;

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
            className: `react-nav-item ${view !== "projects" ? "is-active" : ""}`,
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
