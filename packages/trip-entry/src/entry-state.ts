import type {
  EntryAction,
  EntryState,
  EntryTransitionResult,
  SharedFields,
  TripDraft,
} from "./entry-types";

function createBlankSharedFields(workDate: string): SharedFields {
  return {
    workDate,
    origin: "",
    destination: "",
    counterpartyId: null,
    direction: null,
    sameRate: true,
    contractorRateEgp: "",
    vehicleRateEgp: "",
    expenseEgp: "",
  };
}

function createTripDraftFromShared(shared: SharedFields): TripDraft {
  return {
    workDate: shared.workDate,
    origin: shared.origin,
    destination: shared.destination,
    counterpartyId: shared.counterpartyId,
    direction: shared.direction,
    sameRate: shared.sameRate,
    contractorRateEgp: shared.contractorRateEgp,
    vehicleRateEgp: shared.vehicleRateEgp,
    expenseEgp: shared.expenseEgp,
    vehicleId: null,
    weightTonnes: "",
    receiptNumber: "",
    notes: "",
  };
}

function cloneSharedFields(shared: SharedFields): SharedFields {
  return {
    workDate: shared.workDate,
    origin: shared.origin,
    destination: shared.destination,
    counterpartyId: shared.counterpartyId,
    direction: shared.direction,
    sameRate: shared.sameRate,
    contractorRateEgp: shared.contractorRateEgp,
    vehicleRateEgp: shared.vehicleRateEgp,
    expenseEgp: shared.expenseEgp,
  };
}

export function createEntryState(sessionDate: string): EntryState {
  const sharedDraft = createBlankSharedFields(sessionDate);
  return {
    sessionDate,
    sharedDraft,
    appliedShared: null,
    tripDraft: createTripDraftFromShared(sharedDraft),
  };
}

export function reduceEntry(
  state: EntryState,
  action: EntryAction
): EntryTransitionResult {
  switch (action.type) {
    case "EDIT_SHARED_TEXT": {
      return {
        ok: true,
        state: {
          ...state,
          sharedDraft: {
            ...state.sharedDraft,
            [action.field]: action.value,
          },
        },
      };
    }

    case "EDIT_SHARED_COUNTERPARTY": {
      return {
        ok: true,
        state: {
          ...state,
          sharedDraft: {
            ...state.sharedDraft,
            counterpartyId: action.counterpartyId,
          },
        },
      };
    }

    case "EDIT_SHARED_DIRECTION": {
      return {
        ok: true,
        state: {
          ...state,
          sharedDraft: {
            ...state.sharedDraft,
            direction: action.direction,
          },
        },
      };
    }

    case "EDIT_SHARED_CONTRACTOR_RATE": {
      const nextVehicleRate = state.sharedDraft.sameRate
        ? action.value
        : state.sharedDraft.vehicleRateEgp;
      return {
        ok: true,
        state: {
          ...state,
          sharedDraft: {
            ...state.sharedDraft,
            contractorRateEgp: action.value,
            vehicleRateEgp: nextVehicleRate,
          },
        },
      };
    }

    case "EDIT_SHARED_VEHICLE_RATE": {
      if (state.sharedDraft.sameRate) {
        return {
          ok: false,
          error: { code: "VEHICLE_RATE_LINKED" },
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          sharedDraft: {
            ...state.sharedDraft,
            vehicleRateEgp: action.value,
          },
        },
      };
    }

    case "SET_SHARED_SAME_RATE": {
      const nextVehicleRate = action.sameRate
        ? state.sharedDraft.contractorRateEgp
        : state.sharedDraft.vehicleRateEgp;
      return {
        ok: true,
        state: {
          ...state,
          sharedDraft: {
            ...state.sharedDraft,
            sameRate: action.sameRate,
            vehicleRateEgp: nextVehicleRate,
          },
        },
      };
    }

    case "EDIT_TRIP_TEXT": {
      return {
        ok: true,
        state: {
          ...state,
          tripDraft: {
            ...state.tripDraft,
            [action.field]: action.value,
          },
        },
      };
    }

    case "EDIT_TRIP_COUNTERPARTY": {
      return {
        ok: true,
        state: {
          ...state,
          tripDraft: {
            ...state.tripDraft,
            counterpartyId: action.counterpartyId,
          },
        },
      };
    }

    case "EDIT_TRIP_DIRECTION": {
      return {
        ok: true,
        state: {
          ...state,
          tripDraft: {
            ...state.tripDraft,
            direction: action.direction,
          },
        },
      };
    }

    case "EDIT_TRIP_VEHICLE": {
      return {
        ok: true,
        state: {
          ...state,
          tripDraft: {
            ...state.tripDraft,
            vehicleId: action.vehicleId,
          },
        },
      };
    }

    case "EDIT_TRIP_CONTRACTOR_RATE": {
      const nextVehicleRate = state.tripDraft.sameRate
        ? action.value
        : state.tripDraft.vehicleRateEgp;
      return {
        ok: true,
        state: {
          ...state,
          tripDraft: {
            ...state.tripDraft,
            contractorRateEgp: action.value,
            vehicleRateEgp: nextVehicleRate,
          },
        },
      };
    }

    case "EDIT_TRIP_VEHICLE_RATE": {
      if (state.tripDraft.sameRate) {
        return {
          ok: false,
          error: { code: "VEHICLE_RATE_LINKED" },
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          tripDraft: {
            ...state.tripDraft,
            vehicleRateEgp: action.value,
          },
        },
      };
    }

    case "SET_TRIP_SAME_RATE": {
      const nextVehicleRate = action.sameRate
        ? state.tripDraft.contractorRateEgp
        : state.tripDraft.vehicleRateEgp;
      return {
        ok: true,
        state: {
          ...state,
          tripDraft: {
            ...state.tripDraft,
            sameRate: action.sameRate,
            vehicleRateEgp: nextVehicleRate,
          },
        },
      };
    }

    case "APPLY_SHARED": {
      return {
        ok: true,
        state: {
          ...state,
          appliedShared: cloneSharedFields(state.sharedDraft),
        },
      };
    }

    case "DISABLE_SHARED": {
      return {
        ok: true,
        state: {
          ...state,
          appliedShared: null,
        },
      };
    }

    case "START_NEW_TRIP": {
      const baseShared =
        state.appliedShared !== null
          ? state.appliedShared
          : createBlankSharedFields(state.sessionDate);
      return {
        ok: true,
        state: {
          ...state,
          tripDraft: createTripDraftFromShared(baseShared),
        },
      };
    }

    case "START_NEW_SESSION": {
      return {
        ok: true,
        state: {
          sessionDate: action.sessionDate,
          sharedDraft: createBlankSharedFields(action.sessionDate),
          appliedShared: null,
          tripDraft: state.tripDraft,
        },
      };
    }
  }
}