const api = window.bbmDb || null;

function mkEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

function mkInput(type, value) {
  const inp = document.createElement("input");
  inp.type = type || "text";
  inp.value = value || "";
  return inp;
}

function mkTextarea(value) {
  const ta = document.createElement("textarea");
  ta.rows = 3;
  ta.value = value || "";
  return ta;
}

function collect(map) {
  const data = {};
  Object.entries(map).forEach(([key, el]) => {
    const raw = el?.value || "";
    data[key] = String(raw).trim();
  });
  return data;
}

function _defaultRoleLabels() {
  return {
    10: "Bauherr",
    20: "Planer",
    30: "Sachverstaendige",
    40: "Ing.-Bueros",
    50: "Gewerke",
    60: "Sonstige",
  };
}

function _defaultRoleOrder() {
  return [10, 20, 30, 40, 50, 60];
}

function _normalizeRoleLabels(raw) {
  const out = { ..._defaultRoleLabels() };
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed)) {
        const n = Number(k);
        const label = String(v || "").trim();
        if (!Number.isFinite(n) || n <= 0 || !label) continue;
        out[n] = label;
      }
    }
  } catch {
    // keep defaults
  }
  return out;
}

function _normalizeRoleOrder(raw, labelsMap) {
  let parsed = [];
  try {
    const arr = JSON.parse(raw || "[]");
    if (Array.isArray(arr)) parsed = arr;
  } catch {
    parsed = [];
  }
  const out = [];
  const seen = new Set();
  for (const v of parsed) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  for (const n of _defaultRoleOrder()) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  for (const n of Object.keys(labelsMap || {}).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

async function init() {
  const root = document.getElementById("root");
  if (!api?.editorGetInit || !api?.editorDone) {
    root.textContent = "Editor API fehlt.";
    return;
  }

  const initPayload = await api.editorGetInit();
  if (!initPayload || !initPayload.kind) {
    root.textContent = "Keine Editor-Daten gefunden.";
    return;
  }
  if (initPayload.title) {
    document.title = initPayload.title;
  }

  const card = mkEl("div", "card");
  const header = mkEl("div", "header");
  header.appendChild(mkEl("div", "title", initPayload.title || "Bearbeiten"));
  if (initPayload.subtitle) {
    header.appendChild(mkEl("div", "subtitle", initPayload.subtitle));
  }

  const form = mkEl("div", "form");
  const inputs = {};

  if (initPayload.kind === "firm") {
    const firm = initPayload.firm || {};
    let roleLabels = _defaultRoleLabels();
    let roleOrder = _defaultRoleOrder();
    try {
      if (typeof api?.appSettingsGetMany === "function") {
        const resRoles = await api.appSettingsGetMany(["firm_role_order", "firm_role_labels"]);
        if (resRoles?.ok) {
          roleLabels = _normalizeRoleLabels(resRoles?.data?.firm_role_labels || "");
          roleOrder = _normalizeRoleOrder(resRoles?.data?.firm_role_order || "", roleLabels);
        }
      }
    } catch {
      // keep defaults
    }
    const fields = [
      ["name", "Name 1", "text", firm.name],
      ["name2", "Name 2", "text", firm.name2],
      ["short", "Kurzbez.", "text", firm.short],
      ["street", "Straße", "text", firm.street],
      ["zip", "PLZ", "text", firm.zip],
      ["city", "Ort", "text", firm.city],
      ["phone", "Telefon", "text", firm.phone],
      ["email", "E-Mail", "email", firm.email],
          ];
    fields.forEach(([key, label, type, value]) => {
      form.appendChild(mkEl("div", null, label));
      const inp = mkInput(type, value);
      if (key === "short") inp.placeholder = "verantw. im Projekt";
      inputs[key] = inp;
      form.appendChild(inp);
    });

    form.appendChild(mkEl("div", null, "Gewerk"));
    const gewerkInput = mkInput("text", firm.gewerk);
    gewerkInput.setAttribute("list", "editor-gewerk-options");
    inputs.gewerk = gewerkInput;
    form.appendChild(gewerkInput);
    const gewerkOptions = document.createElement("datalist");
    gewerkOptions.id = "editor-gewerk-options";
    ["Rohbau", "HLS", "Elektro", "Trockenbau", "Gala-Bau", "Erdarbeiten", "Abbruch"].forEach(
      (label) => {
        const opt = document.createElement("option");
        opt.value = label;
        gewerkOptions.appendChild(opt);
      }
    );
    form.appendChild(gewerkOptions);

    form.appendChild(mkEl("div", null, "Kategorie"));
    const roleSelect = document.createElement("select");
    roleOrder.forEach((code) => {
      const opt = document.createElement("option");
      opt.value = String(code);
      opt.textContent = String(roleLabels?.[code] || `Kategorie ${code}`);
      roleSelect.appendChild(opt);
    });
    roleSelect.value = String(firm.role_code || "60");
    if (!roleSelect.value && roleSelect.options.length) roleSelect.selectedIndex = 0;
    inputs.role_code = roleSelect;
    form.appendChild(roleSelect);

    form.appendChild(mkEl("div", null, "Notizen"));
    const taNotes = mkTextarea(firm.notes);
    inputs.notes = taNotes;
    form.appendChild(taNotes);
  } else if (initPayload.kind === "person") {
    const person = initPayload.person || {};
    if (person.firmName) {
      form.appendChild(mkEl("div", null, "Firma"));
      const firmLabel = mkEl("div", "note", person.firmName);
      form.appendChild(firmLabel);
    }
    const fields = [
      ["firstName", "Vorname", "text", person.firstName],
      ["lastName", "Nachname", "text", person.lastName],
      ["funktion", "Funktion/Rolle", "text", person.rolle || person.funktion],
      ["phone", "Telefon", "text", person.phone],
      ["email", "E-Mail", "email", person.email],
    ];
    fields.forEach(([key, label, type, value]) => {
      form.appendChild(mkEl("div", null, label));
      const inp = mkInput(type, value);
      inputs[key] = inp;
      form.appendChild(inp);
    });
    inputs.rolle = inputs.funktion;

    form.appendChild(mkEl("div", null, "Notizen"));
    const taNotes = mkTextarea(person.notes);
    inputs.notes = taNotes;
    form.appendChild(taNotes);
  } else {
    root.textContent = "Unbekannter Editor-Typ.";
    return;
  }

  const actions = mkEl("div", "actions");
  const btnDelete = mkEl("button", null, "Löschen");
  btnDelete.style.background = "#c62828";
  btnDelete.style.color = "#fff";
  btnDelete.style.border = "1px solid rgba(0,0,0,0.25)";
  btnDelete.style.display = initPayload.kind === "person" ? "" : "none";
  btnDelete.onclick = async () => {
    const ok = window.confirm("Mitarbeiter wirklich löschen?");
    if (!ok) return;
    await api.editorDone({ status: "delete" });
  };
  const btnCancel = mkEl("button", null, "Abbrechen");
  btnCancel.onclick = async () => {
    await api.editorDone({ status: "cancel" });
  };
  const btnSave = mkEl("button", "primary", "Speichern");
  btnSave.onclick = async () => {
    const data = collect(inputs);
    await api.editorDone({ status: "saved", data });
  };

  actions.append(btnDelete, btnCancel, btnSave);
  card.append(header, form, actions);
  root.appendChild(card);
}

init();
