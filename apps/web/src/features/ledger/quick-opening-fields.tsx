import {assertDecimal,poundsToPiastres} from '../../lib/ledger/amounts';
import styles from './trip-entry-design.module.css';

export type QuickOpening={date:string;signedPiastres:string;contractorId?:string};
export type OpeningDraft={enabled:boolean;amount:string;date:string;direction:''|'OWED_TO_CONTRACTOR'|'OWED_TO_AHMED';contractorId:string};
export const emptyOpening=():OpeningDraft=>({enabled:false,amount:'',date:'',direction:'',contractorId:''});
export function parseQuickOpening(kind:'vehicle'|'contractor',draft:OpeningDraft):QuickOpening|undefined{
 if(!draft.enabled)return undefined;
 if(!draft.date)throw new Error('حدد تاريخ بداية الرصيد القديم.');
 const positive=poundsToPiastres(assertDecimal(draft.amount,2,true));
 if(kind==='vehicle'&&!draft.contractorId)throw new Error('اختر المقاول المسؤول عن نقدية العربية.');
 if(kind==='contractor'&&!draft.direction)throw new Error('حدد هل الرصيد للمقاول أم عليه.');
 return {date:draft.date,signedPiastres:kind==='contractor'&&draft.direction==='OWED_TO_CONTRACTOR'?(-BigInt(positive)).toString():positive,
  ...(kind==='vehicle'?{contractorId:draft.contractorId}:{})};
}
export function QuickOpeningFields({kind,draft,onChange,disabled,contractors}:{kind:'vehicle'|'contractor';draft:OpeningDraft;
 onChange:(value:OpeningDraft)=>void;disabled:boolean;contractors:{id:string;name:string}[]}){
 const change=(patch:Partial<OpeningDraft>)=>onChange({...draft,...patch});
 return <fieldset className={styles.openingFields} disabled={disabled}>
  <legend>الرصيد القديم</legend>
  <label className={styles.openingCheck}><input type="checkbox" checked={draft.enabled} onChange={e=>change({enabled:e.target.checked})}/> إضافة رصيد قديم (اختياري)</label>
  {draft.enabled&&<>
   <p>{kind==='vehicle'?'رصيد مستحق للعربية فقط، مستقل عند كل مقاول مسؤول.':'رصيد شغل قديم بين المقاول وأحمد؛ ليس دفعة نقدية للعربيات.'}</p>
   {kind==='vehicle'?<>
    <label htmlFor="quick-opening-contractor">المقاول المسؤول عن رصيد العربية</label>
    <select id="quick-opening-contractor" className={styles.control} required value={draft.contractorId} onChange={e=>change({contractorId:e.target.value})}>
     <option value="">اختر المقاول المسؤول</option>{contractors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select><p>اتجاه الرصيد: للعربية عند المقاول المختار.</p>
   </>:<>
    <label htmlFor="quick-opening-direction">الرصيد القديم للمقاول أم عليه؟</label>
    <select id="quick-opening-direction" className={styles.control} required value={draft.direction} onChange={e=>change({direction:e.target.value as OpeningDraft['direction']})}>
     <option value="">اختر اتجاه الرصيد</option><option value="OWED_TO_CONTRACTOR">للمقاول عند أحمد</option><option value="OWED_TO_AHMED">على المقاول لصالح أحمد</option>
    </select>
   </>}
   <label htmlFor="quick-opening-amount">المبلغ القديم بالجنيه — اكتب رقمًا موجبًا</label>
   <input id="quick-opening-amount" className={styles.control} inputMode="decimal" required value={draft.amount} onChange={e=>change({amount:e.target.value})}/>
   <label htmlFor="quick-opening-date">تاريخ بداية الرصيد القديم</label>
   <input id="quick-opening-date" className={styles.control} type="date" required value={draft.date} onChange={e=>change({date:e.target.value})}/>
   <p>المبلغ رصيد بداية مجمّع؛ لا تسجّل نفس الشغل القديم مرة أخرى كنقلات تفصيلية.</p>
  </>}
 </fieldset>;
}
