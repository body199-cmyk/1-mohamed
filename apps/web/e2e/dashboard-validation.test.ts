import { describe, expect, it } from "vitest";
import { buildDashboardSummary } from "../src/features/reports/dashboard-summary";
import { INITIAL_TRIPS } from "../src/demo/demo-data";
import type { DemoPayment } from "../src/demo/demo-types";

const payment=(id:string,date:string,amountPiastres:string,cancelled=false):DemoPayment=>({
  id,vehicleId:"V1",responsibleContractorId:"PRIMARY_AHMED",paymentDate:date,
  amountPiastres,linkedTripId:"",receiptNumber:"000"+id,notes:"",
  createdAt:date+"T13:00:00.000Z",version:1,isCancelled:cancelled,cancelReason:cancelled?"خطأ":""
});

describe("T08.6/H051 dashboard measures separated work activity and cash payments",()=>{
  it("reads daily work totals from canonical daily report (not a new accounting formula)",()=>{
    const r=buildDashboardSummary(INITIAL_TRIPS,[],"2026-11-05");
    expect(r.ok).toBe(true);
    if(!r.ok)return;
    expect(r.work.totals.tripCount).toBe(1);
    expect(r.work.totals.totalWeightTonnes).toBe("2.000");
    expect(r.work.totals.contractorTotalPiastres).toBe("100000");
    expect(r.work.totals.vehicleTotalPiastres).toBe("90000");
    expect(r.work.ahmedSupplies.tripCount).toBe(1);
    expect(r.work.otherSupplies.tripCount).toBe(0);
  });
  it("sums only active actual-day payments, with exact piastres and no netting against work",()=>{
    const r=buildDashboardSummary(INITIAL_TRIPS,[
      payment("A","2026-11-05","12345"),
      payment("B","2026-11-05","50"),
      payment("C","2026-11-05","1000",true),
      payment("D","2026-11-03","9999"),
    ],"2026-11-05");
    expect(r.ok).toBe(true);
    if(!r.ok)return;
    expect(r.paidPiastres).toBe("12395");
    expect(r.paymentCount).toBe(2);
    expect(r.work.totals.vehicleTotalPiastres).toBe("90000");
  });
  it("keeps payments visible when there is no work on the selected day",()=>{
    const r=buildDashboardSummary(INITIAL_TRIPS,[payment("A","2026-11-04","100")],"2026-11-04");
    expect(r.ok).toBe(true);
    if(!r.ok)return;
    expect(r.work.totals.tripCount).toBe(0);
    expect(r.work.totals.vehicleTotalPiastres).toBe("0");
    expect(r.paidPiastres).toBe("100");
  });
  it("fails closed for invalid dates and tampered work snapshots",()=>{
    expect(buildDashboardSummary(INITIAL_TRIPS,[],"2026-02-30").ok).toBe(false);
    expect(buildDashboardSummary([{...INITIAL_TRIPS[1]!,vehicleTotalPiastres:"1"}],[],"2026-11-05").ok).toBe(false);
  });
  it("rejects corrupted payment values instead of publishing misleading figures",()=>{
    expect(buildDashboardSummary(INITIAL_TRIPS,[payment("A","2026-11-05","0")],"2026-11-05").ok).toBe(false);
    expect(buildDashboardSummary(INITIAL_TRIPS,[payment("A","2026-11-05","10.1")],"2026-11-05").ok).toBe(false);
    expect(buildDashboardSummary(INITIAL_TRIPS,[payment("A","2026-11-05","9223372036854775808")],"2026-11-05").ok).toBe(false);
  });
  it("uses BigInt exact addition beyond JavaScript safe number and preserves numeric-sized aggregates",()=>{
    const ok=buildDashboardSummary([],[
      payment("A","2026-11-05","9007199254740993"),
      payment("B","2026-11-05","2"),
    ],"2026-11-05");
    expect(ok.ok && ok.paidPiastres==="9007199254740995").toBe(true);
    const large=buildDashboardSummary([],[
      payment("A","2026-11-05","9223372036854775800"),
      payment("B","2026-11-05","10"),
    ],"2026-11-05");
    expect(large.ok && large.paidPiastres==="9223372036854775810" && large.paymentCount===2).toBe(true);
  });
});
