"use client";
import {useEffect,useRef,useState} from 'react';
import {postLedgerRead} from '../../lib/ledger/transport';
import {assertReportPage,mergeReportPage,type ReportPage} from './report-snapshot';
import {displayLedgerField,type LedgerLookups} from './report-presentation';
import {scaledIntegerToDecimal} from '../../lib/ledger/amounts';
import ui from './workspace-ui.module.css';
import styles from './daily-work.module.css';

export function DailyTripList({date,revision,disabled,vehicles,contractors,onReviewDay,onCountChange}:{date:string;revision:number;
 disabled:boolean;vehicles:{id:string;plate_number:string}[];contractors:{id:string;name:string}[];onReviewDay:(date:string)=>void;onCountChange:(count:string|null)=>void}){
 const [day,setDay]=useState(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 const [enabled,setEnabled]=useState(false);
 const [report,setReport]=useState<ReportPage|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [reload,setReload]=useState(0);
 const token=useRef(0);
 useEffect(()=>{if(date){setDay(date);setEnabled(true);}},[date]);
 useEffect(()=>{
  const current=++token.current;setReport(null);setError('');
  if(!enabled||!day||disabled){setBusy(false);return;}
  const controller=new AbortController();setBusy(true);
  void postLedgerRead<ReportPage>('trips.list',{date_from:day,date_to:day,include_cancelled:false,limit:50},controller.signal)
   .then(result=>{if(current!==token.current)return;if(!result.ok)throw new Error(result.error);assertReportPage(result.data);setReport(result.data);})
   .catch(cause=>{if(current===token.current&&!controller.signal.aborted)setError(cause instanceof Error?cause.message:'تعذر تحميل نقلات اليوم.');})
   .finally(()=>{if(current===token.current)setBusy(false);});
  return ()=>controller.abort();
 },[day,enabled,revision,disabled,reload]);
 async function more(){
  if(!report?.next_cursor||busy||disabled)return;
  const current=token.current;setBusy(true);setError('');
  try{
   const result=await postLedgerRead<ReportPage>('trips.list',{date_from:day,date_to:day,include_cancelled:false,
    limit:50,cursor:report.next_cursor,snapshot:report.snapshot});
   if(current!==token.current)return;
   if(!result.ok)throw new Error(result.error);
   setReport(mergeReportPage(report,result.data));
  }catch(cause){if(current===token.current){setReport(null);setError(cause instanceof Error?cause.message:'تعذر تحميل المزيد.');}}
  finally{if(current===token.current)setBusy(false);}
 }
 const lookups:LedgerLookups={vehicles:new Map(vehicles.map(v=>[v.id,v.plate_number])),contractors:new Map(contractors.map(c=>[c.id,c.name]))};
 useEffect(()=>{onCountChange(report?String(report.total_count):null);},[report,onCountChange]);
 const text=(key:string,row:Record<string,unknown>)=>{try{return displayLedgerField(key,row[key],lookups);}catch{return 'غير متاح';}};
 const visibleWeight=report?.rows.every(r=>typeof r.weight_milli_tonnes==='string'&&/^\d+$/.test(r.weight_milli_tonnes))
  ?scaledIntegerToDecimal(report.rows.reduce((total,r)=>total+BigInt(String(r.weight_milli_tonnes)),0n).toString(),3):null;
 const fullWeight=report&&!report.next_cursor;
 return <section className={ui.surface} aria-label="النقلات المسجلة في اليومية">
  <header className={styles.sectionHeader}><div><h2>المسجّل بالفعل</h2><p>نقلات محفوظة من قاعدة البيانات، مستقلة عن مسودة الإدخال.</p></div>
   {report&&<strong>{String(report.total_count)} نقلة · {new Set(report.rows.map(r=>r.vehicle_id)).size} عربية ظاهرة</strong>}
  </header>
  <div className={ui.form}><div className={ui.fieldGroup}><label htmlFor="daily-recorded-date">تاريخ النقلات المسجلة</label>
   <input id="daily-recorded-date" type="date" className={ui.control} disabled={disabled||busy} value={day} onChange={e=>{setDay(e.target.value);setEnabled(true);}}/></div>
   <div className={ui.actions}><button type="button" disabled={disabled||busy||!day} onClick={()=>{setEnabled(true);setReload(x=>x+1);}}>{busy?'جارٍ تحميل النقلات…':'عرض المسجّل لهذا اليوم'}</button></div>
  </div>
  {error&&<p role="alert">{error}</p>}
  {report&&report.rows.length===0&&<p className={styles.empty}>لا توجد نقلات محفوظة في اليوم المختار.</p>}
  {report&&report.rows.length>0&&<>
   <p>{visibleWeight!==null&&<>{fullWeight?'إجمالي الوزن':'الوزن الظاهر'}: <strong>{visibleWeight} طن</strong> — </>}تم تحميل {report.rows.length} من {String(report.total_count)} نقلة؛ تكرار نفس العربية يُحسب نقلات مستقلة.</p>
   <ul className={styles.records}>{report.rows.map(row=><li key={String(row.id)}>
    <div className={styles.recordHeading}><span>{text('vehicle_id',row)}</span><span>{text('contractor_total_piastres',row)} ج.م شغل المقاول</span></div>
    <div className={styles.recordMeta}><span>{text('counterparty_contractor_id',row)}</span><span>{text('weight_milli_tonnes',row)} طن</span><span>المصاريف: {text('expense_piastres',row)} ج.م</span><span>مستحق العربية: {text('vehicle_total_piastres',row)} ج.م</span><span>{text('origin',row)} ← {text('destination',row)}</span></div>
    <details><summary>تفاصيل النقلة {String(row.id)}</summary><div className={styles.recordDetails}>
     <p>التاريخ: {text('trip_date',row)}</p><p>الاتجاه: {text('direction',row)}</p>
     <p>سعر المقاول: {text('contractor_rate_piastres',row)} ج.م</p><p>سعر العربية: {text('vehicle_rate_piastres',row)} ج.م</p>
     <p>المصاريف: {text('expense_piastres',row)} ج.م</p><p>مستحق العربية: {text('vehicle_total_piastres',row)} ج.م</p>
     <p>المقاول المسؤول: {text('responsible_contractor_id',row)}</p><p>{text('notes',row)}</p>
    </div></details>
   </li>)}</ul>
   {report.next_cursor&&<button type="button" disabled={disabled||busy} onClick={()=>void more()}>تحميل النقلات التالية</button>}
   <button type="button" disabled={disabled||busy} onClick={()=>onReviewDay(day)}>فتح هذا اليوم في التقارير للتعديل أو الإلغاء</button>
  </>}
 </section>;
}
