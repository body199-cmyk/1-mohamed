import { assertDecimal, piastresToPounds } from "./amounts";

const MAX_BIGINT = 9223372036854775807n;

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Missing " + field);
  return value;
}

/** No Number conversion: SQL stores tonnes as integer thousandths. */
export function milliTonnesToTonnes(input: string): string {
  if (!/^(0|[1-9][0-9]*)$/.test(input)) throw new Error("Invalid SQL weight");
  const n = BigInt(input);
  if (n > MAX_BIGINT) throw new Error("Weight exceeds SQL bigint");
  return (n / 1000n).toString() + "." + (n % 1000n).toString().padStart(3, "0");
}

export type TripEditFields = {
  vehicle_id: string;
  counterparty_contractor_id: string;
  direction: "AHMED_SUPPLIES" | "OTHER_SUPPLIES";
  trip_date: string;
  weight_tonnes: string;
  contractor_rate_egp: string;
  vehicle_rate_egp: string;
  same_rate: boolean;
  expense_egp: string;
  origin: string;
  destination: string;
  notes: string;
  reason: string;
};

/**
 * Keep the SQL record ID, version and hidden legacy receipt unchanged.
 * The database remains authoritative for all totals, account routing and
 * historical cash chronology; never submit browser-computed totals.
 */
export function buildTripUpdatePayload(row: Record<string, unknown>, fields: TripEditFields):
  Record<string, unknown> {
  const id = requiredText(row.id, "trip id");
  if (!Number.isSafeInteger(row.version) || (row.version as number) < 1) {
    throw new Error("Invalid trip version");
  }
  if (row.is_cancelled !== false) throw new Error("Cannot edit a cancelled trip");
  if (!fields.reason.trim()) throw new Error("سبب التعديل مطلوب.");
  if (!fields.vehicle_id || !fields.counterparty_contractor_id) {
    throw new Error("حدد العربية والمقاول.");
  }
  if (!["AHMED_SUPPLIES", "OTHER_SUPPLIES"].includes(fields.direction)) {
    throw new Error("اتجاه النقلة غير صالح.");
  }
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(fields.trip_date)) {
    throw new Error("تاريخ النقلة غير صالح.");
  }
  const weight = assertDecimal(fields.weight_tonnes, 3, true);
  const contractorRate = assertDecimal(fields.contractor_rate_egp, 2, false);
  const vehicleRate = fields.same_rate ? contractorRate :
    assertDecimal(fields.vehicle_rate_egp, 2, false);
  const expense = assertDecimal(fields.expense_egp, 2, false);
  if (fields.notes.length > 400 || fields.origin.length > 160 ||
      fields.destination.length > 160 || fields.reason.length > 400) {
    throw new Error("النص أكبر من الحد المسموح.");
  }
  return {
    id, expected_version: row.version, reason: fields.reason.trim(),
    vehicle_id: fields.vehicle_id,
    counterparty_contractor_id: fields.counterparty_contractor_id,
    direction: fields.direction, trip_date: fields.trip_date,
    weight_tonnes: weight, contractor_rate_egp: contractorRate,
    vehicle_rate_egp: vehicleRate, same_rate: fields.same_rate,
    expense_egp: expense, origin: fields.origin.trim() || null,
    destination: fields.destination.trim() || null, notes: fields.notes.trim(),
    // User removed the receipt-number control; preserve existing legacy data.
    receipt_number: typeof row.receipt_number === "string" ? row.receipt_number : null
  };
}

export function tripFieldsFromRow(row: Record<string, unknown>): Omit<TripEditFields, "reason"> {
  return {
    vehicle_id: requiredText(row.vehicle_id, "vehicle"),
    counterparty_contractor_id: requiredText(row.counterparty_contractor_id, "contractor"),
    direction: row.direction === "OTHER_SUPPLIES" ? "OTHER_SUPPLIES" : "AHMED_SUPPLIES",
    trip_date: requiredText(row.trip_date, "date"),
    weight_tonnes: milliTonnesToTonnes(requiredText(row.weight_milli_tonnes, "weight")),
    contractor_rate_egp: piastresToPounds(requiredText(row.contractor_rate_piastres, "rate")),
    vehicle_rate_egp: piastresToPounds(requiredText(row.vehicle_rate_piastres, "rate")),
    same_rate: row.same_rate === true,
    expense_egp: piastresToPounds(requiredText(row.expense_piastres, "expense")),
    origin: typeof row.origin === "string" ? row.origin : "",
    destination: typeof row.destination === "string" ? row.destination : "",
    notes: typeof row.notes === "string" ? row.notes : ""
  };
}
