import { describe, expect, it } from "vitest";
import { createEntryState } from "../src/entry-state";
import { applyActions } from "./helpers";

describe("ENTRY-01: applying shared data, starting new trips, and session rollover", () => {
  describe("4) applying shared data, starting new trips, and disabling shared data", () => {
    it("applies sharedDraft without overwriting any field in the current tripDraft, then copies only shared fields on START_NEW_TRIP", () => {
      const stateWithEditedTrip = applyActions(createEntryState("2026-11-03"), [
        { type: "EDIT_TRIP_TEXT", field: "origin", value: "حلوان" },
        { type: "EDIT_TRIP_VEHICLE", vehicleId: "veh-1" },
        { type: "EDIT_TRIP_TEXT", field: "weightTonnes", value: "30.250" },
        { type: "EDIT_TRIP_TEXT", field: "receiptNumber", value: "REC-1" },
        { type: "EDIT_TRIP_TEXT", field: "notes", value: "ملاحظة خاصة" },
        { type: "EDIT_SHARED_TEXT", field: "workDate", value: "2026-11-02" },
        { type: "EDIT_SHARED_TEXT", field: "origin", value: "بني سويف" },
        { type: "EDIT_SHARED_TEXT", field: "destination", value: "العاشر" },
        { type: "EDIT_SHARED_COUNTERPARTY", counterpartyId: "cont-99" },
        { type: "EDIT_SHARED_DIRECTION", direction: "AHMED_SUPPLIES" },
        { type: "SET_SHARED_SAME_RATE", sameRate: false },
        { type: "EDIT_SHARED_CONTRACTOR_RATE", value: "110" },
        { type: "EDIT_SHARED_VEHICLE_RATE", value: "95" },
        { type: "EDIT_SHARED_TEXT", field: "expenseEgp", value: "200" },
        { type: "APPLY_SHARED" },
      ]);

      // Current trip draft must remain untouched after APPLY_SHARED
      expect(stateWithEditedTrip.tripDraft).toEqual({
        workDate: "2026-11-03",
        origin: "حلوان",
        destination: "",
        counterpartyId: null,
        direction: null,
        sameRate: true,
        contractorRateEgp: "",
        vehicleRateEgp: "",
        expenseEgp: "",
        vehicleId: "veh-1",
        weightTonnes: "30.250",
        receiptNumber: "REC-1",
        notes: "ملاحظة خاصة",
      });

      // Starting a new trip copies appliedShared and resets trip-specific fields
      const nextTripState = applyActions(stateWithEditedTrip, [
        { type: "START_NEW_TRIP" },
      ]);

      expect(nextTripState.tripDraft).toEqual({
        workDate: "2026-11-02",
        origin: "بني سويف",
        destination: "العاشر",
        counterpartyId: "cont-99",
        direction: "AHMED_SUPPLIES",
        sameRate: false,
        contractorRateEgp: "110",
        vehicleRateEgp: "95",
        expenseEgp: "200",
        vehicleId: null,
        weightTonnes: "",
        receiptNumber: "",
        notes: "",
      });
    });

    it("disables appliedShared without altering current tripDraft or sharedDraft, and starts subsequent trip blank", () => {
      const state = applyActions(createEntryState("2026-11-03"), [
        { type: "EDIT_SHARED_TEXT", field: "origin", value: "طنطا" },
        { type: "EDIT_SHARED_CONTRACTOR_RATE", value: "70" },
        { type: "APPLY_SHARED" },
        { type: "START_NEW_TRIP" },
        { type: "EDIT_TRIP_VEHICLE", vehicleId: "veh-9" },
        { type: "DISABLE_SHARED" },
      ]);

      expect(state.appliedShared).toBeNull();
      expect(state.sharedDraft.origin).toBe("طنطا");
      expect(state.tripDraft.origin).toBe("طنطا");
      expect(state.tripDraft.vehicleId).toBe("veh-9");

      const afterNewTrip = applyActions(state, [{ type: "START_NEW_TRIP" }]);
      expect(afterNewTrip.tripDraft).toEqual({
        workDate: "2026-11-03",
        origin: "",
        destination: "",
        counterpartyId: null,
        direction: null,
        sameRate: true,
        contractorRateEgp: "",
        vehicleRateEgp: "",
        expenseEgp: "",
        vehicleId: null,
        weightTonnes: "",
        receiptNumber: "",
        notes: "",
      });
    });
  });


  describe("5) starting a new day/session and full workflow sequence", () => {
    it("executes a full multi-step workflow: shared setup, custom trip edit, shared update, new trip, and new day rollover without losing unsaved tripDraft", () => {
      // Step 1: Create session on Day 1 and configure shared settings
      const s1 = applyActions(createEntryState("2026-11-03"), [
        { type: "EDIT_SHARED_TEXT", field: "origin", value: "دمياط" },
        { type: "EDIT_SHARED_TEXT", field: "destination", value: "الجيزة" },
        { type: "EDIT_SHARED_COUNTERPARTY", counterpartyId: "c-1" },
        { type: "EDIT_SHARED_DIRECTION", direction: "OTHER_SUPPLIES" },
        { type: "EDIT_SHARED_CONTRACTOR_RATE", value: "150" },
        { type: "EDIT_SHARED_TEXT", field: "expenseEgp", value: "300" },
        { type: "APPLY_SHARED" },
        { type: "START_NEW_TRIP" },
      ]);

      // Step 2: Customize current trip and edit sharedDraft + re-apply
      const s2 = applyActions(s1, [
        { type: "EDIT_TRIP_VEHICLE", vehicleId: "v-10" },
        { type: "EDIT_TRIP_TEXT", field: "weightTonnes", value: "35.500" },
        { type: "EDIT_TRIP_TEXT", field: "destination", value: "أكتوبر" },
        { type: "EDIT_SHARED_TEXT", field: "destination", value: "العبور" },
        { type: "EDIT_SHARED_CONTRACTOR_RATE", value: "160" },
        { type: "APPLY_SHARED" },
      ]);

      // Current modified trip must keep "أكتوبر" and "150"
      expect(s2.tripDraft.destination).toBe("أكتوبر");
      expect(s2.tripDraft.contractorRateEgp).toBe("150");
      expect(s2.tripDraft.vehicleId).toBe("v-10");

      // Step 3: Start second trip on Day 1 -> gets updated appliedShared ("العبور", "160")
      const s3 = applyActions(s2, [
        { type: "START_NEW_TRIP" },
        { type: "EDIT_TRIP_VEHICLE", vehicleId: "v-20" },
        { type: "EDIT_TRIP_TEXT", field: "notes", value: "نقلة غير محفوظة" },
      ]);
      expect(s3.tripDraft.destination).toBe("العبور");
      expect(s3.tripDraft.contractorRateEgp).toBe("160");
      expect(s3.tripDraft.weightTonnes).toBe("");

      // Step 4: Start new session on Day 2 ("2026-11-04")
      const s4 = applyActions(s3, [
        { type: "START_NEW_SESSION", sessionDate: "2026-11-04" },
      ]);

      // Unsaved tripDraft from Day 1 is preserved intact including its old workDate
      expect(s4.sessionDate).toBe("2026-11-04");
      expect(s4.appliedShared).toBeNull();
      expect(s4.sharedDraft).toEqual({
        workDate: "2026-11-04",
        origin: "",
        destination: "",
        counterpartyId: null,
        direction: null,
        sameRate: true,
        contractorRateEgp: "",
        vehicleRateEgp: "",
        expenseEgp: "",
      });
      expect(s4.tripDraft.workDate).toBe("2026-11-03");
      expect(s4.tripDraft.destination).toBe("العبور");
      expect(s4.tripDraft.vehicleId).toBe("v-20");
      expect(s4.tripDraft.notes).toBe("نقلة غير محفوظة");

      // Step 5: Starting a new trip on Day 2 uses new sessionDate and carries zero values from Day 1
      const s5 = applyActions(s4, [{ type: "START_NEW_TRIP" }]);
      expect(s5.tripDraft).toEqual({
        workDate: "2026-11-04",
        origin: "",
        destination: "",
        counterpartyId: null,
        direction: null,
        sameRate: true,
        contractorRateEgp: "",
        vehicleRateEgp: "",
        expenseEgp: "",
        vehicleId: null,
        weightTonnes: "",
        receiptNumber: "",
        notes: "",
      });
    });
  });

});
