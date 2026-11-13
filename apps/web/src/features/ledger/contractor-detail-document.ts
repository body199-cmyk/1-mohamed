import type {OperationalReportDocument} from '@ledger/statement-export';
import {piastresToPounds,scaledIntegerToDecimal} from '../../lib/ledger/amounts';
import {verifyLiveStatement,type LiveStatementReport,type LiveStatementRow} from './contractor-statement-document';
export type StatementFilters={vehicle:string;origin:string;destination:string;direction:string};
export const emptyStatementFilters:StatementFilters={vehicle:'',origin:'',destination:'',direction:''};
export function filterStatementRows(rows:LiveStatementRow[],filters:StatementFilters){
 return rows.filter(r=>(!filters.vehicle||r.vehicle_id===filters.vehicle)&&(!filters.origin||r.origin===filters.origin)&&
  (!filters.destination||r.destination===filters.destination)&&(!filters.direction||r.direction===filters.direction));
}
export function buildDetailedContractorDocument(report:LiveStatementReport,name:string,vehicles:ReadonlyMap<string,string>,filters:StatementFilters):OperationalReportDocument {
 verifyLiveStatement(report);
 if(report.next_cursor||BigInt(report.total_count)!==BigInt(report.rows.length))throw new Error('حمّل كل صفحات الكشف قبل الفلترة والتصدير.');
 const rows=filterStatementRows(report.rows,filters);
 const subtotal=rows.reduce((n,r)=>n+BigInt(r.signed_delta_piastres),0n).toString();
 const money=(v:string)=>(BigInt(v)>0n?'+':'')+piastresToPounds(v)+' ج.م';
 return {businessName:'أحمد أبو علي — حسابات النقل',title:'كشف حساب المقاول',subtitle:'الموجب لأحمد، السالب عليه. رصيد الحساب الكامل مستقل عن مجموع الحركات المفلترة.',
  generatedAtLabel:new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'}).format(new Date()),
  metadata:[{label:'المقاول',value:name},{label:'من تاريخ',value:report.date_from},{label:'إلى تاريخ',value:report.date_to},
   {label:'العربية',value:vehicles.get(filters.vehicle)??(filters.vehicle||'الكل')},{label:'من',value:filters.origin||'الكل'},
   {label:'إلى',value:filters.destination||'الكل'},{label:'الاتجاه',value:filters.direction==='AHMED_SUPPLIES'?'شغل أحمد':filters.direction==='OTHER_SUPPLIES'?'شغل المقاول':'الكل'}],
  summarySections:[{title:'حساب الفترة الكامل',metrics:[{label:'الحساب السابق',value:money(report.opening_balance_piastres)},
   {label:'شغل أحمد',value:money(report.ahmed_work_piastres)},{label:'شغل المقاول',value:money((-BigInt(report.counterparty_work_piastres)).toString())},
   {label:'آخر الفترة',value:money(report.closing_balance_piastres)},
   {label:'صاحب الحق',value:report.beneficiary==='AHMED'?'أحمد أبو علي':report.beneficiary==='COUNTERPARTY'?name:'متعادل'}]},
   {title:'الحركات المطابقة للفلاتر — ليست رصيد الدين',metrics:[{label:'النقلات',value:String(rows.length)},
    {label:'العربيات',value:String(new Set(rows.map(r=>r.vehicle_id)).size)},
    {label:'الأيام',value:String(new Set(rows.map(r=>r.trip_date)).size)},{label:'صافي الشغل المحدد',value:money(subtotal)}]}],
  columns:['التاريخ','رقم النقلة','العربية','من','إلى','الوزن (طن)','الاتجاه','قيمة الشغل','رصيد الحساب الكامل','ملاحظات'].map(label=>({label,widthWeight:1})),
  rows:rows.map(r=>[r.trip_date,r.id,vehicles.get(r.vehicle_id)??r.vehicle_id,r.origin??'',r.destination??'',
   scaledIntegerToDecimal(r.weight_milli_tonnes,3),r.direction==='AHMED_SUPPLIES'?'شغل أحمد':'شغل المقاول',money(r.signed_delta_piastres),money(r.running_balance_piastres),r.notes??'']),
  emptyMessage:'لا توجد نقلات مطابقة.',footerNotes:['دفعات العربيات لا تدخل في فرق شغل المقاول.','الفلاتر تخص تفاصيل الشغل؛ الحساب السابق والختامي يظلان لحساب الفترة بالكامل.']};
}
