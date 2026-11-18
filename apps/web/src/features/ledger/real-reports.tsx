"use client";
import ui from "./workspace-ui.module.css";
import { useEffect, useRef, useState } from "react";
import { postLedgerRead } from "../../lib/ledger/transport";
import { formatPoundsForDisplay } from "../../lib/ledger/amounts";
import type { LedgerEntities, LedgerWrite } from "./workspace-data";
import { OperationalRows } from "./operational-rows";
import { ReportExportActions } from "../reports/report-export-actions";
import { ReportExportPreview } from "../reports/report-export-preview";
import { buildRealOperationalDocument, isFullOperationalReport } from "./real-operational-document";
import { assertReportPage, mergeReportPage, type ReportPage } from "./report-snapshot";
import { RecordActions } from "./record-actions";
import { ReportHistoryScope } from "../reports/report-period";
import { WorkTotals } from "./work-totals";
type Report = ReportPage & { date_from?:string; date_to?:string; totals?: Record<string,string>; period_opening_piastres?: string;
  period_closing_piastres?: string; current_cash_balance_piastres?: string; cash_balance_piastres?: string };
type ReportType = "trips.list" | "payments.list";
const EMPTY_ROWS: Record<string, unknown>[] = [];



export function RealReports({ contractors, vehicles, accounts, disabled, revision, write, periodRequest, onOpenStatement }: LedgerEntities & {disabled:boolean; revision:number; write:LedgerWrite; onOpenStatement?:(screen:"cash"|"contractor")=>void; periodRequest?:{id:number;date:string}|null}) {
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const reportQuery = useRef<{ type: ReportType; payload: Record<string, unknown> } | null>(null);
  const [reportType, setReportType] = useState<ReportType>("trips.list");
  const [allHistory,setAllHistory] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportAccount, setReportAccount] = useState("");
  const [reportVehicle, setReportVehicle] = useState("");
  const [reportCounterparty, setReportCounterparty] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const active = useRef(0);
  useEffect(() => { active.current++; setReport(null); reportQuery.current = null; },[revision]);
  useEffect(()=>{
    if(!periodRequest)return;
    active.current++;setReport(null);reportQuery.current=null;setReportType('trips.list');
    setAllHistory(false);setReportFrom(periodRequest.date);setReportTo(periodRequest.date);
    setReportVehicle('');setReportCounterparty('');setIncludeCancelled(false);setNotice('');
  },[periodRequest?.id]);
  useEffect(() => {
    const token = ++active.current;
    reportQuery.current = null;
    setReport(null);
    setNotice("");
    if (disabled || (!allHistory && (!reportFrom || !reportTo))) { setBusy(false); return; }
    if (!allHistory && reportFrom > reportTo) {
      setBusy(false); setNotice("تاريخ البداية يجب ألا يكون بعد تاريخ النهاية."); return;
    }
    let payload: Record<string, unknown> = {
      ...(allHistory ? {all_history:true} : {date_from:reportFrom,date_to:reportTo}),
      include_cancelled:includeCancelled, limit:200
    };
    if (reportType === "trips.list") {
      if (reportVehicle) payload.vehicle_id = reportVehicle;
      if (reportCounterparty) payload.counterparty_contractor_id = reportCounterparty;
    } else {
      const [vehicle_id,responsible_contractor_id] = reportAccount.split("|");
      if (!vehicle_id || !responsible_contractor_id) { setBusy(false); return; }
      payload = {...payload,vehicle_id,responsible_contractor_id};
    }
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const response = await postLedgerRead<Report>(reportType,payload);
        if (token !== active.current) return;
        if (!response.ok) { setNotice(response.error); return; }
        assertReportPage(response.data);
        reportQuery.current = {type:reportType,payload};
        setReport(response.data);
      } catch(error) {
        if(token === active.current) setNotice(error instanceof Error ? error.message : "تعذّر تحميل التقرير من الخادم.");
      } finally {
        if(token === active.current) setBusy(false);
      }
    },180);
    return () => { clearTimeout(timer); active.current++; };
  },[disabled,revision,reportType,allHistory,reportFrom,reportTo,reportAccount,reportVehicle,reportCounterparty,includeCancelled]);

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
    } catch (error) {
      if (token === active.current) {
        setReport(null);
        setNotice(error instanceof Error ? error.message : "تعذر تحميل الصفحة التالية. أعد تحميل التقرير.");
      }
    } finally { if (token === active.current) setBusy(false); }
  }

  const fullExportDocument = (() => {
    if (!report || !isFullOperationalReport(report)) return null;
    try {
      return buildRealOperationalDocument(reportType, report, {
        vehicles: new Map(vehicles.map(v => [v.id, v.plate_number])),
        contractors: new Map(contractors.map(c => [c.id, c.name]))
      }, report.date_from ?? reportFrom, report.date_to ?? reportTo, new Intl.DateTimeFormat("ar-EG", {
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
    <section className={ui.surface}>
      <h2>التقارير والكشوف</h2>
      {onOpenStatement&&<div className={ui.actions} aria-label="فتح كشف حساب"><button type="button" onClick={()=>onOpenStatement('cash')}>فتح كشف العربية</button><button type="button" onClick={()=>onOpenStatement('contractor')}>فتح كشف المقاول</button></div>}
      <h3>سجل النقلات والدفعات — للمراجعة والتعديل</h3>
      <div className={ui.form}>
        <div className={ui.fieldGroup}><label htmlFor="report-type">التقرير</label>
        <select id="report-type" className={ui.control} value={reportType}
          onChange={e => { setReportType(e.target.value as ReportType); setReport(null); }}>
          <option value="trips.list">النقلات</option>
          <option value="payments.list">مدفوعات وحساب نقدية عربية</option>
        </select></div>
        {reportType === "trips.list" && <>
          <div className={ui.fieldGroup}><label htmlFor="report-trip-vehicle">العربية (اختياري)</label>
          <select id="report-trip-vehicle" className={ui.control} value={reportVehicle}
            onChange={e => { setReportVehicle(e.target.value); setReport(null); }}>
            <option value="">كل العربيات</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
          </select></div>
          <div className={ui.fieldGroup}><label htmlFor="report-trip-contractor">المقاول الطرف (اختياري)</label>
          <select id="report-trip-contractor" className={ui.control} value={reportCounterparty}
            onChange={e => { setReportCounterparty(e.target.value); setReport(null); }}>
            <option value="">كل المقاولين</option>
            {contractors.filter(c => !c.is_primary).map(c =>
              <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        </>}
        {reportType === "payments.list" && <>
          <div className={ui.fieldGroup}><label htmlFor="report-account">حساب العربية والمقاول</label>
          <select id="report-account" className={ui.control} required value={reportAccount}
            onChange={e => { setReportAccount(e.target.value); setReport(null); }}>
            <option value="">اختر الحساب</option>
            {accounts.map(a => <option key={a.vehicle_id + "|" + a.contractor_id}
              value={a.vehicle_id + "|" + a.contractor_id}>
              {vehicles.find(v => v.id === a.vehicle_id)?.plate_number ?? a.vehicle_id}
              {" — "}{contractors.find(c => c.id === a.contractor_id)?.name ?? a.contractor_id}
            </option>)}
          </select></div>
        </>}
        <ReportHistoryScope checked={allHistory} onChange={value=>{setAllHistory(value);active.current++;setReport(null);reportQuery.current=null;}}/>
        <div className={ui.fieldGroup}><label htmlFor="report-from">من تاريخ</label>
        <input id="report-from" className={ui.control} type="date" required={!allHistory} value={reportFrom}
          onChange={e => { setReportFrom(e.target.value); setReport(null); }} disabled={allHistory} /></div>
        <div className={ui.fieldGroup}><label htmlFor="report-to">إلى تاريخ</label>
        <input id="report-to" className={ui.control} type="date" required={!allHistory} value={reportTo}
          onChange={e => { setReportTo(e.target.value); setReport(null); }} disabled={busy || allHistory} /></div>
        <label style={{ display: "block", marginBottom: 12 }}>
          <input type="checkbox" checked={includeCancelled} onChange={e => { setIncludeCancelled(e.target.checked); setReport(null); }} />
          {" "}عرض القيود الملغاة أيضًا
        </label>
        <p role="status" aria-live="polite">{busy ? "جارٍ تحديث التقرير تلقائيًا…" : "البيانات تتحدث تلقائيًا عند تغيير الفلاتر."}</p>
      </div>
      {report && <>
        {!busy && !disabled && fullExportDocument && <ReportExportPreview document={fullExportDocument} />}
        {allHistory && <p>كل الحساب من البداية: {report.date_from} — {report.date_to}</p>}
        {reportType === "trips.list" && report.totals && <WorkTotals totals={report.totals} />}

        <p>عدد السجلات: {report.total_count ?? report.rows?.length ?? 0}</p>
        {typeof report.period_opening_piastres === "string" && <p>
          أول الفترة: {formatPoundsForDisplay(report.period_opening_piastres)} جنيه
        </p>}
        {typeof report.period_closing_piastres === "string" && <p>
          آخر الفترة: {formatPoundsForDisplay(report.period_closing_piastres)} جنيه
        </p>}
        {typeof report.current_cash_balance_piastres === "string" && <p>
          الرصيد الحالي: {formatPoundsForDisplay(report.current_cash_balance_piastres)} جنيه
        </p>}
        <p>تم تحميل {report.rows?.length ?? 0} سجل من أصل {report.total_count ?? "غير معروف"}.
          التصدير الكامل متاح بعد تحميل كل السجلات.</p>
        {report.next_cursor && <button type="button"
          onClick={() => void loadMoreRows()}>
          {busy ? "جارٍ تحميل المزيد..." : "تحميل 200 سجل إضافي"}
        </button>}
        {!isFullOperationalReport(report) && <p role="status">
          الصيغ الكاملة (PDF/Excel/PNG/طباعة) تتطلب تحميل كل الصفحات أولًا.
        </p>}
        {!busy && fullExportDocument && <div style={{ marginTop: 16 }}>
          <h3>تصدير التقرير الكامل بخمس صيغ ومشاركة الصورة</h3>
          <ReportExportActions document={fullExportDocument}
            fileNameBase={`real-${reportType.replace(".", "-")}-${report.date_from ?? reportFrom}-${report.date_to ?? reportTo}`} />
        </div>}
        {isFullOperationalReport(report) && !fullExportDocument &&
          <p role="alert">بيانات التقرير غير متسقة؛ تم إيقاف التصدير الكامل لحمايتك.</p>}
        <OperationalRows type={reportType} rows={report.rows} lookups={{vehicles:new Map(vehicles.map(v=>[v.id,v.plate_number])),contractors:new Map(contractors.map(c=>[c.id,c.name]))}}/>

      </>}
    </section>

    <RecordActions contractors={contractors} vehicles={vehicles} mode="financial"
      reportType={reportType} reportRows={report?.rows ?? EMPTY_ROWS} busy={busy || disabled} write={write} />
  </fieldset>;
}
