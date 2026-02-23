import { V2_LAYOUT } from "../v2LayoutConfig.js";
import { headerUtils } from "./headerUtils.js";

function _buildLogoBox(logo, index) {
  const box = headerUtils.el("div", "v2LogoBox");
  const dataUrl = String(logo?.dataUrl || "").trim();
  if (dataUrl) {
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = Logo ;
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

  for (let i = 0; i < maxLogos; i++) {
    logoRow.appendChild(_buildLogoBox(logos[i], i));
  }

  const line1 = headerUtils.el("div", "v2Divider v2GlobalLine");
  line1.setAttribute("data-v2", "line1");

  header.append(logoRow, headerUtils.el("div", "v2GlobalGapLogoLine"), line1);
  wrap.appendChild(header);
  return wrap;
}