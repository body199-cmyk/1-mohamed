"use client";

import { useRef, useState, type FormEvent } from "react";
import type { WriteOperation } from "../../lib/ledger/operation-contract";
import { poundsToPiastres, assertDecimal } from "../../lib/ledger/amounts";

type Contractor = { id: string; name: string; is_primary: boolean; is_archived: boolean };
type Vehicle = { id: string; plate_number: string; is_archived: boolean };
type Account = { vehicle_id: string; contractor_id: string };
type Props = {
  contractors: Contractor[];
  vehicles: Vehicle[];
  accounts: Account[];
  busy: boolean;
  write: (operation: WriteOperation, payload: Record<string, unknown>) => Promise<boolean>;
};

const field: React.CSSProperties = { display: "block", padding: 10, width: "100%", maxWidth: 460, margin: "6px 0 12px" };
const section: React.CSSProperties = { border: "1px solid #d0d7e2", borderRadius: 12, padding: 16, marginBottom: 20 };

/**
 * Prepared real-data entry. SQL computes all totals and the responsible
 * contractor. Never accept browser-computed totals as authoritative.
 */
export function TransactionEntry({ contractors, vehicles, accounts, busy, write }: Props) {
  const [tripVehicle, setTripVehicle] = useState("");
  const [tripCounterparty, setTripCounterparty] = useState("");
  const [direction, setDirection] = useState<"AHMED_SUPPLIES" | "OTHER_SUPPLIES">("AHMED_SUPPLIES");
  const [tripDate, setTripDate] = useState("");
  const [weight, setWeight] = useState("");
  const [contractorRate, setContractorRate] = useState("");
  const [sameRate, setSameRate] = useState(true);
  const [vehicleRate, setVehicleRate] = useState("");
  const [expense, setExpense] = useState("0");
  const [tripNotes, setTripNotes] = useState("");
  const [paymentAccount, setPaymentAccount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [message, setMessage] = useState("");
  const drafts = useRef(new Map<string, Record<string, unknown>>());

  async function createTrip(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      if (!tripVehicle || !tripCounterparty || !tripDate) throw new Error("حدد العربية والمقاول والتاريخ.");
      if (contractors.find(c => c.id === tripCounterparty)?.is_primary) {
        throw new Error("اختر المقاول الطرف، وليس أحمد صاحب الحساب.");
      }
      const w = assertDecimal(weight, 3, true);
      const cr = assertDecimal(contractorRate, 2, false);
      const vr = sameRate ? cr : assertDecimal(vehicleRate, 2, false);
      const exp = assertDecimal(expense, 2, false);
      const source = { vehicle_id: tripVehicle, counterparty_contractor_id: tripCounterparty,
        direction, trip_date: tripDate, weight_tonnes: w, contractor_rate_egp: cr,
        vehicle_rate_egp: vr, same_rate: sameRate, expense_egp: exp, notes: tripNotes.trim() };
      const signature = "trip:" + JSON.stringify(source);
      const payload = drafts.current.get(signature) ?? { id: "TR-" + crypto.randomUUID(), ...source };
      drafts.current.set(signature, payload);
      if (await write("trip.create", payload)) {
        drafts.current.delete(signature);
        setWeight(""); setTripNotes(""); setMessage("تم إرسال النقلة للحفظ في الخادم.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "بيانات النقلة غير صالحة."); }
  }

  async function createPayment(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const [vehicle_id, responsible_contractor_id] = paymentAccount.split("|");
      if (!vehicle_id || !responsible_contractor_id || !paymentDate) {
        throw new Error("حدد حساب العربية وتاريخ الدفع.");
      }
      const amount = assertDecimal(paymentAmount, 2, true);
      // Exact bigint validation; no JavaScript floating-point money.
      poundsToPiastres(amount);
      const source = { vehicle_id, responsible_contractor_id,
        payment_date: paymentDate, amount_egp: amount, notes: paymentNotes.trim() };
      const signature = "payment:" + JSON.stringify(source);
      const payload = drafts.current.get(signature) ?? { id: "PAY-" + crypto.randomUUID(), ...source };
      drafts.current.set(signature, payload);
      if (await write("payment.create", payload)) {
        drafts.current.delete(signature);
        setPaymentAmount(""); setPaymentNotes(""); setMessage("تم إرسال الدفعة للحفظ في الخادم.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "بيانات الدفعة غير صالحة."); }
  }

  return <>
    {message && <p role="status">{message}</p>}
    <section style={section}>
      <h2>تسجيل نقلة حقيقية</h2>
      <p>المسؤول عن نقدية العربية والإجماليات بيتحددوا في قاعدة البيانات حسب اتجاه النقلة، مش من المتصفح.</p>
      <form onSubmit={createTrip}>
        <label htmlFor="real-trip-vehicle">العربية</label>
        <select id="real-trip-vehicle" style={field} required value={tripVehicle}
          onChange={e => setTripVehicle(e.target.value)} disabled={busy}>
          <option value="">اختر العربية</option>
          {vehicles.filter(v => !v.is_archived).map(v =>
            <option key={v.id} value={v.id}>{v.plate_number}</option>)}
        </select>
        <label htmlFor="real-trip-counterparty">المقاول الطرف</label>
        <select id="real-trip-counterparty" style={field} required value={tripCounterparty}
          onChange={e => setTripCounterparty(e.target.value)} disabled={busy}>
          <option value="">اختر المقاول</option>
          {contractors.filter(c => !c.is_archived && !c.is_primary).map(c =>
            <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label htmlFor="real-trip-direction">اتجاه النقلة</label>
        <select id="real-trip-direction" style={field} value={direction}
          onChange={e => setDirection(e.target.value as typeof direction)} disabled={busy}>
          <option value="AHMED_SUPPLIES">أحمد هو المورّد</option>
          <option value="OTHER_SUPPLIES">المقاول الآخر هو المورّد</option>
        </select>
        <label htmlFor="real-trip-date">تاريخ النقلة (يسمح بالتاريخ القديم)</label>
        <input id="real-trip-date" style={field} type="date" required value={tripDate}
          onChange={e => setTripDate(e.target.value)} disabled={busy} />
        <label htmlFor="real-trip-weight">الوزن بالطن (3 خانات عشرية)</label>
        <input id="real-trip-weight" style={field} required inputMode="decimal" placeholder="12.500"
          value={weight} onChange={e => setWeight(e.target.value)} disabled={busy} />
        <label htmlFor="real-trip-contractor-rate">سعر المقاول بالجنيه للطن</label>
        <input id="real-trip-contractor-rate" style={field} required inputMode="decimal"
          value={contractorRate} onChange={e => setContractorRate(e.target.value)} disabled={busy} />
        <label style={{ display: "block", marginBottom: 12 }}>
          <input type="checkbox" checked={sameRate} onChange={e => setSameRate(e.target.checked)} disabled={busy} />
          {" "}نفس سعر المقاول والعربية
        </label>
        {!sameRate && <>
          <label htmlFor="real-trip-vehicle-rate">سعر العربية بالجنيه للطن</label>
          <input id="real-trip-vehicle-rate" style={field} required inputMode="decimal"
            value={vehicleRate} onChange={e => setVehicleRate(e.target.value)} disabled={busy} />
        </>}
        <label htmlFor="real-trip-expense">مصاريف النقلة بالجنيه</label>
        <input id="real-trip-expense" style={field} required inputMode="decimal"
          value={expense} onChange={e => setExpense(e.target.value)} disabled={busy} />
        <label htmlFor="real-trip-notes">ملاحظات</label>
        <input id="real-trip-notes" style={field} maxLength={400} value={tripNotes}
          onChange={e => setTripNotes(e.target.value)} disabled={busy} />
        <button type="submit" disabled={busy}>حفظ النقلة</button>
      </form>
    </section>
    <section style={section}>
      <h2>تسجيل دفعة نقدية حقيقية</h2>
      <p>لا يُسمح بصرف أكثر من الرصيد المتاح في أي تاريخ لاحق؛ الخادم يرفض أي عجز.</p>
      <form onSubmit={createPayment}>
        <label htmlFor="real-payment-account">حساب العربية والمقاول المسؤول</label>
        <select id="real-payment-account" style={field} required value={paymentAccount}
          onChange={e => setPaymentAccount(e.target.value)} disabled={busy}>
          <option value="">اختر الحساب</option>
          {accounts.map(a => <option key={a.vehicle_id + "|" + a.contractor_id}
            value={a.vehicle_id + "|" + a.contractor_id}>
            {vehicles.find(v => v.id === a.vehicle_id)?.plate_number ?? a.vehicle_id}
            {" — "}{contractors.find(c => c.id === a.contractor_id)?.name ?? a.contractor_id}
          </option>)}
        </select>
        <label htmlFor="real-payment-date">تاريخ الدفع</label>
        <input id="real-payment-date" style={field} type="date" required value={paymentDate}
          onChange={e => setPaymentDate(e.target.value)} disabled={busy} />
        <label htmlFor="real-payment-amount">المبلغ بالجنيه</label>
        <input id="real-payment-amount" style={field} required inputMode="decimal" placeholder="100.00"
          value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} disabled={busy} />
        <label htmlFor="real-payment-notes">ملاحظات</label>
        <input id="real-payment-notes" style={field} maxLength={400} value={paymentNotes}
          onChange={e => setPaymentNotes(e.target.value)} disabled={busy} />
        <button type="submit" disabled={busy}>حفظ الدفعة</button>
      </form>
    </section>
  </>;
}
