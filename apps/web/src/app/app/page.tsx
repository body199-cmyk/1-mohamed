import type { Metadata } from "next";
import { getSupabaseSetupStatus } from "../../lib/supabase/config";

export const metadata: Metadata = { title: "حسابات النقل — مساحة العمل" };

/**
 * Protected workspace shell only. No demo data is imported and no persistent
 * save is advertised. Final route activation requires real owner/RLS tests.
 */
export default function ProtectedWorkspacePage() {
  const ready = getSupabaseSetupStatus().ready;
  return <section style={{ maxWidth: 720, margin: "36px auto" }}>
    <h1>مساحة العمل</h1>
    <p role="status">{ready
      ? "تم تجهيز إعداد الاتصال، لكن تفعيل العمليات المالية ينتظر اختبار الحفظ والصلاحيات."
      : "الحفظ الدائم غير متاح قبل ربط قاعدة البيانات والتحقق من الصلاحيات."}</p>
  </section>;
}
