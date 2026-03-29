export function createTopsIdleStateComponent(React) {
  return function TopsIdleStateComponent({ hasProtocols, busy, onCreateMeeting }) {
    const text = hasProtocols ? "kein Protokoll aktiv" : "kein Protokoll vorhanden";
    const disabled = !!busy;

    return React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          maxWidth: "520px",
          padding: "28px 12px",
          boxSizing: "border-box",
        },
      },
      React.createElement("div", { style: { fontSize: "18px", fontWeight: 700 } }, "Protokoll"),
      React.createElement("div", { style: { fontSize: "14px" } }, text),
      React.createElement(
        "button",
        {
          type: "button",
          disabled,
          onClick: () => {
            if (disabled || typeof onCreateMeeting !== "function") return;
            onCreateMeeting();
          },
        },
        "Protokoll neu"
      )
    );
  };
}
