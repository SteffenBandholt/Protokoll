import { renderPrint } from "./layout/PrintShell.js";
import { computeAmpelColorForTop, computeAmpelMapForTops } from "../../shared/ampel/pdfAmpelRule.js";
import { renderHeaderTestPages } from "./headerTest/HeaderTestPages.js";
import { renderV2GlobalHeader } from "./v2/header/GlobalHeader.js";
import { renderV2FullHeader } from "./v2/header/FullHeader.js";
import { renderV2MiniHeader } from "./v2/header/MiniHeader.js";
import { V2_LAYOUT } from "./v2/v2LayoutConfig.js";

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

const DEFAULT_V2_PRE_REMARKS_TITLE = "Vorbemerkung:";
const DEFAULT_V2_PRE_REMARKS_TEXT =
  "folgende Punkte gelten als fest vereinbart, Diesen Text anpassen unter Einstellungen - Druckeinstellungen - Vorbemergung";

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
  const changedDate = _formatDateIso(
    top.updated_at ??
      top.updatedAt ??
      top.changed_at ??
      top.changedAt ??
      top.longtext_changed_at ??
      top.longtextChangedAt ??
      ""
  );
  const isNewTop =
    top.isNewTop ?? (Number(top.is_carried_over ?? top.isCarriedOver ?? 0) !== 1);

  // NEW: carried-over TOP whose longtext was edited later
  const isTouched = Number(top.is_touched ?? top.isTouched ?? 0) === 1;
  const isImportant = Number(top.is_important ?? top.isImportant ?? 0) === 1;

  const isHiddenTop =
    Number(top?.isHiddenTop ?? top?.is_hidden ?? top?.isHidden ?? 0) === 1 ||
    Number(top?.frozen_is_hidden ?? top?.frozenIsHidden ?? 0) === 1;
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
    changedDate,
    isNewTop,
    isTouched, // NEW
    isImportant,
    isHiddenTop,
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
    if (row.isHiddenTop) numBox.appendChild(_el("div", "nrHint", "(ausgeblendet)"));
    // Hinweis "(Text geändert ...)" in v2 Druck nicht anzeigen
    // Stern im PDF weggelassen, Flag reicht

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
  // Hinweis "(Text geändert ...)" in v2 Druck nicht anzeigen
  // Stern im PDF weggelassen, Flag reicht
  tdNr.appendChild(numBox);

  const tdText = _el("td", "colText");
  const txtBlock = _el("div", "txtBlock");
  txtBlock.appendChild(_el("div", "shortText", row.title));

  // CHANGED: add marker class for touched carried-over TOPs
  if (row.longtext) {
    const lt = _el("div", "longText", row.longtext);
    if (!row.isNewTop && row.isTouched) lt.classList.add("isTouched");
    txtBlock.appendChild(lt);
  }

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
      (() => {
        const contactHead = _el("div", "firmPeopleContactHead");
        contactHead.append(
          _el("div", "firmPeopleContactHeadLine", "Telefon"),
          _el("div", "firmPeopleContactHeadLine", "E-Mail")
        );
        return contactHead;
      })()
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
        const contact = _el("div", "firmPeopleContact");
        contact.append(
          _el("div", "firmPeopleContactLine", p?.phone || ""),
          _el("div", "firmPeopleContactLine", p?.email || "")
        );
        line.append(
          _el("div", "", wrapByChars(p?.first_name || "", 10)),
          _el("div", "", wrapByChars(p?.last_name || "", 12)),
          _el("div", "", p?.role_text || ""),
          contact
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
  root.className = "measureRoot printRoot printV2Root";
  document.body.appendChild(root);
  return root;
}

function _applyV2VarsForMeasure(root, data) {
  const pagePadTopMm = Number(data?.v2Layout?.pagePadTopMm);
  const pagePadBottomMm = Number(data?.v2Layout?.pagePadBottomMm);
  const footerReserveMm = Number(data?.v2Layout?.footerReserveMm);
  const pagePadLeftMm = Number(data?.v2Layout?.pagePadLeftMm);
  const pagePadRightMm = Number(data?.v2Layout?.pagePadRightMm);
  const globalLogoBoxHeightMm = Number(data?.v2Layout?.globalLogoBoxHeightMm);
  const globalHeaderHeightMm = Number(data?.v2Layout?.globalHeaderHeightMm);
  root.style.setProperty(
    "--v2-pad-top",
    String(Number.isFinite(pagePadTopMm) ? pagePadTopMm : V2_LAYOUT.page.padTopMm) + "mm"
  );
  root.style.setProperty(
    "--v2-pad-bottom",
    String(Number.isFinite(pagePadBottomMm) ? pagePadBottomMm : V2_LAYOUT.page.padBottomMm) + "mm"
  );
  root.style.setProperty(
    "--v2-footer-reserve",
    String(Number.isFinite(footerReserveMm) ? footerReserveMm : 12) + "mm"
  );
  root.style.setProperty(
    "--v2-pad-left",
    String(Number.isFinite(pagePadLeftMm) ? pagePadLeftMm : V2_LAYOUT.page.padXmm) + "mm"
  );
  root.style.setProperty(
    "--v2-pad-right",
    String(Number.isFinite(pagePadRightMm) ? pagePadRightMm : V2_LAYOUT.page.padXmm) + "mm"
  );
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
        : V2_LAYOUT.global.logoBoxHeightMm || V2_LAYOUT.global.logoBoxMm
    ) + "mm"
  );
  root.style.setProperty(
    "--v2-global-height",
    String(Number.isFinite(globalHeaderHeightMm) ? globalHeaderHeightMm : V2_LAYOUT.global.heightMm || 50) + "mm"
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

function _mmToPx(mm) {
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.left = "-10000px";
  probe.style.top = "-10000px";
  probe.style.width = "100mm";
  probe.style.height = "1px";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const pxPerMm = probe.getBoundingClientRect().width / 100;
  probe.remove();
  const factor = Number.isFinite(pxPerMm) && pxPerMm > 0 ? pxPerMm : 3.78;
  return Math.max(0, Number(mm) || 0) * factor;
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
    tr.innerHTML = `<th>TOP</th><th>Kurztext</th><th>Status</th><th>Fertig bis</th><th>Ampel</th>`;
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

function _buildTopsLegendElement() {
  const wrap = _el("div", "v2TopsLegend");
  wrap.append(
    _el("span", "v2TopsLegendBlue", "neuer TOP"),
    _el("span", "v2TopsLegendBlack", "im Soll / fertig"),
    _el("span", "v2TopsLegendRed", "im Verzug / wichtig")
  );
  return wrap;
}

function _collectProtocolFooterLines(settings) {
  const footerPlace = String(settings?.["pdf.footerPlace"] || "").trim();
  const footerDate = String(settings?.["pdf.footerDate"] || "").trim();
  const footerName1 = String(settings?.["pdf.footerName1"] || "").trim();
  const footerName2 = String(settings?.["pdf.footerName2"] || "").trim();
  const footerRecorder = String(settings?.["pdf.footerRecorder"] || "").trim();
  const footerStreet = String(settings?.["pdf.footerStreet"] || "").trim();
  const footerZip = String(settings?.["pdf.footerZip"] || "").trim();
  const footerCity = String(settings?.["pdf.footerCity"] || "").trim();
  const linePlaceDate = [footerPlace, footerDate].filter((v) => v).join(", ");
  const lineZipCity = [footerZip, footerCity].filter((v) => v).join(" ").trim();
  const lines = [linePlaceDate, footerName1, footerName2, footerRecorder, footerStreet, lineZipCity].filter((v) => v);
  if (lines.length) return lines;
  return ["Keine Angaben - Projekt > Bearbeiten > Einstellungen"];
}

function _buildProtocolFooterElement(data) {
  const mode = String(data?.mode || "").trim().toLowerCase();
  if (!["protocol", "preview", "vorabzug"].includes(mode)) return null;
  const lines = _collectProtocolFooterLines(data?.settings || {});
  if (!lines.length) return null;
  const wrap = _el("div", "v2ProtocolFooter");
  wrap.appendChild(_el("div", "v2ProtocolFooterTitle", "Aufgestellt:"));
  for (const line of lines) wrap.appendChild(_el("div", "v2ProtocolFooterLine", line));
  return wrap;
}

function _resolveInterludeText(data) {
  const settings = data?.settings || {};

  const nextMeeting = data?.nextMeeting || {};
  const enabledRaw = _parseBoolSetting(
    nextMeeting.enabled != null ? nextMeeting.enabled : settings["print.nextMeeting.enabled"],
    false
  );
  if (!enabledRaw) return "";
  const dateRaw = String(nextMeeting.date != null ? nextMeeting.date : settings["print.nextMeeting.date"] || "").trim();
  const timeRaw = String(nextMeeting.time != null ? nextMeeting.time : settings["print.nextMeeting.time"] || "").trim();
  const placeRaw = String(nextMeeting.place != null ? nextMeeting.place : settings["print.nextMeeting.place"] || "").trim();
  const extraRaw = String(nextMeeting.extra != null ? nextMeeting.extra : settings["print.nextMeeting.extra"] || "").trim();

  let weekday = "";
  let dateOut = dateRaw || "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const d = new Date(`${dateRaw}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      weekday = d.toLocaleDateString("de-DE", { weekday: "long" });
      dateOut = d.toLocaleDateString("de-DE");
    }
  }
  const timeOut = timeRaw || "-";
  let text = "Die nächste Besprechung findet am ";
  if (weekday) text += `${weekday}, den ${dateOut} um ${timeOut} Uhr`;
  else text += `${dateOut} um ${timeOut} Uhr`;
  if (extraRaw) text += ` ${extraRaw}`;
  if (placeRaw) text += ` ${placeRaw}`;
  text += " statt.";
  return text.trim();
}

function _buildTopsTailElement(data) {
  const wrap = _el("div", "v2TopsTail");
  wrap.appendChild(_buildTopsLegendElement());
  const interlude = _resolveInterludeText(data);
  if (interlude) wrap.appendChild(_el("div", "v2TopsInterlude", interlude));
  const footer = _buildProtocolFooterElement(data);
  if (footer) wrap.appendChild(footer);
  return wrap;
}

function _measureTopsTailHeight(data) {
  const root = _buildMeasureRoot();
  const page = _el("div", "page");
  const tail = _buildTopsTailElement(data);
  page.appendChild(tail);
  root.appendChild(page);
  const h = Math.ceil(tail.getBoundingClientRect().height || 0);
  root.remove();
  return h;
}

function _buildParticipantsIntroData(data) {
  const mode = String(data?.mode || "").trim().toLowerCase();
  if (!["protocol", "preview", "vorabzug"].includes(mode)) return null;
  const src = Array.isArray(data?.participants) ? data.participants : [];
  const rows = src.map((p) => {
    const name = String(p?.name || "").trim();
    const role = String(p?.rolle || p?.role || "").trim();
    const firm = String(p?.firm || "").trim();
    const mobileOrFunk = String(p?.handy ?? p?.mobile ?? p?.funk ?? p?.mobil ?? p?.cell ?? "").trim();
    const phoneFallback = String(p?.telefon ?? p?.phone ?? "").trim();
    const phone = mobileOrFunk || phoneFallback;
    const email = String(p?.email || "").trim();
    const isPresent = Number(p?.isPresent ?? p?.is_present ?? 0) === 1;
    const isInDistribution = Number(p?.isInDistribution ?? p?.is_in_distribution ?? 0) === 1;
    return {
      name,
      role,
      firm,
      phone,
      email,
      presentMark: isPresent ? "x" : "-",
      distributionMark: isInDistribution ? "x" : "-",
    };
  });
  return { type: "participants", title: "Teilnehmer", rows };
}

function _buildParticipantsIntroElement(intro) {
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
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const contactTd = _el("td", "v2PartColContact");
      const contactStack = _el("div", "v2PartContactStack");
      contactStack.append(_el("div", "v2PartContactRow", row.phone || "-"), _el("div", "v2PartContactRow", row.email || "-"));
      contactTd.appendChild(contactStack);
      tr.append(_el("td", "v2PartColName", row.name || ""), _el("td", "v2PartColRole", row.role || ""), _el("td", "v2PartColFirm", row.firm || ""));
      tr.appendChild(contactTd);
      const marksTd = _el("td", "v2PartColMarks");
      const marks = _el("div", "v2PartMarks");
      marks.append(_el("div", "v2PartMarkRow", row.presentMark || "-"), _el("div", "v2PartMarkRow", row.distributionMark || "-"));
      marksTd.appendChild(marks);
      tr.appendChild(marksTd);
      tbody.appendChild(tr);
    });
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function _parseBoolSetting(v, fallback = false) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return !!fallback;
  return ["1", "true", "yes", "ja", "on"].includes(s);
}

function _buildPreRemarksData(data) {
  const mode = String(data?.mode || "").trim().toLowerCase();
  if (!["protocol", "preview", "vorabzug"].includes(mode)) return null;
  const settings = data?.settings || {};
  const enabled = _parseBoolSetting(settings["print.preRemarks.enabled"], true);
  if (!enabled) return null;
  const text = String(settings["pdf.preRemarks"] || "").replace(/\r\n?/g, "\n").trim();
  if (!text) {
    return {
      type: "preRemarks",
      title: DEFAULT_V2_PRE_REMARKS_TITLE,
      text: DEFAULT_V2_PRE_REMARKS_TEXT,
    };
  }
  return { type: "preRemarks", title: DEFAULT_V2_PRE_REMARKS_TITLE, text };
}

function _buildPreRemarksElement(preRemarks) {
  if (!preRemarks || preRemarks.type !== "preRemarks") return null;
  const wrap = _el("section", "v2PreRemarksBlock");
  wrap.appendChild(_el("div", "v2PreRemarksTitle", preRemarks.title || DEFAULT_V2_PRE_REMARKS_TITLE));
  const body = _el("div", "v2PreRemarksText", preRemarks.text || "");
  wrap.appendChild(body);
  return wrap;
}

function _measurePreRemarksHeight(ctx, preRemarks) {
  if (!ctx || !preRemarks) return 0;
  const el = _buildPreRemarksElement(preRemarks);
  if (!el) return 0;
  ctx.root.querySelector(".page")?.appendChild(el);
  const rectH = el.getBoundingClientRect().height;
  const style = getComputedStyle(el);
  const marginTop = parseFloat(style.marginTop) || 0;
  const marginBottom = parseFloat(style.marginBottom) || 0;
  const h = Math.ceil(rectH + marginTop + marginBottom);
  el.remove();
  return Math.max(0, h);
}

function _measureIntroHeight(ctx, intro) {
  if (!ctx || !intro) return 0;
  const introEl = _buildParticipantsIntroElement(intro);
  if (!introEl) return 0;
  ctx.root.querySelector(".page")?.appendChild(introEl);
  const rectH = introEl.getBoundingClientRect().height;
  const style = getComputedStyle(introEl);
  const marginTop = parseFloat(style.marginTop) || 0;
  const marginBottom = parseFloat(style.marginBottom) || 0;
  const h = Math.ceil(rectH + marginTop + marginBottom);
  introEl.remove();
  return Math.max(0, h);
}

function _buildParticipantsIntroPlan({ intro, ctxFirst, ctxNext, firstCap, nextCap }) {
  if (!intro) return { chunks: [], heights: [] };
  const rows = Array.isArray(intro.rows) ? intro.rows : [];
  if (!rows.length) {
    const h = _measureIntroHeight(ctxFirst, intro);
    return { chunks: [intro], heights: [h] };
  }

  const chunks = [];
  const heights = [];
  let idx = 0;
  let pageNo = 0;

  while (idx < rows.length) {
    const cap = pageNo === 0 ? firstCap : nextCap;
    const ctx = pageNo === 0 ? ctxFirst : ctxNext || ctxFirst;
    const chunkRows = [];
    let lastGoodHeight = 0;
    while (idx < rows.length) {
      const candidateRows = chunkRows.concat(rows[idx]);
      const candidateIntro = { ...intro, rows: candidateRows };
      const candidateHeight = _measureIntroHeight(ctx, candidateIntro);
      if (candidateHeight <= cap) {
        chunkRows.push(rows[idx]);
        lastGoodHeight = candidateHeight;
        idx += 1;
        continue;
      }
      if (!chunkRows.length) {
        // Eine einzelne Zeile passt nie in den Intro-Block: trotzdem nicht verlieren.
        chunkRows.push(rows[idx]);
        lastGoodHeight = candidateHeight;
        idx += 1;
      }
      break;
    }
    const chunk = { ...intro, rows: chunkRows };
    chunks.push(chunk);
    heights.push(lastGoodHeight || _measureIntroHeight(ctx, chunk));
    pageNo += 1;
  }

  return { chunks, heights };
}

function _createMeasureContext({ type, projectLabel, docLabel, data, headerKind = "legacy" }) {
  const root = _buildMeasureRoot();
  _applyV2VarsForMeasure(root, data);
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
    type === "tops"
      ? "topsTable"
      : type === "firms"
      ? "firmsTable"
      : type === "firmsCards"
      ? "firmsCardsTable"
      : "todoTable";
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
  const footerReserveMm = Number(data?.v2Layout?.footerReserveMm);
  const footerReservePx = _mmToPx(Number.isFinite(footerReserveMm) ? footerReserveMm : 12);
  const maxBodyHeight = Math.max(0, innerHeight - offset - footerReservePx);

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
  const ctxFirst = _createMeasureContext({ type: "tops", projectLabel, docLabel, data, headerKind: "full" });
  const ctxNext = _createMeasureContext({ type: "tops", projectLabel, docLabel, data, headerKind: "mini" });
  const rowMeasureCtx = ctxNext || ctxFirst;
  const intro = _buildParticipantsIntroData(data);
  const firstCap = ctxFirst.maxBodyHeight;
  const nextCap = ctxNext?.maxBodyHeight || ctxFirst.maxBodyHeight;
  const introPlan = _buildParticipantsIntroPlan({
    intro,
    ctxFirst,
    ctxNext,
    firstCap,
    nextCap,
  });
  const preRemarks = _buildPreRemarksData(data);
  const preRemarksHeight = _measurePreRemarksHeight(ctxNext || ctxFirst, preRemarks);
  let preRemarksPending = !!preRemarks;
  const introChunks = introPlan.chunks;
  const introHeights = introPlan.heights;
  let pageIndex = 0;
  let firstPageBodyHeight = Math.max(0, firstCap - (introHeights[0] || 0));

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
    const fullMeasure = rowMeasureCtx.measureRow(_buildTopRowElement(fullRow));
    const baseMeasure = rowMeasureCtx.measureRow(_buildTopRowElement(baseRow));
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
    intro: introChunks[0] || null,
    preRemarks: null,
    table: { type: "tops", rows: [] },
  };
  let remaining = firstPageBodyHeight;

  const pushPage = () => {
    pages.push(currentPage);
    pageIndex += 1;
    const cap = pageIndex === 0 ? firstCap : nextCap;
    const introForPage = introChunks[pageIndex] || null;
    const introHeight = introForPage ? introHeights[pageIndex] || 0 : 0;
    currentPage = {
      header: { projectLabel, docLabel },
      intro: introForPage,
      preRemarks: null,
      table: { type: "tops", rows: [] },
    };
    remaining = Math.max(0, cap - introHeight);
  };

  const addRow = (rowData, rowHeight) => {
    currentPage.table.rows.push(rowData);
    remaining -= rowHeight;
  };

  const ensurePreRemarksPlaced = () => {
    if (!preRemarksPending) return;
    while (preRemarksPending) {
      if (currentPage.table.rows.length) return;
      const pageCap = pageIndex === 0 ? firstCap : nextCap;
      if (preRemarksHeight > pageCap) {
        currentPage.preRemarks = preRemarks;
        remaining = Math.max(0, remaining - preRemarksHeight);
        preRemarksPending = false;
        return;
      }
      if (remaining >= preRemarksHeight) {
        currentPage.preRemarks = preRemarks;
        remaining -= preRemarksHeight;
        preRemarksPending = false;
        return;
      }
      pushPage();
    }
  };

  const MIN_LINES_PAGE_END = 3;
  const MIN_LINES_NEXT_PAGE = 3;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const level = item.fullRow.level;
    ensurePreRemarksPlaced();

    if (item.fullHeight <= remaining) {
      addRow(item.fullRow, item.fullHeight);
      continue;
    }

    if (level === 1) {
      if (currentPage.table.rows.length) pushPage();
      addRow(item.fullRow, item.fullHeight);
      continue;
    }

    const minSplitHeight = item.baseHeight + MIN_LINES_PAGE_END * item.lineHeight;
    if (remaining < minSplitHeight) {
      if (currentPage.table.rows.length) pushPage();
    }

    let text = item.fullRow.longtext;
    while (text) {
      const rowData = _buildTopRowData(item.top, text, item.ampelColor);
      const measure = rowMeasureCtx.measureRow(_buildTopRowElement(rowData));
      const rowHeight = measure.height;

      if (rowHeight <= remaining) {
        addRow(rowData, rowHeight);
        break;
      }

      const minHeight = item.baseHeight + MIN_LINES_PAGE_END * item.lineHeight;
      if (remaining < minHeight) {
        if (!currentPage.table.rows.length) {
          addRow(rowData, rowHeight);
          break;
        }
        pushPage();
        continue;
      }

      const allowedLines = Math.max(MIN_LINES_PAGE_END, Math.floor((remaining - item.baseHeight) / item.lineHeight));
      const part1 = _findSplitText(rowMeasureCtx, rowData, allowedLines);
      if (!part1) {
        if (currentPage.table.rows.length) pushPage();
        continue;
      }

      const part1Data = _buildTopRowData(item.top, part1, item.ampelColor);
      const part1Measure = rowMeasureCtx.measureRow(_buildTopRowElement(part1Data));
      const part2Text = text.slice(part1.length).trimStart();
      const part2Data = _buildTopRowData(item.top, part2Text, item.ampelColor);
      const part2Measure = rowMeasureCtx.measureRow(_buildTopRowElement(part2Data));
      if (part1Measure.longLines < MIN_LINES_PAGE_END || part2Measure.longLines < MIN_LINES_NEXT_PAGE) {
        if (!currentPage.table.rows.length) {
          addRow(rowData, rowHeight);
          break;
        }
        pushPage();
        continue;
      }
      const part1Height = part1Measure.height;
      addRow(part1Data, part1Height);
      pushPage();
      text = part2Text;
    }
  }

  ensurePreRemarksPlaced();

  if (currentPage.table.rows.length || currentPage.intro || currentPage.preRemarks) pages.push(currentPage);
  if (!pages.length) {
    pages.push({
      header: { projectLabel, docLabel },
      intro: introChunks[0] || null,
      preRemarks: preRemarksPending ? preRemarks : null,
      table: { type: "tops", rows: [] },
    });
  }

  const tailHeight = _measureTopsTailHeight(data);
  const pageCapAt = (idx) => (idx === 0 ? firstCap : nextCap);
  const introHeightAt = (idx, page) => {
    if (!page?.intro) return 0;
    const cached = introHeights[idx];
    if (Number.isFinite(cached) && cached > 0) return cached;
    const measureCtx = idx === 0 ? ctxFirst : ctxNext || ctxFirst;
    return _measureIntroHeight(measureCtx, page.intro);
  };
  const rowsHeightAt = (page) => {
    const rows = page?.table?.rows || [];
    if (!rows.length) return 0;
    return rows.reduce((sum, row) => {
      const h = rowMeasureCtx.measureRow(_buildTopRowElement(row)).height;
      return sum + h;
    }, 0);
  };
  const findLastTopsIdx = () => {
    for (let i = pages.length - 1; i >= 0; i -= 1) {
      if (String(pages[i]?.table?.type || "") === "tops") return i;
    }
    return -1;
  };
  const makeEmptyTopsPage = () => ({
    header: { projectLabel, docLabel },
    intro: null,
    preRemarks: null,
    table: { type: "tops", rows: [] },
  });

  let lastTopsIdx = findLastTopsIdx();
  while (lastTopsIdx >= 0) {
    const page = pages[lastTopsIdx];
    const cap = pageCapAt(lastTopsIdx);
    const introH = introHeightAt(lastTopsIdx, page);
    const preRemarksH = page?.preRemarks ? preRemarksHeight : 0;
    const usedWithTail = rowsHeightAt(page) + tailHeight;
    const allowed = Math.max(0, cap - introH - preRemarksH);
    if (usedWithTail <= allowed) break;

    if ((page?.table?.rows || []).length === 0) {
      pages.splice(lastTopsIdx + 1, 0, makeEmptyTopsPage());
      break;
    }

    const movedRow = page.table.rows.pop();
    const insertIdx = lastTopsIdx + 1;
    let nextPage = pages[insertIdx];
    if (String(nextPage?.table?.type || "") !== "tops") {
      nextPage = makeEmptyTopsPage();
      pages.splice(insertIdx, 0, nextPage);
    }
    nextPage.table.rows.unshift(movedRow);
    lastTopsIdx = findLastTopsIdx();
  }

  const total = pages.length || 1;
  const interludeText = _resolveInterludeText(data);
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    const p = pages[i];
    if (String(p?.table?.type || "") !== "tops") continue;
    p.topsTail = {
      showLegend: true,
      interludeText,
    };
    break;
  }
  pages.forEach((p, idx) => {
    p.header.pageNo = idx + 1;
    p.header.totalPages = total;
  });

  ctxFirst.cleanup();
  if (ctxNext) ctxNext.cleanup();
  console.log(`[PAGINATION] pages=${pages.length} firstPageRows=${pages[0]?.table?.rows?.length || 0}`);
  return pages;
}

function _paginateGeneric({ rows, type, projectLabel, docLabel, data }) {
  const useV2HeaderPaging = type === "firmsCards" || type === "todo";
  const ctx = useV2HeaderPaging
    ? _createMeasureContext({ type, projectLabel, docLabel, data, headerKind: "full" })
    : _createMeasureContext({ type, projectLabel, docLabel });
  const ctxNext = useV2HeaderPaging
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
    remaining = pageNo === 1 ? ctx.maxBodyHeight : ctxNext?.maxBodyHeight || ctx.maxBodyHeight;
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
    // Verantwortlich-Gruppenkopf in ToDo nie alleine am Seitenende.
    if (type === "todo" && row?.kind === "todoGroup") {
      const next = rows[i + 1] || null;
      const nextH = next ? rowHeightAt(i + 1) : 0;
      const minBlockHeight = h + (next ? nextH : 0);
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
    const rows = [];
    let currentGroup = "";
    for (const r of data.todoRows || []) {
      const group = String(r?.responsible_group || "").trim() || "Ohne Verantwortlich";
      if (group !== currentGroup) {
        currentGroup = group;
        rows.push({ kind: "todoGroup", title: currentGroup });
      }
      rows.push({
        kind: "todoItem",
        position: r.position || "",
        title: r.title || "",
        status: r.status || "",
        due: _formatDateIso(r.due_date),
        ampelColor: computeAmpelColorForTop({ top: { status: r.status || "", due_date: r.due_date || "" } }),
      });
    }
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
    // Version/Channel für PDF-Fußnote bereitstellen (falls nicht im Payload enthalten)
    if (!data.appVersion && window.bbmDb?.appGetVersion) {
      try {
        const vRes = await window.bbmDb.appGetVersion();
        if (vRes?.ok) data.appVersion = vRes.version || "";
      } catch (_e) {}
    }
    if (!data.buildChannel && window.bbmDb?.appGetBuildChannel) {
      try {
        const chRes = await window.bbmDb.appGetBuildChannel();
        if (chRes?.ok) data.buildChannel = chRes.channel || "";
      } catch (_e) {}
    }
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
