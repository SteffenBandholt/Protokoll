import { renderHeaderTestHeader } from "./HeaderTestHeader.js";
import { renderGlobalHeader } from "./GlobalHeader.js";
import { HEADERTEST_LAYOUT } from "./headerTestLayoutConfig.js";
import { runHeaderTestChecks } from "./devHeaderTestCheck.js";

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
      text: `Testzeile ${i + 1} - Demo-Content fuer Kopf-Test`,
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
  const root = _el("div", "printRoot headerTestRoot");
  root.style.setProperty("--ht-pad-top", `${HEADERTEST_LAYOUT.page.padTopMm}mm`);
  root.style.setProperty("--ht-pad-x", `${HEADERTEST_LAYOUT.page.padXmm}mm`);
  root.style.setProperty("--ht-pad-bottom", `${HEADERTEST_LAYOUT.page.padBottomMm}mm`);
  root.style.setProperty("--ht-global-logo-box", `${HEADERTEST_LAYOUT.global.logoBoxMm}mm`);
  root.style.setProperty("--ht-logo-gap", `${HEADERTEST_LAYOUT.global.logoGapMm}mm`);
  root.style.setProperty(
    "--ht-global-gap-logo-line",
    `${HEADERTEST_LAYOUT.global.gapLogoToLineMm}mm`
  );
  root.style.setProperty("--ht-full-height", `${HEADERTEST_LAYOUT.full.heightMm}mm`);
  root.style.setProperty(
    "--ht-full-gap-project-line",
    `${HEADERTEST_LAYOUT.full.gapProjectToLineMm}mm`
  );
  root.style.setProperty(
    "--ht-full-gap-line-list",
    `${HEADERTEST_LAYOUT.full.gapLineToListMm}mm`
  );
  root.style.setProperty(
    "--ht-mini-gap-text-line",
    `${HEADERTEST_LAYOUT.mini.gapTextToLineMm}mm`
  );
  root.style.setProperty(
    "--ht-mini-gap-line-list",
    `${HEADERTEST_LAYOUT.mini.gapLineToListMm}mm`
  );
  root.style.setProperty("--ht-line-thickness", `${HEADERTEST_LAYOUT.global.lineThicknessPx}px`);

  const rows = _buildRows(data);
  const perPage = { full: 16, mini: 22 };
  const pages = _splitPages(rows, perPage, { firstVariant: "full" });

  if (pages.length < 2) {
    pages.push({ variant: "mini", rows: rows.slice(0, perPage.mini) });
  }

  const totalPages = pages.length;

  pages.forEach((page, idx) => {
    const pageNo = idx + 1;
    const pageEl = _el("div", "page headerTestPage");
    pageEl.setAttribute("data-ht-page", String(pageNo));

    if (pageNo === 1) {
      pageEl.appendChild(renderGlobalHeader({ data }));
      pageEl.appendChild(
        renderHeaderTestHeader({
          variant: "full",
          data,
          pageNo,
          totalPages,
        })
      );
      pageEl.appendChild(_el("div", "htFullGapLineList"));
    } else {
      pageEl.appendChild(
        renderHeaderTestHeader({
          variant: "mini",
          data,
          pageNo,
          totalPages,
        })
      );
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
    runHeaderTestChecks({ debug: !!debug, cfg: HEADERTEST_LAYOUT });
  }

  return root;
}
