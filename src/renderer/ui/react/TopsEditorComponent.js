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

    const infoLine = hasSelection
      ? `TOP ${top?.displayNumber ?? top?.number ?? ""}`.trim()
      : "Kein TOP ausgewählt";

    return React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          padding: "8px",
          border: "1px dashed rgba(0,0,0,0.1)",
          borderRadius: "6px",
          background: "#fff",
          opacity: busy ? 0.65 : 1,
        },
      },
      React.createElement(
        "div",
        { style: { fontWeight: 700, fontSize: "12px" } },
        infoLine
      ),
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "4px" } },
        React.createElement("div", null, `Titel: ${title || ""}`),
        React.createElement("div", null, `Langtext: ${longtext ? longtext.slice(0, 80) : ""}`),
        React.createElement("div", null, `Fällig: ${dueValue || ""}`),
        React.createElement("div", null, `Status: ${statusValue || ""}`),
        React.createElement("div", null, `Verantwortlich: ${responsibleValue || ""}`),
        React.createElement(
          "div",
          null,
          `Checkboxen: hidden=${checkboxState?.hidden ? "1" : "0"}, important=${checkboxState?.important ? "1" : "0"}, task=${checkboxState?.task ? "1" : "0"}, decision=${checkboxState?.decision ? "1" : "0"}`
        ),
        React.createElement(
          "div",
          null,
          `Meta sichtbar: ${metaVisible ? "ja" : "nein"} | readOnly=${readOnly ? "ja" : "nein"} | busy=${busy ? "ja" : "nein"}`
        )
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px" } },
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
