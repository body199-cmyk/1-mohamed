"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createRecoveryRequestClient } from "../../lib/supabase/client";
import { buildAuthCallbackUrl, getSupabaseSetupStatus } from "../../lib/supabase/config";
import { PasswordField } from "./password-field";
import {ThemeSelector} from "../../components/theme-selector";
import {WorkspaceIcon} from "../ledger/workspace-icon";
import styles from "./login-form.module.css";
import { REMEMBER_COOKIE } from "../../lib/supabase/remember";

/** Owner-only login. The server resolves the public alias to the verified Auth email. */
export function LoginForm({ enabled = false }: { enabled?: boolean }) {
  const router = useRouter();
  const setup = getSupabaseSetupStatus();
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
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
      if (recovery) {
        const callback = buildAuthCallbackUrl(setup.siteUrl);
        if (!callback) throw new Error("رابط استرجاع كلمة المرور غير مُعد.");
        const url = new URL(callback);
        url.searchParams.set("flow", "recovery");
        const { error } = await createRecoveryRequestClient().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: url.toString(),
        });
        if (error) throw error;
        setDone(true);
        setMessage("لو البريد مسجل ومسموح له بالدخول، هتوصله تعليمات استرجاع كلمة المرور.");
        return;
      }

      document.cookie = `${REMEMBER_COOKIE}=${remember ? "1" : "0"}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}${remember ? "; Max-Age=2592000" : ""}`;
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      if (!response.ok) throw new Error("تعذّر إكمال الطلب.");
      router.replace("/app");
      router.refresh();
    } catch {
      setMessage("تعذّر إكمال الطلب. تأكد من بيانات الدخول أو حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.brand}>
        <span className={styles.brandMark}><WorkspaceIcon name="daily"/></span>
        <div><strong>أحمد أبو علي</strong><p>حسابات النقل والمقاولين</p></div>
      </header>
      <section aria-labelledby="login-heading" className={styles.card}>
      <div className={styles.heading}>
        <h1 id="login-heading">{recovery ? "استرجاع كلمة المرور" : "تسجيل الدخول"}</h1>
        <p>{recovery?"اكتب بريد حسابك لاستلام رابط الاسترجاع.":"أدخل بيانات حسابك للمتابعة إلى حسابات النقل."}</p>
      </div>
      {!setup.ready && <p className={styles.notice} role="status">الربط الآمن لم يُفعّل بعد. لا تدخل كلمة مرور حقيقية الآن.</p>}
      {setup.ready && !enabled && <p className={styles.notice} role="status">الحسابات الدائمة غير مفعّلة على النسخة دي. الدخول متوقف لحد استكمال إعداد التشغيل؛ ده مش معناه إن حسابك اتمسح أو كلمة السر غلط.</p>}
      <form onSubmit={submit} autoComplete="on" className={styles.form} aria-busy={busy}>
        <label htmlFor="owner-identifier">{recovery ? "البريد الإلكتروني" : "اسم المستخدم أو البريد الإلكتروني"}</label>
        <input id="owner-identifier" type={recovery ? "email" : "text"} required
          autoComplete={recovery ? "email" : "username"} autoCapitalize="none" autoCorrect="off"
          maxLength={254} placeholder={recovery ? "name@example.com" : "اسم المستخدم أو name@example.com"}
          value={recovery ? email : identifier}
          onChange={e => recovery ? setEmail(e.target.value) : setIdentifier(e.target.value)}
          disabled={busy || !enabled || !setup.ready}
          className={styles.identifier} spellCheck={false} />
        {!recovery && <>
          <PasswordField id="owner-password" label="كلمة المرور" autoComplete="current-password"
            value={password} onChange={setPassword} disabled={busy || !enabled || !setup.ready} />
          <label className={styles.remember}><input type="checkbox" checked={remember}
            onChange={e => setRemember(e.target.checked)} disabled={busy || !enabled || !setup.ready} />{" "}تذكر دخولي على هذا المتصفح</label>
          <p className={styles.hint}>فعّل تذكّر الدخول على جهازك الشخصي فقط. حفظ كلمة المرور يتم من مدير كلمات المرور في المتصفح.</p>
        </>}
        <button type="submit" disabled={busy || !enabled || !setup.ready || done}
          className={styles.submit}>
          {busy ? "جارٍ التحقق..." : recovery ? "إرسال رابط الاسترجاع" : "دخول"}
        </button>
      </form>
      <button type="button" onClick={() => {
        if (!recovery && identifier.includes("@")) setEmail(identifier.trim());
        setRecovery(!recovery); setMessage(""); setDone(false);
      }} disabled={busy || !enabled || !setup.ready} className={styles.recovery}>
        {recovery ? "الرجوع لتسجيل الدخول" : "نسيت كلمة المرور؟"}
      </button>
      {message && <p className={styles.notice+" "+styles.message} role="status">{message}</p>}
      <p className={styles.access}>لا يوجد تسجيل حسابات جديدة من الموقع. يضيف المسؤول الحسابات المعتمدة لاحقًا.</p>
    </section>
    <div className={styles.appearance}><ThemeSelector/></div>
    </div>
  );
}
