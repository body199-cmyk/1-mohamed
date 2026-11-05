import { describe, expect, it } from "vitest";
import { normalizeMasterKey, parseOpeningEgp, validOpeningDate, validOpeningPiastres } from "../src/features/master-data/master-data-validation";
describe("UI-BASE-01B cash and identity validation", () => {
  it("normalizes Arabic/Persian plate digits and spacing", () => {
    expect(normalizeMasterKey(" ط س ر ١٢٣ ")).toBe(normalizeMasterKey("ط  س ر 123"));
    expect(normalizeMasterKey("ط س ر ۱۲۳")).toBe(normalizeMasterKey("ط س ر ١٢٣"));
    expect(normalizeMasterKey("ط س ر ١٢٤")).not.toBe(normalizeMasterKey("ط س ر ١٢٣"));
  });
  it("parses exact signed piastres, rejects rounding and bigint overflow", () => {
    expect(parseOpeningEgp("١٢٣٫٤٥","VEHICLE")).toBe("12345");
    expect(parseOpeningEgp("123.4","CONTRACTOR")).toBe("-12340");
    expect(parseOpeningEgp("0","ZERO")).toBe("0");
    expect(parseOpeningEgp("1.234","VEHICLE")).toBeNull();
    expect(parseOpeningEgp("-5","VEHICLE")).toBeNull();
    expect(parseOpeningEgp("1,000","VEHICLE")).toBeNull();
    expect(parseOpeningEgp("9".repeat(100000),"VEHICLE")).toBeNull();
    expect(validOpeningPiastres("9".repeat(100000))).toBe(false);
    expect(parseOpeningEgp("92233720368547758.08","VEHICLE")).toBeNull();
    expect(parseOpeningEgp("92233720368547758.07","VEHICLE")).toBe("9223372036854775807");
    expect(validOpeningPiastres("-9223372036854775807")).toBe(true);
    expect(validOpeningPiastres("9223372036854775808")).toBe(false);
  });
  it("validates real calendar days including leap years", () => {
    expect(validOpeningDate("2026-02-29")).toBe(false);
    expect(validOpeningDate("2024-02-29")).toBe(true);
    expect(validOpeningDate("2026-13-01")).toBe(false);
    expect(validOpeningDate("2026-11-01")).toBe(true);
  });
});
