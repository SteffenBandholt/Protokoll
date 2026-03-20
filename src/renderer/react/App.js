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

export default function App() {
  const { useEffect, useState } = React || {};
  const [state, setState] = useState(() => ({
    loading: true,
    error: "",
    projects: [],
  }));

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const api = window.bbmDb || {};
        if (typeof api.projectsList !== "function") {
          if (alive) {
            setState({
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
          setState({
            loading: false,
            error: res?.error || "Fehler beim Laden der Projekte.",
            projects: [],
          });
          return;
        }

        setState({
          loading: false,
          error: "",
          projects: Array.isArray(res.list) ? res.list : [],
        });
      } catch (err) {
        if (!alive) return;
        setState({
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

  const projects = state.projects || [];

  const header = React.createElement(
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
  );

  const renderCard = (p) => {
    const title = getProjectTitle(p);
    const subtitle = getProjectSubtitle(p);
    const meta = getProjectMeta(p);

    return React.createElement(
      "div",
      { className: "react-card", key: String(p?.id ?? title) },
      React.createElement("div", { className: "react-card-meta" }, meta || " "),
      React.createElement("h3", { className: "react-card-title" }, title),
      subtitle
        ? React.createElement("div", { className: "react-card-meta" }, subtitle)
        : null
    );
  };

  const content = state.loading
    ? React.createElement("div", { className: "react-loading" }, "Lade Projekte...")
    : state.error
      ? React.createElement("div", { className: "react-empty" }, state.error)
      : projects.length
        ? React.createElement(
            "div",
            { className: "react-project-grid" },
            projects.map(renderCard)
          )
        : React.createElement(
            "div",
            { className: "react-empty" },
            "Noch keine Projekte vorhanden."
          );

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
          { className: "react-nav-item is-active", type: "button" },
          "Projekte"
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
