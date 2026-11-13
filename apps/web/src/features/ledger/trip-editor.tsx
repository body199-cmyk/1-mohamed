"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { WriteOperation } from "../../lib/ledger/operation-contract";
import {
  buildTripUpdatePayload, tripFieldsFromRow, type TripEditFields
} from "../../lib/ledger/trip-update-payload";

type Props = {
  row: Record<string, unknown>;
  contractors: { id: string; name: string; is_archived: boolean }[];
  vehicles: { id: string; plate_number: string; is_archived: boolean }[];
  busy: boolean;
  write: (operation: WriteOperation, payload: Record<string, unknown>) => Promise<boolean>;
};
const fieldStyle: React.CSSProperties = {
  display: "block", padding: 10, width: "100%", maxWidth: 460, margin: "6px 0 12px"
};
const blank: TripEditFields = {
  vehicle_id: "", counterparty_contractor_id: "", direction: "AHMED_SUPPLIES",
  trip_date: "", weight_tonnes: "", contractor_rate_egp: "", vehicle_rate_egp: "",
  same_rate: true, expense_egp: "0", origin: "", destination: "", notes: "", reason: ""
};

/** Edits existing SQL records without silently resetting hidden historical fields. */
export function TripEditor({ row, contractors, vehicles, busy, write }: Props) {
  const [fields, setFields] = useState<TripEditFields>(blank);
  const [error, setError] = useState("");
  const [readyId, setReadyId] = useState("");

  useEffect(() => {
    try {
      setFields({ ...tripFieldsFromRow(row), reason: "" });
      setReadyId(String(row.id) + ":" + String(row.version));
      setError("");
    } catch {
      setReadyId("");
      setError("تعذر قراءة بيانات النقلة المختارة؛ حدّث التقرير.");
    }
  }, [row.id, row.version]);

  function change<K extends keyof TripEditFields>(key: K, value: TripEditFields[K]) {
    setFields(previous => ({ ...previous, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || readyId !== String(row.id) + ":" + String(row.version)) return;
    setError("");
    try {
      const payload = buildTripUpdatePayload(row, fields);
      if (await write("trip.update", payload)) {
        setError("تم إرسال التعديل للحفظ؛ حدّث التقرير لمراجعة الإجماليات.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "بيانات النقلة غير صالحة.");
    }
  }

  return <form onSubmit={save}>
    <h3>تعديل النقلة المختارة</h3>
    <p>يتم الاحتفاظ برقم النقلة ورقم إيصالها القديم. الحسابات والأرصدة يعاد التحقق منها داخل قاعدة البيانات.</p>
    {error && <p role="status">{error}</p>}
    <label htmlFor="edit-trip-vehicle">العربية</label>
    <select id="edit-trip-vehicle" style={fieldStyle} required disabled={busy}
      value={fields.vehicle_id} onChange={e => change("vehicle_id", e.target.value)}>
      <option value="">اختر العربية</option>
      {vehicles.map(v => <option key={v.id} value={v.id}>
        {v.plate_number}{v.is_archived ? " (مؤرشفة)" : ""}
      </option>)}
    </select>
    <label htmlFor="edit-trip-contractor">المقاول الطرف</label>
    <select id="edit-trip-contractor" style={fieldStyle} required disabled={busy}
      value={fields.counterparty_contractor_id}
      onChange={e => change("counterparty_contractor_id", e.target.value)}>
      <option value="">اختر المقاول</option>
      {contractors.map(c => <option key={c.id} value={c.id}>
        {c.name}{c.is_archived ? " (مؤرشف)" : ""}
      </option>)}
    </select>
    <label htmlFor="edit-trip-direction">اتجاه النقلة</label>
    <select id="edit-trip-direction" style={fieldStyle} disabled={busy}
      value={fields.direction}
      onChange={e => change("direction", e.target.value as TripEditFields["direction"])}>
      <option value="AHMED_SUPPLIES">أحمد هو المورّد</option>
      <option value="OTHER_SUPPLIES">المقاول الآخر هو المورّد</option>
    </select>
    <label htmlFor="edit-trip-date">التاريخ</label>
    <input id="edit-trip-date" type="date" style={fieldStyle} required disabled={busy}
      value={fields.trip_date} onChange={e => change("trip_date", e.target.value)} />
    <label htmlFor="edit-trip-weight">الوزن بالطن</label>
    <input id="edit-trip-weight" style={fieldStyle} required inputMode="decimal" disabled={busy}
      value={fields.weight_tonnes} onChange={e => change("weight_tonnes", e.target.value)} />
    <label htmlFor="edit-trip-rate">سعر المقاول للطن بالجنيه</label>
    <input id="edit-trip-rate" style={fieldStyle} required inputMode="decimal" disabled={busy}
      value={fields.contractor_rate_egp} onChange={e => change("contractor_rate_egp", e.target.value)} />
    <label style={{ display: "block", marginBottom: 12 }}>
      <input type="checkbox" checked={fields.same_rate} disabled={busy}
        onChange={e => change("same_rate", e.target.checked)} />{" "}نفس سعر العربية والمقاول
    </label>
    {!fields.same_rate && <>
      <label htmlFor="edit-trip-vehicle-rate">سعر العربية للطن بالجنيه</label>
      <input id="edit-trip-vehicle-rate" style={fieldStyle} required inputMode="decimal" disabled={busy}
        value={fields.vehicle_rate_egp} onChange={e => change("vehicle_rate_egp", e.target.value)} />
    </>}
    <label htmlFor="edit-trip-expense">المصاريف بالجنيه</label>
    <input id="edit-trip-expense" style={fieldStyle} required inputMode="decimal" disabled={busy}
      value={fields.expense_egp} onChange={e => change("expense_egp", e.target.value)} />
    <label htmlFor="edit-trip-origin">من</label>
    <input id="edit-trip-origin" style={fieldStyle} maxLength={160} disabled={busy}
      value={fields.origin} onChange={e => change("origin", e.target.value)} />
    <label htmlFor="edit-trip-destination">إلى</label>
    <input id="edit-trip-destination" style={fieldStyle} maxLength={160} disabled={busy}
      value={fields.destination} onChange={e => change("destination", e.target.value)} />
    <label htmlFor="edit-trip-notes">ملاحظات</label>
    <input id="edit-trip-notes" style={fieldStyle} maxLength={400} disabled={busy}
      value={fields.notes} onChange={e => change("notes", e.target.value)} />
    <label htmlFor="edit-trip-reason">سبب التعديل (إلزامي)</label>
    <input id="edit-trip-reason" style={fieldStyle} required maxLength={400} disabled={busy}
      value={fields.reason} onChange={e => change("reason", e.target.value)} />
    <button type="submit" disabled={busy || !readyId || !fields.reason.trim()}>
      حفظ تعديل النقلة
    </button>
  </form>;
}
