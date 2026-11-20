"use client";
import {useEffect,useState} from "react";
import ui from "./workspace-ui.module.css";
import { LocalBackupInspector } from "./local-backup-inspector";
import { ScopeImpactPreview } from "./scope-impact-preview";
import { RestoreCancelledRecords } from "./restore-cancelled-records";
const TABLES=[
 ["app_members","المستخدمون المدعوون"],["app_owner","صاحب الحساب"],["audit_log","سجل العمليات"],
 ["business_settings","بيانات النشاط"],["contractors","المقاولون"],["idempotency_keys","منع تكرار العمليات"],
 ["opening_balances","الأرصدة الافتتاحية"],["payments","الدفعات"],["trips","النقلات"],
 ["vehicle_accounts","حسابات العربيات"],["vehicles","العربيات"],["backup_history","سجل النسخ الاحتياطية"],
] as const;
type Backup={backup_date:string;format?:string;file_name:string;drive_file_id:string;drive_web_view_link:string|null;size_bytes:number;sha256:string;table_counts?:Record<string,unknown>;created_at:string};
function bytes(value:number){return value<1024?value+" B":(value/1024).toFixed(1)+" KB";}
export function BackupSettings(){
 const [table,setTable]=useState<(typeof TABLES)[number][0]>("trips");
 const [selectedCloudDate,setSelectedCloudDate]=useState("");
 const [history,setHistory]=useState<Backup[]>([]);
 const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(false);
 async function refresh(){
  setLoading(true);setNotice("");
  try{const r=await fetch("/api/backup/history",{cache:"no-store"});const data=await r.json();if(!r.ok)throw new Error(data.error||"تعذّر تحميل سجل النسخ.");const items=Array.isArray(data.backups)?data.backups as Backup[]:[];setHistory(items);setSelectedCloudDate(current=>items.some(item=>item.backup_date===current)?current:(items[0]?.backup_date??""));}
  catch(e){setNotice(e instanceof Error?e.message:"تعذّر تحميل سجل النسخ.");}
  finally{setLoading(false);}
 }
 const selectedCloud=history.find(item=>item.backup_date===selectedCloudDate);
 useEffect(()=>{void refresh();},[]);
 return <section aria-label="النسخ الاحتياطي" style={{marginTop:22,paddingTop:18,borderTop:"1px solid var(--border-color)"}}>
  <h3>النسخ الاحتياطي واستعادة البيانات</h3>
  <p>سجل نسخ الاسترجاع اليومية على Google Drive. يحتفظ النظام بملفات آخر 30 يومًا بتوقيت القاهرة. عند تفعيل نوع النسخ الجديد، هتلاقي بجانب ملف الاسترجاع ملف Excel للقراءة، من غير بيانات تسجيل الدخول.</p>
  <div className={ui.actions}>
   <a className={ui.control} href="/api/backup/export?format=json" download>تنزيل نسخة بيانات التطبيق (JSON)</a>
  </div>
  <p>نسخة JSON تحتوي جميع جداول بيانات التطبيق الـ12، بما فيها سجل النسخ الاحتياطية. لا تحتوي بيانات دخول Supabase Auth أو كلمات المرور أو إعدادات المشروع الداخلية؛ احتفظ بالنسخة السحابية المشفرة لاستعادة هيكل وبيانات PostgreSQL.</p>
  <div className={ui.fieldGroup}>
   <label htmlFor="backup-csv-table">تصدير جدول قابل للقراءة في Excel</label>
   <select id="backup-csv-table" className={ui.control} value={table} onChange={e=>setTable(e.target.value as typeof table)}>
    {TABLES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
   </select>
   <a className={ui.control} href={"/api/backup/export?format=csv&table="+encodeURIComponent(table)} download>تنزيل ملف CSV للجدول المحدد</a>
  </div>
  <LocalBackupInspector/>
  <ScopeImpactPreview/>
  <RestoreCancelledRecords/>
  <div style={{padding:16,marginTop:20,border:"1px solid var(--border-color)",borderRadius:14}}>
   <h4>استعادة طوارئ من Google Drive إذا تلفت قاعدة البيانات</h4>
   <p>يمكن للمالك اختيار تاريخ النسخة المسجل أدناه ثم تشغيل استعادة محمية في GitHub
    إلى <strong>مشروع Supabase جديد ومنفصل وفارغ فقط</strong>. لا تتم الكتابة فوق قاعدة المشروع الحالية،
    ولا تتغير بيانات الدخول أو إعدادات Vercel تلقائيًا.</p>
   <p>قبل أول استخدام يلزم تجهيز مشروع استرجاع مستقل وإعداد سر اتصال خاص به
    في GitHub. النظام يرفض التنفيذ إذا لم تتوفر الحماية المطلوبة.</p>
   <div className={ui.actions}>
    <a className={ui.control} target="_blank" rel="noopener noreferrer"
      href="https://github.com/body199-cmyk/1-mohamed/actions/workflows/recover-to-empty-project.yml">
      فتح وحدة استعادة الطوارئ المحمية
    </a>
   </div>
   <p>لإرجاع نقلة أو دفعة أُلغيت بالغلط دون فقد بيانات أحدث، استخدم القسم السابق.
    استعادة ملفات Drive لا تقوم بدمج بيانات قديمة مع الجديدة تلقائيًا.</p>
  </div>
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:18}}>
   <h4>سجل النسخ السحابية</h4><button type="button" disabled={loading} onClick={()=>void refresh()}>{loading?"جارٍ التحديث...":"تحديث السجل"}</button>
  </div>
  {notice&&<p role="status">{notice}</p>}
  {history.length===0&&!notice&&<p>لا توجد نسخ سحابية مسجلة حتى الآن.</p>}
  {history.length>0 && <div role="region" aria-label="اختيار نسخة سحابية حسب التاريخ" style={{border:"1px solid var(--border-color)",borderRadius:12,padding:16,marginTop:12}}>
  <div className={ui.fieldGroup}>
  <label htmlFor="cloud-backup-date">اختيار نسخة بتاريخ معين — معاينة معلومات فقط</label>
  <select id="cloud-backup-date" className={ui.control}
  value={selectedCloudDate} onChange={e=>setSelectedCloudDate(e.target.value)}>
  {history.map(item=><option key={item.backup_date} value={item.backup_date}>{item.backup_date}</option>)}
  </select>
  </div>
  {selectedCloud&&<div style={{lineHeight:1.9,overflowWrap:"anywhere"}}>
  <p>تاريخ النسخة: <strong>{selectedCloud.backup_date}</strong> — الحجم: {bytes(Number(selectedCloud.size_bytes))}</p>
  <p>نوع النسخة: <bdi>{selectedCloud.format||"غير معروف"}</bdi></p>
  <p>SHA-256: <bdi>{selectedCloud.sha256}</bdi></p>
  <p><a href={selectedCloud.drive_web_view_link||"https://drive.google.com/drive/u/0/search?q="+encodeURIComponent(selectedCloud.file_name)}
  target="_blank" rel="noreferrer">فتح الملف المحدد في Google Drive</a></p>
  <p>هذه البيانات مأخوذة من سجل النسخ المحفوظ في قاعدة البيانات. لم يتم تنزيل ملف Google Drive
  أو التحقق من محتواه داخل الموقع. الاستعادة الفعلية لهذه النسخة غير مفعّلة.</p>
  </div>}
  </div>}
  <ul style={{listStyle:"none",padding:0,margin:0}}>
   {history.map(item=><li key={item.backup_date} style={{padding:"12px 0",borderBottom:"1px solid var(--border-color)"}}>
    <strong>{item.backup_date}</strong> — {bytes(Number(item.size_bytes))}
    <div><a href={item.drive_web_view_link||"https://drive.google.com/drive/u/0/search?q="+encodeURIComponent(item.file_name)} target="_blank" rel="noreferrer">فتح النسخة في Google Drive</a></div>
    <small>SHA-256: <bdi>{item.sha256}</bdi></small>
   </li>)}
  </ul>
 </section>;
}
