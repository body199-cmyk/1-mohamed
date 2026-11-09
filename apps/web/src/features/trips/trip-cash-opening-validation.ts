import type { DemoTripRecord, DemoVehicleCashOpening } from "../../demo/demo-types";
import { validOpeningDate, validOpeningPiastres } from "../master-data/master-data-validation";
import { DEMO_PRIMARY_RESPONSIBLE_ID } from "../payments/cash-ledger";

type TripCashAccount = Pick<DemoTripRecord, "workDate" | "vehicleId" | "counterpartyId" | "direction">;
export type TripCashOpeningCheck = { readonly ok: true } |
  { readonly ok: false; readonly error: string };

/** Validate the responsible vehicle cash account before a trip is persisted. */
export function validateTripCashOpening(
  trip: TripCashAccount,
  cashOpenings: readonly DemoVehicleCashOpening[]
): TripCashOpeningCheck {
  if (!validOpeningDate(trip.workDate)) {
    return { ok: false, error: "تاريخ النقلة غير صحيح." };
  }
  if (trip.direction !== "AHMED_SUPPLIES" && trip.direction !== "OTHER_SUPPLIES") {
    return { ok: false, error: "اتجاه النقلة غير صالح." };
  }
  const responsibleId = trip.direction === "AHMED_SUPPLIES"
    ? DEMO_PRIMARY_RESPONSIBLE_ID : trip.counterpartyId;
  const matching = cashOpenings.filter(o =>
    o.vehicleId === trip.vehicleId && o.contractorId === responsibleId
  );
  if (matching.length > 1) {
    return { ok: false, error: "يوجد أكثر من افتتاحي لنفس حساب نقد العربية؛ راجع البيانات." };
  }
  const opening = matching[0];
  if (!opening) return { ok: true };
  if (!validOpeningDate(opening.startDate) || !validOpeningPiastres(opening.signedPiastres)) {
    return { ok: false, error: "افتتاحي نقد العربية لهذا الحساب غير صالح." };
  }
  if (trip.workDate < opening.startDate) {
    return { ok: false, error: "تاريخ النقلة يسبق بداية افتتاحي نقد العربية لدى المقاول المسؤول." };
  }
  return { ok: true };
}

/**
 * The actual DemoStore write path. Validation must run before allocating a
 * sequence ID or mutating state; the form guard alone cannot enforce this.
 * The commit callback is supplied by DemoStoreProvider's state setter.
 */
export function writeDemoTrip(
  trip: Omit<DemoTripRecord, "id" | "createdAt">,
  cashOpenings: readonly DemoVehicleCashOpening[],
  nextId: () => string,
  commit: (record: DemoTripRecord) => void,
  nowIso: () => string = () => new Date().toISOString()
): DemoTripRecord {
  const check = validateTripCashOpening(trip, cashOpenings);
  if (!check.ok) throw new Error(check.error);
  const record: DemoTripRecord = { ...trip, id: nextId(), createdAt: nowIso() };
  commit(record);
  return record;
}
