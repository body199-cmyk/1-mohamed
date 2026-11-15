export type DeletionScope={mode:'ALL'}|{mode:'VEHICLE';vehicle_id:string}|{mode:'PERIOD';from:string;to:string};
export type DeletionCounts={trips:number;payments:number;openings:number;vehicles:number;contractors:number;accounts:number};
export type DeletionPreview={status:'OK';challenge_id:string|null;expires_at:string|null;counts:DeletionCounts;blocked:'EMPTY'|'LINKED_OUTSIDE'|'NEGATIVE_BALANCE'|null;confirmation:string};
export const confirmationFor=(mode:DeletionScope['mode'])=>mode==='ALL'?'احذف كل البيانات':mode==='VEHICLE'?'احذف بيانات العربية':'احذف بيانات الفترة';
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function isDeletionScope(v:unknown):v is DeletionScope{
 if(!record(v))return false;
 if(v.mode==='ALL')return keys(v,['mode']);
 if(v.mode==='VEHICLE')return keys(v,['mode','vehicle_id'])&&typeof v.vehicle_id==='string'&&v.vehicle_id.trim().length>0&&v.vehicle_id.length<=200;
 return v.mode==='PERIOD'&&keys(v,['mode','from','to'])&&date(v.from)&&date(v.to)&&v.from<=v.to;
}
export type DeletionRequest={action:'preview';scope:DeletionScope}|{action:'execute';challenge_id:string;confirmation:string;password:string};
export function isDeletionRequest(v:unknown):v is DeletionRequest{
 if(!record(v))return false;
 if(v.action==='preview')return keys(v,['action','scope'])&&isDeletionScope(v.scope);
 return v.action==='execute'&&keys(v,['action','challenge_id','confirmation','password'])
  &&uuid(v.challenge_id)
  &&typeof v.password==='string'&&v.password.length>0&&v.password.length<=1024
  &&typeof v.confirmation==='string'&&['احذف كل البيانات','احذف بيانات العربية','احذف بيانات الفترة'].includes(v.confirmation);
}
export function isDeletionPreview(v:unknown):v is DeletionPreview{
 if(!record(v)||v.status!=='OK'||!record(v.counts))return false;
 const counts=v.counts;
 return ['trips','payments','openings','vehicles','contractors','accounts'].every(k=>Number.isSafeInteger(counts[k])&&(counts[k] as number)>=0)
  &&(v.blocked===null||['EMPTY','LINKED_OUTSIDE','NEGATIVE_BALANCE'].includes(String(v.blocked)))
  &&typeof v.confirmation==='string'&&['احذف كل البيانات','احذف بيانات العربية','احذف بيانات الفترة'].includes(v.confirmation)
  &&(v.blocked!==null?v.challenge_id===null:uuid(v.challenge_id)
    &&typeof v.expires_at==='string'&&Number.isFinite(Date.parse(v.expires_at)));
}
