"use client";
import {useEffect,useState} from "react";
import ui from "./workspace-ui.module.css";
const TABLES=[
 ["app_members","المستخدمون المدعوون"],["app_owner","صاحب الحساب"],["audit_log","سجل العمليات"],
 ["business_settings","بيانات النشاط"],["contractors","المقاولون"],["idempotency_keys","منع تكرار العمليات"],
 ["opening_balances","الأرصدة الافتتاحية"],["payments","الدفعات"],["trips","النقلات"],
 ["vehicle_accounts","حسابات العربيات"],["vehicles","العربيات"],["backup_history","سجل النسخ الاحتياطية"],
] as const;
type Backup={backup_date:string;file_name:string;drive_file_id:string;drive_web_view_link:string|null;size_bytes:number;sha256:string;created_at:string};
function bytes(value:number){return value<1024?value+" B":(value/1024).toFixed(1)+" KB";}
export function BackupSettings(){
 const [table,setTable]=useState<(typeof TABLES)[number][0]>("trips");
 const [history,setHistory]=useState<Backup[]>([]);
 const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(false);
 async function refresh(){
  setLoading(true);setNotice("");
  try{const r=await fetch("/api/backup/history",{cache:"no-store"});const data=await r.json();if(!r.ok)throw new Error(data.error||"تعذّر تحميل سجل النسخ.");setHistory(Array.isArray(data.backups)?data.backups:[]);}
  catch(e){setNotice(e instanceof Error?e.message:"تعذّر تحميل سجل النسخ.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 return <section aria-label="النسخ الاحتياطي" style={{marginTop:22,paddingTop:18,borderTop:"1px solid var(--border-color)"}}>
  <h3>النسخ الاحتياطي واستعادة البيانات</h3>
  <p>عند تفعيل النسخ اليومي، يحتفظ Google Drive بنسخة مشفّرة واحدة لكل يوم بتوقيت القاهرة ضمن آخر 30 يومًا. النسخة السحابية تشمل بنية قاعدة البيانات وبيانات التطبيق وسجلات استعادة الحسابات. التصدير المحلي يحتوي على بيانات التطبيق فقط.</p>
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
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:18}}>
   <h4>سجل النسخ السحابية</h4><button type="button" disabled={loading} onClick={()=>void refresh()}>{loading?"جارٍ التحديث...":"تحديث السجل"}</button>
  </div>
  {notice&&<p role="status">{notice}</p>}
  {history.length===0&&!notice&&<p>لا توجد نسخ سحابية مسجلة حتى الآن.</p>}
  <ul style={{listStyle:"none",padding:0,margin:0}}>
   {history.map(item=><li key={item.backup_date} style={{padding:"12px 0",borderBottom:"1px solid var(--border-color)"}}>
    <strong>{item.backup_date}</strong> — {bytes(Number(item.size_bytes))}
    <div><a href={item.drive_web_view_link||"https://drive.google.com/drive/u/0/search?q="+encodeURIComponent(item.file_name)} target="_blank" rel="noreferrer">فتح النسخة في Google Drive</a></div>
    <small>SHA-256: <bdi>{item.sha256}</bdi></small>
   </li>)}
  </ul>
 </section>;
}
