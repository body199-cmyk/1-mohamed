"use client";

import { useRef, useState, type FormEvent } from "react";
import { PaymentPreview } from "./payment-preview";
import { SearchableChoice } from "./searchable-choice";
import { QuickRecordModal, type QuickRecordInput } from "./quick-record-modal";
import { PaymentAccountModal } from "./payment-account-modal";
import { TripPreviewCard } from "../trips/trip-preview-card";
import type { WriteOperation } from "../../lib/ledger/operation-contract";
import { poundsToPiastres, assertDecimal, normalizeDecimalInput } from "../../lib/ledger/amounts";

type Contractor = { id: string; name: string; is_primary: boolean; is_archived: boolean };
type Vehicle = { id: string; plate_number: string; is_archived: boolean };
type Account = { vehicle_id: string; contractor_id: string };
type Props = {
  contractors: Contractor[];
  vehicles: Vehicle[];
  accounts: Account[];
  busy: boolean;
  revision?: number;
  onExit?: () => void;
  write: (operation: WriteOperation, payload: Record<string, unknown>) => Promise<boolean>;
};

const field: React.CSSProperties = { display: "block", padding: 10, width: "100%", maxWidth: 460, margin: "6px 0 12px" };
const section: React.CSSProperties = { border: "1px solid #d0d7e2", borderRadius: 12, padding: 16, marginBottom: 20 };

/**
 * Prepared real-data entry. SQL computes all totals and the responsible
 * contractor. Never accept browser-computed totals as authoritative.
 */
export function TransactionEntry({ contractors, vehicles, accounts, busy, write, revision, onExit }: Props) {
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
  const [tripOrigin, setTripOrigin] = useState("");
  const [tripDestination, setTripDestination] = useState("");
  const [paymentAccount, setPaymentAccount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [reuseDay,setReuseDay] = useState(false);
  const [quickModal, setQuickModal] = useState<null | "vehicle" | "contractor" | "payment">(null);
  const submitting = useRef(false);
  const [message, setMessage] = useState("");
  const drafts = useRef(new Map<string, Record<string, unknown>>());

  /** Inline creation from the choice fields; payloads keep a stable id across retries. */
  async function quickCreateVehicle(input: QuickRecordInput): Promise<string | null> {
    const payload = { id: "VEH-" + crypto.randomUUID(),
      plate_number: input.plate, driver_name: input.driver || null };
    return (await write("vehicle.create", payload)) ? payload.id : null;
  }
  async function quickCreateContractor(input: QuickRecordInput): Promise<string | null> {
    const payload = { id: "CTR-" + crypto.randomUUID(), name: input.name, start_mode: "DETAILS" };
    return (await write("contractor.create", payload)) ? payload.id : null;
  }

  async function createTrip(event: FormEvent) {
    event.preventDefault();
    if (busy || submitting.current) return;
    submitting.current = true;
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
        vehicle_rate_egp: vr, same_rate: sameRate, expense_egp: exp, notes: tripNotes.trim(),
        origin: tripOrigin.trim() || null, destination: tripDestination.trim() || null };
      const signature = "trip:" + JSON.stringify(source);
      const payload = drafts.current.get(signature) ?? { id: "TR-" + crypto.randomUUID(), ...source };
      drafts.current.set(signature, payload);
      if (await write("trip.create", payload)) {
        drafts.current.delete(signature);
        setWeight(""); setTripNotes("");
        if (!reuseDay) {setTripOrigin("");setTripDestination("");setContractorRate("");setVehicleRate("");setExpense("0");setTripVehicle("");setTripCounterparty("");}
        const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (button?.value === "exit") onExit?.();
        setMessage("تم حفظ النقلة بنجاح.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "بيانات النقلة غير صالحة."); }
    finally { submitting.current = false; }
  }

  async function createPayment(event: FormEvent) {
    event.preventDefault();
    if (busy || submitting.current) return;
    submitting.current = true;
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
        setPaymentAmount(""); setPaymentNotes(""); setMessage("تم حفظ الدفعة بنجاح.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "بيانات الدفعة غير صالحة."); }
    finally { submitting.current = false; }
  }

  return <>
    {message && <p role="status">{message}</p>}
    <section style={section}>
      <h2>تسجيل نقلة</h2>
      <p>اختر اتجاه الشغل، ثم أدخل الوزن والأسعار. يمكنك تسجيل أكثر من نقلة بأسعار مختلفة في اليوم نفسه.</p>
      <form onSubmit={createTrip}>
        <details open><summary>العربية والمقاول والتاريخ</summary>
        <SearchableChoice id="real-trip-vehicle" label="العربية" value={tripVehicle} onChange={setTripVehicle} disabled={busy}
          choices={vehicles.filter(v=>!v.is_archived).map(v=>({id:v.id,label:v.plate_number}))}
          onAdd={() => setQuickModal("vehicle")} addLabel="+ عربية جديدة"/>
        <SearchableChoice id="real-trip-counterparty" label="المقاول الطرف" value={tripCounterparty} onChange={setTripCounterparty} disabled={busy}
          choices={contractors.filter(c=>!c.is_archived&&!c.is_primary).map(c=>({id:c.id,label:c.name}))}
          onAdd={() => setQuickModal("contractor")} addLabel="+ مقاول جديد"/>
        <label htmlFor="real-trip-direction">اتجاه النقلة</label>
        <select id="real-trip-direction" style={field} value={direction}
          onChange={e => setDirection(e.target.value as typeof direction)} disabled={busy}>
          <option value="AHMED_SUPPLIES">أحمد هو المورّد</option>
          <option value="OTHER_SUPPLIES">المقاول الآخر هو المورّد</option>
        </select>
        <label htmlFor="real-trip-date">تاريخ النقلة (يسمح بالتاريخ القديم)</label>
        <input id="real-trip-date" style={field} type="date" required value={tripDate}
          onChange={e => {setTripDate(e.target.value);setContractorRate("");setVehicleRate("");setExpense("0");setTripOrigin("");setTripDestination("");}} disabled={busy} />
        </details>
        <details open><summary>الوزن والأسعار والمصاريف</summary>
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
        </details>
        <details><summary>خط السير والملاحظات</summary>
        <label htmlFor="real-trip-origin">من</label>
        <input id="real-trip-origin" style={field} maxLength={200} value={tripOrigin}
          onChange={e => setTripOrigin(e.target.value)} disabled={busy} />
        <label htmlFor="real-trip-destination">إلى</label>
        <input id="real-trip-destination" style={field} maxLength={200} value={tripDestination}
          onChange={e => setTripDestination(e.target.value)} disabled={busy} />
        <label htmlFor="real-trip-notes">ملاحظات</label>
        <input id="real-trip-notes" style={field} maxLength={400} value={tripNotes}
          onChange={e => setTripNotes(e.target.value)} disabled={busy} />
        </details>
        <label><input type="checkbox" checked={reuseDay} disabled={busy} onChange={e=>setReuseDay(e.target.checked)}/> استخدام نفس بيانات اليوم للنقلة التالية (اختياري)</label>
        <TripPreviewCard weightTonnes={normalizeDecimalInput(weight)} contractorRateEgp={normalizeDecimalInput(contractorRate)}
          vehicleRateEgp={normalizeDecimalInput(sameRate?contractorRate:vehicleRate)} expenseEgp={normalizeDecimalInput(expense)} direction={direction}
          counterpartyName={contractors.find(c=>c.id===tripCounterparty)?.name}
          vehiclePlate={vehicles.find(v=>v.id===tripVehicle)?.plate_number}/>
        <button type="submit" value="new" disabled={busy}>حفظ وإضافة نقلة جديدة</button>{" "}
        <button type="submit" value="exit" disabled={busy}>حفظ وخروج</button>
      </form>
      <QuickRecordModal kind="vehicle" open={quickModal === "vehicle"} busy={busy}
        existing={vehicles.filter(v => !v.is_archived).map(v => v.plate_number)}
        onClose={() => setQuickModal(null)}
        onCreate={quickCreateVehicle} onCreated={id => setTripVehicle(id)}/>
      <QuickRecordModal kind="contractor" open={quickModal === "contractor"} busy={busy}
        existing={contractors.filter(c => !c.is_archived).map(c => c.name)}
        onClose={() => setQuickModal(null)}
        onCreate={quickCreateContractor} onCreated={id => setTripCounterparty(id)}/>
    </section>
    <section style={section}>
      <h2>تسجيل دفعة نقدية</h2>
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
        <button type="button" id="real-payment-account-add" onClick={() => setQuickModal("payment")}
          disabled={busy} style={{marginBottom:12}}>+ حساب جديد</button>
        <label htmlFor="real-payment-notes">ملاحظات</label>
        <input id="real-payment-notes" style={field} maxLength={400} value={paymentNotes}
          onChange={e => setPaymentNotes(e.target.value)} disabled={busy} />
        <PaymentPreview account={paymentAccount} amount={paymentAmount} revision={revision}/>
        <button type="submit" disabled={busy}>حفظ الدفعة</button>
      </form>
      <PaymentAccountModal open={quickModal === "payment"} busy={busy}
        vehicles={vehicles.filter(v => !v.is_archived).map(v => ({ id: v.id, label: v.plate_number }))}
        contractors={contractors.filter(c => !c.is_archived).map(c => ({ id: c.id, label: c.name }))}
        activePlates={vehicles.filter(v => !v.is_archived).map(v => v.plate_number)}
        activeContractorNames={contractors.filter(c => !c.is_archived).map(c => c.name)}
        onClose={() => setQuickModal(null)}
        createVehicle={(plate, driver) => quickCreateVehicle({ plate, driver, name: "" })}
        createContractor={name => quickCreateContractor({ plate: "", driver: "", name })}
        ensureAccount={(vehicleId, contractorId) =>
          write("vehicle.account.ensure", { vehicle_id: vehicleId, contractor_id: contractorId })}
        onAccountReady={(vehicleId, contractorId) => setPaymentAccount(vehicleId + "|" + contractorId)}/>
    </section>
  </>;
}
