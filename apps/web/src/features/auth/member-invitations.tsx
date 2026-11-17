"use client";
import {useEffect,useState,type FormEvent} from 'react';
import ui from '../ledger/workspace-ui.module.css';
type Member={user_id:string;email:string;is_active:boolean;created_at:string};
export function MemberInvitations({visible}:{visible:boolean}){
 const [owner,setOwner]=useState(false),[members,setMembers]=useState<Member[]>([]);
 const [inviteUrl,setInviteUrl]=useState('');
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function refresh(){
  const r=await fetch('/api/auth/members',{cache:'no-store'});const data=await r.json();
  if(!r.ok)throw new Error('تعذّر تحميل المستخدمين.');
  setOwner(data.isOwner===true);setMembers(Array.isArray(data.members)?data.members:[]);
 }
 useEffect(()=>{if(visible)void refresh().catch(()=>setMessage('تعذّر تحميل المستخدمين. أعد المحاولة.'));},[visible]);
 async function action(body:object){
  if(busy)return;setBusy(true);setMessage('');setInviteUrl('');
  try{
   const r=await fetch('/api/auth/members',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const data=await r.json();if(!r.ok)throw new Error(data.error??'تعذّر إكمال الطلب.');
   setMessage(data.message);setInviteUrl(typeof data.inviteUrl==='string'?data.inviteUrl:'');setEmail('');
   try{await refresh();}catch{setMessage(data.message+' تعذّر تحديث القائمة؛ اضغط تحديث المستخدمين.');}
  }catch(error){setMessage(error instanceof Error?error.message:'تعذّر إكمال الطلب.');}
  finally{setBusy(false);}
 }
 function invite(event:FormEvent){event.preventDefault();void action({action:'invite',email});}
 if(!visible)return null;
 return <section aria-label="إدارة المستخدمين" style={{marginTop:24,paddingTop:20,borderTop:'1px solid var(--border-color)'}}>
  {owner&&<><h3>دعوة مستخدم</h3><p>المستخدم يقدر يسجل ويعدل ويشوف بيانات وتقارير المشروع. إدارة الدعوات وإلغاء الوصول لصاحب الحساب فقط.</p>
   <form className={ui.form} onSubmit={invite}>
    <div className={ui.fieldGroup}><label htmlFor="invited-email">البريد الإلكتروني للمستخدم</label>
     <input id="invited-email" type="email" required maxLength={254} dir="ltr" autoComplete="off" className={ui.control} value={email} disabled={busy} onChange={e=>{setEmail(e.target.value);setInviteUrl('');}}/></div>
    <div className={ui.actions}><button type="submit" disabled={busy}>{busy?'جارٍ التنفيذ...':'إرسال الدعوة'}</button>
     <button type="button" disabled={busy||!email.trim()} onClick={()=>void action({action:'link',email})}>إنشاء رابط دعوة</button></div>
   </form>
   <p>إرسال البريد يحتاج إعداد خدمة إرسال. تقدر بدلًا منه تنشئ رابط دعوة وتبعته للشخص بنفسك.</p>
   {inviteUrl&&<div><label htmlFor="member-invite-link">رابط الدعوة — لصاحب الإيميل فقط</label>
    <input id="member-invite-link" className={ui.control} value={inviteUrl} readOnly dir="ltr" autoComplete="off"/>
    <button type="button" onClick={()=>{if(!navigator.clipboard){setMessage('حدد الرابط وانسخه يدويًا.');return;}void navigator.clipboard.writeText(inviteUrl).then(()=>setMessage('تم نسخ رابط الدعوة.')).catch(()=>setMessage('حدد الرابط وانسخه يدويًا.'));}}>نسخ رابط الدعوة</button>
   </div>}
   <h3>المستخدمون المدعوون</h3>
   {members.length===0&&<p>لم تتم إضافة مستخدمين بعد.</p>}
   <ul style={{listStyle:'none',padding:0}}>{members.map(member=><li key={member.user_id} style={{padding:'16px 0',borderBottom:'1px solid var(--border-color)'}}>
    <p><bdi>{member.email}</bdi> — {member.is_active?'الوصول متاح':'الوصول ملغي'}</p>
    <div className={ui.actions}><button type="button" disabled={busy} onClick={()=>void action({action:'link',email:member.email})}>إنشاء رابط جديد</button>{member.is_active?<>
     <button type="button" disabled={busy} onClick={()=>void action({action:'resend',email:member.email})}>إرسال رابط جديد</button>
     <button type="button" disabled={busy} onClick={()=>{if(window.confirm('إلغاء وصول '+member.email+' للمشروع؟'))void action({action:'revoke',userId:member.user_id});}}>إلغاء الوصول</button>
    </>:<button type="button" disabled={busy} onClick={()=>void action({action:'invite',email:member.email})}>إعادة الدعوة</button>}</div>
   </li>)}</ul></>}
  <button type="button" disabled={busy} onClick={()=>void refresh().catch(()=>setMessage('تعذّر تحديث المستخدمين.'))}>تحديث المستخدمين</button>
  {message&&<p role="status">{message}</p>}
 </section>;
}
