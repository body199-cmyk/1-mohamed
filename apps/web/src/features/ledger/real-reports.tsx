"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { postLedgerRead } from "../../lib/ledger/transport";
import { piastresToPounds } from "../../lib/ledger/amounts";
import type { LedgerEntities, LedgerWrite } from "./workspace-data";
import { projectLedgerReport } from "./report-presentation";
import { ReportExportActions } from "../reports/report-export-actions";
import { buildRealOperationalDocument, isFullOperationalReport } from "./real-operational-document";
import { assertReportPage, mergeReportPage, type ReportPage } from "./report-snapshot";
import { RecordActions } from "./record-actions";
import { WorkTotals } from "./work-totals";
type Report = ReportPage & { totals?: Record<string,string>; period_opening_piastres?: string;
  period_closing_piastres?: string; current_cash_balance_piastres?: string; cash_balance_piastres?: string };
type ReportType = "trips.list" | "payments.list";
const EMPTY_ROWS: Record<string, unknown>[] = [];
const asText = (value: unknown) => typeof value === "string" ? value : value == null ? "" : String(value);
const field: React.CSSProperties = { display: "block", padding: 10, width: "100%", maxWidth: 460, margin: "6px 0 12px" };
const section: React.CSSProperties = { border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, marginBottom: 20 };
export function RealReports({ contractors, vehicles, accounts, disabled, revision, write }: LedgerEntities & {disabled:boolean; revision:number; write:LedgerWrite}) {
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const reportQuery = useRef<{ type: ReportType; payload: Record<string, unknown> } | null>(null);
  const [reportType, setReportType] = useState<ReportType>("trips.list");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportAccount, setReportAccount] = useState("");
  const [reportVehicle, setReportVehicle] = useState("");
  const [reportCounterparty, setReportCounterparty] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const active = useRef(0);
  useEffect(() => { active.current++; setReport(null); reportQuery.current = null; },[revision]);
  async function readReport(event: FormEvent) {
    event.preventDefault();
    if (busy || disabled || !reportFrom || !reportTo) return;
    const token = active.current;
    setBusy(true); setNotice(""); setReport(null);
    reportQuery.current = null;
    try {
      let payload: Record<string, unknown> = { date_from: reportFrom, date_to: reportTo,
        include_cancelled: includeCancelled, limit: 200 };
      if (reportType === "trips.list") {
        if (reportVehicle) payload.vehicle_id = reportVehicle;
        if (reportCounterparty) payload.counterparty_contractor_id = reportCounterparty;
      }
      if (reportType === "payments.list") {
        const [vehicle_id, responsible_contractor_id] = reportAccount.split("|");
        if (!vehicle_id || !responsible_contractor_id) {
          setNotice("حدد حساب العربية أولًا."); return;
        }
        payload = { ...payload, vehicle_id, responsible_contractor_id };
      }
      const response = await postLedgerRead<Report>(reportType, payload);
      if (token !== active.current) return;
      if (!response.ok) { setReport(null); setNotice(response.error); return; }
      assertReportPage(response.data);
      reportQuery.current = { type: reportType, payload };
      setReport(response.data);
    } catch (error) { setNotice(error instanceof Error ? error.message : "تعذّر تحميل التقرير من الخادم."); }
    finally { setBusy(false); }
  }

  async function loadMoreRows() {
    const query = reportQuery.current;
    if (disabled || busy || !report || !report.next_cursor || !query) return;
    const token = active.current;
    setBusy(true); setNotice("");
    try {
      const response = await postLedgerRead<Report>(query.type, {
        ...query.payload, cursor: report.next_cursor, snapshot: report.snapshot
      });
      if (token !== active.current) return;
      if (!response.ok) { setReport(null); setNotice(response.error); return; }
      if (!Array.isArray(response.data?.rows)) {
        setNotice("صفحة التقرير غير صالحة من الخادم."); return;
      }
      setReport(mergeReportPage(report, response.data));
    } catch (error) { setReport(null); setNotice(error instanceof Error ? error.message : "تعذر تحميل الصفحة التالية. أعد تحميل التقرير."); }
    finally { setBusy(false); }
  }

  const projected = report ? projectLedgerReport(reportType, report.rows, {
    vehicles: new Map(vehicles.map(v => [v.id, v.plate_number])),
    contractors: new Map(contractors.map(c => [c.id, c.name]))
  }) : null;
  const fullExportDocument = (() => {
    if (!report || !isFullOperationalReport(report)) return null;
    try {
      return buildRealOperationalDocument(reportType, report, {
        vehicles: new Map(vehicles.map(v => [v.id, v.plate_number])),
        contractors: new Map(contractors.map(c => [c.id, c.name]))
      }, reportFrom, reportTo, new Intl.DateTimeFormat("ar-EG", {
        timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short"
      }).format(new Date()), {
        vehicle: reportType === "trips.list" && reportVehicle ?
          vehicles.find(v => v.id === reportVehicle)?.plate_number ?? reportVehicle : undefined,
        contractor: reportType === "trips.list" && reportCounterparty ?
          contractors.find(c => c.id === reportCounterparty)?.name ?? reportCounterparty : undefined
      });
    } catch { return null; }
  })();

  return <fieldset disabled={disabled} style={{border:0,padding:0,minWidth:0}}>
    {notice && <p role="alert">{notice}</p>}
    <section style={section}>
      <h2>النقلات والتقرير اليومي والمدفوعات</h2>
      <form onSubmit={readReport}>
        <label htmlFor="report-type">التقرير</label>
        <select id="report-type" style={field} value={reportType}
          onChange={e => { setReportType(e.target.value as ReportType); setReport(null); }} disabled={busy}>
          <option value="trips.list">النقلات</option>
          <option value="payments.list">مدفوعات وحساب نقدية عربية</option>
        </select>
        {reportType === "trips.list" && <>
          <label htmlFor="report-trip-vehicle">العربية (اختياري)</label>
          <select id="report-trip-vehicle" style={field} value={reportVehicle}
            onChange={e => { setReportVehicle(e.target.value); setReport(null); }} disabled={busy}>
            <option value="">كل العربيات</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
          </select>
          <label htmlFor="report-trip-contractor">المقاول الطرف (اختياري)</label>
          <select id="report-trip-contractor" style={field} value={reportCounterparty}
            onChange={e => { setReportCounterparty(e.target.value); setReport(null); }} disabled={busy}>
            <option value="">كل المقاولين</option>
            {contractors.filter(c => !c.is_primary).map(c =>
              <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </>}
        {reportType === "payments.list" && <>
          <label htmlFor="report-account">حساب العربية والمقاول</label>
          <select id="report-account" style={field} required value={reportAccount}
            onChange={e => { setReportAccount(e.target.value); setReport(null); }} disabled={busy}>
            <option value="">اختر الحساب</option>
            {accounts.map(a => <option key={a.vehicle_id + "|" + a.contractor_id}
              value={a.vehicle_id + "|" + a.contractor_id}>
              {vehicles.find(v => v.id === a.vehicle_id)?.plate_number ?? a.vehicle_id}
              {" — "}{contractors.find(c => c.id === a.contractor_id)?.name ?? a.contractor_id}
            </option>)}
          </select>
        </>}
        <label htmlFor="report-from">من تاريخ</label>
        <input id="report-from" style={field} type="date" required value={reportFrom}
          onChange={e => { setReportFrom(e.target.value); setReport(null); }} disabled={busy} />
        <label htmlFor="report-to">إلى تاريخ</label>
        <input id="report-to" style={field} type="date" required value={reportTo}
          onChange={e => { setReportTo(e.target.value); setReport(null); }} disabled={busy} />
        <label style={{ display: "block", marginBottom: 12 }}>
          <input type="checkbox" checked={includeCancelled} onChange={e => { setIncludeCancelled(e.target.checked); setReport(null); }} disabled={busy} />
          {" "}عرض القيود الملغاة أيضًا
        </label>
        <button disabled={busy} type="submit">تحميل التقرير</button>
      </form>
      {report && <>
        {reportType === "trips.list" && report.totals && <WorkTotals totals={report.totals} />}

        <p>عدد السجلات: {report.total_count ?? report.rows?.length ?? 0}</p>
        {typeof report.period_opening_piastres === "string" && <p>
          أول الفترة: {piastresToPounds(report.period_opening_piastres)} جنيه
        </p>}
        {typeof report.period_closing_piastres === "string" && <p>
          آخر الفترة: {piastresToPounds(report.period_closing_piastres)} جنيه
        </p>}
        {typeof report.current_cash_balance_piastres === "string" && <p>
          الرصيد الحالي: {piastresToPounds(report.current_cash_balance_piastres)} جنيه
        </p>}
        <p>تم تحميل {report.rows?.length ?? 0} سجل من أصل {report.total_count ?? "غير معروف"}.
          التصدير الكامل متاح بعد تحميل كل السجلات.</p>
        {report.next_cursor && <button type="button"
          disabled={busy} onClick={() => void loadMoreRows()}>
          {busy ? "جارٍ تحميل المزيد..." : "تحميل 200 سجل إضافي"}
        </button>}
        {!isFullOperationalReport(report) && <p role="status">
          الصيغ الكاملة (PDF/Excel/PNG/طباعة) تتطلب تحميل كل الصفحات أولًا.
        </p>}
        {!busy && fullExportDocument && <div style={{ marginTop: 16 }}>
          <h3>تصدير التقرير الكامل بخمس صيغ ومشاركة الصورة</h3>
          <ReportExportActions document={fullExportDocument}
            fileNameBase={`real-${reportType.replace(".", "-")}-${reportFrom}-${reportTo}`} />
        </div>}
        {isFullOperationalReport(report) && !fullExportDocument &&
          <p role="alert">بيانات التقرير غير متسقة؛ تم إيقاف التصدير الكامل لحمايتك.</p>}
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ borderCollapse: "collapse", minWidth: 600 }}>
            <thead><tr>{projected?.headers.map((header, index) =>
              <th key={index} scope="col" style={{ padding: 8, borderBottom: "1px solid #ccc" }}>{header}</th>)}</tr></thead>
            <tbody>{projected?.rows.map((row, index) => <tr key={asText(report.rows[index]?.id) || index}>
              {row.map((value, column) =>
                <td key={column} style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
                  {value}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </section>

    <RecordActions contractors={contractors} vehicles={vehicles} mode="financial"
      reportType={reportType} reportRows={report?.rows ?? EMPTY_ROWS} busy={busy || disabled} write={write} />
  </fieldset>;
}
