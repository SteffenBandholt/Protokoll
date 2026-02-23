import { headerUtils } from "./headerUtils.js";

export function renderV2FullHeader({ data, pageNo, totalPages, modeLabel } = {}) {
  const header = headerUtils.el("div", "v2Header v2HeaderFull");

  const left = headerUtils.el("div", "v2HeaderLeft");
  left.appendChild(headerUtils.el("div", "v2Meeting", headerUtils.meetingLabel(data?.meeting)));
  const meta = headerUtils.meetingMeta(data?.meeting);
  if (meta) left.appendChild(headerUtils.el("div", "v2Meta", meta));
  left.appendChild(headerUtils.el("div", "v2Project", headerUtils.projectLabel(data?.project)));

  const right = headerUtils.el("div", "v2HeaderRight");
  right.appendChild(headerUtils.el("div", "v2Page", "Seite " + pageNo + " / " + totalPages));
  right.appendChild(headerUtils.el("div", "v2Mode", String(modeLabel || "").trim() || "PDF"));

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
