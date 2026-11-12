"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { buildAuthCallbackUrl, getSupabaseSetupStatus } from "../../lib/supabase/config";

/**
 * Owner-only login. There is deliberately NO public sign-up.
 * A Supabase Auth user is not authorized merely because their password works:
 * app_is_owner() is the server-backed, fail-closed access gate.
 */
export function LoginForm() {
  const router = useRouter();
  const setup = getSupabaseSetupStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !setup.ready) return;
    setBusy(true);
    setMessage("");
    try {
      const client = createBrowserSupabaseClient();
      if (recovery) {
        const callback = buildAuthCallbackUrl(setup.siteUrl);
        if (!callback) throw new Error("رابط استرجاع كلمة المرور غير مُعد.");
        const url = new URL(callback);
        url.searchParams.set("flow", "recovery");
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
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
      border: "1px solid var(--border, #d7dce5)", borderRadius: 16 }}>
      <h1 id="login-heading">{recovery ? "استرجاع كلمة المرور" : "تسجيل الدخول"}</h1>
      <p>حسابات النقل والمقاولين — الدخول للحسابات المصرّح بها فقط.</p>
      {!setup.ready && <p role="status">الربط الآمن لم يُفعّل بعد. لا تدخل كلمة مرور حقيقية الآن.</p>}
      <form onSubmit={submit}>
        <label htmlFor="owner-email">البريد الإلكتروني</label>
        <input id="owner-email" type="email" required autoComplete="email" value={email}
          onChange={e => setEmail(e.target.value)} disabled={busy || !setup.ready}
          style={{ width: "100%", padding: 12, marginBottom: 14, display: "block" }} />
        {!recovery && <>
          <label htmlFor="owner-password">كلمة المرور</label>
          <input id="owner-password" type="password" required autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)}
            disabled={busy || !setup.ready}
            style={{ width: "100%", padding: 12, marginBottom: 14, display: "block" }} />
        </>}
        <button type="submit" disabled={busy || !setup.ready || done}
          style={{ padding: "10px 24px", cursor: "pointer" }}>
          {busy ? "جارٍ التحقق..." : recovery ? "إرسال رابط الاسترجاع" : "دخول"}
        </button>
      </form>
      <button type="button" onClick={() => { setRecovery(!recovery); setMessage(""); setDone(false); }}
        disabled={busy} style={{ display: "block", marginTop: 16 }}>
        {recovery ? "الرجوع لتسجيل الدخول" : "نسيت كلمة المرور؟"}
      </button>
      {message && <p role="status">{message}</p>}
      <p style={{ fontSize: 13 }}>لا يوجد تسجيل حسابات جديدة من الموقع. يضيف المسؤول الحسابات المعتمدة لاحقًا.</p>
    </section>
  );
}
