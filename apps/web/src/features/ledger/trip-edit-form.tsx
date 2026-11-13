"use client";

import { useEffect, useState, type FormEvent } from "react";
import { assertDecimal, milliTonnesToTonnes, piastresToPounds } from "../../lib/ledger/amounts";
import type { WriteOperation } from "../../lib/ledger/operation-contract";

type Contractor = { id: string; name: string; is_primary: boolean };
type Vehicle = { id: string; plate_number: string };
type Trip = { id: string; version: number; is_cancelled: boolean; [key: string]: unknown };
type Props = {
  trip: Trip;
  contractors: Contractor[];
  vehicles: Vehicle[];
  busy: boolean;
  write: (operation: WriteOperation, payload: Record<string, unknown>) => Promise<boolean>;
};
const field: React.CSSProperties = { display: "block", padding: 10, width: "100%", maxWidth: 460, margin: "6px 0 12px" };
const str = (value: unknown) => typeof value === "string" ? value : "";

export function TripEditForm({ trip, contractors, vehicles, busy, write }: Props) {
  const [date, setDate] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [direction, setDirection] = useState("AHMED_SUPPLIES");
  const [weight, setWeight] = useState("");
  const [contractorRate, setContractorRate] = useState("");
  const [vehicleRate, setVehicleRate] = useState("");
  const [sameRate, setSameRate] = useState(true);
  const [expense, setExpense] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [receipt, setReceipt] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setDate(str(trip.trip_date));
    setVehicleId(str(trip.vehicle_id));
    setCounterpartyId(str(trip.counterparty_contractor_id));
    setDirection(str(trip.direction) || "AHMED_SUPPLIES");
    setWeight(milliTonnesToTonnes(str(trip.weight_milli_tonnes)));
    setContractorRate(piastresToPounds(str(trip.contractor_rate_piastres)));
    setVehicleRate(piastresToPounds(str(trip.vehicle_rate_piastres)));
    setSameRate(trip.same_rate !== false);
    setExpense(piastresToPounds(str(trip.expense_piastres)));
    setOrigin(str(trip.origin)); setDestination(str(trip.destination));
    setReceipt(str(trip.receipt_number)); setNotes(str(trip.notes));
    setReason(""); setMessage("");
  }, [trip]);

  async function save(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try {
      if (!date || !vehicleId || !counterpartyId || !reason.trim()) {
        throw new Error("التاريخ والعربية والمقاول وسبب التعديل مطلوبين.");
      }
      const w = assertDecimal(weight, 3, true);
      const cr = assertDecimal(contractorRate, 2, false);
      const vr = sameRate ? cr : assertDecimal(vehicleRate, 2, false);
      const exp = assertDecimal(expense, 2, false);
      if (await write("trip.update", {
        id: trip.id, expected_version: trip.version, reason: reason.trim(),
        trip_date: date, vehicle_id: vehicleId, counterparty_contractor_id: counterpartyId,
        direction, weight_tonnes: w, contractor_rate_egp: cr,
        vehicle_rate_egp: vr, same_rate: sameRate, expense_egp: exp,
        origin: origin.trim(), destination: destination.trim(),
        receipt_number: receipt.trim(), notes: notes.trim()
      })) setMessage("تم حفظ التعديل. حمّل التقرير من جديد للتأكد من المستحقات.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "بيانات النقلة غير صالحة.");
    }
  }

  return <form onSubmit={save}>
    <h3>تعديل النقلة المختارة</h3>
    <p>يتم الاحتفاظ بالتاريخ المالي والتدقيق، وإعادة حساب الإجماليات داخل قاعدة البيانات.</p>
    <label htmlFor="trip-edit-date">التاريخ</label>
    <input id="trip-edit-date" style={field} type="date" required value={date}
      onChange={e => setDate(e.target.value)} disabled={busy} />
    <label htmlFor="trip-edit-vehicle">العربية</label>
    <select id="trip-edit-vehicle" style={field} required value={vehicleId}
      onChange={e => setVehicleId(e.target.value)} disabled={busy}>
      <option value="">اختر العربية</option>
      {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
    </select>
    <label htmlFor="trip-edit-counterparty">المقاول الطرف</label>
    <select id="trip-edit-counterparty" style={field} required value={counterpartyId}
      onChange={e => setCounterpartyId(e.target.value)} disabled={busy}>
      <option value="">اختر المقاول</option>
      {contractors.filter(c => !c.is_primary).map(c =>
        <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
    <label htmlFor="trip-edit-direction">الاتجاه</label>
    <select id="trip-edit-direction" style={field} value={direction}
      onChange={e => setDirection(e.target.value)} disabled={busy}>
      <option value="AHMED_SUPPLIES">أحمد هو المورّد</option>
      <option value="OTHER_SUPPLIES">المقاول الآخر هو المورّد</option>
    </select>
    <label htmlFor="trip-edit-weight">الوزن بالطن</label>
    <input id="trip-edit-weight" style={field} required inputMode="decimal" value={weight}
      onChange={e => setWeight(e.target.value)} disabled={busy} />
    <label htmlFor="trip-edit-contractor-rate">سعر المقاول بالجنيه للطن</label>
    <input id="trip-edit-contractor-rate" style={field} required inputMode="decimal" value={contractorRate}
      onChange={e => setContractorRate(e.target.value)} disabled={busy} />
    <label style={{ display: "block", marginBottom: 12 }}>
      <input type="checkbox" checked={sameRate} onChange={e => setSameRate(e.target.checked)} disabled={busy} />
      {" "}نفس سعر المقاول والعربية
    </label>
    {!sameRate && <>
      <label htmlFor="trip-edit-vehicle-rate">سعر العربية بالجنيه للطن</label>
      <input id="trip-edit-vehicle-rate" style={field} required inputMode="decimal" value={vehicleRate}
        onChange={e => setVehicleRate(e.target.value)} disabled={busy} />
    </>}
    <label htmlFor="trip-edit-expense">المصاريف بالجنيه</label>
    <input id="trip-edit-expense" style={field} required inputMode="decimal" value={expense}
      onChange={e => setExpense(e.target.value)} disabled={busy} />
    <label htmlFor="trip-edit-origin">من</label>
    <input id="trip-edit-origin" style={field} maxLength={160} value={origin}
      onChange={e => setOrigin(e.target.value)} disabled={busy} />
    <label htmlFor="trip-edit-destination">إلى</label>
    <input id="trip-edit-destination" style={field} maxLength={160} value={destination}
      onChange={e => setDestination(e.target.value)} disabled={busy} />
    <label htmlFor="trip-edit-receipt">مرجع النقلة (إن وُجد)</label>
    <input id="trip-edit-receipt" style={field} maxLength={100} value={receipt}
      onChange={e => setReceipt(e.target.value)} disabled={busy} />
    <label htmlFor="trip-edit-notes">ملاحظات</label>
    <input id="trip-edit-notes" style={field} maxLength={400} value={notes}
      onChange={e => setNotes(e.target.value)} disabled={busy} />
    <label htmlFor="trip-edit-reason">سبب التعديل (إلزامي)</label>
    <input id="trip-edit-reason" style={field} maxLength={400} required value={reason}
      onChange={e => setReason(e.target.value)} disabled={busy} />
    <button type="submit" disabled={busy || !reason.trim()}>حفظ تعديل النقلة</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
