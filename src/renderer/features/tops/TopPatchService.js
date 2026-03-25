import { fireAndForget } from "../../utils/async.js";

export class TopPatchService {
  constructor({ view }) {
    this.view = view;
  }

  collectEditorPatch() {
    const values = this.view.topEditor.readValues();
    return this.view.topEditor.buildPatch(values);
  }

  applyPatchToLocalTop(top, patch) {
    if (!top || !patch || typeof patch !== "object") return;

    const applyField = (field, altField) => {
      if (patch[field] !== undefined) top[field] = patch[field];
      else if (altField && patch[altField] !== undefined) top[field] = patch[altField];
    };

    applyField("title");
    applyField("longtext");
    applyField("due_date", "dueDate");
    applyField("status");
    applyField("completed_in_meeting_id");
    applyField("is_hidden");
    applyField("is_important");
    applyField("is_task");
    applyField("is_decision");
    applyField("responsible_kind");
    applyField("responsible_id");
    applyField("responsible_label");
  }

  applyPatchToCurrentSelection(patch) {
    if (!patch) return;
    if (this.view.selectedTop) {
      this.applyPatchToLocalTop(this.view.selectedTop, patch);
    }
    const selId = this.view.selectedTop?.id;
    const inList = this.view.items.find((it) => this.view._sameTopId(it?.id, selId));
    if (inList && inList !== this.view.selectedTop) {
      this.applyPatchToLocalTop(inList, patch);
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
