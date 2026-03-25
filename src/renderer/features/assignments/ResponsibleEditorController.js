export class ResponsibleEditorController {
  constructor({ view }) {
    this.view = view;
  }

  clearSelectionInEditor() {
    if (this.view.selResponsible) this.view.selResponsible.value = "";
    this.view._clearLegacyResponsibleOption();
    this.view._respLegacyReadonly = false;
    this.view._respDirty = false;
    this.view._respDirtyTopId = null;
    this.view._respLastSetTopId = null;
  }

  applyDisabledState(isDisabled) {
    if (!this.view.selResponsible) return;
    this.view.selResponsible.disabled = isDisabled ? true : !!this.view._respLegacyReadonly;
  }

  applyStateFlags() {
    if (!this.view.selResponsible) return;
    this.view.selResponsible.disabled =
      !!this.view._respLegacyReadonly || this.view.isReadOnly || this.view._busy;
  }

  applyResolvedSelection(top) {
    const responsible = this.view._readResponsibleFromTop(top);
    this.view._writeResponsibleToSelect(this.view.selResponsible, responsible, this.view.projectFirms || []);
  }

  syncStateAfterSelection(top) {
    this.view._clearLegacyResponsibleOption();
    this.view._respLegacyReadonly = false;

    const topId = top.id;
    const sameTopDirty = this.view._respDirty && this.view._sameTopId(this.view._respDirtyTopId, topId);
    if (sameTopDirty) return;
    if (this.view.selResponsible) this.view.selResponsible.value = "";

    this.view._ensureProjectFirmsLoaded()
      .then(() => {
        if (!this.view._sameTopId(this.view.selectedTop?.id, topId)) return;
        this.view._buildResponsibleOptionsIfNeeded();
        if (!this.view.selResponsible) return;
        this.applyResolvedSelection(top);
        this.applyStateFlags();
        this.view._respLastSetTopId = topId;
        this.view._respDirty = false;
        this.view._respDirtyTopId = null;
        this.view._applyProjectDueDefaults(top);
      })
      .catch(() => {});
  }
}
