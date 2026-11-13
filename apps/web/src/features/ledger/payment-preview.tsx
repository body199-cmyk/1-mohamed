"use client";
import {useEffect,useState} from 'react';
import {postLedgerRead} from '../../lib/ledger/transport';
import {assertDecimal,piastresToPounds,poundsToPiastres} from '../../lib/ledger/amounts';
import {assertSqlMoney} from '../../lib/ledger/report-contract';
export function PaymentPreview({account,amount,revision=0}:{account:string;amount:string;revision?:number}) {
  const [balance,setBalance]=useState<string|null>(null);const [error,setError]=useState('');
  useEffect(()=>{
    setBalance(null);setError('');const [vehicle_id,responsible_contractor_id]=account.split('|');
    if(!vehicle_id||!responsible_contractor_id)return;
    const controller=new AbortController();let active=true;
    void postLedgerRead<{current_cash_balance_piastres:string}>('payments.list',{vehicle_id,responsible_contractor_id,limit:1},controller.signal)
      .then(result=>{if(!active)return;if(!result.ok)throw new Error(result.error);
        assertSqlMoney(result.data.current_cash_balance_piastres);setBalance(result.data.current_cash_balance_piastres);})
      .catch(()=>{if(active)setError('تعذرت معاينة الرصيد. أعد اختيار الحساب لتحديثه.');});
    return ()=>{active=false;controller.abort();};
  },[account,revision]);
  let after:string|null=null;
  try{if(balance!==null)after=(BigInt(balance)-BigInt(poundsToPiastres(assertDecimal(amount,2,true)))).toString();}catch{/* Invalid amounts have no misleading preview. */}
  return <div aria-label="معاينة رصيد الدفعة" aria-live="polite">
    {error&&<p role="alert">{error}</p>}
    {balance!==null&&<p>الرصيد الحالي قبل الدفع: <bdi>{piastresToPounds(balance)}</bdi> جنيه</p>}
    {after!==null&&<p>الرصيد المتوقع بعد الدفع: <bdi>{piastresToPounds(after)}</bdi> جنيه</p>}
    {after!==null&&BigInt(after)<0n&&<p role="alert">المبلغ أكبر من الرصيد الحالي.</p>}
    <small>معاينة للرصيد الحالي. الدفعة القديمة تُراجع أيضًا مقابل أرصدة الأيام اللاحقة قبل قبول الحفظ.</small>
  </div>;
}
