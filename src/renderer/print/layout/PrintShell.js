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
  if (type === "firmsCards") return null;
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
    tr.innerHTML = `<th>TOP</th><th>Kurztext</th><th>Status</th><th>Fertig bis</th><th>Ampel</th>`;
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
    if (row.isHiddenTop) numBox.appendChild(_el("div", "nrHint", "(ausgeblendet)"));
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
  if (row.isHiddenTop) numBox.appendChild(_el("div", "nrHint", "(ausgeblendet)"));
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
  if (row?.kind === "todoGroup") {
    const tr = document.createElement("tr");
    tr.className = "firmGroupRow todoGroupRow";
    const td = _el("td", "firmGroupCell todoGroupCell", row.title || "");
    td.colSpan = 5;
    tr.appendChild(td);
    return tr;
  }

  if (row?.kind === "todoItem") {
    const tr = document.createElement("tr");
    tr.className = "todoItemRow";
    tr.append(
      _el("td", "", row.position || ""),
      _el("td", "", row.title || ""),
      _el("td", "", row.status || ""),
      _el("td", "", row.due || "")
    );
    const tdAmpel = _el("td", "todoAmpelCell");
    if (row.ampelColor) tdAmpel.appendChild(_el("span", `ampelDot ${row.ampelColor}`));
    tr.appendChild(tdAmpel);
    return tr;
  }

  if (row?.kind === "firmGroup") {
    const tr = document.createElement("tr");
    tr.className = "firmGroupRow";
    const td = _el("td", "firmGroupCell", row.title || "");
    td.colSpan = 1;
    tr.appendChild(td);
    return tr;
  }

  if (row?.kind === "firmCard") {
    const tr = document.createElement("tr");
    tr.className = "firmCardRow";
    const td = _el("td", "firmCardCell");
    td.colSpan = 1;

    const card = _el("div", "firmCard");
    const top = _el("div", "firmTop");
    const left = _el("div", "firmTopLeft");
    const right = _el("div", "firmTopRight");
    left.append(
      _el("div", "firmName", row?.firm?.name || ""),
      _el("div", "firmAddr", row?.firm?.street || ""),
      _el("div", "firmAddr", row?.firm?.zipCity || "")
    );
    right.append(
      _el("div", "firmContact", `Telefon: ${row?.firm?.phone || "-"}`),
      _el("div", "firmContact", `Handy: ${row?.firm?.mobile || "-"}`),
      _el("div", "firmContact", `E-Mail: ${row?.firm?.email || "-"}`)
    );
    top.append(left, right);

    const people = _el("div", "firmPeople");
    const head = _el("div", "firmPeopleHead");
    head.append(
      _el("div", "", "Vorname"),
      _el("div", "", "Nachname"),
      _el("div", "", "Funktion/Rolle"),
      _el("div", "", "E-Mail"),
      _el("div", "", "Telefon")
    );
    people.appendChild(head);

    const list = Array.isArray(row?.firm?.persons) ? row.firm.persons : [];
    if (!list.length) {
      people.appendChild(_el("div", "firmPeopleEmpty", "Keine Mitarbeiter"));
    } else {
      const wrapByChars = (value, maxChars) => {
        const s = String(value || "");
        if (!maxChars || maxChars < 1 || s.length <= maxChars) return s;
        const out = [];
        for (let i = 0; i < s.length; i += maxChars) out.push(s.slice(i, i + maxChars));
        return out.join("\n");
      };
      for (const p of list) {
        const line = _el("div", "firmPeopleRow");
        line.append(
          _el("div", "", wrapByChars(p?.first_name || "", 10)),
          _el("div", "", wrapByChars(p?.last_name || "", 12)),
          _el("div", "", p?.role_text || ""),
          _el("div", "", p?.email || ""),
          _el("div", "", p?.phone || "")
        );
        people.appendChild(line);
      }
    }

    card.append(top, people);
    td.appendChild(card);
    tr.appendChild(td);
    return tr;
  }

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


function _applyV2Vars(root, data) {
  const pagePadTopMm = Number(data?.v2Layout?.pagePadTopMm);
  const pagePadBottomMm = Number(data?.v2Layout?.pagePadBottomMm);
  const pagePadLeftMm = Number(data?.v2Layout?.pagePadLeftMm);
  const pagePadRightMm = Number(data?.v2Layout?.pagePadRightMm);
  const globalLogoBoxHeightMm = Number(data?.v2Layout?.globalLogoBoxHeightMm);
  const globalHeaderHeightMm = Number(data?.v2Layout?.globalHeaderHeightMm);
  root.style.setProperty("--v2-pad-top", String(Number.isFinite(pagePadTopMm) ? pagePadTopMm : V2_LAYOUT.page.padTopMm) + "mm");
  root.style.setProperty("--v2-pad-bottom", String(Number.isFinite(pagePadBottomMm) ? pagePadBottomMm : V2_LAYOUT.page.padBottomMm) + "mm");
  root.style.setProperty("--v2-pad-left", String(Number.isFinite(pagePadLeftMm) ? pagePadLeftMm : V2_LAYOUT.page.padXmm) + "mm");
  root.style.setProperty("--v2-pad-right", String(Number.isFinite(pagePadRightMm) ? pagePadRightMm : V2_LAYOUT.page.padXmm) + "mm");
  root.style.setProperty("--v2-pad-x", String(V2_LAYOUT.page.padXmm) + "mm");
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
}

function _buildTable(page) {
  const table = document.createElement("table");
  const type = page.table?.type || "tops";

  if (type === "tops") table.className = "topsTable";
  else if (type === "firms") table.className = "firmsTable";
  else if (type === "firmsCards") table.className = "firmsCardsTable";
  else if (type === "todo") table.className = "todoTable";

  const colgroup = _buildColGroup(type);
  if (colgroup) table.appendChild(colgroup);

  const head = _buildTableHead(type);
  if (head) table.appendChild(head);

  const tbody = document.createElement("tbody");
  for (const row of page.table?.rows || []) {
    if (type === "tops") tbody.appendChild(_buildTopRow(row));
    else tbody.appendChild(_buildGenericRow(row));
  }
  if (!(page.table?.rows || []).length) {
    const tr = document.createElement("tr");
    const msg = type === "firms"
      ? "Keine Firmen vorhanden."
      : type === "firmsCards"
        ? "Keine Firmen vorhanden."
      : type === "todo"
        ? "Keine offenen ToDos vorhanden."
        : "Keine Einträge vorhanden.";
    const td = _el("td", "", msg);
    td.colSpan = type === "todo" ? 5 : type === "firms" ? 3 : 1;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function _buildIntro(page) {
  const intro = page?.intro || null;
  if (!intro || intro.type !== "participants") return null;

  const wrap = _el("section", "v2ParticipantsBlock");
  wrap.appendChild(_el("div", "v2ParticipantsTitle", intro.title || "Teilnehmer"));

  const table = document.createElement("table");
  table.className = "v2ParticipantsTable";

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  trHead.innerHTML = `
    <th class="v2PartColName">Name</th>
    <th class="v2PartColRole">Funktion</th>
    <th class="v2PartColFirm">Firma</th>
    <th class="v2PartColContact">
      <div class="v2PartContactHead">
        <span>Telefon</span>
        <span>E-Mail</span>
      </div>
    </th>
    <th class="v2PartColMarks">
      <div class="v2PartMarksHead">
        <span>Anwesend</span>
        <span>Verteiler</span>
      </div>
    </th>
  `;
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const rows = Array.isArray(intro.rows) ? intro.rows : [];
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = _el("td", "v2PartEmpty", "Keine Teilnehmer vorhanden.");
    td.colSpan = 5;
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    for (const row of rows) {
      const tr = document.createElement("tr");
      const contactTd = _el("td", "v2PartColContact");
      const contactStack = _el("div", "v2PartContactStack");
      contactStack.append(
        _el("div", "v2PartContactRow", String(row?.phone || "-")),
        _el("div", "v2PartContactRow", String(row?.email || "-"))
      );
      contactTd.appendChild(contactStack);
      tr.append(
        _el("td", "v2PartColName", String(row?.name || "")),
        _el("td", "v2PartColRole", String(row?.role || "")),
        _el("td", "v2PartColFirm", String(row?.firm || ""))
      );
      tr.appendChild(contactTd);
      const marksTd = _el("td", "v2PartColMarks");
      const marks = _el("div", "v2PartMarks");
      marks.append(
        _el("div", "v2PartMarkRow", String(row?.presentMark || "-")),
        _el("div", "v2PartMarkRow", String(row?.distributionMark || "-"))
      );
      marksTd.appendChild(marks);
      tr.appendChild(marksTd);
      tbody.appendChild(tr);
    }
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

export function renderPrint({ pages, data } = {}) {
  const root = _el("div", "printRoot printV2Root");
  const profileKey = String(data?.printProfile?.key || "").trim();
  if (profileKey) root.classList.add("v2Profile" + profileKey.charAt(0).toUpperCase() + profileKey.slice(1));
  _applyV2Vars(root, data);
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
    const intro = _buildIntro(page);
    if (intro) pageEl.appendChild(intro);
    const isTops = String(page?.table?.type || "") === "tops";
    const hasRows = (page?.table?.rows || []).length > 0;
    const hasIntro = !!page?.intro;
    // Wenn Seite 1 nur Intro enthält, darf die TOP-Tabelle nicht mit Kopf/Leerzeile starten.
    const renderTable = !(isTops && hasIntro && !hasRows);
    if (renderTable) pageEl.appendChild(_buildTable(page));
    pageEl.appendChild(_el("div", "v2FooterReserveSpacer"));
    pageEl.appendChild(_el("div", "v2FooterReserveMarker", "Footer-Reserve 12 mm"));
    root.appendChild(pageEl);
  }
  return root;
}
