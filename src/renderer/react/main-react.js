const toUrl = (rel) => new URL(rel, import.meta.url).toString();

const ensureStyle = (href, id) => {
  if (id && document.getElementById(id)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  if (id) link.id = id;
  document.head.appendChild(link);
};

const ensureScript = (src, id) => {
  if (id && document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    if (id) script.id = id;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script failed to load: ${src}`));
    document.head.appendChild(script);
  });
};

const renderError = (host, message) => {
  host.innerHTML = "";
  const box = document.createElement("div");
  box.style.padding = "24px";
  box.style.fontFamily = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";
  box.style.color = "#0f172a";
  box.textContent = message || "React konnte nicht geladen werden.";
  host.appendChild(box);
};

export async function mountReactApp() {
  const host = document.getElementById("content");
  if (!host) return false;

  ensureStyle(toUrl("./styles.css"), "bbm-react-styles");

  try {
    await ensureScript(toUrl("./vendor/react.production.min.js"), "bbm-react-lib");
    await ensureScript(toUrl("./vendor/react-dom.production.min.js"), "bbm-react-dom");
  } catch (err) {
    renderError(host, err?.message || String(err));
    return false;
  }

  const React = window.React;
  const ReactDOM = window.ReactDOM;

  if (!React || !ReactDOM) {
    renderError(host, "React/ReactDOM konnte nicht initialisiert werden.");
    return false;
  }

  try {
    host.innerHTML = "";
    const rootEl = document.createElement("div");
    rootEl.id = "bbm-react-root";
    host.appendChild(rootEl);

    const mod = await import("./App.js");
    const App = mod.default;

    if (typeof ReactDOM.createRoot === "function") {
      const root = ReactDOM.createRoot(rootEl);
      root.render(React.createElement(App));
    } else if (typeof ReactDOM.render === "function") {
      ReactDOM.render(React.createElement(App), rootEl);
    } else {
      renderError(host, "ReactDOM render/createRoot fehlt.");
      return false;
    }

    return true;
  } catch (err) {
    renderError(host, err?.message || String(err));
    return false;
  }
}
