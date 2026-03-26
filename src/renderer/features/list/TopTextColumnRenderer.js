import { renderTopLongtextPreview } from "./TopLongtextPreviewRenderer.js";
import { renderTopTitleRow } from "./TopTitleRowRenderer.js";

export function renderTopTextColumn({
  titleText,
  titleColor,
  titleFontSize,
  showLongtextInList,
  longtext,
  longtextDisplayText,
  longtextFontSizePx,
  longtextColor,
}) {
  const textCol = document.createElement("div");
  textCol.style.display = "flex";
  textCol.style.flexDirection = "column";
  textCol.style.gap = "4px";
  textCol.style.flex = "1 1 auto";
  textCol.style.minWidth = "0";

  textCol.append(
    renderTopTitleRow({
      text: titleText,
      color: titleColor,
      fontSize: titleFontSize,
    })
  );

  const longPreview = renderTopLongtextPreview({
    showLongtextInList,
    text: longtext,
    displayText: longtextDisplayText,
    fontSizePx: longtextFontSizePx,
    color: longtextColor,
  });
  if (longPreview) textCol.append(longPreview);

  return textCol;
}
