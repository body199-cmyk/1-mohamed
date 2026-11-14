"use client";
import { useEffect,useRef,useState,type FormEvent } from 'react';
import type { LedgerEntities } from './workspace-data';
import { postLedgerRead } from '../../lib/ledger/transport';
import { piastresToPounds } from '../../lib/ledger/amounts';
import { mergeReportPage } from './report-snapshot';
import { cashStatementDocument,verifyCashReport,type CashReport } from './cash-statement-document';
import { ReportExportActions } from '../reports/report-export-actions';
const field:React.CSSProperties={display:'block',width:'100%',maxWidth:460,padding:10,margin:'6px 0 12px'};
export function RealCashStatement({contractors,vehicles,accounts,disabled,revision}:LedgerEntities&{disabled:boolean;revision:number}) {
  const [account,setAccount]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');
  const [report,setReport]=useState<CashReport|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const active=useRef(0);const query=useRef<Record<string,unknown>|null>(null);
  function reset(){active.current++;setReport(null);query.current=null;setError('');}
  useEffect(()=>{reset();},[revision]);
  async function load(e?:FormEvent){
    e?.preventDefault();if(busy||disabled)return;
    const more=!e;const prior=more?report:null;
    if(more&&!prior?.next_cursor)return;
    const [vehicle_id,responsible_contractor_id]=account.split('|');
    if(!vehicle_id||!responsible_contractor_id||!from||!to||from>to){setError('حدد الحساب وفترة صحيحة.');return;}
    const payload=more?query.current!:{vehicle_id,responsible_contractor_id,date_from:from,date_to:to,limit:200};
    const token=active.current;setBusy(true);setError('');if(!more)setReport(null);
    try{
      const result=await postLedgerRead<CashReport>('cash.statement',{...payload,...(prior?{cursor:prior.next_cursor,snapshot:prior.snapshot}:{})});
      if(token!==active.current)return;
      if(!result.ok)throw new Error(result.error);
      const combined=prior?mergeReportPage(prior,result.data):result.data;
      verifyCashReport(combined);setReport(combined);query.current=payload;
    }catch(cause){if(token===active.current){setReport(null);setError(cause instanceof Error?cause.message:'تعذر تحميل الكشف.');}}
    finally{setBusy(false);}
  }
  const vehicle=vehicles.find(v=>v.id===report?.vehicle_id)?.plate_number??report?.vehicle_id??'';
  const contractor=contractors.find(c=>c.id===report?.responsible_contractor_id)?.name??report?.responsible_contractor_id??'';
  const doc=report&&!report.next_cursor?cashStatementDocument(report,vehicle,contractor):null;
  return <section aria-label="كشف نقدية العربية">
    <h2>كشف حساب عربية</h2><p>اختار العربية والمقاول المسؤول والفترة لعرض النقلات ومستحق الشغل والدفعات والمتبقي. لكل مقاول مسؤول حساب مستقل لنفس العربية.</p>
    <form onSubmit={load}>
      <label htmlFor="cash-account">العربية — المقاول المسؤول</label><select id="cash-account" required value={account} style={field} disabled={busy||disabled}
        onChange={e=>{setAccount(e.target.value);reset();}}><option value="">اختر الحساب</option>
        {accounts.map(a=><option key={a.vehicle_id+'|'+a.contractor_id} value={a.vehicle_id+'|'+a.contractor_id}>
          {vehicles.find(v=>v.id===a.vehicle_id)?.plate_number??a.vehicle_id} — {contractors.find(c=>c.id===a.contractor_id)?.name??a.contractor_id}
        </option>)}</select>
      <label htmlFor="cash-from">من تاريخ</label><input id="cash-from" type="date" required value={from} style={field} disabled={busy||disabled} onChange={e=>{setFrom(e.target.value);reset();}}/>
      <label htmlFor="cash-to">إلى تاريخ</label><input id="cash-to" type="date" required value={to} style={field} disabled={busy||disabled} onChange={e=>{setTo(e.target.value);reset();}}/>
      <button disabled={busy||disabled}>عرض كشف النقدية</button>
    </form>
    {error&&<p role="alert">{error}</p>}
    {report&&<>
      <p>أول الفترة: {piastresToPounds(report.period_opening_piastres)} — مستحق الشغل: {piastresToPounds(report.work_piastres)} — المدفوع: {piastresToPounds(report.paid_piastres)}</p>
      <p>آخر الفترة: <strong>{piastresToPounds(report.period_closing_piastres)} جنيه</strong> — {BigInt(report.period_closing_piastres)<0n?'على العربية':BigInt(report.period_closing_piastres)>0n?'للعربية':'متعادل'}</p>
      <p>المتبقي الحالي: <strong>{piastresToPounds(report.current_cash_balance_piastres)} جنيه</strong> — {BigInt(report.current_cash_balance_piastres)<0n?'على العربية':BigInt(report.current_cash_balance_piastres)>0n?'للعربية':'متعادل'}. يشمل الحركات خارج الفترة المختارة.</p>
      <p>تم تحميل {report.rows.length} من {report.total_count} حركة.</p>
      {report.next_cursor&&<button disabled={busy||disabled} onClick={()=>void load()}>تحميل المزيد</button>}
      {doc&&!busy&&!disabled&&<ReportExportActions document={doc} fileNameBase={`vehicle-cash-${from}-${to}`}/>}
      <div style={{overflowX:'auto'}}><table><thead><tr>{['التاريخ','الحركة','المبلغ','الرصيد','خط السير'].map(x=><th key={x}>{x}</th>)}</tr></thead>
      <tbody>{report.rows.map(row=><tr key={String(row.movement_type)+row.id}>
        <td>{String(row.date)}</td><td>{row.movement_type==='WORK'?'شغل':'دفعة'}</td>
        <td><bdi>{piastresToPounds(String(row.signed_delta_piastres))}</bdi></td>
        <td><bdi>{piastresToPounds(String(row.running_balance_piastres))}</bdi></td>
        <td>{[row.origin,row.destination].filter(Boolean).join(' ← ')}</td>
      </tr>)}</tbody></table></div>
    </>}
  </section>;
}

