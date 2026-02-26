import { headerUtils } from "./headerUtils.js";

export function renderV2MiniHeader({ data, pageNo, totalPages, modeLabel } = {}) {
  const header = headerUtils.el("div", "v2Header v2HeaderMini");
  const settings = data?.settings || {};
  const titleText = headerUtils.resolveHeaderTitle({
    data,
    settings,
    meeting: data?.meeting,
    modeLabel,
  });
  const brandingText = headerUtils.resolveBranding({ data });

  const topRow = headerUtils.el("div", "v2MiniTopRow");
  const line1Project = headerUtils.el("div", "v2MiniProject", headerUtils.projectLabel(data?.project));
  const rightPage = headerUtils.el("div", "v2MiniRight", "Seite " + pageNo + " / " + totalPages);
  topRow.append(line1Project, rightPage);

  const line2Protocol = headerUtils.el("div", "v2MiniProtocolTitle", titleText);
  line2Protocol.setAttribute("data-v2", "miniText");
  if (brandingText) {
    line2Protocol.appendChild(
      headerUtils.el("span", "v2MiniDraftNotice", "Vorabzug - nicht freigegeben")
    );
  }

  const line = headerUtils.el("div", "v2Divider v2MiniDivider");
  line.setAttribute("data-v2", "miniLine");

  header.append(topRow, line2Protocol);
  header.append(headerUtils.el("div", "v2MiniGapTextLine"), line, headerUtils.el("div", "v2MiniGapLineBody"));

  return header;
}
