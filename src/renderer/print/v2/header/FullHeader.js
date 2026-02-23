import { headerUtils } from "./headerUtils.js";

export function renderV2FullHeader({ data, pageNo, totalPages, modeLabel } = {}) {
  const header = headerUtils.el("div", "v2Header v2HeaderFull");
  const settings = data?.settings || {};
  const ud = data?.userData || {};
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
  const name1 = String(ud.name1 || "").trim();
  const name2 = String(ud.name2 || "").trim();
  const street = String(ud.street || "").trim();
  const zip = String(ud.zip || "").trim();
  const city = String(ud.city || "").trim();
  const showUserData = !!ud.enabled;

  if (showUserData) {
    const userBox = headerUtils.el("div", "v2UserBox");

    if (name1) userBox.appendChild(headerUtils.el("div", "v2UserRow", name1));
    if (name2) userBox.appendChild(headerUtils.el("div", "v2UserRow", name2));
    if (street) userBox.appendChild(headerUtils.el("div", "v2UserRow", street));

    if (zip || city) {
      const zipCity = headerUtils.el("div", "v2UserZipCity");
      const zipEl = headerUtils.el("div", "v2UserZip", zip);
      const cityEl = headerUtils.el("div", "v2UserCity", city);
      zipCity.append(zipEl, cityEl);
      userBox.appendChild(zipCity);
    }

    right.append(userBox);
  }

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
