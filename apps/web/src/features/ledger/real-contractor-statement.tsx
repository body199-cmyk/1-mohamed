"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { postLedgerRead } from "../../lib/ledger/transport";
import { ContractorDetails } from "./contractor-details";
import { ContractorMoney } from "../contractor-statements/contractor-money";
import { piastresToPounds } from "../../lib/ledger/amounts";
import {
  type LiveStatementReport, assertSameStatementSnapshot,
  verifyLiveStatement
} from "./contractor-statement-document";

type Contractor = { id: string; name: string; is_primary: boolean; is_archived: boolean };
type Vehicle = { id: string; plate_number: string };
type Props = { contractors: Contractor[]; vehicles: Vehicle[]; revision: number; disabled: boolean };
const field: React.CSSProperties = {
  display: "block", padding: 10, width: "100%", maxWidth: 460, margin: "6px 0 12px"
};
const section: React.CSSProperties = {
  border: "1px solid #d0d7e2", borderRadius: 12, padding: 16, marginBottom: 20
};
const money = (input: string) => piastresToPounds(input) + " ج.م";
const signed = (input: string) => (BigInt(input) > 0n ? "+" : "") + money(input);

export function RealContractorStatement({ contractors, vehicles, revision, disabled }: Props) {
  const [contractorId, setContractorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<LiveStatementReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(0);
  const query = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    active.current += 1;
    query.current = null;
    setReport(null);
  }, [revision]);

  const name = contractors.find(c => c.id === contractorId)?.name ?? contractorId;
  const complete = !!report && !report.next_cursor &&
    BigInt(report.total_count) === BigInt(report.rows.length);
  const vehicleNames = new Map(vehicles.map(v => [v.id, v.plate_number]));

  function reset() {
    active.current += 1;
    query.current = null;
    setReport(null); setError("");
  }

  async function load(event: FormEvent) {
    event.preventDefault();
    if (disabled || busy || !contractorId || !from || !to) return;
    reset();
    if (from > to) { setError("تاريخ البداية بعد تاريخ النهاية."); return; }
    const token = active.current;
    const payload = { counterparty_contractor_id: contractorId,
      date_from: from, date_to: to, limit: 200 };
    setBusy(true);
    try {
      const result = await postLedgerRead<LiveStatementReport>("contractor.statement", payload);
      if (token !== active.current) return;
      if (!result.ok) throw new Error(result.error);
      verifyLiveStatement(result.data);
      query.current = payload;
      setReport(result.data);
    } catch (cause) {
      if (token === active.current) setError(cause instanceof Error ? cause.message : "تعذّر تحميل الكشف.");
    } finally { setBusy(false); }
  }

  async function more() {
    if (disabled || busy || !report?.next_cursor || !query.current) return;
    const token = active.current;
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
    } finally { setBusy(false); }
  }

  return <section style={section} aria-label="كشف حساب المقاول الحقيقي">
    <h2>كشف حساب المقاول — بيانات محفوظة</h2>
    <p>الموجب لصالح أحمد، والسالب لصالح المقاول. النقدية المدفوعة للعربية لا تدخل في فرق شغل المقاول.</p>
    <form onSubmit={load}>
      <label htmlFor="real-statement-contractor">المقاول</label>
      <select id="real-statement-contractor" style={field} required value={contractorId}
        onChange={e => { setContractorId(e.target.value); reset(); }} disabled={busy || disabled}>
        <option value="">اختر المقاول</option>
        {contractors.filter(c => !c.is_primary).map(c =>
          <option key={c.id} value={c.id}>{c.name}{c.is_archived ? " (مؤرشف)" : ""}</option>)}
      </select>
      <label htmlFor="real-statement-from">من تاريخ</label>
      <input id="real-statement-from" type="date" style={field} required value={from}
        onChange={e => { setFrom(e.target.value); reset(); }} disabled={busy || disabled} />
      <label htmlFor="real-statement-to">إلى تاريخ</label>
      <input id="real-statement-to" type="date" style={field} required value={to}
        onChange={e => { setTo(e.target.value); reset(); }} disabled={busy || disabled} />
      <button type="submit" disabled={busy || disabled}>عرض كشف الحساب</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {report && <>
      <h3>حساب {name}</h3>
      <p>رصيد أول الفترة: <ContractorMoney value={report.opening_balance_piastres}/></p>
      <p>شغل أحمد: <strong>+{money(report.ahmed_work_piastres)}</strong></p>
      <p>شغل المقاول: <strong>-{money(report.counterparty_work_piastres)}</strong></p>
      <p>رصيد آخر الفترة: <ContractorMoney value={report.closing_balance_piastres}/></p>
      <p>{report.beneficiary === "AHMED" ? "المبلغ لصالح أحمد" :
        report.beneficiary === "COUNTERPARTY" ? "المبلغ لصالح " + name : "الحساب متعادل"}</p>
      <p>تم تحميل {report.rows.length} من أصل {report.total_count} نقلة.</p>
      {report.next_cursor && <button type="button" onClick={() => void more()} disabled={busy || disabled}>
        {busy ? "جارٍ التحميل..." : "تحميل 200 نقلة إضافية"}
      </button>}
      {!complete && <p role="status">التصدير متوقف لحين تحميل كل النقلات، حتى لا تستلم كشفًا ناقصًا.</p>}
      <ContractorDetails key={report.snapshot + ":" + report.date_from + ":" + contractorId}
        report={report} name={name} vehicleNames={vehicleNames} disabled={busy || disabled}/>

    </>}
  </section>;
}
