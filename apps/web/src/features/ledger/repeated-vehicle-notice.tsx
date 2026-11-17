"use client";
import {useEffect,useState} from 'react';
import {postLedgerRead} from '../../lib/ledger/transport';
import styles from './daily-work.module.css';

/** Advisory only: the existing reader counts saved active trips for this vehicle/day,
 * across contractors. It never prevents another valid trip or changes its payload. */
export function RepeatedVehicleNotice({vehicleId,date,revision,disabled}:{vehicleId:string;date:string;revision?:number;disabled:boolean}){
 const [result,setResult]=useState<{key:string;count:string|null;error:boolean}|null>(null);
 const key=JSON.stringify([vehicleId,date,revision,disabled]);
 useEffect(()=>{
  if(!vehicleId||!date||disabled)return;
  const controller=new AbortController();
  void postLedgerRead<{status:string;total_count:string|number}>('trips.list',{
   vehicle_id:vehicleId,date_from:date,date_to:date,include_cancelled:false,limit:1
  },controller.signal).then(response=>{
   if(controller.signal.aborted)return;
   if(!response.ok||response.data.status!=='OK'||! /^(0|[1-9][0-9]*)$/.test(String(response.data.total_count)))throw new Error('Invalid count');
   setResult({key,count:String(response.data.total_count),error:false});
  }).catch(()=>{if(!controller.signal.aborted)setResult({key,count:null,error:true});});
  return ()=>controller.abort();
 },[vehicleId,date,revision,disabled,key]);
 if(!vehicleId||!date||disabled)return null;
 const current=result?.key===key?result:null;
 return <p className={styles.repeatNotice} role="status" aria-label="نقلات العربية في اليوم المختار">
  {!current?'جارٍ مراجعة نقلات العربية في التاريخ المختار…':current.error?
   'تعذر التأكد من نقلات العربية السابقة؛ راجع المسجّل لهذا اليوم. تقدر تكمّل تسجيل النقلة.':
   current.count!=='0'?`العربية دي مسجّل لها ${current.count} نقلة في ${date}؛ دي هتتحفظ كنقلة جديدة، حتى لو المقاول مختلف.`:
   'لا توجد نقلات مسجّلة للعربية في التاريخ المختار.'}
 </p>;
}
