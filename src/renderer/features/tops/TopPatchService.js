import { fireAndForget } from "../../utils/async.js";

export class TopPatchService {
  constructor({ view }) {
    this.view = view;
  }

  collectEditorPatch() {
    const values = this.view.topEditor.readValues();
    return this.view.topEditor.buildPatch(values);
  }

  async saveMeetingTopPatch(patch, { reload = true, pulse = false } = {}) {
    if (this.view.isReadOnly) return;
    if (this.view._busy) return;

    const selected = this.view.selectedTop || this.view._findTopById(this.view.selectedTopId);
    const selectedTopId = selected?.id ?? this.view.selectedTopId;
    if (!selectedTopId) return;
    const selectedInItems = this.view._findTopById(selectedTopId);
    if (!selectedInItems) return;

    const nextPatch = patch && typeof patch === "object" ? { ...patch } : {};

    if (this.view.inpTitle?.disabled) delete nextPatch.title;
    if (this.view.taLongtext?.disabled) delete nextPatch.longtext;
    if (this.view.inpDueDate?.disabled) delete nextPatch.due_date;
    if (this.view.selStatus?.disabled) {
      delete nextPatch.status;
      delete nextPatch.completed_in_meeting_id;
    }
    if (this.view.selResponsible?.disabled) {
      delete nextPatch.responsible_kind;
      delete nextPatch.responsible_id;
      delete nextPatch.responsible_label;
    }
    if (this.view.chkHidden?.disabled) delete nextPatch.is_hidden;
    if (this.view.chkImportant?.disabled) delete nextPatch.is_important;
    if (this.view.chkTask?.disabled) delete nextPatch.is_task;
    if (this.view.chkDecision?.disabled) delete nextPatch.is_decision;

    if (Number(selectedInItems.is_carried_over) === 1) {
      delete nextPatch.title;
    }

    if (Object.keys(nextPatch).length === 0) return;

    this.view._setBusy(true);
    try {
      const res = await this.view.topService.updateTop({
        meetingId: this.view.meetingId,
        topId: selectedInItems.id,
        patch: nextPatch,
      });

      if (!res?.ok) {
        this.handleSaveTopError({ res });
        return res;
      }

      this.handleSaveTopSuccess({ nextPatch, reload, pulse, res });
      return res;
    } finally {
      this.view._setBusy(false);
    }
  }

  handleSaveTopSuccess({ nextPatch, reload, pulse, res }) {
    this.applyPatchAndRefresh(nextPatch, { reload, pulse });
  }

  handleSaveTopError({ res }) {
    alert(res?.error || "Fehler beim Speichern");
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
