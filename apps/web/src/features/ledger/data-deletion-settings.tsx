"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useModalFocus} from '../../components/use-modal-focus';
import {PasswordField} from '../auth/password-field';
import {isDeletionPreview,confirmationFor,type DeletionScope,type DeletionPreview,type DeletionCounts} from '../../lib/ledger/deletion-contract';
import ui from './workspace-ui.module.css';
import modal from './trip-entry-design.module.css';
import styles from './data-deletion-settings.module.css';
type Props={vehicles:{id:string;plate_number:string;is_archived:boolean}[];disabled:boolean;revision:number;onDeleted:()=>Promise<void>};
const labels:Record<keyof DeletionCounts,string>={trips:'النقلات',payments:'الدفعات',openings:'الأرصدة الافتتاحية',vehicles:'العربيات',contractors:'المقاولون',accounts:'حسابات العربيات'};
const blockedText={EMPTY:'لا توجد بيانات مطابقة للنطاق المختار.',LINKED_OUTSIDE:'فيه دفعات مرتبطة بنقلات في الفترة دي، لكن تاريخ الدفعات خارجها. اختار فترة تشمل الحركات المرتبطة.',NEGATIVE_BALANCE:'حذف الفترة دي هيسيّب دفعات من غير رصيد يغطيها. اختار نطاقًا يشمل الحركات المرتبطة، أو اختار حذف بيانات العربية بالكامل.'};
export function DataDeletionSettings({vehicles,disabled,revision,onDeleted}:Props){
 const [mode,setMode]=useState<DeletionScope['mode']|''>('');const [vehicle,setVehicle]=useState('');
 const [from,setFrom]=useState('');const [to,setTo]=useState('');const [preview,setPreview]=useState<DeletionPreview|null>(null);
 const [confirm,setConfirm]=useState(false);const [password,setPassword]=useState('');
 const [phrase,setPhrase]=useState('');const [accepted,setAccepted]=useState(false);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const inFlight=useRef(false);
 function close(){if(inFlight.current)return;setConfirm(false);setPassword('');setPhrase('');setAccepted(false);}
 const dialogRef=useModalFocus(confirm,close);
 function invalidate(){setPreview(null);setConfirm(false);setPassword('');setPhrase('');setAccepted(false);setMessage('');}
 useEffect(()=>{if(!inFlight.current){setPreview(null);close();}},[revision]);
 useEffect(()=>{
  if(!preview?.expires_at)return;
  const timer=setTimeout(()=>{if(!inFlight.current){setPreview(null);close();setMessage('المعاينة انتهت. اعمل معاينة جديدة قبل الحذف.');}},Math.max(0,Date.parse(preview.expires_at)-Date.now()));
  return()=>clearTimeout(timer);
 },[preview]);
 async function request(body:object){
  const response=await fetch('/api/ledger/purge',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>{throw new Error('تعذّر تأكيد نتيجة الطلب. حدّث البيانات قبل المحاولة.');});
  if(!response.ok||!result.ok){
   if(result.refreshPreview){setPreview(null);setConfirm(false);}
   throw new Error(typeof result.error==='string'?result.error:'تعذّر إكمال الطلب.');
  }
  return result.data;
 }
 async function examine(event:FormEvent){
  event.preventDefault();if(disabled||inFlight.current)return;
  let scope:DeletionScope;
  if(mode==='ALL')scope={mode};
  else if(mode==='VEHICLE'&&vehicle)scope={mode,vehicle_id:vehicle};
  else if(mode==='PERIOD'&&from&&to&&from<=to)scope={mode,from,to};
  else{setMessage('اختر نطاقًا صحيحًا للحذف.');return;}
  inFlight.current=true;setBusy(true);setMessage('');setPreview(null);
  try{const result=await request({action:'preview',scope});if(!isDeletionPreview(result)||result.confirmation!==confirmationFor(scope.mode))throw new Error('رد المعاينة غير صالح.');setPreview(result);}
  catch(error){setMessage(error instanceof Error?error.message:'تعذرت المعاينة.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function execute(event:FormEvent){
  event.preventDefault();
  if(disabled||inFlight.current||!preview?.challenge_id||!accepted||!password||phrase!==preview.confirmation)return;
  inFlight.current=true;setBusy(true);setMessage('');
  try{
   const result=await request({action:'execute',challenge_id:preview.challenge_id,confirmation:phrase,password});
   if(result?.status!=='OK'||result.challenge_id!==preview.challenge_id)throw new Error('نتيجة الحذف غير مؤكدة. حدّث البيانات قبل أي محاولة جديدة.');
   setPreview(null);setConfirm(false);setAccepted(false);setPhrase('');
   setMessage('تم حذف البيانات المحددة بنجاح. حساب الدخول وبيانات صاحب الحساب محفوظة.');
   try{await onDeleted();}catch{setMessage('تم الحذف، لكن تعذّر تحديث القوائم. اضغط تحديث البيانات.');}
  }catch(error){setMessage(error instanceof Error?error.message:'لم تتأكد نتيجة الطلب. حدّث البيانات قبل المحاولة.');}
  finally{setPassword('');inFlight.current=false;setBusy(false);}
 }
 const scopeLabel=mode==='ALL'?'كل سجلات الشغل والعربيات والمقاولين، باستثناء صاحب الحساب':mode==='VEHICLE'?`العربية: ${vehicles.find(v=>v.id===vehicle)?.plate_number??''}`:`الفترة من ${from} إلى ${to}، شاملة اليومين`;
 return <div className={styles.zone}>
  <h3>حذف البيانات نهائيًا</h3>
  <p>الحذف يمسح السجلات المحددة، وليس أرشفتها. لا يوجد تراجع أو استرجاع من الإعدادات.</p>
  <p>حساب الدخول وكلمة المرور وبيانات صاحب الحساب تظل محفوظة. يحتفظ النظام بسجل المراجعة ومفاتيح منع التكرار.</p>
  <form className={ui.form} onSubmit={examine}>
   <div className={ui.fieldGroup}><label htmlFor="deletion-mode">نطاق الحذف</label>
    <select id="deletion-mode" className={ui.control} required value={mode} disabled={disabled||busy} onChange={e=>{invalidate();setMode(e.target.value as typeof mode);}}>
     <option value="">اختر ما تريد حذفه</option><option value="ALL">كل بيانات الشغل</option><option value="VEHICLE">عربية معينة وكل بياناتها</option><option value="PERIOD">نقلات ودفعات وأرصدة فترة محددة</option>
    </select></div>
   {mode==='VEHICLE'&&<div className={ui.fieldGroup}><label htmlFor="deletion-vehicle">العربية المطلوب حذفها</label>
    <select id="deletion-vehicle" className={ui.control} required value={vehicle} disabled={disabled||busy} onChange={e=>{invalidate();setVehicle(e.target.value);}}>
     <option value="">اختر العربية</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.plate_number}{v.is_archived?' (مؤرشفة)':''}</option>)}
    </select></div>}
   {mode==='PERIOD'&&<>
    <div className={ui.fieldGroup}><label htmlFor="deletion-from">بداية فترة الحذف</label><input id="deletion-from" className={ui.control} type="date" required value={from} disabled={disabled||busy} onChange={e=>{invalidate();setFrom(e.target.value);}}/></div>
    <div className={ui.fieldGroup}><label htmlFor="deletion-to">نهاية فترة الحذف</label><input id="deletion-to" className={ui.control} type="date" required value={to} min={from||undefined} disabled={disabled||busy} onChange={e=>{invalidate();setTo(e.target.value);}}/></div>
   </>}
   <div className={ui.actions}><button type="submit" disabled={disabled||busy||!mode}>{busy?'جارٍ التحقق...':'معاينة البيانات قبل الحذف'}</button></div>
  </form>
  {preview&&<div className={styles.preview} aria-label="معاينة نطاق الحذف">
   <h4>البيانات المحددة للحذف</h4><p>{scopeLabel}</p>
   <dl>{(Object.keys(labels) as (keyof DeletionCounts)[]).map(key=><div key={key}><dt>{labels[key]}</dt><dd>{preview.counts[key].toLocaleString('en-US')}</dd></div>)}</dl>
   {preview.blocked?<p role="status">{blockedText[preview.blocked]}</p>:<button className={ui.danger} type="button" disabled={disabled||busy||!preview.challenge_id} onClick={()=>{setConfirm(true);setMessage('');}}>متابعة إلى التأكيد النهائي</button>}
  </div>}
  {message&&<p role="status" className={styles.message}>{message}</p>}
  {confirm&&preview&&<div ref={dialogRef} className={modal.overlay}>
   <div role="dialog" aria-modal="true" aria-labelledby="deletion-title" aria-describedby="deletion-warning" className={modal.dialog}>
    <header className={modal.dialogHeading}><h3 id="deletion-title">تأكيد الحذف النهائي</h3><p id="deletion-warning">{scopeLabel}. البيانات دي هتتمسح نهائيًا؛ راجع المعاينة قبل الموافقة.</p></header>
    <form className={modal.dialogForm} onSubmit={execute}>
     <p className={styles.warning}>اكتب العبارة دي بنفسها: <strong>{preview.confirmation}</strong></p>
     <label htmlFor="deletion-phrase">عبارة التأكيد</label><input id="deletion-phrase" className={modal.control} autoComplete="off" required value={phrase} disabled={busy} onChange={e=>setPhrase(e.target.value)}/>
     <PasswordField id="deletion-password" label="كلمة المرور الحالية" autoComplete="current-password" value={password} onChange={setPassword} disabled={busy}/>
     <label className={styles.accept}><input type="checkbox" checked={accepted} disabled={busy} onChange={e=>setAccepted(e.target.checked)}/><span>فاهم إن الحذف نهائي وراجعت نطاقه وعدد السجلات.</span></label>
     {message&&<p role="alert">{message}</p>}
     <footer className={modal.dialogActions}>
      <button className={`${modal.primaryButton} ${ui.danger}`} type="submit" disabled={disabled||busy||!accepted||!password||phrase!==preview.confirmation}>{busy?'جارٍ التحقق والتنفيذ...':'تأكيد الحذف النهائي'}</button>
      <button className={modal.secondaryButton} type="button" disabled={busy} onClick={close}>إلغاء</button>
     </footer>
    </form>
   </div>
  </div>}
 </div>;
}
