"use client";
import ui from './workspace-ui.module.css';
import styles from './statement-design.module.css';
import {scaledIntegerToDecimal,formatPoundsForDisplay} from '../../lib/ledger/amounts';
import {useState} from 'react';
import {ContractorMoney} from '../contractor-statements/contractor-money';
import {ReportExportActions} from '../reports/report-export-actions';
import {ReportExportPreview} from '../reports/report-export-preview';
import {buildDetailedContractorDocument,emptyStatementFilters,filterStatementRows,type StatementFilters} from './contractor-detail-document';
import type {LiveStatementReport} from './contractor-statement-document';
export function ContractorDetails({report,name,vehicleNames,disabled}:{report:LiveStatementReport;name:string;vehicleNames:ReadonlyMap<string,string>;disabled:boolean}){
 const [filters,setFilters]=useState<StatementFilters>(emptyStatementFilters);
 const complete=!report.next_cursor&&BigInt(report.total_count)===BigInt(report.rows.length);
 const rows=complete?filterStatementRows(report.rows,filters):report.rows;
 const days=[...new Set(rows.map(r=>r.trip_date))];
 const choices={vehicle:[...new Set(report.rows.map(r=>r.vehicle_id))],origin:[...new Set(report.rows.map(r=>r.origin??''))].filter(Boolean),
  destination:[...new Set(report.rows.map(r=>r.destination??''))].filter(Boolean),direction:['AHMED_SUPPLIES','OTHER_SUPPLIES']};
 const labels={vehicle:'العربية',origin:'من',destination:'إلى',direction:'اتجاه الشغل'};
 const doc=complete?buildDetailedContractorDocument(report,name,vehicleNames,filters):null;
 return <>
  <details className={styles.advanced}><summary>فلترة تفاصيل الشغل — العربية والطريق والاتجاه</summary>
  <fieldset className={ui.filterGrid} disabled={!complete||disabled} style={{border:0,minWidth:0}}><legend>فلترة تفاصيل الشغل</legend>
    {(Object.keys(labels) as (keyof StatementFilters)[]).map(key=><label key={key} className={ui.fieldGroup}>
     {labels[key]}<select className={ui.control} aria-label={'فلتر '+labels[key]} value={filters[key]} onChange={e=>setFilters(f=>({...f,[key]:e.target.value}))}>
      <option value="">الكل</option>{choices[key].map(value=><option key={value} value={value}>
       {key==='vehicle'?vehicleNames.get(value)??value:key==='direction'?(value==='AHMED_SUPPLIES'?'شغل أحمد':'شغل المقاول'):value}</option>)}
     </select></label>)}
  </fieldset></details>
  {doc&&!disabled&&<ReportExportPreview document={doc}/>}
  {!complete&&<p>حمّل كل النقلات لتفعيل الفلاتر والتصدير؛ الحساب الكامل ظاهر أعلاه.</p>}
  {complete&&<p>المطابق: {rows.length} نقلة — {new Set(rows.map(r=>r.vehicle_id)).size} عربية — {days.length} يوم.
   صافي الشغل المحدد: <ContractorMoney value={rows.reduce((n,r)=>n+BigInt(r.signed_delta_piastres),0n).toString()}/> — ليس رصيد الدين.</p>}

  {days.map(day=>{const group=rows.filter(r=>r.trip_date===day);return <details className={styles.advanced} key={day} open>
    <summary>{day} — {group.length} نقلة — {new Set(group.map(r=>r.vehicle_id)).size} عربية</summary>
    {group.map(row=><article className={styles.record} data-tone={BigInt(row.signed_delta_piastres)>0n?'credit':BigInt(row.signed_delta_piastres)<0n?'debit':'neutral'} key={row.id}>
     <div className={styles.recordHead}><h4>{vehicleNames.get(row.vehicle_id)??row.vehicle_id}</h4><strong className={styles.amount}>{formatPoundsForDisplay((BigInt(row.signed_delta_piastres)<0n?-BigInt(row.signed_delta_piastres):BigInt(row.signed_delta_piastres)).toString())} ج.م</strong></div>
     <p className={styles.route}>{row.origin||'غير محدد'} ← {row.destination||'غير محدد'}</p>
     <div className={styles.facts}><span>{scaledIntegerToDecimal(row.weight_milli_tonnes,3)} طن</span><span>{row.direction==='AHMED_SUPPLIES'?'شغل لأحمد أبو علي':'شغل على أحمد أبو علي'}</span></div>
     <details><summary>الرصيد والملاحظات ومرجع النقلة</summary><p>رصيد الحساب الكامل بعد النقلة: <ContractorMoney value={row.running_balance_piastres}/></p><p>{row.notes||'لا توجد ملاحظات.'}</p><small>{row.id}</small></details>
    </article>)}
   </details>;})}
  {complete&&<section className={styles.endTotals}><h3>إجمالي الشغل المطابق</h3><p>{rows.length} نقلة · {scaledIntegerToDecimal(rows.reduce((n,r)=>n+BigInt(r.weight_milli_tonnes),0n).toString(),3)} طن · {new Set(rows.map(r=>r.vehicle_id)).size} عربية</p><p>صافي الحركات: <ContractorMoney value={rows.reduce((n,r)=>n+BigInt(r.signed_delta_piastres),0n).toString()}/></p><p className={styles.note}>هذا مجموع الشغل المفلتر؛ رصيد الحساب الكامل وصاحب الحق موضحان أعلى الكشف.</p></section>}
  {doc&&!disabled&&<ReportExportActions document={doc} fileNameBase={`contractor-${report.date_from}-${report.date_to}`}/>}
 </>;
}
