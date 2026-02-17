import FirmsView from "../FirmsView.js";

describe("FirmsView._saveFirm reload error regression", () => {
  it("treats save as successful when reload fails and resets saving flag", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const view = Object.create(FirmsView.prototype);
    view.savingFirm = false;
    view.savingPerson = false;
    view.firmMode = "edit";
    view.selectedFirmId = 42;
    view.selectedFirm = { id: 42, name: "Alt" };
    view.firms = [{ id: 42, name: "Alt" }];

    view._getFirmFormData = () => ({
      short: "N",
      name: "Neu GmbH",
      name2: "",
      street: "Musterweg 1",
      zip: "12345",
      city: "Berlin",
      phone: "",
      email: "",
      gewerk: "",
      role_code: "",
      notes: "aktualisiert",
    });

    view._setMsg = jest.fn();
    view._applyFirmFormState = jest.fn();
    view._applyPersonFormState = jest.fn();
    view._renderFirmsOnly = jest.fn();
    view._renderFirmDetails = jest.fn();
    view._renderPersonsOnly = jest.fn();
    view._updateVisibility = jest.fn();
    view._closeFirmEditor = jest.fn();
    view.reloadFirms = jest.fn().mockRejectedValue(new Error("reload failed"));

    const updateMock = jest.fn().mockResolvedValue({ ok: true });
    global.window = {
      ...(global.window || {}),
      bbmDb: {
        ...(global.window?.bbmDb || {}),
        firmsUpdateGlobal: updateMock,
      },
    };

    await expect(view._saveFirm()).resolves.toBeUndefined();

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(view.reloadFirms).toHaveBeenCalledTimes(1);
    expect(view.savingFirm).toBe(false);
    expect(view.selectedFirm?.id).toBe(42);
    expect(view.selectedFirm?.name).toBe("Neu GmbH");
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
