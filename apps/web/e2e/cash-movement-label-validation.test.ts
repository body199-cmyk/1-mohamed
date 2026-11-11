import { describe, expect, it } from "vitest";
import { buildCashLedger, DEMO_PRIMARY_RESPONSIBLE_ID } from "../src/features/payments/cash-ledger";
import type { DemoTripRecord, DemoPayment, DemoVehicleCashOpening } from "../src/demo/demo-types";

// CASH-LABEL-01: the cash ledger movement description must use the movement's
// own identifier (trip.id / payment.id) and never leak the receipt number,
// while the original receipt data stays intact on the source records.
const trip = (id: string, receipt: string): DemoTripRecord => ({
  id, workDate: "2026-11-02", counterpartyId: "K1", vehicleId: "V1",
  direction: "AHMED_SUPPLIES",
  origin: "محجر", destination: "موقع",
  weightTonnes: "1.000", contractorRateEgp: "280.00", vehicleRateEgp: "280.00",
  expenseEgp: "0.00", contractorTotalPiastres: "28000",
  vehicleTotalPiastres: "28000",
  receiptNumber: receipt, notes: "", createdAt: "2026-11-02T10:00:00.000Z",
});
const payment = (id: string, receipt: string): DemoPayment => ({
  id, vehicleId: "V1", responsibleContractorId: DEMO_PRIMARY_RESPONSIBLE_ID,
  paymentDate: "2026-11-03", amountPiastres: "10000", linkedTripId: "",
  receiptNumber: receipt, notes: "", createdAt: "2026-11-03T13:00:00.000Z",
  version: 1, isCancelled: false, cancelReason: "",
});
const opening: DemoVehicleCashOpening = {
  vehicleId: "V1", contractorId: DEMO_PRIMARY_RESPONSIBLE_ID,
  startDate: "2026-11-01", signedPiastres: "0",
};

describe("CASH-LABEL-01 cash movement descriptions use movement identifiers, not receipt numbers", () => {
  it("describes a work movement by trip.id and keeps the trip receipt data unchanged", () => {
    const source = {
      trips: [trip("TR-LABEL-1", "REC-77")],
      payments: [],
      cashOpenings: [opening],
    };
    const result = buildCashLedger(source, "V1", DEMO_PRIMARY_RESPONSIBLE_ID, "2026-11-05");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(1);
    const row = result.value.rows[0]!;
    expect(row.id).toBe("TR-LABEL-1");
    expect(row.label).toBe("مستحق نقلة TR-LABEL-1");
    expect(row.label).not.toContain("REC-77");
    // Amounts and balances are untouched by the description fix.
    expect(row.amountPiastres).toBe("28000");
    expect(row.balancePiastres).toBe("28000");
    expect(result.value.balancePiastres).toBe("28000");
    expect(result.value.openingPiastres).toBe("0");
    // Original receipt data remains on the source record.
    expect(source.trips[0]!.receiptNumber).toBe("REC-77");
  });

  it("describes a payment movement by payment.id and keeps the payment receipt data unchanged", () => {
    const source = {
      trips: [trip("TR-LABEL-1", "REC-77")],
      payments: [payment("P-LABEL-1", "REC-P-9")],
      cashOpenings: [opening],
    };
    const result = buildCashLedger(source, "V1", DEMO_PRIMARY_RESPONSIBLE_ID, "2026-11-05");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const workRow = result.value.rows[0]!;
    const payRow = result.value.rows[1]!;
    expect(payRow.id).toBe("P-LABEL-1");
    expect(payRow.type).toBe("PAYMENT");
    expect(payRow.label).toBe("دفعة P-LABEL-1");
    expect(payRow.label).not.toContain("REC-P-9");
    // Payment sign and amount unchanged; balance arithmetic untouched.
    expect(payRow.amountPiastres).toBe("-10000");
    expect(payRow.balancePiastres).toBe("18000");
    expect(result.value.balancePiastres).toBe("18000");
    // Work row still unaffected and trip receipt data intact.
    expect(workRow.label).toBe("مستحق نقلة TR-LABEL-1");
    expect(source.trips[0]!.receiptNumber).toBe("REC-77");
    expect(source.payments[0]!.receiptNumber).toBe("REC-P-9");
  });

  it("falls back to the identifier only, and keeps empty receipt numbers as-is", () => {
    const source = {
      trips: [trip("TR-EMPTY-RC", "")],
      payments: [payment("P-EMPTY-RC", "")],
      cashOpenings: [opening],
    };
    const result = buildCashLedger(source, "V1", DEMO_PRIMARY_RESPONSIBLE_ID, "2026-11-05");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]!.label).toBe("مستحق نقلة TR-EMPTY-RC");
    expect(result.value.rows[1]!.label).toBe("دفعة P-EMPTY-RC");
  });
});
