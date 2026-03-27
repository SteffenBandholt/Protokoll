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
    const handleSave = () => {
      if (typeof onSave === "function") onSave();
    };

    const handleChange = () => {
      if (typeof onChange === "function") onChange();
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
        React.createElement("div", null, `Titel: ${title || "(leer)"}`),
        React.createElement("div", null, `Status: ${statusValue || "(leer)"}`)
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

