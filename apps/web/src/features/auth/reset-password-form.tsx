"use client";

import { useEffect,useRef,useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { getSupabaseSetupStatus } from "../../lib/supabase/config";
import {PasswordField} from './password-field';

export function ResetPasswordForm() {
  const router = useRouter();
  const configured = getSupabaseSetupStatus().ready;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [canReset,setCanReset]=useState(false);
  const verification=useRef<Promise<void>|null>(null);
  useEffect(()=>{
    if(!configured)return;
    let active=true;
    if(!verification.current)verification.current=(async()=>{
    const params=new URLSearchParams(window.location.hash.slice(1));
    const access=params.get('access_token'),refresh=params.get('refresh_token');
    const recovery=['recovery','invite'].includes(params.get('type')??'');
    if(window.location.hash)window.history.replaceState(null,'',window.location.pathname+window.location.search);
        const client=createBrowserSupabaseClient();
        if(access||refresh){
          if(!recovery||!access||!refresh)throw new Error('invalid recovery');
          const result=await client.auth.setSession({access_token:access,refresh_token:refresh});
          if(result.error)throw result.error;
        }
        const user=await client.auth.getUser();
        if(user.error||!user.data.user)throw new Error('missing session');
        const owner=await client.rpc('app_has_access');
        if(owner.error||owner.data!==true)throw new Error('not authorized');
    })();
    void verification.current.then(()=>{if(active)setCanReset(true);}).catch(()=>{
      if(active)setMessage('الرابط غير صالح أو انتهت صلاحيته. اطلب رابط استرجاع جديد.');
    });
    return()=>{active=false;};
  },[configured]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || !canReset || busy) return;
    if (password !== confirm) {
      setMessage("كلمة المرور لازم تتطابق في الخانتين.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const client = createBrowserSupabaseClient();
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw new Error("invalid recovery session");
      const owner=await client.rpc('app_has_access');
      if(owner.error||owner.data!==true)throw new Error('unauthorized recovery');
      const { error } = await client.auth.updateUser({ password });
      if (error?.code === 'weak_password') {
        setMessage('خدمة تسجيل الدخول رفضت كلمة المرور دي. جرّب كلمة أطول أو مختلفة.');
        return;
      }
      if (error) throw error;
      await client.auth.signOut();
      router.replace("/login?reset=success");
      router.refresh();
    } catch {
      setMessage("الرابط غير صالح أو انتهت صلاحيته. اطلب رابط استرجاع جديد.");
    } finally {
      setBusy(false);
    }
  }

  return <section style={{ maxWidth: 440, margin: "48px auto", padding: 24,
    border:'1px solid var(--border-color,#d7dce5)',borderTop:'4px solid var(--color-primary,#175CD3)',
    borderRadius:16,background:'var(--surface-card,#fff)',boxShadow:'var(--shadow-elevated)' }}>
    <h1>تعيين كلمة مرور جديدة</h1>
    {!configured && <p role="status">استرجاع الحساب غير مفعّل قبل ربط قاعدة البيانات.</p>}
    <form onSubmit={submit}>
      <PasswordField id="new-password" label="كلمة المرور الجديدة" autoComplete="new-password"
        value={password} onChange={setPassword} disabled={!configured||!canReset||busy}/>
      <PasswordField id="confirm-password" label="تأكيد كلمة المرور" autoComplete="new-password"
        value={confirm} onChange={setConfirm} disabled={!configured||!canReset||busy}/>
      <button type="submit" disabled={!configured || !canReset || busy} style={{width:'100%',padding:12,minHeight:48,
        border:0,borderRadius:10,background:'var(--color-primary,#175CD3)',color:'var(--color-primary-text,#fff)',fontWeight:700}}>{busy ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {!canReset&&!message&&configured&&<p role="status">جارٍ التحقق من رابط الاسترجاع...</p>}
    <p><a href="/login">الرجوع لتسجيل الدخول وطلب رابط جديد</a></p>
  </section>;
}
