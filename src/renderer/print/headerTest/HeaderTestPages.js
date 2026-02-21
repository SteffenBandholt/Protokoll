import { headerTestConfig } from "./headerTestConfig.js";
import { renderHeaderTestHeader } from "./HeaderTestHeader.js";

function _el(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function _buildStyle() {
  const style = document.createElement("style");
  style.textContent = `
    .headerTestRoot .ht-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8mm;
      padding-bottom: 2mm;
    }

    .headerTestRoot .ht-header.full .ht-project {
      font-size: 14pt;
      font-weight: 700;
    }

    .headerTestRoot .ht-header.full .ht-meeting {
      font-size: 11pt;
      font-weight: 600;
      margin-top: 1mm;
    }

    .headerTestRoot .ht-header.mini .ht-project {
      font-size: 10pt;
      font-weight: 600;
    }

    .headerTestRoot .ht-header.mini .ht-meeting {
      font-size: 9pt;
      font-weight: 500;
      margin-top: 0.5mm;
    }

    .headerTestRoot .ht-meta {
      margin-top: 1mm;
      font-size: 8.5pt;
      color: #555;
    }

    .headerTestRoot .ht-header-right {
      text-align: right;
      white-space: nowrap;
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
      align-items: flex-end;
    }

    .headerTestRoot .ht-page {
      font-size: 8pt;
      color: #333;
    }

    .headerTestRoot .ht-mode {
      font-size: 8pt;
      border: 1px solid #000;
      padding: 0.6mm 1.6mm;
      border-radius: 3mm;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }

    .headerTestRoot .ht-title {
      font-size: 8.5pt;
      color: #444;
    }

    .headerTestRoot .ht-header-line {
      border-bottom: 1px solid #000;
      margin: 1mm 0 4mm 0;
    }

    .headerTestRoot .ht-body-title {
      font-size: 10pt;
      font-weight: 700;
      margin-bottom: 2mm;
    }

    .headerTestRoot .ht-list {
      display: flex;
      flex-direction: column;
      gap: 1mm;
    }

    .headerTestRoot .ht-row {
      display: grid;
      grid-template-columns: 12mm 1fr 35mm;
      gap: 3mm;
      border-bottom: 1px dashed #ddd;
      padding-bottom: 1mm;
    }

    .headerTestRoot .ht-row-no {
      font-weight: 700;
    }

    .headerTestRoot .ht-row-text {
      font-size: 9.8pt;
    }

    .headerTestRoot .ht-row-meta {
      font-size: 8.5pt;
      color: #555;
      text-align: right;
    }
  `;
  return style;
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

  const minRows = 42;
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

export function renderHeaderTestPages({ data } = {}) {
  const root = _el("div", "printRoot headerTestRoot");
  root.appendChild(_buildStyle());

  const rows = _buildRows(data);
  const perPage = { full: 18, mini: 24 };
  const pages = _splitPages(rows, perPage, { firstVariant: "full" });

  if (pages.length < 2) {
    pages.push({ variant: "mini", rows: rows.slice(0, perPage.mini) });
  }

  const totalPages = pages.length;

  pages.forEach((page, idx) => {
    const pageEl = _el("div", "page headerTestPage");
    pageEl.appendChild(
      renderHeaderTestHeader({
        variant: page.variant,
        data,
        pageNo: idx + 1,
        totalPages,
      })
    );
    pageEl.appendChild(_el("div", "ht-header-line"));

    const body = _el("div", "ht-body");
    const title = page.variant === "full" ? "Full-Header Demo" : "Mini-Header Demo";
    body.appendChild(_el("div", "ht-body-title", title));

    const list = _el("div", "ht-list");
    page.rows.forEach((row) => list.appendChild(_buildRowElement(row)));
    body.appendChild(list);

    pageEl.appendChild(body);
    root.appendChild(pageEl);
  });

  return root;
}
