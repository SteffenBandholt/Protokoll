export function createTopsProtocolTitleDisplay(React) {
  return function TopsProtocolTitleDisplay({ label, line1, line2, isClosed }) {
    const titleLabel = label || "Protokoll";
    const firstLine = line1 || "";
    const secondLine = line2 || "";
    const color = isClosed ? "#b71c1c" : firstLine ? "#1b5e20" : "#000";

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "div",
        {
          style: {
            color,
            fontWeight: "600",
            fontSize: "10pt",
          },
        },
        titleLabel
      ),
      firstLine
        ? React.createElement(
            "div",
            {
              style: {
                color,
                fontWeight: "700",
                fontSize: "10pt",
              },
            },
            firstLine
          )
        : null,
      secondLine
        ? React.createElement(
            "div",
            {
              style: {
                color,
                fontWeight: "700",
                fontSize: "10pt",
              },
            },
            secondLine
          )
        : null
    );
  };
}
