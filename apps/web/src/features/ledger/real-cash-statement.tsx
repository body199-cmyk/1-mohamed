"use client";
import ui from "./workspace-ui.module.css";
import { useEffect,useRef,useState,type FormEvent } from 'react';
import type { LedgerEntities } from './workspace-data';
import { postLedgerRead } from '../../lib/ledger/transport';
import styles from './statement-design.module.css';
import {loadVehicleTrips,type VehicleTrip} from './vehicle-statement-data';
import {VehicleStatementContent} from './vehicle-statement-content';
import {vehicleStatementDocument} from './vehicle-statement-document';
import { mergeReportPage } from './report-snapshot';
import { verifyCashReport,type CashReport } from './cash-statement-document';
import { ReportHistoryScope } from "../reports/report-period";
import { ReportExportActions } from '../reports/report-export-actions';

export function RealCashStatement({contractors,vehicles,accounts,disabled,revision,onRegisterPayment}:LedgerEntities&{disabled:boolean;revision:number;onRegisterPayment:(account:string)=>void}) {
  const [allHistory,setAllHistory]=useState(false);
  const [account,setAccount]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');
  const [report,setReport]=useState<CashReport|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [trips,setTrips]=useState<Map<string,VehicleTrip>>(new Map());const [filtersOpen,setFiltersOpen]=useState(true);
  useEffect(()=>{if(report)document.getElementById('vehicle-statement-heading')?.focus();},[report]);
  const active=useRef(0);const query=useRef<Record<string,unknown>|null>(null);
  function reset(){active.current++;setReport(null);query.current=null;setError('');}
  useEffect(()=>{reset();},[revision]);
  async function load(e?:FormEvent){
    e?.preventDefault();if(busy||disabled)return;
    const more=!e;const prior=more?report:null;
    if(more&&!prior?.next_cursor)return;
    const [vehicle_id,responsible_contractor_id]=account.split('|');
    if(!vehicle_id||!responsible_contractor_id||(!allHistory&&(!from||!to||from>to))){setError('حدد الحساب وفترة صحيحة.');return;}
    const payload=more?query.current!:{vehicle_id,responsible_contractor_id,...(allHistory?{all_history:true}:{date_from:from,date_to:to}),limit:200};
    const token=active.current;setBusy(true);setError('');if(!more)setReport(null);
    try{
      const result=await postLedgerRead<CashReport>('cash.statement',{...payload,...(prior?{cursor:prior.next_cursor,snapshot:prior.snapshot}:{})});
      if(token!==active.current)return;
      if(!result.ok)throw new Error(result.error);
      const combined=prior?mergeReportPage(prior,result.data):result.data;
      verifyCashReport(combined);const details=await loadVehicleTrips(combined);if(token!==active.current)return;setTrips(details);setReport(combined);setFiltersOpen(false);query.current=payload;
    }catch(cause){if(token===active.current){setReport(null);setError(cause instanceof Error?cause.message:'تعذر تحميل الكشف.');}}
    finally{setBusy(false);}
  }
  const vehicle=vehicles.find(v=>v.id===report?.vehicle_id)?.plate_number??report?.vehicle_id??'';
  const contractor=contractors.find(c=>c.id===report?.responsible_contractor_id)?.name??report?.responsible_contractor_id??'';
  const doc=report&&!report.next_cursor?vehicleStatementDocument(report,vehicle,contractor,trips):null;
  return <section className={ui.surface+' '+styles.report} aria-label="كشف نقدية العربية">
    <header className={ui.sectionHeading}>
      <div><h2>كشف حساب عربية</h2><p>اختار العربية والمقاول المسؤول والفترة لعرض النقلات ومستحق الشغل والدفعات والمتبقي. لكل مقاول مسؤول حساب مستقل لنفس العربية.</p></div>
      <button type="button" onClick={() => onRegisterPayment(account)} disabled={disabled}>تسجيل دفعة</button>
    </header>
    <details className={styles.filterDisclosure} open={!report||filtersOpen} onToggle={e=>{if(report)setFiltersOpen(e.currentTarget.open);}}><summary>{report?'تغيير العربية أو فترة الكشف':'اختيار العربية وفترة الكشف'}</summary>
    <form className={ui.form} onSubmit={load}>
      <div className={ui.fieldGroup}><label htmlFor="cash-account">العربية — المقاول المسؤول</label><select id="cash-account" required value={account} className={ui.control} disabled={busy||disabled}
        onChange={e=>{setAccount(e.target.value);reset();}}><option value="">اختر الحساب</option>
        {accounts.map(a=><option key={a.vehicle_id+'|'+a.contractor_id} value={a.vehicle_id+'|'+a.contractor_id}>
          {vehicles.find(v=>v.id===a.vehicle_id)?.plate_number??a.vehicle_id} — {contractors.find(c=>c.id===a.contractor_id)?.name??a.contractor_id}
        </option>)}</select></div>
      <ReportHistoryScope checked={allHistory} disabled={busy||disabled} onChange={value=>{setAllHistory(value);reset();}}/>
      <div className={ui.fieldGroup}><label htmlFor="cash-from">من تاريخ</label><input id="cash-from" type="date" required={!allHistory} value={from} className={ui.control} disabled={busy||disabled||allHistory} onChange={e=>{setFrom(e.target.value);reset();}}/></div>
      <div className={ui.fieldGroup}><label htmlFor="cash-to">إلى تاريخ</label><input id="cash-to" type="date" required={!allHistory} value={to} className={ui.control} disabled={busy||disabled||allHistory} onChange={e=>{setTo(e.target.value);reset();}}/></div>
      <div className={ui.actions}><button disabled={busy||disabled}>عرض كشف النقدية</button></div>
    </form></details>
    {error&&<p role="alert">{error}</p>}
    {report&&<>
      {allHistory&&<p>كل الحساب من البداية: {report.date_from} — {report.date_to}</p>}
      <VehicleStatementContent report={report} trips={trips} vehicle={vehicle} contractor={contractor}/>
      <p role="status">تم تحميل {report.rows.length} من {report.total_count} حركة.</p>
      {report.next_cursor&&<button disabled={busy||disabled} onClick={()=>void load()}>تحميل المزيد</button>}
      {doc&&!busy&&!disabled&&<ReportExportActions document={doc} fileNameBase={`vehicle-cash-${report.date_from}-${report.date_to}`}/>}
    </>}
  </section>;
}

