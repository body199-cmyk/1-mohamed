import { describe, expect, it } from "vitest";
import { buildContractorStatement } from "../src/contractor-statement";
import { makeBaseInput } from "./test-helpers";

describe("REPORT-01 validation - dates and calendar rules", () => {
  it("accepts valid leap year Feb 29 (2024 and century 2000)", () => {
    const leap2024 = buildContractorStatement({
      ...makeBaseInput(),
      opening: { startDate: "2024-02-29", signedPiastres: "0" },
      period: { from: "2024-02-29", to: "2024-03-01" },
    });
    expect(leap2024.ok).toBe(true);

    const leap2000 = buildContractorStatement({
      ...makeBaseInput(),
      opening: { startDate: "2000-02-29", signedPiastres: "0" },
      period: { from: "2000-02-29", to: "2000-03-01" },
    });
    expect(leap2000.ok).toBe(true);
  });

  it.each([
    { yearDate: "2026-02-29", reason: "non-leap year 2026" },
    { yearDate: "1900-02-29", reason: "century non-leap year 1900" },
  ])("rejects non-leap year Feb 29 ($reason)", ({ yearDate }) => {
    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        opening: { startDate: yearDate, signedPiastres: "0" },
      })
    ).toEqual({
      ok: false,
      error: { code: "INVALID_DATE", field: "opening.startDate" },
    });
  });

  it("rejects invalid calendar days such as 31 April", () => {
    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        period: { from: "2026-04-31", to: "2026-05-10" },
      })
    ).toEqual({
      ok: false,
      error: { code: "INVALID_DATE", field: "period.from" },
    });
  });

  it("accepts full year bounds 0001..9999 and rejects year 0000", () => {
    const fullRange = buildContractorStatement({
      ...makeBaseInput(),
      opening: { startDate: "0001-01-01", signedPiastres: "0" },
      period: { from: "0001-01-01", to: "9999-12-31" },
    });
    expect(fullRange.ok).toBe(true);

    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        opening: { startDate: "0000-01-01", signedPiastres: "0" },
      })
    ).toEqual({
      ok: false,
      error: { code: "INVALID_DATE", field: "opening.startDate" },
    });
  });

  it.each([
    "2026-11-01T00:00:00Z",
    "2026-11-1",
    "2026/11/01",
    "2026-13-01",
    "2026-00-10",
    "2026-11-00",
    "2026-11-32",
    " 2026-11-01 ",
  ])("rejects timestamps and malformed date strings (%s)", (badDate) => {
    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        period: { from: "2026-11-05", to: badDate },
      })
    ).toEqual({
      ok: false,
      error: { code: "INVALID_DATE", field: "period.to" },
    });
  });

  it("rejects period where from > to", () => {
    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        period: { from: "2026-11-11", to: "2026-11-10" },
      })
    ).toEqual({
      ok: false,
      error: { code: "INVALID_PERIOD", field: "period" },
    });
  });

  it("rejects period where from < opening.startDate", () => {
    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        opening: { startDate: "2026-11-05", signedPiastres: "0" },
        period: { from: "2026-11-04", to: "2026-11-10" },
      })
    ).toEqual({
      ok: false,
      error: { code: "PERIOD_BEFORE_START", field: "period.from" },
    });
  });

  it("rejects movement dated before opening.startDate", () => {
    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        opening: { startDate: "2026-11-03", signedPiastres: "0" },
        period: { from: "2026-11-05", to: "2026-11-10" },
        movements: [
          {
            id: "m1",
            counterpartyId: "K1",
            workDate: "2026-11-02",
            direction: "AHMED_SUPPLIES",
            contractorTotalPiastres: "1000",
          },
        ],
      })
    ).toEqual({
      ok: false,
      error: {
        code: "MOVEMENT_BEFORE_START",
        field: "movements.workDate",
        index: 0,
      },
    });
  });
});
