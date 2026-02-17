// src/main/domain/ProjectFirmsService.js

function _norm(v) {
  const s = v !== undefined && v !== null ? String(v).trim() : "";
  return s ? s : null;
}

function _buildName(firstName, lastName) {
  const fn = (firstName || "").trim();
  const ln = (lastName || "").trim();
  const name = `${fn} ${ln}`.trim();
  return name || null;
}

function createProjectFirmsService({ projectFirmsRepo, projectPersonsRepo, projectsRepo }) {
  if (!projectFirmsRepo) throw new Error("projectFirmsRepo required");
  if (!projectPersonsRepo) throw new Error("projectPersonsRepo required");
  if (!projectsRepo) throw new Error("projectsRepo required");

  function assertProject(projectId) {
    const p = projectsRepo.getProjectById(projectId);
    if (!p) throw new Error("Projekt nicht gefunden");
    return p;
  }

  return {
    // firms
    listByProject(projectId) {
      assertProject(projectId);
      return projectFirmsRepo.listActiveByProject(projectId);
    },

    createFirm(data) {
      if (!data?.projectId) throw new Error("projectId required");
      assertProject(data.projectId);

      const name = _norm(data.name);
      if (!name) throw new Error("Name 1 ist Pflicht.");

      return projectFirmsRepo.createFirm({
        projectId: data.projectId,
        short: _norm(data.short),
        name,
        name2: _norm(data.name2),
        street: _norm(data.street),
        zip: _norm(data.zip),
        city: _norm(data.city),
        phone: _norm(data.phone),
        email: _norm(data.email),
        gewerk: _norm(data.gewerk),
        notes: _norm(data.notes),
      });
    },

    updateFirm({ firmId, patch }) {
      if (!firmId) throw new Error("firmId required");
      if (!patch) throw new Error("patch required");

      if ("name" in patch) {
        const name = _norm(patch.name);
        if (!name) throw new Error("Name 1 ist Pflicht.");
        patch = { ...patch, name };
      }

      return projectFirmsRepo.updateFirm({ firmId, patch });
    },

    deleteFirm(firmId) {
      if (!firmId) throw new Error("firmId required");

      const cnt = projectPersonsRepo.countActiveByFirm(firmId);
      if (cnt > 0) {
        throw new Error("Firma kann nur geloescht werden, wenn keine aktiven Mitarbeiter vorhanden sind.");
      }

      return projectFirmsRepo.softDeleteFirm(firmId);
    },

    // persons
    listPersonsByFirm(firmId) {
      if (!firmId) throw new Error("firmId required");
      return projectPersonsRepo.listActiveByFirm(firmId);
    },

    createPerson(data) {
      if (!data?.firmId) throw new Error("firmId required");

      const fn = (data.firstName || "").trim();
      const ln = (data.lastName || "").trim();
      const name = _buildName(fn, ln);

      if (!name) throw new Error("Name ist Pflicht.");

      return projectPersonsRepo.createPerson({
        firmId: data.firmId,
        name,
        firstName: _norm(fn),
        lastName: _norm(ln),
        funktion: _norm(data.funktion),
        rolle: _norm(data.rolle),
        notes: _norm(data.notes),
        email: _norm(data.email),
        phone: _norm(data.phone),
      });
    },

    updatePerson({ personId, patch }) {
      if (!personId) throw new Error("personId required");
      if (!patch) throw new Error("patch required");

      const fn = ("first_name" in patch ? patch.first_name : patch.firstName);
      const ln = ("last_name" in patch ? patch.last_name : patch.lastName);

      // wenn Vor-/Nachname im Patch: name neu bilden
      if (fn !== undefined || ln !== undefined) {
        // wir brauchen die aktuellen Werte, damit name stabil bleibt
        const current = projectPersonsRepo.getPersonById(personId);
        if (!current) throw new Error("Mitarbeiter nicht gefunden");

        const nextFn = fn !== undefined ? String(fn || "").trim() : String(current.first_name || "").trim();
        const nextLn = ln !== undefined ? String(ln || "").trim() : String(current.last_name || "").trim();
        const nextName = _buildName(nextFn, nextLn);

        if (!nextName) throw new Error("Name ist Pflicht.");
        patch = { ...patch, name: nextName };
      }

      return projectPersonsRepo.updatePerson({ personId, patch });
    },

    deletePerson(personId) {
      if (!personId) throw new Error("personId required");
      return projectPersonsRepo.softDeletePerson(personId);
    },
  };
}

module.exports = { createProjectFirmsService };
