"use client";

import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import type {
  ContractorMovementInput,
  ContractorStatementResult,
} from "@ledger/contractor-statements";
import { buildContractorStatement } from "@ledger/contractor-statements";
import type {
  DemoContractor,
  DemoVehicle,
  DemoTripRecord,
  DemoStoreContextType,
} from "./demo-types";
import {
  INITIAL_CONTRACTORS,
  INITIAL_VEHICLES,
  INITIAL_TRIPS,
} from "./demo-data";

const DemoStoreContext = createContext<DemoStoreContextType | null>(null);

let tripSequence = 1;
let vehicleSequence = 4;
let contractorSequence = 4;

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const [contractors, setContractors] = useState<DemoContractor[]>(() => [
    ...INITIAL_CONTRACTORS,
  ]);
  const [vehicles, setVehicles] = useState<DemoVehicle[]>(() => [
    ...INITIAL_VEHICLES,
  ]);
  const [trips, setTrips] = useState<DemoTripRecord[]>(() => [
    ...INITIAL_TRIPS,
  ]);

  const addContractor = useCallback(
    (name: string, openingDate: string, openingBalancePiastres: string): DemoContractor => {
      const newContractor: DemoContractor = {
        id: `K${contractorSequence++}`,
        name: name.trim(),
        openingDate,
        openingBalancePiastres,
      };
      setContractors((prev) => [...prev, newContractor]);
      return newContractor;
    },
    []
  );

  const addVehicle = useCallback(
    (plateNumber: string, driverName: string): DemoVehicle => {
      const newVehicle: DemoVehicle = {
        id: `V${vehicleSequence++}`,
        plateNumber: plateNumber.trim(),
        driverName: driverName.trim(),
      };
      setVehicles((prev) => [...prev, newVehicle]);
      return newVehicle;
    },
    []
  );

  const addTrip = useCallback(
    (tripData: Omit<DemoTripRecord, "id" | "createdAt">): DemoTripRecord => {
      const newTrip: DemoTripRecord = {
        ...tripData,
        id: `TRIP-DEMO-${tripSequence++}-${Date.now().toString().slice(-4)}`,
        createdAt: new Date().toISOString(),
      };
      setTrips((prev) => [newTrip, ...prev]);
      return newTrip;
    },
    []
  );

  const getContractorById = useCallback(
    (id: string) => contractors.find((c) => c.id === id),
    [contractors]
  );

  const getVehicleById = useCallback(
    (id: string) => vehicles.find((v) => v.id === id),
    [vehicles]
  );

  const getStatementForContractor = useCallback(
    (
      contractorId: string,
      from: string,
      to: string
    ): ContractorStatementResult | null => {
      const contractor = contractors.find((c) => c.id === contractorId);
      if (!contractor) {
        return null;
      }

      // Filter all trips belonging to this contractor and map to movements
      const movements: ContractorMovementInput[] = trips
        .filter((t) => t.counterpartyId === contractorId)
        .map((t) => ({
          id: t.id,
          counterpartyId: t.counterpartyId,
          workDate: t.workDate,
          direction: t.direction,
          contractorTotalPiastres: t.contractorTotalPiastres,
        }));

      return buildContractorStatement({
        counterpartyId: contractor.id,
        opening: {
          startDate: contractor.openingDate,
          signedPiastres: contractor.openingBalancePiastres,
        },
        period: {
          from,
          to,
        },
        movements,
      });
    },
    [contractors, trips]
  );

  const contextValue = useMemo<DemoStoreContextType>(
    () => ({
      contractors,
      vehicles,
      trips,
      addContractor,
      addVehicle,
      addTrip,
      getStatementForContractor,
      getContractorById,
      getVehicleById,
    }),
    [
      contractors,
      vehicles,
      trips,
      addContractor,
      addVehicle,
      addTrip,
      getStatementForContractor,
      getContractorById,
      getVehicleById,
    ]
  );

  return (
    <DemoStoreContext.Provider value={contextValue}>
      {children}
    </DemoStoreContext.Provider>
  );
}

export function useDemoStore(): DemoStoreContextType {
  const context = useContext(DemoStoreContext);
  if (!context) {
    throw new Error("useDemoStore must be used within a DemoStoreProvider");
  }
  return context;
}
