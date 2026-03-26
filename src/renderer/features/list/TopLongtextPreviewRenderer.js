export function renderTopLongtextPreview({
  showLongtextInList,
  text,
  displayText,
  fontSizePx,
  color,
}) {
  if (!showLongtextInList || !text) return null;

  const longDiv = document.createElement("div");
  longDiv.textContent = displayText;
  longDiv.style.fontSize = `${fontSizePx}px`;
  longDiv.style.opacity = "0.85";
  longDiv.style.whiteSpace = "pre-wrap";
  longDiv.style.color = color;
  return longDiv;
}
