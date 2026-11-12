import { describe, expect, it } from "vitest";
import { poundsToPiastres, piastresToPounds } from "../src/lib/ledger/amounts";

describe("real-data exact money entry", () => {
  it("converts pounds without floating point", () => {
    expect(poundsToPiastres("12.3")).toBe("1230");
    expect(poundsToPiastres("-0.05")).toBe("-5");
    expect(poundsToPiastres("0")).toBe("0");
    expect(poundsToPiastres("92233720368547758.07")).toBe("9223372036854775807");
    expect(piastresToPounds("-12345")).toBe("-123.45");
  });
  it("rejects unsupported separators, precision and bigint overflow", () => {
    for (const value of ["1.234", "1,000", "1e4", "", "NaN", "01", "92233720368547758.08"]) {
      expect(() => poundsToPiastres(value)).toThrow();
    }
  });
});
