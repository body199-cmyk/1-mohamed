"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../../lib/supabase/client";
import { getSupabaseSetupStatus } from "../../lib/supabase/config";

/** A real Auth sign-out, not a cosmetic redirect. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (busy || !getSupabaseSetupStatus().ready) return;
    setBusy(true);
    setError("");
    try {
      const { error: signOutError } = await createBrowserSupabaseClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch {
      setError("تعذّر تسجيل الخروج. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }
  return <>
    <button type="button" disabled={busy || !getSupabaseSetupStatus().ready}
      onClick={logout}>{busy ? "جارٍ الخروج..." : "تسجيل الخروج"}</button>
    {error && <p role="alert">{error}</p>}
  </>;
}
