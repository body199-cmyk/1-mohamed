"use client";
import ui from "./workspace-ui.module.css";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import styles from "./trip-entry-design.module.css";
import daily from "./daily-work.module.css";
import { PaymentEntry } from "./payment-entry";
import { SharedWorkPanel, type SharedWorkValues } from "./shared-work-panel";
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
  refresh: () => Promise<void>;
  onDateChange?: (date: string) => void;
  recordedCount?:string|null;
  entryVisible?:boolean;
  children?:ReactNode;
  tripCounterpartyRequest?: { id: number; value: string } | null;
  paymentAccountRequest?: { id: number; value: string } | null;
};




/**
 * Prepared real-data entry. SQL computes all totals and the responsible
 * contractor. Never accept browser-computed totals as authoritative.
 */
export function TransactionEntry({ contractors, vehicles, accounts, busy, write, revision, refresh, onExit, tripCounterpartyRequest, paymentAccountRequest, onDateChange, recordedCount, entryVisible=true, children }: Props) {
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
  useEffect(() => {
    if (tripCounterpartyRequest?.value) {
      setTripCounterparty(tripCounterpartyRequest.value);
      setCustomize(true);
    }
  }, [tripCounterpartyRequest?.id]);
  useEffect(() => {
    if (paymentAccountRequest?.value) setPaymentAccount(paymentAccountRequest.value);
  }, [paymentAccountRequest?.id]);
  const [reuseDay,setReuseDay] = useState(false);
  const [appliedShared,setAppliedShared]=useState<SharedWorkValues|null>(null);
  const [customize,setCustomize]=useState(false);
  const [createdSharedContractor,setCreatedSharedContractor]=useState('');
  const sharedContractorCreation=useRef(false);
  const hasOverrides=!!appliedShared&&(tripCounterparty!==appliedShared.contractor||direction!==appliedShared.direction||tripDate!==appliedShared.date||contractorRate!==appliedShared.contractorRate||vehicleRate!==appliedShared.vehicleRate||sameRate!==appliedShared.sameRate||tripOrigin!==appliedShared.origin||tripDestination!==appliedShared.destination);
  const tripDirty=hasOverrides||!!(tripVehicle||weight||tripNotes||expense!=='0'||(!appliedShared&&(tripCounterparty||tripDate||direction!=="AHMED_SUPPLIES"||contractorRate||vehicleRate||!sameRate||tripOrigin||tripDestination)));
  useEffect(()=>{if(tripDate)onDateChange?.(tripDate);},[tripDate,onDateChange]);
  function copyShared(value:SharedWorkValues){
    setTripCounterparty(value.contractor);setDirection(value.direction);setTripDate(value.date);
    setContractorRate(value.contractorRate);setVehicleRate(value.vehicleRate);setSameRate(value.sameRate);
    setTripOrigin(value.origin);setTripDestination(value.destination);
  }
  function clearTrip(){setTripVehicle('');setWeight('');setExpense('0');setTripNotes('');setCustomize(false);}
  function applyShared(value:SharedWorkValues){setAppliedShared(value);copyShared(value);clearTrip();setReuseDay(true);requestAnimationFrame(()=>document.getElementById('real-trip-vehicle')?.focus());}
  function newShared(){
    setAppliedShared(null);clearTrip();setTripDate('');setTripCounterparty('');setContractorRate('');setVehicleRate('');
    setTripOrigin('');setTripDestination('');setReuseDay(false);setDirection('AHMED_SUPPLIES');setSameRate(true);
  }
  const [quickModal, setQuickModal] = useState<null | "vehicle" | "contractor" | "payment">(null);
  const submitting = useRef(false);
  const pendingTripFocus=useRef(false);
  useEffect(()=>{
    if(!busy&&pendingTripFocus.current){pendingTripFocus.current=false;document.getElementById('real-trip-vehicle')?.focus();}
  },[busy,weight,tripVehicle]);
  const [message, setMessage] = useState("");
  const drafts = useRef(new Map<string, Record<string, unknown>>());
  // Inline creation keeps one payload (and therefore one requestKey) per exact
  // input, so an unresolved retry never creates a second record. The draft is
  // dropped only on a confirmed result; changing the input starts a new draft.
  const quickDrafts = useRef(new Map<string, Record<string, unknown>>());

  /** Inline creation from the choice fields; payloads keep a stable id across retries. */
  async function quickCreateVehicle(input: QuickRecordInput): Promise<string | null> {
    const key = "vehicle.create:" + input.plate + "|" + input.driver;
    const cached = quickDrafts.current.get(key)
      ?? { id: "VEH-" + crypto.randomUUID(), plate_number: input.plate, driver_name: input.driver || null };
    quickDrafts.current.set(key, cached);
    const confirmed = await write("vehicle.create", cached);
    if (confirmed) quickDrafts.current.delete(key);
    return confirmed ? String(cached.id) : null;
  }
  async function quickCreateContractor(input: QuickRecordInput): Promise<string | null> {
    const key = "contractor.create:" + input.name;
    const cached = quickDrafts.current.get(key)
      ?? { id: "CTR-" + crypto.randomUUID(), name: input.name, start_mode: "DETAILS" };
    quickDrafts.current.set(key, cached);
    const confirmed = await write("contractor.create", cached);
    if (confirmed) quickDrafts.current.delete(key);
    return confirmed ? String(cached.id) : null;
  }

  // A confirmed creation stays pending until the refreshed lists contain the
  // record; only then is it selected. A failed refresh never reports a failed
  // creation and never re-creates the record. Each pending result closes only
  // its own dialog, so a later refresh cannot close a dialog the user opened
  // meanwhile.
  const [pendingVehicle, setPendingVehicle] = useState<string | null>(null);
  const [pendingContractor, setPendingContractor] = useState<{id:string;target:"shared"|"trip"}|null>(null);
  const [pendingAccount, setPendingAccount] = useState<{ vehicleId: string; contractorId: string } | null>(null);
  useEffect(() => {
    if (pendingVehicle && vehicles.some(v => v.id === pendingVehicle)) {
      setTripVehicle(pendingVehicle); setPendingVehicle(null);
      setQuickModal(modal => modal === "vehicle" ? null : modal);
    }
    if (pendingContractor && contractors.some(c => c.id === pendingContractor.id)) {
      if(pendingContractor.target==='shared')setCreatedSharedContractor(pendingContractor.id);
      else setTripCounterparty(pendingContractor.id);
      sharedContractorCreation.current=false;
      setPendingContractor(null);
      setQuickModal(modal => modal === "contractor" ? null : modal);
    }
    if (pendingAccount && accounts.some(a => a.vehicle_id === pendingAccount.vehicleId
        && a.contractor_id === pendingAccount.contractorId)) {
      setPaymentAccount(pendingAccount.vehicleId + "|" + pendingAccount.contractorId);
      setPendingAccount(null);
      setQuickModal(modal => modal === "payment" ? null : modal);
    }
  }, [vehicles, contractors, accounts, pendingVehicle, pendingContractor, pendingAccount]);

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
        const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        pendingTripFocus.current=button?.value!=="exit";
        if(appliedShared){copyShared(appliedShared);clearTrip();}
        else {setWeight("");setTripNotes("");}
        if (!appliedShared && !reuseDay) {setTripOrigin("");setTripDestination("");setContractorRate("");setVehicleRate("");setExpense("0");setTripVehicle("");setTripCounterparty("");}
        if (button?.value === "exit") onExit?.();
        setMessage("تم حفظ النقلة بنجاح.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "بيانات النقلة غير صالحة."); }
    finally { submitting.current = false; }
  }


  return <div className={entryVisible?daily.layout:undefined}>
    <div hidden={!entryVisible}>
    <a className={daily.paymentJump} href="#real-payment-form">الانتقال لتسجيل دفعة نقدية</a>
    {message && <p role="status">{message}</p>}
    <SharedWorkPanel contractors={contractors} busy={busy} applied={appliedShared} dirty={tripDirty}
      createdContractor={createdSharedContractor} onApply={applyShared} onNew={newShared}
      onManual={()=>{setAppliedShared(null);setReuseDay(false);setCustomize(true);}}
      onAddContractor={()=>{sharedContractorCreation.current=true;setQuickModal('contractor');}}/>
    <section className={styles.tripSurface} aria-label="تسجيل نقلة">
      <header className={styles.heading}><div><h2>تسجيل نقلة</h2>
      <p>{appliedShared?'اختَر العربية وأدخل الوزن والمصاريف؛ بيانات الشغل المعتمدة مطبّقة.':'إدخال منفرد: راجع المقاول والتاريخ والأسعار لكل نقلة، أو اعتمد المشترك أعلاه.'}</p></div>
      <span className={styles.headingIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg></span></header>
      <form onSubmit={createTrip} className={styles.tripForm}>
        <div className={styles.entryFields}>
        <div className={daily.compactFields}>
        <SearchableChoice className={styles.choice} id="real-trip-vehicle" label="العربية" value={tripVehicle} onChange={setTripVehicle} disabled={busy}
          choices={vehicles.filter(v=>!v.is_archived).map(v=>({id:v.id,label:v.plate_number}))}
          onAdd={() => setQuickModal("vehicle")} addLabel="+ عربية جديدة"/>
        <div className={styles.formField}><label htmlFor="real-trip-weight">الوزن بالطن (3 خانات عشرية)</label>
        <input id="real-trip-weight" className={styles.control} required inputMode="decimal" placeholder="12.500"
          value={weight} onChange={e => setWeight(e.target.value)} disabled={busy} /></div>
        <div className={styles.formField}><label htmlFor="real-trip-expense">مصاريف النقلة بالجنيه</label>
        <input id="real-trip-expense" className={styles.control} required inputMode="decimal"
          value={expense} onChange={e => setExpense(e.target.value)} disabled={busy} /></div>
        </div>
        <details open={!appliedShared||customize} onToggle={e=>{if(appliedShared)setCustomize(e.currentTarget.open);}}>
          <summary>{appliedShared?'تفاصيل وأسعار مختلفة لهذه النقلة فقط':'بيانات النقلة والأسعار'}{hasOverrides?' — توجد تعديلات خاصة':''}</summary><div className={styles.fieldGrid}>
        <SearchableChoice className={styles.choice} id="real-trip-counterparty" label="المقاول الطرف" value={tripCounterparty} onChange={setTripCounterparty} disabled={busy}
          choices={contractors.filter(c=>!c.is_archived&&!c.is_primary).map(c=>({id:c.id,label:c.name}))}
          onAdd={() => {sharedContractorCreation.current=false;setQuickModal("contractor");}} addLabel="+ مقاول جديد"/>
        <div className={styles.formField}><label htmlFor="real-trip-direction">اتجاه النقلة</label>
        <select id="real-trip-direction" className={styles.control} value={direction}
          onChange={e => setDirection(e.target.value as typeof direction)} disabled={busy}>
          <option value="AHMED_SUPPLIES">أحمد هو المورّد</option>
          <option value="OTHER_SUPPLIES">المقاول الآخر هو المورّد</option>
        </select></div>
        <div className={styles.formField}><label htmlFor="real-trip-date">تاريخ النقلة (يسمح بالتاريخ القديم)</label>
        <input id="real-trip-date" className={styles.control} type="date" required value={tripDate}
          onChange={e => {setTripDate(e.target.value);setContractorRate("");setVehicleRate("");setExpense("0");setTripOrigin("");setTripDestination("");}} disabled={busy} /></div>

        <div className={styles.formField}><label htmlFor="real-trip-contractor-rate">سعر المقاول بالجنيه للطن</label>
        <input id="real-trip-contractor-rate" className={styles.control} required inputMode="decimal"
          value={contractorRate} onChange={e => setContractorRate(e.target.value)} disabled={busy} /></div>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={sameRate} onChange={e => setSameRate(e.target.checked)} disabled={busy} />
          {" "}نفس سعر المقاول والعربية
        </label>
        {!sameRate && <>
          <div className={styles.formField}><label htmlFor="real-trip-vehicle-rate">سعر العربية بالجنيه للطن</label>
          <input id="real-trip-vehicle-rate" className={styles.control} required inputMode="decimal"
            value={vehicleRate} onChange={e => setVehicleRate(e.target.value)} disabled={busy} /></div>
        </>}

        <div className={styles.formField}><label htmlFor="real-trip-origin">من</label>
        <input id="real-trip-origin" className={styles.control} maxLength={200} value={tripOrigin}
          onChange={e => setTripOrigin(e.target.value)} disabled={busy} /></div>
        <div className={styles.formField}><label htmlFor="real-trip-destination">إلى</label>
        <input id="real-trip-destination" className={styles.control} maxLength={200} value={tripDestination}
          onChange={e => setTripDestination(e.target.value)} disabled={busy} /></div>
        <div className={styles.formField}><label htmlFor="real-trip-notes">ملاحظات</label>
        <input id="real-trip-notes" className={styles.control} maxLength={400} value={tripNotes}
          onChange={e => setTripNotes(e.target.value)} disabled={busy} /></div>
        </div></details>
        {!appliedShared&&<label className={styles.checkboxRow}><input type="checkbox" checked={reuseDay} disabled={busy} onChange={e=>setReuseDay(e.target.checked)}/> استخدام نفس بيانات اليوم للنقلة التالية (اختياري)</label>}
        </div><aside className={styles.summaryColumn} aria-label="معاينة النقلة">
        <TripPreviewCard entryLayout weightTonnes={normalizeDecimalInput(weight)} contractorRateEgp={normalizeDecimalInput(contractorRate)}
          vehicleRateEgp={normalizeDecimalInput(sameRate?contractorRate:vehicleRate)} expenseEgp={normalizeDecimalInput(expense)} direction={direction}
          counterpartyName={contractors.find(c=>c.id===tripCounterparty)?.name}
          responsibleContractorName={direction === "AHMED_SUPPLIES"
            ? contractors.find(c=>c.is_primary)?.name
            : contractors.find(c=>c.id===tripCounterparty)?.name}
          vehiclePlate={vehicles.find(v=>v.id===tripVehicle)?.plate_number}/>
        </aside>
        <footer className={styles.actions}>
          <p>راجع بيانات النقلة ومعاينة الحساب قبل الحفظ.{recordedCount!=null&&<strong> المسجّل في التاريخ المختار: {recordedCount} نقلة.</strong>}</p>
          <div className={styles.actionButtons}>
            <button className={styles.primaryButton} type="submit" value="new" disabled={busy}>حفظ وإضافة نقلة جديدة</button>
            <button className={styles.secondaryButton} data-secondary type="submit" value="exit" disabled={busy}>حفظ وخروج</button>
          </div>
        </footer>
      </form>
      <QuickRecordModal kind="vehicle" open={quickModal === "vehicle"} busy={busy}
        existing={vehicles.filter(v => !v.is_archived).map(v => v.plate_number)}
        onRefreshLists={() => void refresh()}
        onClose={() => setQuickModal(null)}
        onCreate={quickCreateVehicle} onCreated={id => setPendingVehicle(id)}/>
      <QuickRecordModal kind="contractor" open={quickModal === "contractor"} busy={busy}
        existing={contractors.filter(c => !c.is_archived).map(c => c.name)}
        onRefreshLists={() => void refresh()}
        onClose={() => {sharedContractorCreation.current=false;setPendingContractor(null);setQuickModal(null);}}
        onCreate={quickCreateContractor} onCreated={id => setPendingContractor({id,target:sharedContractorCreation.current?"shared":"trip"})}/>
    </section>
    </div>
    {children}
    <div hidden={!entryVisible} className={daily.paymentArea}>
    <PaymentEntry accounts={accounts} vehicles={vehicles} contractors={contractors} busy={busy} revision={revision}
      paymentAccount={paymentAccount} setPaymentAccount={setPaymentAccount} setMessage={setMessage}
      write={write} submitting={submitting} onAddAccount={() => setQuickModal("payment")}/>
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
        onAccountReady={(vehicleId, contractorId) => setPendingAccount({ vehicleId, contractorId })}
        onRefreshLists={() => void refresh()}/>
    </div>
  </div>;
}
