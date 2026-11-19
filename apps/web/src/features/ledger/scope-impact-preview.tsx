"use client";

import { useEffect, useRef, useState } from "react";
import ui from "./workspace-ui.module.css";
import { readBoundedPortableResponse } from "../../lib/backup/read-bounded";
import { inspectLocalPortableBackup } from "../../lib/backup/inspect-local";
import {
  inspectCancellationImpact, type ScopeImpact, type ScopeSelection,
} from "../../lib/backup/scope-impact";

type Named = { id: string; label: string };
type Kind = ScopeSelection["kind"];

export function ScopeImpactPreview() {
  const request = useRef<AbortController | null>(null);
  const raw = useRef<string | null>(null);
  const [kind, setKind] = useState<Kind>("day");
  const [id, setId] = useState("");
  const [vehicles, setVehicles] = useState<Named[]>([]);
  const [contractors, setContractors] = useState<Named[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [impact, setImpact] = useState<ScopeImpact | null>(null);

  useEffect(() => () => { request.current?.abort(); raw.current = null; }, []);

  async function load() {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    raw.current = null; setLoaded(false); setImpact(null); setNotice(""); setBusy(true);
    try {
      const response = await fetch("/api/backup/export?format=json", {
        method:"GET", credentials:"same-origin", cache:"no-store", signal:abort.signal,
      });
      const text = await readBoundedPortableResponse(response);
      await inspectLocalPortableBackup(text);
      const data = JSON.parse(text) as { tables: Record<string, Record<string,unknown>[]> };
      const names = (table: string, displayField: string) => data.tables[table]
        .filter(row => typeof row.id === "string" && typeof row[displayField] === "string")
        .map(row => ({ id: row.id as string, label: String(row[displayField]).slice(0, 120) }));
      if (!abort.signal.aborted) {
        raw.current = text;
        setVehicles(names("vehicles", "plate_number"));
        setContractors(names("contractors", "name"));
        setLoaded(true);
      }
    } catch (e) {
      if (!abort.signal.aborted) setNotice(e instanceof Error ? e.message : "تعذر تحميل لقطة البيانات الحالية.");
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  async function preview() {
    if (!raw.current) return;
    setNotice(""); setImpact(null);
    const selected: ScopeSelection = kind === "all" ? {kind} : {kind,id};
    try { setImpact(await inspectCancellationImpact(raw.current, selected)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "تعذر تجهيز المعاينة."); }
  }
  function selectKind(value:Kind) { setKind(value);setId("");setImpact(null); }
  const options = kind === "vehicle" ? vehicles : contractors;

  return <details style={{border:"1px solid var(--border-color)",borderRadius:12,padding:16,marginTop:20}}>
    <summary style={{fontWeight:700,cursor:"pointer"}}>معاينة تأثير إلغاء يومية أو عربية أو مقاول (بدون حذف)</summary>
    <p>يمكن لصاحب المشروع فحص عدد النقلات والدفعات التي قد تتأثر باختيار يوم أو عربية أو مقاول.
      هذه معاينة فقط؛ لا توجد هنا أوامر حذف أو إلغاء جماعي أو تصفير الحسابات.</p>
    <div className={ui.actions}>
      <button type="button" onClick={() => void load()} disabled={busy}>
        {busy ? "جارٍ تحميل لقطة آمنة…" : "تحميل لقطة البيانات الحالية للمعاينة"}
      </button>
    </div>
    {notice && <p role="alert" style={{color:"var(--color-danger)"}}>{notice}</p>}
    {loaded && <div style={{marginTop:12}}>
      <div className={ui.fieldGroup}>
        <label htmlFor="scope-preview-kind">نوع النطاق</label>
        <select id="scope-preview-kind" className={ui.control} value={kind}
          onChange={event=>selectKind(event.target.value as Kind)}>
          <option value="day">يومية بتاريخ معين</option>
          <option value="vehicle">عربية معينة</option>
          <option value="contractor">مقاول معين</option>
          <option value="all">جميع بيانات العمل — معاينة فقط</option>
        </select>
      </div>
      {kind==="day" && <div className={ui.fieldGroup}>
        <label htmlFor="scope-preview-day">تاريخ اليومية</label>
        <input id="scope-preview-day" className={ui.control} type="date"
          value={id} onChange={e=>{setId(e.target.value);setImpact(null);}}/>
      </div>}
      {(kind==="vehicle"||kind==="contractor") && <div className={ui.fieldGroup}>
        <label htmlFor="scope-preview-id">{kind==="vehicle"?"العربية":"المقاول"}</label>
        <select id="scope-preview-id" className={ui.control}
          value={id} onChange={e=>{setId(e.target.value);setImpact(null);}}>
          <option value="">اختر من القائمة</option>
          {options.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
      </div>}
      <div className={ui.actions}>
        <button type="button" disabled={kind!=="all"&&!id} onClick={()=>void preview()}>
          عرض التأثير المتوقع (بدون تنفيذ)
        </button>
      </div>
      {impact && <div role="status" style={{marginTop:12,padding:12,border:"1px solid var(--border-color)",borderRadius:12,lineHeight:2}}>
        <strong>نتيجة المعاينة:</strong>
        <p>النقلات المشمولة: {impact.tripCount} (النشطة: {impact.activeTripCount}، الملغاة سابقًا: {impact.alreadyCancelledTrips}).</p>
        <p>الدفعات النشطة ضمن النطاق أو المرتبطة به: {impact.activePaymentsInScope}.
          الدفعات المرتبطة بنقلات محددة: {impact.linkedPayments}.</p>
        {impact.paymentsOnOtherDates > 0 && <p>تحذير: يوجد {impact.paymentsOnOtherDates} دفعة
          مرتبطة أو متعلقة بهذا النطاق بتاريخ خارج اليوم المختار.</p>}
        {kind==="all" && <p>إجمالي سجلات بيانات العمل المرصودة: {impact.totalBusinessRecords}.
          لا يشمل هذا الرقم حسابات الدخول أو سجلات النسخ والمراجعة أو المفاتيح التقنية.</p>}
        <p><strong>هذه الأعداد ليست أثرًا ماليًا محسوبًا.</strong> إلغاء النقلة لا يلغي الدفعة تلقائيًا،
          وقد تتغير الأرصدة أو تظهر مديونية. لذلك لا يوجد زر حذف جماعي قبل اختبار القواعد المحاسبية
          والحفظ الذري والنسخ الاحتياطي والاسترجاع.</p>
      </div>}
    </div>}
  </details>;
}
