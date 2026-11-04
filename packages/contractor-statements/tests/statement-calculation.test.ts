import { describe, expect, it } from "vitest";
import { buildContractorStatement } from "../src/contractor-statement";

describe("REPORT-01 statement calculations and balances", () => {
  it("satisfies the primary acceptance scenario (account K1)", () => {
    const result = buildContractorStatement({
      counterpartyId: "K1",
      opening: {
        startDate: "2026-11-01",
        signedPiastres: "-40000",
      },
      period: {
        from: "2026-11-05",
        to: "2026-11-10",
      },
      movements: [
        {
          id: "m1",
          counterpartyId: "K1",
          workDate: "2026-11-02",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "30000",
        },
        {
          id: "m2",
          counterpartyId: "K1",
          workDate: "2026-11-05",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "100000",
        },
        {
          id: "m3",
          counterpartyId: "K1",
          workDate: "2026-11-06",
          direction: "OTHER_SUPPLIES",
          contractorTotalPiastres: "60000",
        },
        {
          id: "m4",
          counterpartyId: "K1",
          workDate: "2026-11-10",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "20000",
        },
        {
          id: "m5",
          counterpartyId: "K1",
          workDate: "2026-11-11",
          direction: "OTHER_SUPPLIES",
          contractorTotalPiastres: "90000",
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      statement: {
        counterpartyId: "K1",
        period: {
          from: "2026-11-05",
          to: "2026-11-10",
        },
        openingBalancePiastres: "-10000",
        ahmedWorkPiastres: "120000",
        counterpartyWorkPiastres: "60000",
        closingBalancePiastres: "50000",
        beneficiary: "AHMED",
        balanceMagnitudePiastres: "50000",
        movementCount: 3,
        rows: [
          {
            id: "m2",
            workDate: "2026-11-05",
            direction: "AHMED_SUPPLIES",
            contractorTotalPiastres: "100000",
            signedDeltaPiastres: "100000",
            runningBalancePiastres: "90000",
          },
          {
            id: "m3",
            workDate: "2026-11-06",
            direction: "OTHER_SUPPLIES",
            contractorTotalPiastres: "60000",
            signedDeltaPiastres: "-60000",
            runningBalancePiastres: "30000",
          },
          {
            id: "m4",
            workDate: "2026-11-10",
            direction: "AHMED_SUPPLIES",
            contractorTotalPiastres: "20000",
            signedDeltaPiastres: "20000",
            runningBalancePiastres: "50000",
          },
        ],
      },
    });
  });

  it("handles empty periods with positive, negative, and zero (-0) opening balances", () => {
    const positiveOpening = buildContractorStatement({
      counterpartyId: "K1",
      opening: { startDate: "2026-11-01", signedPiastres: "0075000" },
      period: { from: "2026-11-05", to: "2026-11-10" },
      movements: [],
    });

    expect(positiveOpening).toEqual({
      ok: true,
      statement: {
        counterpartyId: "K1",
        period: { from: "2026-11-05", to: "2026-11-10" },
        openingBalancePiastres: "75000",
        ahmedWorkPiastres: "0",
        counterpartyWorkPiastres: "0",
        closingBalancePiastres: "75000",
        beneficiary: "AHMED",
        balanceMagnitudePiastres: "75000",
        movementCount: 0,
        rows: [],
      },
    });

    const negativeOpening = buildContractorStatement({
      counterpartyId: "K1",
      opening: { startDate: "2026-11-01", signedPiastres: "-0075000" },
      period: { from: "2026-11-05", to: "2026-11-10" },
      movements: [],
    });

    expect(negativeOpening).toEqual({
      ok: true,
      statement: {
        counterpartyId: "K1",
        period: { from: "2026-11-05", to: "2026-11-10" },
        openingBalancePiastres: "-75000",
        ahmedWorkPiastres: "0",
        counterpartyWorkPiastres: "0",
        closingBalancePiastres: "-75000",
        beneficiary: "COUNTERPARTY",
        balanceMagnitudePiastres: "75000",
        movementCount: 0,
        rows: [],
      },
    });

    const negativeZeroOpening = buildContractorStatement({
      counterpartyId: "K1",
      opening: { startDate: "2026-11-01", signedPiastres: "-0" },
      period: { from: "2026-11-05", to: "2026-11-10" },
      movements: [],
    });

    expect(negativeZeroOpening).toEqual({
      ok: true,
      statement: {
        counterpartyId: "K1",
        period: { from: "2026-11-05", to: "2026-11-10" },
        openingBalancePiastres: "0",
        ahmedWorkPiastres: "0",
        counterpartyWorkPiastres: "0",
        closingBalancePiastres: "0",
        beneficiary: "BALANCED",
        balanceMagnitudePiastres: "0",
        movementCount: 0,
        rows: [],
      },
    });
  });

  it("computes openingBalancePiastres from pre-period movements without leaking into period work totals", () => {
    const result = buildContractorStatement({
      counterpartyId: "K1",
      opening: { startDate: "2026-10-01", signedPiastres: "10000" },
      period: { from: "2026-10-10", to: "2026-10-20" },
      movements: [
        {
          id: "pre-1",
          counterpartyId: "K1",
          workDate: "2026-10-01",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "25000",
        },
        {
          id: "pre-2",
          counterpartyId: "K1",
          workDate: "2026-10-09",
          direction: "OTHER_SUPPLIES",
          contractorTotalPiastres: "50000",
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      statement: {
        counterpartyId: "K1",
        period: { from: "2026-10-10", to: "2026-10-20" },
        openingBalancePiastres: "-15000",
        ahmedWorkPiastres: "0",
        counterpartyWorkPiastres: "0",
        closingBalancePiastres: "-15000",
        beneficiary: "COUNTERPARTY",
        balanceMagnitudePiastres: "15000",
        movementCount: 0,
        rows: [],
      },
    });
  });

  it("derives closing balance, beneficiary, and magnitude for positive, negative, and zero endings", () => {
    // Ending negative (COUNTERPARTY)
    const counterpartyEndsAhead = buildContractorStatement({
      counterpartyId: "K1",
      opening: { startDate: "2026-11-01", signedPiastres: "20000" },
      period: { from: "2026-11-01", to: "2026-11-10" },
      movements: [
        {
          id: "m1",
          counterpartyId: "K1",
          workDate: "2026-11-03",
          direction: "OTHER_SUPPLIES",
          contractorTotalPiastres: "55000",
        },
      ],
    });

    expect(counterpartyEndsAhead).toEqual({
      ok: true,
      statement: {
        counterpartyId: "K1",
        period: { from: "2026-11-01", to: "2026-11-10" },
        openingBalancePiastres: "20000",
        ahmedWorkPiastres: "0",
        counterpartyWorkPiastres: "55000",
        closingBalancePiastres: "-35000",
        beneficiary: "COUNTERPARTY",
        balanceMagnitudePiastres: "35000",
        movementCount: 1,
        rows: [
          {
            id: "m1",
            workDate: "2026-11-03",
            direction: "OTHER_SUPPLIES",
            contractorTotalPiastres: "55000",
            signedDeltaPiastres: "-55000",
            runningBalancePiastres: "-35000",
          },
        ],
      },
    });

    // Ending zero (BALANCED)
    const balancedEnding = buildContractorStatement({
      counterpartyId: "K1",
      opening: { startDate: "2026-11-01", signedPiastres: "-30000" },
      period: { from: "2026-11-01", to: "2026-11-10" },
      movements: [
        {
          id: "m1",
          counterpartyId: "K1",
          workDate: "2026-11-02",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "50000",
        },
        {
          id: "m2",
          counterpartyId: "K1",
          workDate: "2026-11-04",
          direction: "OTHER_SUPPLIES",
          contractorTotalPiastres: "20000",
        },
      ],
    });

    expect(balancedEnding).toEqual({
      ok: true,
      statement: {
        counterpartyId: "K1",
        period: { from: "2026-11-01", to: "2026-11-10" },
        openingBalancePiastres: "-30000",
        ahmedWorkPiastres: "50000",
        counterpartyWorkPiastres: "20000",
        closingBalancePiastres: "0",
        beneficiary: "BALANCED",
        balanceMagnitudePiastres: "0",
        movementCount: 2,
        rows: [
          {
            id: "m1",
            workDate: "2026-11-02",
            direction: "AHMED_SUPPLIES",
            contractorTotalPiastres: "50000",
            signedDeltaPiastres: "50000",
            runningBalancePiastres: "20000",
          },
          {
            id: "m2",
            workDate: "2026-11-04",
            direction: "OTHER_SUPPLIES",
            contractorTotalPiastres: "20000",
            signedDeltaPiastres: "-20000",
            runningBalancePiastres: "0",
          },
        ],
      },
    });
  });

  it("handles amounts exceeding Number.MAX_SAFE_INTEGER with exact bigint precision", () => {
    // Number.MAX_SAFE_INTEGER is 9007199254740991
    const result = buildContractorStatement({
      counterpartyId: "K-LARGE",
      opening: {
        startDate: "2026-01-01",
        signedPiastres: "9007199254740993",
      },
      period: {
        from: "2026-01-05",
        to: "2026-01-10",
      },
      movements: [
        {
          id: "m-pre",
          counterpartyId: "K-LARGE",
          workDate: "2026-01-02",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "4",
        },
        {
          id: "m-in-1",
          counterpartyId: "K-LARGE",
          workDate: "2026-01-06",
          direction: "AHMED_SUPPLIES",
          contractorTotalPiastres: "1000000000000000000000000000001",
        },
        {
          id: "m-in-2",
          counterpartyId: "K-LARGE",
          workDate: "2026-01-07",
          direction: "OTHER_SUPPLIES",
          contractorTotalPiastres: "2",
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      statement: {
        counterpartyId: "K-LARGE",
        period: {
          from: "2026-01-05",
          to: "2026-01-10",
        },
        openingBalancePiastres: "9007199254740997",
        ahmedWorkPiastres: "1000000000000000000000000000001",
        counterpartyWorkPiastres: "2",
        closingBalancePiastres: "1000000000000009007199254740996",
        beneficiary: "AHMED",
        balanceMagnitudePiastres: "1000000000000009007199254740996",
        movementCount: 2,
        rows: [
          {
            id: "m-in-1",
            workDate: "2026-01-06",
            direction: "AHMED_SUPPLIES",
            contractorTotalPiastres: "1000000000000000000000000000001",
            signedDeltaPiastres: "1000000000000000000000000000001",
            runningBalancePiastres: "1000000000000009007199254740998",
          },
          {
            id: "m-in-2",
            workDate: "2026-01-07",
            direction: "OTHER_SUPPLIES",
            contractorTotalPiastres: "2",
            signedDeltaPiastres: "-2",
            runningBalancePiastres: "1000000000000009007199254740996",
          },
        ],
      },
    });
  });
});
