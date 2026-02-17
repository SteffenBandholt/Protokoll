// src/main/domain/FirmService.js

class FirmService {
  constructor({ firmsRepo, personsRepo }) {
    if (!firmsRepo) throw new Error("FirmService: firmsRepo required");
    if (!personsRepo) throw new Error("FirmService: personsRepo required");

    this.firmsRepo = firmsRepo;
    this.personsRepo = personsRepo;
  }

  listGlobal() {
    return this.firmsRepo.listActive();
  }

  createGlobal(input) {
    if (!input) throw new Error("input required");

    return this.firmsRepo.createFirm({
      short: input.short,
      name: input.name,
      name2: input.name2,
      street: input.street,
      zip: input.zip,
      city: input.city,
      phone: input.phone,
      email: input.email,
      gewerk: input.gewerk,
      notes: input.notes,
    });
  }

  updateGlobal({ firmId, patch }) {
    if (!firmId) throw new Error("firmId required");
    if (!patch) throw new Error("patch required");

    const firm = this.firmsRepo.getFirmById(firmId);
    if (!firm || firm.removed_at) throw new Error("Firma nicht gefunden");

    return this.firmsRepo.updateFirm({ firmId, patch });
  }

  deleteGlobal({ firmId }) {
    if (!firmId) throw new Error("firmId required");

    const firm = this.firmsRepo.getFirmById(firmId);
    if (!firm || firm.removed_at) throw new Error("Firma nicht gefunden");

    const activeCount = this.firmsRepo.countActivePersonsByFirm(firmId);
    if (activeCount > 0) {
      throw new Error("Firma kann nicht gelöscht werden: Es sind noch aktive Mitarbeiter vorhanden.");
    }

    return this.firmsRepo.softDeleteFirm(firmId);
  }
}

function createFirmService(deps) {
  return new FirmService(deps);
}

module.exports = {
  FirmService,
  createFirmService,
};
