import { describe, expect, it } from "vitest";
import type { DemoVehicle, DemoContractor, DemoPayment, DemoTripRecord } from "../src/demo/demo-types";
import {
  DEMO_PRIMARY_RESPONSIBLE_ID, parsePaymentEgp,
  validateDemoPayment, buildCashLedger, cashResponsibleForTrip,
} from "../src/features/payments/cash-ledger";

const vehicle: DemoVehicle = { id:"V1",plateNumber:"أ ب ج",driverName:"سائق",isArchived:false };
const vehicleB: DemoVehicle = { id:"V2",plateNumber:"ب",driverName:"سائق",isArchived:false };
const contractor: DemoContractor = { id:"K1",name:"مقاول",isArchived:false,
  openingDate:"2026-11-01",openingBalancePiastres:"0" };
const trip = (id:string,date:string,vehicleId:string,dir:"AHMED_SUPPLIES"|"OTHER_SUPPLIES",
  amount:string): DemoTripRecord => ({
    id,workDate:date,counterpartyId:"K1",vehicleId,direction:dir,
    origin:"أ",destination:"ب",weightTonnes:"1",contractorRateEgp:amount,
    vehicleRateEgp:amount,expenseEgp:"0",contractorTotalPiastres:(BigInt(amount)*100n).toString(),
    vehicleTotalPiastres:(BigInt(amount)*100n).toString(),receiptNumber:"0007",notes:"",
    createdAt:date+"T10:00:00.000Z"
  });
const payment=(id:string,date:string,amount:string,vehicleId="V1",responsibleId=DEMO_PRIMARY_RESPONSIBLE_ID):DemoPayment=>({
  id,vehicleId,responsibleContractorId:responsibleId,paymentDate:date,
  amountPiastres:amount,linkedTripId:"",receiptNumber:"",notes:"",
  createdAt:date+"T11:00:00.000Z",version:1,isCancelled:false,cancelReason:""
});
const draft=(amountEgp:string,date="2026-11-03")=>({
  vehicleId:"V1",responsibleContractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
  paymentDate:date,amountEgp,linkedTripId:"",receiptNumber:"",notes:""
});
const base={vehicles:[vehicle,vehicleB],contractors:[contractor],cashOpenings:[]};
const today="2026-11-05";

describe("T08.3 cash ledger demo follows T08.2/D15/D16",()=>{
  it("parses Egyptian pounds and Arabic digits exactly, rejects fractions, zero and overflow",()=>{
    expect(parsePaymentEgp("١٢٫٥٠")).toBe("1250");
    expect(parsePaymentEgp("0.01")).toBe("1");
    expect(parsePaymentEgp("0.001")).toBe(null);
    expect(parsePaymentEgp("0")).toBe(null);
    expect(parsePaymentEgp("92233720368547758.08")).toBe(null);
  });
  it("routes Ahmed-supplied and other-supplied trips to separate cash accounts",()=>{
    const ahmed=trip("T1","2026-11-02","V1","AHMED_SUPPLIES","1000");
    const other=trip("T2","2026-11-02","V1","OTHER_SUPPLIES","1000");
    expect(cashResponsibleForTrip(ahmed)).toBe(DEMO_PRIMARY_RESPONSIBLE_ID);
    expect(cashResponsibleForTrip(other)).toBe("K1");
    const source={...base,trips:[ahmed,other],payments:[]};
    const a=buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    const b=buildCashLedger(source,"V1","K1",today);
    expect(a.ok && a.value.balancePiastres==="100000").toBe(true);
    expect(b.ok && b.value.balancePiastres==="100000").toBe(true);
  });
  it("credits work before a payment on the same calendar day",()=>{
    const source={...base,trips:[trip("T1","2026-11-03","V1","AHMED_SUPPLIES","1000")],
      payments:[payment("P1","2026-11-03","100000")]};
    const result=buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    expect(result.ok).toBe(true);
    if(result.ok) {
      expect(result.value.rows.map(r=>r.type)).toEqual(["WORK","PAYMENT"]);
      expect(result.value.balancePiastres).toBe("0");
    }
    expect(validateDemoPayment({...source,payments:[]},draft("1000"),today).ok).toBe(true);
  });
  it("D16 rejects backdated payment with intermediate deficit despite sufficient endpoints",()=>{
    const source={...base,trips:[
      trip("T1","2026-11-01","V1","AHMED_SUPPLIES","1000"),
      trip("T2","2026-11-04","V1","AHMED_SUPPLIES","1000")],
      payments:[payment("P1","2026-11-03","80000")]};
    const result=validateDemoPayment(source,draft("500","2026-11-02"),today);
    expect(result.ok).toBe(false);
    const safe=validateDemoPayment(source,draft("200","2026-11-02"),today);
    expect(safe.ok).toBe(true);
  });

  it("ignores corrupt future trip amounts in historical ledgers but fails when that trip enters the period",()=>{
    const future={...trip("FUTURE","2026-11-10","V1","AHMED_SUPPLIES","1000"),
      vehicleRateEgp:"not-a-number",vehicleTotalPiastres:"1"};
    const source={...base,trips:[future],payments:[]};
    const historical=buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,"2026-11-05");
    expect(historical.ok).toBe(true);
    if(historical.ok) expect(historical.value.balancePiastres).toBe("0");
    expect(buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,"2026-11-10").ok).toBe(false);
  });
  it("rejects an invalid trip direction when the movement is part of the selected cash account",()=>{
    const invalid={...trip("BAD-DIRECTION","2026-11-03","V1","OTHER_SUPPLIES","10"),
      direction:"UNKNOWN" as DemoTripRecord["direction"]};
    const result=buildCashLedger({...base,trips:[invalid],payments:[]},
      "V1","K1",today);
    expect(result).toEqual({ok:false,error:"مستحق نقلة لا يطابق محرك الحساب؛ تم إيقاف دفعات هذا الحساب."});
  });
  it("fails closed when a valid opening plus work or payment exceeds signed 64-bit cumulative balance",()=>{
    const max="9223372036854775807";
    const positive={...base,trips:[trip("OVER-POS","2026-11-03","V1","AHMED_SUPPLIES","1")],
      payments:[],cashOpenings:[{vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
        startDate:"2026-11-01",signedPiastres:max}]};
    expect(buildCashLedger(positive,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today).ok).toBe(false);
    const negative={...base,trips:[],payments:[payment("OVER-NEG","2026-11-03","1")],
      cashOpenings:[{vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
        startDate:"2026-11-01",signedPiastres:"-"+max}]};
    expect(buildCashLedger(negative,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today).ok).toBe(false);
  });
  it("D16 rejects a payment that creates an intermediate deficit even though the final balance stays positive",()=>{
    const source={...base,trips:[
      trip("T1","2026-11-01","V1","AHMED_SUPPLIES","1000"),
      trip("T2","2026-11-04","V1","AHMED_SUPPLIES","1000")],
      payments:[payment("P1","2026-11-03","80000")]};
    const rejected=validateDemoPayment(source,draft("500","2026-11-02"),today);
    expect(rejected.ok).toBe(false);
    if(!rejected.ok) expect(rejected.error).toContain("D16");
    const hypothetical=buildCashLedger({...source,payments:[...source.payments,payment("P2","2026-11-02","50000")]},
      "V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    expect(hypothetical.ok).toBe(true);
    if(hypothetical.ok) {
      expect(hypothetical.value.balancePiastres).toBe("70000");
      expect(hypothetical.value.rows.some(row=>BigInt(row.balancePiastres)<0n)).toBe(true);
    }
    expect(source.payments).toHaveLength(1);
  });

  it("updates exclude old payment once, changing date earlier than dues rejects",()=>{
    const source={...base,trips:[trip("T1","2026-11-03","V1","AHMED_SUPPLIES","1000")],
      payments:[payment("P1","2026-11-03","100000")]};
    expect(validateDemoPayment(source,draft("900","2026-11-03"),today,"P1").ok).toBe(true);
    expect(validateDemoPayment(source,draft("900","2026-11-02"),today,"P1").ok).toBe(false);
    expect(validateDemoPayment(source,draft("900","2026-11-03"),today).ok).toBe(false);
  });
  it("does not allow a payment for another vehicle/contractor and rejects tampered trip amounts",()=>{
    const source={...base,trips:[trip("T1","2026-11-02","V1","AHMED_SUPPLIES","1000")],payments:[]};
    expect(validateDemoPayment(source,{...draft("10"),responsibleContractorId:"K1"},today).ok).toBe(false);
    expect(validateDemoPayment(source,{...draft("10"),vehicleId:"V2"},today).ok).toBe(false);
    const corrupt={...source,trips:[{...source.trips[0],vehicleTotalPiastres:"1"}]};
    expect(buildCashLedger(corrupt,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today).ok).toBe(false);
  });
});
