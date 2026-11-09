import { describe, expect, it } from "vitest";
import { validateTripCashOpening, writeDemoTrip } from "../src/features/trips/trip-cash-opening-validation";
import { DEMO_PRIMARY_RESPONSIBLE_ID } from "../src/features/payments/cash-ledger";
import type { DemoVehicleCashOpening, DemoTripRecord } from "../src/demo/demo-types";

const start = "2026-11-05";
const initial: DemoVehicleCashOpening[] = [
  { vehicleId: "V1", contractorId: DEMO_PRIMARY_RESPONSIBLE_ID, startDate: start, signedPiastres: "10000" },
  { vehicleId: "V1", contractorId: "K1", startDate: start, signedPiastres: "20000" },
];
const trip = (direction: "AHMED_SUPPLIES" | "OTHER_SUPPLIES", workDate: string) => ({
  workDate, vehicleId: "V1", counterpartyId: "K1", direction,
});

describe("FIN-03 — trip entry must respect responsible vehicle cash opening", () => {
  for (const direction of ["AHMED_SUPPLIES", "OTHER_SUPPLIES"] as const) {
    it(`rejects a pre-opening trip for ${direction} without any ledger mutation`, () => {
      const original = structuredClone(initial);
      const result = validateTripCashOpening(trip(direction, "2026-11-04"), initial);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("افتتاحي نقد العربية");
      expect(initial).toEqual(original);
    });

    it(`accepts a trip on opening day for ${direction}`, () => {
      expect(validateTripCashOpening(trip(direction, start), initial)).toEqual({ ok: true });
    });
  }

  it("checks only the matching responsible contractor and vehicle", () => {
    const otherVehicle = { ...trip("AHMED_SUPPLIES", "2026-11-04"), vehicleId: "V2" };
    expect(validateTripCashOpening(otherVehicle, initial).ok).toBe(true);
    const otherCounterparty = { ...trip("OTHER_SUPPLIES", "2026-11-04"), counterpartyId: "K2" };
    expect(validateTripCashOpening(otherCounterparty, initial).ok).toBe(true);
    // Ahmed's vehicle account must not be blocked by K1's different opening date.
    const onlyOther: DemoVehicleCashOpening[] = [initial[1]!];
    expect(validateTripCashOpening(trip("AHMED_SUPPLIES", "2026-11-04"), onlyOther).ok).toBe(true);
  });

  it("fails closed for invalid dates, direction and corrupt opening data", () => {
    expect(validateTripCashOpening(trip("AHMED_SUPPLIES", "2026-02-30"), initial).ok).toBe(false);
    expect(validateTripCashOpening({
      ...trip("AHMED_SUPPLIES", start),
      direction: "UNKNOWN" as "AHMED_SUPPLIES",
    }, initial).ok).toBe(false);
    const invalid = [{ ...initial[0]!, startDate: "2026-02-30" }];
    expect(validateTripCashOpening(trip("AHMED_SUPPLIES", start), invalid).ok).toBe(false);
    const duplicate = [initial[0]!, initial[0]!];
    expect(validateTripCashOpening(trip("AHMED_SUPPLIES", start), duplicate).ok).toBe(false);
  });
});

describe("FIN-03 DemoStore.addTrip write boundary — no mutation before opening", () => {
  const input: Omit<DemoTripRecord, "id" | "createdAt"> = {
    workDate:"2026-11-04",counterpartyId:"K1",vehicleId:"V1",
    direction:"AHMED_SUPPLIES",origin:"A",destination:"B",
    weightTonnes:"1.000",contractorRateEgp:"100",vehicleRateEgp:"100",
    expenseEgp:"0",contractorTotalPiastres:"10000",
    vehicleTotalPiastres:"10000",receiptNumber:"",notes:""
  };
  it.each(["AHMED_SUPPLIES","OTHER_SUPPLIES"] as const)(
    "rejects before-opening %s at write boundary, then commits exactly one opening-day trip",
    direction => {
      const entries: DemoTripRecord[] = [];
      let idCount = 0;
      const nextId = () => "TRIP-"+(++idCount);
      const commit = (record: DemoTripRecord) => { entries.unshift(record); };
      const draft = {...input,direction};
      const before = structuredClone(draft);
      expect(() => writeDemoTrip(draft,initial,nextId,commit)).toThrow("افتتاحي نقد العربية");
      expect(entries).toHaveLength(0);
      expect(idCount).toBe(0);
      expect(draft).toEqual(before);
      const saved = writeDemoTrip({...draft,workDate:start},initial,nextId,commit,()=> "2026-11-05T12:00:00.000Z");
      expect(saved.id).toBe("TRIP-1");
      expect(saved.workDate).toBe(start);
      expect(entries).toEqual([saved]);
      expect(idCount).toBe(1);
    }
  );
});
