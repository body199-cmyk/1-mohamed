import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الدخول غير متاح — حسابات النقل",
  description: "مصادقة الحساب الدائم قيد الإعداد. لا تدخل بيانات دخول هنا.",
};

/**
 * AUTH-01 / H039: honest placeholder, not a fake sign-in form.
 * It never accepts passwords or claims a successful persistent session.
 */
export default function LoginNotConfiguredPage() {
  return (
    <section
      aria-labelledby="auth-unavailable-title"
      style={{ margin: "40px auto", maxWidth: 560, lineHeight: 1.9 }}
    >
      <h1 id="auth-unavailable-title">تسجيل الدخول غير متاح حاليًا</h1>
      <p role="status">
        لم يتم ربط مصادقة Supabase بعد. لن نعرض نموذج تسجيل دخول أو حفظ دائم
        قبل تجهيز اتصال حقيقي واختباره.
      </p>
      <p>
        تقدر تجرّب تسجيل النقلات وكشف الحساب في نسخة المعاينة المؤقتة فقط،
        لكن البيانات التجريبية لا تُحفظ بعد تحديث الصفحة.
      </p>
      <Link href="/demo/trips">العودة إلى معاينة تسجيل النقلات</Link>
    </section>
  );
}
