export type WorkDirection = "AHMED_SUPPLIES" | "OTHER_SUPPLIES";

export interface SharedFields {
  readonly workDate: string;
  readonly origin: string;
  readonly destination: string;
  readonly counterpartyId: string | null;
  readonly direction: WorkDirection | null;
  readonly sameRate: boolean;
  readonly contractorRateEgp: string;
  readonly vehicleRateEgp: string;
  readonly expenseEgp: string;
}

export interface TripDraft extends SharedFields {
  readonly vehicleId: string | null;
  readonly weightTonnes: string;
  readonly receiptNumber: string;
  readonly notes: string;
}

export interface EntryState {
  readonly sessionDate: string;
  readonly sharedDraft: SharedFields;
  readonly appliedShared: SharedFields | null;
  readonly tripDraft: TripDraft;
}

export type SharedTextField = "workDate" | "origin" | "destination" | "expenseEgp";

export type TripOnlyTextField = "weightTonnes" | "receiptNumber" | "notes";

export type TripTextField = SharedTextField | TripOnlyTextField;

export type EntryAction =
  | {
      readonly type: "EDIT_SHARED_TEXT";
      readonly field: SharedTextField;
      readonly value: string;
    }
  | {
      readonly type: "EDIT_SHARED_COUNTERPARTY";
      readonly counterpartyId: string | null;
    }
  | {
      readonly type: "EDIT_SHARED_DIRECTION";
      readonly direction: WorkDirection | null;
    }
  | {
      readonly type: "EDIT_SHARED_CONTRACTOR_RATE";
      readonly value: string;
    }
  | {
      readonly type: "EDIT_SHARED_VEHICLE_RATE";
      readonly value: string;
    }
  | {
      readonly type: "SET_SHARED_SAME_RATE";
      readonly sameRate: boolean;
    }
  | {
      readonly type: "EDIT_TRIP_TEXT";
      readonly field: TripTextField;
      readonly value: string;
    }
  | {
      readonly type: "EDIT_TRIP_COUNTERPARTY";
      readonly counterpartyId: string | null;
    }
  | {
      readonly type: "EDIT_TRIP_DIRECTION";
      readonly direction: WorkDirection | null;
    }
  | {
      readonly type: "EDIT_TRIP_VEHICLE";
      readonly vehicleId: string | null;
    }
  | {
      readonly type: "EDIT_TRIP_CONTRACTOR_RATE";
      readonly value: string;
    }
  | {
      readonly type: "EDIT_TRIP_VEHICLE_RATE";
      readonly value: string;
    }
  | {
      readonly type: "SET_TRIP_SAME_RATE";
      readonly sameRate: boolean;
    }
  | {
      readonly type: "APPLY_SHARED";
    }
  | {
      readonly type: "DISABLE_SHARED";
    }
  | {
      readonly type: "START_NEW_TRIP";
    }
  | {
      readonly type: "START_NEW_SESSION";
      readonly sessionDate: string;
    };

export type EntryErrorCode = "VEHICLE_RATE_LINKED";

export interface EntryError {
  readonly code: EntryErrorCode;
}

export type EntryTransitionResult =
  | {
      readonly ok: true;
      readonly state: EntryState;
    }
  | {
      readonly ok: false;
      readonly error: EntryError;
    };