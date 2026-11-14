export function wholeHistoryPeriod(dates:readonly string[],opening:string|undefined,fallback:string){
 const ordered=dates.filter(date=>!opening||date>=opening).sort();
 const from=opening||ordered[0]||fallback;
 return {from,to:ordered.at(-1)||from};
}

export function ReportHistoryScope({checked,onChange,disabled=false}:{checked:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){
 return <label style={{display:'block',margin:'12px 0'}}>
  <input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/>
  {' '}كل الحساب من البداية
 </label>;
}
