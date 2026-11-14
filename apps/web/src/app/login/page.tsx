import type { Metadata } from "next";
import { LoginForm } from "../../features/auth/login-form";

export const metadata: Metadata = {
  title: "تسجيل الدخول — حسابات النقل",
  description: "دخول الحسابات المعتمدة فقط؛ لا يوجد تسجيل عام.",
};

// Read the same server-only runtime gate as proxy.ts, rather than freezing
// its value in a static login page during the build.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm enabled={process.env.APP_ENABLE_REAL_DATA === "true"} />;
}
