"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { WriteOperation } from "../../lib/ledger/operation-contract";
import { assertDecimal, piastresToPounds, scaledIntegerToDecimal } from "../../lib/ledger/amounts";

type Choice = { id: string; name: string; is_archived: boolean };
type Vehicle = { id: string; plate_number: string; is_archived: boolean };
type TripRow = {
  id: string; version: number; is_cancelled: boolean;
  vehicle_id: string; counterparty_contractor_id: string;
  direction: "AHMED_SUPPLIES" | "OTHER_SUPPLIES";
  trip_date: string; weight_milli_tonnes: string;
  contractor_rate_piastres: string; vehicle_rate_piastres: string;
  expense_piastres: string; same_rate: boolean;
  origin: string | null; destination: string | null;
  receipt_number: string | null; notes: string | null;
};
type Props = {
  row: Record<string, unknown> | undefined;
  contractors: Choice[];
  vehicles: Vehicle[];
  busy: boolean;
  write: (operation: WriteOperation, payload: Record<string, unknown>) => Promise<boolean>;
};
type Draft = {
  vehicle_id: string; counterparty_contractor_id: string;
  direction: TripRow["direction"]; trip_date: string; weight_tonnes: string;
  contractor_rate_egp: string; vehicle_rate_egp: string; same_rate: boolean;
  expense_egp: string; origin: string; destination: string; notes: string;
};
const empty: Draft = { vehicle_id: "", counterparty_contractor_id: "",
  direction: "AHMED_SUPPLIES", trip_date: "", weight_tonnes: "",
  contractor_rate_egp: "", vehicle_rate_egp: "", same_rate: true,
  expense_egp: "0", origin: "", destination: "", notes: "" };
const field: React.CSSProperties = { display: "block", padding: 10, width: "100%",
  maxWidth: 460, margin: "6px 0 12px" };

function isTrip(row: Record<string, unknown> | undefined): row is TripRow {
  return !!row && typeof row.id === "string" && Number.isSafeInteger(row.version)
    && typeof row.is_cancelled === "boolean" && typeof row.vehicle_id === "string"
    && typeof row.counterparty_contractor_id === "string"
    && (row.direction === "AHMED_SUPPLIES" || row.direction === "OTHER_SUPPLIES")
    && typeof row.trip_date === "string" && typeof row.weight_milli_tonnes === "string"
    && typeof row.contractor_rate_piastres === "string"
    && typeof row.vehicle_rate_piastres === "string"
    && typeof row.expense_piastres === "string" && typeof row.same_rate === "boolean";
}

export function TripEdit({ row, contractors, vehicles, busy, write }: Props) {
  const [draft, setDraft] = useState<Draft>(empty);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const trip = isTrip(row) && !row.is_cancelled ? row : null;
  useEffect(() => {
    if (!trip) { setDraft(empty); setReason(""); return; }
    try {
      setDraft({
        vehicle_id: trip.vehicle_id, counterparty_contractor_id: trip.counterparty_contractor_id,
        direction: trip.direction, trip_date: trip.trip_date,
        weight_tonnes: scaledIntegerToDecimal(trip.weight_milli_tonnes, 3),
        contractor_rate_egp: piastresToPounds(trip.contractor_rate_piastres),
        vehicle_rate_egp: piastresToPounds(trip.vehicle_rate_piastres),
        expense_egp: piastresToPounds(trip.expense_piastres),
        same_rate: trip.same_rate, origin: trip.origin ?? "",
        destination: trip.destination ?? "", notes: trip.notes ?? ""
      });
    } catch { setDraft(empty); setMessage("تعذّر قراءة مبالغ النقلة؛ أوقفنا التعديل."); }
    setReason("");
  }, [trip?.id, trip?.version]);

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(previous => ({ ...previous, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    if (!trip || !reason.trim()) { setMessage("اختر نقلة واكتب سبب التعديل."); return; }
    try {
      const w = assertDecimal(draft.weight_tonnes, 3, true);
      const cr = assertDecimal(draft.contractor_rate_egp, 2, false);
      const vr = draft.same_rate ? cr : assertDecimal(draft.vehicle_rate_egp, 2, false);
      const expense = assertDecimal(draft.expense_egp, 2, false);
      if (!draft.vehicle_id || !draft.counterparty_contractor_id || !draft.trip_date)
        throw new Error("العربية والمقاول والتاريخ مطلوبون.");
      if (await write("trip.update", {
        id: trip.id, expected_version: trip.version, reason: reason.trim(),
        vehicle_id: draft.vehicle_id, counterparty_contractor_id: draft.counterparty_contractor_id,
        direction: draft.direction, trip_date: draft.trip_date, weight_tonnes: w,
        contractor_rate_egp: cr, vehicle_rate_egp: vr, same_rate: draft.same_rate,
        expense_egp: expense, origin: draft.origin.trim() || null,
        destination: draft.destination.trim() || null,
        // Preserve existing receipt metadata; no new receipt number is requested in the UI.
        receipt_number: trip.receipt_number ?? null, notes: draft.notes.trim() || null
      })) {
        setMessage("تم تعديل النقلة. حمّل التقرير مجددًا لمراجعة الأرصدة.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "بيانات النقلة غير صالحة."); }
  }

  if (!trip) return null;
  return <form onSubmit={submit} style={{ marginTop: 20, borderTop: "1px solid #ddd", paddingTop: 12 }}>
    <h3>تعديل النقلة المختارة</h3>
    <p>رقم النقلة: {trip.id} — الإصدار: {trip.version}.
      تغيير تاريخ أو اتجاه أو حساب النقلة قد يؤثر على النقدية، والخادم يرفض أي تعارض.</p>
    <label htmlFor="edit-trip-vehicle">العربية</label>
    <select id="edit-trip-vehicle" style={field} required value={draft.vehicle_id}
      onChange={e => change("vehicle_id", e.target.value)} disabled={busy}>
      {vehicles.map(v => <option key={v.id} value={v.id}>
        {v.plate_number}{v.is_archived ? " (مؤرشفة)" : ""}
      </option>)}
    </select>
    <label htmlFor="edit-trip-contractor">المقاول الطرف</label>
    <select id="edit-trip-contractor" style={field} required value={draft.counterparty_contractor_id}
      onChange={e => change("counterparty_contractor_id", e.target.value)} disabled={busy}>
      {contractors.map(c => <option key={c.id} value={c.id}>
        {c.name}{c.is_archived ? " (مؤرشف)" : ""}
      </option>)}
    </select>
    <label htmlFor="edit-trip-direction">اتجاه النقلة</label>
    <select id="edit-trip-direction" style={field} value={draft.direction}
      onChange={e => change("direction", e.target.value as Draft["direction"])} disabled={busy}>
      <option value="AHMED_SUPPLIES">أحمد هو المورّد</option>
      <option value="OTHER_SUPPLIES">المقاول الآخر هو المورّد</option>
    </select>
    <label htmlFor="edit-trip-date">تاريخ النقلة</label>
    <input id="edit-trip-date" type="date" style={field} required value={draft.trip_date}
      onChange={e => change("trip_date", e.target.value)} disabled={busy} />
    <label htmlFor="edit-trip-weight">الوزن بالطن</label>
    <input id="edit-trip-weight" style={field} inputMode="decimal" required value={draft.weight_tonnes}
      onChange={e => change("weight_tonnes", e.target.value)} disabled={busy} />
    <label htmlFor="edit-trip-cr">سعر المقاول بالجنيه للطن</label>
    <input id="edit-trip-cr" style={field} inputMode="decimal" required value={draft.contractor_rate_egp}
      onChange={e => change("contractor_rate_egp", e.target.value)} disabled={busy} />
    <label style={{ display: "block", marginBottom: 12 }}>
      <input type="checkbox" checked={draft.same_rate}
        onChange={e => change("same_rate", e.target.checked)} disabled={busy} />
      {" "}نفس سعر المقاول والعربية
    </label>
    {!draft.same_rate && <>
      <label htmlFor="edit-trip-vr">سعر العربية بالجنيه للطن</label>
      <input id="edit-trip-vr" style={field} inputMode="decimal" required value={draft.vehicle_rate_egp}
        onChange={e => change("vehicle_rate_egp", e.target.value)} disabled={busy} />
    </>}
    <label htmlFor="edit-trip-expense">مصاريف النقلة بالجنيه</label>
    <input id="edit-trip-expense" style={field} inputMode="decimal" required value={draft.expense_egp}
      onChange={e => change("expense_egp", e.target.value)} disabled={busy} />
    <label htmlFor="edit-trip-origin">من</label>
    <input id="edit-trip-origin" style={field} maxLength={200} value={draft.origin}
      onChange={e => change("origin", e.target.value)} disabled={busy} />
    <label htmlFor="edit-trip-destination">إلى</label>
    <input id="edit-trip-destination" style={field} maxLength={200} value={draft.destination}
      onChange={e => change("destination", e.target.value)} disabled={busy} />
    <label htmlFor="edit-trip-notes">ملاحظات</label>
    <input id="edit-trip-notes" style={field} maxLength={400} value={draft.notes}
      onChange={e => change("notes", e.target.value)} disabled={busy} />
    <label htmlFor="edit-trip-reason">سبب التعديل (إلزامي)</label>
    <input id="edit-trip-reason" style={field} maxLength={400} required value={reason}
      onChange={e => setReason(e.target.value)} disabled={busy} />
    <button type="submit" disabled={busy || !reason.trim()}>حفظ تعديل النقلة</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
