"use client";
import ui from "./workspace-ui.module.css";
import styles from "./statement-design.module.css";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { postLedgerRead } from "../../lib/ledger/transport";
import { ReportHistoryScope } from "../reports/report-period";
import { ContractorDetails } from "./contractor-details";
import { ContractorMoney } from "../contractor-statements/contractor-money";
import { formatPoundsForDisplay,scaledIntegerToDecimal } from "../../lib/ledger/amounts";
import {
  type LiveStatementReport, assertSameStatementSnapshot,
  verifyLiveStatement
} from "./contractor-statement-document";

type Contractor = { id: string; name: string; is_primary: boolean; is_archived: boolean };
type Vehicle = { id: string; plate_number: string };
type Props = { contractors: Contractor[]; vehicles: Vehicle[]; revision: number; disabled: boolean };


const money = (input: string) => formatPoundsForDisplay(input) + " ج.م";
const signed = (input: string) => (BigInt(input) > 0n ? "+" : "") + money(input);

export function RealContractorStatement({ contractors, vehicles, revision, disabled, onRegisterWork }: Props & { onRegisterWork: (contractorId: string) => void }) {
  const [contractorId, setContractorId] = useState("");
  const [filtersOpen,setFiltersOpen]=useState(true);
  const [allHistory,setAllHistory] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<LiveStatementReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(()=>{if(report)document.getElementById('contractor-statement-heading')?.focus();},[report]);
  const active = useRef(0);
  const query = useRef<Record<string, unknown> | null>(null);

  const name = contractors.find(c => c.id === contractorId)?.name ?? contractorId;
  const complete = !!report && !report.next_cursor &&
    BigInt(report.total_count) === BigInt(report.rows.length);
  const vehicleNames = new Map(vehicles.map(v => [v.id, v.plate_number]));

  const reset = useCallback(() => {
    active.current += 1;
    query.current = null;
    setReport(null);
    setError("");
    setBusy(false);
  }, []);

  useEffect(() => {
    reset();
    return () => { active.current += 1; };
  }, [revision, reset]);

  async function load(event: FormEvent) {
    event.preventDefault();
    if (disabled || busy || !contractorId || (!allHistory && (!from || !to))) return;
    reset();
    if (!allHistory && from > to) { setError("تاريخ البداية بعد تاريخ النهاية."); return; }
    const token = ++active.current;
    const payload = { counterparty_contractor_id: contractorId,
      ...(allHistory?{all_history:true}:{date_from:from,date_to:to}), limit: 200 };
    setBusy(true);
    try {
      const result = await postLedgerRead<LiveStatementReport>("contractor.statement", payload);
      if (token !== active.current) return;
      if (!result.ok) throw new Error(result.error);
      verifyLiveStatement(result.data);
      query.current = payload;
      setReport(result.data);setFiltersOpen(false);
    } catch (cause) {
      if (token === active.current) setError(cause instanceof Error ? cause.message : "تعذّر تحميل الكشف.");
    } finally { if (token === active.current) setBusy(false); }
  }

  async function more() {
    if (disabled || busy || !report?.next_cursor || !query.current) return;
    const token = ++active.current;
    setBusy(true); setError("");
    try {
      const result = await postLedgerRead<LiveStatementReport>("contractor.statement", {
        ...query.current, cursor: report.next_cursor, snapshot: report.snapshot
      });
      if (token !== active.current) return;
      if (!result.ok) throw new Error(result.error);
      verifyLiveStatement(result.data);
      assertSameStatementSnapshot(report, result.data);
      const seen = new Set(report.rows.map(r => r.id));
      if (result.data.rows.some(r=>seen.has(r.id))) throw new Error("تكررت سجلات الكشف؛ أعد تحميله.");
      const additional = result.data.rows;
      if (result.data.next_cursor &&
          result.data.next_cursor.date === report.next_cursor.date &&
          result.data.next_cursor.id === report.next_cursor.id) {
        throw new Error("مؤشر الصفحة لم يتغير؛ أوقفنا القراءة منعًا للتكرار.");
      }
      const combined: LiveStatementReport = {
        ...report, rows: [...report.rows, ...additional], next_cursor: result.data.next_cursor
      };
      verifyLiveStatement(combined);
      setReport(combined);
    } catch (cause) {
      if (token === active.current) { setReport(null); setError(cause instanceof Error ? cause.message : "تعذّر تحميل المزيد."); }
    } finally { if (token === active.current) setBusy(false); }
  }

  return <section className={ui.surface+" "+styles.report} aria-label="كشف حساب المقاول الحقيقي">
    <header className={ui.sectionHeading}>
      <div><h2>كشف شغل المقاول</h2>
      <p>الموجب لصالح أحمد، والسالب لصالح المقاول. النقدية المدفوعة للعربية لا تدخل في فرق شغل المقاول.</p></div>
      <button type="button" onClick={() => onRegisterWork(contractorId)} disabled={disabled}>تسجيل شغل جديد</button>
    </header>
    <details className={styles.filterDisclosure} open={!report||filtersOpen} onToggle={e=>{if(report)setFiltersOpen(e.currentTarget.open);}}><summary>{report?'تغيير المقاول أو فترة الكشف':'اختيار المقاول وفترة الكشف'}</summary>
    <form className={ui.form} onSubmit={load}>
      <div className={ui.fieldGroup}><label htmlFor="real-statement-contractor">المقاول</label>
      <select id="real-statement-contractor" className={ui.control} required value={contractorId}
        onChange={e => { setContractorId(e.target.value); reset(); }} disabled={busy || disabled}>
        <option value="">اختر المقاول</option>
        {contractors.filter(c => !c.is_primary).map(c =>
          <option key={c.id} value={c.id}>{c.name}{c.is_archived ? " (مؤرشف)" : ""}</option>)}
      </select></div>
      <ReportHistoryScope checked={allHistory} disabled={busy || disabled} onChange={value=>{setAllHistory(value);reset();}}/>
      <div className={ui.fieldGroup}><label htmlFor="real-statement-from">من تاريخ</label>
      <input id="real-statement-from" type="date" className={ui.control} required={!allHistory} value={from}
        onChange={e => { setFrom(e.target.value); reset(); }} disabled={busy || disabled || allHistory} /></div>
      <div className={ui.fieldGroup}><label htmlFor="real-statement-to">إلى تاريخ</label>
      <input id="real-statement-to" type="date" className={ui.control} required={!allHistory} value={to}
        onChange={e => { setTo(e.target.value); reset(); }} disabled={busy || disabled || allHistory} /></div>
      <div className={ui.actions}><button type="submit" disabled={busy || disabled}>عرض كشف الحساب</button></div>
    </form></details>
    {error && <p role="alert">{error}</p>}
    {report && <>
      <header className={styles.identity}><div><h3 id="contractor-statement-heading" tabIndex={-1}>حساب {name}</h3><p>فرق الشغل مع أحمد أبو علي</p></div><p className={styles.period}>{report.date_from} — {report.date_to}</p></header>
      {allHistory && <p>كل الحساب من البداية: {report.date_from} — {report.date_to}</p>}
      <div className={ui.statementSummary} aria-label="ملخص حساب المقاول">
        <div className={styles.balance} data-tone={report.beneficiary==='AHMED'?'credit':report.beneficiary==='COUNTERPARTY'?'debit':'neutral'}>
          <span>رصيد آخر الفترة</span>
          <strong><bdi>{money(report.balance_magnitude_piastres)}</bdi></strong><span>{report.beneficiary==='AHMED'?`لأحمد أبو علي عند ${name}`:report.beneficiary==='COUNTERPARTY'?`على أحمد أبو علي لصالح ${name}`:'الحساب متعادل'}</span>
        </div>
        <dl className={styles.metrics}>
          <div><dt>رصيد أول الفترة</dt><dd><ContractorMoney value={report.opening_balance_piastres}/></dd></div>
          <div><dt>شغل أحمد — لصالحه</dt><dd className={styles.credit}><bdi dir="ltr">+{money(report.ahmed_work_piastres)}</bdi></dd></div>
          <div><dt>شغل المقاول — على أحمد</dt><dd className={styles.debit}><bdi dir="ltr">-{money(report.counterparty_work_piastres)}</bdi></dd></div>
        </dl>
      </div>
      <p className={ui.summaryNote}>{report.beneficiary === "AHMED" ? "المبلغ لصالح أحمد" :
        report.beneficiary === "COUNTERPARTY" ? "المبلغ لصالح " + name : "الحساب متعادل"}</p>
      {complete&&<div className={styles.counts}><span><b>{report.total_count}</b> نقلة في الكشف الكامل</span><span><b>{new Set(report.rows.map(r=>r.vehicle_id)).size}</b> عربية</span><span><b>{scaledIntegerToDecimal(report.rows.reduce((n,r)=>n+BigInt(r.weight_milli_tonnes),0n).toString(),3)}</b> طن</span></div>}
      <p className={styles.note}>دفعات العربيات لا تُخصم من حساب الشغل بين المقاولين.</p>
      <p role="status">تم تحميل {report.rows.length} من أصل {report.total_count} نقلة.</p>
      {report.next_cursor && <button type="button" onClick={() => void more()} disabled={busy || disabled}>
        {busy ? "جارٍ التحميل..." : "تحميل 200 نقلة إضافية"}
      </button>}
      {!complete && <p role="status">التصدير متوقف لحين تحميل كل النقلات، حتى لا تستلم كشفًا ناقصًا.</p>}
      <ContractorDetails key={report.snapshot + ":" + report.date_from + ":" + contractorId}
        report={report} name={name} vehicleNames={vehicleNames} disabled={busy || disabled}/>

    </>}
  </section>;
}
