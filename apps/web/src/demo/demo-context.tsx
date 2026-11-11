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
  DemoPayment,
  DemoPaymentAudit,
  DemoPaymentResult,
} from "./demo-types";
import {
  INITIAL_CONTRACTORS,
  INITIAL_VEHICLES,
  INITIAL_TRIPS,
} from "./demo-data";

import { normalizeMasterKey, validOpeningDate, validOpeningPiastres } from "../features/master-data/master-data-validation";
import { buildCashLedger, validateDemoPayment, cairoBusinessDate, cashResponsibleForTrip, DEMO_PRIMARY_RESPONSIBLE_ID, type PaymentDraft } from "../features/payments/cash-ledger";
import { applyDemoPaymentEdit } from "../features/payments/demo-payment-operation";
import { writeDemoTrip } from "../features/trips/trip-cash-opening-validation";

const DemoStoreContext = createContext<DemoStoreContextType | null>(null);

let tripSequence = 1;
let vehicleSequence = 4;
let contractorSequence = 4;
let paymentSequence = 1;

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
  const [payments, setPayments] = useState<DemoPayment[]>([]);
  const [paymentAudit, setPaymentAudit] = useState<DemoPaymentAudit[]>([]);
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
    if ((opening.contractorId !== DEMO_PRIMARY_RESPONSIBLE_ID && (!contractor || contractor.isArchived)) || !vehicle || vehicle.isArchived ||
      !reason.trim() || !validOpeningDate(opening.startDate) ||
      !validOpeningPiastres(opening.signedPiastres) ||
      trips.some(t => t.vehicleId === opening.vehicleId &&
        cashResponsibleForTrip(t) === opening.contractorId && t.workDate < opening.startDate)) return false;
    const existing = cashOpenings.find(c => c.vehicleId === opening.vehicleId && c.contractorId === opening.contractorId);
    if (existing && existing.startDate === opening.startDate && existing.signedPiastres === opening.signedPiastres) return false;
    const tentative = [...cashOpenings.filter(c => c.vehicleId !== opening.vehicleId || c.contractorId !== opening.contractorId), opening];
    // Do not allow demo opening edits that silently invalidate earlier payment
    // timelines; D04 historical migration remains a separate production task.
    if (payments.some(p => !p.isCancelled && p.vehicleId === opening.vehicleId &&
        p.responsibleContractorId === opening.contractorId)) {
      const ledger = buildCashLedger({ trips, payments, cashOpenings: tentative },
        opening.vehicleId, opening.contractorId, cairoBusinessDate());
      if (!ledger.ok || ledger.value.rows.some(r => r.type === "PAYMENT" &&
          BigInt(r.balancePiastres) < 0n)) return false;
    }
    setCashOpenings(tentative);
    writeAudit("vehicle-cash", opening.contractorId + "|" + opening.vehicleId, "cash-opening", reason, existing ?? null, opening);
    return true;
  }, [contractors, vehicles, cashOpenings, payments, trips, writeAudit]);


  const addPayment = useCallback((draft: PaymentDraft): DemoPaymentResult => {
    const check = validateDemoPayment({ trips, payments, cashOpenings, vehicles, contractors },
      draft, cairoBusinessDate());
    if (!check.ok) return check;
    const created: DemoPayment = {
      id: "P-DEMO-" + paymentSequence++,
      vehicleId: draft.vehicleId, responsibleContractorId: draft.responsibleContractorId,
      paymentDate: draft.paymentDate, amountPiastres: check.value,
      linkedTripId: draft.linkedTripId, receiptNumber: draft.receiptNumber.trim(),
      notes: draft.notes.trim(), createdAt: new Date().toISOString(),
      version: 1, isCancelled: false, cancelReason: "",
    };
    setPayments(prev => [...prev, created]);
    setPaymentAudit(prev => [{ id:created.id, action:"create", reason:"",
      before:"null", after:JSON.stringify(created), at:new Date().toISOString() }, ...prev]);
    return { ok:true,payment:created };
  }, [trips,payments,cashOpenings,vehicles,contractors]);

  const editPayment = useCallback((
    id: string, expectedVersion: number, reason: string, draft: PaymentDraft
  ): DemoPaymentResult => {
    const transition = applyDemoPaymentEdit({
      trips, payments, paymentAudit, cashOpenings, vehicles, contractors
    }, id, expectedVersion, reason, draft, cairoBusinessDate(), new Date().toISOString());
    if (!transition.ok) return transition;
    setPayments([...transition.payments]);
    setPaymentAudit([...transition.audit]);
    return {ok:true,payment:transition.payment};
  },[trips,payments,paymentAudit,cashOpenings,vehicles,contractors]);

  const cancelPayment = useCallback((id: string, expectedVersion: number, reason: string): DemoPaymentResult => {
    const previous = payments.find(p => p.id === id);
    if (!previous || previous.isCancelled || previous.version !== expectedVersion ||
      !reason.trim()) return { ok:false,error:"الدفعة غير موجودة أو اتغير إصدارها، أو سبب الإلغاء غير مكتوب." };
    const updated: DemoPayment = { ...previous, isCancelled:true,
      cancelReason:reason.trim(),version:previous.version+1 };
    setPayments(prev => prev.map(p => p.id === id ? updated : p));
    setPaymentAudit(prev => [{ id,action:"cancel",reason:reason.trim(),
      before:JSON.stringify(previous),after:JSON.stringify(updated),at:new Date().toISOString() }, ...prev]);
    return { ok:true,payment:updated };
  },[payments]);

  const addTrip = useCallback(
    (tripData: Omit<DemoTripRecord, "id" | "createdAt">): DemoTripRecord =>
      writeDemoTrip(tripData, cashOpenings,
        () => `TRIP-DEMO-${tripSequence++}-${Date.now().toString().slice(-4)}`,
        (newTrip) => setTrips((prev) => [newTrip, ...prev])),
    [cashOpenings]
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
      payments,
      paymentAudit,
      addPayment,
      editPayment,
      cancelPayment,
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
      payments,
      paymentAudit,
      addPayment,
      editPayment,
      cancelPayment,
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
