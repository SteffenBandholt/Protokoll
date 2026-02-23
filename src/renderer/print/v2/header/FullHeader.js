import { headerUtils } from "./headerUtils.js";

export function renderV2FullHeader({ data, pageNo, totalPages, modeLabel } = {}) {
  const header = headerUtils.el("div", "v2Header v2HeaderFull");
  const settings = data?.settings || {};
  const protocolTitle =
    String(data?.protocolTitle || "").trim() || headerUtils.protocolTitleFromSettings(settings);
  const protocolLine = headerUtils.protocolLine({
    meeting: data?.meeting,
    settings,
    titlePrefix: protocolTitle,
  });

  const left = headerUtils.el("div", "v2HeaderLeft");
  left.appendChild(headerUtils.el("div", "v2Project", headerUtils.projectLabel(data?.project)));
  left.appendChild(
    headerUtils.el(
      "div",
      "v2Protocol",
      protocolLine
    )
  );

  const right = headerUtils.el("div", "v2HeaderRight");
  const userBox = headerUtils.el("div", "v2UserBox");
  const name1 = String(settings["pdf.footerName1"] || "").trim();
  const name2 = String(settings["pdf.footerName2"] || "").trim();
  const street = String(settings["pdf.footerStreet"] || "").trim();
  const zip = String(settings["pdf.footerZip"] || "").trim();
  const city = String(settings["pdf.footerCity"] || "").trim();

  const lineName1 = headerUtils.el(
    "div",
    name1 ? "v2UserLine" : "v2UserLine v2UserPlaceholder",
    name1 || "Name 1"
  );
  const lineName2 = headerUtils.el(
    "div",
    name2 ? "v2UserLine" : "v2UserLine v2UserPlaceholder",
    name2 || "Name 2"
  );
  const lineStreet = headerUtils.el(
    "div",
    street ? "v2UserLine" : "v2UserLine v2UserPlaceholder",
    street || "Straße / Hsnr"
  );

  const zipCity = headerUtils.el("div", "v2UserZipCity");
  const zipEl = headerUtils.el(
    "div",
    zip ? "v2UserZip" : "v2UserZip v2UserPlaceholder",
    zip || "PLZ"
  );
  const cityEl = headerUtils.el(
    "div",
    city ? "v2UserCity" : "v2UserCity v2UserPlaceholder",
    city || "Ort"
  );
  zipCity.append(zipEl, cityEl);
  userBox.append(lineName1, lineName2, lineStreet, zipCity);
  right.append(userBox);

  const textBlock = headerUtils.el("div", "v2FullTextBlock");
  const row = headerUtils.el("div", "v2FullRow");
  row.append(left, right);
  textBlock.appendChild(row);

  const line2Divider = headerUtils.el("div", "v2Divider v2FullDivider");
  line2Divider.setAttribute("data-v2", "line2");

  header.append(
    textBlock,
    headerUtils.el("div", "v2FullGapProjectLine"),
    line2Divider
  );

  return header;
}
