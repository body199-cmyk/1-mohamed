"use client";
import {useState} from 'react';
type Choice={id:string;label:string};
export function SearchableChoice({id,label,choices,value,onChange,disabled}:{id:string;label:string;choices:Choice[];value:string;onChange:(value:string)=>void;disabled:boolean}) {
  const [search,setSearch]=useState('');const [recent,setRecent]=useState<string[]>([]);
  const filtered=choices.filter(c=>c.label.includes(search.trim())||c.id===value)
    .sort((a,b)=>{const ai=recent.indexOf(a.id),bi=recent.indexOf(b.id);return (ai<0?999:ai)-(bi<0?999:bi);});
  return <div>
    <label htmlFor={id+'-search'}>بحث عن {label}</label>
    <input id={id+'-search'} value={search} disabled={disabled} placeholder={'اكتب للبحث عن '+label}
      style={{display:'block',padding:10,width:'100%',maxWidth:460}} onChange={e=>setSearch(e.target.value)}/>
    <label htmlFor={id}>{label}</label>
    <select id={id} required value={value} disabled={disabled} style={{display:'block',padding:10,width:'100%',maxWidth:460,margin:'6px 0 12px'}}
      onChange={e=>{const selected=e.target.value;onChange(selected);setRecent(old=>[selected,...old.filter(x=>x!==selected)].slice(0,5));setSearch('');}}>
      <option value="">اختر {label}</option>{filtered.map(c=><option key={c.id} value={c.id}>{c.label}{recent.includes(c.id)?' — مستخدم مؤخرًا':''}</option>)}
    </select>
  </div>;
}
