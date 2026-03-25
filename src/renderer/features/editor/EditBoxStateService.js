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
}
