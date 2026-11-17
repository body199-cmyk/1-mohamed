import {displayLedgerField,projectLedgerReport,type LedgerLookups,type LedgerReportType} from './report-presentation';
import styles from './daily-work.module.css';

export function OperationalRows({type,rows,lookups}:{type:LedgerReportType;rows:Record<string,unknown>[];lookups:LedgerLookups}){
 const projected=projectLedgerReport(type,rows,lookups);
 const text=(key:string,row:Record<string,unknown>)=>displayLedgerField(key,row[key],lookups);
 return <>
  <ul className={styles.records} aria-label="ملخص سجلات التقرير">{rows.map((row,rowIndex)=><li key={String(row.id)}>
   <div className={styles.recordHeading}><span>{text('vehicle_id',row)}</span>
    <span>{text(type==='trips.list'?'contractor_total_piastres':'amount_piastres',row)} ج.م</span></div>
   <div className={styles.recordMeta}><span>{text(type==='trips.list'?'trip_date':'payment_date',row)}</span>
    <span>{text(type==='trips.list'?'counterparty_contractor_id':'responsible_contractor_id',row)}</span>
    <span>{type==='trips.list'?text('weight_milli_tonnes',row)+' طن':String(row.id)}</span>
    <span>{text('is_cancelled',row)}</span></div>
   <details><summary>كل تفاصيل {type==='trips.list'?'النقلة':'الدفعة'} {String(row.id)}</summary>
    <dl className={styles.recordDetails}>{projected.headers.map((label,i)=><div key={label}><dt>{label}</dt><dd>{projected.rows[rowIndex][i]||'—'}</dd></div>)}</dl>
   </details>
  </li>)}</ul>
  <details><summary>عرض الجدول التفصيلي الكامل</summary>
   <div style={{overflowX:'auto',marginTop:12}}><table style={{borderCollapse:'collapse',minWidth:600}}>
    <thead><tr>{projected.headers.map(header=><th key={header} scope="col">{header}</th>)}</tr></thead>
    <tbody>{projected.rows.map((row,index)=><tr key={String(rows[index].id)}>{row.map((value,column)=><td key={column}>{value}</td>)}</tr>)}</tbody>
   </table></div>
  </details>
 </>;
}
