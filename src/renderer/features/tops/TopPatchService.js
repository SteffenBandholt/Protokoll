import { fireAndForget } from "../../utils/async.js";

export class TopPatchService {
  constructor({ view }) {
    this.view = view;
  }

  collectEditorPatch() {
    const values = this.view.topEditor.readValues();
    return this.view.topEditor.buildPatch(values);
  }

  applyPatchToCurrentSelection(patch) {
    if (!patch) return;
    if (this.view.selectedTop) {
      this.view._applyPatchToLocalTop(this.view.selectedTop, patch);
    }
    const selId = this.view.selectedTop?.id;
    const inList = this.view.items.find((it) => this.view._sameTopId(it?.id, selId));
    if (inList && inList !== this.view.selectedTop) {
      this.view._applyPatchToLocalTop(inList, patch);
    }
  }

  async applyPatchAndRefresh(nextPatch, { reload, pulse }) {
    this.applyPatchToCurrentSelection(nextPatch);

    if (pulse) this.view._showSavedPulse();

    if (reload) {
      fireAndForget(() => this.view.reloadList(false), "TopsView reload after save");
    } else {
      this.view._renderListOnly();
      this.view.applyEditBoxState();
    }
  }
}
