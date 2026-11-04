# خريطة الوصول السريع

## الملفات الموجودة فعلًا — الحزم المستقلة والتطبيق التجريبي

### إضافات مراجعة H034 الفعلية

- التصدير: `packages/statement-export/src/`؛ العقد `document-types.ts`، المصيّران `render-statement-html.ts` و`render-statement-csv.ts`، وهروب النص وCSS الطباعة.
- اختبار الحزمة: `packages/statement-export/tests/html-rendering.test.ts` و`csv-rendering.test.ts` (١٢ اختبارًا).
- الربط: `apps/web/src/features/contractor-statements/statement-document.ts` يحول نتيجة الكشف، و`statement-export-actions.tsx` يدير التنزيل والطباعة.
- حماية المسودة: `apps/web/src/demo/entry-session-context.tsx`. تركيز النوافذ: `apps/web/src/components/use-modal-focus.ts`.
- Cairo المحلي وترخيصه: `apps/web/public/fonts/`. اختبارات مراجعة التكامل: `e2e/review-regressions.spec.ts`.
- الإصدارات ونتائج التحقق الحالية: [APP_01_REVIEW](APP_01_REVIEW.md). مسارات `src/` في جدول التطبيق أدناه نسبية إلى `apps/web/`.

يحتوي المستودع حاليًا على أربع حزم مستقلة مستقلة وتطبيق ويب لمعاينة تفاعلية تجريبية بذاكرة الجلسة (`apps/web`). تم اعتماد Next.js App Router في D08 لمهمة APP-01، بينما قاعدة البيانات وخدمات السحابة والمصادقة الدائمة لم تُنشأ بعد.

### ١. حزمة الحسابات المستقلة (`packages/accounting/`)

| الوحدة الموجودة | نقطة الدخول والمصدر | ملف الاختبار الفعلي | عدد الاختبارات | المهمة المنفذة |
|---|---|---|---|---|
| حساب مبالغ النقلة | `packages/accounting/src/trip-amounts.ts` (`calculateTripAmounts`) | `packages/accounting/tests/trip-amounts.test.ts` | ٣٦ حالة | PACKAGE-01-VERIFY |
| تجميع النقلات | `packages/accounting/src/trip-summary.ts` (`summarizeTrips`) | `packages/accounting/tests/trip-summary.test.ts` | ١٢ حالة | PACKAGE-01-VERIFY |
| تنسيق مبالغ الجنيه | `packages/accounting/src/format-egp.ts` (`formatEgpFromPiastres`) | `packages/accounting/tests/format-egp.test.ts` | ٢٥ حالة | PACKAGE-01-VERIFY |
| إعداد وتوثيق الحزمة | `packages/accounting/package.json` + `tsconfig.json` + `README.md` | فحص الأنواع والاختبارات (`npm run check`) | ٧٣ حالة ناجحة و٠ ثغرات | TOOLS-02 |

### ٢. حزمة محرك تسجيل النقلات والبيانات المشتركة (`packages/trip-entry/`)

| الوحدة الموجودة | نقطة الدخول والمصدر | ملف الاختبار الفعلي | عدد الاختبارات | المهمة المنفذة |
|---|---|---|---|---|
| أنواع وعقود الحالة | `packages/trip-entry/src/entry-types.ts` | فحص الأنواع الصارم (`npm run typecheck`) | ٠ أخطاء | ENTRY-01-INTEGRATE |
| محرك الحالة والانتقال | `packages/trip-entry/src/entry-state.ts` (`createEntryState`, `reduceEntry`) | `packages/trip-entry/tests/initial-and-editing.test.ts` | ١٣ حالة | ENTRY-01-INTEGRATE |
| ربط السعرين وفكهما | `packages/trip-entry/src/entry-state.ts` | `packages/trip-entry/tests/rate-linking.test.ts` | حالتان | ENTRY-01-INTEGRATE |
| المشترك وبدء النقلة والجلسة | `packages/trip-entry/src/entry-state.ts` | `packages/trip-entry/tests/shared-and-session.test.ts` | ٣ حالات | ENTRY-01-INTEGRATE |
| مساعد الاختبار والإعدادات | `packages/trip-entry/tests/helpers.ts` + `package.json` + `tsconfig.json` + `README.md` | فحص الأنواع والاختبارات (`npm run check`) | ١٨ حالة ناجحة و٠ ثغرات | TOOLS-02 |

### ٣. حزمة محرك كشف شغل المقاول (`packages/contractor-statements/`)

| الوحدة الموجودة | نقطة الدخول والمصدر | ملف الاختبار الفعلي | عدد الاختبارات | المهمة المنفذة |
|---|---|---|---|---|
| أنواع وعقود الكشف | `packages/contractor-statements/src/statement-types.ts` | فحص الأنواع الصارم (`npm run typecheck`) | ٠ أخطاء | REPORT-01-INTEGRATE |
| التحقق من المدخلات والأخطاء | `packages/contractor-statements/src/statement-validation.ts` (`validateStatementInput`) | `tests/validation-dates.test.ts`<br>`tests/validation-amounts.test.ts`<br>`tests/validation-accounts-and-ids.test.ts`<br>`tests/validation-error-priority.test.ts` | ٥٥ حالة مجزأة بـ it.each | REPORT-01-INTEGRATE |
| محرك بناء الكشف والأرصدة | `packages/contractor-statements/src/contractor-statement.ts` (`buildContractorStatement`) | `tests/statement-calculation.test.ts`<br>`tests/statement-periods-and-ordering.test.ts` | ٩ حالات (سيناريو القبول والأرصدة والفرز) | REPORT-01-INTEGRATE |
| نقطة التصدير والإعدادات | `packages/contractor-statements/src/index.ts` + `package.json` + `tsconfig.json` + `README.md` | فحص الأنواع والاختبارات المزدوج (`npm run check`) | ٦٤ حالة ناجحة و٠ ثغرات | REPORT-01-INTEGRATE |

### ٤. تطبيق الويب التجريبي (`apps/web/`) — مهمة APP-01

| الوحدة والمسار | المكونات الرئيسية | المسؤولية ونقاط الربط |
|---|---|---|
| إعدادات التطبيق والمستودع | `apps/web/package.json`<br>`apps/web/next.config.mjs`<br>`apps/web/tsconfig.json`<br>`playwright.config.ts` | Next.js 16 App Router، تفعيل transpilePackages للحزم الأربع، إعداد Playwright بقناة msedge. |
| السمات والتصميم والافتراضات | `src/styles/variables.css`<br>`src/styles/globals.css`<br>`src/components/theme-provider.tsx` | خط Cairo، متغيرات الألوان الفاتحة والداكنة، حراسة التبديل وحفظ التفضيل محليًا. |
| المكونات العامة والهيكل | `src/components/demo-banner.tsx`<br>`src/components/nav-header.tsx`<br>`src/app/layout.tsx`<br>`src/app/page.tsx` | شريط تحذير النسخة المؤقتة، التنقل بين شاشتي المعاينة، إعادة التوجيه التلقائي إلى `/demo/trips`. |
| ذاكرة الجلسة التفاعلية | `src/demo/demo-types.ts`<br>`src/demo/demo-data.ts`<br>`src/demo/demo-context.tsx` | سياق React In-Memory مؤقت للنقلات والمقاولين والسيارات، ربط محرك كشف الحساب مباشرة دون قاعدة بيانات أو localStorage. |
| واجهة تسجيل النقلات | `src/features/trips/trip-entry-panel.tsx`<br>`src/features/trips/trip-preview-card.tsx`<br>`src/features/trips/shared-data-panel.tsx`<br>`src/features/trips/arabic-number-normalizer.ts`<br>`src/features/trips/quick-add-modal.tsx`<br>`src/features/trips/replace-confirm-modal.tsx`<br>`src/features/trips/new-session-modal.tsx`<br>`src/app/demo/trips/page.tsx` | تسجيل مباشر، ربط وفك السعرين، معاينة مالية فورية بالقرش، تطبيع الأرقام العربية، حماية المسودة وإضافة سيارة/مقاول سريعة. |
| واجهة كشف حساب المقاول | `src/features/contractor-statements/contractor-statements-view.tsx`<br>`src/features/contractor-statements/statement-summary-card.tsx`<br>`src/features/contractor-statements/statement-table.tsx`<br>`src/app/demo/contractors/page.tsx` | كشف حساب فترات، بطاقة ملخص أولًا بشارات نصية للمستفيد، جدول تفصيلي، وانعكاس فوري للنقلات المضافة بالجلسة. |
| اختبارات المتصفح E2E | `e2e/demo-flow.spec.ts`<br>`apps/web/e2e/screenshots/` | ١١ سيناريو معتمد تغطي الوظائف والتجاوب والوضع الفاتح والداكن ولقطات شاشة عند (390px, 768px, 1440px). |

---

## خريطة الوحدات المقترحة للتطبيق الكامل — مخطط فقط

**لا توجد ملفات تطبيق كامل الآن. كل المسارات أدناه مخططة وغير موجودة.** تم تحديد الهيكل التفصيلي في DB-01-PREP. لا تنشئها لمجرد ورودها هنا.

### ١. مكتبات اتصال Supabase والأمان (مخطط)
| المسار المخطط | الوظيفة والمسؤولية | المهمة |
|---|---|---|
| `apps/web/src/lib/supabase/client.ts` [مخطط] | تهيئة عميل المتصفح الرسمي باستخدام المفتاح المجهول `NEXT_PUBLIC_SUPABASE_ANON_KEY` | AUTH-01 |
| `apps/web/src/lib/supabase/server.ts` [مخطط] | تهيئة عميل الخادم لـ Server Actions والمسارات مع إدارة الكوكيز الآمنة | AUTH-01 |
| `apps/web/src/lib/supabase/middleware.ts` [مخطط] | التحقق من جلسة المستخدم وتوجيه غير المسجل لصفحة `/login` وحراسة المسارات الدائمة | AUTH-01 |

### ٢. طبقة الوصول للبيانات والعمليات (Data Access Layer - مخطط)
| الميزة | الواجهة/التنسيق المقترح | الحساب/العقد المستدعى | البيانات/التحقق المقترح | اختبارها المقترح | المهمة |
|---|---|---|---|---|---|
| الدخول والمصادقة | `src/features/auth/` [مخطط] | Supabase Auth API | `src/data/auth/` [مخطط] | `tests/auth/` [مخطط] | AUTH-01 |
| المقاولون | `src/features/contractors/` [مخطط] | هوية الطرف والأرشفة D03 | `src/data/contractors/` [مخطط] | `tests/contractors/` [مخطط] | DB-02 / T06 |
| العربيات | `src/features/vehicles/` [مخطط] | هوية العربية والسائق | `src/data/vehicles/` [مخطط] | `tests/vehicles/` [مخطط] | DB-02 / T06 |
| الأرصدة الافتتاحية | داخل إعدادات الحسابات | D04 الافتتاحي والتحويل | `src/data/opening-balances/` [مخطط] | `tests/opening-balances/` [مخطط] | DB-02 / T06 |
| النقلات الدائمة | `src/features/trips/` (ترقية) | `@ledger/accounting` + `@ledger/trip-entry` | `src/data/trips/` [مخطط] + معاملات القاعدة الذرية | `tests/trips/` [مخطط] | DB-03 / T07 |
| الدفعات النقدية | `src/features/payments/` [مخطط] | فحص D13-B وعزل فرق الشغل | `src/data/payments/` [مخطط] + قفل الحساب | `tests/payments/` [مخطط] | DB-04 / T08 |
| الكشوف والرئيسية | `src/features/reports/` (ترقية) | `@ledger/contractor-statements` | `src/data/reports/` [مخطط] + لقطة قراءة متسقة | `tests/reports/` [مخطط] | DB-05 / T08 |
| التصدير | `src/features/contractor-statements/statement-export-actions.tsx` (ترقية) | `@ledger/statement-export` | نفس كائن التقرير المستخرج دون إعادة حساب | `packages/statement-export/tests/` | T09 |
| النسخ الاحتياطي | `src/features/backups/` [مخطط] | نطاق وإصدار النسخة D07 | وظائف خادم محمية / RPCs | `tests/recovery/` [مخطط] | T10 |
| الإعدادات العامة | `src/features/settings/` [مخطط] | إعدادات العرض فقط | `src/data/settings/` [مخطط] | `tests/settings/` [مخطط] | T05/T11 |

### ٣. تغييرات القاعدة المنفذة والمخططة (Database Migrations)

ملفات المرحلة الأولى M01 منشأة فعليًا وموجودة في المستودع ضمن مهمة `DB-02-SCHEMA`، بينما المراحل التالية مخططة:

| المرحلة | الملف الفعلي أو المخطط | نطاق التغيير والمسؤولية | الحالة والمهمة |
|---|---|---|---|
| M01.1 | `supabase/migrations/20261104200000_auth_owner_and_security.sql` | جدول `app_owner`، دالة `app_get_owner_id()`، دالة `app_is_owner()`، ودالة التهيئة المحمية `app_set_initial_owner()` | منشأة وموجودة (DB-02-SCHEMA) |
| M01.2 | `supabase/migrations/20261104200001_core_entities_and_accounts.sql` | جداول `contractors`, `vehicles`, `vehicle_accounts`, `opening_balances`, `business_settings` مع القيود والعلاقات المركبة وسياسات RLS | منشأة وموجودة (DB-02-SCHEMA) |
| M01.3 | `supabase/migrations/20261104200002_audit_and_idempotency.sql` | جدول التدقيق `audit_log` وجدول `idempotency_keys` الدائم وسياسات منع التلاعب | منشأة وموجودة (DB-02-SCHEMA) |
| M01.T | `supabase/tests/01_db_02_schema_verification.sql` | جناح اختبارات التحقق الشامل للصلاحيات والقيود وعلاقات الحساب وأدوار anon/non-owner/owner — **أُعيدت كتابتها في BUILD-01/A**؛ النسخة الأصلية في `supabase/tests/archive/` | موجودة ومتحقق منها محليًا (BUILD-01/A) |
| M01.4 | `supabase/migrations/20261104200003_db02_review_fixes.sql` | طبقة تصحيحات مراجعة DB-02: سحب TRUNCATE، حماية المقاول الأساسي والتدقيق ومفاتيح منع التكرار، تثبيت بوابة المالك | موجودة ومتحقق منها محليًا (BUILD-01/A) |
| M01.H | `supabase/tests/00_isolated_harness.sql` | بيئة PostgreSQL معزولة تحاكي أدوار Supabase و`auth.users` و`auth.uid()` للاختبار فقط | موجودة ومتحقق منها محليًا (BUILD-01/A) |
| M02.0 | `supabase/migrations/20261104200010_phase_b_foundation.sql` | أرقام إصدارات، بوابة المالك، بصمة الطلب ومنع التكرار، التدقيق، التحقق الصارم من الأعداد، تأمين حساب العربية | موجودة ومتحقق منها محليًا (BUILD-01/B) |
| M02.1 | `supabase/migrations/20261104200011_phase_b_operations.sql` | ٨ عمليات كتابة محمية: مقاول/عربية (إضافة، تعديل، أرشفة، إعادة تفعيل)، حساب العربية، الافتتاحية الأولية | موجودة ومتحقق منها محليًا (BUILD-01/B) |
| M02.T | `supabase/tests/02_phase_b_operations_verification.sql` | ٦٩ عبارة اختبار: صلاحيات، مدخلات، علاقات، إعادة الطلب، تعارض الإصدار، التراجع عند فشل التدقيق | موجودة ومتحقق منها محليًا (BUILD-01/B) |
| M02 | `supabase/migrations/*_trips.sql` [مخطط] | جدول النقلات `trips`، القيود والفهارس، وإجراء إضافة/تعديل/إلغاء النقلة الذري مع التحقق المحاسبي | DB-03-TRIPS |
| M03 | `supabase/migrations/*_payments.sql` [مخطط] | جدول الدفعات `payments`، القيود والفهارس، وإجراء تسجيل/تعديل/إلغاء الدفعة مع فحص D13-B وقفل الحساب | DB-04-PAYMENTS |
| M04 | `supabase/migrations/*_statements.sql` [مخطط] | وظائف واستعلامات لقطة القراءة المتسقة للكشوف وتجميع الأرصدة السابقة | DB-05-STATEMENTS |
| M05 | `supabase/migrations/*_backups.sql` [مخطط] | تخزين النسخ وصلاحياتها ووظائف اللقطة والاستعادة والجدولة | T10.1–T10.4 |

يمكن أن تحتاج المرحلة أكثر من migration صغيرة؛ لا تجمع أعمالًا مستقلة في ملف ضخم لتطابق الجدول. تجهيز التدقيق ومنع إعادة الطلب يكون قبل أول عملية مالية تحتاجهما. إنشاء جدول/عملية وصلاحياتها وقيودها يتم كوحدة تغيير آمنة، لا يُؤجل تأمينها لمهمة واجهة.

لكل migration فعلية يُضاف هنا: مسارها، المهمة، الاعتماديات، وحالة التطبيق **لكل بيئة** مع دليل التحقق. لا يعني وجود الملف أنه مطبق، ولا نجاحه محليًا أنه مطبق بالإنتاج. لا تعدّل migration سبق تطبيقها بصمت؛ أضف تغييرًا جديدًا وخطة استرداد مناسبة. الفشل أو عدم معرفة الحالة يُسجل صراحة.

### ملفات BUILD-01 الفعلية الإضافية (غير مخططة)

| المسار الفعلي | الوظيفة | الحالة |
|---|---|---|
| `tools/db-verify.mjs` | يشغّل harness ← migrations ١–٦ ← جناحَي الاختبارات على PostgreSQL معزول، مع طرازَي تحكم سلبي | موجود ومتحقق منه محليًا |
| `.env.example` | أسماء متغيرات Supabase بقيم فارغة فقط، بلا أسرار | موجود |
| `apps/web/src/lib/supabase/config.ts` | حالة «إعداد غير مكتمل»، منع إعادة التوجيه الخارجي، رابط الرجوع — بلا اعتماد خارجي | موجود، `build` ناجح بغياب الإعدادات |
| `docs/SUPABASE_AUTH_SETUP.md` | المرجع الرسمي المتحقق منه، العائق، وخطوات الإعداد غير المنفذة | مكتوبة ولم تُختبر |
| `docs/BUILD_01_REPORT.md` | التقرير التفصيلي الوحيد للحزمة | موجود |

> **تنبيه معماري مُتحقق منه رسميًا (٢٢ أكتوبر ٢٠٢٦):** مع Next.js 16 ملف تحديث الجلسة اسمه `proxy.ts` لا `middleware.ts`، والتحقق من الهوية على الخادم يكون بـ `getClaims()` لا `getSession()`. جدول «مكتبات اتصال Supabase» أعلاه ما زال **[مخطط]** ويجب تحديثه عند تنفيذ AUTH-01: `client.ts` و`server.ts` و`proxy.ts`. لا حزم `@supabase/*` مثبتة حاليًا.

## دليل البحث حسب العارض

- رقم كشف غير صحيح: قواعد الحساب → قارئ التقرير → عملية التجميع → الاختبار؛ لا تبدأ بتعديل تنسيق الشاشة.
- مبلغ محفوظ مرتين: عقد هوية الطلب → عملية الحفظ → القيد/المعاملة → اختبار إعادة المحاولة.
- فرق بين PDF والشاشة: نتيجة التقرير والفلاتر → عارض التصدير؛ لا تضف معادلة جديدة.
- خلل استعادة: نطاق النسخة وإصدارها → التحقق → المعاملة → اختبار الفشل الجزئي.

بعد كل إنشاء أو نقل ملف، أضف مساره الفعلي ونقطة دخوله واختباره في الصف المعني، وغيّر حالته إلى موجود. افصل الملفات المخططة عن الموجودة. لا تدرج مكتبات مولّدة أو كل مكون صغير إن لم يساعد الوصول.
