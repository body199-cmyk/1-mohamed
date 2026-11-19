import { describe, expect, it } from "vitest";
import { exactOpeningPiastres, poundsToPiastres, piastresToPounds, assertDecimal } from "../src/lib/ledger/amounts";

describe("real-data exact money entry", () => {
  it("converts pounds without floating point", () => {
    expect(poundsToPiastres("12.3")).toBe("1200");
    expect(poundsToPiastres("-0.05")).toBe("0");
    expect(poundsToPiastres("0")).toBe("0");
    expect(poundsToPiastres("92233720368547758.07")).toBe("9223372036854775800");
    expect(piastresToPounds("-12345")).toBe("-123");
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
    expect(assertDecimal("100.50", 2, true)).toBe("101");
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

describe("opening amount JSON boundary", () => {
  it("preserves exact integers of both signs up to the JSON wire limit", () => {
    for (const exact of ["-9007199254740991", "-100", "0", "100", "9007199254740991"]) {
      expect(JSON.stringify(exactOpeningPiastres(exact))).toBe(exact);
    }
    for (const unsafe of ["-9007199254740992", "9007199254740992", "9223372036854775807"]) {
      expect(() => exactOpeningPiastres(unsafe)).toThrow(/حد النقل/);
    }
  });
});
