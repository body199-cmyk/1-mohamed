/**
 * BUILD-01 / الأجزاء المستقلة — حالة إعداد Supabase.
 *
 * هذه الوحدة بلا أي اعتماد خارجي عن قصد: تُقرأ في المتصفح والخادم،
 * ويجب ألا يفشل build أو مسار /demo/* عند غياب الإعدادات.
 * لا تُنشئ عميلًا، ولا تقرأ كلمة سر، ولا تحتوي على مفتاح إداري.
 *
 * غياب أي متغير ⇒ حالة «إعداد غير مكتمل»، وليس نجاحًا وهميًا.
 */

export const SUPABASE_SETUP_INCOMPLETE_MESSAGE =
  'إعداد الاتصال غير مكتمل. الحفظ الدائم غير متاح حاليًا، والمعاينة المؤقتة تعمل بشكل مستقل.';

export type SupabaseSetupStatus = {
  ready: boolean;
  missing: string[];
  message: string;
  url: string;
  publishableKey: string;
  siteUrl: string;
};

/**
 * المراجع المباشرة فقط تُضمَّن في حزمة المتصفح بواسطة Next.js؛
 * لذلك لا نستخدم process.env[name] باسم متغير محسوب.
 */
export function getSupabaseSetupStatus(): SupabaseSetupStatus {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();

  // الاسم الحالي في التوثيق الرسمي، مع قبول الاسم القديم توافقًا مع مشاريع قائمة.
  const publishableKey =
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim() ||
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();

  const missing: string[] = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!publishableKey) missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (!siteUrl) missing.push('NEXT_PUBLIC_SITE_URL');

  return {
    ready: missing.length === 0,
    missing,
    message: missing.length === 0 ? '' : SUPABASE_SETUP_INCOMPLETE_MESSAGE,
    url,
    publishableKey,
    siteUrl,
  };
}

/** يُستخدم في الخادم قبل أي عملية دائمة؛ لا يسمح بنجاح صامت عند نقص الإعداد. */
export function assertSupabaseConfigured(): SupabaseSetupStatus {
  const status = getSupabaseSetupStatus();
  if (!status.ready) {
    throw new Error(
      `${SUPABASE_SETUP_INCOMPLETE_MESSAGE} المتغيرات الناقصة: ${status.missing.join(', ')}`
    );
  }
  return status;
}

/**
 * قاعدة مسموح بها لإعادة التوجيه فقط. تمنع تمرير عنوان خارجي من الرابط
 * إلى صفحات الدخول أو استرجاع كلمة المرور (open redirect).
 */
export function isAllowedRedirectPath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.includes('\\')) return false;
  if (path.includes('\n') || path.includes('\r')) return false;
  return true;
}

/** يبني رابط الرجوع بعد استرجاع كلمة المرور داخل نطاق التطبيق نفسه. */
export function buildAuthCallbackUrl(siteUrl: string): string | null {
  let base: URL;
  try {
    base = new URL(siteUrl);
  } catch {
    return null;
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') return null;
  return new URL('/auth/callback', base).toString();
}
