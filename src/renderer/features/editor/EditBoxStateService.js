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

  applyTextValues(top) {
    const titleVal = this.view._clampStr(top.title || "", this.view._titleMax());
    this.view.inpTitle.value = titleVal;

    if (this.view.taLongtext) {
      this.view.taLongtext.value = this.view._clampStr(top.longtext || "", this.view._longMax());
    }
  }

  applyCheckboxValues(top) {
    this.view.chkHidden.checked = Number(top.is_hidden) === 1;
    if (this.view.chkImportant) this.view.chkImportant.checked = Number(top.is_important) === 1;
    if (this.view.chkTask) this.view.chkTask.checked = Number(top.is_task ?? top.isTask ?? 0) === 1;
    if (this.view.chkDecision) this.view.chkDecision.checked = Number(top.is_decision ?? top.isDecision ?? 0) === 1;
  }

  applyMetaValues(top) {
    const meta = this.view._getTopMeta(top);
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

  applyValuesToEditBox(top) {
    this.applyTextValues(top);
    this.applyCheckboxValues(top);
    this.applyMetaValues(top);
  }

  clearTextValues() {
    this.view.inpTitle.value = "";
    if (this.view.taLongtext) this.view.taLongtext.value = "";
  }

  clearCheckboxValues() {
    this.view.chkHidden.checked = false;
    if (this.view.chkImportant) this.view.chkImportant.checked = false;
    if (this.view.chkTask) this.view.chkTask.checked = false;
    if (this.view.chkDecision) this.view.chkDecision.checked = false;
  }

  clearMetaValues() {
    if (this.view.inpDueDate) this.view.inpDueDate.value = "";
    if (this.view.selStatus) this.view.selStatus.value = "alle";
  }

  applyEmptyControlsState() {
    this.view.responsibleEditor.clearSelectionInEditor();
    this.view._updateDueAmpelFromInputs();
    this.view._updateStatusMarkers();

    this.applyEditBoxDisabledState(true);
    if (this.view.btnTrashTop) {
      this.view.btnTrashTop.disabled = true;
      this.view.btnTrashTop.style.opacity = "0.55";
    }

    this.view.moveModeActive = false;
    this.view._updateDeleteControls();
    this.view._updateCreateChildControls();
    this.view._updateCharCounters();
    if (this.view._updateTaskDecisionUi) this.view._updateTaskDecisionUi();
  }

  applyEmptyState() {
    this.view._onTopCleared();
    this.clearTextValues();
    this.clearCheckboxValues();
    this.clearMetaValues();
    this.applyEmptyControlsState();
  }

  applyReadOnlyTrashState() {
    if (this.view.btnTrashTop) {
      this.view.btnTrashTop.disabled = true;
      this.view.btnTrashTop.style.opacity = "0.55";
    }
  }

  applyReadOnlyControlsState() {
    this.view.moveModeActive = false;
    this.view._updateMoveControls();
    this.view._updateDeleteControls();
    this.view._updateCreateChildControls();
    if (this.view._updateTaskDecisionUi) this.view._updateTaskDecisionUi();
  }

  applyReadOnlyState() {
    this.applyEditBoxDisabledState(true);
    this.applyReadOnlyTrashState();
    this.applyReadOnlyControlsState();
  }

  applyTrashButtonState() {
    if (this.view.btnTrashTop) {
      const canTrash = this.view._canTrashSelected();
      this.view.btnTrashTop.disabled = !canTrash;
      this.view.btnTrashTop.style.opacity = canTrash ? "1" : "0.55";
      if (!canTrash && Number(this.view.selectedTop?.is_carried_over) === 1) {
        this.view.btnTrashTop.title = "Uebernommene TOPs koennen nicht geloescht werden.";
      } else {
        this.view.btnTrashTop.title = "In Papierkorb (wie Ausblenden)";
      }
    }
  }

  applyNormalControlsState() {
    this.view._updateMoveControls();
    this.view._updateCreateChildControls();
    this.view._updateDeleteControls();
    if (this.view._updateTaskDecisionUi) this.view._updateTaskDecisionUi();
  }

  applyNormalState() {
    this.applyEditBoxDisabledState(false);
    this.applyTrashButtonState();
    this.applyNormalControlsState();
  }

  applyDueAndStatusUi(top) {
    this.view._applyProjectDueDefaults(top);
    this.view._updateDueAmpelFromInputs();
    this.view._updateStatusMarkers();
    this.view._updateTodoStatusAvailability();
  }

  applyResponsibleAndPromptState(top) {
    this.view._tryShowPendingTermPrompt();
    this.view.responsibleEditor.syncStateAfterSelection(top);
    this.view._updateCharCounters();
  }

  applyPostValueState(top) {
    this.applyDueAndStatusUi(top);
    this.applyResponsibleAndPromptState(top);
  }

  syncDueDirtyState(top) {
    if (!top) {
      this.view._dueDirty = false;
      this.view._dueDirtyTopId = null;
    } else if (!this.view._sameTopId(this.view._dueDirtyTopId, top.id)) {
      this.view._dueDirty = false;
      this.view._dueDirtyTopId = null;
    }
  }

  applyMetaVisibility(top) {
    const isLevel1 = Number(top?.level) === 1;
    if (this.view.editMetaCol) this.view.editMetaCol.style.display = isLevel1 ? "none" : "";
    if (this.view.editMetaSep) this.view.editMetaSep.style.display = isLevel1 ? "none" : "";
  }

  applyBoxTitle(top) {
    if (this.view.boxTitleEl) {
      const num = top?.displayNumber ?? top?.number ?? "";
      this.view.boxTitleEl.textContent = num ? `TOP ${num} bearbeiten` : "TOP bearbeiten";
    }
  }

  applyState(top) {
    this.syncDueDirtyState(top);
    this.applyMetaVisibility(top);
    this.applyBoxTitle(top);

    if (!top) {
      this.applyEmptyState();
      return;
    }

    this.applyValuesToEditBox(top);
    this.applyPostValueState(top);

    if (this.view.isReadOnly || this.view._busy) {
      this.applyReadOnlyState();
      return;
    }

    this.applyNormalState();
  }
}
