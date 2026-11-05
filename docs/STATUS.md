# الحالة الحالية

**آخر تحديث: ٥ نوفمبر ٢٠٢٦ — H041 / AUTH-01 SDK FOUNDATION على [PR #4](https://github.com/body199-cmyk/1-mohamed/pull/4).** الحالة على الفرع: SDK والعملاء المقترحون موجودون، والحراسة الأصلية لم تتغير. **المصادقة الحقيقية والحفظ الدائم غير متاحين بعد.**

## ما تأكد إغلاقه سابقًا

- **DB-03 / H038:** [PR #1](https://github.com/body199-cmyk/1-mohamed/pull/1) مدموج SHA `cf96b0c5`؛ CI `41943012378` نجاح (PostgreSQL معزول).
- **AUTH-01/PREP / H039:** [PR #2](https://github.com/body199-cmyk/1-mohamed/pull/2) مدموج SHA `df6f54c7`؛ CI `41944665834` نجاح، حراسة deny-by-default مع HTTP smoke.
- **توثيق الاستلام H040:** [PR #3](https://github.com/body199-cmyk/1-mohamed/pull/3) مدموج SHA `8eb59690`.
- **منطق التطبيق:** أربع حزم + معاينة `/demo/*` مؤقتة بالذاكرة، وSQL A/B/C مع H038 اختبرت ضمن بيئة PGlite. لا بيانات Supabase حية.

## المهمة الجارية H041 (غير مكتملة وغير مدموجة)

نطاق مستقل من `AUTH-01/REAL-INTEGRATION`: تثبيت `@supabase/ssr@0.12.7` و`@supabase/supabase-js@2.119.0` مع lockfile مولد فعليًا، وإنشاء `client.ts` و`server.ts` و`owner.ts` و`proxy-session.ts` بلا تشغيل لها على المسارات، واختبار حدود SDK وHTTP. المرجع: [تقرير H041](AUTH_01_H041_REVIEW.md).

**القبول مشروط** بمراجعة نقدية منفصلة ونجاح CI على أحدث commit، وتوثيق النتيجة هنا ثم دمج PR بإذن المستخدم السابق. لا نحسب وجود الملف أو مرور `npm ci` وحده نجاح Auth حقيقي.

## المتبقي بعد هذه الخطوة

- مشروع Supabase **اختباري منفصل** مع GoTrue/PostgREST وحساب المالك الإداري؛ لا أسرار في GitHub.
- ربط login/logout/recovery/callback بالكوكي و`getClaims()`، والتحقق من `app_is_owner()` لكل عملية؛ اختبار المالك وغير المالك والـanon والجلسات المنتهية ورفض الطلبات وخطر تسريب الكوكي/التخزين.
- بعدها فقط يُسمح بدراسة فتح واجهة الحفظ الدائم، ومهمات الدفعات تتطلب D15/D16. لا نشر أو أموال حقيقية الآن.

**نقطة الاستئناف:** [AGENTS](../AGENTS.md) ← هذا الملف ← [TASKS](TASKS.md) ← [SUBTASKS](SUBTASKS.md) ← [تقرير H041](AUTH_01_H041_REVIEW.md) ← [HANDOFF](HANDOFF_LOG.md#h041) ← [PR #4](https://github.com/body199-cmyk/1-mohamed/pull/4).

المعاينة: `npm run dev` ثم `/demo/trips` أو `/demo/contractors`؛ لا حفظ دائم. اختبارات PGlite: `npm run db:verify`، حراسة HTTP: `node tools/auth-boundary-smoke.mjs` مع خادم Next.
