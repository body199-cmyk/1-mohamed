import type {OperationalReportDocument} from '@ledger/statement-export';
import {formatPoundsForDisplay,scaledIntegerToDecimal} from '../../lib/ledger/amounts';
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
 const money=(v:string)=>(BigInt(v)>0n?'+':'')+formatPoundsForDisplay(v)+' ج.م';
 return {presentation:'compact-statement',detailsTitle:'تفاصيل شغل المقاول',businessName:'أحمد أبو علي — حسابات النقل',title:'كشف حساب المقاول',subtitle:'شغل أحمد أبو علي مع '+name+'؛ دفعات العربيات مستقلة عن فرق الشغل.',
  generatedAtLabel:new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'}).format(new Date()),
  metadata:[{label:'اسم المقاول',value:name},{label:'من تاريخ',value:report.date_from},{label:'إلى تاريخ',value:report.date_to},
   {label:'رقم العربية',value:vehicles.get(filters.vehicle)??(filters.vehicle||'الكل')},{label:'من',value:filters.origin||'الكل'},
   {label:'إلى',value:filters.destination||'الكل'},{label:'اتجاه الشغل',value:filters.direction==='AHMED_SUPPLIES'?'شغل أحمد':filters.direction==='OTHER_SUPPLIES'?'شغل المقاول':'الكل'}],
  summarySections:[{title:'حساب الفترة الكامل',metrics:[{label:'الحساب السابق',direction:'ltr',value:money(report.opening_balance_piastres)},
   {label:'شغل لصالح أحمد',direction:'ltr',value:money(report.ahmed_work_piastres),tone:'credit'},{label:'شغل على أحمد',direction:'ltr',value:money((-BigInt(report.counterparty_work_piastres)).toString()),tone:'debit'},
   {label:report.beneficiary==='AHMED'?'الصافي لصالح أحمد':report.beneficiary==='COUNTERPARTY'?'الصافي على أحمد':'الحساب متعادل',direction:'ltr',value:formatPoundsForDisplay((BigInt(report.closing_balance_piastres)<0n?-BigInt(report.closing_balance_piastres):BigInt(report.closing_balance_piastres)).toString())+' ج.م',emphasis:true,tone:report.beneficiary==='AHMED'?'credit':report.beneficiary==='COUNTERPARTY'?'debit':'neutral'}]},
   {title:'الحركات المطابقة للفلاتر — ليست رصيد الدين',metrics:[{label:'النقلات',value:String(rows.length)},
    {label:'العربيات',value:String(new Set(rows.map(r=>r.vehicle_id)).size)},
    {label:'الأيام',value:String(new Set(rows.map(r=>r.trip_date)).size)},{label:'الأطنان',value:scaledIntegerToDecimal(rows.reduce((n,r)=>n+BigInt(r.weight_milli_tonnes),0n).toString(),3)},{label:'صافي الشغل المحدد',direction:'ltr',value:money(subtotal)}]}],
  columns:['التاريخ','العربية','من','إلى','الأطنان','اتجاه الشغل','القيمة'].map((label,i)=>({label,widthWeight:[1.2,1.2,1.3,1.3,.8,1.5,1.2][i],direction:i===0||i===4||i===6?'ltr':'rtl'})),
  rows:rows.map(r=>[r.trip_date,vehicles.get(r.vehicle_id)??r.vehicle_id,r.origin??'',r.destination??'',
   scaledIntegerToDecimal(r.weight_milli_tonnes,3),r.direction==='AHMED_SUPPLIES'?'شغل لأحمد أبو علي':'شغل على أحمد أبو علي',money(r.signed_delta_piastres)]),
  rowTones:rows.map(r=>r.direction==='AHMED_SUPPLIES'?'credit' as const:'debit' as const),
  emptyMessage:'لا توجد نقلات مطابقة.',footerNotes:[report.beneficiary==='AHMED'?'لأحمد أبو علي عند '+name:report.beneficiary==='COUNTERPARTY'?'على أحمد أبو علي لصالح '+name:'الحساب متعادل',`إجمالي الشغل المطابق: ${rows.length} نقلة — صافي الشغل ${money(subtotal)}؛ رصيد الدين الكامل ${money(report.closing_balance_piastres)}.`, 'دفعات العربيات لا تدخل في فرق شغل المقاول.','الفلاتر تخص تفاصيل الشغل؛ الحساب السابق والختامي يظلان لحساب الفترة بالكامل.']};
}
