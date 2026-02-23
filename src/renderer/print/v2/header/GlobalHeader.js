import { V2_LAYOUT } from "../v2LayoutConfig.js";
import { headerUtils } from "./headerUtils.js";

function _normalizeLogoSize(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "small" || s === "medium" || s === "large") return s;
  return "medium";
}

function _logoClassBySize(size) {
  if (size === "small") return "v2LogoSizeSmall";
  if (size === "large") return "v2LogoSizeLarge";
  return "v2LogoSizeMedium";
}

function _buildLogoBox(logo, labelNo) {
  const box = headerUtils.el("div", "v2LogoBox");
  box.classList.add(_logoClassBySize(_normalizeLogoSize(logo?.size)));
  const enabled = !!logo?.enabled;
  const dataUrl = String(logo?.dataUrl || "").trim();
  if (enabled && dataUrl) {
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "Logo " + String(labelNo || "");
    box.appendChild(img);
    return box;
  }

  const placeholder = headerUtils.el("div", "v2LogoPlaceholder", "Hier koennte Ihr Logo sein");
  box.appendChild(placeholder);
  return box;
}

export function renderV2GlobalHeader({ data } = {}) {
  const wrap = headerUtils.el("div", "v2GlobalHeaderBlock");
  const header = headerUtils.el("div", "v2GlobalHeader");
  const logoRow = headerUtils.el("div", "v2LogoRow");
  const logos = Array.isArray(data?.logos) ? data.logos : [];
  const maxLogos = Number(V2_LAYOUT?.global?.maxLogos || 3);
  const byKey = new Map();
  for (const logo of logos) {
    const key = String(logo?.key || "").trim();
    if (key) byKey.set(key, logo);
  }
  const ordered = [
    byKey.get("logo3") || logos[2] || null,
    byKey.get("logo2") || logos[1] || null,
    byKey.get("logo1") || logos[0] || null,
  ];
  const labelByPos = [3, 2, 1];

  for (let i = 0; i < maxLogos; i++) {
    logoRow.appendChild(_buildLogoBox(ordered[i], labelByPos[i]));
  }

  const line1 = headerUtils.el("div", "v2Divider v2GlobalLine");
  line1.setAttribute("data-v2", "line1");

  header.append(logoRow, headerUtils.el("div", "v2GlobalGapLogoLine"), line1);
  wrap.appendChild(header);
  return wrap;
}
