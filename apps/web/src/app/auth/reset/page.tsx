import type { Metadata } from "next";
import { ResetPasswordForm } from "../../../features/auth/reset-password-form";

export const metadata: Metadata = { title: "استرجاع كلمة المرور — حسابات النقل",referrer:'no-referrer' };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
