export function renderTopTitleRow({ text, color, fontSize }) {
  const shortLine = document.createElement("div");
  shortLine.textContent = text;
  shortLine.style.color = color;
  shortLine.style.fontSize = fontSize;
  shortLine.style.whiteSpace = "nowrap";
  shortLine.style.overflow = "hidden";
  shortLine.style.textOverflow = "ellipsis";
  return shortLine;
}
