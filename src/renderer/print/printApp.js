import { renderPrint } from "./layout/PrintShell.js";
import { computeAmpelMapForTops } from "../../shared/ampel/pdfAmpelRule.js";
import { renderHeaderTestPages } from "./headerTest/HeaderTestPages.js";
import { renderV2GlobalHeader } from "./v2/header/GlobalHeader.js";
import { renderV2FullHeader } from "./v2/header/FullHeader.js";
import { renderV2MiniHeader } from "./v2/header/MiniHeader.js";

const app = document.getElementById("app");

function setError(text) {
  if (!app) return;
  app.innerHTML = "";
  const div = document.createElement("div");
  div.textContent = text;
  div.style.padding = "20px";
  div.style.color = "#b00020";
  app.appendChild(div);
}

function _projectLabel(project) {
  if (!project) return "Projekt: -";
  const nr = String(project.project_number || project.projectNumber || "").trim();
  const name = String(project.name || "").trim();
  if (nr && name) return `Projekt: ${nr} - ${name}`;
  if (nr) return `Projekt: ${nr}`;
  if (name) return `Projekt: ${name}`;
  return "Projekt: -";
}

function _docLabel(mode) {
  if (mode === "preview" || mode === "vorabzug") return "Vorabzug";
  if (mode === "protocol") return "Protokoll";
  if (mode === "topsAll") return "Top-Liste (alle)";
  if (mode === "firms") return "Firmenliste";
  if (mode === "todo") return "ToDo";
  if (mode === "headerTest") return "Kopf-Test";
  return "Dokument";
}

function _formatDateIso(value) {
  const s = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

function _buildTopRowData(top, longtextOverride, ampelColor) {
  const rawNum =
    top.topNumberText ??
    top.top_nr ??
    top.displayNumber ??
    top.topNr ??
    top.topNo ??
    top.number ??
    top.nr ??
    "";
  const numText = String(rawNum ?? "").trim();
  const level = Number(top.level ?? top.top_level ?? top.topLevel ?? 1) || 1;
  const createdDate = _formatDateIso(
    top.top_created_at ?? top.topCreatedAt ?? top.created_at ?? top.createdAt ?? ""
  );
  const isNewTop =
    top.isNewTop ?? (Number(top.is_carried_over ?? top.isCarriedOver ?? 0) !== 1);
  const title = String(top.title || "").trim() || "(ohne Bezeichnung)";
  const longtext =
    longtextOverride != null ? String(longtextOverride) : String(top.longtext || "").trim();
  const status = String(top.status || "").trim();
  const due = _formatDateIso(top.due_date || top.dueDate || "");
  const resp = String(top.responsible_label || top.responsibleLabel || "").trim();

  return {
    kind: "top",
    level,
    numText,
    createdDate,
    isNewTop,
    title,
    longtext,
    status,
    due,
    resp,
    ampelColor: level === 1 ? null : ampelColor,
  };
}

function _el(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function _buildTopRowElement(row) {
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
    if (row.isNewTop) {
      const star = _el("div", "newStar");
      star.innerHTML = `
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <polygon
            points="50,7 61,36 92,36 66,54 76,84 50,66 24,84 34,54 8,36 39,36"
            fill="#fbc02d"
            stroke="#111"
            stroke-width="6"
          />
        </svg>
      `.trim();
      numBox.appendChild(star);
    }

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
  if (row.isNewTop) {
    const star = _el("div", "newStar");
    star.innerHTML = `
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <polygon
          points="50,7 61,36 92,36 66,54 76,84 50,66 24,84 34,54 8,36 39,36"
          fill="#fbc02d"
          stroke="#111"
          stroke-width="6"
        />
      </svg>
    `.trim();
    numBox.appendChild(star);
  }
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
  if (row.ampelColor) metaLine1.appendChild(_el("span", `ampelDot ${row.ampelColor}`));
  meta3.appendChild(metaLine1);
  meta3.appendChild(_el("div", "metaLine meta2", row.due));
  meta3.appendChild(_el("div", "metaLine meta3", row.resp));
  tdMeta.appendChild(meta3);

  tr.append(tdNr, tdText, tdMeta);
  return tr;
}

function _buildGenericRowElement(row) {
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

function _buildMeasureRoot() {
  const root = document.createElement("div");
  root.className = "measureRoot";
  document.body.appendChild(root);
  return root;
}

function _buildPageHeaderForMeasure(projectLabel, docLabel) {
  const header = _el("div", "pageHeader");
  header.appendChild(_el("div", "headerLeft", projectLabel));
  header.appendChild(_el("div", "headerRight", `Dokumenttyp: ${docLabel} | Seite 1 / 1`));
  return header;
}

function _buildTableHeadForMeasure(type) {
  if (type === "firmsCards") return null;
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
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

function _createMeasureContext({ type, projectLabel, docLabel, data, headerKind = "legacy" }) {
  const root = _buildMeasureRoot();
  const page = _el("div", "page");
  root.appendChild(page);

  if (headerKind === "full") {
    const modeLabel = String(data?.printProfile?.documentLabel || "").trim() || docLabel || "Dokument";
    page.appendChild(renderV2GlobalHeader({ data }));
    page.appendChild(renderV2FullHeader({ data, pageNo: 1, totalPages: 2, modeLabel }));
    page.appendChild(_el("div", "v2FullGapLineBody"));
  } else if (headerKind === "mini") {
    const modeLabel = String(data?.printProfile?.documentLabel || "").trim() || docLabel || "Dokument";
    page.appendChild(renderV2MiniHeader({ data, pageNo: 2, totalPages: 2, modeLabel }));
  } else {
    page.appendChild(_buildPageHeaderForMeasure(projectLabel, docLabel));
    page.appendChild(_el("div", "pageHeaderLine"));
  }

  const table = document.createElement("table");
  table.className =
    type === "tops" ? "topsTable" : type === "firms" ? "firmsTable" : type === "firmsCards" ? "firmsCardsTable" : "todoTable";
  const colgroup = _buildColGroup(type);
  if (colgroup) table.appendChild(colgroup);
  const head = _buildTableHeadForMeasure(type);
  if (head) table.appendChild(head);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  page.appendChild(table);

  const pageRect = page.getBoundingClientRect();
  const style = getComputedStyle(page);
  const padTop = parseFloat(style.paddingTop) || 0;
  const padBottom = parseFloat(style.paddingBottom) || 0;
  const innerHeight = pageRect.height - padTop - padBottom;
  const tbodyRect = tbody.getBoundingClientRect();
  const contentTop = pageRect.top + padTop;
  const offset = tbodyRect.top - contentTop;
  const maxBodyHeight = innerHeight - offset;

  const measureRow = (rowEl) => {
    tbody.innerHTML = "";
    tbody.appendChild(rowEl);
    const rect = rowEl.getBoundingClientRect();
    let longLines = 0;
    let lineHeight = 0;
    const longEl = rowEl.querySelector(".longText");
    if (longEl) {
      lineHeight = parseFloat(getComputedStyle(longEl).lineHeight) || 14;
      const h = longEl.getBoundingClientRect().height;
      longLines = Math.max(1, Math.round(h / lineHeight));
    }
    return { height: rect.height, longLines, lineHeight };
  };

  return {
    root,
    maxBodyHeight,
    measureRow,
    cleanup: () => root.remove(),
  };
}

function _trimToWordBoundary(text) {
  const idx = text.lastIndexOf(" ");
  if (idx > 0) return text.slice(0, idx);
  return text;
}

function _findSplitText(ctx, rowData, maxLines) {
  const text = rowData.longtext || "";
  if (!text) return "";
  let low = 0;
  let high = text.length;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    let cut = text.slice(0, mid);
    cut = _trimToWordBoundary(cut) || cut;
    const lines = ctx.measureRow(_buildTopRowElement({ ...rowData, longtext: cut })).longLines;
    if (lines <= maxLines) {
      best = cut.length;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best <= 0) return "";
  return text.slice(0, best).trimEnd();
}

function _paginateTops(data) {
  const projectLabel = _projectLabel(data.project);
  const docLabel = _docLabel(data.mode);
  const ctx = _createMeasureContext({ type: "tops", projectLabel, docLabel });

  const tops = Array.isArray(data.tops) ? data.tops : [];
  const ampelMap = computeAmpelMapForTops({
    tops,
    mode: data.mode,
    meeting: data.meeting,
    settings: data.settings,
    now: new Date(),
  });
  const getAmpelColor = (top) => {
    const topId = top?.id ?? top?.top_id ?? top?.topId ?? null;
    const entry = topId != null ? ampelMap.get(String(topId)) : null;
    if (entry?.show && entry?.color) return entry.color;
    const fallback =
      top?.frozen_ampel_color ??
      top?.frozenAmpelColor ??
      top?.ampel_color ??
      top?.ampelColor ??
      null;
    return fallback ? String(fallback).trim() : null;
  };

  const items = tops.map((t) => {
    const ampelColor = getAmpelColor(t);
    const fullRow = _buildTopRowData(t, null, ampelColor);
    const baseRow = t.longtext ? _buildTopRowData(t, "", ampelColor) : fullRow;
    const fullMeasure = ctx.measureRow(_buildTopRowElement(fullRow));
    const baseMeasure = ctx.measureRow(_buildTopRowElement(baseRow));
    const lineHeight = fullMeasure.lineHeight || baseMeasure.lineHeight || 14;
    return {
      top: t,
      ampelColor,
      fullRow,
      baseRow,
      fullHeight: fullMeasure.height,
      baseHeight: baseMeasure.height,
      longLines: fullMeasure.longLines || 0,
      lineHeight,
    };
  });

  const pages = [];
  let currentPage = {
    header: { projectLabel, docLabel },
    table: { type: "tops", rows: [] },
  };
  let remaining = ctx.maxBodyHeight;

  const pushPage = () => {
    pages.push(currentPage);
    currentPage = {
      header: { projectLabel, docLabel },
      table: { type: "tops", rows: [] },
    };
    remaining = ctx.maxBodyHeight;
  };

  const addRow = (rowData, rowHeight) => {
    currentPage.table.rows.push(rowData);
    remaining -= rowHeight;
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const level = item.fullRow.level;

    if (level === 1) {
      let nextIdx = -1;
      for (let j = i + 1; j < items.length; j++) {
        const lvl = items[j].fullRow.level;
        if (lvl === 2) {
          nextIdx = j;
          break;
        }
        if (lvl === 1) break;
      }
      if (nextIdx !== -1) {
        const groupHeight = item.fullHeight + items[nextIdx].fullHeight;
        if (remaining < groupHeight) {
          if (currentPage.table.rows.length) pushPage();
        }
      }
    }

    if (item.fullHeight <= remaining) {
      addRow(item.fullRow, item.fullHeight);
      continue;
    }

    if (item.longLines < 6 || level === 1) {
      if (currentPage.table.rows.length) pushPage();
      addRow(item.fullRow, item.fullHeight);
      continue;
    }

    const minSplitHeight = item.baseHeight + 3 * item.lineHeight;
    if (remaining < minSplitHeight) {
      if (currentPage.table.rows.length) pushPage();
    }

    let text = item.fullRow.longtext;
    while (text) {
      const rowData = _buildTopRowData(item.top, text, item.ampelColor);
      const measure = ctx.measureRow(_buildTopRowElement(rowData));
      const rowHeight = measure.height;
      const longLines = measure.longLines;

      if (rowHeight <= remaining) {
        addRow(rowData, rowHeight);
        break;
      }

      const minHeight = item.baseHeight + 3 * item.lineHeight;
      if (remaining < minHeight || longLines < 6) {
        if (!currentPage.table.rows.length) {
          addRow(rowData, rowHeight);
          break;
        }
        pushPage();
        continue;
      }

      const allowedLines = Math.max(3, Math.floor((remaining - item.baseHeight) / item.lineHeight));
      const part1 = _findSplitText(ctx, rowData, allowedLines);
      if (!part1) {
        if (currentPage.table.rows.length) pushPage();
        continue;
      }

      const part1Data = _buildTopRowData(item.top, part1, item.ampelColor);
      const part1Height = ctx.measureRow(_buildTopRowElement(part1Data)).height;
      addRow(part1Data, part1Height);
      pushPage();
      text = text.slice(part1.length).trimStart();
    }
  }

  if (currentPage.table.rows.length) pages.push(currentPage);
  if (!pages.length) {
    pages.push({ header: { projectLabel, docLabel }, table: { type: "tops", rows: [] } });
  }

  const total = pages.length || 1;
  pages.forEach((p, idx) => {
    p.header.pageNo = idx + 1;
    p.header.totalPages = total;
  });

  ctx.cleanup();
  console.log(`[PAGINATION] pages=${pages.length} firstPageRows=${pages[0]?.table?.rows?.length || 0}`);
  return pages;
}

function _paginateGeneric({ rows, type, projectLabel, docLabel, data }) {
  const useV2FirmCards = type === "firmsCards";
  const ctx = useV2FirmCards
    ? _createMeasureContext({ type, projectLabel, docLabel, data, headerKind: "full" })
    : _createMeasureContext({ type, projectLabel, docLabel });
  const ctxNext = useV2FirmCards
    ? _createMeasureContext({ type, projectLabel, docLabel, data, headerKind: "mini" })
    : null;
  const pages = [];
  let currentPage = { header: { projectLabel, docLabel }, table: { type, rows: [] } };
  let remaining = ctx.maxBodyHeight;
  const heightCache = new Map();
  let pageNo = 1;

  const pushPage = () => {
    pages.push(currentPage);
    currentPage = { header: { projectLabel, docLabel }, table: { type, rows: [] } };
    pageNo += 1;
    remaining = pageNo === 1 ? ctx.maxBodyHeight : (ctxNext?.maxBodyHeight || ctx.maxBodyHeight);
  };

  const rowHeightAt = (idx) => {
    if (heightCache.has(idx)) return heightCache.get(idx);
    const rowEl = _buildGenericRowElement(rows[idx]);
    const h = (ctxNext || ctx).measureRow(rowEl).height;
    heightCache.set(idx, h);
    return h;
  };

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const h = rowHeightAt(i);

    // Kategorie-Zeile nie alleine: zusammen mit erster Firmenkachel auf die nächste Seite schieben.
    if (type === "firmsCards" && row?.kind === "firmGroup") {
      const next = rows[i + 1] || null;
      const nextH = next ? rowHeightAt(i + 1) : 0;
      const minBlockHeight = h + (next?.kind === "firmCard" ? nextH : 0);
      if (minBlockHeight > remaining && currentPage.table.rows.length) {
        pushPage();
      }
    }

    if (h > remaining && currentPage.table.rows.length) {
      pushPage();
    }
    currentPage.table.rows.push(row);
    remaining -= h;
  }

  if (currentPage.table.rows.length) pages.push(currentPage);
  if (!pages.length) {
    pages.push({ header: { projectLabel, docLabel }, table: { type, rows: [] } });
  }

  const total = pages.length || 1;
  pages.forEach((p, idx) => {
    p.header.pageNo = idx + 1;
    p.header.totalPages = total;
  });

  ctx.cleanup();
  if (ctxNext) ctxNext.cleanup();
  console.log(`[PAGINATION] pages=${pages.length} firstPageRows=${pages[0]?.table?.rows?.length || 0}`);
  return pages;
}

function _buildPages(data) {
  const mode = data.mode || "protocol";
  const projectLabel = _projectLabel(data.project);
  const docLabel = _docLabel(mode);

  if (mode === "firms") {
    const rows = [];
    let currentGroup = "";
    for (const f of data.firms || []) {
      const group = String(f?.categoryLabel || "Sonstige").trim() || "Sonstige";
      if (group !== currentGroup) {
        currentGroup = group;
        rows.push({ kind: "firmGroup", title: currentGroup });
      }
      rows.push({
        kind: "firmCard",
        firm: {
          name: String(f?.label || f?.short || f?.name || "").trim(),
          street: String(f?.street || "").trim(),
          zipCity: [String(f?.zip || "").trim(), String(f?.city || "").trim()].filter(Boolean).join(" "),
          phone: String(f?.phone || "").trim(),
          mobile: "",
          email: String(f?.email || "").trim(),
          persons: Array.isArray(f?.persons) ? f.persons : [],
        },
      });
    }
    return _paginateGeneric({ rows, type: "firmsCards", projectLabel, docLabel, data });
  }

  if (mode === "todo") {
    const rows = (data.todoRows || []).map((r) => ({
      cells: [r.position || "", r.title || "", r.responsible || "", _formatDateIso(r.due_date)],
    }));
    return _paginateGeneric({ rows, type: "todo", projectLabel, docLabel, data });
  }

  return _paginateTops(data);
}

async function handleInit(payload) {
  try {
    const res = await window.bbmPrint.getData(payload);
    if (!res?.ok) {
      setError(res?.error || "Daten konnten nicht geladen werden.");
      window.bbmPrint.ready({ jobId: payload?.jobId || null, ok: false });
      return;
    }

    const data = res.data || {};
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (_e) {}
    }

    if (data.mode === "headerTest") {
      const root = renderHeaderTestPages({ data, debug: !!payload?.debug });
      app.innerHTML = "";
      app.appendChild(root);
      window.bbmPrint.ready({ jobId: payload?.jobId || null, ok: true });
      return;
    }

    const pages = _buildPages(data);
    const root = renderPrint({ pages, data });
    app.innerHTML = "";
    app.appendChild(root);
    window.bbmPrint.ready({ jobId: payload?.jobId || null, ok: true });
  } catch (err) {
    setError(err?.message || "Daten konnten nicht geladen werden.");
    window.bbmPrint.ready({ jobId: payload?.jobId || null, ok: false });
  }
}

window.bbmPrint.onInit((payload) => {
  handleInit(payload);
});
