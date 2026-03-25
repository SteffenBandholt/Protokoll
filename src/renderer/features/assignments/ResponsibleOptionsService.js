export class ResponsibleOptionsService {
  constructor({ view }) {
    this.view = view;
  }

  sanitizeResponsibleLabel(label) {
    const s = (label ?? "").toString().trim();
    if (!s) return "";
    if (s === "?" || s === "-" || s === "—") return "";
    if (/^\?+$/.test(s)) return "";
    return s;
  }

  buildResponsibleDisplayLabel(row) {
    const s = (row?.short || "").toString().trim();
    if (s) return s;
    const n = (row?.name || "").toString().trim();
    if (n) return n;

    const rawId = row?.id ?? row?.firm_id ?? row?.firmId ?? "";
    const id = rawId === null || rawId === undefined ? "" : String(rawId).trim();
    if (id) return `Unbenannte Firma (ID: ${id})`;
    return "Unbenannte Firma";
  }

  getResponsibleLabelForSelection(sel, parsed) {
    if (!sel || !parsed) return "";
    const selectedText = this.sanitizeResponsibleLabel(sel?.selectedOptions?.[0]?.textContent || "");
    if (selectedText) return selectedText;

    const value = (sel?.value || "").toString();
    const fromCandidates = (this.view.projectFirms || []).find(
      (c) => this.buildResponsibleOptionValue(c?.kind, c?.id ?? c?.firm_id ?? c?.firmId ?? null) === value
    );
    if (fromCandidates) return this.buildResponsibleDisplayLabel(fromCandidates);

    return this.buildResponsibleDisplayLabel({ id: parsed.id, kind: parsed.kind });
  }

  normalizeResponsibleCandidates(list) {
    const out = [];
    const seen = new Set();
    for (const row of list || []) {
      const activeRaw = row?.is_active ?? row?.isActive;
      if (activeRaw !== undefined && activeRaw !== null) {
        if (this.view._parseActiveFlag(activeRaw) === 0) continue;
      }
      const rawId = row?.id ?? row?.firm_id ?? row?.firmId ?? null;
      if (rawId === null || rawId === undefined || rawId === "") continue;

      const kindRaw = (row?.kind || "").toString().trim();
      const kind = kindRaw || (this.view.isNewUi ? "project_firm" : "company");
      const id = String(rawId).trim();
      if (!id) continue;

      const short = (row?.short || "").toString().trim();
      const name = (row?.name || "").toString().trim();
      const displayLabel = this.buildResponsibleDisplayLabel({ kind, id, short, name });
      const key = `${kind}::${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ kind, id, short, name, label: displayLabel, displayLabel });
    }

    out.sort((a, b) => {
      const al = this.buildResponsibleDisplayLabel(a).toLocaleLowerCase("de-DE");
      const bl = this.buildResponsibleDisplayLabel(b).toLocaleLowerCase("de-DE");
      if (al < bl) return -1;
      if (al > bl) return 1;
      const ak = String(a?.kind || "");
      const bk = String(b?.kind || "");
      if (ak < bk) return -1;
      if (ak > bk) return 1;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });

    return out;
  }

  buildResponsibleOptionValue(kind, id) {
    const idStr = id === null || id === undefined ? "" : String(id).trim();
    if (!idStr) return "";
    if (!this.view.isNewUi) return idStr;
    const kindStr = (kind || "").toString().trim() || "project_firm";
    return `${kindStr}::${idStr}`;
  }

  parseResponsibleOptionValue(value) {
    const raw = (value || "").toString().trim();
    if (!raw) return null;
    if (raw.startsWith("__legacy_responsible__")) return null;
    if (!this.view.isNewUi) {
      return { kind: "company", id: raw };
    }

    const sep = raw.indexOf("::");
    if (sep <= 0) return null;
    const kind = raw.slice(0, sep).trim();
    const id = raw.slice(sep + 2).trim();
    if (!kind || !id) return null;
    return { kind, id };
  }

  normalizeResponsibleKind(kind) {
    const s = (kind || "").toString().trim().toLowerCase();
    if (!s) return "";
    if (s === "project_firm" || s === "global_firm") return s;
    if (s.includes("global")) return "global_firm";
    if (s.includes("project") || s.includes("local")) return "project_firm";
    if (["company", "firma", "firm"].includes(s)) return "";
    return s;
  }

  findResponsibleOption(sel, value) {
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
    this.view._respLegacyReadonly = false;
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
    this.view._respLegacyReadonly = true;
  }

  resolveResponsibleSelection(top) {
    const rid = (top?.responsible_id ?? top?.responsibleId ?? "").toString().trim();
    const rk = (top?.responsible_kind ?? top?.responsibleKind ?? "").toString().trim();
    const rl = this.sanitizeResponsibleLabel(top?.responsible_label ?? top?.responsibleLabel);
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
}
