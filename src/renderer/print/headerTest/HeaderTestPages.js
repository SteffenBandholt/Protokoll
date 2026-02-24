import { renderV2GlobalHeader } from "../v2/header/GlobalHeader.js";
import { renderV2FullHeader } from "../v2/header/FullHeader.js";
import { renderV2MiniHeader } from "../v2/header/MiniHeader.js";
import { V2_LAYOUT } from "../v2/v2LayoutConfig.js";
import { runHeaderTestChecks } from "./devHeaderTestCheck.js";
import { headerTestConfig } from "./headerTestConfig.js";

let _headerTestChecksRun = false;

function _el(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function _normalizeTopNumber(top) {
  return (
    top.topNumberText ??
    top.top_nr ??
    top.displayNumber ??
    top.topNr ??
    top.topNo ??
    top.number ??
    top.nr ??
    ""
  );
}

function _buildRows(data) {
  const rows = [];
  const tops = Array.isArray(data?.tops) ? data.tops : [];
  const realCount = Math.min(6, tops.length);

  for (let i = 0; i < realCount; i++) {
    const t = tops[i] || {};
    rows.push({
      no: String(_normalizeTopNumber(t) || i + 1),
      text: String(t.title || "(ohne Bezeichnung)").trim(),
      meta: String(t.status || "").trim() || "TOP",
    });
  }

  const minRows = 32;
  for (let i = rows.length; i < minRows; i++) {
    rows.push({
      no: String(i + 1),
      text: "Testzeile " + (i + 1) + " - Demo-Content fuer Kopf-Test",
      meta: "Demo",
    });
  }

  return rows;
}

function _splitPages(rows, perPage, { firstVariant } = {}) {
  const pages = [];
  let offset = 0;
  let pageIndex = 0;

  while (offset < rows.length) {
    const isFirst = pageIndex === 0 && firstVariant === "full";
    const take = isFirst ? perPage.full : perPage.mini;
    pages.push({
      variant: isFirst ? "full" : "mini",
      rows: rows.slice(offset, offset + take),
    });
    offset += take;
    pageIndex += 1;
  }

  return pages;
}

function _buildRowElement(row) {
  const el = _el("div", "ht-row");
  el.appendChild(_el("div", "ht-row-no", row.no || ""));
  el.appendChild(_el("div", "ht-row-text", row.text || ""));
  el.appendChild(_el("div", "ht-row-meta", row.meta || ""));
  return el;
}

export function renderHeaderTestPages({ data, debug } = {}) {
  const root = _el("div", "printRoot headerTestRoot printV2Root");
  const pagePadTopMm = Number(data?.v2Layout?.pagePadTopMm);
  const pagePadBottomMm = Number(data?.v2Layout?.pagePadBottomMm);
  const pagePadLeftMm = Number(data?.v2Layout?.pagePadLeftMm);
  const pagePadRightMm = Number(data?.v2Layout?.pagePadRightMm);
  const globalLogoBoxHeightMm = Number(data?.v2Layout?.globalLogoBoxHeightMm);
  const globalHeaderHeightMm = Number(data?.v2Layout?.globalHeaderHeightMm);

  // V2 CSS vars (scoped via .printV2Root)
  root.style.setProperty("--v2-pad-top", String(Number.isFinite(pagePadTopMm) ? pagePadTopMm : V2_LAYOUT.page.padTopMm) + "mm");
  root.style.setProperty("--v2-pad-x", String(V2_LAYOUT.page.padXmm) + "mm");
  root.style.setProperty("--v2-pad-left", String(Number.isFinite(pagePadLeftMm) ? pagePadLeftMm : V2_LAYOUT.page.padXmm) + "mm");
  root.style.setProperty("--v2-pad-right", String(Number.isFinite(pagePadRightMm) ? pagePadRightMm : V2_LAYOUT.page.padXmm) + "mm");
  root.style.setProperty("--v2-pad-bottom", String(Number.isFinite(pagePadBottomMm) ? pagePadBottomMm : V2_LAYOUT.page.padBottomMm) + "mm");
  root.style.setProperty("--v2-global-logo-box", String(V2_LAYOUT.global.logoBoxMm) + "mm");
  root.style.setProperty(
    "--v2-global-logo-box-w",
    String(V2_LAYOUT.global.logoBoxWidthMm || V2_LAYOUT.global.logoBoxMm) + "mm"
  );
  root.style.setProperty(
    "--v2-global-logo-box-h",
    String(
      Number.isFinite(globalLogoBoxHeightMm)
        ? globalLogoBoxHeightMm
        : (V2_LAYOUT.global.logoBoxHeightMm || V2_LAYOUT.global.logoBoxMm)
    ) + "mm"
  );
  root.style.setProperty(
    "--v2-global-height",
    String(Number.isFinite(globalHeaderHeightMm) ? globalHeaderHeightMm : (V2_LAYOUT.global.heightMm || 50)) + "mm"
  );
  root.style.setProperty("--v2-logo-gap", String(V2_LAYOUT.global.logoGapMm) + "mm");
  root.style.setProperty("--v2-global-gap-logo-line", String(V2_LAYOUT.global.gapLogoToLineMm) + "mm");
  root.style.setProperty("--v2-full-height", String(V2_LAYOUT.full.heightMm) + "mm");
  root.style.setProperty("--v2-full-gap-line1-project", String(V2_LAYOUT.full.gapLine1ToProjectMm) + "mm");
  root.style.setProperty("--v2-full-gap-project-protocol", String(V2_LAYOUT.full.gapProjectToProtocolMm) + "mm");
  root.style.setProperty("--v2-full-project-font", String(V2_LAYOUT.full.projectFontPt) + "pt");
  root.style.setProperty("--v2-full-protocol-font", String(V2_LAYOUT.full.protocolFontPt) + "pt");
  root.style.setProperty("--v2-full-gap-project-line", String(V2_LAYOUT.full.gapProjectToLineMm) + "mm");
  root.style.setProperty("--v2-full-gap-line-body", String(V2_LAYOUT.full.gapLineToBodyMm) + "mm");
  root.style.setProperty("--v2-mini-protocol-font", String(V2_LAYOUT.mini.protocolFontPt) + "pt");
  root.style.setProperty("--v2-mini-gap-text-line", String(V2_LAYOUT.mini.gapTextToLineMm) + "mm");
  root.style.setProperty("--v2-mini-gap-line-body", String(V2_LAYOUT.mini.gapLineToBodyMm) + "mm");
  root.style.setProperty("--v2-line-thickness", String(V2_LAYOUT.global.lineThicknessPx) + "px");

  const rows = _buildRows(data);
  const perPage = { full: 16, mini: 22 };
  const pages = _splitPages(rows, perPage, { firstVariant: "full" });

  // ensure we always have a page 2+ so mini header is validated in debug
  if (pages.length < 2) {
    pages.push({ variant: "mini", rows: rows.slice(0, perPage.mini) });
  }

  const totalPages = pages.length;
  const modeLabel = String(headerTestConfig?.modeLabel || "Kopf-Test").trim() || "Kopf-Test";

  pages.forEach((page, idx) => {
    const pageNo = idx + 1;
    const pageEl = _el("div", "page headerTestPage");
    pageEl.setAttribute("data-ht-page", String(pageNo));

    if (pageNo === 1) {
      pageEl.appendChild(renderV2GlobalHeader({ data }));
      pageEl.appendChild(renderV2FullHeader({ data, pageNo, totalPages, modeLabel }));
      // gap AFTER line2 (outside of the 40mm block)
      pageEl.appendChild(_el("div", "v2FullGapLineBody"));
    } else {
      pageEl.appendChild(renderV2MiniHeader({ data, pageNo, totalPages, modeLabel }));
    }

    const body = _el("div", "ht-body");
    const list = _el("div", "ht-list");
    list.setAttribute("data-ht", "listStart");
    page.rows.forEach((row) => list.appendChild(_buildRowElement(row)));
    body.appendChild(list);

    pageEl.appendChild(body);
    root.appendChild(pageEl);
  });

  if (!_headerTestChecksRun) {
    _headerTestChecksRun = true;
    runHeaderTestChecks({ debug: !!debug, cfg: V2_LAYOUT });
  }

  return root;
}
