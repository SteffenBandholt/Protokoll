import { HEADERTEST_LAYOUT } from "./headerTestLayoutConfig.js";

function _el(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function _buildLogoBox(logo, index) {
  const box = _el("div", "logoBox");
  const dataUrl = String(logo?.dataUrl || "").trim();
  if (dataUrl) {
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = `Logo ${index + 1}`;
    box.appendChild(img);
    return box;
  }

  const placeholder = _el("div", "logoPlaceholder", "");
  box.appendChild(placeholder);
  return box;
}

export function renderGlobalHeader({ data } = {}) {
  const wrap = _el("div", "globalHeaderBlock");
  const header = _el("div", "globalHeader");
  const logoRow = _el("div", "logoRow");
  const logos = Array.isArray(data?.logos) ? data.logos : [];
  const maxLogos = Number(HEADERTEST_LAYOUT?.global?.maxLogos || 3);

  for (let i = 0; i < maxLogos; i++) {
    logoRow.appendChild(_buildLogoBox(logos[i], i));
  }

  const line1 = _el("div", "htDivider htGlobalLine");
  line1.setAttribute("data-ht", "line1");
  header.append(logoRow, _el("div", "htGlobalGapLogoLine"), line1);
  wrap.appendChild(header);
  return wrap;
}
