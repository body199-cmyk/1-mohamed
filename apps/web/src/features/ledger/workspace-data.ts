"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseSetupStatus } from "../../lib/supabase/config";
import { postLedgerWrite } from "../../lib/ledger/transport";
import type { WriteOperation } from "../../lib/ledger/operation-contract";
export type Contractor = { id: string; name: string; is_primary: boolean; is_archived: boolean; version: number };
export type Vehicle = { id: string; plate_number: string; driver_name: string | null; notes: string | null; is_archived: boolean; version: number };
export type Account = { vehicle_id: string; contractor_id: string };
export type LedgerEntities = { contractors: Contractor[]; vehicles: Vehicle[]; accounts: Account[] };
export type LedgerWrite = (operation: WriteOperation, payload: Record<string,unknown>) => Promise<boolean>;

export function useWorkspaceData() {
  const configured = getSupabaseSetupStatus().ready;
  const [entities,setEntities] = useState<LedgerEntities>({contractors:[],vehicles:[],accounts:[]});
  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [loadError,setLoadError] = useState("");
  const [revision,setRevision] = useState(0);
  const pending = useRef(new Map<string,string>());
  const writeLock = useRef(false);
  const readToken = useRef(0);
  const refresh = useCallback(async () => {
    if (!configured) return;
    const token = ++readToken.current;
    setRevision(x=>x+1);
    setLoading(true);
    try {
      async function all<T>(type:string):Promise<T[]> {
        const items:T[]=[];
        for(let offset=0;offset<10000;offset+=200) {
          const response=await fetch(`/api/ledger/master?type=${type}&offset=${offset}&limit=200`,{credentials:"same-origin",cache:"no-store"});
          const page=await response.json();
          if(!response.ok || !page.ok || !Array.isArray(page.data)) throw new Error(page.error || "تعذر تحميل البيانات.");
          items.push(...page.data);
          if(!page.hasMore) return items;
        }
        throw new Error("البيانات تجاوزت حد القراءة؛ أوقفنا الإدخال حتى لا تظهر قوائم ناقصة.");
      }
      const [contractors,vehicles,accounts]=await Promise.all([
        all<Contractor>("contractors"),all<Vehicle>("vehicles"),all<Account>("vehicle_accounts")]);
      if(token===readToken.current) {
        setEntities({contractors,vehicles,accounts});
        setLoadError("");
      }
    } catch(error) { if(token===readToken.current) setLoadError(error instanceof Error ? error.message : "تعذر التحديث."); }
    finally { if(token===readToken.current) setLoading(false); }
  },[configured]);
  useEffect(()=>{void refresh();return ()=>{readToken.current++;};},[refresh]);
  const write:LedgerWrite = async(operation,payload)=>{
    if(writeLock.current || !configured || loading) return false;
    writeLock.current=true;setBusy(true);setNotice("");
    const signature=operation+":"+JSON.stringify(payload);
    const key=pending.current.get(signature)??crypto.randomUUID();
    pending.current.set(signature,key);
    try {
      const response=await postLedgerWrite<{status?:string;message?:string}>(operation,payload,key);
      if(!response.ok){setNotice(response.error);return false;}
      if(response.data?.status==="NEEDS_DECISION") {
        pending.current.delete(signature);setNotice(response.data.message??"يلزم مراجعة العملية.");return false;
      }
      if(response.data?.status!=="OK") {setNotice("رد الحفظ غير مؤكد. أعد المحاولة بنفس البيانات.");return false;}
      pending.current.delete(signature);setRevision(x=>x+1);
      setNotice("تم الحفظ بنجاح.");await refresh();return true;
    } catch {setNotice("انقطع الاتصال ولم تتأكد نتيجة الحفظ. أعد المحاولة بنفس البيانات.");return false;}
    finally {writeLock.current=false;setBusy(false);}
  };
  return {...entities,configured,loading,busy,notice:loadError||notice,revision,refresh,write};
}
