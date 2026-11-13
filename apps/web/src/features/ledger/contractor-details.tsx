"use client";
import {useState} from 'react';
import {ContractorMoney} from '../contractor-statements/contractor-money';
import {ReportExportActions} from '../reports/report-export-actions';
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
  <fieldset disabled={!complete||disabled} style={{border:0,minWidth:0}}><legend>فلترة تفاصيل الشغل</legend>
    {(Object.keys(labels) as (keyof StatementFilters)[]).map(key=><label key={key} style={{display:'inline-block',margin:8}}>
     {labels[key]}<select aria-label={'فلتر '+labels[key]} value={filters[key]} onChange={e=>setFilters(f=>({...f,[key]:e.target.value}))}>
      <option value="">الكل</option>{choices[key].map(value=><option key={value} value={value}>
       {key==='vehicle'?vehicleNames.get(value)??value:key==='direction'?(value==='AHMED_SUPPLIES'?'شغل أحمد':'شغل المقاول'):value}</option>)}
     </select></label>)}
  </fieldset>
  {!complete&&<p>حمّل كل النقلات لتفعيل الفلاتر والتصدير؛ الحساب الكامل ظاهر أعلاه.</p>}
  {complete&&<p>المطابق: {rows.length} نقلة — {new Set(rows.map(r=>r.vehicle_id)).size} عربية — {days.length} يوم.
   صافي الشغل المحدد: <ContractorMoney value={rows.reduce((n,r)=>n+BigInt(r.signed_delta_piastres),0n).toString()}/> — ليس رصيد الدين.</p>}
  {doc&&!disabled&&<ReportExportActions document={doc} fileNameBase={`contractor-${report.date_from}-${report.date_to}`}/>}
  {days.map(day=>{const group=rows.filter(r=>r.trip_date===day);return <details key={day}>
    <summary>{day} — {group.length} نقلة — {new Set(group.map(r=>r.vehicle_id)).size} عربية</summary>
    {group.map(row=><article key={row.id} style={{padding:12,borderBottom:'1px solid var(--border-color)'}}>
     <strong>{vehicleNames.get(row.vehicle_id)??row.vehicle_id}</strong> — {[row.origin,row.destination].filter(Boolean).join(' ← ')}
     <p>{row.direction==='AHMED_SUPPLIES'?'شغل أحمد':'شغل المقاول'}: <ContractorMoney value={row.signed_delta_piastres}/></p>
     <p>رصيد الحساب الكامل بعد النقلة: <ContractorMoney value={row.running_balance_piastres}/></p>
     <small>{row.id}{row.notes?' — '+row.notes:''}</small>
    </article>)}
   </details>;})}
 </>;
}
