"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { postLedgerRead } from "../../lib/ledger/transport";
import { piastresToPounds } from "../../lib/ledger/amounts";
import {
  type LiveStatementReport, assertSameStatementSnapshot,
  liveStatementDocument, verifyLiveStatement
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

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url; link.download = name; document.body.append(link); link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export function RealContractorStatement({ contractors, vehicles, revision, disabled }: Props) {
  const [contractorId, setContractorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<LiveStatementReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(0);
  const query = useRef<Record<string, unknown> | null>(null);
  const exportLock = useRef(false);

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
        ...query.current, cursor: report.next_cursor
      });
      if (token !== active.current) return;
      if (!result.ok) throw new Error(result.error);
      verifyLiveStatement(result.data);
      assertSameStatementSnapshot(report, result.data);
      const seen = new Set(report.rows.map(r => r.id));
      const additional = result.data.rows.filter(r => !seen.has(r.id));
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
      if (token === active.current) setError(cause instanceof Error ? cause.message : "تعذّر تحميل المزيد.");
    } finally { setBusy(false); }
  }

  async function exportAs(kind: "csv" | "xlsx" | "pdf" | "png" | "print" | "share") {
    if (!report || !complete || exportLock.current) return;
    exportLock.current = true; setExportBusy(true); setError("");
    // Browser popup must be opened in the original user gesture.
    const preview = kind === "print" ? window.open("", "_blank") : null;
    try {
      if (kind === "print" && !preview) throw new Error("اسمح بفتح نافذة الطباعة ثم حاول مجددًا.");
      const label = new Intl.DateTimeFormat("ar-EG", {
        timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short"
      }).format(new Date());
      const doc = liveStatementDocument(report, name, label);
      const renderer = await import("@ledger/statement-export");
      const prefix = "contractor-statement-" + report.date_from + "-" + report.date_to;
      if (kind === "csv") {
        download(new Blob([renderer.renderContractorStatementCsv(doc)], {
          type: "text/csv;charset=utf-8"
        }), prefix + ".csv");
      } else if (kind === "xlsx") {
        download(renderer.renderContractorStatementXlsx(doc), prefix + ".xlsx");
      } else if (kind === "pdf") {
        download(await renderer.renderContractorStatementPdf(doc), prefix + ".pdf");
      } else if (kind === "png" || kind === "share") {
        const blob = await renderer.renderContractorStatementPng(doc);
        if (kind === "share") {
          const file = new File([blob], prefix + ".png", { type: "image/png" });
          if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: "كشف حساب " + name });
          } else {
            download(blob, prefix + ".png");
            setError("المشاركة المباشرة غير مدعومة؛ تم تنزيل صورة الكشف لمشاركتها.");
          }
        } else download(blob, prefix + ".png");
      } else if (preview) {
        preview.document.open();
        preview.document.write(renderer.renderContractorStatementHtml(doc));
        preview.document.close();
        const css = preview.document.createElement("link");
        css.rel = "stylesheet"; css.href = new URL("/fonts/cairo.css", window.location.origin).href;
        preview.document.head.append(css);
        await preview.document.fonts.ready;
        preview.opener = null; preview.focus(); preview.print();
      }
    } catch (cause) {
      preview?.close();
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(cause instanceof Error ? cause.message : "تعذر التصدير.");
      }
    } finally {
      exportLock.current = false; setExportBusy(false);
    }
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
      <p>رصيد أول الفترة: <strong>{signed(report.opening_balance_piastres)}</strong></p>
      <p>شغل أحمد: <strong>+{money(report.ahmed_work_piastres)}</strong></p>
      <p>شغل المقاول: <strong>-{money(report.counterparty_work_piastres)}</strong></p>
      <p>رصيد آخر الفترة: <strong>{signed(report.closing_balance_piastres)}</strong></p>
      <p>{report.beneficiary === "AHMED" ? "المبلغ لصالح أحمد" :
        report.beneficiary === "COUNTERPARTY" ? "المبلغ لصالح " + name : "الحساب متعادل"}</p>
      <p>تم تحميل {report.rows.length} من أصل {report.total_count} نقلة.</p>
      {report.next_cursor && <button type="button" onClick={() => void more()} disabled={busy || disabled}>
        {busy ? "جارٍ التحميل..." : "تحميل 200 نقلة إضافية"}
      </button>}
      {!complete && <p role="status">التصدير متوقف لحين تحميل كل النقلات، حتى لا تستلم كشفًا ناقصًا.</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        {(["csv", "xlsx", "pdf", "png", "print", "share"] as const).map(kind =>
          <button key={kind} type="button" disabled={!complete || busy || exportBusy || disabled}
            onClick={() => void exportAs(kind)}>
            {kind === "csv" ? "CSV" : kind === "xlsx" ? "Excel" : kind === "pdf" ? "PDF" :
              kind === "png" ? "صورة PNG" : kind === "print" ? "طباعة" : "مشاركة صورة"}
          </button>)}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 680, width: "100%" }}>
          <thead><tr>{["التاريخ", "العربية", "خط السير", "الاتجاه", "المبلغ", "الرصيد"].map(x =>
            <th key={x} scope="col" style={{ padding: 8, borderBottom: "1px solid #ccc" }}>{x}</th>)}</tr></thead>
          <tbody>{report.rows.map(row => <tr key={row.id}>
            <td style={{ padding: 8 }}>{row.trip_date}</td>
            <td style={{ padding: 8 }}>{vehicleNames.get(row.vehicle_id) ?? row.vehicle_id}</td>
            <td style={{ padding: 8 }}>{[row.origin, row.destination].filter(Boolean).join(" ← ")}</td>
            <td style={{ padding: 8 }}>{row.direction === "AHMED_SUPPLIES" ? "أحمد" : "المقاول"}</td>
            <td style={{ padding: 8 }}>{signed(row.signed_delta_piastres)}</td>
            <td style={{ padding: 8 }}>{signed(row.running_balance_piastres)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
