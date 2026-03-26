export function createTopsIdlePanelComponent(React) {
  return function TopsIdlePanelComponent({ hasProtocols, busy, imageSrc, imageAlt, onCreateMeeting }) {
    const disabled = !!busy;

    return React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          maxWidth: "520px",
          width: "100%",
          opacity: "0.95",
        },
      },
      imageSrc
        ? React.createElement("img", {
            src: imageSrc,
            alt: imageAlt || "Idle-Hinweis",
            style: {
              width: "220px",
              maxWidth: "70%",
              height: "auto",
              objectFit: "contain",
            },
          })
        : null,
      React.createElement(
        "button",
        {
          type: "button",
          disabled,
          title: hasProtocols ? "Neues Protokoll anlegen" : "Erstes Protokoll anlegen",
          onClick: () => {
            if (disabled || typeof onCreateMeeting !== "function") return;
            onCreateMeeting();
          },
          onMouseEnter: (e) => {
            if (disabled) return;
            e.currentTarget.style.borderBottomColor = "#ff8c00";
          },
          onMouseLeave: (e) => {
            e.currentTarget.style.borderBottomColor = "currentColor";
          },
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            color: "#111827",
            padding: "0 2px 2px",
            margin: "0",
            minHeight: "0",
            lineHeight: "1.25",
            fontSize: "14px",
            fontWeight: "700",
            borderRadius: "0",
            borderBottom: "2px solid currentColor",
            borderBottomColor: "currentColor",
            cursor: disabled ? "default" : "pointer",
            whiteSpace: "nowrap",
          },
        },
        "Protokoll neu"
      )
    );
  };
}
