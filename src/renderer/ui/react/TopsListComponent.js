export function createTopsListComponent(React) {
  return function TopsListComponent({
    items,
    onSelectTop,
    onToggleCollapse,
    onMoveTarget,
    onCreateFirstTop,
    emptyState,
  }) {
    const listItems = Array.isArray(items) ? items : [];

    if (listItems.length === 0 && emptyState) {
      return React.createElement(
        "li",
        { style: { listStyle: "none" } },
        React.createElement(
          "div",
          { style: emptyState.wrapperStyle || {} },
          emptyState.imageSrc
            ? React.createElement("img", {
                src: emptyState.imageSrc,
                alt: emptyState.imageAlt || "Hinweis erstes Level 1",
                style: emptyState.imageStyle || {},
              })
            : null,
          React.createElement(
            "div",
            { style: emptyState.hintStyle || {} },
            React.createElement("span", null, emptyState.prefixText || "Mit Button"),
            React.createElement(
              "button",
              {
                type: "button",
                disabled: !!emptyState.disabled,
                onClick: () => {
                  if (emptyState.disabled || typeof onCreateFirstTop !== "function") return;
                  onCreateFirstTop();
                },
                onMouseEnter: (e) => {
                  if (emptyState.disabled) return;
                  e.currentTarget.style.borderBottomColor = "#ff8c00";
                },
                onMouseLeave: (e) => {
                  e.currentTarget.style.borderBottomColor = "currentColor";
                },
                style: emptyState.buttonStyle || {},
              },
              emptyState.buttonText || "+Titel"
            ),
            React.createElement("span", null, emptyState.suffixText || "den ersten Titel anlegen")
          )
        )
      );
    }

    return React.createElement(
      React.Fragment,
      null,
      ...listItems.map((item) =>
        React.createElement(
          "li",
          {
            key: String(item.id),
            "data-top-id": String(item.id),
            onClick: async () => {
              if (item.isMoveTarget) {
                if (typeof onMoveTarget === "function") await onMoveTarget(item.id);
                return;
              }
              if (typeof onSelectTop === "function") await onSelectTop(item.id);
            },
            style: item.rowStyle || {},
          },
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              },
            },
            React.createElement(
              "div",
              { style: item.numberColumn?.style || {} },
              item.toggle
                ? React.createElement(
                    "button",
                    {
                      type: "button",
                      title: item.toggle.title,
                      onClick: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof onToggleCollapse === "function") onToggleCollapse(item.id);
                      },
                      style: item.toggle.buttonStyle || {},
                    },
                    item.toggle.text
                  )
                : null,
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    lineHeight: "1.05",
                  },
                },
                React.createElement("span", null, item.numberText),
                item.changeHint
                  ? React.createElement(
                      "span",
                      {
                        style: {
                          fontSize: "7pt",
                          opacity: "0.85",
                          color: "#000000",
                          lineHeight: "1.1",
                          whiteSpace: "pre",
                        },
                      },
                      item.changeHint
                    )
                  : null,
                item.star
                  ? React.createElement(
                      "span",
                      {
                        title: item.star.title,
                        "aria-label": item.star.title,
                        style: {
                          color: "#fbc02d",
                          fontSize: item.star.fontSize,
                          lineHeight: "1",
                          marginLeft: "0px",
                        },
                      },
                      item.star.text
                    )
                  : null
              )
            ),
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  flex: "1 1 auto",
                  minWidth: "0",
                },
              },
              React.createElement(
                "div",
                { style: item.title.style || {} },
                item.title.text
              ),
              item.longtext?.show
                ? React.createElement(
                    "div",
                    {
                      title: item.longtext.text,
                      style: item.longtext.style || {},
                    },
                    item.longtext.displayText
                  )
                : null
            ),
            item.meta
              ? React.createElement(
                  "div",
                  { style: item.meta.containerStyle || {} },
                  React.createElement(
                    "div",
                    { style: item.meta.dueRowStyle || {} },
                    React.createElement(
                      "span",
                      { style: item.meta.textStyle || {} },
                      item.meta.due
                    ),
                    item.meta.ampelColor
                      ? React.createElement("span", {
                          title: item.meta.ampelColor,
                          style: {
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: item.meta.ampelColor,
                            display: "inline-block",
                            flex: "0 0 10px",
                          },
                        })
                      : null
                  ),
                  React.createElement(
                    "div",
                    { style: item.meta.statusRowStyle || {} },
                    React.createElement(
                      "span",
                      { style: item.meta.textStyle || {} },
                      item.meta.status
                    ),
                    ...(Array.isArray(item.meta.icons)
                      ? item.meta.icons.map((icon) =>
                          React.createElement("img", {
                            key: `${icon.alt || ""}:${icon.title || ""}`,
                            src: icon.src,
                            alt: icon.alt || "",
                            title: icon.title || "",
                            style: icon.style || {
                              width: "14px",
                              height: "14px",
                              flex: "0 0 14px",
                              objectFit: "contain",
                            },
                          })
                        )
                      : [])
                  ),
                  React.createElement(
                    "div",
                    { style: item.meta.responsibleStyle || {} },
                    item.meta.responsible
                  )
                )
              : null
          )
        )
      )
    );
  };
}
