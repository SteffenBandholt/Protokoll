import {
  computeAmpelColorForTop,
  computeAmpelMapForTops,
  shouldShowAmpelInPdf,
} from "../pdfAmpelRule.js";

const mkTop = (overrides = {}) => ({
  id: overrides.id ?? "t1",
  level: overrides.level ?? 2,
  status: overrides.status ?? "offen",
  due_date: overrides.due_date ?? null,
  parent_top_id: overrides.parent_top_id ?? null,
  ...overrides,
});

describe("pdfAmpelRule", () => {
  it("Level 1 -> show=false immer", () => {
    const tops = [mkTop({ id: "1", level: 1 })];
    const map = computeAmpelMapForTops({
      tops,
      mode: "preview",
      meeting: { is_closed: 0 },
      settings: { "tops.ampelEnabled": "true" },
      now: new Date("2026-02-20T10:00:00"),
    });
    expect(map.get("1").show).toBe(false);
    expect(map.get("1").color).toBe(null);
  });

  it("Blatt: offen ohne due_date -> null", () => {
    const color = computeAmpelColorForTop({
      top: mkTop({ status: "offen", due_date: null }),
      childrenColors: [],
      now: new Date("2026-02-20T10:00:00"),
    });
    expect(color).toBe(null);
  });

  it("Blatt: offen mit due_date heute/ueberfaellig -> rot", () => {
    const color = computeAmpelColorForTop({
      top: mkTop({ status: "offen", due_date: "2026-02-20" }),
      childrenColors: [],
      now: new Date("2026-02-20T10:00:00"),
    });
    expect(color).toBe("red");
  });

  it("Blatt: offen mit due_date +5 Tage -> orange", () => {
    const color = computeAmpelColorForTop({
      top: mkTop({ status: "offen", due_date: "2026-02-25" }),
      childrenColors: [],
      now: new Date("2026-02-20T10:00:00"),
    });
    expect(color).toBe("orange");
  });

  it("Blatt: offen mit due_date +20 Tage -> gruen", () => {
    const color = computeAmpelColorForTop({
      top: mkTop({ status: "offen", due_date: "2026-03-12" }),
      childrenColors: [],
      now: new Date("2026-02-20T10:00:00"),
    });
    expect(color).toBe("green");
  });

  it("Blatt: blockiert/verzug/erledigt -> blau/rot/gruen", () => {
    expect(
      computeAmpelColorForTop({
        top: mkTop({ status: "blockiert" }),
        childrenColors: [],
        now: new Date("2026-02-20T10:00:00"),
      })
    ).toBe("blue");
    expect(
      computeAmpelColorForTop({
        top: mkTop({ status: "verzug" }),
        childrenColors: [],
        now: new Date("2026-02-20T10:00:00"),
      })
    ).toBe("red");
    expect(
      computeAmpelColorForTop({
        top: mkTop({ status: "erledigt" }),
        childrenColors: [],
        now: new Date("2026-02-20T10:00:00"),
      })
    ).toBe("green");
  });

  it("Parent aggregation: green+orange -> orange; orange+red -> red; red+blue -> blue", () => {
    expect(
      computeAmpelColorForTop({ top: mkTop(), childrenColors: ["green", "orange"] })
    ).toBe("orange");
    expect(
      computeAmpelColorForTop({ top: mkTop(), childrenColors: ["orange", "red"] })
    ).toBe("red");
    expect(
      computeAmpelColorForTop({ top: mkTop(), childrenColors: ["red", "blue"] })
    ).toBe("blue");
  });

  it("Sichtbarkeit: Vorabzug folgt Toggle; geschlossen folgt Freeze falls vorhanden", () => {
    const settingsOn = { "tops.ampelEnabled": "true" };
    const settingsOff = { "tops.ampelEnabled": "false" };

    expect(
      shouldShowAmpelInPdf({ mode: "preview", meeting: { is_closed: 0 }, settings: settingsOff })
    ).toBe(false);
    expect(
      shouldShowAmpelInPdf({ mode: "preview", meeting: { is_closed: 0 }, settings: settingsOn })
    ).toBe(true);

    expect(
      shouldShowAmpelInPdf({
        mode: "protocol",
        meeting: { is_closed: 1, pdf_show_ampel: 0 },
        settings: settingsOn,
      })
    ).toBe(false);
    expect(
      shouldShowAmpelInPdf({
        mode: "protocol",
        meeting: { is_closed: 1, pdf_show_ampel: 1 },
        settings: settingsOff,
      })
    ).toBe(true);
  });
});
