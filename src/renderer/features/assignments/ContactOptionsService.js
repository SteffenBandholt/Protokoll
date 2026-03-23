export class ContactOptionsService {
  constructor({ view }) {
    this.view = view;
  }

  sanitizeContactPersonLabel(label) {
    const s = (label ?? "").toString().trim();
    if (!s) return "";
    if (s === "?" || s === "-") return "";
    if (/^\?+$/.test(s)) return "";
    return s;
  }

  buildContactPersonDisplayLabel(row) {
    const name = (row?.name || "").toString().trim();
    if (name) return name;
    const first = (row?.first_name ?? row?.firstName ?? "").toString().trim();
    const last = (row?.last_name ?? row?.lastName ?? "").toString().trim();
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;

    const rawId = row?.id ?? row?.person_id ?? row?.personId ?? "";
    const id = rawId === null || rawId === undefined ? "" : String(rawId).trim();
    if (id) return `Unbenannter Mitarbeiter (ID: ${id})`;
    return "Unbenannter Mitarbeiter";
  }

  getContactPersonLabelForSelection(sel, parsed) {
    if (!parsed?.id) return null;

    const selectedText = this.sanitizeContactPersonLabel(sel?.selectedOptions?.[0]?.textContent || "");
    if (selectedText) return selectedText;

    const value = (sel?.value || "").toString();
    const fromCandidates = (this.view.contactPersons || []).find(
      (c) =>
        this.buildContactPersonOptionValue(c?.kind, c?.id ?? c?.person_id ?? c?.personId ?? null) === value
    );
    if (fromCandidates) return this.buildContactPersonDisplayLabel(fromCandidates);

    return this.buildContactPersonDisplayLabel({ id: parsed.id, kind: parsed.kind });
  }

  normalizeContactPersonCandidates(list, kind) {
    const out = [];
    const seen = new Set();
    for (const row of list || []) {
      const rawId = row?.id ?? row?.person_id ?? row?.personId ?? null;
      if (rawId === null || rawId === undefined || rawId === "") continue;

      const id = String(rawId).trim();
      if (!id) continue;

      const normalizedKind =
        (kind || row?.kind || "").toString().trim() || (this.view.isNewUi ? "project_person" : "person");
      const label = this.buildContactPersonDisplayLabel(row);
      const key = `${normalizedKind}::${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ ...row, kind: normalizedKind, id, label, displayLabel: label });
    }

    out.sort((a, b) => {
      const al = this.buildContactPersonDisplayLabel(a).toLocaleLowerCase("de-DE");
      const bl = this.buildContactPersonDisplayLabel(b).toLocaleLowerCase("de-DE");
      if (al < bl) return -1;
      if (al > bl) return 1;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });

    return out;
  }

  buildContactPersonOptionValue(kind, id) {
    const idStr = id === null || id === undefined ? "" : String(id).trim();
    if (!idStr) return "";
    if (!this.view.isNewUi) return idStr;
    const kindStr = (kind || "").toString().trim() || "project_person";
    return `${kindStr}::${idStr}`;
  }

  parseContactPersonOptionValue(value) {
    const raw = (value || "").toString().trim();
    if (!raw) return null;
    if (raw.startsWith("__legacy_contact_person__")) return null;
    if (!this.view.isNewUi) return { kind: "project_person", id: raw };

    const sep = raw.indexOf("::");
    if (sep <= 0) return null;
    const kind = raw.slice(0, sep).trim();
    const id = raw.slice(sep + 2).trim();
    if (!kind || !id) return null;
    return { kind, id };
  }

  findContactPersonOption(sel, value) {
    if (!sel) return null;
    const target = (value || "").toString();
    return Array.from(sel.options || []).find((o) => String(o.value) === target) || null;
  }

  clearLegacyContactPersonOption(sel) {
    if (!sel) return;
    for (const opt of Array.from(sel.options || [])) {
      if (opt?.dataset?.legacyContactPerson === "1") {
        opt.remove();
      }
    }
    if (String(sel.value || "").startsWith("__legacy_contact_person__")) {
      sel.value = "";
    }
    this.view._contactLegacyReadonly = false;
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
    this.view._contactLegacyReadonly = true;
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
      const byLabel = candidates.filter(
        (c) => String(c.label || "").toLocaleLowerCase("de-DE") === plNorm
      );
      if (byLabel.length === 1) {
        const one = byLabel[0];
        return { value: this.buildContactPersonOptionValue(one.kind, one.id), fallbackLabel: "" };
      }
    }

    return { value: "", fallbackLabel: pl || this.buildContactPersonDisplayLabel({ kind: pk, id: pid }) };
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
      const kindVal = (p?.kind || "").toString().trim();
      const idVal = (p?.id ?? p?.person_id ?? p?.personId ?? "").toString().trim();
      const label = this.buildContactPersonDisplayLabel(p);
      return `${kindVal}|${idVal}|${label}`;
    });
    return `${base}::${parts.join("#")}`;
  }

  buildContactOptionsIfNeeded(sourceKey, selContactPerson) {
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
}
