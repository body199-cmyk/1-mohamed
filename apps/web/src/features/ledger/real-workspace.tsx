"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseSetupStatus } from "../../lib/supabase/config";
import { postLedgerRead, postLedgerWrite } from "../../lib/ledger/transport";
import { poundsToPiastres, piastresToPounds } from "../../lib/ledger/amounts";
import type { WriteOperation } from "../../lib/ledger/operation-contract";
import { LogoutButton } from "../auth/logout-button";
import { TransactionEntry } from "./transaction-entry";
import { RecordActions } from "./record-actions";
import { projectLedgerReport } from "./report-presentation";
import { RealContractorStatement } from "./real-contractor-statement";
import { ReportExportActions } from "../reports/report-export-actions";
import { buildRealOperationalDocument, isFullOperationalReport } from "./real-operational-document";

type Contractor = { id: string; name: string; is_primary: boolean; is_archived: boolean; version: number };
type Vehicle = { id: string; plate_number: string; driver_name: string | null; notes: string | null; is_archived: boolean; version: number };
type Account = { vehicle_id: string; contractor_id: string };
type Page<T> = { ok: boolean; data?: T[]; hasMore?: boolean; error?: string };
type Report = { status: string; rows: Record<string, unknown>[]; total_count?: string | number;
  next_cursor?: { date: string; id: string; created_at?: string } | null;
  period_opening_piastres?: string; period_closing_piastres?: string;
  current_cash_balance_piastres?: string; cash_balance_piastres?: string };
type ReportType = "trips.list" | "payments.list";
const EMPTY_ROWS: Record<string, unknown>[] = [];

const field: React.CSSProperties = { display: "block", padding: 10, width: "100%", maxWidth: 460, margin: "6px 0 12px" };
const section: React.CSSProperties = { border: "1px solid #d0d7e2", borderRadius: 12, padding: 16, marginBottom: 20 };
const short = (value: string) => value.length > 80 ? value.slice(0, 80) + "…" : value;
const asText = (value: unknown) => typeof value === "string" ? value : value == null ? "" : String(value);

/** CSV escaping plus spreadsheet formula-injection defense. */
function csvCell(value: unknown): string {
  const original = asText(value);
  const safe = /^[\s]*[=+@\-\t\r]/.test(original) ? "'" + original : original;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function RealWorkspace() {
  const configured = getSupabaseSetupStatus().ready;
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [ledgerRevision, setLedgerRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [contractorName, setContractorName] = useState("");
  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicleContractor, setVehicleContractor] = useState("");
  const [accountVehicle, setAccountVehicle] = useState("");
  const [accountContractor, setAccountContractor] = useState("");
  const [openingType, setOpeningType] = useState<"CONTRACTOR_WORK" | "VEHICLE_CASH">("CONTRACTOR_WORK");
  const [openingContractor, setOpeningContractor] = useState("");
  const [openingVehicle, setOpeningVehicle] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [reportType, setReportType] = useState<ReportType>("trips.list");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportAccount, setReportAccount] = useState("");
  const [reportVehicle, setReportVehicle] = useState("");
  const [reportCounterparty, setReportCounterparty] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const pending = useRef(new Map<string, string>());
  const reportQuery = useRef<{ type: ReportType; payload: Record<string, unknown> } | null>(null);

  const loadMasters = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    try {
      async function all<T>(type: string): Promise<T[]> {
        const items: T[] = [];
        for (let offset = 0; offset < 10000; offset += 200) {
          const response = await fetch(`/api/ledger/master?type=${type}&offset=${offset}&limit=200`,
            { credentials: "same-origin", cache: "no-store" });
          const page = await response.json() as Page<T>;
          if (!response.ok || !page.ok || !Array.isArray(page.data)) {
            throw new Error(page.error || "تعذر تحميل البيانات.");
          }
          items.push(...page.data);
          if (!page.hasMore) return items;
        }
        throw new Error("البيانات أكثر من حد القراءة. يلزم تحسين التصفح قبل المتابعة.");
      }
      const [c, v, a] = await Promise.all([
        all<Contractor>("contractors"), all<Vehicle>("vehicles"), all<Account>("vehicle_accounts")
      ]);
      setContractors(c); setVehicles(v); setAccounts(a);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر تحميل البيانات.");
    } finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { void loadMasters(); }, [loadMasters]);

  async function write(operation: WriteOperation, payload: Record<string, unknown>) {
    if (busy || !configured) return false;
    setBusy(true); setNotice("");
    const signature = operation + ":" + JSON.stringify(payload);
    let key = pending.current.get(signature);
    if (!key) {
      key = crypto.randomUUID();
      pending.current.set(signature, key);
    }
    try {
      const response = await postLedgerWrite<{ status?: string; message?: string }>(operation, payload, key);
      if (!response.ok) { setNotice(response.error + " (يمكن إعادة المحاولة بنفس العملية)"); return false; }
      if (response.data?.status === "NEEDS_DECISION") {
        setNotice(response.data.message || "العملية تحتاج قرارًا قبل الاستمرار.");
        pending.current.delete(signature);
        return false;
      }
      pending.current.delete(signature);
      setNotice("تم الحفظ في الخادم. يُرجى التحقق من السجل بعد إعادة التحميل.");
      setReport(null); // An edit/cancellation invalidates every displayed financial total.
      reportQuery.current = null;
      setLedgerRevision(current => current + 1);
      await loadMasters();
      return true;
    } catch {
      setNotice("انقطع الاتصال؛ لم نؤكد نتيجة الحفظ. أعد نفس العملية دون تغيير المدخلات لتجنب التكرار.");
      return false;
    } finally { setBusy(false); }
  }

  async function createContractor(event: FormEvent) {
    event.preventDefault();
    const name = contractorName.trim();
    if (!name) return;
    const id = "CTR-" + crypto.randomUUID();
    // Stable payload across retries, including the generated record ID.
    const key = "contractor:" + name;
    const cached = drafts.current.get(key) ?? { id, name, start_mode: "DETAILS" };
    drafts.current.set(key, cached);
    if (await write("contractor.create", cached)) {
      drafts.current.delete(key); setContractorName("");
    }
  }
  const drafts = useRef(new Map<string, Record<string, unknown>>());

  async function createVehicle(event: FormEvent) {
    event.preventDefault();
    const normalizedPlate = plate.trim();
    if (!normalizedPlate) return;
    const key = "vehicle:" + normalizedPlate + ":" + vehicleContractor;
    const cached = drafts.current.get(key) ?? {
      id: "VEH-" + crypto.randomUUID(), plate_number: normalizedPlate,
      driver_name: driver.trim() || null, ...(vehicleContractor ? { contractor_id: vehicleContractor } : {})
    };
    drafts.current.set(key, cached);
    if (await write("vehicle.create", cached)) {
      drafts.current.delete(key); setPlate(""); setDriver("");
    }
  }

  async function ensureAccount(event: FormEvent) {
    event.preventDefault();
    if (!accountVehicle || !accountContractor) return;
    await write("vehicle.account.ensure", {
      vehicle_id: accountVehicle, contractor_id: accountContractor
    });
  }

  async function createOpening(event: FormEvent) {
    event.preventDefault();
    try {
      const piastres = poundsToPiastres(openingAmount);
      if (!openingContractor || !openingDate ||
          (openingType === "VEHICLE_CASH" && !openingVehicle)) {
        setNotice("حدد المقاول والتاريخ والحساب المطلوب."); return;
      }
      const signature = [openingType, openingContractor, openingVehicle, openingDate, piastres].join(":");
      const cached = drafts.current.get(signature) ?? {
        id: "OPEN-" + crypto.randomUUID(), balance_type: openingType,
        contractor_id: openingContractor,
        ...(openingType === "VEHICLE_CASH" ? { vehicle_id: openingVehicle } : {}),
        start_date: openingDate, signed_piastres: piastres, start_mode: "TOTAL"
      };
      drafts.current.set(signature, cached);
      if (await write("opening.create", cached)) {
        drafts.current.delete(signature); setOpeningAmount("");
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "المبلغ غير صالح."); }
  }

  async function readReport(event: FormEvent) {
    event.preventDefault();
    if (!configured || !reportFrom || !reportTo) return;
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
      if (!response.ok) { setNotice(response.error); return; }
      if (!Array.isArray(response.data?.rows)) { setNotice("تقرير غير صالح من الخادم."); return; }
      reportQuery.current = { type: reportType, payload };
      setReport(response.data);
    } catch { setNotice("تعذّر تحميل التقرير من الخادم."); }
    finally { setBusy(false); }
  }

  async function loadMoreRows() {
    const query = reportQuery.current;
    if (busy || !report || !report.next_cursor || !query) return;
    setBusy(true); setNotice("");
    try {
      const response = await postLedgerRead<Report>(query.type, {
        ...query.payload, cursor: report.next_cursor
      });
      if (!response.ok) { setNotice(response.error); return; }
      if (!Array.isArray(response.data?.rows)) {
        setNotice("صفحة التقرير غير صالحة من الخادم."); return;
      }
      // Each SQL RPC owns its stable keyset order; never use client offsets.
      const existingIds = new Set(report.rows.map(row => row.id));
      const newRows = response.data.rows.filter(row => !existingIds.has(row.id));
      if (response.data.next_cursor &&
          response.data.next_cursor.date === report.next_cursor.date &&
          response.data.next_cursor.id === report.next_cursor.id &&
          response.data.next_cursor.created_at === report.next_cursor.created_at) {
        setNotice("مؤشر الصفحة لم يتغير. أوقفنا القراءة لمنع تكرار السجلات."); return;
      }
      setReport({ ...report, rows: [...report.rows, ...newRows],
        next_cursor: response.data.next_cursor ?? null });
    } catch { setNotice("تعذر تحميل الصفحة التالية. يمكنك المحاولة مجددًا."); }
    finally { setBusy(false); }
  }

  function exportReport() {
    if (!report || !Array.isArray(report.rows) || report.rows.length === 0) return;
    const projected = projectLedgerReport(reportType, report.rows, {
      vehicles: new Map(vehicles.map(v => [v.id, v.plate_number])),
      contractors: new Map(contractors.map(c => [c.id, c.name]))
    });
    const csv = "\uFEFF" + [projected.headers.map(csvCell).join(","),
      ...projected.rows.map(row => row.map(csvCell).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ledger-${reportType.replace(".", "-")}-${reportFrom}-${reportTo}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
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

  if (!configured) return <section style={section}>
    <h1>مساحة العمل الحقيقية</h1>
    <p role="status">لم يتم ربط قاعدة البيانات بعد. لن نعرض بيانات تجريبية أو نسمح بحفظ وهمي.</p>
    <p>التجهيزات البرمجية جاهزة للاختبار عند مرحلة الاتصال الأخيرة.</p>
  </section>;

  return <div style={{ maxWidth: 980, margin: "24px auto" }}>
    <header style={{ display: "flex", gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
      <h1>إدارة حسابات النقل</h1><LogoutButton />
    </header>
    <p>البيانات من الخادم فقط، بدون بيانات تجريبية. أي عملية حفظ لها رقم طلب يمنع تكرار القيد عند إعادة المحاولة.</p>
    {notice && <p role="status" style={{ border: "1px solid #c7cdd5", padding: 12 }}>{notice}</p>}
    <button type="button" disabled={loading || busy} onClick={() => void loadMasters()}>
      {loading ? "جارٍ التحميل..." : "تحديث البيانات من الخادم"}
    </button>
    <section style={section}>
      <h2>المقاولون ({contractors.length})</h2>
      <ul>{contractors.map(c => <li key={c.id}>{short(c.name)} {c.is_primary ? "(الأساسي)" : ""} {c.is_archived ? "(مؤرشف)" : ""}</li>)}</ul>
      <form onSubmit={createContractor}>
        <label htmlFor="contractor-name">إضافة مقاول جديد</label>
        <input id="contractor-name" style={field} value={contractorName} required maxLength={160}
          onChange={e => setContractorName(e.target.value)} disabled={busy} />
        <button disabled={busy} type="submit">حفظ المقاول</button>
      </form>
    </section>
    <section style={section}>
      <h2>العربيات ({vehicles.length})</h2>
      <ul>{vehicles.map(v => <li key={v.id}>{short(v.plate_number)} {v.driver_name ? " — " + short(v.driver_name) : ""}</li>)}</ul>
      <form onSubmit={createVehicle}>
        <label htmlFor="vehicle-plate">رقم اللوحة</label>
        <input id="vehicle-plate" style={field} required value={plate} maxLength={80}
          onChange={e => setPlate(e.target.value)} disabled={busy} />
        <label htmlFor="vehicle-driver">السائق</label>
        <input id="vehicle-driver" style={field} value={driver} maxLength={160}
          onChange={e => setDriver(e.target.value)} disabled={busy} />
        <label htmlFor="vehicle-contractor">المقاول المسؤول (اختياري)</label>
        <select id="vehicle-contractor" style={field} value={vehicleContractor}
          onChange={e => setVehicleContractor(e.target.value)} disabled={busy}>
          <option value="">بدون حساب عند الإنشاء</option>
          {contractors.filter(c => !c.is_archived).map(c =>
            <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button disabled={busy} type="submit">حفظ العربية</button>
      </form>
    </section>
    <section style={section}>
      <h2>ربط عربية بمقاول ({accounts.length} حساب)</h2>
      <form onSubmit={ensureAccount}>
        <label htmlFor="account-vehicle">العربية</label>
        <select id="account-vehicle" style={field} required value={accountVehicle}
          onChange={e => setAccountVehicle(e.target.value)} disabled={busy}>
          <option value="">اختر العربية</option>
          {vehicles.filter(v => !v.is_archived).map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
        </select>
        <label htmlFor="account-contractor">المقاول المسؤول</label>
        <select id="account-contractor" style={field} required value={accountContractor}
          onChange={e => setAccountContractor(e.target.value)} disabled={busy}>
          <option value="">اختر المقاول</option>
          {contractors.filter(c => !c.is_archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button disabled={busy} type="submit">تأكيد ربط الحساب</button>
      </form>
    </section>
    <section style={section}>
      <h2>الرصيد الافتتاحي — لا تكرر الحركات التاريخية</h2>
      <p>اختر رصيدًا إجماليًا عند بداية الفترة أو أدخل الحركات التاريخية بالتفصيل، ولا تجمع الطريقتين لنفس الفترة.</p>
      <form onSubmit={createOpening}>
        <label htmlFor="opening-type">نوع الرصيد</label>
        <select id="opening-type" style={field} value={openingType}
          onChange={e => setOpeningType(e.target.value as typeof openingType)} disabled={busy}>
          <option value="CONTRACTOR_WORK">فرق شغل المقاول</option>
          <option value="VEHICLE_CASH">نقدية عربية مع مقاول</option>
        </select>
        <label htmlFor="opening-contractor">المقاول</label>
        <select id="opening-contractor" style={field} required value={openingContractor}
          onChange={e => setOpeningContractor(e.target.value)} disabled={busy}>
          <option value="">اختر المقاول</option>
          {contractors.filter(c => !c.is_archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {openingType === "VEHICLE_CASH" && <>
          <label htmlFor="opening-vehicle">العربية المرتبطة بالمقاول</label>
          <select id="opening-vehicle" style={field} required value={openingVehicle}
            onChange={e => setOpeningVehicle(e.target.value)} disabled={busy}>
            <option value="">اختر العربية</option>
            {accounts.filter(a => a.contractor_id === openingContractor).map(a => {
              const v = vehicles.find(v => v.id === a.vehicle_id);
              return <option key={a.vehicle_id} value={a.vehicle_id}>{v?.plate_number ?? a.vehicle_id}</option>;
            })}
          </select>
        </>}
        <label htmlFor="opening-date">تاريخ بداية الرصيد</label>
        <input id="opening-date" type="date" style={field} required value={openingDate}
          onChange={e => setOpeningDate(e.target.value)} disabled={busy} />
        <label htmlFor="opening-amount">المبلغ بالجنيه (سالب أو موجب)</label>
        <input id="opening-amount" style={field} required inputMode="decimal"
          placeholder="1250.50" value={openingAmount}
          onChange={e => setOpeningAmount(e.target.value)} disabled={busy} />
        <button disabled={busy} type="submit">حفظ الرصيد الافتتاحي</button>
      </form>
    </section>
    <TransactionEntry contractors={contractors} vehicles={vehicles} accounts={accounts}
      busy={busy} write={write} />
    <RecordActions contractors={contractors} vehicles={vehicles}
      reportType={reportType} reportRows={report?.rows ?? EMPTY_ROWS} busy={busy} write={write} />
    <RealContractorStatement contractors={contractors} vehicles={vehicles}
      revision={ledgerRevision} disabled={busy || loading} />
    <section style={section}>
      <h2>تقارير من قاعدة البيانات</h2>
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
          التصدير يشمل السجلات المحمّلة فقط.</p>
        {report.next_cursor && <button type="button"
          disabled={busy} onClick={() => void loadMoreRows()}>
          {busy ? "جارٍ تحميل المزيد..." : "تحميل 200 سجل إضافي"}
        </button>}
        <button type="button" disabled={!report.rows?.length || busy} onClick={exportReport}>تصدير السجلات المحمّلة CSV</button>
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
  </div>;
}
