import { fireAndForget } from "../../utils/async.js";

export class TopPatchService {
  constructor({ view }) {
    this.view = view;
  }

  collectEditorPatch() {
    const values = this.view.topEditor.readValues();
    return this.view.topEditor.buildPatch(values);
  }

  async applyPatchAndRefresh(nextPatch, { reload, pulse }) {
    this.view._applyPatchToCurrentSelection(nextPatch);

    if (pulse) this.view._showSavedPulse();

    if (reload) {
      fireAndForget(() => this.view.reloadList(false), "TopsView reload after save");
    } else {
      this.view._renderListOnly();
      this.view.applyEditBoxState();
    }
  }
}
