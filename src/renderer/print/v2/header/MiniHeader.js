import { headerUtils } from "./headerUtils.js";

export function renderV2MiniHeader({ data, pageNo, totalPages, modeLabel } = {}) {
  const header = headerUtils.el("div", "v2Header v2HeaderMini");
  const protocolTitle = String(data?.protocolTitle || data?.settings?.["pdf.protocolTitle"] || "").trim();
  const titlePrefix = protocolTitle || "Besprechung";

  const topRow = headerUtils.el("div", "v2MiniTopRow");
  const leftBlock = headerUtils.el("div", "v2MiniTextBlock");
  leftBlock.setAttribute("data-v2", "miniText");

  const leftLine1 = headerUtils.el("div", "v2MiniProject", headerUtils.projectLabel(data?.project));
  const leftLine2 = headerUtils.el(
    "div",
    "v2MiniProtocol",
    headerUtils.meetingLabel(data?.meeting, titlePrefix)
  );
  leftBlock.append(leftLine1, leftLine2);

  const rightPage = headerUtils.el("div", "v2MiniRight", "Seite " + pageNo + " / " + totalPages);
  topRow.append(leftBlock, rightPage);

  const line = headerUtils.el("div", "v2Divider v2MiniDivider");
  line.setAttribute("data-v2", "miniLine");

  header.append(
    topRow,
    headerUtils.el("div", "v2MiniGapTextLine"),
    line,
    headerUtils.el("div", "v2MiniGapLineBody")
  );

  return header;
}
