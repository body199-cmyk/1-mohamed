import type { OperationalReportDocument } from "@ledger/statement-export";
import { piastresToPounds } from "../../lib/ledger/amounts";
import { assertSqlMoney } from "../../lib/ledger/report-contract";
import { assertReportPage, type ReportPage } from "./report-snapshot";
export type CashReport = ReportPage & {
  date_from:string;date_to:string;vehicle_id:string;responsible_contractor_id:string;
  period_opening_piastres:string;period_closing_piastres:string;current_cash_balance_piastres:string;
  work_piastres:string;paid_piastres:string;
};
export function verifyCashReport(report:CashReport) {
  assertReportPage(report);
  for(const key of ['period_opening_piastres','period_closing_piastres','current_cash_balance_piastres','work_piastres','paid_piastres'] as const) assertSqlMoney(report[key]);
  if(BigInt(report.period_opening_piastres)+BigInt(report.work_piastres)-BigInt(report.paid_piastres)!==BigInt(report.period_closing_piastres)) throw new Error('كشف النقدية غير متطابق؛ أعد تحميله.');
  let running=BigInt(report.period_opening_piastres);
  for(const row of report.rows){
    assertSqlMoney(row.signed_delta_piastres);assertSqlMoney(row.running_balance_piastres);
    if(!['WORK','PAYMENT'].includes(String(row.movement_type))) throw new Error('نوع حركة نقدية غير معروف.');
    if((row.movement_type==='WORK'&&BigInt(row.signed_delta_piastres)<0n)||
      (row.movement_type==='PAYMENT'&&BigInt(row.signed_delta_piastres)>=0n)) throw new Error('إشارة حركة نقدية غير صحيحة.');
    running+=BigInt(row.signed_delta_piastres);
    if(running!==BigInt(row.running_balance_piastres)) throw new Error('الرصيد التراكمي غير متطابق.');
  }
  if(!report.next_cursor&&running!==BigInt(report.period_closing_piastres)) throw new Error('تقرير النقدية غير مكتمل.');
}
export function cashStatementDocument(report:CashReport,vehicle:string,contractor:string):OperationalReportDocument {
  verifyCashReport(report);
  if(report.next_cursor) throw new Error('حمّل كل الصفحات قبل التصدير.');
  const money=(v:string)=>piastresToPounds(v)+' ج.م';
  return {businessName:'أحمد أبو علي — حسابات النقل',title:'كشف نقدية العربية',
    subtitle:'شغل العربية ودفعاتها لدى المقاول المسؤول؛ مستقل عن فرق شغل المقاولين.',
    generatedAtLabel:new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'}).format(new Date()),
    metadata:[{label:'العربية',value:vehicle},{label:'المقاول المسؤول',value:contractor},{label:'من',value:report.date_from},{label:'إلى',value:report.date_to}],
    summarySections:[{title:'ملخص الحساب',metrics:[
      {label:'أول الفترة',value:money(report.period_opening_piastres)},
      {label:'مستحق الشغل',value:money(report.work_piastres)},
      {label:'المدفوع',value:money(report.paid_piastres)},
      {label:'آخر الفترة',value:money(report.period_closing_piastres)},
      {label:'الرصيد الحالي',value:money(report.current_cash_balance_piastres)}]}],
    columns:['التاريخ','نوع الحركة','المرجع','خط السير','الحركة (جنيه)','الرصيد (جنيه)','ملاحظات'].map(label=>({label,widthWeight:1})),
    rows:report.rows.map(r=>[String(r.date),r.movement_type==='WORK'?'شغل':'دفعة',String(r.id),
      [r.origin,r.destination].filter(Boolean).join(' ← '),piastresToPounds(String(r.signed_delta_piastres)),
      piastresToPounds(String(r.running_balance_piastres)),String(r.notes??'')]),
    emptyMessage:'لا توجد حركات في الفترة.',footerNotes:['الموجب مستحق للعربية؛ السالب على العربية لدى هذا المقاول.','الإلغاءات مستبعدة. الشغل يسبق الدفعات في اليوم نفسه.']};
}
