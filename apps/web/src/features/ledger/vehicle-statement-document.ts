import {cashStatementDocument,type CashReport} from './cash-statement-document';
import type {VehicleTrip} from './vehicle-statement-data';
import type {OperationalReportDocument} from '@ledger/statement-export';
import {formatPoundsForDisplay,scaledIntegerToDecimal} from '../../lib/ledger/amounts';
export function vehicleStatementDocument(report:CashReport,vehicle:string,contractor:string,trips:ReadonlyMap<string,VehicleTrip>):OperationalReportDocument {
 const base=cashStatementDocument(report,vehicle,contractor);
 const money=(v:string)=>formatPoundsForDisplay(v)+' ج.م';
 const work=report.rows.filter(r=>r.movement_type==='WORK');
 const payments=report.rows.filter(r=>r.movement_type==='PAYMENT');
 const tonnes=scaledIntegerToDecimal(work.reduce((n,r)=>{const t=trips.get(String(r.id));if(!t)throw new Error('تفاصيل نقلة ناقصة؛ أعد تحميل الكشف.');return n+BigInt(t.weight_milli_tonnes);},0n).toString(),3);
 const closing=BigInt(report.period_closing_piastres);
 return {...base,presentation:'compact-statement',title:'كشف حساب العربية — '+vehicle,
 subtitle:'حساب العربية لدى '+contractor,
 summarySections:[{title:'ملخص حساب العربية',metrics:[
  {label:'رصيد أول الفترة',direction:'ltr',value:money(report.period_opening_piastres)},
  {label:'مستحق الشغل',direction:'ltr',value:money(report.work_piastres),tone:'credit'},
  {label:'المدفوع للعربية',direction:'ltr',value:money(report.paid_piastres),tone:'debit'},
  {label:closing<0n?'على العربية':closing===0n?'الحساب متعادل':'الباقي للعربية',direction:'ltr',value:money((closing<0n?-closing:closing).toString()),emphasis:true,tone:closing<0n?'debit':'neutral'}]},
  {title:'ملخص النقلات',metrics:[{label:'عدد النقلات',value:String(work.length)},{label:'إجمالي الأطنان',value:tonnes+' طن'},{label:'الرصيد الحالي (كل الحساب)',direction:'ltr',value:money(report.current_cash_balance_piastres)}]}],
 detailsTitle:'تفاصيل النقلات',
 detailsTotal:`إجمالي الكشف كاملًا: ${work.length} نقلة — ${tonnes} طن — المستحق ${money(report.work_piastres)}`,
 columns:['تاريخ النقلة','من','إلى','الأطنان','سعر الطن','المصاريف','إجمالي النقلة'].map((label,i)=>({label,widthWeight:[1.2,1.4,1.4,.8,1,1,1.2][i],direction:i===0||i>=3?'ltr' as const:'rtl' as const})),
 rows:work.map(r=>{const t=trips.get(String(r.id));if(!t)throw new Error('تفاصيل نقلة ناقصة؛ أعد تحميل الكشف.');return [String(r.date),String(t.origin??''),String(t.destination??''),scaledIntegerToDecimal(t.weight_milli_tonnes,3),money(t.vehicle_rate_piastres),money(t.expense_piastres),money(String(r.signed_delta_piastres))];}),
 detailSections:[{title:'الدفعات المستلمة',columns:[{label:'تاريخ الدفعة',widthWeight:1,direction:'ltr'},{label:'المبلغ المستلم',widthWeight:1,direction:'ltr'}],rows:payments.map(r=>[String(r.date),money((-BigInt(String(r.signed_delta_piastres))).toString())]),emptyMessage:'لا توجد دفعات خلال الفترة.'}],
 footerNotes:[]};
}
