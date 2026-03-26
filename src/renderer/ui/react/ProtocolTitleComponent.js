export function createProtocolTitleComponent(React) {
  return function ProtocolTitleComponent({ model }) {
    const lines = Array.isArray(model?.lines) ? model.lines : [];

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "div",
        {
          style: {
            color: "#000",
            fontWeight: "600",
            fontSize: "10pt",
          },
        },
        model?.label || "Protokoll"
      ),
      ...lines.map((line, index) =>
        React.createElement(
          "div",
          {
            key: `${index}:${line?.text || ""}`,
            style: {
              color: line?.color || "#000",
              fontWeight: line?.fontWeight || "600",
              fontSize: line?.fontSize || "10pt",
            },
          },
          line?.text || ""
        )
      )
    );
  };
}
