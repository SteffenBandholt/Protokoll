export function createTopsEditorComponent(React) {
  return function TopsEditorComponent({
    top,
    hasSelection,
    title,
    longtext,
    dueValue,
    statusValue,
    responsibleValue,
    checkboxState,
    metaVisible,
    disabledState,
    readOnly,
    busy,
    onSave,
    onChange,
  }) {
    const { useState, useEffect } = React;

    const handleSave = () => {
      if (typeof onSave === "function") onSave();
    };

    const handleChange = () => {
      if (typeof onChange === "function") onChange();
    };

    const handleTitleChange = (event) => {
      if (typeof onChange === "function") onChange(event.target.value);
    };

    const currentStatus =
      typeof statusValue === "string" ? statusValue.trim() : statusValue ? String(statusValue).trim() : "";
    const [statusLocal, setStatusLocal] = useState(currentStatus);

    useEffect(() => {
      setStatusLocal(currentStatus);
    }, [currentStatus]);

    const baseOptions = ["", "offen", "in Bearbeitung", "erledigt"];
    const options =
      statusLocal && !baseOptions.includes(statusLocal)
        ? ["", statusLocal, "offen", "in Bearbeitung", "erledigt"]
        : baseOptions;

    const handleStatusChange = (event) => {
      const next = event.target.value;
      setStatusLocal(next);
      if (typeof onChange === "function") onChange(next);
    };

    return React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          padding: "8px",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "6px",
          background: "#f9fafb",
          fontSize: "11px",
          color: "#111",
          opacity: busy ? 0.75 : 1,
        },
      },
      React.createElement(
        "div",
        { style: { fontWeight: 700, fontSize: "12px" } },
        "React Editor vorbereitet"
      ),
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "2px" } },
        React.createElement("div", null, `Auswahl: ${hasSelection ? "ja" : "nein"}`),
        React.createElement("div", null, `ReadOnly: ${readOnly ? "ja" : "nein"}`),
        React.createElement("div", null, `Busy: ${busy ? "ja" : "nein"}`),
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "2px" } },
          React.createElement("div", { style: { fontWeight: 600 } }, "Titel"),
          React.createElement("input", {
            type: "text",
            value: title || "",
            onChange: handleTitleChange,
            disabled: disabledState?.readOnly || disabledState?.busy || readOnly || busy,
            placeholder: "(leer)",
            style: {
              minHeight: "24px",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: "4px",
              padding: "4px 6px",
              background: "#fff",
              color: "#111",
              fontSize: "11px",
              width: "100%",
              boxSizing: "border-box",
            },
          })
        ),
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "2px" } },
          React.createElement("div", { style: { fontWeight: 600 } }, "Status"),
          React.createElement(
            "select",
            {
              value: statusLocal,
              onChange: handleStatusChange,
              disabled: disabledState?.readOnly || disabledState?.busy || readOnly || busy,
              style: {
                minHeight: "26px",
                border: "1px solid rgba(0,0,0,0.15)",
                borderRadius: "4px",
                padding: "4px 6px",
                background: "#fff",
                color: "#111",
                fontSize: "11px",
                width: "100%",
                boxSizing: "border-box",
              },
            },
            ...options.map((opt) =>
              React.createElement(
                "option",
                { key: opt || "(leer)", value: opt },
                opt || "(leer)"
              )
            )
          )
        ),
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "2px" } },
          React.createElement("div", { style: { fontWeight: 600 } }, "Langtext"),
          React.createElement("div", {
            style: {
              minHeight: "48px",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: "4px",
              padding: "6px",
              background: "#fff",
              color: "#111",
              fontSize: "11px",
              lineHeight: "1.35",
              whiteSpace: "pre-wrap",
              overflow: "hidden",
            },
            title: (longtext || "").slice(0, 120),
            children: `${(longtext || "").slice(0, 120)}${(longtext || "").length > 120 ? "..." : ""}`,
          })
        )
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px", marginTop: "4px" } },
        React.createElement(
          "button",
          {
            type: "button",
            disabled: disabledState?.readOnly || disabledState?.busy || busy || readOnly || !hasSelection,
            onClick: handleSave,
            onMouseDown: handleChange,
          },
          "Speichern"
        )
      )
    );
  };
}

