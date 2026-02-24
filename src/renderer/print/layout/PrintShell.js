import { renderV2GlobalHeader } from "../v2/header/GlobalHeader.js";
import { renderV2FullHeader } from "../v2/header/FullHeader.js";
import { renderV2MiniHeader } from "../v2/header/MiniHeader.js";
import { V2_LAYOUT } from "../v2/v2LayoutConfig.js";

function _el(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function _buildStarIcon() {
  const wrap = _el("div", "newStar");
  wrap.innerHTML = `
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <polygon
        points="50,7 61,36 92,36 66,54 76,84 50,66 24,84 34,54 8,36 39,36"
        fill="#fbc02d"
        stroke="#111"
        stroke-width="6"
      />
    </svg>
  `.trim();
  return wrap;
}

function _buildPageHeader({ projectLabel, docLabel, pageNo, totalPages }) {
  const header = _el("div", "pageHeader");
  const left = _el("div", "headerLeft", projectLabel || "Projekt: -");
  const right = _el(
    "div",
    "headerRight",
    `Dokumenttyp: ${docLabel || "-"} | Seite ${pageNo} / ${totalPages}`
  );
  header.append(left, right);
  return header;
}

function _buildTableHead(type) {
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  tr.className = "tableHeadRow";

  if (type === "tops") {
    tr.innerHTML = `
      <th class="colNr">TOP</th>
      <th class="colText">Gegenstand</th>
      <th class="colMeta">
        <div class="metaHead">
          <div>Status</div>
          <div>Fertig bis</div>
          <div>verantw</div>
        </div>
      </th>
    `;
  } else if (type === "firms") {
    tr.innerHTML = `<th>Firma</th><th>Typ</th><th>Aktiv</th>`;
  } else if (type === "todo") {
    tr.innerHTML = `<th>TOP</th><th>Text</th><th>Verantwortlich</th><th>Fällig</th>`;
  }

  thead.appendChild(tr);
  return thead;
}

function _buildTopRow(row) {
  if (row.level === 1) {
    const tr = document.createElement("tr");
    tr.className = "topRow lvl1Row";
    if (row.isNewTop) tr.classList.add("isNewTop");

    const td = document.createElement("td");
    td.colSpan = 3;
    td.className = "lvl1Cell";

    const wrap = _el("div", "lvl1Wrap");
    const numBox = _el("div", "nrBox");
    numBox.append(_el("div", "topNumber", row.numText), _el("div", "nrDate", row.createdDate));
    if (row.isNewTop) numBox.appendChild(_buildStarIcon());

    wrap.append(numBox, _el("div", "lvl1Text", row.title));
    td.appendChild(wrap);
    tr.appendChild(td);
    return tr;
  }

  const tr = document.createElement("tr");
  tr.className = "topRow";
  if (row.isNewTop) tr.classList.add("isNewTop");

  const tdNr = _el("td", "colNr");
  const numBox = _el("div", "nrBox");
  numBox.append(_el("div", "topNumber", row.numText), _el("div", "nrDate", row.createdDate));
  if (row.isNewTop) numBox.appendChild(_buildStarIcon());
  tdNr.appendChild(numBox);

  const tdText = _el("td", "colText");
  const txtBlock = _el("div", "txtBlock");
  txtBlock.appendChild(_el("div", "shortText", row.title));
  if (row.longtext) txtBlock.appendChild(_el("div", "longText", row.longtext));
  tdText.appendChild(txtBlock);

  const tdMeta = _el("td", "colMeta");
  const meta3 = _el("div", "meta3");
  const metaLine1 = _el("div", "metaLine meta1");
  metaLine1.appendChild(_el("span", "metaText", row.status));
  if (row.ampelColor) {
    const dot = _el("span", `ampelDot ${row.ampelColor}`);
    metaLine1.appendChild(dot);
  }
  meta3.appendChild(metaLine1);
  meta3.appendChild(_el("div", "metaLine meta2", row.due));
  meta3.appendChild(_el("div", "metaLine meta3", row.resp));
  tdMeta.appendChild(meta3);

  tr.append(tdNr, tdText, tdMeta);
  return tr;
}

function _buildGenericRow(row) {
  const tr = document.createElement("tr");
  for (const cell of row.cells) {
    tr.appendChild(_el("td", "", cell));
  }
  return tr;
}

function _buildColGroup(type) {
  if (type !== "tops") return null;
  const colgroup = document.createElement("colgroup");
  colgroup.innerHTML = `
    <col class="colNr" />
    <col class="colText" />
    <col class="colMeta" />
  `;
  return colgroup;
}


function _applyV2Vars(root) {
  root.style.setProperty("--v2-pad-top", String(V2_LAYOUT.page.padTopMm) + "mm");
  root.style.setProperty("--v2-pad-x", String(V2_LAYOUT.page.padXmm) + "mm");
  root.style.setProperty("--v2-pad-bottom", String(V2_LAYOUT.page.padBottomMm) + "mm");
  root.style.setProperty("--v2-global-logo-box", String(V2_LAYOUT.global.logoBoxMm) + "mm");
  root.style.setProperty(
    "--v2-global-logo-box-w",
    String(V2_LAYOUT.global.logoBoxWidthMm || V2_LAYOUT.global.logoBoxMm) + "mm"
  );
  root.style.setProperty(
    "--v2-global-logo-box-h",
    String(V2_LAYOUT.global.logoBoxHeightMm || V2_LAYOUT.global.logoBoxMm) + "mm"
  );
  root.style.setProperty("--v2-global-height", String(V2_LAYOUT.global.heightMm || 50) + "mm");
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
}

function _buildTable(page) {
  const table = document.createElement("table");
  const type = page.table?.type || "tops";

  if (type === "tops") table.className = "topsTable";
  else if (type === "firms") table.className = "firmsTable";
  else if (type === "todo") table.className = "todoTable";

  const colgroup = _buildColGroup(type);
  if (colgroup) table.appendChild(colgroup);

  table.appendChild(_buildTableHead(type));

  const tbody = document.createElement("tbody");
  for (const row of page.table?.rows || []) {
    if (type === "tops") tbody.appendChild(_buildTopRow(row));
    else tbody.appendChild(_buildGenericRow(row));
  }
  if (!(page.table?.rows || []).length) {
    const tr = document.createElement("tr");
    const td = _el("td", "", "Keine Einträge vorhanden.");
    td.colSpan = type === "todo" ? 4 : type === "firms" ? 3 : 3;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

export function renderPrint({ pages, data } = {}) {
  const root = _el("div", "printRoot printV2Root");
  _applyV2Vars(root);
  const totalPages = Array.isArray(pages) ? pages.length : 0;
  const modeLabel = String(data?.printProfile?.documentLabel || "").trim() || "Dokument";

  for (const page of pages || []) {
    const pageEl = _el("div", "page");
    const pageNo = Number(page?.header?.pageNo || 0);
    if (pageNo === 1) {
      pageEl.appendChild(renderV2GlobalHeader({ data }));
      pageEl.appendChild(renderV2FullHeader({ data, pageNo, totalPages, modeLabel }));
      pageEl.appendChild(_el("div", "v2FullGapLineBody"));
    } else {
      pageEl.appendChild(renderV2MiniHeader({ data, pageNo, totalPages, modeLabel }));
    }
    pageEl.appendChild(_buildTable(page));
    root.appendChild(pageEl);
  }
  return root;
}
