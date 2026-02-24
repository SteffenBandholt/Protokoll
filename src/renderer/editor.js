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
    const fields = [
      ["name", "Name 1", "text", firm.name],
      ["name2", "Name 2", "text", firm.name2],
      ["short", "Kurz", "text", firm.short],
      ["street", "Straße", "text", firm.street],
      ["zip", "PLZ", "text", firm.zip],
      ["city", "Ort", "text", firm.city],
      ["phone", "Telefon", "text", firm.phone],
      ["email", "E-Mail", "email", firm.email],
      ["gewerk", "Gewerk", "text", firm.gewerk],
      ["role_code", "Rolle Code", "text", firm.role_code],
    ];
    fields.forEach(([key, label, type, value]) => {
      form.appendChild(mkEl("div", null, label));
      const inp = mkInput(type, value);
      inputs[key] = inp;
      form.appendChild(inp);
    });

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
      ["funktion", "Funktion", "text", person.funktion],
      ["phone", "Telefon", "text", person.phone],
      ["email", "E-Mail", "email", person.email],
      ["rolle", "Rolle", "text", person.rolle],
    ];
    fields.forEach(([key, label, type, value]) => {
      form.appendChild(mkEl("div", null, label));
      const inp = mkInput(type, value);
      inputs[key] = inp;
      form.appendChild(inp);
    });

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
