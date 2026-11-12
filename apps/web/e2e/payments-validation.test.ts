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

  it("fails closed on duplicate cash openings rather than choosing an arbitrary balance",()=>{
    const first={vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      startDate:"2026-11-01",signedPiastres:"10000"};
    const duplicate={...first,signedPiastres:"50000"};
    const independent={vehicleId:"V1",contractorId:"K1",
      startDate:"2026-11-01",signedPiastres:"700"};
    const source={...base,trips:[],payments:[],
      cashOpenings:[first,duplicate,independent]};
    const invalid=buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    expect(invalid.ok).toBe(false);
    if(!invalid.ok) expect(invalid.error).toContain("أكثر من رصيد افتتاحي");
    expect(validateDemoPayment(source,draft("1"),today).ok).toBe(false);
    const other=buildCashLedger(source,"V1","K1",today);
    expect(other.ok).toBe(true);
    if(other.ok) expect(other.value.balancePiastres).toBe("700");
  });

  it("rejects non-canonical persisted piastres encodings for openings and payments",()=>{
    for(const signedPiastres of ["+1","0x10","01","-0"]){
      const source={...base,trips:[],payments:[],cashOpenings:[{
        vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
        startDate:"2026-11-01",signedPiastres
      }]};
      expect(buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today).ok).toBe(false);
    }
    for(const amountPiastres of ["+1","0x10","01","0"]){
      const source={...base,trips:[],payments:[payment("BAD-AMOUNT","2026-11-03",amountPiastres)],cashOpenings:[]};
      expect(buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today).ok).toBe(false);
    }
  });
  it("BUG-015 accepts the SQL minimum opening -(2^63) and rejects one piastre below it",()=>{
    const min="-9223372036854775808";
    const source={...base,trips:[],payments:[],cashOpenings:[{
      vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      startDate:"2026-11-01",signedPiastres:min
    }]};
    // The approved validator and the SQL layer both accept this extreme, so the
    // cash report must read it back instead of failing the whole ledger.
    const accepted=buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    expect(accepted.ok).toBe(true);
    if(accepted.ok){
      expect(accepted.value.openingPiastres).toBe(min);
      expect(accepted.value.balancePiastres).toBe(min);
      expect(accepted.value.rows).toHaveLength(0);
    }
    // One piastre below the SQL minimum is not a valid stored opening anywhere.
    const below={...source,cashOpenings:[{vehicleId:"V1",
      contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      startDate:"2026-11-01",signedPiastres:"-9223372036854775809"}]};
    const rejected=buildCashLedger(below,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    expect(rejected).toEqual({ok:false,error:"رصيد افتتاحي نقدي غير صالح."});
    // Positive extreme stays accepted; per-movement limits are unchanged.
    const positive={...source,cashOpenings:[{vehicleId:"V1",
      contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      startDate:"2026-11-01",signedPiastres:"9223372036854775807"}]};
    expect(buildCashLedger(positive,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today).ok).toBe(true);
  });
  it("rejects an individual work movement above signed 64-bit even if a negative opening would offset it",()=>{
    const max="9223372036854775807";
    const oversized={...trip("OVER-MOVEMENT","2026-11-03","V1","AHMED_SUPPLIES","1"),
      vehicleRateEgp:"92233720368547758.08",
      vehicleTotalPiastres:"9223372036854775808"};
    const source={...base,trips:[oversized],payments:[],cashOpenings:[{
      vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      startDate:"2026-11-01",signedPiastres:"-"+max
    }]};
    expect(buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today).ok).toBe(false);
  });
  it("rejects a payment dated before the cash opening starts",()=>{
    const source={...base,trips:[],payments:[],cashOpenings:[{
      vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
      startDate:"2026-11-04",signedPiastres:"100000"
    }]};
    const result=validateDemoPayment(source,draft("100","2026-11-02"),today);
    expect(result.ok).toBe(false);
    if(!result.ok) expect(result.error).toContain("افتتاحي النقد");
  });
  it("fails closed for every cash account when an in-period trip direction is corrupted",()=>{
    const invalid={...trip("BAD-DIRECTION","2026-11-03","V1","OTHER_SUPPLIES","10"),
      direction:"UNKNOWN" as unknown as DemoTripRecord["direction"]};
    const source={...base,trips:[invalid],payments:[],cashOpenings:[]};
    expect(buildCashLedger(source,"V1","K1",today).ok).toBe(false);
    expect(buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today).ok).toBe(false);
  });

  it("D15 aggregates every same-day work movement before D16 evaluates the payment minimum",()=>{
    const source={...base,trips:[
      trip("T1","2026-11-03","V1","AHMED_SUPPLIES","100"),
      trip("T2","2026-11-03","V1","AHMED_SUPPLIES","900")],payments:[]};
    const ledger=buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    expect(ledger.ok).toBe(true);
    if(ledger.ok) expect(ledger.value.rows.map(r=>r.balancePiastres)).toEqual(["10000","100000"]);
    expect(validateDemoPayment(source,draft("1000","2026-11-03"),today).ok).toBe(true);
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
      direction:"UNKNOWN" as unknown as DemoTripRecord["direction"]};
    const result=buildCashLedger({...base,trips:[invalid],payments:[]},
      "V1","K1",today);
    expect(result).toEqual({ok:false,error:"اتجاه نقلة غير صالح في حساب العربية؛ تم إيقاف التقرير والحفظ."});
  });
  it("FIN-07 retains exact cumulative cash balances outside the per-movement bigint range",()=>{
    const max="9223372036854775807";
    // Every stored opening and individual movement remains valid SQL bigint.
    // PostgreSQL aggregate cash balance is NUMERIC, so their SUM is not bigint-bound.
    const positive={...base,trips:[trip("OVER-POS","2026-11-03","V1","AHMED_SUPPLIES","1")],
      payments:[],cashOpenings:[{vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
        startDate:"2026-11-01",signedPiastres:max}]};
    const increased=buildCashLedger(positive,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    expect(increased.ok).toBe(true);
    if(increased.ok) {
      expect(increased.value.openingPiastres).toBe(max);
      expect(increased.value.balancePiastres).toBe("9223372036854775907");
      expect(increased.value.rows.map(r=>r.balancePiastres)).toEqual(["9223372036854775907"]);
    }
    const negative={...base,trips:[],payments:[payment("OVER-NEG","2026-11-03","2")],
      cashOpenings:[{vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
        startDate:"2026-11-01",signedPiastres:"-"+max}]};
    const decreased=buildCashLedger(negative,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    expect(decreased.ok).toBe(true);
    if(decreased.ok) {
      expect(decreased.value.balancePiastres).toBe("-9223372036854775809");
      expect(decreased.value.rows[0]?.amountPiastres).toBe("-2");
    }
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
  it("FIN-01 rejects pre-opening create/edit but permits opening day on the selected cash account",()=>{
    const source={...base,trips:[],payments:[],cashOpenings:[
      {vehicleId:"V1",contractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
        startDate:"2026-11-04",signedPiastres:"100000"},
      {vehicleId:"V1",contractorId:"K1",
        startDate:"2026-11-02",signedPiastres:"20000"},
    ]};
    const preOpening=validateDemoPayment(source,draft("100","2026-11-03"),today);
    expect(preOpening.ok).toBe(false);
    if(!preOpening.ok) expect(preOpening.error).toContain("افتتاحي النقد");
    expect(validateDemoPayment(source,draft("100","2026-11-04"),today).ok).toBe(true);
    // The same vehicle at a DIFFERENT responsible contractor has its own opening.
    expect(validateDemoPayment(source,{
      ...draft("100","2026-11-03"),responsibleContractorId:"K1"
    },today).ok).toBe(true);
    const withPrevious={...source,payments:[payment("P-OLD","2026-11-04","50000")]};
    expect(validateDemoPayment(withPrevious,draft("500","2026-11-04"),today,"P-OLD").ok).toBe(true);
    expect(validateDemoPayment(withPrevious,draft("500","2026-11-03"),today,"P-OLD").ok).toBe(false);
    expect(withPrevious.payments[0]!.paymentDate).toBe("2026-11-04");
  });

  it("FIN-02 credits all same-day work before multiple payments and evaluates the exact EOD minimum",()=>{
    const source={...base,trips:[
      trip("T1","2026-11-03","V1","AHMED_SUPPLIES","100"),
      trip("T2","2026-11-03","V1","AHMED_SUPPLIES","900"),
    ],payments:[
      payment("P1","2026-11-03","30000"),
      payment("P2","2026-11-03","20000"),
    ]};
    const ledger=buildCashLedger(source,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    expect(ledger.ok).toBe(true);
    if(ledger.ok) {
      expect(ledger.value.rows.map(r=>r.type)).toEqual(["WORK","WORK","PAYMENT","PAYMENT"]);
      expect(ledger.value.balancePiastres).toBe("50000");
    }
    expect(validateDemoPayment(source,draft("500","2026-11-03"),today).ok).toBe(true);
    expect(validateDemoPayment(source,draft("500.01","2026-11-03"),today).ok).toBe(false);
  });

  it("FIN-02 blocks a past payment when a later intermediate date is underfunded",()=>{
    const source={...base,trips:[
      trip("T1","2026-11-01","V1","AHMED_SUPPLIES","1000"),
      trip("T2","2026-11-04","V1","AHMED_SUPPLIES","700"),
    ],payments:[payment("P1","2026-11-03","60000")]};
    expect(validateDemoPayment(source,draft("500","2026-11-02"),today).ok).toBe(false);
    expect(validateDemoPayment(source,draft("400","2026-11-02"),today).ok).toBe(true);
  });

  it("FIN-02 preserves separate responsible cash accounts when a payment is edited across accounts",()=>{
    const source={...base,trips:[
      trip("TA","2026-11-03","V1","AHMED_SUPPLIES","500"),
      trip("TK","2026-11-03","V1","OTHER_SUPPLIES","100"),
    ],payments:[payment("P1","2026-11-03","30000")]};
    const movedDraft={...draft("100","2026-11-03"),responsibleContractorId:"K1"};
    expect(validateDemoPayment(source,movedDraft,today,"P1").ok).toBe(true);
    const movedPayment=payment("P1","2026-11-03","10000","V1","K1");
    const after={...source,payments:[movedPayment]};
    const ahmed=buildCashLedger(after,"V1",DEMO_PRIMARY_RESPONSIBLE_ID,today);
    const contractorCash=buildCashLedger(after,"V1","K1",today);
    expect(ahmed.ok && ahmed.value.balancePiastres==="50000").toBe(true);
    expect(contractorCash.ok && contractorCash.value.balancePiastres==="0").toBe(true);
    // The original payment must not be duplicated or have its real date rewritten.
    expect(after.payments).toHaveLength(1);
    expect(after.payments[0]!.paymentDate).toBe("2026-11-03");
  });

});
