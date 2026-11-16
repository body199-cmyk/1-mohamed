"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {assertDecimal} from '../../lib/ledger/amounts';
import ui from './workspace-ui.module.css';
import styles from './daily-work.module.css';

export type SharedWorkValues={contractor:string;direction:'AHMED_SUPPLIES'|'OTHER_SUPPLIES';date:string;
 contractorRate:string;vehicleRate:string;sameRate:boolean;origin:string;destination:string;expense:string;notes:string};
export const emptySharedWork=(date=''):SharedWorkValues=>({contractor:'',direction:'AHMED_SUPPLIES',date,
 contractorRate:'',vehicleRate:'',sameRate:true,origin:'',destination:'',expense:'0',notes:''});
export const cairoToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
type Props={contractors:{id:string;name:string;is_primary:boolean;is_archived:boolean}[];busy:boolean;
 applied:SharedWorkValues|null;dirty:boolean;onApply:(value:SharedWorkValues)=>void;onNew:()=>void;
 onManual:()=>void;onAddContractor:()=>void;createdContractor?:string};

export function SharedWorkPanel({contractors,busy,applied,dirty,onApply,onNew,onManual,onAddContractor,createdContractor}:Props){
 const [initialDate]=useState(cairoToday);
 const [draft,setDraft]=useState<SharedWorkValues>(()=>emptySharedWork(initialDate));
 const [lastWork,setLastWork]=useState<SharedWorkValues|null>(null);
 const [editing,setEditing]=useState(true);
 useEffect(()=>{if(createdContractor){setDraft(old=>({...old,contractor:createdContractor}));setEditing(true);}},[createdContractor]);
 const [error,setError]=useState('');
 const confirmButton=useRef<HTMLButtonElement>(null);
 const returnFocus=useRef<HTMLElement|null>(null);
 const [confirmation,setConfirmation]=useState<'apply'|'new'|'manual'|'restore'|null>(null);
 const [pending,setPending]=useState<SharedWorkValues|null>(null);
 useEffect(()=>{if(confirmation)confirmButton.current?.focus();},[confirmation]);
 function confirm(action:'apply'|'new'|'manual'|'restore'){returnFocus.current=document.activeElement as HTMLElement;setConfirmation(action);}
 function cancelConfirmation(){setConfirmation(null);setPending(null);requestAnimationFrame(()=>returnFocus.current?.focus());}
 const draftChanged=JSON.stringify(draft)!==JSON.stringify(applied??emptySharedWork(initialDate));
 const change=<K extends keyof SharedWorkValues>(key:K,value:SharedWorkValues[K])=>setDraft(old=>({...old,[key]:value}));
 function finish(action:'apply'|'new'|'manual'|'restore',value:SharedWorkValues|null=pending){
  if(action==='apply'&&value){onApply(value);setDraft(value);setLastWork(value);setEditing(false);}
  if(action==='new'){setDraft(emptySharedWork(cairoToday()));setEditing(true);onNew();}
  if(action==='manual'){onManual();setEditing(false);}
  if(action==='restore'&&lastWork){
   const active=contractors.some(c=>c.id===lastWork.contractor&&!c.is_primary&&!c.is_archived);
   setDraft({...lastWork,date:cairoToday(),contractor:active?lastWork.contractor:''});setEditing(true);
   requestAnimationFrame(()=>document.getElementById('shared-contractor')?.focus());
   setError(active?'':'مقاول آخر شغل لم يعد متاحًا. اختر مقاولًا قبل الاعتماد.');
  }else setError('');
  setPending(null);setConfirmation(null);
 }
 function request(action:'new'|'manual'|'restore'){
  if(dirty||(editing&&draftChanged)){confirm(action);return;}
  finish(action);
 }
 function apply(event:FormEvent){
  event.preventDefault();setError('');
  try{
   if(!contractors.some(c=>c.id===draft.contractor&&!c.is_primary&&!c.is_archived)||!draft.date)
    throw new Error('اختر المقاول والتاريخ أولًا.');
   const contractorRate=assertDecimal(draft.contractorRate,2,false);
   const vehicleRate=draft.sameRate?contractorRate:assertDecimal(draft.vehicleRate,2,false);
   const expense=assertDecimal(draft.expense,2,false);
   const value={...draft,contractorRate,vehicleRate,expense,notes:draft.notes.trim(),origin:draft.origin.trim(),destination:draft.destination.trim()};
   if(dirty){setPending(value);confirm('apply');return;}
   finish('apply',value);
  }catch(cause){setError(cause instanceof Error?cause.message:'راجع بيانات الشغل.');}
 }
 const name=contractors.find(c=>c.id===applied?.contractor)?.name;
 return <section className={ui.surface+' '+styles.shared} aria-label="بيانات الشغل المشتركة">
  <header className={styles.sectionHeader}><div><h2>بيانات الشغل المشتركة</h2>
   <p>{applied?'معتمدة للنقلات التالية؛ المحفوظ سابقًا لا يتغير.':'اضبطها مرة، وبعدها سجّل العربيات واحدة وراء التانية.'}</p></div>
   <span className={styles.state}>{applied?'المشترك مفعّل':'لم يُعتمد بعد'}</span>
   {!applied&&<button type="button" disabled={busy||confirmation!==null} onClick={()=>request('manual')}>إدخال نقلة منفردة</button>}
  </header>
  {applied&&<div className={styles.sharedSummary} aria-label="ملخص الشغل المعتمد">
   <strong>{name} — {applied.direction==='AHMED_SUPPLIES'?'أحمد هو المورّد':'المقاول الآخر هو المورّد'}</strong>
   <span>{applied.date} · {[applied.origin,applied.destination].filter(Boolean).join(' ← ')||'بدون خط سير محدد'}</span>
   <span>سعر المقاول: <bdi>{applied.contractorRate}</bdi> ج.م/طن · سعر العربية: <bdi>{applied.vehicleRate}</bdi> ج.م/طن</span>
   <span>مصاريف كل نقلة: <bdi>{applied.expense}</bdi> ج.م</span>
   {applied.notes&&<span className={styles.sharedNote}>الملاحظة المشتركة: {applied.notes}</span>}
  </div>}
  {lastWork&&<><button type="button" disabled={busy||confirmation!==null} onClick={()=>request('restore')}>استخدام بيانات آخر شغل</button><p className={styles.restoreHint}>آخر بيانات اعتمدتها في الجلسة دي؛ تُسترجع بتاريخ النهارده للمراجعة والاعتماد.</p></>}
  {!editing&&<div className={styles.sharedActions}>
   <button type="button" disabled={busy||confirmation!==null} onClick={()=>{setDraft(applied??emptySharedWork());setEditing(true);}}>تغيير بيانات الشغل</button>
   <button type="button" disabled={busy||confirmation!==null} onClick={()=>request('new')}>بدء شغل ببيانات مختلفة</button>
  </div>}
  {editing&&<form className={ui.form} onSubmit={apply}>
   <div className={ui.fieldGroup}><label htmlFor="shared-contractor">المقاول المشترك</label>
    <select id="shared-contractor" className={ui.control} required disabled={busy||confirmation!==null} value={draft.contractor} onChange={e=>change('contractor',e.target.value)}>
     <option value="">اختر المقاول</option>{contractors.filter(c=>!c.is_primary&&!c.is_archived).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select><button type="button" disabled={busy||confirmation!==null} onClick={onAddContractor}>+ مقاول جديد للمشترك</button></div>
   <div className={ui.fieldGroup}><label htmlFor="shared-direction">اتجاه الشغل المشترك</label>
    <select id="shared-direction" className={ui.control} disabled={busy||confirmation!==null} value={draft.direction} onChange={e=>change('direction',e.target.value as SharedWorkValues['direction'])}>
     <option value="AHMED_SUPPLIES">أحمد هو المورّد</option><option value="OTHER_SUPPLIES">المقاول الآخر هو المورّد</option>
    </select></div>
   <div className={ui.fieldGroup}><label htmlFor="shared-date">تاريخ الشغل المشترك</label><input id="shared-date" type="date" className={ui.control} required disabled={busy||confirmation!==null} value={draft.date} onChange={e=>change('date',e.target.value)}/></div>
   <div className={ui.fieldGroup}><label htmlFor="shared-contractor-rate">سعر المقاول المشترك للطن</label><input id="shared-contractor-rate" className={ui.control} inputMode="decimal" required disabled={busy||confirmation!==null} value={draft.contractorRate} onChange={e=>change('contractorRate',e.target.value)}/></div>
   <label className={styles.check}><input type="checkbox" disabled={busy||confirmation!==null} checked={draft.sameRate} onChange={e=>change('sameRate',e.target.checked)}/> نفس سعر المقاول والعربية في المشترك</label>
   {!draft.sameRate&&<div className={ui.fieldGroup}><label htmlFor="shared-vehicle-rate">سعر العربية المشترك للطن</label><input id="shared-vehicle-rate" className={ui.control} inputMode="decimal" required disabled={busy||confirmation!==null} value={draft.vehicleRate} onChange={e=>change('vehicleRate',e.target.value)}/></div>}
   <div className={ui.fieldGroup}><label htmlFor="shared-origin">من — للشغل المشترك</label><input id="shared-origin" className={ui.control} maxLength={200} disabled={busy||confirmation!==null} value={draft.origin} onChange={e=>change('origin',e.target.value)}/></div>
   <div className={ui.fieldGroup}><label htmlFor="shared-destination">إلى — للشغل المشترك</label><input id="shared-destination" className={ui.control} maxLength={200} disabled={busy||confirmation!==null} value={draft.destination} onChange={e=>change('destination',e.target.value)}/></div>
   <details className={styles.optionalDefaults}><summary>مصاريف وملاحظة مشتركة — اختياري</summary>
    <div className={ui.form}>
     <div className={ui.fieldGroup}><label htmlFor="shared-expense">مصاريف ثابتة لكل نقلة بالجنيه</label>
      <input id="shared-expense" className={ui.control} inputMode="decimal" required disabled={busy||confirmation!==null} value={draft.expense} onChange={e=>change('expense',e.target.value)}/>
      <p>المبلغ ده يُطبّق على كل نقلة، وتقدر تغيّره لنقلة واحدة أثناء التسجيل.</p></div>
     <div className={ui.fieldGroup}><label htmlFor="shared-notes">ملاحظة مشتركة لكل نقلة</label>
      <input id="shared-notes" className={ui.control} maxLength={400} disabled={busy||confirmation!==null} value={draft.notes} onChange={e=>change('notes',e.target.value)}/></div>
    </div>
   </details>
   {error&&<p role="alert">{error}</p>}
   <div className={ui.actions}><button type="submit" disabled={busy||confirmation!==null}>اعتماد بيانات الشغل</button>
    {applied&&<button type="button" disabled={busy||confirmation!==null} onClick={()=>{setDraft(applied);setEditing(false);setError('');setConfirmation(null);}}>إلغاء تعديل المشترك</button>}
    {applied&&<button type="button" disabled={busy||confirmation!==null} onClick={()=>request('manual')}>إدخال نقلة منفردة</button>}</div>
  </form>}
  {confirmation&&<div className={styles.confirmation} role="region" aria-label="تأكيد استبدال المسودة">
   <p role="alert">{confirmation==='restore'?'فيه بيانات غير محفوظة. المتابعة تسترجع آخر شغل في مسودة المشترك فقط؛ النقلة الحالية تفضل كما هي لحد ما تعتمد المشترك.':'فيه بيانات غير محفوظة. المتابعة تستبدل مسودة النقلة أو بيانات المشترك الجاري تعديلها، من غير تغيير أي نقلة محفوظة.'}</p>
   <div className={ui.actions}><button ref={confirmButton} type="button" disabled={busy} onClick={()=>finish(confirmation)}>تأكيد استبدال المسودة</button>
    <button type="button" disabled={busy} onClick={cancelConfirmation}>الاحتفاظ بالمسودة</button></div>
  </div>}
 </section>;
}
