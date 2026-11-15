"use client";
import {useState} from 'react';
export function PasswordField({id,label,value,onChange,disabled,autoComplete,minLength}:{
 id:string;label:string;value:string;onChange:(value:string)=>void;disabled:boolean;
 autoComplete:'current-password'|'new-password';minLength?:number;
}){
 const [visible,setVisible]=useState(false);
 return <div style={{marginBottom:16}}>
  <label htmlFor={id}>{label}</label>
  <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
   <input id={id} type={visible?'text':'password'} required value={value} disabled={disabled}
    autoComplete={autoComplete} minLength={minLength} onChange={e=>onChange(e.target.value)}
    style={{minWidth:0,flex:1,padding:12,border:'1px solid var(--border-color,#ccd4df)',borderRadius:10}}/>
   <button type="button" aria-label={(visible?'إخفاء ':'إظهار ')+label} aria-pressed={visible}
    disabled={disabled} onClick={()=>setVisible(!visible)} style={{minWidth:44,minHeight:44,borderRadius:10}}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
     <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>
     {visible&&<path d="m3 3 18 18"/>}
    </svg>
   </button>
  </div>
 </div>;
}
