"use client";
import {useRef,useState,type FormEvent,type MutableRefObject} from 'react';
import ui from './workspace-ui.module.css';
import {PaymentPreview} from './payment-preview';
import {poundsToPiastres,assertDecimal} from '../../lib/ledger/amounts';
import type {LedgerWrite} from './workspace-data';
type Props={accounts:{vehicle_id:string;contractor_id:string}[];vehicles:{id:string;plate_number:string}[];
 contractors:{id:string;name:string}[];busy:boolean;revision?:number;paymentAccount:string;
 setPaymentAccount:(value:string)=>void;setMessage:(value:string)=>void;write:LedgerWrite;
 submitting:MutableRefObject<boolean>;onAddAccount:()=>void};
export function PaymentEntry({accounts,vehicles,contractors,busy,revision,paymentAccount,setPaymentAccount,setMessage,write,submitting,onAddAccount}:Props){
 const [paymentDate,setPaymentDate]=useState('');
 const [paymentAmount,setPaymentAmount]=useState('');
 const [paymentNotes,setPaymentNotes]=useState('');
 const drafts=useRef(new Map<string,Record<string,unknown>>());
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

 return (
    <section className={ui.surface} id="real-payment-form" aria-label="تسجيل دفعة نقدية">
      <h2>تسجيل دفعة نقدية</h2>
      <p>لا يُسمح بصرف أكثر من الرصيد المتاح في أي تاريخ لاحق؛ الخادم يرفض أي عجز.</p>
      <form className={ui.form} onSubmit={createPayment}>
        <div className={ui.fieldGroup}><label htmlFor="real-payment-account">حساب العربية والمقاول المسؤول</label>
        <select id="real-payment-account" className={ui.control} required value={paymentAccount}
          onChange={e => setPaymentAccount(e.target.value)} disabled={busy}>
          <option value="">اختر الحساب</option>
          {accounts.map(a => <option key={a.vehicle_id + "|" + a.contractor_id}
            value={a.vehicle_id + "|" + a.contractor_id}>
            {vehicles.find(v => v.id === a.vehicle_id)?.plate_number ?? a.vehicle_id}
            {" — "}{contractors.find(c => c.id === a.contractor_id)?.name ?? a.contractor_id}
          </option>)}
        </select></div>
        <div className={ui.fieldGroup}><label htmlFor="real-payment-date">تاريخ الدفع</label>
        <input id="real-payment-date" className={ui.control} type="date" required value={paymentDate}
          onChange={e => setPaymentDate(e.target.value)} disabled={busy} /></div>
        <div className={ui.fieldGroup}><label htmlFor="real-payment-amount">المبلغ بالجنيه</label>
        <input id="real-payment-amount" className={ui.control} required inputMode="decimal" placeholder="100"
          value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} disabled={busy} /></div>
        <div className={ui.actions}><button type="button" id="real-payment-account-add" onClick={() => onAddAccount()}
          disabled={busy} style={{marginBottom:12}}>+ حساب جديد</button></div>
        <div className={ui.fieldGroup}><label htmlFor="real-payment-notes">ملاحظات</label>
        <input id="real-payment-notes" className={ui.control} maxLength={400} value={paymentNotes}
          onChange={e => setPaymentNotes(e.target.value)} disabled={busy} /></div>
        <PaymentPreview account={paymentAccount} amount={paymentAmount} revision={revision}/>
        <div className={ui.actions}><button type="submit" disabled={busy}>حفظ الدفعة</button></div>
      </form>
    </section>
 );
}
