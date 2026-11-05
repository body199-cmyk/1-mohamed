import type { WorkDirection } from "@ledger/trip-entry";
import type {
  ContractorMovementInput,
  ContractorStatementResult,
} from "@ledger/contractor-statements";

export interface DemoContractor {
  readonly id: string;
  readonly name: string;
  readonly openingDate: string;
  readonly openingBalancePiastres: string;
  readonly isArchived: boolean;
}

export interface DemoVehicle {
  readonly id: string;
  readonly plateNumber: string;
  readonly driverName: string;
  readonly isArchived: boolean;
}

/** Cash opening is keyed by (responsible contractor, vehicle), never work balance. */
export interface DemoVehicleCashOpening {
  readonly contractorId: string;
  readonly vehicleId: string;
  readonly startDate: string;
  readonly signedPiastres: string;
}
export interface DemoMasterAudit {
  readonly target: "contractor" | "vehicle" | "vehicle-cash";
  readonly key: string;
  readonly action: "edit" | "archive" | "reactivate" | "cash-opening";
  readonly reason: string;
  readonly before: string;
  readonly after: string;
  readonly at: string;
}

export interface DemoTripRecord {
  readonly id: string;
  readonly workDate: string;
  readonly counterpartyId: string;
  readonly vehicleId: string;
  readonly direction: WorkDirection;
  readonly origin: string;
  readonly destination: string;
  readonly weightTonnes: string;
  readonly contractorRateEgp: string;
  readonly vehicleRateEgp: string;
  readonly expenseEgp: string;
  readonly contractorTotalPiastres: string;
  readonly vehicleTotalPiastres: string;
  readonly receiptNumber: string;
  readonly notes: string;
  readonly createdAt: string;
}

export interface DemoStoreContextType {
  readonly contractors: readonly DemoContractor[];
  readonly vehicles: readonly DemoVehicle[];
  readonly trips: readonly DemoTripRecord[];
  readonly cashOpenings: readonly DemoVehicleCashOpening[];
  readonly masterAudit: readonly DemoMasterAudit[];
  readonly addContractor: (name: string, openingDate: string, openingBalancePiastres: string) => DemoContractor;
  readonly addVehicle: (plateNumber: string, driverName: string) => DemoVehicle;
  readonly editContractor: (id: string, name: string, reason: string) => boolean;
  readonly editVehicle: (id: string, plate: string, driver: string, reason: string) => boolean;
  readonly archiveContractor: (id: string, archived: boolean, reason: string) => boolean;
  readonly archiveVehicle: (id: string, archived: boolean, reason: string) => boolean;
  readonly saveCashOpening: (opening: DemoVehicleCashOpening, reason: string) => boolean;
  readonly addTrip: (trip: Omit<DemoTripRecord, "id" | "createdAt">) => DemoTripRecord;
  readonly getStatementForContractor: (
    contractorId: string,
    from: string,
    to: string
  ) => ContractorStatementResult | null;
  readonly getContractorById: (id: string) => DemoContractor | undefined;
  readonly getVehicleById: (id: string) => DemoVehicle | undefined;
}
