import { headerUtils } from "./headerUtils.js";

export function renderV2MiniHeader({ data, pageNo, totalPages, modeLabel } = {}) {
  const header = headerUtils.el("div", "v2Header v2HeaderMini");

  const miniRow = headerUtils.el("div", "v2MiniTextRow");
  const left = headerUtils.el("div", "v2MiniLeft", headerUtils.meetingLabel(data?.meeting));
  const rightText = ${headerUtils.projectLabel(data?.project)} | Seite  /  | ;
  const right = headerUtils.el("div", "v2MiniRight", rightText);
  miniRow.append(left, right);
  miniRow.setAttribute("data-v2", "miniText");

  const line = headerUtils.el("div", "v2Divider v2MiniDivider");
  line.setAttribute("data-v2", "miniLine");

  header.append(
    miniRow,
    headerUtils.el("div", "v2MiniGapTextLine"),
    line,
    headerUtils.el("div", "v2MiniGapLineBody")
  );

  return header;
}