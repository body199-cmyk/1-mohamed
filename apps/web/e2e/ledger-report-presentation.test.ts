import { describe, expect, it } from "vitest";
import { scaledIntegerToDecimal } from "../src/lib/ledger/amounts";
import { projectLedgerReport } from "../src/features/ledger/report-presentation";

const lookups = {
  vehicles: new Map([["V1", "عربية ١"]]),
  contractors: new Map([["K1", "مقاول أول"]])
};

describe("PRE-LIVE exact historical report projection", () => {
  it("formats scaled weight and huge amounts without Number rounding", () => {
    expect(scaledIntegerToDecimal("12500", 3)).toBe("12.500");
    expect(scaledIntegerToDecimal("9007199254740993123", 3)).toBe("9007199254740993.123");
    expect(scaledIntegerToDecimal("-1", 3)).toBe("-0.001");
    expect(() => scaledIntegerToDecimal("01", 3)).toThrow();
    const report = projectLedgerReport("trips.list", [{
      id: "TR-1", trip_date: "2026-11-03", vehicle_id: "V1",
      counterparty_contractor_id: "K1", direction: "AHMED_SUPPLIES",
      weight_milli_tonnes: "12500", contractor_total_piastres: "9007199254740993123",
      is_cancelled: true, cancel_reason: "تصحيح تاريخي", version: 2
    }], lookups);
    expect(report.headers).toContain("إجمالي المقاول (جنيه)");
    expect(report.rows[0]).toContain("90071992547409931.23");
    expect(report.rows[0]).toContain("12.500");
    expect(report.rows[0]).toContain("عربية ١");
    expect(report.rows[0]).toContain("مقاول أول");
    expect(report.rows[0]).toContain("أحمد المورّد");
    expect(report.rows[0]).toContain("ملغى");
    expect(report.rows[0]).toContain("تصحيح تاريخي");
  });

  it("shows exact payment amounts and no receipt number column", () => {
    const report = projectLedgerReport("payments.list", [{
      id: "PAY-1", payment_date: "2026-11-04", vehicle_id: "V1",
      responsible_contractor_id: "K1", amount_piastres: "12345",
      receipt_number: "000007", is_cancelled: false, version: 1
    }], lookups);
    expect(report.rows[0]).toContain("123.45");
    expect(report.rows[0]).toContain("نشط");
    expect(report.headers).not.toContain("رقم الإيصال");
    expect(report.rows[0]).not.toContain("000007");
  });
});
