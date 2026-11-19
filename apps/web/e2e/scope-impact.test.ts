import { describe, expect, it } from "vitest";
import { PORTABLE_BACKUP_TABLES, createPortableBackup } from "../src/lib/backup/export";
import { inspectCancellationImpact } from "../src/lib/backup/scope-impact";

const data = () => {
  const tables=Object.fromEntries(PORTABLE_BACKUP_TABLES.map(name=>[name,[] as Record<string,unknown>[]]));
  tables.trips=[
    {id:"T1",trip_date:"2026-11-18",vehicle_id:"V1",counterparty_contractor_id:"C1",responsible_contractor_id:"C1",is_cancelled:false},
    {id:"T2",trip_date:"2026-11-18",vehicle_id:"V2",counterparty_contractor_id:"C2",responsible_contractor_id:"C2",is_cancelled:true},
    {id:"T3",trip_date:"2026-11-19",vehicle_id:"V1",counterparty_contractor_id:"C2",responsible_contractor_id:"C1",is_cancelled:false},
  ];
  tables.payments=[
    {id:"P1",linked_trip_id:"T1",vehicle_id:"V1",responsible_contractor_id:"C1",payment_date:"2026-11-20",is_cancelled:false},
    {id:"P2",linked_trip_id:null,vehicle_id:"V2",responsible_contractor_id:"C2",payment_date:"2026-11-18",is_cancelled:false},
    {id:"P3",linked_trip_id:"T3",vehicle_id:"V1",responsible_contractor_id:"C1",payment_date:"2026-11-19",is_cancelled:true},
  ];
  tables.vehicles=[{id:"V1",plate_number:"١"},{id:"V2",plate_number:"٢"}];
  tables.contractors=[{id:"C1",name:"أحمد"},{id:"C2",name:"المقاول"}];
  return JSON.stringify(createPortableBackup(tables));
};

describe("scope impact preview does not cancel or recalculate ledger",()=>{
  it("counts day trips and cross-day descriptive linked cash transactions",async()=>{
    const result=await inspectCancellationImpact(data(),{kind:"day",id:"2026-11-18"});
    expect(result.tripCount).toBe(2);
    expect(result.activeTripCount).toBe(1);
    expect(result.alreadyCancelledTrips).toBe(1);
    expect(result.linkedPayments).toBe(1);
    expect(result.paymentsOnOtherDates).toBe(1);
    expect(result.activePaymentsInScope).toBe(2);
    expect(result.financialBalancesCalculated).toBe(false);
    expect(result.canDelete).toBe(false);
  });
  it("uses actual vehicle/counterparty relationships rather than name matching",async()=>{
    const truck=await inspectCancellationImpact(data(),{kind:"vehicle",id:"V1"});
    expect(truck.tripCount).toBe(2);
    expect(truck.activePaymentsInScope).toBe(1);
    const contractor=await inspectCancellationImpact(data(),{kind:"contractor",id:"C2"});
    expect(contractor.tripCount).toBe(2);
    expect(contractor.activePaymentsInScope).toBe(1);
  });
  it("rejects invalid days and absent scopes",async()=>{
    await expect(inspectCancellationImpact(data(),{kind:"day",id:"2026-02-30"})).rejects.toThrow(/التاريخ/);
    await expect(inspectCancellationImpact(data(),{kind:"vehicle",id:""})).rejects.toThrow(/نطاق/);
  });
  it("global preview excludes auth/audit backup metadata and never mutates",async()=>{
    const result=await inspectCancellationImpact(data(),{kind:"all"});
    expect(result.tripCount).toBe(3);
    expect(result.activePaymentsInScope).toBe(2);
    expect(result.totalBusinessRecords).toBe(3+3+2+2);
    expect(result.canDelete).toBe(false);
    expect(result.canRestore).toBe(false);
  });
});
