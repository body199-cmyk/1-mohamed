import { describe, expect, it } from "vitest";
import { createEntryState, reduceEntry } from "../src/entry-state";
import type { WorkDirection } from "../src/entry-types";
import { applyActions } from "./helpers";

describe("ENTRY-01: initial state, isolated editing, immutability, and serialization", () => {
  describe("1) session creation and direct entry readiness", () => {
    it("creates a fresh session with direct entry ready, appliedShared null, sameRate true, and null direction/counterparty/vehicle", () => {
      const state = createEntryState("2026-11-03");

      expect(state).toEqual({
        sessionDate: "2026-11-03",
        sharedDraft: {
          workDate: "2026-11-03",
          origin: "",
          destination: "",
          counterpartyId: null,
          direction: null,
          sameRate: true,
          contractorRateEgp: "",
          vehicleRateEgp: "",
          expenseEgp: "",
        },
        appliedShared: null,
        tripDraft: {
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
        },
      });
    });
  });


  describe("2) isolated editing, partial strings, and direction handling", () => {
    it("edits tripDraft without mutating sharedDraft or appliedShared", () => {
      const initial = applyActions(createEntryState("2026-11-03"), [
        { type: "EDIT_SHARED_TEXT", field: "origin", value: "السويس" },
        { type: "APPLY_SHARED" },
      ]);

      const updated = applyActions(initial, [
        { type: "EDIT_TRIP_TEXT", field: "origin", value: "العين السخنة" },
        { type: "EDIT_TRIP_VEHICLE", vehicleId: "veh-101" },
        { type: "EDIT_TRIP_TEXT", field: "weightTonnes", value: "24.5" },
        { type: "EDIT_TRIP_TEXT", field: "receiptNumber", value: "R-900" },
        { type: "EDIT_TRIP_TEXT", field: "notes", value: "نقلة أولى" },
      ]);

      expect(updated.sharedDraft.origin).toBe("السويس");
      expect(updated.appliedShared?.origin).toBe("السويس");
      expect(updated.tripDraft.origin).toBe("العين السخنة");
      expect(updated.tripDraft.vehicleId).toBe("veh-101");
      expect(updated.tripDraft.weightTonnes).toBe("24.5");
    });

    it("edits sharedDraft without changing appliedShared or the active tripDraft", () => {
      const initial = applyActions(createEntryState("2026-11-03"), [
        { type: "EDIT_SHARED_TEXT", field: "origin", value: "المنيا" },
        { type: "APPLY_SHARED" },
        { type: "START_NEW_TRIP" },
      ]);

      const afterSharedEdit = applyActions(initial, [
        { type: "EDIT_SHARED_TEXT", field: "origin", value: "أسيوط" },
        { type: "EDIT_SHARED_CONTRACTOR_RATE", value: "120" },
      ]);

      expect(afterSharedEdit.sharedDraft.origin).toBe("أسيوط");
      expect(afterSharedEdit.appliedShared?.origin).toBe("المنيا");
      expect(afterSharedEdit.tripDraft.origin).toBe("المنيا");
      expect(afterSharedEdit.tripDraft.contractorRateEgp).toBe("");
    });

    it.each([
      { field: "weightTonnes" as const, rawValue: "20." },
      { field: "weightTonnes" as const, rawValue: "0020.5000" },
      { field: "expenseEgp" as const, rawValue: "" },
      { field: "expenseEgp" as const, rawValue: "150.5" },
      { field: "notes" as const, rawValue: "  نص بمسافات  " },
    ])(
      "preserves partial or unformatted text '$rawValue' in $field verbatim without silent rounding or trimming",
      ({ field, rawValue }) => {
        const state = applyActions(createEntryState("2026-11-03"), [
          { type: "EDIT_TRIP_TEXT", field, value: rawValue },
        ]);

        expect(state.tripDraft[field]).toBe(rawValue);
      }
    );

    it("keeps direction null across all transitions that do not explicitly set it", () => {
      const state = applyActions(createEntryState("2026-11-03"), [
        { type: "EDIT_SHARED_COUNTERPARTY", counterpartyId: "contractor-7" },
        { type: "EDIT_SHARED_TEXT", field: "origin", value: "القاهرة" },
        { type: "EDIT_SHARED_CONTRACTOR_RATE", value: "85" },
        { type: "APPLY_SHARED" },
        { type: "START_NEW_TRIP" },
        { type: "EDIT_TRIP_VEHICLE", vehicleId: "veh-55" },
      ]);

      expect(state.sharedDraft.direction).toBeNull();
      expect(state.appliedShared?.direction).toBeNull();
      expect(state.tripDraft.direction).toBeNull();
    });

    it.each([
      { direction: "AHMED_SUPPLIES" as WorkDirection },
      { direction: "OTHER_SUPPLIES" as WorkDirection },
    ])(
      "copies explicit direction '$direction' accurately when applied and started",
      ({ direction }) => {
        const state = applyActions(createEntryState("2026-11-03"), [
          { type: "EDIT_SHARED_DIRECTION", direction },
          { type: "APPLY_SHARED" },
          { type: "START_NEW_TRIP" },
        ]);

        expect(state.sharedDraft.direction).toBe(direction);
        expect(state.appliedShared?.direction).toBe(direction);
        expect(state.tripDraft.direction).toBe(direction);
      }
    );
  });


  describe("6) deep immutability and JSON serialization", () => {
    it("does not mutate deeply frozen state objects across transitions or rejected actions", () => {
      const initial = createEntryState("2026-11-03");
      Object.freeze(initial);
      Object.freeze(initial.sharedDraft);
      Object.freeze(initial.tripDraft);

      const res1 = reduceEntry(initial, {
        type: "EDIT_SHARED_CONTRACTOR_RATE",
        value: "90",
      });
      expect(res1.ok).toBe(true);
      if (res1.ok) {
        Object.freeze(res1.state);
        Object.freeze(res1.state.sharedDraft);
        Object.freeze(res1.state.tripDraft);

        const res2 = reduceEntry(res1.state, { type: "APPLY_SHARED" });
        expect(res2.ok).toBe(true);
        if (res2.ok) {
          Object.freeze(res2.state);
          Object.freeze(res2.state.appliedShared);

          const rejected = reduceEntry(res2.state, {
            type: "EDIT_SHARED_VEHICLE_RATE",
            value: "75",
          });
          expect(rejected).toEqual({
            ok: false,
            error: { code: "VEHICLE_RATE_LINKED" },
          });
        }
      }
    });

    it("produces states and transition results that serialize cleanly with JSON.stringify", () => {
      const state = applyActions(createEntryState("2026-11-03"), [
        { type: "EDIT_SHARED_TEXT", field: "origin", value: "الإسكندرية" },
        { type: "APPLY_SHARED" },
        { type: "START_NEW_TRIP" },
      ]);

      const transition = reduceEntry(state, {
        type: "EDIT_TRIP_TEXT",
        field: "weightTonnes",
        value: "18.750",
      });

      const roundTrip = JSON.parse(JSON.stringify(transition));
      expect(roundTrip).toEqual(transition);
    });
  });
});
