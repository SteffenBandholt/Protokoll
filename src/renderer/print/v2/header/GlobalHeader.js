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

function _normalizeLogoAlign(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "left" || s === "center" || s === "right") return s;
  return "center";
}

function _logoClassByAlign(align) {
  if (align === "left") return "v2LogoAlignLeft";
  if (align === "right") return "v2LogoAlignRight";
  return "v2LogoAlignCenter";
}

function _normalizeLogoVAlign(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "top" || s === "middle" || s === "bottom") return s;
  return "bottom";
}

function _logoClassByVAlign(vAlign) {
  if (vAlign === "top") return "v2LogoVAlignTop";
  if (vAlign === "middle") return "v2LogoVAlignMiddle";
  return "v2LogoVAlignBottom";
}

function _logoSizeMm(size) {
  const s = _normalizeLogoSize(size);
  if (s === "small") return 22;
  if (s === "large") return 45;
  return 30;
}

function _logoTopOffsetMm(size, vAlign) {
  const boxMm = 45;
  const logoMm = _logoSizeMm(size);
  const align = _normalizeLogoVAlign(vAlign);
  if (align === "top") return 0;
  if (align === "middle") return Math.max(0, (boxMm - logoMm) / 2);
  return Math.max(0, boxMm - logoMm);
}

function _logoMetrics(logo) {
  const enabled = !!logo?.enabled;
  const dataUrl = String(logo?.dataUrl || "").trim();
  if (!enabled || !dataUrl) return { active: false, sizeMm: 0, topOffsetMm: 0, bottomMm: 0 };
  const sizeMm = _logoSizeMm(logo?.size);
  const topOffsetMm = _logoTopOffsetMm(logo?.size, logo?.vAlign);
  return {
    active: true,
    sizeMm,
    topOffsetMm,
    bottomMm: topOffsetMm + sizeMm,
  };
}

function _buildLogoBox(logo, labelNo, { adaptive = false, maxBottomMm = 45, metric = null, showPlaceholderText = true } = {}) {
  const box = headerUtils.el("div", "v2LogoBox");
  box.classList.add(_logoClassBySize(_normalizeLogoSize(logo?.size)));
  box.classList.add(_logoClassByAlign(_normalizeLogoAlign(logo?.align)));
  box.classList.add(_logoClassByVAlign(_normalizeLogoVAlign(logo?.vAlign)));
  if (adaptive) box.style.height = String(maxBottomMm) + "mm";
  const enabled = !!logo?.enabled;
  const dataUrl = String(logo?.dataUrl || "").trim();
  if (enabled && dataUrl) {
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "Logo " + String(labelNo || "");
    if (adaptive && metric?.active) {
      box.style.alignItems = "flex-start";
      box.style.paddingTop = String(metric.topOffsetMm) + "mm";
      img.style.maxHeight = String(metric.sizeMm) + "mm";
    }
    box.appendChild(img);
    return box;
  }

  const placeholder = headerUtils.el("div", "v2LogoPlaceholder");
  if (showPlaceholderText) {
    placeholder.textContent = "Logo optional - Einstellungen > Drucken > Logos";
  }
  box.appendChild(placeholder);
  return box;
}

export function renderV2GlobalHeader({ data } = {}) {
  const wrap = headerUtils.el("div", "v2GlobalHeaderBlock");
  const header = headerUtils.el("div", "v2GlobalHeader");
  const logoRow = headerUtils.el("div", "v2LogoRow");
  const adaptive = !!data?.v2Layout?.globalHeaderAdaptive;
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
  const metrics = ordered.map((logo) => _logoMetrics(logo));
  const anyLogoSelected = metrics.some((m) => !!m?.active);
  const maxBottomMm = anyLogoSelected
    ? metrics.reduce((max, m) => Math.max(max, Number(m?.bottomMm || 0)), 0)
    : 45;
  if (adaptive && anyLogoSelected) {
    const gapLogoToLineMm = Number(V2_LAYOUT?.global?.gapLogoToLineMm || 3);
    const lineReserveMm = Number(V2_LAYOUT?.global?.lineThicknessPx || 1) / 3.78;
    header.style.height = String(maxBottomMm + gapLogoToLineMm + Math.max(0.2, lineReserveMm)) + "mm";
  }

  for (let i = 0; i < maxLogos; i++) {
    logoRow.appendChild(
      _buildLogoBox(ordered[i], labelByPos[i], {
        adaptive: adaptive && anyLogoSelected,
        maxBottomMm,
        metric: metrics[i],
        showPlaceholderText: !anyLogoSelected,
      })
    );
  }

  const line1 = headerUtils.el("div", "v2Divider v2GlobalLine");
  line1.setAttribute("data-v2", "line1");

  header.append(logoRow, headerUtils.el("div", "v2GlobalGapLogoLine"), line1);
  wrap.appendChild(header);
  return wrap;
}
