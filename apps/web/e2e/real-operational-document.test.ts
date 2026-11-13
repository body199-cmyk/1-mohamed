import { describe, expect, it } from "vitest";
import {
  buildRealOperationalDocument, isFullOperationalReport
} from "../src/features/ledger/real-operational-document";

const lookups = {
  vehicles: new Map([["V1", "عربية ١"]]),
  contractors: new Map([["K1", "المقاول الأول"]])
};

describe("real operational five-format document", () => {
  it("requires every page before generating a complete report", () => {
    const partial = { rows: [{ id: "T1" }], total_count: "2",
      next_cursor: { date: "2026-01-01", id: "T1" } };
    expect(isFullOperationalReport(partial)).toBe(false);
    expect(() => buildRealOperationalDocument("trips.list", partial, lookups,
      "2026-01-01", "2026-01-31", "now")).toThrow(/حمّل/);
    expect(isFullOperationalReport({ ...partial, total_count: "1", next_cursor: null })).toBe(true);
    expect(isFullOperationalReport({ rows: [], total_count: "NaN", next_cursor: null })).toBe(false);
    expect(isFullOperationalReport({ rows: [], total_count: 9007199254740992, next_cursor: null })).toBe(false);
  });
  it("formats persisted trip records without demo data or omitted commercial columns", () => {
    const report = { rows: [{
      id: "TR1", trip_date: "2026-01-03", vehicle_id: "V1",
      counterparty_contractor_id: "K1", direction: "AHMED_SUPPLIES",
      origin: "القاهرة", destination: "السويس",
      weight_milli_tonnes: "12500", contractor_rate_piastres: "12050",
      vehicle_rate_piastres: "11000", expense_piastres: "500",
      contractor_total_piastres: "9007199254740993123",
      vehicle_total_piastres: "9007199254740993000",
      notes: "تسوية", cancel_reason: null
    }], total_count: "1", next_cursor: null };
    const doc = buildRealOperationalDocument("trips.list", report, lookups,
      "2026-01-01", "2026-01-31", "2026-02-01",
      { vehicle: "عربية ١", contractor: "المقاول الأول" });
    expect(doc.businessName).not.toContain("تجريبية");
    expect(doc.metadata).toContainEqual({ label: "العربية المحددة", value: "عربية ١" });
    expect(doc.metadata).toContainEqual({ label: "المقاول المحدد", value: "المقاول الأول" });
    expect(doc.columns.length).toBe(16);
    expect(doc.rows[0]).toContain("عربية ١");
    expect(doc.rows[0]).toContain("المقاول الأول");
    expect(doc.rows[0]).toContain("12.500");
    expect(doc.rows[0]).toContain("90071992547409931.23");
    expect(doc.rows[0]).toContain("السويس");
  });
  it("includes SQL period opening, closing and current cash without recomputing", () => {
    const report = {
      rows: [{ id: "PAY1", payment_date: "2026-01-02",
        vehicle_id: "V1", responsible_contractor_id: "K1",
        amount_piastres: "12500", notes: null, cancel_reason: null }],
      total_count: 1, next_cursor: null,
      period_opening_piastres: "10000",
      period_closing_piastres: "-2500",
      current_cash_balance_piastres: "9007199254740993123"
    };
    const doc = buildRealOperationalDocument("payments.list", report, lookups,
      "2026-01-01", "2026-01-31", "2026-02-01");
    expect(doc.rows[0]).toContain("125.00");
    const metrics = doc.summarySections[0]!.metrics;
    expect(metrics.find(m => m.label === "رصيد أول الفترة")?.value).toBe("100.00 ج.م");
    expect(metrics.find(m => m.label === "رصيد آخر الفترة")?.value).toBe("-25.00 ج.م");
    expect(metrics.find(m => m.label === "الرصيد الحالي")?.value).toBe("90071992547409931.23 ج.م");
    expect(() => buildRealOperationalDocument("payments.list", {
      ...report, period_closing_piastres: "1.1"
    }, lookups, "2026-01-01", "2026-01-31", "now")).toThrow();
  });
});
