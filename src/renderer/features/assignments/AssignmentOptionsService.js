export class AssignmentOptionsService {
  constructor({ view }) {
    this.view = view;
  }

  sanitizeResponsibleLabel(label) {
    return (label || "").toString().trim();
  }

  sanitizeContactPersonLabel(label) {
    return (label || "").toString().trim();
  }

  buildResponsibleDisplayLabel(row) {
    const kind = (row?.kind || "").toString().trim();
    const id = (row?.id ?? row?.firm_id ?? row?.firmId ?? row?.responsible_id ?? "").toString().trim();
    const number = (row?.number || "").toString().trim();
    const short = (row?.short || row?.shortName || "").toString().trim();
    const name = (row?.name || row?.label || row?.responsible_label || "").toString().trim();
    if (kind === "all") return "alle";
    if (kind && id && name && number) return `${number} ${name}`;
    if (name) return name;
    if (number) return number;
    if (short && name) return `${short} ${name}`;
    if (short) return short;
    if (id) return id;
    return "";
  }

  buildContactPersonDisplayLabel(row) {
    const fn = (row?.first_name || row?.firstName || "").toString().trim();
    const ln = (row?.last_name || row?.lastName || row?.name || "").toString().trim();
    const email = (row?.email || "").toString().trim();
    const phone = (row?.phone || "").toString().trim();
    if (fn && ln) return `${fn} ${ln}`;
    if (ln) return ln;
    if (fn) return fn;
    if (email) return email;
    if (phone) return phone;
    const id = (row?.id ?? row?.person_id ?? row?.personId ?? "").toString().trim();
    return id;
  }

  getResponsibleLabelForSelection(sel, parsed) {
    if (!sel || !parsed) return "";
    const selectedText = this.sanitizeResponsibleLabel(sel?.selectedOptions?.[0]?.textContent || "");
    if (selectedText) return selectedText;
    const value = this.buildResponsibleOptionValue(parsed.kind, parsed.id);
    const fromCandidates = (this.view.projectFirms || []).find(
      (c) => this.buildResponsibleOptionValue(c?.kind, c?.id ?? c?.firm_id ?? c?.firmId ?? null) === value
    );
    if (fromCandidates) return this.buildResponsibleDisplayLabel(fromCandidates);
    return this.buildResponsibleDisplayLabel({ id: parsed.id, kind: parsed.kind });
  }

  getContactPersonLabelForSelection(sel, parsed) {
    if (!sel || !parsed) return "";
    const selectedText = this.sanitizeContactPersonLabel(sel?.selectedOptions?.[0]?.textContent || "");
    if (selectedText) return selectedText;
    const value = this.buildContactPersonOptionValue(parsed.kind, parsed.id);
    const fromCandidates = (this.view.contactPersons || []).find(
      (c) => this.buildContactPersonOptionValue(c?.kind, c?.id ?? c?.person_id ?? c?.personId ?? null) === value
    );
    if (fromCandidates) return this.buildContactPersonDisplayLabel(fromCandidates);
    return this.buildContactPersonDisplayLabel({ id: parsed.id, kind: parsed.kind });
  }

  normalizeResponsibleCandidates(list) {
    const out = (list || []).map((row) => {
      const kind = (row?.kind || "").toString().trim() || "company";
      const id = (row?.id ?? row?.firm_id ?? row?.firmId ?? "").toString().trim();
      const number = (row?.number || "").toString().trim();
      const short = (row?.short || row?.shortName || "").toString().trim();
      const name = (row?.name || row?.label || row?.responsible_label || "").toString().trim();
      const displayLabel = this.buildResponsibleDisplayLabel({ kind, id, short, name, number });
      return { ...row, kind, id, label: displayLabel, displayLabel };
    });
    out.sort((a, b) => {
      const al = this.buildResponsibleDisplayLabel(a).toLocaleLowerCase("de-DE");
      const bl = this.buildResponsibleDisplayLabel(b).toLocaleLowerCase("de-DE");
      if (al < bl) return -1;
      if (al > bl) return 1;
      return 0;
    });
    return out;
  }

  normalizeContactPersonCandidates(list, kind) {
    const normKind = (kind || "").toString().trim() || "project_person";
    const out = (list || []).map((row) => {
      const id = (row?.id ?? row?.person_id ?? row?.personId ?? "").toString().trim();
      const label = this.buildContactPersonDisplayLabel(row);
      return { ...row, kind: normKind, id, label, displayLabel: label };
    });
    out.sort((a, b) => {
      const al = this.buildContactPersonDisplayLabel(a).toLocaleLowerCase("de-DE");
      const bl = this.buildContactPersonDisplayLabel(b).toLocaleLowerCase("de-DE");
      if (al < bl) return -1;
      if (al > bl) return 1;
      return 0;
    });
    return out;
  }

  buildResponsibleOptionValue(kind, id) {
    const idStr = id === null || id === undefined ? "" : String(id).trim();
    const kindStr = (kind || "").toString().trim() || "company";
    if (!idStr && kindStr !== "all") return "";
    return `${kindStr}::${idStr}`;
  }

  parseResponsibleOptionValue(value) {
    const raw = (value || "").toString();
    if (!raw || raw === "__legacy_responsible__") return null;
    if (raw.startsWith("__legacy_responsible__")) return null;
    const [kind, id] = raw.split("::");
    return { kind: kind || "company", id: id || "" };
  }

  buildContactPersonOptionValue(kind, id) {
    const idStr = id === null || id === undefined ? "" : String(id).trim();
    const kindStr = (kind || "").toString().trim() || "project_person";
    if (!idStr) return "";
    return `${kindStr}::${idStr}`;
  }

  parseContactPersonOptionValue(value) {
    const raw = (value || "").toString();
    if (!raw || raw === "__legacy_contact_person__") return null;
    if (raw.startsWith("__legacy_contact_person__")) return null;
    const [kind, id] = raw.split("::");
    return { kind: kind || "project_person", id: id || "" };
  }

  normalizeResponsibleKind(kind) {
    const k = (kind || "").toString().trim();
    if (k === "project_firm") return "company";
    if (k === "global_firm") return "firm";
    return k;
  }

  findResponsibleOption(sel, value) {
    if (!sel) return null;
    const val = (value || "").toString();
    return Array.from(sel.options || []).find((o) => o.value === val) || null;
  }

  findContactPersonOption(sel, value) {
    if (!sel) return null;
    const val = (value || "").toString();
    return Array.from(sel.options || []).find((o) => o.value === val) || null;
  }

  clearLegacyResponsibleOption(sel) {
    if (!sel) return;
    Array.from(sel.options || []).forEach((opt) => {
      if (opt?.dataset?.legacyResponsible === "1") {
        opt.remove();
      }
    });
    if (String(sel.value || "").startsWith("__legacy_responsible__")) {
      sel.value = "";
    }
  }

  clearLegacyContactPersonOption(sel) {
    if (!sel) return;
    Array.from(sel.options || []).forEach((opt) => {
      if (opt?.dataset?.legacyContactPerson === "1") {
        opt.remove();
      }
    });
    if (String(sel.value || "").startsWith("__legacy_contact_person__")) {
      sel.value = "";
    }
  }

  setLegacyResponsibleOption(sel, label) {
    if (!sel) return;
    const text = this.sanitizeResponsibleLabel(label);
    if (!text) {
      this.clearLegacyResponsibleOption(sel);
      return;
    }
    let opt = Array.from(sel.options || []).find((o) => o?.dataset?.legacyResponsible === "1") || null;
    if (!opt) {
      opt = document.createElement("option");
      opt.dataset.legacyResponsible = "1";
      sel.appendChild(opt);
    }
    opt.value = "__legacy_responsible__";
    opt.textContent = text;
    sel.value = opt.value;
  }

  setLegacyContactPersonOption(sel, label) {
    if (!sel) return;
    const text = this.sanitizeContactPersonLabel(label);
    if (!text) {
      this.clearLegacyContactPersonOption(sel);
      return;
    }
    let opt = Array.from(sel.options || []).find((o) => o?.dataset?.legacyContactPerson === "1") || null;
    if (!opt) {
      opt = document.createElement("option");
      opt.dataset.legacyContactPerson = "1";
      sel.appendChild(opt);
    }
    opt.value = "__legacy_contact_person__";
    opt.textContent = text;
    sel.value = opt.value;
  }

  resolveResponsibleSelection(top) {
    const rid = (top?.responsible_id ?? "").toString().trim();
    const rk = (top?.responsible_kind ?? "").toString().trim();
    const rl = this.sanitizeResponsibleLabel(top?.responsible_label);
    if (!rid) return { value: "", fallbackLabel: "" };
    if (!this.view.isNewUi) return { value: rid, fallbackLabel: "" };

    const candidates = this.view.projectFirms || [];
    if (!candidates.length) {
      return { value: "", fallbackLabel: rl || this.buildResponsibleDisplayLabel({ kind: rk, id: rid }) };
    }

    const exactKind = candidates.find((c) => String(c.kind) === rk && String(c.id) === rid);
    if (exactKind) {
      return { value: this.buildResponsibleOptionValue(exactKind.kind, exactKind.id), fallbackLabel: "" };
    }

    const mappedKind = this.normalizeResponsibleKind(rk);
    if (mappedKind) {
      const mapped = candidates.find((c) => String(c.kind) === mappedKind && String(c.id) === rid);
      if (mapped) {
        return { value: this.buildResponsibleOptionValue(mapped.kind, mapped.id), fallbackLabel: "" };
      }
    }

    const sameId = candidates.filter((c) => String(c.id) === rid);
    if (sameId.length === 1) {
      const only = sameId[0];
      return { value: this.buildResponsibleOptionValue(only.kind, only.id), fallbackLabel: "" };
    }

    if (sameId.length > 1 && rl) {
      const rlNorm = rl.toLocaleLowerCase("de-DE");
      const byLabel = sameId.find((c) => String(c.label || "").toLocaleLowerCase("de-DE") === rlNorm);
      if (byLabel) {
        return { value: this.buildResponsibleOptionValue(byLabel.kind, byLabel.id), fallbackLabel: "" };
      }
    }

    if (rl) {
      const rlNorm = rl.toLocaleLowerCase("de-DE");
      const byAnyLabel = candidates.filter(
        (c) => String(c.label || "").toLocaleLowerCase("de-DE") === rlNorm
      );
      if (byAnyLabel.length === 1) {
        const one = byAnyLabel[0];
        return { value: this.buildResponsibleOptionValue(one.kind, one.id), fallbackLabel: "" };
      }
    }

    return { value: "", fallbackLabel: rl || this.buildResponsibleDisplayLabel({ kind: rk, id: rid }) };
  }

  async ensureProjectFirmsLoaded() {
    if (this.view._projectFirmsLoaded) return;
    if (this.view._projectFirmsLoading) return await this.view._projectFirmsLoading;

    const api = window.bbmDb || {};
    this.view._projectFirmsLoading = (async () => {
      if (!this.view.isNewUi) {
        if (typeof api.projectFirmsListByProject === "function") {
          const res = await api.projectFirmsListByProject(this.view.projectId);
          if (res?.ok) {
            const raw = (res.list || []).map((row) => ({
              ...row,
              kind: "company",
              id: row?.id ?? row?.firm_id ?? row?.firmId ?? null,
            }));
            this.view.projectFirms = this.normalizeResponsibleCandidates(raw);
          } else {
            this.view.projectFirms = [];
          }
        } else {
          this.view.projectFirms = [];
        }
        this.view._projectFirmsLoaded = true;
        return;
      }

      let list = [];
      if (this.view.isNewUi && typeof api.projectFirmsListFirmCandidatesByProject === "function") {
        const res = await api.projectFirmsListFirmCandidatesByProject(this.view.projectId);
        if (res?.ok) {
          const raw = res.list || res.items || [];
          list = this.normalizeResponsibleCandidates(raw);
        }
      }

      if (!list.length && typeof api.projectFirmsListByProject === "function") {
        const res = await api.projectFirmsListByProject(this.view.projectId);
        if (res?.ok) {
          const raw = (res.list || []).map((row) => ({
            ...row,
            kind: "company",
            id: row?.id ?? row?.firm_id ?? row?.firmId ?? null,
          }));
          list = this.normalizeResponsibleCandidates(raw);
        }
      }

      this.view.projectFirms = list;
      this.view._projectFirmsLoaded = true;
    })();

    try {
      await this.view._projectFirmsLoading;
    } finally {
      this.view._projectFirmsLoading = null;
    }
  }

  computeRespOptionsKey(list) {
    const base = String(this.view.projectId || "");
    const parts = (list || []).map((f) => {
      const kind = (f?.kind || "").toString().trim();
      const id = (f?.id ?? f?.firm_id ?? f?.firmId ?? "").toString().trim();
      const label = this.buildResponsibleDisplayLabel(f);
      return `${kind}|${id}|${label}`;
    });
    return `${base}::${parts.join("#")}`;
  }

  buildResponsibleOptionsIfNeeded(selResponsible) {
    if (!selResponsible) return;

    const key = this.computeRespOptionsKey(this.view.projectFirms || []);
    if (key === this.view._respOptionsKey) return;

    const sel = selResponsible;
    const current = (sel.value || "").toString();

    sel.innerHTML = "";
    this.view._respLegacyReadonly = false;

    const optAll = document.createElement("option");
    optAll.value = this.buildResponsibleOptionValue("all", "all");
    optAll.textContent = "alle";
    sel.appendChild(optAll);

    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "-";
    sel.appendChild(optEmpty);

    for (const f of this.view.projectFirms || []) {
      const value = this.buildResponsibleOptionValue(f?.kind, f?.id ?? f?.firm_id ?? f?.firmId ?? null);
      if (!value) continue;
      const label = this.buildResponsibleDisplayLabel(f);
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      opt.dataset.displayLabel = label;
      sel.appendChild(opt);
    }

    this.view._respOptionsKey = key;

    if (current && this.findResponsibleOption(sel, current)) {
      sel.value = current;
    } else {
      sel.value = "";
    }
  }

  async loadContactPersonsForResponsible(parsed) {
    const api = window.bbmDb || {};
    const kind = (parsed?.kind || "").toString().trim();
    const id = (parsed?.id || "").toString().trim();
    if (!id || kind === "all") {
      this.view.contactPersons = [];
      this.view._contactSourceKey = "";
      return [];
    }

    let list = [];
    let normalizedKind = "project_person";
    let activeCandidateSet = null;

    if (this.view.projectId && typeof api.projectCandidatesList === "function") {
      try {
        const candidateRes = await api.projectCandidatesList({ projectId: this.view.projectId });
        if (candidateRes?.ok) {
          const rawCandidates = candidateRes.items || candidateRes.list || candidateRes.data || [];
          activeCandidateSet = new Set(
            (rawCandidates || [])
              .filter((row) => Number(row?.is_active ?? row?.isActive ?? 1) === 1)
              .map((row) => {
                const candidateKind = String(row?.kind || "").trim();
                const personId = String(row?.personId ?? row?.person_id ?? "").trim();
                return candidateKind && personId ? `${candidateKind}::${personId}` : "";
              })
              .filter((key) => !!key)
          );
        }
      } catch (_) {}
    }

    if (kind === "project_firm" || kind === "company") {
      normalizedKind = "project_person";
      if (typeof api.projectPersonsListByProjectFirm === "function") {
        const res = await api.projectPersonsListByProjectFirm(id);
        if (res?.ok) {
          list = this.normalizeContactPersonCandidates(res.list || res.items || res.rows || [], normalizedKind);
          if (activeCandidateSet) {
            list = list.filter((row) => activeCandidateSet.has(`project_person::${String(row?.id || "").trim()}`));
          }
        }
      }
    } else if (kind === "global_firm" || kind === "firm") {
      normalizedKind = "global_person";
      if (typeof api.personsListByFirm === "function") {
        const res = await api.personsListByFirm(id);
        if (res?.ok) {
          list = this.normalizeContactPersonCandidates(res.list || res.items || res.rows || [], normalizedKind);
          if (activeCandidateSet) {
            list = list.filter((row) => activeCandidateSet.has(`global_person::${String(row?.id || "").trim()}`));
          }
        }
      }
    }

    this.view.contactPersons = list;
    this.view._contactSourceKey = `${kind}::${id}`;
    return list;
  }

  computeContactOptionsKey(sourceKey, list) {
    const base = String(sourceKey || "");
    const parts = (list || []).map((p) => {
      const kind = (p?.kind || "").toString().trim();
      const id = (p?.id ?? p?.person_id ?? p?.personId ?? "").toString().trim();
      const label = this.buildContactPersonDisplayLabel(p);
      return `${kind}|${id}|${label}`;
    });
    return `${base}::${parts.join("#")}`;
  }

  buildContactOptionsIfNeeded(selContactPerson, sourceKey) {
    if (!selContactPerson) return;

    const key = this.computeContactOptionsKey(sourceKey, this.view.contactPersons || []);
    if (key === this.view._contactOptionsKey) return;

    const sel = selContactPerson;
    const current = (sel.value || "").toString();

    sel.innerHTML = "";
    this.view._contactLegacyReadonly = false;

    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "-";
    sel.appendChild(optEmpty);

    for (const p of this.view.contactPersons || []) {
      const value = this.buildContactPersonOptionValue(p?.kind, p?.id ?? p?.person_id ?? p?.personId ?? null);
      if (!value) continue;
      const label = this.buildContactPersonDisplayLabel(p);
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      opt.dataset.displayLabel = label;
      sel.appendChild(opt);
    }

    this.view._contactOptionsKey = key;

    if (current && this.findContactPersonOption(sel, current)) {
      sel.value = current;
    } else {
      sel.value = "";
    }
  }

  resolveContactPersonSelection(top) {
    const pid = (top?.contact_person_id ?? "").toString().trim();
    const pk = (top?.contact_person_kind ?? "").toString().trim();
    const pl = this.sanitizeContactPersonLabel(top?.contact_person_label);
    if (!pid) return { value: "", fallbackLabel: "" };
    if (!this.view.isNewUi) return { value: pid, fallbackLabel: "" };

    const candidates = this.view.contactPersons || [];
    if (!candidates.length) {
      return { value: "", fallbackLabel: pl || this.buildContactPersonDisplayLabel({ kind: pk, id: pid }) };
    }

    const exactKind = candidates.find((c) => String(c.kind) === pk && String(c.id) === pid);
    if (exactKind) {
      return { value: this.buildContactPersonOptionValue(exactKind.kind, exactKind.id), fallbackLabel: "" };
    }

    const sameId = candidates.filter((c) => String(c.id) === pid);
    if (sameId.length === 1) {
      const only = sameId[0];
      return { value: this.buildContactPersonOptionValue(only.kind, only.id), fallbackLabel: "" };
    }

    if (pl) {
      const plNorm = pl.toLocaleLowerCase("de-DE");
      const byLabel = candidates.filter((c) => String(c.label || "").toLocaleLowerCase("de-DE") === plNorm);
      if (byLabel.length === 1) {
        const one = byLabel[0];
        return { value: this.buildContactPersonOptionValue(one.kind, one.id), fallbackLabel: "" };
      }
    }

    return { value: "", fallbackLabel: pl || this.buildContactPersonDisplayLabel({ kind: pk, id: pid }) };
  }
}
