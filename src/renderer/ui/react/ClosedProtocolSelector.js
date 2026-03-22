import { loadReactRuntime } from "./loadReactRuntime.js";

function getPrimaryLabel(mode) {
  if (mode === "mail") return "E-Mail senden";
  if (mode === "print") return "PDF-Vorschau";
  return "Protokoll oeffnen";
}

function getTitle(mode) {
  if (mode === "mail") return "Geschlossenes Protokoll fuer E-Mail waehlen";
  if (mode === "print") return "Geschlossenes Protokoll fuer Druck waehlen";
  return "Geschlossenes Protokoll waehlen";
}

export async function openClosedProtocolSelector({
  mode = "view",
  items = [],
  selectedId = null,
  searchEnabled = mode === "view",
  onConfirm,
} = {}) {
  const { React, ReactDOM } = await loadReactRuntime();

  return await new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(15, 23, 42, 0.45)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "12500";

    const host = document.createElement("div");
    overlay.appendChild(host);
    document.body.appendChild(overlay);

    const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;

    const cleanup = (result = null) => {
      document.removeEventListener("keydown", escHandler, true);
      if (root) root.unmount();
      else ReactDOM.unmountComponentAtNode(host);
      overlay.remove();
      resolve(result);
    };

    const handleConfirm = async (item) => {
      if (typeof onConfirm === "function") {
        await onConfirm(item);
      }
      cleanup(item || null);
    };

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) cleanup(null);
    });

    const escHandler = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      cleanup(null);
    };
    document.addEventListener("keydown", escHandler, true);

    function ClosedProtocolSelector(props) {
      const [query, setQuery] = React.useState("");
      const [currentId, setCurrentId] = React.useState(props.selectedId || props.items[0]?.id || null);

      const filtered = React.useMemo(() => {
        const raw = String(query || "").trim().toLowerCase();
        if (!raw) return props.items;
        return props.items.filter((item) => {
          const hay = `${item.label || ""} ${item.searchText || ""}`.toLowerCase();
          return hay.includes(raw);
        });
      }, [props.items, query]);

      const activeItem =
        filtered.find((item) => String(item.id) === String(currentId || "")) ||
        props.items.find((item) => String(item.id) === String(currentId || "")) ||
        null;

      return React.createElement(
        "div",
        {
          style: {
            width: "min(720px, calc(100vw - 28px))",
            maxHeight: "calc(100vh - 28px)",
            background: "#ffffff",
            border: "1px solid #d7dde5",
            borderRadius: "16px",
            boxShadow: "0 18px 44px rgba(15,23,42,0.22)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 18px 12px",
              borderBottom: "1px solid #e2e8f0",
            },
          },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { fontSize: "18px", fontWeight: "800", color: "#0f172a" } },
              getTitle(props.mode)
            ),
            React.createElement(
              "div",
              { style: { marginTop: "4px", fontSize: "12px", color: "#64748b" } },
              "Listenbasierte Auswahl geschlossener Protokolle."
            )
          ),
          React.createElement(
            "button",
            {
              type: "button",
              onClick: () => props.onCancel(),
              style: {
                border: "1px solid #d7dde5",
                background: "#ffffff",
                borderRadius: "10px",
                padding: "8px 10px",
                cursor: "pointer",
              },
            },
            "Schliessen"
          )
        ),
        React.createElement(
          "div",
          {
            style: {
              padding: "14px 18px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              minHeight: "0",
            },
          },
          props.searchEnabled
            ? React.createElement("input", {
                type: "text",
                value: query,
                placeholder: "Protokoll suchen",
                onChange: (e) => setQuery(e.target.value || ""),
                style: {
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "14px",
                },
              })
            : null,
          React.createElement(
            "div",
            {
              style: {
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                overflow: "auto",
                minHeight: "240px",
                maxHeight: "52vh",
                background: "#f8fafc",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              },
            },
            filtered.length
              ? filtered.map((item) =>
                  React.createElement(
                    "button",
                    {
                      key: item.id,
                      type: "button",
                      onClick: () => setCurrentId(item.id),
                      onDoubleClick: () => props.onConfirm(item),
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: "4px",
                        width: "100%",
                        textAlign: "left",
                        border:
                          String(item.id) === String(activeItem?.id || "")
                            ? "1px solid #2563eb"
                            : "1px solid #dbe4ee",
                        background:
                          String(item.id) === String(activeItem?.id || "") ? "#eff6ff" : "#ffffff",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        cursor: "pointer",
                      },
                    },
                    React.createElement(
                      "div",
                      { style: { fontSize: "14px", fontWeight: "700", color: "#0f172a" } },
                      item.label || "Protokoll"
                    ),
                    item.subLabel
                      ? React.createElement(
                          "div",
                          { style: { fontSize: "12px", color: "#64748b" } },
                          item.subLabel
                        )
                      : null
                  )
                )
              : React.createElement(
                  "div",
                  {
                    style: {
                      padding: "18px 12px",
                      textAlign: "center",
                      fontSize: "13px",
                      color: "#64748b",
                    },
                  },
                  "Keine geschlossenen Protokolle gefunden."
                )
          ),
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              },
            },
            React.createElement(
              "button",
              {
                type: "button",
                onClick: () => props.onCancel(),
                style: {
                  border: "1px solid #d7dde5",
                  background: "#ffffff",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  cursor: "pointer",
                },
              },
              "Abbrechen"
            ),
            React.createElement(
              "button",
              {
                type: "button",
                disabled: !activeItem,
                onClick: () => activeItem && props.onConfirm(activeItem),
                style: {
                  border: "1px solid #2563eb",
                  background: activeItem ? "#2563eb" : "#94a3b8",
                  color: "#ffffff",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  cursor: activeItem ? "pointer" : "default",
                },
              },
              getPrimaryLabel(props.mode)
            )
          )
        )
      );
    }

    const element = React.createElement(ClosedProtocolSelector, {
      mode,
      items,
      selectedId,
      searchEnabled,
      onCancel: () => cleanup(null),
      onConfirm: (item) => handleConfirm(item).catch(() => cleanup(null)),
    });

    if (root) root.render(element);
    else ReactDOM.render(element, host);
  });
}
