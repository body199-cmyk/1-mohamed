import { describe, expect, it } from "vitest";
import { buildContractorStatement } from "../src/contractor-statement";
import { makeBaseInput } from "./test-helpers";

describe("REPORT-01 validation - deterministic error priority", () => {
  it("does not ignore errors in movements dated after period.to and reports original unsorted index", () => {
    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        movements: [
          {
            id: "m-valid-in-period",
            counterpartyId: "K1",
            workDate: "2026-11-08",
            direction: "AHMED_SUPPLIES",
            contractorTotalPiastres: "20000",
          },
          {
            id: "m-invalid-after-period",
            counterpartyId: "K1",
            workDate: "2026-11-25",
            direction: "OTHER_SUPPLIES",
            contractorTotalPiastres: "-500",
          },
        ],
      })
    ).toEqual({
      ok: false,
      error: {
        code: "INVALID_AMOUNT",
        field: "movements.contractorTotalPiastres",
        index: 1,
      },
    });
  });

  describe("header validation check priority order", () => {
    it("1. counterpartyId checked before opening.startDate", () => {
      expect(
        buildContractorStatement({
          counterpartyId: "",
          opening: { startDate: "bad", signedPiastres: "bad" },
          period: { from: "bad", to: "bad" },
          movements: [],
        })
      ).toEqual({
        ok: false,
        error: { code: "INVALID_ID", field: "counterpartyId" },
      });
    });

    it("2. opening.startDate checked before opening.signedPiastres", () => {
      expect(
        buildContractorStatement({
          counterpartyId: "K1",
          opening: { startDate: "bad", signedPiastres: "bad" },
          period: { from: "bad", to: "bad" },
          movements: [],
        })
      ).toEqual({
        ok: false,
        error: { code: "INVALID_DATE", field: "opening.startDate" },
      });
    });

    it("3. opening.signedPiastres checked before period.from", () => {
      expect(
        buildContractorStatement({
          counterpartyId: "K1",
          opening: { startDate: "2026-11-05", signedPiastres: "bad" },
          period: { from: "bad", to: "bad" },
          movements: [],
        })
      ).toEqual({
        ok: false,
        error: { code: "INVALID_AMOUNT", field: "opening.signedPiastres" },
      });
    });

    it("4. period.from checked before period.to", () => {
      expect(
        buildContractorStatement({
          counterpartyId: "K1",
          opening: { startDate: "2026-11-05", signedPiastres: "0" },
          period: { from: "bad", to: "bad" },
          movements: [],
        })
      ).toEqual({
        ok: false,
        error: { code: "INVALID_DATE", field: "period.from" },
      });
    });

    it("5. period.to checked before period order validation", () => {
      expect(
        buildContractorStatement({
          counterpartyId: "K1",
          opening: { startDate: "2026-11-05", signedPiastres: "0" },
          period: { from: "2026-11-04", to: "bad" },
          movements: [],
        })
      ).toEqual({
        ok: false,
        error: { code: "INVALID_DATE", field: "period.to" },
      });
    });

    it("6. period order (from <= to) checked before period start vs opening", () => {
      // When both period.from > period.to AND period.from < opening.startDate, INVALID_PERIOD comes first
      expect(
        buildContractorStatement({
          counterpartyId: "K1",
          opening: { startDate: "2026-11-10", signedPiastres: "0" },
          period: { from: "2026-11-05", to: "2026-11-04" },
          movements: [],
        })
      ).toEqual({
        ok: false,
        error: { code: "INVALID_PERIOD", field: "period" },
      });
    });
  });

  describe("per-movement validation check priority order", () => {
    const base = makeBaseInput();

    it("1. movement id checked before counterpartyId", () => {
      expect(
        buildContractorStatement({
          ...base,
          movements: [
            {
              id: "   ",
              counterpartyId: "",
              workDate: "bad",
              direction: "AHMED_SUPPLIES",
              contractorTotalPiastres: "bad",
            },
          ],
        })
      ).toEqual({
        ok: false,
        error: { code: "INVALID_ID", field: "movements.id", index: 0 },
      });
    });

    it("2. movement counterpartyId non-empty checked before ACCOUNT_MISMATCH", () => {
      expect(
        buildContractorStatement({
          ...base,
          movements: [
            {
              id: "m1",
              counterpartyId: "   ",
              workDate: "bad",
              direction: "AHMED_SUPPLIES",
              contractorTotalPiastres: "bad",
            },
          ],
        })
      ).toEqual({
        ok: false,
        error: {
          code: "INVALID_ID",
          field: "movements.counterpartyId",
          index: 0,
        },
      });
    });

    it("3. ACCOUNT_MISMATCH checked before workDate", () => {
      expect(
        buildContractorStatement({
          ...base,
          movements: [
            {
              id: "m1",
              counterpartyId: "K2",
              workDate: "bad",
              direction: "AHMED_SUPPLIES",
              contractorTotalPiastres: "bad",
            },
          ],
        })
      ).toEqual({
        ok: false,
        error: {
          code: "ACCOUNT_MISMATCH",
          field: "movements.counterpartyId",
          index: 0,
        },
      });
    });

    it("4. workDate checked before contractorTotalPiastres", () => {
      expect(
        buildContractorStatement({
          ...base,
          movements: [
            {
              id: "m1",
              counterpartyId: "K1",
              workDate: "2026-02-29",
              direction: "AHMED_SUPPLIES",
              contractorTotalPiastres: "bad",
            },
          ],
        })
      ).toEqual({
        ok: false,
        error: { code: "INVALID_DATE", field: "movements.workDate", index: 0 },
      });
    });

    it("5. contractorTotalPiastres checked before MOVEMENT_BEFORE_START", () => {
      expect(
        buildContractorStatement({
          ...base,
          movements: [
            {
              id: "m1",
              counterpartyId: "K1",
              workDate: "2026-10-31",
              direction: "AHMED_SUPPLIES",
              contractorTotalPiastres: "-100",
            },
          ],
        })
      ).toEqual({
        ok: false,
        error: {
          code: "INVALID_AMOUNT",
          field: "movements.contractorTotalPiastres",
          index: 0,
        },
      });
    });

    it("6. MOVEMENT_BEFORE_START checked before DUPLICATE_MOVEMENT_ID", () => {
      expect(
        buildContractorStatement({
          ...base,
          movements: [
            {
              id: "dup",
              counterpartyId: "K1",
              workDate: "2026-11-05",
              direction: "AHMED_SUPPLIES",
              contractorTotalPiastres: "100",
            },
            {
              id: "dup",
              counterpartyId: "K1",
              workDate: "2026-10-31",
              direction: "AHMED_SUPPLIES",
              contractorTotalPiastres: "100",
            },
          ],
        })
      ).toEqual({
        ok: false,
        error: {
          code: "MOVEMENT_BEFORE_START",
          field: "movements.workDate",
          index: 1,
        },
      });
    });
  });
});
