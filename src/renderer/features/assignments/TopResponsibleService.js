export class TopResponsibleService {
  constructor({ view }) {
    this.view = view;
  }

  getFromTop(top) {
    return {
      kind: top?.responsible_kind ?? top?.responsibleKind ?? "",
      id: top?.responsible_id ?? top?.responsibleId ?? "",
      label: top?.responsible_label ?? top?.responsibleLabel ?? "",
    };
  }

  sanitizeLabel(label) {
    return this.view.responsibleOptionsService.sanitizeResponsibleLabel(label);
  }

  format(top) {
    const resp = this.getFromTop(top);
    const lbl = this.sanitizeLabel(resp.label);
    if (!lbl) return "—";
    const max = 22;
    return lbl.length <= max ? lbl : lbl.slice(0, max - 1) + "…";
  }

  toPatch(responsible) {
    return this.view.responsibleAssignmentAdapter.toPatch(responsible);
  }
}
