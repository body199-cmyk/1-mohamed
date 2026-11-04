import { describe, expect, it } from "vitest";
import { buildContractorStatement } from "../src/contractor-statement";
import { makeBaseInput } from "./test-helpers";

describe("REPORT-01 validation - amounts and numeric formats", () => {
  it("normalizes leading zeros and negative zero in opening and movements", () => {
    const normalizedOpening = buildContractorStatement({
      ...makeBaseInput(),
      opening: { startDate: "2026-11-01", signedPiastres: "-0000" },
      movements: [
        {
          id: "m1",
          counterpartyId: "K1",
          workDate: "2026-11-06",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "0004500",
        },
      ],
    });

    expect(normalizedOpening.ok).toBe(true);
    if (normalizedOpening.ok) {
      expect(normalizedOpening.statement.openingBalancePiastres).toBe("0");
      expect(normalizedOpening.statement.rows[0]?.contractorTotalPiastres).toBe(
        "4500"
      );
      expect(normalizedOpening.statement.rows[0]?.signedDeltaPiastres).toBe(
        "4500"
      );
    }
  });

  it.each([
    "",
    "+100",
    " 100",
    "100 ",
    "12.5",
    "1e5",
    "1,000",
    "--100",
    "-",
    "abc",
  ])("rejects invalid opening signedPiastres format (%j)", (invalidOpening) => {
    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        opening: { startDate: "2026-11-01", signedPiastres: invalidOpening },
      })
    ).toEqual({
      ok: false,
      error: { code: "INVALID_AMOUNT", field: "opening.signedPiastres" },
    });
  });

  it.each([
    "",
    "-1",
    "-0",
    "+500",
    " 500 ",
    "50.0",
    "5e2",
    "5,000",
    "NaN",
  ])(
    "rejects invalid movement contractorTotalPiastres format (%j)",
    (invalidMovementAmount) => {
      expect(
        buildContractorStatement({
          ...makeBaseInput(),
          movements: [
            {
              id: "m1",
              counterpartyId: "K1",
              workDate: "2026-11-06",
              direction: "AHMED_SUPPLIES",
              contractorTotalPiastres: invalidMovementAmount,
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
    }
  );
});
