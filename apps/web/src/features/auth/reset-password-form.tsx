"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { getSupabaseSetupStatus } from "../../lib/supabase/config";

export function ResetPasswordForm() {
  const router = useRouter();
  const configured = getSupabaseSetupStatus().ready;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || busy) return;
    if (password.length < 12 || password !== confirm) {
      setMessage("كلمة المرور لازم تكون 12 حرفًا على الأقل، وتتطابق في الخانتين.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const client = createBrowserSupabaseClient();
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw new Error("invalid recovery session");
      const { error } = await client.auth.updateUser({ password });
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

  return <section style={{ maxWidth: 440, margin: "48px auto", padding: 24 }}>
    <h1>تعيين كلمة مرور جديدة</h1>
    {!configured && <p role="status">استرجاع الحساب غير مفعّل قبل ربط قاعدة البيانات.</p>}
    <form onSubmit={submit}>
      <label htmlFor="new-password">كلمة المرور الجديدة</label>
      <input id="new-password" type="password" autoComplete="new-password" required
        minLength={12} value={password} onChange={e => setPassword(e.target.value)}
        disabled={!configured || busy} style={{ display: "block", width: "100%", padding: 12, marginBottom: 12 }} />
      <label htmlFor="confirm-password">تأكيد كلمة المرور</label>
      <input id="confirm-password" type="password" autoComplete="new-password" required
        minLength={12} value={confirm} onChange={e => setConfirm(e.target.value)}
        disabled={!configured || busy} style={{ display: "block", width: "100%", padding: 12, marginBottom: 12 }} />
      <button type="submit" disabled={!configured || busy}>{busy ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}</button>
    </form>
    {message && <p role="status">{message}</p>}
  </section>;
}
