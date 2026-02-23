import { headerUtils } from "./headerUtils.js";

export function renderV2MiniHeader({ data, pageNo, totalPages, modeLabel } = {}) {
  const header = headerUtils.el("div", "v2Header v2HeaderMini");

  const row1 = headerUtils.el("div", "v2MiniRow");
  const row1Left = headerUtils.el("div", "v2MiniLeft", headerUtils.projectLabel(data?.project));
  const row1Right = headerUtils.el("div", "v2MiniRight", "Seite " + pageNo + " / " + totalPages);
  row1.append(row1Left, row1Right);

  const row2 = headerUtils.el(
    "div",
    "v2MiniRow v2MiniRow2",
    headerUtils.protocolLine(data?.meeting, data?.settings, { withColon: false })
  );
  row2.setAttribute("data-v2", "miniText");

  const line = headerUtils.el("div", "v2Divider v2MiniDivider");
  line.setAttribute("data-v2", "miniLine");

  header.append(
    row1,
    row2,
    headerUtils.el("div", "v2MiniGapTextLine"),
    line,
    headerUtils.el("div", "v2MiniGapLineBody")
  );

  return header;
}
