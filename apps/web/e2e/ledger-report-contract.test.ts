import { describe, expect, it } from "vitest";
import { cashMovementForPeriod, readVehicleCashPeriod } from "../src/lib/ledger/report-contract";

describe("persistent vehicle-cash report contract", () => {
  it("keeps exact bigint period opening/closing independent from current balance", () => {
    const report = readVehicleCashPeriod({
      period_opening_piastres: "9223372036854775807",
      period_closing_piastres: "9223372036854775907",
      current_cash_balance_piastres: "9223372036854776007",
      cash_balance_piastres: "9223372036854776007",
      total_count: 2, rows: [],
    });
    expect(cashMovementForPeriod(report)).toBe("100");
    expect(report.period_closing_piastres).not.toBe(report.current_cash_balance_piastres);
  });
  it("rejects floating point, exponent notation and unsafe JSON numbers for money", () => {
    const valid = { period_opening_piastres: "0", period_closing_piastres: "-100",
      current_cash_balance_piastres: "0", cash_balance_piastres: "0",
      total_count: 0, rows: [] };
    expect(cashMovementForPeriod(readVehicleCashPeriod(valid))).toBe("-100");
    for (const bad of [1.1, 9007199254740993, "1e6", "01", "+1", "1.00"]) {
      expect(() => readVehicleCashPeriod({ ...valid, period_closing_piastres: bad })).toThrow();
    }
  });
});
