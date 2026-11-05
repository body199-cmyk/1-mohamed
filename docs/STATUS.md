# الحالة الحالية

**آخر تحديث: ٥ نوفمبر ٢٠٢٦ — H043 / UI-BASE-01A على [PR #6](https://github.com/body199-cmyk/1-mohamed/pull/6).** استكمال الوظائف المستقلة قبل ربط حسابات Supabase/Vercel، بناءً على [الخطة H042](OFFLINE_FIRST_ROADMAP_H042.md).

## ما اكتمل ومُدمج على main

- H038 / DB-03 للنقلات ووصف الإيصال: [PR #1](https://github.com/body199-cmyk/1-mohamed/pull/1) CI منفصل ناجح.
- H039 / الحراسة المؤقتة deny-by-default: [PR #2](https://github.com/body199-cmyk/1-mohamed/pull/2) CI وHTTP ناجحان؛ **ليست تسجيل دخول**.
- H040 / توثيق التسليم: [PR #3](https://github.com/body199-cmyk/1-mohamed/pull/3).
- H041 / Supabase SDK + lockfile غير المفعّلين: [PR #4](https://github.com/body199-cmyk/1-mohamed/pull/4) CI `42014035425` ناجح؛ **لا بيانات سحابية**.
- H042 / خطة إنهاء العمل المستقل قبل الخدمات: [PR #5](https://github.com/body199-cmyk/1-mohamed/pull/5)، merge SHA `e1fdec5c7dad1e9d260e1af298bd88f89c86c089`.

**الموجود بالفعل:** أربع حزم حساب/إدخال/كشوف/تصدير، معاينة نقلات وكشف مقاول في الذاكرة، وجدول النقلات وقاعدتها واختبارات PGlite. لا دفعات دائمة، لا حفظ فعلي، لا Auth حقيقي ولا نشر.

## خطوة العمل الحالية — UI-BASE-01A (جزئية)

على فرع `feat/ui-base01a-master-index-h043` و[PR #6](https://github.com/body199-cmyk/1-mohamed/pull/6) أُنشئت شاشة `/demo/master-data` للبحث في المقاولين والعربيات وعرض افتتاحي فرق الشغل، وإضافة سريعة باستخدام نفس DemoStore مع منع تكرار الاسم واللوحة. التغييرات المؤقتة تختفي عند إعادة تحميل الصفحة. أُضيفت اختبارات HTTP و**Chromium Playwright**؛ **لا تعتبر المهمة مدموجة أو مُختبرة حتى التحقق من أحدث CI ومرور المراجعة**. [تفاصيل H043](UI_BASE_01A_H043_REVIEW.md).

**ما تبقى من UI-BASE:** `UI-BASE-01B` التحرير والأرشفة وإعادة التفعيل، وإدارة حساب العربية النقدي والافتتاحي **حسب المقاول المسؤول**، مع الحفاظ على أثر العمليات التاريخية. لا تغيّر قاعدة حساب فرق الشغل.

## بعد هذه المهمة

- الدفعات `DB-04` تحتاج قراري المستخدم `D15/D16` في ترتيب الدفعات وفحص الأرصدة. ثم التقارير، الصورة/PDF/Excel، محرك النسخ والاستعادة التجريبية، وتجارب الهاتف/الأمان.
- **في النهاية** فقط: مشروع Supabase اختباري لتجربة Auth/RLS/HTTP والحفظ الحقيقي، ثم ربط Vercel للنشر التجريبي والموافقة على الإطلاق. `D07` للنسخ يحتاج حسمه عند المرحلة المعنية.
- لا كلمات مرور أو مفاتيح في الشات أو الريبو، ولا تغيير `apps/web/src/proxy.ts` قبل اختبار Supabase الحقيقي.

## الاستلام

[AGENTS](../AGENTS.md) → [ROADMAP H042](OFFLINE_FIRST_ROADMAP_H042.md) → [TASKS](TASKS.md) → [SUBTASKS](SUBTASKS.md) → [H043 REVIEW](UI_BASE_01A_H043_REVIEW.md) → [HANDOFF](HANDOFF_LOG.md#h043).
