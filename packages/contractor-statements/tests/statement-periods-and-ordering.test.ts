import { describe, expect, it } from "vitest";
import { buildContractorStatement } from "../src/contractor-statement";
import type { ContractorStatementInput } from "../src/statement-types";

describe("REPORT-01 period boundaries, sorting, immutability, and serialization", () => {
  it("includes movements on opening.startDate, includes both period bounds, and excludes movements after period.to", () => {
    // Case A: opening.startDate == period.from (movement on opening.startDate appears in period rows)
    const onStartAndFrom = buildContractorStatement({
      counterpartyId: "K1",
      opening: { startDate: "2026-11-01", signedPiastres: "5000" },
      period: { from: "2026-11-01", to: "2026-11-05" },
      movements: [
        {
          id: "m-start",
          counterpartyId: "K1",
          workDate: "2026-11-01",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "10000",
        },
        {
          id: "m-end",
          counterpartyId: "K1",
          workDate: "2026-11-05",
          direction: "OTHER_SUPPLIES",
          contractorTotalPiastres: "3000",
        },
        {
          id: "m-after",
          counterpartyId: "K1",
          workDate: "2026-11-06",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "99999",
        },
      ],
    });

    expect(onStartAndFrom).toEqual({
      ok: true,
      statement: {
        counterpartyId: "K1",
        period: { from: "2026-11-01", to: "2026-11-05" },
        openingBalancePiastres: "5000",
        ahmedWorkPiastres: "10000",
        counterpartyWorkPiastres: "3000",
        closingBalancePiastres: "12000",
        beneficiary: "AHMED",
        balanceMagnitudePiastres: "12000",
        movementCount: 2,
        rows: [
          {
            id: "m-start",
            workDate: "2026-11-01",
            direction: "AHMED_SUPPLIES",
            contractorTotalPiastres: "10000",
            signedDeltaPiastres: "10000",
            runningBalancePiastres: "15000",
          },
          {
            id: "m-end",
            workDate: "2026-11-05",
            direction: "OTHER_SUPPLIES",
            contractorTotalPiastres: "3000",
            signedDeltaPiastres: "-3000",
            runningBalancePiastres: "12000",
          },
        ],
      },
    });
  });

  it("counts two identical movements (same date, direction, and amount) when their IDs are distinct", () => {
    const result = buildContractorStatement({
      counterpartyId: "K1",
      opening: { startDate: "2026-11-01", signedPiastres: "0" },
      period: { from: "2026-11-05", to: "2026-11-10" },
      movements: [
        {
          id: "load-a",
          counterpartyId: "K1",
          workDate: "2026-11-07",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "45000",
        },
        {
          id: "load-b",
          counterpartyId: "K1",
          workDate: "2026-11-07",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "45000",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.statement.movementCount).toBe(2);
      expect(result.statement.ahmedWorkPiastres).toBe("90000");
      expect(result.statement.closingBalancePiastres).toBe("90000");
      expect(result.statement.rows.map((r) => r.runningBalancePiastres)).toEqual([
        "45000",
        "90000",
      ]);
    }
  });

  it("sorts period rows by workDate then deterministic code-unit id order without mutating unsorted input", () => {
    // Note: in UTF-16 code units, "B" (66) < "a" (97) and "m10" < "m2"
    const unsortedMovements = [
      {
        id: "m2",
        counterpartyId: "K1",
        workDate: "2026-11-06",
        direction: "AHMED_SUPPLIES" as const,
        contractorTotalPiastres: "1000",
      },
      {
        id: "m10",
        counterpartyId: "K1",
        workDate: "2026-11-06",
        direction: "OTHER_SUPPLIES" as const,
        contractorTotalPiastres: "400",
      },
      {
        id: "B-first-ascii",
        counterpartyId: "K1",
        workDate: "2026-11-06",
        direction: "AHMED_SUPPLIES" as const,
        contractorTotalPiastres: "2000",
      },
      {
        id: "z-earlier-date",
        counterpartyId: "K1",
        workDate: "2026-11-05",
        direction: "AHMED_SUPPLIES" as const,
        contractorTotalPiastres: "5000",
      },
    ];

    const originalIdsSnapshot = unsortedMovements.map((m) => m.id);

    const result = buildContractorStatement({
      counterpartyId: "K1",
      opening: { startDate: "2026-11-01", signedPiastres: "0" },
      period: { from: "2026-11-05", to: "2026-11-10" },
      movements: unsortedMovements,
    });

    // Input array order must remain untouched
    expect(unsortedMovements.map((m) => m.id)).toEqual(originalIdsSnapshot);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.statement.rows.map((r) => r.id)).toEqual([
        "z-earlier-date",
        "B-first-ascii",
        "m10",
        "m2",
      ]);
      expect(result.statement.rows.map((r) => r.runningBalancePiastres)).toEqual([
        "5000",
        "7000",
        "6600",
        "7600",
      ]);
    }
  });

  it("accepts deeply frozen inputs and produces JSON-serializable results", () => {
    const frozenInput: ContractorStatementInput = Object.freeze({
      counterpartyId: "K1",
      opening: Object.freeze({
        startDate: "2026-11-01",
        signedPiastres: "-10000",
      }),
      period: Object.freeze({
        from: "2026-11-05",
        to: "2026-11-10",
      }),
      movements: Object.freeze([
        Object.freeze({
          id: "m2",
          counterpartyId: "K1",
          workDate: "2026-11-07",
          direction: "AHMED_SUPPLIES" as const,
          contractorTotalPiastres: "25000",
        }),
        Object.freeze({
          id: "m1",
          counterpartyId: "K1",
          workDate: "2026-11-05",
          direction: "OTHER_SUPPLIES" as const,
          contractorTotalPiastres: "5000",
        }),
      ]),
    });

    const result = buildContractorStatement(frozenInput);
    expect(result.ok).toBe(true);

    const serialized = JSON.stringify(result);
    const parsed = JSON.parse(serialized);
    expect(parsed).toEqual(result);
  });
});
