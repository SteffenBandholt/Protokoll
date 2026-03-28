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
    onStatusChange,
    onDueDateChange,
    onTitleChange,
    onLongtextChange,
  }) {
    const { useState, useEffect } = React;

    const handleSave = () => {
      if (typeof onSave === "function") onSave();
    };

    const handleChange = () => {
      if (typeof onChange === "function") onChange();
    };

    const currentStatus =
      typeof statusValue === "string" ? statusValue.trim() : statusValue ? String(statusValue).trim() : "";
    const [statusLocal, setStatusLocal] = useState(currentStatus);
    const [titleLocal, setTitleLocal] = useState(title || "");
    const [longtextLocal, setLongtextLocal] = useState(longtext || "");
    const [dueLocal, setDueLocal] = useState(dueValue || "");
    useEffect(() => {
      setLongtextLocal(longtext || "");
    }, [longtext]);

    useEffect(() => {
      setStatusLocal(currentStatus);
    }, [currentStatus]);

    useEffect(() => {
      setTitleLocal(title || "");
    }, [title]);

    useEffect(() => {
      setDueLocal(dueValue || "");
    }, [dueValue]);

    const handleLongtextChange = (event) => {
      const next = event.target.value;
      setLongtextLocal(next);
      if (typeof onLongtextChange === "function") onLongtextChange(next);
      if (typeof onChange === "function") onChange(next);
    };

    const handleTitleChange = (event) => {
      const next = event.target.value;
      setTitleLocal(next);
      if (typeof onTitleChange === "function") onTitleChange(next);
      if (typeof onChange === "function") onChange(next);
    };

    const baseOptions = ["", "offen", "in Bearbeitung", "erledigt"];
    const options =
      statusLocal && !baseOptions.includes(statusLocal)
        ? ["", statusLocal, "offen", "in Bearbeitung", "erledigt"]
        : baseOptions;

    const handleStatusChange = (event) => {
      const next = event.target.value;
      setStatusLocal(next);
      if (typeof onStatusChange === "function") onStatusChange(next);
      if (typeof onChange === "function") onChange(next);
    };

    const handleDueChange = (event) => {
      const next = event.target.value;
      setDueLocal(next);
      if (typeof onDueDateChange === "function") onDueDateChange(next);
    };

    const responsibleDisplay =
      typeof responsibleValue === "string" && responsibleValue.trim()
        ? responsibleValue.trim()
        : "(keine Angabe)";

    return React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "10px",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "6px",
          background: "#f9fafb",
          fontSize: "11px",
          color: "#111",
          opacity: busy ? 0.75 : 1,
        },
      },
      React.createElement("div", { style: { fontWeight: 700, fontSize: "12px" } }, "React Editor vorbereitet"),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "8px",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: "5px",
          },
        },
        React.createElement("div", null, `Auswahl: ${hasSelection ? "ja" : "nein"}`),
        React.createElement("div", null, `ReadOnly: ${readOnly ? "ja" : "nein"}`),
        React.createElement("div", null, `Busy: ${busy ? "ja" : "nein"}`)
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "8px",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: "5px",
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "3px" } },
          React.createElement("div", { style: { fontWeight: 600 } }, "Titel"),
          React.createElement("input", {
            type: "text",
            value: titleLocal,
            onChange: handleTitleChange,
            disabled: disabledState?.readOnly || disabledState?.busy || readOnly || busy,
            placeholder: "(leer)",
            style: {
              minHeight: "24px",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: "4px",
              padding: "6px 8px",
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
          { style: { display: "flex", flexDirection: "column", gap: "3px" } },
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
                padding: "6px 8px",
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
        )
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: "8px",
            padding: "8px",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: "5px",
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "3px", flex: 1 } },
          React.createElement("div", { style: { fontWeight: 600 } }, "Fälligkeit"),
          React.createElement("input", {
            type: "text",
            value: dueLocal,
            onChange: handleDueChange,
            disabled: disabledState?.readOnly || disabledState?.busy || readOnly || busy,
            placeholder: "(leer)",
            style: {
              minHeight: "24px",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: "4px",
              padding: "6px 8px",
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
          { style: { display: "flex", flexDirection: "column", gap: "3px", flex: 1 } },
          React.createElement("div", { style: { fontWeight: 600 } }, "Verantwortlich"),
          React.createElement(
            "div",
            {
              style: {
                minHeight: "24px",
                border: "1px solid rgba(0,0,0,0.15)",
                borderRadius: "4px",
                padding: "6px 8px",
                background: "#f5f6f8",
                color: "#111",
                fontSize: "11px",
                width: "100%",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
              },
            },
            responsibleDisplay
          )
        )
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "8px",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: "5px",
          },
        },
        React.createElement("div", { style: { fontWeight: 600 } }, "Langtext"),
        React.createElement("textarea", {
          value: longtextLocal,
          onChange: handleLongtextChange,
          disabled: disabledState?.readOnly || disabledState?.busy || readOnly || busy,
          placeholder: "(leer)",
          rows: 4,
          style: {
            minHeight: "60px",
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: "4px",
            padding: "8px",
            background: "#fff",
            color: "#111",
            fontSize: "11px",
            lineHeight: "1.4",
            width: "100%",
            boxSizing: "border-box",
            resize: "vertical",
          },
        })
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
