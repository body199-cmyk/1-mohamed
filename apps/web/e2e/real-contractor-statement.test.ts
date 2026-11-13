import { describe, expect, it } from "vitest";
import {
  type LiveStatementReport, verifyLiveStatement, assertSameStatementSnapshot,
  liveStatementDocument
} from "../src/features/ledger/contractor-statement-document";

const report: LiveStatementReport = {
  status: "OK", counterparty_contractor_id: "K_OTHER",
  date_from: "2026-01-03", date_to: "2026-01-04",
  opening_balance_piastres: "20000", ahmed_work_piastres: "10000",
  counterparty_work_piastres: "20000", closing_balance_piastres: "10000",
  beneficiary: "AHMED", balance_magnitude_piastres: "10000",
  total_count: "2", next_cursor: null,
  rows: [
    { id: "T1", trip_date: "2026-01-03", vehicle_id: "V1", origin: null,
      destination: null, notes: null, direction: "OTHER_SUPPLIES",
      weight_milli_tonnes: "2000", contractor_total_piastres: "20000",
      signed_delta_piastres: "-20000", running_balance_piastres: "0" },
    { id: "T2", trip_date: "2026-01-04", vehicle_id: "V1", origin: "Cairo",
      destination: "Suez", notes: "Note", direction: "AHMED_SUPPLIES",
      weight_milli_tonnes: "1000", contractor_total_piastres: "10000",
      signed_delta_piastres: "10000", running_balance_piastres: "10000" }
  ]
};

describe("real contractor statement export release gate", () => {
  it("reconciles signed totals and builds a non-demo document", () => {
    expect(() => verifyLiveStatement(report)).not.toThrow();
    const doc = liveStatementDocument(report, "مقاول تجريبي", "2026-01-05");
    expect(doc.businessName).not.toContain("بيانات تجريبية");
    expect(doc.summary.closingBalanceText).toBe("+100.00 ج.م");
    expect(doc.summary.counterpartyWorkText).toBe("-200.00 ج.م");
    expect(doc.summary.closingBeneficiaryText).toContain("أحمد");
    expect(doc.rows.map(r => r.runningBalanceText)).toEqual(["0.00 ج.م", "+100.00 ج.م"]);
  });
  it("blocks export of partial pages even when SQL totals are correct", () => {
    const partial: LiveStatementReport = {
      ...report, rows: report.rows.slice(0, 1),
      next_cursor: { date: "2026-01-03", id: "T1" }
    };
    expect(() => verifyLiveStatement(partial)).not.toThrow();
    expect(() => liveStatementDocument(partial, "Other", "2026-01-05")).toThrow(/حمّل/);
  });
  it("fails closed for altered summary, wrong sign and running balance", () => {
    expect(() => verifyLiveStatement({ ...report, closing_balance_piastres: "10001" })).toThrow();
    expect(() => verifyLiveStatement({ ...report, beneficiary: "COUNTERPARTY" })).toThrow();
    expect(() => verifyLiveStatement({ ...report, rows: [
      { ...report.rows[0]!, running_balance_piastres: "1" }, report.rows[1]!
    ] })).toThrow();
    expect(() => verifyLiveStatement({ ...report, rows: [
      { ...report.rows[0]!, signed_delta_piastres: "20000" }, report.rows[1]!
    ] })).toThrow();
  });
  it("rejects stale pagination snapshots", () => {
    expect(() => assertSameStatementSnapshot(report, {
      ...report, total_count: "3"
    })).toThrow();
    expect(() => assertSameStatementSnapshot(report, {
      ...report, closing_balance_piastres: "10001"
    })).toThrow();
  });
  it("preserves exact balances above JS safe integer without Number", () => {
    const huge: LiveStatementReport = {
      ...report, rows: [], total_count: "0",
      opening_balance_piastres: "9007199254740993123",
      ahmed_work_piastres: "0", counterparty_work_piastres: "0",
      closing_balance_piastres: "9007199254740993123",
      balance_magnitude_piastres: "9007199254740993123"
    };
    const doc = liveStatementDocument(huge, "Other", "2026-01-05");
    expect(doc.summary.closingBalanceText).toBe("+90071992547409931.23 ج.م");
  });
});
