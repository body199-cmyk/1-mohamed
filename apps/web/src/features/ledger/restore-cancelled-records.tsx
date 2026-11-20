"use client";

import { useEffect, useRef, useState } from "react";
import ui from "./workspace-ui.module.css";
import { inspectLocalPortableBackup } from "../../lib/backup/inspect-local";
import { readBoundedPortableResponse } from "../../lib/backup/read-bounded";
import type { WriteOperation } from "../../lib/ledger/operation-contract";

type Kind = "trip" | "payment";
type Cancelled = {
  id: string;
  version: number;
  date: string;
  account: string;
  piastres: string;
  reason: string;
};

function validRow(r: unknown): r is Record<string, unknown> {
  return !!r && typeof r === "object" && !Array.isArray(r);
}

function displayRows(data: unknown, kind: Kind): Cancelled[] {
  if (!validRow(data) || !validRow(data.tables)) throw Error("بيانات النسخة غير صالحة.");
  const rows = data.tables[kind === "trip" ? "trips" : "payments"];
  if (!Array.isArray(rows)) throw Error("جدول السجلات غير متاح.");
  return rows.filter(validRow).filter(r => r.is_cancelled === true)
    .map(r => {
      if (typeof r.id !== "string" || !r.id.trim() ||
          typeof r.version !== "number" || !Number.isSafeInteger(r.version) || r.version < 1) {
        throw Error("سجل ملغى بلا معرّف أو إصدار صالح.");
      }
      return {
        id: r.id, version: r.version,
        date: String(r[kind === "trip" ? "trip_date" : "payment_date"] ?? ""),
        account: String(r.vehicle_id ?? "")+" / "+String(r.responsible_contractor_id ?? ""),
        piastres: String(r[kind === "trip" ? "vehicle_total_piastres" : "amount_piastres"] ?? ""),
        reason: String(r.cancel_reason ?? ""),
      };
    })
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0, 5000);
}

export function RestoreCancelledRecords() {
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef<{signature:string;key:string}|null>(null);
  const [kind, setKind] = useState<Kind>("trip");
  const [rows, setRows] = useState<Cancelled[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => abortRef.current?.abort(), []);
  function clearSelection() {
    setSelected(""); setReason(""); setConfirm(""); setAcknowledge(false);
    requestRef.current = null;
  }
  async function refresh(nextKind:Kind=kind) {
    abortRef.current?.abort();
    const controller=new AbortController();abortRef.current=controller;
    setBusy(true);setLoaded(false);setRows([]);clearSelection();setNotice("");setError("");
    try {
      // Existing owner-only snapshot endpoint, not a new privileged export.
      const response=await fetch("/api/backup/export?format=json",{
        cache:"no-store",credentials:"same-origin",signal:controller.signal,
      });
      const raw=await readBoundedPortableResponse(response);
      await inspectLocalPortableBackup(raw);
      if(!controller.signal.aborted){setRows(displayRows(JSON.parse(raw),nextKind));setLoaded(true);}
    } catch(cause) {
      if(!controller.signal.aborted) setError(cause instanceof Error?cause.message:"تعذر قراءة السجلات الملغاة.");
    } finally {
      if(!controller.signal.aborted) setBusy(false);
    }
  }
  const item=rows.find(r=>r.id===selected);
  async function reactivate() {
    if(!item || busy || confirm.trim()!=="استعادة" || !acknowledge ||
      reason.trim().length<8 || reason.length>400) return;
    const operation:WriteOperation=kind==="trip"?"trip.reactivate":"payment.reactivate";
    const payload={id:item.id,expected_version:item.version,reason:reason.trim()};
    const signature=JSON.stringify({operation,payload});
    if(requestRef.current?.signature!==signature){
      requestRef.current={signature,key:"recovery:"+crypto.randomUUID()};
    }
    setBusy(true);setNotice("");setError("");
    try {
      const response=await fetch("/api/ledger/operations",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({operation,requestKey:requestRef.current.key,payload}),
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok || result.ok!==true) {
        // Preserve requestKey on timeout/unknown server outcome.
        throw Error(result.error||"فشلت الاستعادة؛ أعد المحاولة بنفس تفاصيل الطلب.");
      }
      requestRef.current=null;
      await refresh(kind);
      setNotice("تمت استعادة السجل وحفظ عملية الاستعادة في سجل التدقيق. راجع الكشف المالي.");
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"لم يتم تأكيد الاستعادة؛ أعد المحاولة.");
    } finally {setBusy(false);}
  }

  return <section aria-label="استعادة السجلات الملغاة" style={{padding:16,marginTop:20,border:"1px solid var(--border-color)",borderRadius:14}}>
    <h4>استعادة نقلة أو دفعة ملغاة</h4>
    <p>لو نقلة أو دفعة اتلغت بالغلط، تقدر تعيد تفعيل <strong>السجل الأصلي بنفس رقمه</strong>
      من غير استيراد نسخة قديمة تمسح شغل جديد. الاستعادة للمالك فقط، وتُسجَّل في التدقيق.
      استعادة دفعة تخضع لقواعد النقدية التاريخية وقد تُرفض إذا سببت مديونية غير مسموحة.</p>
    <div className={ui.fieldGroup}>
      <label htmlFor="recovery-record-type">نوع السجل</label>
      <select id="recovery-record-type" className={ui.control} disabled={busy} value={kind}
        onChange={e=>{const next=e.target.value as Kind;setKind(next);setLoaded(false);setRows([]);clearSelection();setError("");setNotice("");}}>
        <option value="trip">النقلات الملغاة</option>
        <option value="payment">الدفعات الملغاة</option>
      </select>
    </div>
    <div className={ui.actions}>
      <button type="button" disabled={busy} onClick={()=>void refresh()}>
        {busy?"جارٍ التنفيذ…":"عرض السجلات الملغاة"}
      </button>
    </div>
    {loaded&&<div className={ui.fieldGroup}>
      <label htmlFor="recovery-record-id">اختَر السجل المراد استعادته</label>
      <select id="recovery-record-id" className={ui.control} disabled={busy||rows.length===0}
        value={selected} onChange={e=>{setSelected(e.target.value);setConfirm("");setAcknowledge(false);requestRef.current=null;}}>
        <option value="">{rows.length===0?"لا توجد سجلات ملغاة":"اختر سجلًا"}</option>
        {rows.map(r=><option key={r.id} value={r.id}>{r.date} — {r.id} — إصدار {r.version}</option>)}
      </select>
      {rows.length>=5000&&<p>القائمة تعرض أول 5000 سجل فقط؛ استخدم الفلاتر أو الدعم الفني لو العدد أكبر.</p>}
    </div>}
    {item&&<div style={{padding:12,marginTop:12,border:"1px solid var(--border-color)",borderRadius:10,overflowWrap:"anywhere"}}>
      <p>تاريخ الحركة: <bdi>{item.date}</bdi> — رقم السجل: <bdi>{item.id}</bdi></p>
      <p>حساب العربية/المسؤول: <bdi>{item.account}</bdi></p>
      <p>القيمة المسجلة بالقروش: <bdi>{item.piastres}</bdi></p>
      <p>سبب الإلغاء السابق: {item.reason||"غير محدد"}</p>
      <p>سيعود تأثير هذه الحركة إلى الكشوف عند نجاح الاستعادة.
        <strong> لن تُستعاد أي دفعة أخرى أو نقلة مرتبطة تلقائيًا.</strong></p>
      <div className={ui.fieldGroup}>
        <label htmlFor="recovery-reason">سبب الاستعادة (إلزامي، 8 أحرف على الأقل)</label>
        <input id="recovery-reason" className={ui.control} maxLength={400}
          disabled={busy} value={reason} onChange={e=>{setReason(e.target.value);requestRef.current=null;}}/>
      </div>
      <label style={{display:"block",marginBlock:12}}>
        <input type="checkbox" disabled={busy} checked={acknowledge}
          onChange={e=>setAcknowledge(e.target.checked)}/>
        {" "}راجعت رقم السجل وقيمته وأفهم أثره على الحسابات.
      </label>
      <div className={ui.fieldGroup}>
        <label htmlFor="recovery-confirm">اكتب كلمة «استعادة» لتأكيد العملية</label>
        <input id="recovery-confirm" className={ui.control} autoComplete="off"
          disabled={busy} value={confirm} onChange={e=>setConfirm(e.target.value)}/>
      </div>
      <div className={ui.actions}>
        <button className={ui.danger} type="button"
          disabled={busy||!acknowledge||reason.trim().length<8||confirm.trim()!=="استعادة"}
          onClick={()=>void reactivate()}>استعادة السجل المحدد فقط</button>
      </div>
    </div>}
    {notice&&<p role="status">{notice}</p>}
    {error&&<p role="alert">{error}</p>}
    <p>السجلات المحذوفة نهائيًا من قاعدة البيانات أو فقدان القاعدة بالكامل
      تحتاج استرجاع أرشيف النسخة إلى قاعدة معزولة؛ هذه الوظيفة خاصة بالسجلات الملغاة المحفوظة فقط.</p>
  </section>;
}
