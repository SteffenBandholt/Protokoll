import { headerUtils } from "./headerUtils.js";

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
  const userBox = headerUtils.el("div", "v2UserBox");
  const lines = headerUtils.footerLines(data?.settings);
  if (lines.length) {
    lines.forEach((line) => {
      userBox.appendChild(headerUtils.el("div", "v2UserLine", line));
    });
  } else {
    userBox.appendChild(
      headerUtils.el("div", "v2UserPlaceholder", "Hier koennen die Nutzerdaten hin")
    );
  }
  right.appendChild(userBox);

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
