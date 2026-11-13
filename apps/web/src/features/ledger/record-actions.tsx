"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { WriteOperation } from "../../lib/ledger/operation-contract";
import { piastresToPounds, poundsToPiastres } from "../../lib/ledger/amounts";
import { TripEditForm } from "./trip-edit-form";

type Contractor = { id: string; name: string; is_primary: boolean; is_archived: boolean; version: number };
type Vehicle = { id: string; plate_number: string; driver_name: string | null; notes: string | null; is_archived: boolean; version: number };
type FinancialRow = { id: string; version: number; is_cancelled: boolean; [key: string]: unknown };
type Props = {
  contractors: Contractor[];
  vehicles: Vehicle[];
  reportType: "trips.list" | "payments.list";
  reportRows: Record<string, unknown>[];
  busy: boolean;
  write: (operation: WriteOperation, payload: Record<string, unknown>) => Promise<boolean>;
};
const field: React.CSSProperties = { display: "block", padding: 10, width: "100%", maxWidth: 460, margin: "6px 0 12px" };
const section: React.CSSProperties = { border: "1px solid #d0d7e2", borderRadius: 12, padding: 16, marginBottom: 20 };

export function RecordActions({ contractors, vehicles, reportType, reportRows, busy, write }: Props) {
  const [contractorId, setContractorId] = useState("");
  const [contractorName, setContractorName] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicleNotes, setVehicleNotes] = useState("");
  const [reason, setReason] = useState("");
  const [financialId, setFinancialId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [paymentEditDate, setPaymentEditDate] = useState("");
  const [paymentEditAmount, setPaymentEditAmount] = useState("");
  const [paymentEditNotes, setPaymentEditNotes] = useState("");
  const [paymentEditReason, setPaymentEditReason] = useState("");

  const contractor = contractors.find(c => c.id === contractorId);
  const vehicle = vehicles.find(v => v.id === vehicleId);
  const rows: FinancialRow[] = reportRows.filter((r): r is FinancialRow =>
    typeof r.id === "string" && typeof r.version === "number" &&
    typeof r.is_cancelled === "boolean");
  const financial = rows.find(r => r.id === financialId);

  useEffect(() => {
    setContractorName(contractor?.name ?? "");
  }, [contractor?.id, contractor?.version, contractor?.name]);
  useEffect(() => {
    setPlate(vehicle?.plate_number ?? "");
    setDriver(vehicle?.driver_name ?? "");
    setVehicleNotes(vehicle?.notes ?? "");
  }, [vehicle?.id, vehicle?.version, vehicle?.plate_number, vehicle?.driver_name, vehicle?.notes]);
  useEffect(() => { setFinancialId(""); setConfirmed(false); }, [reportType, reportRows]);
  useEffect(() => {
    setPaymentEditDate(typeof financial?.payment_date === "string" ? financial.payment_date : "");
    setPaymentEditAmount(typeof financial?.amount_piastres === "string"
      ? piastresToPounds(financial.amount_piastres) : "");
    setPaymentEditNotes(typeof financial?.notes === "string" ? financial.notes : "");
    setPaymentEditReason("");
  }, [financial?.id, financial?.version, financial?.payment_date, financial?.amount_piastres, financial?.notes]);

  async function updateContractor(event: FormEvent) {
    event.preventDefault(); setFeedback("");
    if (!contractor || contractor.is_primary) return;
    if (await write("contractor.update", {
      id: contractor.id, name: contractorName.trim(), expected_version: contractor.version,
      reason: reason.trim() || "تعديل بيانات المقاول"
    })) { setFeedback("تم تحديث المقاول."); setReason(""); }
  }
  async function archiveContractor() {
    if (!contractor || contractor.is_primary || !reason.trim()) {
      setFeedback("اختر مقاولًا غير أساسي واكتب سبب التغيير."); return;
    }
    if (await write("contractor.archive", {
      id: contractor.id, archived: !contractor.is_archived,
      expected_version: contractor.version, reason: reason.trim()
    })) { setFeedback("تم تغيير حالة المقاول."); setReason(""); }
  }
  async function updateVehicle(event: FormEvent) {
    event.preventDefault(); setFeedback("");
    if (!vehicle || !plate.trim()) return;
    if (await write("vehicle.update", {
      id: vehicle.id, plate_number: plate.trim(), driver_name: driver.trim() || null,
      notes: vehicleNotes.trim() || null,
      expected_version: vehicle.version, reason: reason.trim() || "تعديل بيانات العربية"
    })) { setFeedback("تم تحديث العربية."); setReason(""); }
  }
  async function archiveVehicle() {
    if (!vehicle || !reason.trim()) {
      setFeedback("اختر عربية واكتب سبب التغيير."); return;
    }
    if (await write("vehicle.archive", {
      id: vehicle.id, archived: !vehicle.is_archived,
      expected_version: vehicle.version, reason: reason.trim()
    })) { setFeedback("تم تغيير حالة العربية."); setReason(""); }
  }
  async function updatePayment(event: FormEvent) {
    event.preventDefault(); setFeedback("");
    if (reportType !== "payments.list" || !financial || financial.is_cancelled || !paymentEditReason.trim()) {
      setFeedback("اختر دفعة نشطة واكتب سبب التعديل."); return;
    }
    try {
      const amount = poundsToPiastres(paymentEditAmount);
      if (BigInt(amount) <= 0n) throw new Error("مبلغ الدفعة يجب أن يكون أكبر من صفر.");
      if (!paymentEditDate) throw new Error("تاريخ الدفعة مطلوب.");
      if (await write("payment.update", {
        id: financial.id, expected_version: financial.version, reason: paymentEditReason.trim(),
        vehicle_id: financial.vehicle_id, responsible_contractor_id: financial.responsible_contractor_id,
        payment_date: paymentEditDate, amount_egp: paymentEditAmount.trim(),
        linked_trip_id: financial.linked_trip_id ?? null,
        receipt_number: financial.receipt_number ?? null,
        notes: paymentEditNotes.trim()
      })) { setFeedback("تم تعديل الدفعة. حمّل التقرير من جديد لمراجعة الرصيد."); }
    } catch (error) { setFeedback(error instanceof Error ? error.message : "مبلغ غير صحيح."); }
  }
  async function cancelFinancial(event: FormEvent) {
    event.preventDefault(); setFeedback("");
    if (!financial || financial.is_cancelled || !confirmed || !cancelReason.trim()) {
      setFeedback("اختر سجلًا نشطًا واكتب السبب وأكد الإلغاء."); return;
    }
    const operation = reportType === "trips.list" ? "trip.cancel" : "payment.cancel";
    if (await write(operation, {
      id: financial.id, expected_version: financial.version, reason: cancelReason.trim()
    })) {
      setFeedback("تم إلغاء السجل مع الاحتفاظ به في سجل المراجعة.");
      setFinancialId(""); setCancelReason(""); setConfirmed(false);
    }
  }

  return <>
    {feedback && <p role="status">{feedback}</p>}
    <section style={section}>
      <h2>تعديل أو أرشفة المقاول</h2>
      <p>لا يمكن تعديل أو أرشفة المقاول الأساسي. كل تعديل يستخدم رقم إصدار لمنع الكتابة فوق تحديث أحدث.</p>
      <label htmlFor="manage-contractor">المقاول</label>
      <select id="manage-contractor" style={field} value={contractorId}
        onChange={e => setContractorId(e.target.value)} disabled={busy}>
        <option value="">اختر المقاول</option>
        {contractors.filter(c => !c.is_primary).map(c =>
          <option key={c.id} value={c.id}>{c.name}{c.is_archived ? " (مؤرشف)" : ""}</option>)}
      </select>
      <form onSubmit={updateContractor}>
        <label htmlFor="manage-contractor-name">الاسم الجديد</label>
        <input id="manage-contractor-name" style={field} required maxLength={160}
          value={contractorName} onChange={e => setContractorName(e.target.value)} disabled={busy || !contractor} />
        <label htmlFor="manage-reason">سبب التعديل أو الأرشفة</label>
        <input id="manage-reason" style={field} maxLength={400} value={reason}
          onChange={e => setReason(e.target.value)} disabled={busy} />
        <button type="submit" disabled={busy || !contractor}>حفظ تعديل المقاول</button>
        {" "}
        <button type="button" disabled={busy || !contractor || !reason.trim()}
          onClick={() => void archiveContractor()}>
          {contractor?.is_archived ? "إعادة تفعيل المقاول" : "أرشفة المقاول"}
        </button>
      </form>
    </section>
    <section style={section}>
      <h2>تعديل أو أرشفة العربية</h2>
      <label htmlFor="manage-vehicle">العربية</label>
      <select id="manage-vehicle" style={field} value={vehicleId}
        onChange={e => setVehicleId(e.target.value)} disabled={busy}>
        <option value="">اختر العربية</option>
        {vehicles.map(v => <option key={v.id} value={v.id}>
          {v.plate_number}{v.is_archived ? " (مؤرشفة)" : ""}
        </option>)}
      </select>
      <form onSubmit={updateVehicle}>
        <label htmlFor="manage-plate">اللوحة</label>
        <input id="manage-plate" style={field} required maxLength={80} value={plate}
          onChange={e => setPlate(e.target.value)} disabled={busy || !vehicle} />
        <label htmlFor="manage-driver">السائق</label>
        <input id="manage-driver" style={field} maxLength={160} value={driver}
          onChange={e => setDriver(e.target.value)} disabled={busy || !vehicle} />
        <label htmlFor="manage-vehicle-notes">ملاحظات العربية</label>
        <input id="manage-vehicle-notes" style={field} maxLength={400} value={vehicleNotes}
          onChange={e => setVehicleNotes(e.target.value)} disabled={busy || !vehicle} />
        <button type="submit" disabled={busy || !vehicle}>حفظ تعديل العربية</button>
        {" "}
        <button type="button" disabled={busy || !vehicle || !reason.trim()}
          onClick={() => void archiveVehicle()}>
          {vehicle?.is_archived ? "إعادة تفعيل العربية" : "أرشفة العربية"}
        </button>
      </form>
    </section>
    <section style={section}>
      <h2>إلغاء نقلة أو دفعة مع توثيق السبب</h2>
      <p>اختَر سجلًا من نتائج التقرير المحمّل. الإلغاء لا يمسح السجل؛ الخادم يراجع الرصيد والتعارضات قبل الحفظ.</p>
      <form onSubmit={cancelFinancial}>
        <label htmlFor="cancel-record">السجل</label>
        <select id="cancel-record" style={field} required value={financialId}
          onChange={e => { setFinancialId(e.target.value); setConfirmed(false); }} disabled={busy}>
          <option value="">اختر سجلًا نشطًا من التقرير</option>
          {rows.filter(r => !r.is_cancelled).map(r =>
            <option key={r.id} value={r.id}>{r.id} — {String(r.trip_date ?? r.payment_date ?? "")}</option>)}
        </select>
        <label htmlFor="cancel-reason">سبب الإلغاء (إلزامي)</label>
        <input id="cancel-reason" style={field} required maxLength={400} value={cancelReason}
          onChange={e => setCancelReason(e.target.value)} disabled={busy} />
        <label style={{ display: "block", marginBottom: 12 }}>
          <input type="checkbox" checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)} disabled={busy} />
          {" "}أؤكد إلغاء هذا القيد بعد مراجعة رقمه وتاريخه
        </label>
        <button type="submit" disabled={busy || !financial || !confirmed || !cancelReason.trim()}>
          إلغاء القيد وتسجيل السبب
        </button>
      </form>
      {reportType === "trips.list" && financial && !financial.is_cancelled &&
        <TripEditForm key={financial.id + ":" + financial.version} trip={financial}
          contractors={contractors} vehicles={vehicles} busy={busy} write={write} />}
      {reportType === "payments.list" && financial && !financial.is_cancelled && <form onSubmit={updatePayment}>
        <h3>تعديل الدفعة المختارة</h3>
        <p>يتم الاحتفاظ برقم القيد والحساب المرتبط به. أي تغيير يُراجع الرصيد في قاعدة البيانات.</p>
        <label htmlFor="payment-edit-date">التاريخ الجديد</label>
        <input id="payment-edit-date" type="date" style={field} required value={paymentEditDate}
          onChange={e => setPaymentEditDate(e.target.value)} disabled={busy} />
        <label htmlFor="payment-edit-amount">المبلغ الجديد بالجنيه</label>
        <input id="payment-edit-amount" style={field} required inputMode="decimal" value={paymentEditAmount}
          onChange={e => setPaymentEditAmount(e.target.value)} disabled={busy} />
        <label htmlFor="payment-edit-notes">الملاحظات</label>
        <input id="payment-edit-notes" style={field} maxLength={400} value={paymentEditNotes}
          onChange={e => setPaymentEditNotes(e.target.value)} disabled={busy} />
        <label htmlFor="payment-edit-reason">سبب تعديل الدفعة (إلزامي)</label>
        <input id="payment-edit-reason" style={field} required maxLength={400} value={paymentEditReason}
          onChange={e => setPaymentEditReason(e.target.value)} disabled={busy} />
        <button type="submit" disabled={busy || !paymentEditReason.trim()}>حفظ تعديل الدفعة</button>
      </form>}
    </section>
  </>;
}
