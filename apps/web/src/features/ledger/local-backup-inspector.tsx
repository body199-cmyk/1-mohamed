"use client";

import { useRef, useState } from "react";
import ui from "./workspace-ui.module.css";
import {
  inspectLocalPortableBackup, MAX_LOCAL_PREVIEW_BYTES,
  type LocalBackupInspection,
} from "../../lib/backup/inspect-local";

const LABELS: Array<[keyof LocalBackupInspection["counts"], string]> = [
  ["trips", "النقلات"], ["payments", "الدفعات"],
  ["contractors", "المقاولون"], ["vehicles", "العربيات"],
  ["opening_balances", "الأرصدة الافتتاحية"],
];

/** Intentionally no upload, database write, destructive action, or restore button. */
export function LocalBackupInspector() {
  const request = useRef(0);
  const [filename, setFilename] = useState("");
  const [inspection, setInspection] = useState<LocalBackupInspection | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function inspect(file: File | null) {
    const token = ++request.current;
    setFilename(file?.name ?? "");
    setInspection(null);
    setError("");
    if (!file) { setBusy(false); return; }
    setBusy(true);
    try {
      if (!/\.json$/i.test(file.name)) {
        throw new Error("اختَر ملف JSON الذي نزلته من «نسخة بيانات التطبيق».");
      }
      if (file.size > MAX_LOCAL_PREVIEW_BYTES) {
        throw new Error("حجم الملف أكبر من 32 ميجابايت؛ الفحص المحلي على الهاتف غير متاح لهذا الحجم.");
      }
      const result = await inspectLocalPortableBackup(await file.text());
      if (token === request.current) setInspection(result);
    } catch (cause) {
      if (token === request.current) {
        setError(cause instanceof Error ? cause.message : "تعذر قراءة ملف النسخة.");
      }
    } finally {
      if (token === request.current) setBusy(false);
    }
  }

  return <section aria-label="فحص نسخة محلية قبل الاستعادة"
    style={{border:"1px solid var(--border-color)",borderRadius:14,padding:16,marginTop:20}}>
    <h4>فحص نسخة محلية من الهاتف أو الكمبيوتر</h4>
    <p style={{color:"var(--text-muted)",lineHeight:1.9}}>
      خطوة آمنة لقراءة وفحص ملف JSON الذي سبق تنزيله من المشروع، والتحقق من اكتمال الجداول وبصمة الملف.
      كل الفحص يتم داخل متصفحك؛ لا يتم رفع الملف إلى الخادم أو تغيير أي بيانات.
    </p>
    <div className={ui.fieldGroup}>
      <label htmlFor="local-backup-preview-file">اختيار ملف النسخة (JSON فقط)</label>
      <input id="local-backup-preview-file" className={ui.control} type="file"
        accept=".json,application/json" disabled={busy}
        onChange={event => void inspect(event.target.files?.[0] ?? null)}/>
    </div>
    {busy && <p role="status">جارٍ فحص النسخة على جهازك…</p>}
    {error && <p role="alert" style={{color:"var(--color-danger)"}}>{error}</p>}
    {inspection && <div role="status" style={{marginTop:14,lineHeight:1.9}}>
      <strong>الملف اجتاز فحص الصيغة والبصمة: {filename}</strong>
      <p>وقت النسخة: <bdi>{inspection.createdAt}</bdi> — مجموع السجلات: {inspection.totalRows.toLocaleString("ar-EG")}</p>
      <ul>
        {LABELS.map(([table,label])=><li key={table}>
          {label}: {inspection.counts[table].toLocaleString("ar-EG")}
        </li>)}
      </ul>
      <small style={{color:"var(--text-muted)",overflowWrap:"anywhere"}}>
        SHA-256: <bdi>{inspection.sha256}</bdi>
      </small>
    </div>}
    <p style={{color:"var(--text-muted)",lineHeight:1.8}}>
      <strong>تنبيه:</strong> هذا فحص مبدئي لملف محلي فقط، وليس استعادة أو مقارنة بقاعدة البيانات.
      بصمة SHA-256 لا تثبت مصدر الملف وحدها، ولا تثبت تطابق العلاقات المحاسبية أو صلاحية الاسترجاع.
      ملفات Google Drive المضغوطة أو المشفرة وExcel ليست ملفات JSON محمولة، ولن تُفتح بهذه الأداة.
    </p>
    <p style={{fontWeight:700}}>الاستعادة إلى المشروع غير مفعّلة؛ لن تُستبدل أو تُدمج أي بيانات.</p>
  </section>;
}
