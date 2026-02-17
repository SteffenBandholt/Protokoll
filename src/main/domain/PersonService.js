// src/main/domain/PersonService.js

class PersonService {
  constructor({ firmsRepo, personsRepo }) {
    if (!firmsRepo) throw new Error("PersonService: firmsRepo required");
    if (!personsRepo) throw new Error("PersonService: personsRepo required");

    this.firmsRepo = firmsRepo;
    this.personsRepo = personsRepo;
  }

  listByFirm(firmId) {
    if (!firmId) throw new Error("firmId required");

    const firm = this.firmsRepo.getFirmById(firmId);
    if (!firm || firm.removed_at) throw new Error("Firma nicht gefunden");

    return this.personsRepo.listActiveByFirm(firmId);
  }

  create(input) {
    if (!input) throw new Error("input required");
    if (!input.firmId) throw new Error("firmId required");

    const firm = this.firmsRepo.getFirmById(input.firmId);
    if (!firm || firm.removed_at) throw new Error("Firma nicht gefunden");

    return this.personsRepo.createPerson({
      firmId: input.firmId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,

      funktion: input.funktion,
      rolle: input.rolle,
      notes: input.notes,
    });
  }

  update({ personId, patch }) {
    if (!personId) throw new Error("personId required");
    if (!patch) throw new Error("patch required");

    const existing = this.personsRepo.getPersonById(personId);
    if (!existing || existing.removed_at) throw new Error("Mitarbeiter nicht gefunden");

    return this.personsRepo.updatePerson({ personId, patch });
  }

  delete({ personId }) {
    if (!personId) throw new Error("personId required");

    const existing = this.personsRepo.getPersonById(personId);
    if (!existing || existing.removed_at) throw new Error("Mitarbeiter nicht gefunden");

    return this.personsRepo.softDeletePerson(personId);
  }
}

function createPersonService(deps) {
  return new PersonService(deps);
}

module.exports = {
  PersonService,
  createPersonService,
};
