import { describe, expect, it } from "vitest";
import { applyDemoPaymentEdit, type PaymentOperationState } from "../src/features/payments/demo-payment-operation";
import { buildCashLedger, DEMO_PRIMARY_RESPONSIBLE_ID } from "../src/features/payments/cash-ledger";
import type { DemoPayment, DemoTripRecord } from "../src/demo/demo-types";

const work = (id:string, direction:DemoTripRecord["direction"], amount:string):DemoTripRecord => ({
  id,workDate:"2026-11-03",counterpartyId:"K1",vehicleId:"V1",direction,
  origin:"A",destination:"B",weightTonnes:"1",contractorRateEgp:amount,
  vehicleRateEgp:amount,expenseEgp:"0",
  contractorTotalPiastres:(BigInt(amount)*100n).toString(),
  vehicleTotalPiastres:(BigInt(amount)*100n).toString(),
  receiptNumber:"",notes:"",createdAt:"2026-11-03T10:00:00.000Z"
});
const old:DemoPayment={
  id:"P1",vehicleId:"V1",responsibleContractorId:DEMO_PRIMARY_RESPONSIBLE_ID,
  paymentDate:"2026-11-03",amountPiastres:"30000",
  linkedTripId:"",receiptNumber:"",notes:"",
  createdAt:"2026-11-03T11:00:00.000Z",
  version:1,isCancelled:false,cancelReason:""
};
const makeState=():PaymentOperationState=>({
  trips:[work("TA","AHMED_SUPPLIES","500"),work("TK","OTHER_SUPPLIES","100")],
  payments:[old],paymentAudit:[],cashOpenings:[],
  contractors:[{id:"K1",name:"contractor",openingDate:"2026-11-01",openingBalancePiastres:"0",isArchived:false}],
  vehicles:[{id:"V1",plateNumber:"A",driverName:"B",isArchived:false}]
});
const draft=(amount="80",date="2026-11-03")=>({
  vehicleId:"V1",responsibleContractorId:"K1",paymentDate:date,
  amountEgp:amount,linkedTripId:"",receiptNumber:"",notes:"corrected"
});
const snapshot=(state:PaymentOperationState,responsible:string)=>buildCashLedger(
  state,"V1",responsible,"2026-11-05"
);

describe("FIN-01/FIN-02 genuine DemoStore.editPayment transition",()=>{
  it("moves a real payment exactly once with one audit, version increment and authentic date",()=>{
    const state=makeState();
    const beforeOld=snapshot(state,DEMO_PRIMARY_RESPONSIBLE_ID);
    const beforeNew=snapshot(state,"K1");
    expect(beforeOld.ok && beforeOld.value.balancePiastres==="20000").toBe(true);
    expect(beforeNew.ok && beforeNew.value.balancePiastres==="10000").toBe(true);
    const tx=applyDemoPaymentEdit(state,"P1",1,"account reassignment",draft(),"2026-11-05","2026-11-05T14:00:00.000Z");
    expect(tx.ok).toBe(true);
    if(!tx.ok)return;
    expect(tx.payments).toHaveLength(1);
    expect(tx.payment.paymentDate).toBe("2026-11-03");
    expect(tx.payment.version).toBe(2);
    expect(tx.payment.responsibleContractorId).toBe("K1");
    expect(tx.audit).toHaveLength(1);
    expect(tx.audit[0]!.reason).toBe("account reassignment");
    expect(JSON.parse(tx.audit[0]!.before).responsibleContractorId).toBe(DEMO_PRIMARY_RESPONSIBLE_ID);
    expect(JSON.parse(tx.audit[0]!.after).responsibleContractorId).toBe("K1");
    const after={...state,payments:tx.payments,paymentAudit:tx.audit};
    const oldAfter=snapshot(after,DEMO_PRIMARY_RESPONSIBLE_ID);
    const newAfter=snapshot(after,"K1");
    expect(oldAfter.ok && oldAfter.value.balancePiastres==="50000").toBe(true);
    expect(newAfter.ok && newAfter.value.balancePiastres==="2000").toBe(true);
    expect(state.payments).toEqual([old]);
    expect(state.paymentAudit).toEqual([]);
  });
  it("rejects stale version or overpayment atomically without audit or source changes",()=>{
    const state=makeState();
    const frozen=JSON.stringify(state);
    const version=applyDemoPaymentEdit(state,"P1",7,"wrong version",draft(),"2026-11-05","2026-11-05T14:00:00.000Z");
    expect(version.ok).toBe(false);
    const overpay=applyDemoPaymentEdit(state,"P1",1,"invalid amount",draft("150"),"2026-11-05","2026-11-05T14:00:00.000Z");
    expect(overpay.ok).toBe(false);
    expect(JSON.stringify(state)).toBe(frozen);
    expect(state.payments).toHaveLength(1);
    expect(state.paymentAudit).toHaveLength(0);
  });
});
