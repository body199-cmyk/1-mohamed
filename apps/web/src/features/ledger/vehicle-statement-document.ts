import {cashStatementDocument,type CashReport} from './cash-statement-document';
import type {VehicleTrip} from './vehicle-statement-data';
import {formatPoundsForDisplay,scaledIntegerToDecimal} from '../../lib/ledger/amounts';
export function vehicleStatementDocument(report:CashReport,vehicle:string,contractor:string,trips:ReadonlyMap<string,VehicleTrip>){
 const base=cashStatementDocument(report,vehicle,contractor);
 const money=(v:string)=>formatPoundsForDisplay(v)+' ج.م';
 const values=[...trips.values()];
 const tonnes=scaledIntegerToDecimal(values.reduce((n,r)=>n+BigInt(r.weight_milli_tonnes),0n).toString(),3);
 return {...base,title:'كشف حساب العربية — '+vehicle,subtitle:'حساب العربية عند '+contractor+'؛ دفعاتها مستقلة عن فرق شغل المقاولين.',
 summarySections:[{title:'المستحق والمدفوع والباقي',metrics:[
  {label:'رصيد أول الفترة',value:money(report.period_opening_piastres)},
  {label:'شغل الفترة',value:money(report.work_piastres)},
  {label:'المدفوع خلال الفترة',value:money(report.paid_piastres)},
  {label:BigInt(report.period_closing_piastres)<0n?'على العربية آخر الفترة':'الباقي للعربية آخر الفترة',value:money((BigInt(report.period_closing_piastres)<0n?-BigInt(report.period_closing_piastres):BigInt(report.period_closing_piastres)).toString()),emphasis:true},
  {label:'الرصيد الحالي (كل الحساب)',value:money(report.current_cash_balance_piastres)},
  {label:'النقلات',value:String(values.length)},{label:'إجمالي الأطنان',value:tonnes}]}],
 columns:['التاريخ','الحركة والمرجع','خط السير','الأطنان','سعر طن العربية','المصاريف','مبلغ الحركة','الرصيد','ملاحظات'].map((label,i)=>({label,widthWeight:[1,1.7,1.8,.8,1,.9,1.1,1.1,1.3][i]})),
 rows:report.rows.map(r=>{const t=r.movement_type==='WORK'?trips.get(String(r.id)):undefined;return [String(r.date),(r.movement_type==='WORK'?'نقلة ':'دفعة ')+r.id,
 [r.origin,r.destination].filter(Boolean).join(' ← '),t?scaledIntegerToDecimal(t.weight_milli_tonnes,3):'—',t?money(t.vehicle_rate_piastres):'—',t?money(t.expense_piastres):'—',
 money(String(r.signed_delta_piastres)),money(String(r.running_balance_piastres)),String(r.notes??t?.notes??'')];}),
 footerNotes:[...base.footerNotes,`إجمالي النقلات: ${values.length} — الأطنان: ${tonnes} — شغل الفترة: ${money(report.work_piastres)} — المدفوع: ${money(report.paid_piastres)} — رصيد آخر الفترة: ${money(report.period_closing_piastres)}`,
 'سعر الطن غير إجمالي النقلة؛ المصاريف ضمن إجمالي مستحقها وليست خصمًا. لا توزيع تلقائي للدفعة على نقلة بعينها.']};
}
