import { describe, expect, it } from "vitest";
import { buildContractorStatement } from "../src/contractor-statement";
import { makeBaseInput } from "./test-helpers";

describe("REPORT-01 validation - accounts and identifiers", () => {
  it.each(["", "   \t\n  "])(
    "rejects empty or whitespace-only counterpartyId (%j)",
    (emptyId) => {
      expect(
        buildContractorStatement({
          ...makeBaseInput(),
          counterpartyId: emptyId,
        })
      ).toEqual({
        ok: false,
        error: {
          code: "INVALID_ID",
          field: "counterpartyId",
        },
      });
    }
  );

  it("preserves opaque IDs without trimming", () => {
    const opaqueId = "  contractor:K1/alpha-01  ";
    const validOpaque = buildContractorStatement({
      ...makeBaseInput(),
      counterpartyId: opaqueId,
      movements: [
        {
          id: "  mov:01  ",
          counterpartyId: opaqueId,
          workDate: "2026-11-06",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "1500",
        },
      ],
    });

    expect(validOpaque.ok).toBe(true);
    if (validOpaque.ok) {
      expect(validOpaque.statement.counterpartyId).toBe(opaqueId);
      expect(validOpaque.statement.rows[0]?.id).toBe("  mov:01  ");
    }
  });

  it("detects account mismatch when untrimmed spaces differ", () => {
    const untrimmedMismatch = buildContractorStatement({
      ...makeBaseInput(),
      counterpartyId: "K1",
      movements: [
        {
          id: "m1",
          counterpartyId: " K1 ",
          workDate: "2026-11-06",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "1500",
        },
      ],
    });

    expect(untrimmedMismatch).toEqual({
      ok: false,
      error: {
        code: "ACCOUNT_MISMATCH",
        field: "movements.counterpartyId",
        index: 0,
      },
    });
  });

  it("rejects movement with different counterpartyId (ACCOUNT_MISMATCH)", () => {
    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        movements: [
          {
            id: "m1",
            counterpartyId: "OTHER_ACCOUNT",
            workDate: "2026-11-06",
            direction: "AHMED_SUPPLIES",
            contractorTotalPiastres: "1000",
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

  it("rejects duplicate movement IDs within movements array", () => {
    expect(
      buildContractorStatement({
        ...makeBaseInput(),
        movements: [
          {
            id: "dup-1",
            counterpartyId: "K1",
            workDate: "2026-11-02",
            direction: "AHMED_SUPPLIES",
            contractorTotalPiastres: "1000",
          },
          {
            id: "dup-1",
            counterpartyId: "K1",
            workDate: "2026-11-06",
            direction: "AHMED_SUPPLIES",
            contractorTotalPiastres: "1000",
          },
        ],
      })
    ).toEqual({
      ok: false,
      error: {
        code: "DUPLICATE_MOVEMENT_ID",
        field: "movements.id",
        index: 1,
      },
    });
  });
});
