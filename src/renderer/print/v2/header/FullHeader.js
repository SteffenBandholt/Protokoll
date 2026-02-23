import { headerUtils } from "./headerUtils.js";

function _buildUserDataLinesFromSettings(settings) {
  const useUserData = headerUtils.parseBool(settings?.["pdf.footerUseUserData"], false);
  const footerName1 = String(settings?.["pdf.footerName1"] || "").trim();
  const footerName2 = String(settings?.["pdf.footerName2"] || "").trim();
  const footerRecorder = String(settings?.["pdf.footerRecorder"] || "").trim();
  const footerStreet = String(settings?.["pdf.footerStreet"] || "").trim();
  const footerZip = String(settings?.["pdf.footerZip"] || "").trim();
  const footerCity = String(settings?.["pdf.footerCity"] || "").trim();
  const hasAnyField = !!(
    footerName1 ||
    footerName2 ||
    footerRecorder ||
    footerStreet ||
    footerZip ||
    footerCity
  );
  if (!useUserData && !hasAnyField) return [];
  const zipCity = [footerZip, footerCity].filter((v) => v).join(" ").trim();
  return [footerName1, footerName2, footerStreet, zipCity, footerRecorder]
    .map((v) => String(v || "").trim())
    .filter((v) => v)
    .slice(0, 5);
}

function _resolveUserDataLines(data) {
  if (Array.isArray(data?.userDataLines)) {
    return data.userDataLines
      .map((v) => String(v || "").trim())
      .filter((v) => v)
      .slice(0, 5);
  }
  return _buildUserDataLinesFromSettings(data?.settings || {});
}

export function renderV2FullHeader({ data, pageNo, totalPages, modeLabel } = {}) {
  const header = headerUtils.el("div", "v2Header v2HeaderFull");

  const left = headerUtils.el("div", "v2HeaderLeft");
  left.appendChild(headerUtils.el("div", "v2Project", headerUtils.projectLabel(data?.project)));
  left.appendChild(
    headerUtils.el(
      "div",
      "v2Protocol",
      headerUtils.protocolLine(data?.meeting, data?.settings, { withColon: true })
    )
  );

  const right = headerUtils.el("div", "v2HeaderRight");
  const rightMeta = headerUtils.el("div", "v2HeaderRightMeta");
  if (Number.isFinite(Number(pageNo)) && Number.isFinite(Number(totalPages))) {
    rightMeta.appendChild(headerUtils.el("div", "v2Page", "Seite " + pageNo + " / " + totalPages));
  }
  const mode = String(modeLabel || "").trim();
  if (mode) {
    rightMeta.appendChild(headerUtils.el("div", "v2Mode", mode));
  }

  const userBox = headerUtils.el("div", "v2UserDataBox");
  const lines = _resolveUserDataLines(data);
  if (lines.length) {
    lines.forEach((line) => {
      userBox.appendChild(headerUtils.el("div", "v2UserDataLine", line));
    });
  } else {
    userBox.appendChild(
      headerUtils.el("div", "v2UserDataPlaceholder", "Hier koennen Ihre Nutzerdaten stehen")
    );
  }
  right.append(rightMeta, userBox);

  const textBlock = headerUtils.el("div", "v2FullTextBlock");
  const row = headerUtils.el("div", "v2FullRow");
  row.append(left, right);
  textBlock.appendChild(row);

  const line2 = headerUtils.el("div", "v2Divider v2FullDivider");
  line2.setAttribute("data-v2", "line2");

  header.append(
    textBlock,
    headerUtils.el("div", "v2FullGapProjectLine"),
    line2
  );

  return header;
}
