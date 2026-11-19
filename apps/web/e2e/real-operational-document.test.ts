import { describe, expect, it } from "vitest";
import { createOperationalReportImageLayout, paginateOperationalReportForPdf, renderOperationalReportHtml } from "@ledger/statement-export";
import {
  buildRealOperationalDocument, isFullOperationalReport, styleRealOperationalExport
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
  it("lays out 105 full-width trip rows for PNG, paged PDF and fixed paper printing", () => {
    const rows = Array.from({ length: 105 }, (_, index) => ({
      id: `TR-261115-${String(index).padStart(3, "0")}-05`, trip_date: "2026-11-10", vehicle_id: "V1",
      counterparty_contractor_id: "K1", direction: "AHMED_SUPPLIES", origin: "حلوان", destination: "الإسماعيلية",
      weight_milli_tonnes: "33375", contractor_rate_piastres: "50000", vehicle_rate_piastres: "50000",
      expense_piastres: "50000", contractor_total_piastres: "1718800", vehicle_total_piastres: "1718800",
      notes: "توريد سن للمشروع", is_cancelled: false,
    }));
    const source = buildRealOperationalDocument("trips.list", {
      rows, total_count: "105", next_cursor: null,
      totals: { contractor_total_piastres: "255337500", vehicle_total_piastres: "251372400",
        ahmed_work_piastres: "165108300", counterparty_work_piastres: "90229200", active_count: "105" },
    }, { ...lookups, contractors: new Map([["K1", "مؤسسة البناء للمقاولات"]]) },
    "2026-07-16", "2026-11-17", "2026-11-19", { vehicle: "عربية ١" });
    const paper = styleRealOperationalExport(source, "trips.list");
    expect(source.presentation).toBeUndefined();
    expect(paper.rows).toBe(source.rows);
    expect(paper.columns.map(column => column.label)).toEqual(source.columns.map(column => column.label));
    expect(paper.summarySections.flatMap(section => section.metrics.map(metric => metric.value)).sort())
      .toEqual(source.summarySections[0]!.metrics.map(metric => metric.value).sort());
    expect(createOperationalReportImageLayout(paper)).toMatchObject({ width: 1440 });
    const pages = paginateOperationalReportForPdf(paper);
    expect(pages.length).toBeGreaterThan(1);
    const pagedRows = pages.flatMap(page => page.rows);
    expect(pagedRows).toEqual(paper.rows);
    expect(pagedRows.map(row => row[0])).toEqual(Array.from({ length: 105 }, (_, index) =>
      (index + 1).toLocaleString("ar-EG", { useGrouping: false })));
    const html = renderOperationalReportHtml(paper);
    expect(html).toContain('class="details-table wide-table"');
    expect(html).toContain('<span class="ltr-token">2026-11-10</span>');
    expect(html).toContain('<span class="ltr-token">١٠٥</span>');
    expect(html).not.toContain('TR-261115-104-05');
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
      notes: "تسوية", is_cancelled: true, cancel_reason: "سبب خاص"
    }], total_count: "1", next_cursor: null };
    const doc = buildRealOperationalDocument("trips.list", report, lookups,
      "2026-01-01", "2026-01-31", "2026-02-01",
      { vehicle: "عربية ١", contractor: "المقاول الأول" });
    expect(doc.businessName).not.toContain("تجريبية");
    expect(doc.metadata).toContainEqual({ label: "العربية المحددة", value: "عربية ١" });
    expect(doc.metadata).toContainEqual({ label: "المقاول المحدد", value: "المقاول الأول" });
    expect(doc.columns).toHaveLength(15);
    expect(doc.columns[0]?.label).toBe("م");
    expect(doc.columns.map(column => column.label)).not.toContain("سبب الإلغاء");
    expect(doc.rows[0]?.[0]).toBe("١");
    expect(doc.rows[0]).toContain("ملغى");
    expect(doc.rows[0]).not.toContain("سبب خاص");
    expect(doc.rows[0]).not.toContain("TR1");
    expect(doc.rows[0]).toContain("عربية ١");
    expect(doc.rows[0]).toContain("المقاول الأول");
    expect(doc.rows[0]).toContain("12.500");
    expect(doc.rows[0]).toContain("90,071,992,547,409,931");
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
    expect(doc.rows[0]?.[0]).toBe("PAY1");
    expect(doc.columns.at(-1)?.label).toBe("سبب الإلغاء");
    expect(doc.rows[0]).toContain("125");
    const metrics = doc.summarySections[0]!.metrics;
    expect(metrics.find(m => m.label === "رصيد أول الفترة")?.value).toBe("100 ج.م");
    expect(metrics.find(m => m.label === "رصيد آخر الفترة")?.value).toBe("-25 ج.م");
    expect(metrics.find(m => m.label === "الرصيد الحالي")?.value).toBe("90,071,992,547,409,931 ج.م");
    expect(() => buildRealOperationalDocument("payments.list", {
      ...report, period_closing_piastres: "1.1"
    }, lookups, "2026-01-01", "2026-01-31", "now")).toThrow();
  });
});
