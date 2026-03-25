export class TopEditorController {
  constructor({ view }) {
    this.view = view;
  }

  readValues() {
    return {
      title: this.view.inpTitle && !this.view.inpTitle.disabled ? this.view.inpTitle.value : undefined,
      longtext:
        this.view.taLongtext && !this.view.taLongtext.disabled ? this.view.taLongtext.value : undefined,
      due_date:
        this.view.inpDueDate && !this.view.inpDueDate.disabled ? this.view.inpDueDate.value : undefined,
      status: this.view.selStatus && !this.view.selStatus.disabled ? this.view.selStatus.value : undefined,
      responsible_value: this.view.selResponsible ? this.view.selResponsible.value : undefined,
      is_hidden: this.view.chkHidden && !this.view.chkHidden.disabled ? this.view.chkHidden.checked : undefined,
      is_important:
        this.view.chkImportant && !this.view.chkImportant.disabled
          ? this.view.chkImportant.checked
          : undefined,
      is_task: this.view.chkTask && !this.view.chkTask.disabled ? this.view.chkTask.checked : undefined,
      is_decision:
        this.view.chkDecision && !this.view.chkDecision.disabled
          ? this.view.chkDecision.checked
          : undefined,
      responsible_kind: undefined,
      responsible_id: undefined,
      responsible_label: undefined,
    };
  }

  buildPatch(values) {
    const t = this.view.selectedTop;
    if (!t) return null;

    const patch = {};

    if (values.title !== undefined) {
      patch.title = this.view._normTitle(values.title);
    }

    if (values.longtext !== undefined) {
      patch.longtext = this.view._normLong(values.longtext);
    }

    if (values.is_important !== undefined) {
      patch.is_important = values.is_important ? 1 : 0;
    }

    if (values.is_decision !== undefined) {
      patch.is_decision = values.is_decision ? 1 : 0;
    }

    if (values.due_date !== undefined) {
      const dueVal = (values.due_date || "").trim();
      patch.due_date = dueVal || null;
    }

    if (values.status !== undefined) {
      const rawStatus = (values.status || "").trim();
      const st = rawStatus && rawStatus.toLowerCase() === "alle" ? "" : rawStatus;
      patch.status = st;
      patch.completed_in_meeting_id = this.view._isDoneStatus(patch.status) ? this.view.meetingId : null;
    }

    if (values.responsible_value !== undefined) {
      const responsible = this.view._readResponsibleFromSelect(this.view.selResponsible, this.view.projectFirms || []);
      Object.assign(patch, this.view._responsibleToPatch(responsible));
    }

    return patch;
  }
}
