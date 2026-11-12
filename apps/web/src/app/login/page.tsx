import type { Metadata } from "next";
import { LoginForm } from "../../features/auth/login-form";

export const metadata: Metadata = {
  title: "تسجيل الدخول — حسابات النقل",
  description: "دخول الحسابات المعتمدة فقط؛ لا يوجد تسجيل عام.",
};

/** The login UI is prepared but inactive until Supabase is configured. */
export default function LoginPage() {
  return <LoginForm />;
}
