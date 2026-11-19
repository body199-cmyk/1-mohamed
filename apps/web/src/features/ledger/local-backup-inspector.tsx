"use client";

import { useEffect, useRef, useState } from "react";
import ui from "./workspace-ui.module.css";
import {
  inspectLocalPortableBackup, MAX_LOCAL_PREVIEW_BYTES,
  type LocalBackupInspection,
} from "../../lib/backup/inspect-local";
import {
  compareVerifiedPortableBackups, type PortableBackupComparison,
} from "../../lib/backup/compare-local";
import { readBoundedPortableResponse } from "../../lib/backup/read-bounded";

const LABELS: Array<[keyof LocalBackupInspection["counts"], string]> = [
  ["trips", "النقلات"], ["payments", "الدفعات"],
  ["contractors", "المقاولون"], ["vehicles", "العربيات"],
  ["opening_balances", "الأرصدة الافتتاحية"],
];
const TABLE_LABELS: Record<keyof LocalBackupInspection["counts"], string> = {
  app_members: "المستخدمون المدعوون", app_owner: "صاحب الحساب",
  audit_log: "سجل المراجعة", business_settings: "بيانات النشاط",
  contractors: "المقاولون", idempotency_keys: "مفاتيح منع التكرار",
  opening_balances: "الأرصدة الافتتاحية", payments: "الدفعات",
  trips: "النقلات", vehicle_accounts: "حسابات العربيات",
  vehicles: "العربيات", backup_history: "سجل النسخ",
};

/** No restore/upload endpoint or database write — only existing owner export GET. */
export function LocalBackupInspector() {
  const request = useRef(0);
  const raw = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [filename, setFilename] = useState("");
  const [inspection, setInspection] = useState<LocalBackupInspection | null>(null);
  const [comparison, setComparison] = useState<PortableBackupComparison | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState(false);

  useEffect(() => () => { request.current++; controller.current?.abort(); raw.current = null; }, []);

  async function inspect(file: File | null) {
    const token = ++request.current;
    controller.current?.abort();
    raw.current = null;
    setFilename(file?.name ?? "");
    setInspection(null);
    setComparison(null);
    setError("");
    setComparing(false);
    if (!file) { setBusy(false); return; }
    setBusy(true);
    try {
      if (!/\.json$/i.test(file.name)) {
        throw new Error("اختَر ملف JSON الذي نزلته من «نسخة بيانات التطبيق».");
      }
      if (file.size > MAX_LOCAL_PREVIEW_BYTES) {
        throw new Error("حجم الملف أكبر من 32 ميجابايت؛ الفحص المحلي على الهاتف غير متاح لهذا الحجم.");
      }
      const text = await file.text();
      const result = await inspectLocalPortableBackup(text);
      if (token === request.current) { raw.current = text; setInspection(result); }
    } catch (cause) {
      if (token === request.current) {
        setError(cause instanceof Error ? cause.message : "تعذر قراءة ملف النسخة.");
      }
    } finally {
      if (token === request.current) setBusy(false);
    }
  }

  async function compare() {
    if (!inspection || !raw.current || comparing || busy) return;
    const token = request.current;
    const selected = raw.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    setComparison(null);
    setComparing(true);
    try {
      // Existing owner-only API, not a new DB read or permission grant.
      const response = await fetch("/api/backup/export?format=json", {
        method: "GET", credentials: "same-origin", cache: "no-store", signal: abort.signal,
      });
      const current = await readBoundedPortableResponse(response);
      const result = await compareVerifiedPortableBackups(selected, current);
      if (!abort.signal.aborted && token === request.current) setComparison(result);
    } catch (cause) {
      if (!abort.signal.aborted && token === request.current) {
        setError(cause instanceof Error ? cause.message : "تعذّرت مقارنة النسختين.");
      }
    } finally {
      if (token === request.current) setComparing(false);
    }
  }

  return <section aria-label="فحص نسخة محلية قبل الاستعادة"
    style={{border:"1px solid var(--border-color)",borderRadius:14,padding:16,marginTop:20}}>
    <h4>فحص نسخة محلية ومقارنتها بالبيانات الحالية</h4>
    <p style={{color:"var(--text-muted)",lineHeight:1.9}}>
      اختَر ملف JSON محفوظًا على الهاتف أو الكمبيوتر. الفحص يتم داخل متصفحك، ثم يمكنك طلب
      نسخة حالية بصلاحية المالك لمقارنة السجلات. لا تُرفع النسخة المختارة ولا تُعدّل أي بيانات.
    </p>
    <div className={ui.fieldGroup}>
      <label htmlFor="local-backup-preview-file">اختيار ملف النسخة (JSON فقط)</label>
      <input id="local-backup-preview-file" className={ui.control} type="file"
        accept=".json,application/json" disabled={busy || comparing}
        onChange={event => void inspect(event.target.files?.[0] ?? null)}/>
    </div>
    {busy && <p role="status">جارٍ فحص النسخة على جهازك…</p>}
    {error && <p role="alert" style={{color:"var(--color-danger)"}}>{error}</p>}
    {inspection && <div style={{marginTop:14,lineHeight:1.9}}>
      <p role="status"><strong>الملف اجتاز فحص الصيغة والبصمة: {filename}</strong></p>
      <p>وقت النسخة: <bdi>{inspection.createdAt}</bdi> — مجموع السجلات: {inspection.totalRows.toLocaleString("ar-EG")}</p>
      <ul>
        {LABELS.map(([table,label])=><li key={table}>
          {label}: {inspection.counts[table].toLocaleString("ar-EG")}
        </li>)}
      </ul>
      <small style={{color:"var(--text-muted)",overflowWrap:"anywhere"}}>
        SHA-256: <bdi>{inspection.sha256}</bdi>
      </small>
      <div className={ui.actions}>
        <button type="button" disabled={busy || comparing} onClick={() => void compare()}>
          {comparing ? "جارٍ مقارنة البيانات…" : "مقارنة النسخة بالبيانات الحالية (قراءة فقط)"}
        </button>
      </div>
    </div>}
    {comparison && <section aria-label="نتيجة مقارنة النسختين"
      style={{marginTop:16,padding:14,border:"1px solid var(--border-color)",borderRadius:12}}>
      <h4>نتيجة المقارنة — دون أي استعادة</h4>
      <p>النسخة المختارة: <bdi>{comparison.backup.createdAt}</bdi></p>
      <p>لقطة البيانات الحالية: <bdi>{comparison.current.createdAt}</bdi></p>
      <p role="status">
        في النسخة القديمة فقط: <strong>{comparison.totalBackupOnly}</strong> —
        في البيانات الحالية فقط: <strong>{comparison.totalCurrentOnly}</strong> —
        سجلات موجودة في الاثنين لكن مختلفة: <strong>{comparison.totalModified}</strong> —
        متطابقة: <strong>{comparison.totalUnchanged}</strong>
      </p>
      {comparison.sourceProjectMismatch && <p role="alert" style={{color:"var(--color-danger)"}}>
        مصدر النسخة مختلف عن قاعدة البيانات الحالية؛ المقارنة لا تعني إمكانية استعادة هذه النسخة.
      </p>}
      {comparison.identityMismatch && <p role="alert" style={{color:"var(--color-danger)"}}>
        بيانات المالك أو العضويات مختلفة؛ لا تُنفذ أي استعادة قبل مطابقة هوية المستخدمين وحسابات Auth.
      </p>}
      <p><strong>السجلات المالية المختلفة:</strong> {comparison.financialEntriesDiffer}.
        الحسابات النقدية المحتمل تأثرها: {comparison.affectedCashAccountCount}.
        المقاولون المحتمل تأثرهم: {comparison.affectedContractorCount}.</p>
      <p><strong>هذه أعداد تغيّرات فقط وليست فروق أرصدة!</strong> لم تُعد المقارنة حساب النقدية أو فرق الشغل،
        ولم تتحقق من الاعتماد المتبادل بين النقلات والدفعات. أي اختيار بين دمج أو استبدال يحتاج
        استعادة تجريبية منفصلة ومطابقة مالية، ولا توجد عملية تنفيذ هنا.</p>
      <div style={{overflowX:"auto",maxWidth:"100%"}}>
        <table style={{borderCollapse:"collapse",width:"100%",minWidth:450,fontSize:".88rem"}}>
          <thead><tr>
            <th scope="col">البيانات</th><th scope="col">في النسخة فقط</th>
            <th scope="col">حالية فقط</th><th scope="col">مختلفة</th><th scope="col">متطابقة</th>
          </tr></thead>
          <tbody>{comparison.tables.map(item=><tr key={item.table}>
            <th scope="row" style={{textAlign:"start",padding:5}}>{TABLE_LABELS[item.table]}</th>
            <td style={{textAlign:"center"}}>{item.backupOnly}</td>
            <td style={{textAlign:"center"}}>{item.currentOnly}</td>
            <td style={{textAlign:"center"}}>{item.modified}</td>
            <td style={{textAlign:"center"}}>{item.unchanged}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {comparison.tables.filter(item => item.examples.length).map(item=>
        <details key={item.table} style={{marginTop:10}}>
          <summary>أمثلة اختلافات {TABLE_LABELS[item.table]} ({item.backupOnly+item.currentOnly+item.modified})</summary>
          <ul>{item.examples.map((example,index)=><li key={index}>
            {example.status === "backup-only" ? "في النسخة فقط" :
              example.status === "current-only" ? "في البيانات الحالية فقط" : "قيمة مختلفة"}
            {" — "}<bdi>{example.description}</bdi>
          </li>)}</ul>
          {item.backupOnly+item.currentOnly+item.modified > item.examples.length &&
            <p>هذه أمثلة محدودة فقط؛ يُعرض الإجمالي الكامل في الجدول.</p>}
        </details>
      )}
      <p><strong>لن يُحذف أو يُستبدل أو يُدمج أي سجل.</strong> هذه المقارنة لحظة القراءة فقط،
        وقد تتغير قاعدة البيانات بعد عرضها؛ يلزم إعادتها قبل أي استرجاع مستقبلي.</p>
    </section>}
    <p style={{color:"var(--text-muted)",lineHeight:1.8}}>
      <strong>تنبيه:</strong> بصمة SHA-256 تكشف التغيير العرضي، ولا تثبت مصدر الملف وحدها
      أو صحة العلاقات المالية. ملفات Google Drive المضغوطة أو المشفرة وExcel ليست ملفات JSON محمولة،
      ولذلك لا تُقبل هنا. المعاينة تحمّل البيانات الحالية إلى متصفح المالك فقط، ولا تخزنها على الجهاز.
    </p>
    <p style={{fontWeight:700}}>الاستعادة والحذف الجماعي غير مفعّلين؛ لا توجد أي عملية كتابة.</p>
  </section>;
}
