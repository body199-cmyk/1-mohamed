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
  DemoVehicleCashOpening,
  DemoMasterAudit,
} from "./demo-types";
import {
  INITIAL_CONTRACTORS,
  INITIAL_VEHICLES,
  INITIAL_TRIPS,
} from "./demo-data";

import { normalizeMasterKey, validOpeningDate, validOpeningPiastres } from "../features/master-data/master-data-validation";

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
  const [cashOpenings, setCashOpenings] = useState<DemoVehicleCashOpening[]>([]);
  const [masterAudit, setMasterAudit] = useState<DemoMasterAudit[]>([]);
  const writeAudit = useCallback((
    target: DemoMasterAudit["target"], key: string, action: DemoMasterAudit["action"],
    reason: string, before: unknown, after: unknown
  ) => {
    setMasterAudit(prev => [{
      target, key, action, reason: reason.trim(),
      before: JSON.stringify(before), after: JSON.stringify(after),
      at: new Date().toISOString()
    }, ...prev]);
  }, []);


  const addContractor = useCallback(
    (name: string, openingDate: string, openingBalancePiastres: string): DemoContractor => {
      const newContractor: DemoContractor = {
        id: `K${contractorSequence++}`,
        name: name.trim(),
        openingDate,
        openingBalancePiastres,
        isArchived: false,
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
        isArchived: false,
      };
      setVehicles((prev) => [...prev, newVehicle]);
      return newVehicle;
    },
    []
  );


  const editContractor = useCallback((id: string, name: string, reason: string): boolean => {
    const current = contractors.find(c => c.id === id);
    const clean = name.trim();
    if (!current || current.isArchived || !clean || !reason.trim() ||
      contractors.some(c => c.id !== id && normalizeMasterKey(c.name) === normalizeMasterKey(clean))) return false;
    if (current.name === clean) return false;
    const next = { ...current, name: clean };
    setContractors(prev => prev.map(c => c.id === id ? next : c));
    writeAudit("contractor", id, "edit", reason, current, next);
    return true;
  }, [contractors, writeAudit]);

  const editVehicle = useCallback((id: string, plate: string, driver: string, reason: string): boolean => {
    const current = vehicles.find(v => v.id === id);
    const clean = plate.trim(), cleanedDriver = driver.trim();
    if (!current || current.isArchived || !clean || !reason.trim() ||
      vehicles.some(v => v.id !== id && normalizeMasterKey(v.plateNumber) === normalizeMasterKey(clean))) return false;
    if (current.plateNumber === clean && current.driverName === cleanedDriver) return false;
    const next = { ...current, plateNumber: clean, driverName: cleanedDriver };
    setVehicles(prev => prev.map(v => v.id === id ? next : v));
    writeAudit("vehicle", id, "edit", reason, current, next);
    return true;
  }, [vehicles, writeAudit]);

  const archiveContractor = useCallback((id: string, archived: boolean, reason: string): boolean => {
    const current = contractors.find(c => c.id === id);
    if (!current || current.isArchived === archived || !reason.trim()) return false;
    const next = { ...current, isArchived: archived };
    setContractors(prev => prev.map(c => c.id === id ? next : c));
    writeAudit("contractor", id, archived ? "archive" : "reactivate", reason, current, next);
    return true;
  }, [contractors, writeAudit]);

  const archiveVehicle = useCallback((id: string, archived: boolean, reason: string): boolean => {
    const current = vehicles.find(v => v.id === id);
    if (!current || current.isArchived === archived || !reason.trim()) return false;
    const next = { ...current, isArchived: archived };
    setVehicles(prev => prev.map(v => v.id === id ? next : v));
    writeAudit("vehicle", id, archived ? "archive" : "reactivate", reason, current, next);
    return true;
  }, [vehicles, writeAudit]);

  const saveCashOpening = useCallback((opening: DemoVehicleCashOpening, reason: string): boolean => {
    const contractor = contractors.find(c => c.id === opening.contractorId);
    const vehicle = vehicles.find(v => v.id === opening.vehicleId);
    if (!contractor || contractor.isArchived || !vehicle || vehicle.isArchived ||
      !reason.trim() || !validOpeningDate(opening.startDate) ||
      !validOpeningPiastres(opening.signedPiastres)) return false;
    const existing = cashOpenings.find(c => c.vehicleId === opening.vehicleId && c.contractorId === opening.contractorId);
    if (existing && existing.startDate === opening.startDate && existing.signedPiastres === opening.signedPiastres) return false;
    setCashOpenings(prev => [...prev.filter(c => c.vehicleId !== opening.vehicleId || c.contractorId !== opening.contractorId), opening]);
    writeAudit("vehicle-cash", opening.contractorId + "|" + opening.vehicleId, "cash-opening", reason, existing ?? null, opening);
    return true;
  }, [contractors, vehicles, cashOpenings, writeAudit]);

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
      cashOpenings,
      masterAudit,
      editContractor,
      editVehicle,
      archiveContractor,
      archiveVehicle,
      saveCashOpening,
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
      cashOpenings,
      masterAudit,
      editContractor,
      editVehicle,
      archiveContractor,
      archiveVehicle,
      saveCashOpening,
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
