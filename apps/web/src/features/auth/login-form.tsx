"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient,createRecoveryRequestClient } from "../../lib/supabase/client";
import { buildAuthCallbackUrl, getSupabaseSetupStatus } from "../../lib/supabase/config";
import {PasswordField} from './password-field';
import {REMEMBER_COOKIE} from '../../lib/supabase/remember';

/**
 * Owner-only login. There is deliberately NO public sign-up.
 * A Supabase Auth user is not authorized merely because their password works:
 * app_is_owner() is the server-backed, fail-closed access gate.
 */
export function LoginForm({ enabled = false }: { enabled?: boolean }) {
  const router = useRouter();
  const setup = getSupabaseSetupStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember,setRemember]=useState(false);
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !enabled || !setup.ready) return;
    setBusy(true);
    setMessage("");
    try {
      if(!recovery)document.cookie=`${REMEMBER_COOKIE}=${remember?'1':'0'}; Path=/; SameSite=Lax${location.protocol==='https:'?'; Secure':''}${remember?'; Max-Age=2592000':''}`;
      const client = createBrowserSupabaseClient();
      if (recovery) {
        const callback = buildAuthCallbackUrl(setup.siteUrl);
        if (!callback) throw new Error("رابط استرجاع كلمة المرور غير مُعد.");
        const url = new URL(callback);
        url.searchParams.set("flow", "recovery");
        const { error } = await createRecoveryRequestClient().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: url.toString(),
        });
        if (error) throw error;
        // Never reveal whether the email is registered.
        setDone(true);
        setMessage("لو البريد مسجل ومسموح له بالدخول، هتوصله تعليمات استرجاع كلمة المرور.");
        return;
      }
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(), password,
      });
      if (error) throw error;
      const { data, error: ownerError } = await client.rpc("app_is_owner");
      if (ownerError || data !== true) {
        await client.auth.signOut();
        throw new Error("الحساب غير مصرح له باستخدام النظام.");
      }
      router.replace("/app");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error && error.message === "الحساب غير مصرح له باستخدام النظام."
        ? error.message
        : "تعذّر إكمال الطلب. تأكد من بيانات الدخول أو حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="login-heading" style={{ maxWidth: 440, margin: "48px auto", padding: 24,
      border: "1px solid var(--border-color, #d7dce5)", borderRadius: 16,
      background:'var(--surface-card,#fff)',boxShadow:'var(--shadow-elevated)',borderTop:'4px solid var(--color-primary,#175CD3)' }}>
      <p style={{color:'var(--color-primary,#175CD3)',fontWeight:700}}>أحمد أبو علي — حسابات النقل</p>
      <h1 id="login-heading">{recovery ? "استرجاع كلمة المرور" : "تسجيل الدخول"}</h1>
      <p>حسابات النقل والمقاولين — الدخول للحسابات المصرّح بها فقط.</p>
      {!setup.ready && <p role="status">الربط الآمن لم يُفعّل بعد. لا تدخل كلمة مرور حقيقية الآن.</p>}
      {setup.ready && !enabled && <p role="status">الحسابات الدائمة غير مفعّلة على النسخة دي. الدخول متوقف لحد استكمال إعداد التشغيل؛ ده مش معناه إن حسابك اتمسح أو كلمة السر غلط.</p>}
      <form onSubmit={submit} autoComplete="on">
        <label htmlFor="owner-email">البريد الإلكتروني</label>
        <input id="owner-email" type="email" required autoComplete="username" value={email}
          onChange={e => setEmail(e.target.value)} disabled={busy || !enabled || !setup.ready}
          style={{ width: "100%", padding: 12, marginBottom: 14, display: "block", border:"1px solid var(--border-strong)",borderRadius:10,background:"var(--surface-card)",color:"var(--text-main)" }} />
        {!recovery && <>
          <PasswordField id="owner-password" label="كلمة المرور" autoComplete="current-password"
            value={password} onChange={setPassword} disabled={busy || !enabled || !setup.ready}/>
          <label style={{display:'block',marginBottom:16}}><input type="checkbox" checked={remember}
            onChange={e=>setRemember(e.target.checked)} disabled={busy||!enabled||!setup.ready}/>{' '}تذكر دخولي على هذا المتصفح</label>
          <p style={{fontSize:13}}>فعّل تذكّر الدخول على جهازك الشخصي فقط. حفظ كلمة المرور يتم من مدير كلمات المرور في المتصفح.</p>
        </>}
        <button type="submit" disabled={busy || !enabled || !setup.ready || done}
          style={{ padding: "12px 24px", cursor: "pointer",width:'100%',minHeight:48,border:0,borderRadius:10,
            background:'var(--color-primary,#175CD3)',color:'var(--color-primary-text,#fff)',fontWeight:700 }}>
          {busy ? "جارٍ التحقق..." : recovery ? "إرسال رابط الاسترجاع" : "دخول"}
        </button>
      </form>
      <button type="button" onClick={() => { setRecovery(!recovery); setMessage(""); setDone(false); }}
        disabled={busy || !enabled || !setup.ready} style={{ display: "block", marginTop: 16 }}>
        {recovery ? "الرجوع لتسجيل الدخول" : "نسيت كلمة المرور؟"}
      </button>
      {message && <p role="status">{message}</p>}
      <p style={{ fontSize: 13 }}>لا يوجد تسجيل حسابات جديدة من الموقع. يضيف المسؤول الحسابات المعتمدة لاحقًا.</p>
    </section>
  );
}
