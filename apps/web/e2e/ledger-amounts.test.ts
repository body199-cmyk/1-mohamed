import { describe, expect, it } from "vitest";
import { poundsToPiastres, piastresToPounds, assertDecimal } from "../src/lib/ledger/amounts";

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

describe("trip and payment SQL decimal inputs", () => {
  it("accepts exact tonne and pound decimals", () => {
    expect(assertDecimal("12.500", 3, true)).toBe("12.500");
    expect(assertDecimal("100.50", 2, true)).toBe("100.50");
    expect(assertDecimal("0", 2, false)).toBe("0");
  });
  it("rejects zero weight/payment, negative, exponent and excess precision", () => {
    for (const value of ["0", "-1", "1e3", "1.2345", "1,000", ""]) {
      expect(() => assertDecimal(value, 3, true)).toThrow();
    }
    expect(() => assertDecimal("1.234", 2, true)).toThrow();
    expect(() => assertDecimal("92233720368547758.08", 2, true)).toThrow();
  });
});
