import {postLedgerRead,type LedgerResponse} from '../../lib/ledger/transport';
import {assertSqlMoney} from '../../lib/ledger/report-contract';
import {assertReportPage,mergeReportPage,type ReportPage} from './report-snapshot';
import type {CashReport} from './cash-statement-document';
export type VehicleTrip={id:string;trip_date:string;vehicle_id:string;responsible_contractor_id:string;
 origin:string|null;destination:string|null;notes:string|null;weight_milli_tonnes:string;
 vehicle_rate_piastres:string;expense_piastres:string;vehicle_total_piastres:string};
export function matchVehicleTrips(cash:CashReport,rows:Record<string,unknown>[]):Map<string,VehicleTrip>{
 const indexed=new Map(rows.map(r=>[r.id,r]));const result=new Map<string,VehicleTrip>();
 for(const movement of cash.rows.filter(r=>r.movement_type==='WORK')){
  const trip=indexed.get(movement.id);
  if(!trip||trip.vehicle_id!==cash.vehicle_id||trip.responsible_contractor_id!==cash.responsible_contractor_id||
   trip.trip_date!==movement.date||trip.is_cancelled!==false||typeof trip.weight_milli_tonnes!=='string'||!/^\d+$/.test(trip.weight_milli_tonnes))
   throw new Error('تفاصيل النقلة لا تطابق حساب العربية. أعد تحميل الكشف.');
  for(const key of ['vehicle_rate_piastres','expense_piastres','vehicle_total_piastres'])assertSqlMoney(trip[key]);
  if(trip.vehicle_total_piastres!==movement.signed_delta_piastres)throw new Error('قيمة النقلة لا تطابق كشف النقدية. أعد التحميل.');
  result.set(String(trip.id),trip as VehicleTrip);
 }
 return result;
}
/** Same audited global snapshot, selected vehicle/date only; no contractor-party substitution. */
export async function loadVehicleTrips(cash:CashReport):Promise<Map<string,VehicleTrip>>{
 if(!cash.rows.some(r=>r.movement_type==='WORK'))return new Map();
 let collected:ReportPage|null=null;
 const cursorOf=(page:ReportPage|null)=>page?.next_cursor;
 for(let page=0;page<125;page++){
  const response:LedgerResponse<ReportPage>=await postLedgerRead<ReportPage>('trips.list',{vehicle_id:cash.vehicle_id,date_from:cash.date_from,date_to:cash.date_to,
   include_cancelled:false,limit:200,snapshot:cash.snapshot,...(cursorOf(collected)?{cursor:cursorOf(collected)}:{})});
  if(!response.ok)throw new Error(response.error);
  if(response.data.snapshot!==cash.snapshot)throw new Error('تغيرت البيانات أثناء قراءة تفاصيل النقلات. أعد تحميل الكشف.');
  if(collected)collected=mergeReportPage(collected,response.data);else{assertReportPage(response.data);collected=response.data;}
  const wanted=cash.rows.filter(r=>r.movement_type==='WORK');
  if(wanted.every(r=>collected!.rows.some(t=>t.id===r.id)))return matchVehicleTrips(cash,collected.rows);
  if(!collected.next_cursor)return matchVehicleTrips(cash,collected.rows);
 }
 throw new Error('تفاصيل النقلات تجاوزت حد القراءة. اختر فترة أقصر.');
}
