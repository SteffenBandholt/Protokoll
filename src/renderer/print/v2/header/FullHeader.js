import { headerUtils } from "./headerUtils.js";

export function renderV2FullHeader({ data, pageNo, totalPages, modeLabel } = {}) {
  const header = headerUtils.el("div", "v2Header v2HeaderFull");
  const protocolTitle = String(data?.protocolTitle || data?.settings?.["pdf.protocolTitle"] || "").trim();
  const titlePrefix = protocolTitle || "Besprechung";

  const left = headerUtils.el("div", "v2HeaderLeft");
  left.appendChild(headerUtils.el("div", "v2Project", headerUtils.projectLabel(data?.project)));
  left.appendChild(
    headerUtils.el(
      "div",
      "v2Protocol",
      headerUtils.meetingLabel(data?.meeting, titlePrefix)
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

  const userBox = headerUtils.el("div", "v2UserBox");
  const u = data?.userData || {};
  const line1 = String(u.name1 || "").trim();
  const line2 = String(u.name2 || "").trim();
  const line3 = String(u.street || "").trim();
  const zip = String(u.zip || "").trim();
  const city = String(u.city || "").trim();
  const line4 = [zip, city].filter((v) => v).join(" ").trim();
  const lines = [line1, line2, line3, line4].filter((v) => String(v || "").trim());
  if (lines.length) {
    lines.forEach((line) => {
      userBox.appendChild(headerUtils.el("div", "v2UserLine", line));
    });
  } else {
    userBox.appendChild(
      headerUtils.el("div", "v2UserPlaceholder", "Hier koennen Ihre Nutzerdaten stehen")
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
