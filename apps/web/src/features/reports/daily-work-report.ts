import { calculateTripAmounts, summarizeTrips } from "@ledger/accounting";
import type { DemoTripRecord } from "../../demo/demo-types";
import { validOpeningDate } from "../master-data/master-data-validation";

/** A work-volume report, NOT a balance, payment report, or cash ledger. */
export interface DailyWorkFilters {
  readonly workDate: string;
  readonly contractorId: string;
  readonly vehicleId: string;
}

export interface DailyWorkTotals {
  readonly tripCount: number;
  readonly totalWeightTonnes: string;
  readonly contractorTotalPiastres: string;
  readonly vehicleTotalPiastres: string;
}

export type DailyWorkReport =
  | {
      readonly ok: true;
      readonly rows: readonly DemoTripRecord[];
      readonly totals: DailyWorkTotals;
      readonly ahmedSupplies: DailyWorkTotals;
      readonly otherSupplies: DailyWorkTotals;
    }
  | {
      readonly ok: false;
      readonly error: "INVALID_DATE" | "INCONSISTENT_TRIP";
      readonly tripId?: string;
    };

function totalsFor(rows: readonly DemoTripRecord[]): DailyWorkTotals | null {
  const summary = summarizeTrips(rows.map(t => ({
    weightTonnes: t.weightTonnes,
    contractorRateEgp: t.contractorRateEgp,
    vehicleRateEgp: t.vehicleRateEgp,
    expenseEgp: t.expenseEgp,
  })));
  if (!summary.ok) return null;
  return {
    tripCount: summary.tripCount,
    totalWeightTonnes: summary.totalWeightTonnes,
    contractorTotalPiastres: summary.contractorTotalPiastres,
    vehicleTotalPiastres: summary.vehicleTotalPiastres,
  };
}

/**
 * Recalculate from the same approved trip engine and compare saved demo
 * snapshots. If one snapshot disagrees, fail closed rather than show a
 * misleading financial total. No arithmetic is duplicated in the UI.
 */
export function buildDailyWorkReport(
  trips: readonly DemoTripRecord[],
  filters: DailyWorkFilters
): DailyWorkReport {
  if (!validOpeningDate(filters.workDate)) {
    return { ok: false, error: "INVALID_DATE" };
  }

  const rows = trips.filter(t =>
    t.workDate === filters.workDate &&
    (!filters.contractorId || t.counterpartyId === filters.contractorId) &&
    (!filters.vehicleId || t.vehicleId === filters.vehicleId)
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  for (const trip of rows) {
    const computed = calculateTripAmounts({
      weightTonnes: trip.weightTonnes,
      contractorRateEgp: trip.contractorRateEgp,
      vehicleRateEgp: trip.vehicleRateEgp,
      expenseEgp: trip.expenseEgp,
    });
    if (!computed.ok ||
      computed.contractorTotalPiastres !== trip.contractorTotalPiastres ||
      computed.vehicleTotalPiastres !== trip.vehicleTotalPiastres ||
      (trip.direction !== "AHMED_SUPPLIES" && trip.direction !== "OTHER_SUPPLIES")) {
      return { ok: false, error: "INCONSISTENT_TRIP", tripId: trip.id };
    }
  }

  const totals = totalsFor(rows);
  const ahmedSupplies = totalsFor(rows.filter(t => t.direction === "AHMED_SUPPLIES"));
  const otherSupplies = totalsFor(rows.filter(t => t.direction === "OTHER_SUPPLIES"));
  if (!totals || !ahmedSupplies || !otherSupplies) {
    return { ok: false, error: "INCONSISTENT_TRIP" };
  }

  return { ok: true, rows, totals, ahmedSupplies, otherSupplies };
}
