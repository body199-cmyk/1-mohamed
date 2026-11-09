import { describe, expect, it } from "vitest";
import { buildVehicleCashReport } from "../src/features/reports/vehicle-cash-report";
import { buildDailyWorkReport } from "../src/features/reports/daily-work-report";
import { toVehicleCashOperationalReport } from "../src/features/reports/report-export-documents";
import { buildCashLedger } from "../src/features/payments/cash-ledger";
import { DEMO_PRIMARY_RESPONSIBLE_ID } from "../src/features/payments/cash-ledger";
import type { DemoTripRecord, DemoPayment, DemoVehicleCashOpening } from "../src/demo/demo-types";

const work = (id: string, date: string, direction: DemoTripRecord["direction"],
  amountEgp: string, vehicleId = "V1"): DemoTripRecord => ({
  id, workDate: date, counterpartyId:"K1", vehicleId, direction,
  origin:"محجر",destination:"موقع",
  weightTonnes:"1.000",contractorRateEgp:amountEgp,vehicleRateEgp:amountEgp,
  expenseEgp:"0.00", contractorTotalPiastres:(BigInt(amountEgp)*100n).toString(),
  vehicleTotalPiastres:(BigInt(amountEgp)*100n).toString(),
  receiptNumber:id+"-0007",notes:"",createdAt:date+"T10:00:00.000Z"
});
const payment = (id:string, date:string, amountPiastres:string,
  responsibleId=DEMO_PRIMARY_RESPONSIBLE_ID): DemoPayment=>({
  id,vehicleId:"V1",responsibleContractorId:responsibleId,paymentDate:date,
  amountPiastres,linkedTripId:"",receiptNumber:"000"+id,notes:"",
  createdAt:date+"T13:00:00.000Z",version:1,isCancelled:false,cancelReason:""
});
const opening:DemoVehicleCashOpening = {
  vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
  startDate:"2026-11-01",signedPiastres:"5000",
};
const source = {
  trips:[
    work("TR-1","2026-11-02","AHMED_SUPPLIES","280"),
    work("TR-2","2026-11-04","AHMED_SUPPLIES","100"),
    work("TR-3","2026-11-03","OTHER_SUPPLIES","600"),
  ],
  payments:[
    payment("P-1","2026-11-03","10000"),
    payment("P-FUTURE","2026-11-10","8000"),
    payment("P-CANCELLED","2026-11-04","9000"),
  ].map(p => p.id === "P-CANCELLED" ? {...p,isCancelled:true,cancelReason:"خطأ"} : p),
  cashOpenings:[opening],
};

const report = (from:string,to:string,responsibleId=DEMO_PRIMARY_RESPONSIBLE_ID) =>
  buildVehicleCashReport(source,{vehicleId:"V1",responsibleContractorId:responsibleId,from,to});

describe("T08.4/5 vehicle cash statement is a strict projection of cash-ledger",()=>{
  it("computes earlier balance, exact period work, payments and ending without repeating opening",()=>{
    const r=report("2026-11-03","2026-11-05");
    expect(r.ok).toBe(true);
    if(!r.ok)return;
    expect(r.value.openingPiastres).toBe("33000");
    expect(r.value.workPiastres).toBe("10000");
    expect(r.value.paidPiastres).toBe("10000");
    expect(r.value.closingPiastres).toBe("33000");
    expect(r.value.tripCount).toBe(1);
    expect(r.value.paymentCount).toBe(1);
    expect(r.value.rows.map(x=>x.id)).toEqual(["P-1","TR-2"]);
    expect(r.value.rows[0]?.balancePiastres).toBe("23000");
    expect(r.value.rows[1]?.balancePiastres).toBe("33000");
  });
  it("historical report excludes later payments without failing or changing historical balance",()=>{
    const r=report("2026-11-01","2026-11-05");
    expect(r.ok).toBe(true);
    if(!r.ok)return;
    expect(r.value.rows.map(x=>x.id)).not.toContain("P-FUTURE");
    expect(r.value.closingPiastres).toBe("33000");
  });
  it("separates another contractor's work and cash from primary Ahmed",()=>{
    const r=report("2026-11-01","2026-11-05","K1");
    expect(r.ok).toBe(true);
    if(!r.ok)return;
    expect(r.value.workPiastres).toBe("60000");
    expect(r.value.paidPiastres).toBe("0");
    expect(r.value.closingPiastres).toBe("60000");
    expect(r.value.rows.map(x=>x.id)).toEqual(["TR-3"]);
  });
  it("keeps previous balance across an empty interval and includes receipts as text",()=>{
    const r=report("2026-11-05","2026-11-05");
    expect(r.ok && r.value.rows.length===0 && r.value.openingPiastres==="33000"
      && r.value.closingPiastres==="33000").toBe(true);
    const history=report("2026-11-02","2026-11-02");
    expect(history.ok && history.value.rows[0]?.label.includes("TR-1-0007")).toBe(true);
  });

  it("ignores a corrupt future trip in a historical report but fails closed once it enters the report period",()=>{
    const future={...work("TR-FUTURE","2026-11-09","AHMED_SUPPLIES","1000"),
      vehicleRateEgp:"not-a-number",vehicleTotalPiastres:"1"};
    const withFuture={...source,trips:[...source.trips,future]};
    const historical=buildVehicleCashReport(withFuture,{
      vehicleId:"V1",responsibleContractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      from:"2026-11-01",to:"2026-11-05"
    });
    expect(historical.ok).toBe(true);
    if(historical.ok) expect(historical.value.closingPiastres).toBe("33000");
    const inclusive=buildVehicleCashReport(withFuture,{
      vehicleId:"V1",responsibleContractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      from:"2026-11-01",to:"2026-11-09"
    });
    expect(inclusive.ok).toBe(false);
  });
  it("fails closed when a trip date itself is invalid, even for a historical cutoff",()=>{
    const invalidDate={...work("TR-BAD-DATE","2026-11-09","AHMED_SUPPLIES","1000"),
      workDate:"not-a-date"};
    const result=buildVehicleCashReport({...source,trips:[...source.trips,invalidDate]},{
      vehicleId:"V1",responsibleContractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      from:"2026-11-01",to:"2026-11-05"
    });
    expect(result.ok).toBe(false);
  });
  it("reconciles daily-work vehicle totals to the sum of separate cash-account work movements",()=>{
    const otherSameDay=work("TR-OTHER-SAME-DAY","2026-11-02","OTHER_SUPPLIES","50");
    const trips=[...source.trips,otherSameDay];
    const daily=buildDailyWorkReport(trips,{workDate:"2026-11-02",contractorId:"",vehicleId:"V1"});
    expect(daily.ok).toBe(true);
    if(!daily.ok)return;
    const primary=buildVehicleCashReport({...source,trips},{
      vehicleId:"V1",responsibleContractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      from:"2026-11-02",to:"2026-11-02"
    });
    const contractor=buildVehicleCashReport({...source,trips},{
      vehicleId:"V1",responsibleContractorId:"K1",
      from:"2026-11-02",to:"2026-11-02"
    });
    expect(primary.ok && contractor.ok).toBe(true);
    if(!primary.ok || !contractor.ok)return;
    const sumOfCashAccounts=BigInt(primary.value.workPiastres)+BigInt(contractor.value.workPiastres);
    expect(daily.totals.vehicleTotalPiastres).toBe("33000");
    expect(sumOfCashAccounts.toString()).toBe(daily.totals.vehicleTotalPiastres);
    expect(primary.value.openingPiastres).toBe("5000");
    expect(primary.value.closingPiastres).toBe("33000");
    expect(contractor.value.openingPiastres).toBe("0");
    expect(contractor.value.closingPiastres).toBe("5000");
  });


  it("maps reconciled cash totals and signed movement values unchanged into the export document",()=>{
    const r=report("2026-11-03","2026-11-05");
    expect(r.ok).toBe(true);
    if(!r.ok)return;
    const document=toVehicleCashOperationalReport(r.value,{
      vehicleLabel:"V1",
      responsibleName:"أحمد",
      tripLookup:new Map(source.trips.map(t=>[t.id,t])),
    });
    expect(document.summarySections[0]!.metrics.slice(0,4).map(metric=>metric.value)).toEqual([
      "330.00 ج.م","100.00 ج.م","100.00 ج.م","330.00 ج.م"
    ]);
    expect(document.rows.map(row=>row[5])).toEqual(["-100.00 ج.م","100.00 ج.م"]);
    expect(document.rows.map(row=>row[6])).toEqual(["230.00 ج.م","330.00 ج.م"]);
  });

  it("FIN-07 preserves numeric-sized aggregate balances through cash reports and exports",()=>{
    const max="9223372036854775807";
    const oversizedAggregate={
      trips:[work("T-LARGE","2026-11-03","AHMED_SUPPLIES","1")],
      payments:[],
      cashOpenings:[{...opening,signedPiastres:max}]
    };
    const r=buildVehicleCashReport(oversizedAggregate,{
      vehicleId:"V1",responsibleContractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      from:"2026-11-01",to:"2026-11-05"
    });
    expect(r.ok).toBe(true);
    if(!r.ok)return;
    expect(r.value.openingPiastres).toBe(max);
    expect(r.value.workPiastres).toBe("100");
    expect(r.value.closingPiastres).toBe("9223372036854775907");
    expect(r.value.rows[0]?.balancePiastres).toBe(r.value.closingPiastres);
    const document=toVehicleCashOperationalReport(r.value,{
      vehicleLabel:"V1",responsibleName:"أحمد",
      tripLookup:new Map(oversizedAggregate.trips.map(t=>[t.id,t]))
    });
    expect(document.summarySections[0]!.metrics.map(metric=>metric.value))
      .toContain("92233720368547759.07 ج.م");
    expect(document.rows[0]?.[6]).toBe("92233720368547759.07 ج.م");
  });
  it("rejects reversed, malformed and pre-opening periods",()=>{
    expect(report("2026-11-06","2026-11-05").ok).toBe(false);
    expect(report("2026-02-30","2026-11-05").ok).toBe(false);
    expect(report("2026-10-31","2026-11-05").ok).toBe(false);
  });
  it("rejects inconsistent trip snapshots rather than quietly publishing a wrong report",()=>{
    const corrupt={...source,trips:[{...source.trips[0]!,vehicleTotalPiastres:"1"}]};
    const r=buildVehicleCashReport(corrupt,{
      vehicleId:"V1",responsibleContractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      from:"2026-11-01",to:"2026-11-05"
    });
    expect(r.ok).toBe(false);
  });
});
