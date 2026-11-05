import { describe, expect, it } from "vitest";
import { buildDailyWorkReport } from "../src/features/reports/daily-work-report";
import { INITIAL_TRIPS } from "../src/demo/demo-data";

const filters = { workDate: "2026-11-05", contractorId: "", vehicleId: "" };

describe("REPORTS-01 daily demo work report", () => {
  it("filters the exact business date and uses the existing trip engine for both amounts", () => {
    const result = buildDailyWorkReport(INITIAL_TRIPS, filters);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map(t => t.receiptNumber)).toEqual(["REC-002"]);
    expect(result.totals).toEqual({
      tripCount: 1, totalWeightTonnes: "2.000",
      contractorTotalPiastres: "100000", vehicleTotalPiastres: "90000",
    });
    expect(result.ahmedSupplies.tripCount).toBe(1);
    expect(result.otherSupplies.tripCount).toBe(0);
    expect(result.otherSupplies.totalWeightTonnes).toBe("0.000");
  });

  it("keeps the other work direction separate, with exact cents and immutable snapshots", () => {
    const result = buildDailyWorkReport(INITIAL_TRIPS, { ...filters, workDate: "2026-11-06" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].direction).toBe("OTHER_SUPPLIES");
    expect(result.rows[0].receiptNumber).toBe("REC-003");
    expect(result.totals.contractorTotalPiastres).toBe("60000");
    expect(result.totals.vehicleTotalPiastres).toBe("52500");
    expect(result.otherSupplies.tripCount).toBe(1);
    expect(result.ahmedSupplies.tripCount).toBe(0);
  });

  it("intersects contractor and vehicle filters and returns true zero totals on empty days", () => {
    const hit = buildDailyWorkReport(INITIAL_TRIPS, { ...filters, contractorId: "K1", vehicleId: "V2" });
    expect(hit.ok && hit.rows.length === 1).toBe(true);
    const miss = buildDailyWorkReport(INITIAL_TRIPS, { ...filters, contractorId: "K2", vehicleId: "V2" });
    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.totals).toEqual({
      tripCount: 0, totalWeightTonnes: "0.000", contractorTotalPiastres: "0", vehicleTotalPiastres: "0",
    });
    expect(buildDailyWorkReport(INITIAL_TRIPS, { ...filters, workDate: "2026-02-29" })).toEqual({ ok:false,error:"INVALID_DATE" });
  });

  it("retains archived references by ID and rejects a tampered accounting snapshot", () => {
    const archived = [...INITIAL_TRIPS].map(t => ({ ...t }));
    const preserved = buildDailyWorkReport(archived, filters);
    expect(preserved.ok).toBe(true);
    const bad = archived.map(t => t.id === "TRIP-HIST-002" ? { ...t, vehicleTotalPiastres: "90001" } : t);
    expect(buildDailyWorkReport(bad, filters)).toEqual({
      ok:false, error:"INCONSISTENT_TRIP", tripId:"TRIP-HIST-002",
    });
  });

  it("checks per-trip rounding with the original financial engine, not floats", () => {
    const micro = { ...INITIAL_TRIPS[0], workDate:"2026-11-05",
      weightTonnes:"0.005", contractorRateEgp:"1.00", vehicleRateEgp:"1.00",
      expenseEgp:"0.00", contractorTotalPiastres:"1", vehicleTotalPiastres:"1",
      receiptNumber:"0007" };
    const result = buildDailyWorkReport([micro],filters);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.totals.contractorTotalPiastres).toBe("1");
      expect(result.rows[0].receiptNumber).toBe("0007");
    }
  });
});
