import { describe, expect, it } from "vitest";
import { createEntryState, reduceEntry } from "../src/entry-state";
import type { EntryAction, EntryState } from "../src/entry-types";
import { applyActions } from "./helpers";

describe("ENTRY-01: rate linking (sameRate) in sharedDraft and tripDraft", () => {
  describe("3) rate linking (sameRate) in both sharedDraft and tripDraft", () => {
    it.each([
      {
        target: "sharedDraft" as const,
        editContractor: (value: string): EntryAction => ({
          type: "EDIT_SHARED_CONTRACTOR_RATE",
          value,
        }),
        editVehicle: (value: string): EntryAction => ({
          type: "EDIT_SHARED_VEHICLE_RATE",
          value,
        }),
        setSameRate: (sameRate: boolean): EntryAction => ({
          type: "SET_SHARED_SAME_RATE",
          sameRate,
        }),
        selectDraft: (s: EntryState) => s.sharedDraft,
      },
      {
        target: "tripDraft" as const,
        editContractor: (value: string): EntryAction => ({
          type: "EDIT_TRIP_CONTRACTOR_RATE",
          value,
        }),
        editVehicle: (value: string): EntryAction => ({
          type: "EDIT_TRIP_VEHICLE_RATE",
          value,
        }),
        setSameRate: (sameRate: boolean): EntryAction => ({
          type: "SET_TRIP_SAME_RATE",
          sameRate,
        }),
        selectDraft: (s: EntryState) => s.tripDraft,
      },
    ])(
      "enforces rate linking, unlinking, relinking, and error rejection on $target",
      ({ editContractor, editVehicle, setSameRate, selectDraft }) => {
        // 1. Editing contractor rate while linked updates vehicle rate
        const s1 = applyActions(createEntryState("2026-11-03"), [
          editContractor("95.50"),
        ]);
        expect(selectDraft(s1).sameRate).toBe(true);
        expect(selectDraft(s1).contractorRateEgp).toBe("95.50");
        expect(selectDraft(s1).vehicleRateEgp).toBe("95.50");

        // 2. Editing vehicle rate directly while linked returns error and leaves state unchanged
        const blocked = reduceEntry(s1, editVehicle("80.00"));
        expect(blocked).toEqual({
          ok: false,
          error: { code: "VEHICLE_RATE_LINKED" },
        });
        expect(selectDraft(s1).vehicleRateEgp).toBe("95.50");

        // 3. Unlinking keeps both current rates intact and allows independent edits
        const s2 = applyActions(s1, [
          setSameRate(false),
          editVehicle("85.00"),
          editContractor("100.00"),
        ]);
        expect(selectDraft(s2).sameRate).toBe(false);
        expect(selectDraft(s2).contractorRateEgp).toBe("100.00");
        expect(selectDraft(s2).vehicleRateEgp).toBe("85.00");

        // 4. Setting vehicleRate equal to contractorRate while unlinked keeps sameRate false
        const sEqualUnlinked = applyActions(s2, [editVehicle("100.00")]);
        expect(selectDraft(sEqualUnlinked).contractorRateEgp).toBe("100.00");
        expect(selectDraft(sEqualUnlinked).vehicleRateEgp).toBe("100.00");
        expect(selectDraft(sEqualUnlinked).sameRate).toBe(false);

        // 5. Re-linking copies contractorRateEgp into vehicleRateEgp immediately
        const sRelinked = applyActions(s2, [setSameRate(true)]);
        expect(selectDraft(sRelinked).sameRate).toBe(true);
        expect(selectDraft(sRelinked).contractorRateEgp).toBe("100.00");
        expect(selectDraft(sRelinked).vehicleRateEgp).toBe("100.00");
      }
    );
  });

});
