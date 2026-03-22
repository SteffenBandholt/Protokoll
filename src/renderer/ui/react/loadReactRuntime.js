let runtimePromise = null;

function _ensureScript(src, globalName) {
  return new Promise((resolve, reject) => {
    if (window[globalName]) {
      resolve(window[globalName]);
      return;
    }

    const existing = document.querySelector(`script[data-bbm-react-runtime="${globalName}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window[globalName]), { once: true });
      existing.addEventListener("error", () => reject(new Error(`React runtime failed: ${globalName}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.bbmReactRuntime = globalName;
    script.onload = () => resolve(window[globalName]);
    script.onerror = () => reject(new Error(`React runtime failed: ${globalName}`));
    document.head.appendChild(script);
  });
}

export async function loadReactRuntime() {
  if (runtimePromise) return await runtimePromise;

  runtimePromise = (async () => {
    const reactUrl = new URL(
      "../../../../experiments/react-ui/node_modules/react/umd/react.production.min.js",
      import.meta.url
    ).href;
    const reactDomUrl = new URL(
      "../../../../experiments/react-ui/node_modules/react-dom/umd/react-dom.production.min.js",
      import.meta.url
    ).href;

    await _ensureScript(reactUrl, "React");
    await _ensureScript(reactDomUrl, "ReactDOM");

    if (!window.React || !window.ReactDOM) {
      throw new Error("React runtime unavailable.");
    }

    return {
      React: window.React,
      ReactDOM: window.ReactDOM,
    };
  })();

  return await runtimePromise;
}
