import { describe, expect, it } from "vitest";
import {
  milliTonnesToTonnes, tripFieldsFromRow, buildTripUpdatePayload
} from "../src/lib/ledger/trip-update-payload";

const row = {
  id: "TR-001", version: 3, is_cancelled: false,
  vehicle_id: "VEH-1", counterparty_contractor_id: "CTR-2",
  direction: "OTHER_SUPPLIES", trip_date: "2026-01-05",
  weight_milli_tonnes: "12500", contractor_rate_piastres: "10050",
  vehicle_rate_piastres: "12025", expense_piastres: "350",
  same_rate: false, origin: "Cairo", destination: "Suez",
  notes: "Historical note", receipt_number: "OLD-RECEIPT-77"
};

describe("versioned real trip edits", () => {
  it("maps exact SQL bigint values without float rounding", () => {
    expect(milliTonnesToTonnes("12500")).toBe("12.500");
    expect(milliTonnesToTonnes("1")).toBe("0.001");
    expect(milliTonnesToTonnes("9223372036854775807")).toBe("9223372036854775.807");
    const fields = tripFieldsFromRow(row);
    expect(fields.weight_tonnes).toBe("12.500");
    expect(fields.contractor_rate_egp).toBe("100.50");
    expect(fields.vehicle_rate_egp).toBe("120.25");
    expect(fields.expense_egp).toBe("3.50");
    expect(fields.origin).toBe("Cairo");
    expect(fields.destination).toBe("Suez");
    expect(fields.notes).toBe("Historical note");
  });
  it("preserves hidden receipt, note, route and optimistic version", () => {
    const fields = { ...tripFieldsFromRow(row), reason: "Correction" };
    const payload = buildTripUpdatePayload(row, fields);
    expect(payload).toMatchObject({
      id: "TR-001", expected_version: 3, reason: "Correction",
      weight_tonnes: "12.500", contractor_rate_egp: "100.50",
      vehicle_rate_egp: "120.25", expense_egp: "3.50",
      origin: "Cairo", destination: "Suez", notes: "Historical note",
      receipt_number: "OLD-RECEIPT-77", same_rate: false
    });
    expect(payload).not.toHaveProperty("contractor_total_piastres");
    expect(payload).not.toHaveProperty("vehicle_total_piastres");
  });
  it("matches rates exactly when same-rate is enabled", () => {
    const payload = buildTripUpdatePayload(row, {
      ...tripFieldsFromRow(row), same_rate: true,
      vehicle_rate_egp: "999.00", reason: "Match rates"
    });
    expect(payload.vehicle_rate_egp).toBe("100.50");
  });
  it("rejects missing reasons, cancelled/stale versions and invalid money", () => {
    const fields = { ...tripFieldsFromRow(row), reason: "Corrected" };
    expect(() => buildTripUpdatePayload(row, { ...fields, reason: " " })).toThrow();
    expect(() => buildTripUpdatePayload({ ...row, is_cancelled: true }, fields)).toThrow();
    expect(() => buildTripUpdatePayload({ ...row, version: null }, fields)).toThrow();
    expect(() => buildTripUpdatePayload(row, { ...fields, weight_tonnes: "0" })).toThrow();
    expect(() => buildTripUpdatePayload(row, { ...fields, contractor_rate_egp: "1.234" })).toThrow();
    expect(() => buildTripUpdatePayload(row, { ...fields, trip_date: "tomorrow" })).toThrow();
    expect(() => milliTonnesToTonnes("9223372036854775808")).toThrow();
    expect(() => milliTonnesToTonnes("1.5")).toThrow();
  });
});
