export class EditBoxStateService {
  constructor({ view }) {
    this.view = view;
  }

  applyEditBoxDisabledState(isDisabled) {
    const isOld = Number(this.view.selectedTop?.is_carried_over) === 1;

    if (isDisabled) {
      this.view.inpTitle.disabled = true;
      if (this.view.taLongtext) this.view.taLongtext.disabled = true;
      if (this.view.inpDueDate) this.view.inpDueDate.disabled = true;
      if (this.view.selStatus) this.view.selStatus.disabled = true;
      this.view.responsibleEditor.applyDisabledState(true);
      this.view.chkHidden.disabled = true;
      if (this.view.chkImportant) this.view.chkImportant.disabled = true;
      if (this.view.chkTask) this.view.chkTask.disabled = true;
      if (this.view.chkDecision) this.view.chkDecision.disabled = true;

      if (this.view.btnSaveTop) {
        this.view.btnSaveTop.disabled = true;
        this.view.btnSaveTop.style.opacity = "0.55";
      }
      return;
    }

    this.view.inpTitle.disabled = isOld;
    if (this.view.taLongtext) this.view.taLongtext.disabled = false;
    if (this.view.inpDueDate) this.view.inpDueDate.disabled = false;
    if (this.view.selStatus) this.view.selStatus.disabled = false;
    this.view.responsibleEditor.applyDisabledState(false);

    this.view.chkHidden.disabled = false;
    if (this.view.chkImportant) this.view.chkImportant.disabled = false;
    if (this.view.chkTask) this.view.chkTask.disabled = false;
    if (this.view.chkDecision) this.view.chkDecision.disabled = false;

    if (this.view.btnSaveTop) {
      this.view.btnSaveTop.disabled = false;
      this.view.btnSaveTop.style.opacity = "1";
    }
  }

  applyValuesToEditBox(top) {
    const meta = this.view._getTopMeta(top);
    const titleVal = this.view._clampStr(top.title || "", this.view._titleMax());
    this.view.inpTitle.value = titleVal;

    if (this.view.taLongtext) {
      this.view.taLongtext.value = this.view._clampStr(top.longtext || "", this.view._longMax());
    }

    this.view.chkHidden.checked = Number(top.is_hidden) === 1;
    if (this.view.chkImportant) this.view.chkImportant.checked = Number(top.is_important) === 1;
    if (this.view.chkTask) this.view.chkTask.checked = Number(top.is_task ?? top.isTask ?? 0) === 1;
    if (this.view.chkDecision) this.view.chkDecision.checked = Number(top.is_decision ?? top.isDecision ?? 0) === 1;

    if (this.view.inpDueDate) {
      const dueRaw = meta.dueDate ?? "";
      const dueVal = (dueRaw || "").toString();
      this.view.inpDueDate.value = dueVal ? dueVal.slice(0, 10) : "";
    }

    if (this.view.selStatus) {
      const st = (meta.status || "").toString().trim();
      if (!st && Number(top.is_task ?? top.isTask ?? 0) === 1) {
        this.view.selStatus.value = "todo";
      } else {
        this.view.selStatus.value = st ? st : "alle";
      }
    }
  }
}
