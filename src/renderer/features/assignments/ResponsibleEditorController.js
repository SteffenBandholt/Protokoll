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

  syncStateAfterSelection(top) {
    this.view._clearLegacyResponsibleOption();
    this.view._respLegacyReadonly = false;

    const topId = top.id;
    const sameTopDirty = this.view._respDirty && this.view._sameTopId(this.view._respDirtyTopId, topId);

    this.view._ensureProjectFirmsLoaded()
      .then(() => {
        this.view._buildResponsibleOptionsIfNeeded();
        if (
          !sameTopDirty &&
          this.view.selResponsible &&
          !this.view._sameTopId(this.view._respLastSetTopId, topId)
        ) {
          const resolved = this.view._resolveResponsibleSelection(top);
          if (resolved.value && this.view._findResponsibleOption(resolved.value)) {
            this.view._clearLegacyResponsibleOption();
            this.view.selResponsible.value = resolved.value;
          } else if (resolved.fallbackLabel) {
            this.view._setLegacyResponsibleOption(resolved.fallbackLabel);
          } else {
            this.view._clearLegacyResponsibleOption();
            this.view.selResponsible.value = "";
          }
          this.applyStateFlags();
          this.view._respLastSetTopId = topId;
          this.view._respDirty = false;
          this.view._respDirtyTopId = null;
          this.view._applyProjectDueDefaults(top);
        }
      })
      .catch(() => {});
  }
}
