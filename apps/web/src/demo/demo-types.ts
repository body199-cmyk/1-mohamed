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
}

export interface DemoVehicle {
  readonly id: string;
  readonly plateNumber: string;
  readonly driverName: string;
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
  readonly addContractor: (name: string, openingDate: string, openingBalancePiastres: string) => DemoContractor;
  readonly addVehicle: (plateNumber: string, driverName: string) => DemoVehicle;
  readonly addTrip: (trip: Omit<DemoTripRecord, "id" | "createdAt">) => DemoTripRecord;
  readonly getStatementForContractor: (
    contractorId: string,
    from: string,
    to: string
  ) => ContractorStatementResult | null;
  readonly getContractorById: (id: string) => DemoContractor | undefined;
  readonly getVehicleById: (id: string) => DemoVehicle | undefined;
}
