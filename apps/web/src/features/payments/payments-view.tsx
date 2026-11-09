"use client";

import React, { useMemo, useRef, useState } from "react";
import { formatEgpFromPiastres } from "@ledger/accounting";
import { useDemoStore } from "../../demo/demo-context";
import type { DemoPayment } from "../../demo/demo-types";
import {
  DEMO_PRIMARY_RESPONSIBLE_ID, cairoBusinessDate, cashResponsibleForTrip,
  buildCashLedger, parsePaymentEgp, type PaymentDraft,
} from "./cash-ledger";
import styles from "./payments.module.css";

function money(raw: string): string {
  const amount = formatEgpFromPiastres(raw);
  return amount.ok ? amount.amount + " ج.م" : "مبلغ غير صالح";
}
function editMoney(raw: string): string {
  const p = BigInt(raw);
  return (p / 100n).toString() + "." + (p % 100n).toString().padStart(2, "0");
}
const blankDraft = (vehicleId: string, responsibleContractorId: string, today: string): PaymentDraft => ({
  vehicleId, responsibleContractorId, paymentDate: today,
  amountEgp: "", linkedTripId: "", receiptNumber: "", notes: "",
});

export function PaymentsView() {
  const { contractors, vehicles, trips, cashOpenings, payments, paymentAudit,
    addPayment, editPayment, cancelPayment } = useDemoStore();
  const [today] = useState(cairoBusinessDate);
  const [responsibleId,setResponsibleId] = useState(DEMO_PRIMARY_RESPONSIBLE_ID);
  const [vehicleId,setVehicleId] = useState("V1");
  const [draft,setDraft] = useState<PaymentDraft>(() => blankDraft("V1",DEMO_PRIMARY_RESPONSIBLE_ID,cairoBusinessDate()));
  const [editId,setEditId] = useState<string|null>(null);
  const [editVersion,setEditVersion] = useState(0);
  const [editReason,setEditReason] = useState("");
  const [cancelId,setCancelId] = useState<string|null>(null);
  const [cancelReason,setCancelReason] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const submitting = useRef(false);

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const selectedContractor = contractors.find(c => c.id === responsibleId);
  const activeSelection = !!selectedVehicle && !selectedVehicle.isArchived &&
    (responsibleId === DEMO_PRIMARY_RESPONSIBLE_ID || (!!selectedContractor && !selectedContractor.isArchived));

  const accountPayments = useMemo(() => payments.filter(p =>
    p.vehicleId === vehicleId && p.responsibleContractorId === responsibleId
  ).sort((a,b)=> b.paymentDate.localeCompare(a.paymentDate) ||
    b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),
  [payments,vehicleId,responsibleId]);
  const linkedTrips = trips.filter(t =>
    t.vehicleId === vehicleId && cashResponsibleForTrip(t) === responsibleId
  );
  const ledger = useMemo(() => buildCashLedger({ trips, payments, cashOpenings },
    vehicleId,responsibleId,today),[trips,payments,cashOpenings,vehicleId,responsibleId,today]);

  const draftPreview = useMemo(() => {
    if (!ledger.ok) return null;
    // Use the same canonical amount parser for preview and save.
    const parsed = parsePaymentEgp(draft.amountEgp);
    if (!parsed) return null;
    const amount = BigInt(parsed);
    const oldAmount = editId ? BigInt(payments.find(p => p.id === editId)?.amountPiastres ?? "0") : 0n;
    const remaining = BigInt(ledger.value.balancePiastres) + oldAmount - amount;
    return { before: BigInt(ledger.value.balancePiastres) + oldAmount, amount, after: remaining };
  }, [ledger, draft.amountEgp, editId, payments]);

  function switchAccount(nextVehicle:string,nextResponsible:string) {
    setVehicleId(nextVehicle);
    setResponsibleId(nextResponsible);
    setDraft(blankDraft(nextVehicle,nextResponsible,today));
    setEditId(null);setEditReason("");setCancelId(null);setCancelReason("");
    setError("");setNotice("");
  }
  function loadEdit(payment:DemoPayment) {
    setDraft({
      vehicleId:payment.vehicleId,
      responsibleContractorId:payment.responsibleContractorId,
      paymentDate:payment.paymentDate,amountEgp:editMoney(payment.amountPiastres),
      linkedTripId:payment.linkedTripId,receiptNumber:payment.receiptNumber,notes:payment.notes,
    });
    setEditId(payment.id);setEditVersion(payment.version);setEditReason("");
    setCancelId(null);setCancelReason("");setError("");setNotice("");
  }
  function resetDraft() {
    setEditId(null);setEditReason("");
    setDraft(blankDraft(vehicleId,responsibleId,today));
  }
  function handleSubmit(event:React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current=true;
    try {
      setError("");setNotice("");
      if (!activeSelection) {setError("الحساب الحالي مؤرشف أو غير موجود. اختر حسابًا نشطًا.");return;}
      const result = editId
        ? editPayment(editId,editVersion,editReason,draft)
        : addPayment(draft);
      if (!result.ok) {setError(result.error);return;}
      setNotice(editId ? "تم تعديل الدفعة وتسجيل السبب في المعاينة." :
        "تم تسجيل الدفعة في المعاينة فقط، ولن تُحفظ بعد إعادة تحميل الصفحة.");
      resetDraft();
    } finally {submitting.current=false;}
  }
  function handleCancel(event:React.FormEvent) {
    event.preventDefault();
    if (!cancelId || submitting.current) return;
    submitting.current=true;
    try {
      setError("");setNotice("");
      const target = payments.find(p=>p.id===cancelId);
      const result = target
        ? cancelPayment(cancelId,target.version,cancelReason)
        : {ok:false as const,error:"الدفعة غير موجودة."};
      if (!result.ok) {setError(result.error);return;}
      setNotice("أُلغيت الدفعة مع الاحتفاظ بها وبسبب الإلغاء في السجل التجريبي.");
      setCancelId(null);setCancelReason("");resetDraft();
    } finally {submitting.current=false;}
  }

  return <div className={styles.page}>
    <header>
      <h1>دفعات العربيات — معاينة تجريبية</h1>
      <p className={styles.muted}>دفعات نقد العربية عند المقاول المسؤول فقط. لا تخصم من فرق شغل المقاولين، ولا تحفظ في قاعدة حقيقية حاليًا. تاريخ الدفع مستقل عن تاريخ النقلة.</p>
    </header>
    <section className={styles.filters} aria-label="اختيار حساب العربية">
      <label>المقاول المسؤول عن الدفع
        <select aria-label="المقاول المسؤول عن الدفع" value={responsibleId}
          onChange={e=>switchAccount(vehicleId,e.target.value)}>
          <option value={DEMO_PRIMARY_RESPONSIBLE_ID}>أحمد أبو علي (الأساسي)</option>
          {contractors.map(c=><option key={c.id} value={c.id}>
            {c.name}{c.isArchived ? " — مؤرشف" : ""}
          </option>)}
        </select>
      </label>
      <label>العربية
        <select aria-label="عربية الدفعات" value={vehicleId}
          onChange={e=>switchAccount(e.target.value,responsibleId)}>
          {vehicles.map(v=><option key={v.id} value={v.id}>
            {v.plateNumber}{v.isArchived ? " — مؤرشفة" : ""}
          </option>)}
        </select>
      </label>
    </section>

    {!ledger.ok ? <p role="alert" className={styles.error}>{ledger.error}</p> :
      <section className={styles.summary} aria-label="ملخص حساب نقد العربية">
        <div><span>افتتاحي النقد</span><strong>{money(ledger.value.openingPiastres)}</strong></div>
        <div><span>المتبقي النقدي للعربية</span><strong>{money(ledger.value.balancePiastres)}</strong></div>
        <p>حتى {today} بتوقيت القاهرة. الموجب مستحق للعربية؛ والسالب «على العربية» (قد ينتج عن تصحيح شغل مدفوع وفق D13).</p>
      </section>}

    <form className={styles.form} aria-label="نموذج دفعة العربية" onSubmit={handleSubmit}>
      <h2>{editId ? "تعديل دفعة محفوظة تجريبيًا" : "تسجيل دفعة جديدة"}</h2>
      <div className={styles.fields}>
        <label>تاريخ الدفع الحقيقي
          <input aria-label="تاريخ الدفع الحقيقي" type="date" required max={today}
            value={draft.paymentDate} onChange={e=>setDraft({...draft,paymentDate:e.target.value})} />
        </label>
        <label>المبلغ بالجنيه
          <input aria-label="المبلغ بالجنيه" inputMode="decimal" required placeholder="100.00"
            value={draft.amountEgp} onChange={e=>setDraft({...draft,amountEgp:e.target.value})} />
        </label>
        <label className={styles.wide}>ملاحظات (اختياري)
          <input aria-label="ملاحظات الدفعة" value={draft.notes}
            onChange={e=>setDraft({...draft,notes:e.target.value})} />
        </label>
        {editId && <label className={styles.wide}>سبب التعديل (إلزامي)
          <input aria-label="سبب تعديل الدفعة" required value={editReason}
            onChange={e=>setEditReason(e.target.value)} />
        </label>}
      </div>
      {draftPreview && <section aria-label="الرصيد بعد الدفعة" className={styles.summary}>
        <div><span>المتبقي قبل الدفعة {editId ? "بعد استبعاد قيمة الدفعة القديمة" : ""}</span><strong>{money(draftPreview.before.toString())}</strong></div>
        <div><span>قيمة الدفعة الجديدة</span><strong>{money(draftPreview.amount.toString())}</strong></div>
        <div><span>المتبقي للعربية بعد الدفعة</span><strong style={{fontSize:"1.6rem",color:draftPreview.after < 0n ? "#DC2626" : "var(--color-primary)"}}>{money(draftPreview.after.toString())}</strong></div>
        {draftPreview.after < 0n && <p role="alert">تحذير: الدفعة تتجاوز الرصيد الحالي، وقد تُرفض بسبب رصيد يوم سابق أيضًا.</p>}
      </section>}
      <p className={styles.muted}>D15: شغل نفس اليوم يُحسب قبل دفعاته. D16: لن تُقبل أي دفعة تجعل رصيد أي يوم وسيط بالسالب، حتى لو المتبقي الحالي كافٍ.</p>
      <div className={styles.buttons}>
        <button type="submit" className={styles.primary} disabled={!activeSelection || !ledger.ok}>
          {editId ? "حفظ تعديل الدفعة" : "تسجيل الدفعة"}
        </button>
        {editId && <button type="button" className={styles.secondary} onClick={resetDraft}>إلغاء التعديل</button>}
      </div>
    </form>

    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}

    <section aria-label="سجل دفعات الحساب" className={styles.section}>
      <h2>دفعات الحساب ({accountPayments.length})</h2>
      {accountPayments.length === 0 ? <p className={styles.muted}>لا توجد دفعات مسجلة في الحساب المختار.</p> :
        <div className={styles.scroll} role="region" aria-label="جدول دفعات العربية" tabIndex={0}>
          <table><thead><tr><th>تاريخ الدفع</th><th>المبلغ</th><th>الحالة</th><th>إجراءات</th></tr></thead>
            <tbody>{accountPayments.map(p=><tr key={p.id}>
              <td>{p.paymentDate}</td><td>{money(p.amountPiastres)}</td>
              
              <td>{p.isCancelled ? "ملغاة: "+p.cancelReason : "سارية"}</td>
              <td>{p.isCancelled ? "محفوظة للمراجعة" : <div className={styles.buttons}>
                <button type="button" className={styles.secondary} onClick={()=>loadEdit(p)}>تعديل الدفعة {p.id}</button>
                <button type="button" className={styles.secondary} onClick={()=>{setCancelId(p.id);setCancelReason("");setError("");setNotice("");}}>إلغاء الدفعة {p.id}</button>
              </div>}</td>
            </tr>)}</tbody></table>
        </div>}
      {cancelId && <form className={styles.cancel} aria-label="إلغاء دفعة محفوظة" onSubmit={handleCancel}>
        <p>هتُلغي الدفعة {cancelId} بدون مسح سجلها أو تاريخها.</p>
        <label>سبب إلغاء الدفعة
          <input aria-label="سبب إلغاء الدفعة" required value={cancelReason}
            onChange={e=>setCancelReason(e.target.value)} />
        </label>
        <div className={styles.buttons}>
          <button type="submit" className={styles.primary}>تأكيد إلغاء الدفعة</button>
          <button type="button" className={styles.secondary} onClick={()=>setCancelId(null)}>رجوع</button>
        </div>
      </form>}
    </section>

    {ledger.ok && <section className={styles.section} aria-label="حركات حساب العربية">
      <h2>حركات الحساب — الشغل والدفعات ({ledger.value.rows.length})</h2>
      <div className={styles.scroll} role="region" aria-label="جدول حركات النقد" tabIndex={0}>
        <table><thead><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th>القيمة</th><th>الرصيد بعد الحركة</th></tr></thead>
          <tbody>{ledger.value.rows.map(row=><tr key={row.type+"|"+row.id}>
            <td>{row.date}</td><td>{row.type==="WORK"?"مستحق شغل":"دفعة نقدية"}</td>
            <td>{row.label}</td><td>{money(row.amountPiastres)}</td>
            <td>{money(row.balancePiastres)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {ledger.value.rows.length===0 && <p className={styles.muted}>لا توجد حركات لهذا الحساب حتى تاريخ اليوم.</p>}
    </section>}

    {/* Audit events remain in the store for financial traceability; raw JSON is not shown to ordinary users. */}
  </div>;
}
