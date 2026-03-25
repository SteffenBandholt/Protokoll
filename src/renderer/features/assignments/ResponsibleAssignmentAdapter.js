export class ResponsibleAssignmentAdapter {
  constructor({ view }) {
    this.view = view;
  }

  readFromTop(top) {
    const id = (top?.responsible_id ?? top?.responsibleId ?? "").toString().trim();
    if (!id) return null;

    const kind = (top?.responsible_kind ?? top?.responsibleKind ?? "").toString().trim();
    const label = this.view._sanitizeResponsibleLabel(top?.responsible_label ?? top?.responsibleLabel);
    return { kind, id, label };
  }

  writeToSelect(sel, responsible, options) {
    if (!sel) return;

    this.view._clearLegacyResponsibleOption();
    if (!responsible?.id) {
      sel.value = "";
      return;
    }

    const value = this._findSelectValue(responsible, sel, options);
    if (value) {
      sel.value = value;
      return;
    }

    if (responsible.label) {
      this.view._setLegacyResponsibleOption(responsible.label);
      return;
    }

    sel.value = "";
  }

  readFromSelect(sel, options) {
    if (!sel) return null;

    const parsed = this.view._parseResponsibleOptionValue(sel.value);
    if (!parsed?.id) return null;

    const value = (sel.value || "").toString();
    const label =
      this.view._sanitizeResponsibleLabel(sel.selectedOptions?.[0]?.textContent || "") ||
      this._findOptionLabel(value, options) ||
      this.view._buildResponsibleDisplayLabel({ kind: parsed.kind, id: parsed.id });

    return {
      kind: (parsed.kind || "company").toString().trim(),
      id: String(parsed.id).trim(),
      label,
    };
  }

  toPatch(responsible) {
    if (!responsible?.id) {
      return {
        responsible_kind: null,
        responsible_id: null,
        responsible_label: null,
      };
    }

    return {
      responsible_kind: (responsible.kind || "company").toString().trim() || "company",
      responsible_id: String(responsible.id).trim(),
      responsible_label: this.view._sanitizeResponsibleLabel(responsible.label),
    };
  }

  _findSelectValue(responsible, sel, options) {
    const direct = this.view._buildResponsibleOptionValue(responsible.kind, responsible.id);
    if (direct && this.view._findResponsibleOption(direct)) return direct;

    const mappedKind = this.view._normalizeResponsibleKind(responsible.kind);
    const mappedValue = this.view._buildResponsibleOptionValue(mappedKind, responsible.id);
    if (mappedValue && this.view._findResponsibleOption(mappedValue)) return mappedValue;

    const sameId = (options || []).filter((item) => String(item?.id || "").trim() === responsible.id);
    if (sameId.length === 1) {
      const only = sameId[0];
      const onlyValue = this.view._buildResponsibleOptionValue(only.kind, only.id);
      if (onlyValue && this.view._findResponsibleOption(onlyValue)) return onlyValue;
    }

    if (sameId.length > 1 && responsible.label) {
      const labelNorm = responsible.label.toLocaleLowerCase("de-DE");
      const byLabel = sameId.find(
        (item) => this.view._buildResponsibleDisplayLabel(item).toLocaleLowerCase("de-DE") === labelNorm
      );
      if (byLabel) {
        const byLabelValue = this.view._buildResponsibleOptionValue(byLabel.kind, byLabel.id);
        if (byLabelValue && this.view._findResponsibleOption(byLabelValue)) return byLabelValue;
      }
    }

    return "";
  }

  _findOptionLabel(value, options) {
    const match = (options || []).find(
      (item) => this.view._buildResponsibleOptionValue(item?.kind, item?.id) === value
    );
    return match ? this.view._buildResponsibleDisplayLabel(match) : "";
  }
}
