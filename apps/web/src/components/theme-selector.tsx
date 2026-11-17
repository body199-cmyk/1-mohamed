"use client";
import {useTheme} from './theme-provider';
import styles from './theme-selector.module.css';
export function ThemeSelector({compact=false}:{compact?:boolean}){
 const {preference,setPreference}=useTheme();
 return <fieldset className={styles.selector}>
  <legend>المظهر</legend>
  <div className={styles.options}>{([['light','فاتح'],['dark','داكن'],['auto','تلقائي']] as const).map(([value,label])=>
   <button type="button" key={value} aria-pressed={preference===value} onClick={()=>setPreference(value)}>{label}</button>
  )}</div>
  {!compact&&<p>تلقائي حسب توقيت جهازك: فاتح من ٦ صباحًا إلى ٦ مساءً، وداكن باقي اليوم.</p>}
 </fieldset>;
}
