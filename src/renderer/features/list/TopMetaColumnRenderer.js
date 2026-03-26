const TODO_PNG = new URL("../../assets/todo.png", import.meta.url).href;
const RED_FLAG_PNG = new URL("../../assets/redFlag.png", import.meta.url).href;

export class TopMetaColumnRenderer {
  constructor({ view }) {
    this.view = view;
  }

  buildMetaColumn(top, ampelCompute) {
    if (!this.view._shouldShowMetaColumn(top)) return null;

    const meta = this.view._getTopMeta(top);
    const statusLower = String(meta.status || "").trim().toLowerCase();
    const isTask =
      statusLower === "todo" || this.view._parseActiveFlag(top.is_task ?? top.isTask) === 1;

    const metaCol = document.createElement("div");
    metaCol.style.display = "flex";
    metaCol.style.flexDirection = "column";
    metaCol.style.alignItems = "flex-start";
    metaCol.style.textAlign = "left";
    metaCol.style.gap = "2px";
    metaCol.style.flex = `0 0 ${this.view.META_COL_W}px`;
    metaCol.style.width = `${this.view.META_COL_W}px`;
    metaCol.style.fontSize = "12px";
    metaCol.style.opacity = "0.65";
    metaCol.style.fontVariantNumeric = "tabular-nums";
    metaCol.style.paddingLeft = "10px";
    metaCol.style.borderLeft = "1px solid rgba(0,0,0,0.08)";

    const due = this.view._formatDue(meta.dueDate || this.view._resolveDisplayDueForTop(top));
    const st = this.view._formatStatus(meta.status);
    const resp = this.view.responsibleService.format(top);

    const dueRow = document.createElement("div");
    dueRow.style.display = "flex";
    dueRow.style.alignItems = "center";
    dueRow.style.justifyContent = "space-between";
    dueRow.style.gap = "8px";
    dueRow.style.width = "100%";

    const dueTxt = document.createElement("span");
    dueTxt.textContent = `${due}`;
    dueTxt.style.whiteSpace = "nowrap";
    dueTxt.style.overflow = "hidden";
    dueTxt.style.textOverflow = "ellipsis";
    dueTxt.style.flex = "1 1 auto";
    dueTxt.style.minWidth = "0";

    const ampelColor = ampelCompute(top);
    const dot = this.view.showAmpelInList ? this.view._makeAmpelDot(ampelColor, 10) : null;
    if (dot) dot.title = ampelColor ? String(ampelColor) : "";

    dueRow.append(dueTxt);
    if (dot) dueRow.append(dot);

    const stRow = document.createElement("div");
    stRow.style.display = "flex";
    stRow.style.alignItems = "center";
    stRow.style.gap = "8px";
    stRow.style.width = "100%";

    const stTxt = document.createElement("span");
    stTxt.textContent = `${st}`;
    stTxt.style.whiteSpace = "nowrap";
    stTxt.style.overflow = "hidden";
    stTxt.style.textOverflow = "ellipsis";
    stTxt.style.flex = "1 1 auto";
    stTxt.style.minWidth = "0";
    stRow.append(stTxt);

    if (isTask) {
      const taskMarker = document.createElement("img");
      taskMarker.src = TODO_PNG;
      taskMarker.alt = "ToDo";
      taskMarker.title = "ToDo";
      taskMarker.style.width = "14px";
      taskMarker.style.height = "14px";
      taskMarker.style.flex = "0 0 14px";
      taskMarker.style.objectFit = "contain";
      stRow.append(taskMarker);
    }

    if (this.view._shouldShowDecisionFlag(st)) {
      const flag = document.createElement("img");
      flag.src = RED_FLAG_PNG;
      flag.alt = "Festlegung";
      flag.title = "Festlegung";
      flag.style.width = "14px";
      flag.style.height = "14px";
      flag.style.flex = "0 0 14px";
      flag.style.objectFit = "contain";
      stRow.append(flag);
    }

    const respRow = document.createElement("div");
    respRow.textContent = `${resp}`;
    respRow.style.whiteSpace = "nowrap";
    respRow.style.overflow = "hidden";
    respRow.style.textOverflow = "ellipsis";

    metaCol.append(dueRow, stRow, respRow);

    return metaCol;
  }
}
