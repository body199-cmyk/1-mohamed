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
| `apps/web/src/lib/supabase/proxy.ts` [مخطط لتحديث الجلسة الحقيقي لاحقًا؛ يختلف عن `src/proxy.ts` المؤقت] | التحقق من جلسة المستخدم وتوجيه غير المسجل لصفحة `/login` وحراسة المسارات الدائمة | AUTH-01 |

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

مراحل A وB وC (جدول النقلات وعملياتها) موجودة فعليًا في المستودع. H038 تصحيح إضافي لبيانات النقلات على فرع مراجعة غير مدموج؛ دفعات ونسخ وتقارير الإنتاج ما زالت مخططة:

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
| M02.C1 | `supabase/migrations/20261104200020_phase_c_trips.sql` | جدول النقلات والفهارس وسياسات RLS | موجود على main؛ لم يُتحقق منه من جديد في H038 |
| M02.C2 | `supabase/migrations/20261104200021_phase_c_trip_math.sql` | حساب القروش والتحقق من الدقة وقفل الحسابات | موجود على main؛ يحتاج مراجعة اختبار |
| M02.C3 | `supabase/migrations/20261104200022_phase_c_trip_operations.sql` | RPC للإنشاء/التعديل/الإلغاء/القراءة | موجود على main؛ يحتاج مراجعة اختبار |
| M02.CT | `supabase/tests/03_phase_c_trips_verification.sql` | اختبارات المرحلة C الأصلية | موجود على main؛ التنفيذ الحالي غير مثبت |
| M02.C4 | `supabase/migrations/20261104200023_phase_c_trip_details.sql` | إضافة خط السير والإيصال دون تغيير migrations قديمة؛ تحديث ٣ دوال وبيانات التدقيق | فرع H038 / PR #1، غير مدموج، ينتظر CI |
| M02.CT2 | `supabase/tests/04_phase_c_trip_details_verification.sql` | اختبارات الإدخال والتعديل والإعادة والقراءة للحقل الوصفي | فرع H038 / PR #1، اجتاز CI المعزول |
| M02.CT3 | `supabase/tests/05_phase_c_adversarial_review.sql` | مراجعة نقدية منفصلة لصلاحيات دوال RPC بعد استبدالها، ومنع إعادة الطلب بإيصال مختلف وحفظ الوصف بعد الإلغاء | فرع H038 / PR #1، ينتظر CI الجديد |
| M03 | `supabase/migrations/*_payments.sql` [مخطط] | جدول الدفعات `payments`، القيود والفهارس، وإجراء تسجيل/تعديل/إلغاء الدفعة مع فحص D13-B وقفل الحساب | DB-04-PAYMENTS |
| M04 | `supabase/migrations/*_statements.sql` [مخطط] | وظائف واستعلامات لقطة القراءة المتسقة للكشوف وتجميع الأرصدة السابقة | DB-05-STATEMENTS |
| M05 | `supabase/migrations/*_backups.sql` [مخطط] | تخزين النسخ وصلاحياتها ووظائف اللقطة والاستعادة والجدولة | T10.1–T10.4 |

يمكن أن تحتاج المرحلة أكثر من migration صغيرة؛ لا تجمع أعمالًا مستقلة في ملف ضخم لتطابق الجدول. تجهيز التدقيق ومنع إعادة الطلب يكون قبل أول عملية مالية تحتاجهما. إنشاء جدول/عملية وصلاحياتها وقيودها يتم كوحدة تغيير آمنة، لا يُؤجل تأمينها لمهمة واجهة.

لكل migration فعلية يُضاف هنا: مسارها، المهمة، الاعتماديات، وحالة التطبيق **لكل بيئة** مع دليل التحقق. لا يعني وجود الملف أنه مطبق، ولا نجاحه محليًا أنه مطبق بالإنتاج. لا تعدّل migration سبق تطبيقها بصمت؛ أضف تغييرًا جديدًا وخطة استرداد مناسبة. الفشل أو عدم معرفة الحالة يُسجل صراحة.

### ملفات BUILD-01 الفعلية الإضافية (غير مخططة)

| المسار الفعلي | الوظيفة | الحالة |
|---|---|---|
| `tools/db-verify.mjs` | يشغّل مراحل A/B/C وتصحيح H038 وجناح المراجعة النقدية، مع أدوات تحكم سلبية A/B/C | **مدموج على main عبر PR #1**؛ اختبارات ١٦ خطوة SQL ناجحة في CI `41943012378` |
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

## فحوص PR التلقائية — H038

- `.github/workflows/verify.yml`: `npm ci` ثم فحص الأنواع والوحدات وقاعدة الاختبار والتحكم السلبي والبناء، على Pull Requests.
- الاختبارات لا تثبت Supabase Auth الحقيقي أو التزامن متعدد الاتصالات؛ يلزم تحقق مستقل قبل النشر.
- `docs/DB_03_H038_REVIEW.md`: نطاق إصلاح البيانات ونتائج التحقق وموانع الاعتماد.

## H039 — AUTH-01/PREP (قيد المراجعة)

| الملف | دوره الفعلي | الحالة |
|---|---|---|
| `apps/web/src/proxy.ts` | Next.js 16 حراسة مؤقتة بنهج المنع الافتراضي لأي مسار غير public؛ GET يعاد لـlogin وPOST يُرفض؛ لا تعتمد على أي cookie أو تخمن هوية مالك | فرع `feat/auth01-safe-boundary-h039`؛ يحتاج CI |
| `apps/web/src/app/login/page.tsx` | صفحة تنبيه لا تجمع كلمات مرور ولا تدّعي نجاح تسجيل الدخول | فرع H039؛ يحتاج CI |
| `tools/auth-boundary-smoke.mjs` | اختبار HTTP ضد `next start`: ١٢ GET ممنوعًا، ٦ POST ممنوعة، والتحقق من demo/login وملفات static | فرع H039؛ يحتاج CI |
| `.github/workflows/verify.yml` | التحقق السابق + HTTP smoke test بعد البناء | تعديل H039؛ يحتاج CI |
| `docs/AUTH_01_H039_REVIEW.md` | شروط القبول وحدود الأمان والمرجع للاستكمال | موجود على فرع H039 |

لا يتم فتح أي حراسة حقيقية بمجرد ظهور متغيرات Supabase عامة. **التحقق الفعلي للهوية والمالك لاحقًا في السيرفر والـRPC**.

## H040 — الحالة المعتمدة على main بعد الدمجين

- SQL للمرحلة C + H038 metadata + جناح `05_phase_c_adversarial_review.sql` **موجودة على main** عبر PR #1 (`cf96b0c5`). الدليل CI `41943012378`، وليس مجرد وجود الملف.
- `apps/web/src/proxy.ts` **موجودة على main** عبر PR #2 (`df6f54c7`): حراسة **deny-by-default** مؤقتة لا تحتوي جلسة حقيقية، مع السماح للصفحات العامة والأصول في GET/HEAD فقط. `apps/web/src/app/login/page.tsx` معلوماتية، و`tools/auth-boundary-smoke.mjs` تحقق HTTP. الدليل CI `41944665834`.
- التوابع المخططة `apps/web/src/lib/supabase/client.ts` و`server.ts` و`proxy.ts` (cookie refresh helper) **لم تُنفذ**؛ لا تخلطها مع حارس `apps/web/src/proxy.ts` المؤقت.
- بعض الصفوف التاريخية في الخريطة تسجل حالة «مخطط» أو «ينتظر CI» وقت الكتابة؛ **هذا القسم وSTATUS أحدث مرجع للحالة ولا يلغيان التاريخ**.

## H041 — SDK الرسمي للتحضير دون التفعيل (فرع PR #4)

| المسار | الوظيفة | الحالة |
|---|---|---|
| `apps/web/package.json` و`package-lock.json` | تثبيت نسخ @supabase/ssr وsupabase-js رسميًا | الفرع H041؛ CI مطلوب |
| `apps/web/src/lib/supabase/client.ts` | عميل متصفح بمفتاح publishable فقط | غير مستورد بواجهات الـdemo |
| `apps/web/src/lib/supabase/server.ts` | عميل Route Handler يستقبل request/response ويلزم نقل cookies/headers للاستجابة | غير مستعمل؛ اختبار Supabase الحقيقي مطلوب قبل التفعيل |
| `apps/web/src/lib/supabase/owner.ts` | getClaims ثم app_is_owner؛ يرفض كل فشل | غير مستعمل؛ لا يسمح بدخول بناءً على Cookie فقط |
| `apps/web/src/lib/supabase/proxy-session.ts` | إعداد مبدئي لتجديد الجلسة بنقل Cookies والـcache headers | غير مربوط بحارس `apps/web/src/proxy.ts` القديم |
| `tools/auth-sdk-boundary-check.mjs` | فحص ثبات الإصدارات وعدم دخول SDK للتطبيق قبل اختباره | قيد CI، ليس اختبار هوية حقيقية |
| `docs/AUTH_01_H041_REVIEW.md` | حدود التنفيذ، قبول الاختبارات والقرار اللاحق | مرجع H041 |

**القاعدة:** يبقى `apps/web/src/proxy.ts` من H039 مغلقًا للجميع، ويستمر `/login` كصفحة معلومات؛ لا يثبت CI المعزول سلامة Supabase الحقيقي. [STATUS](STATUS.md) يحدد أحدث الحالة.

## H042 — تأجيل الاتصال الخارجي واستئناف التنفيذ المحلي

- [خطة الأولويات](OFFLINE_FIRST_ROADMAP_H042.md) و[STATUS](STATUS.md) هما أحدث مراجع ترتيب المراحل.
- H041 SDK + lockfile وأدوات Browser/Server/owner/session **موجودة على main** بعد [PR #4](https://github.com/body199-cmyk/1-mohamed/pull/4)، merge `8e7efc16`، CI `42014035425`. **لم يتم تفعيلها في التطبيق**، ولا تغيير في `src/proxy.ts` المغلق.
- المرحلة التالية `UI-BASE-01`: افحص أولًا `apps/web/src/demo/demo-context.tsx` ومكونات النقلات والمقاولين والحزم الصافية؛ إضافة واجهة بيانات أساسية بذاكرة مؤقتة فقط، مع اختبارات UI، دون مشروع Supabase.
- لا تتعامل مع صفوف «مخطط» القديمة هنا كدليل أن الوظيفة أصبحت موجودة أو غير موجودة؛ افحص الكود والتغييرات الفعلية قبل التنفيذ. وضع الاختبارات الوهمية ليس بديلًا عن التكامل السحابي النهائي.

## H043 — فهرس البيانات الأساسية في المعاينة

- `apps/web/src/app/demo/master-data/page.tsx`: مسار المعاينة `/demo/master-data` (**مؤقت بالذاكرة**).
- `apps/web/src/features/master-data/master-data-view.tsx` + `master-data.module.css`: البحث وقوائم المقاولين والعربيات وعرض افتتاحي فرق شغل المقاول وإضافة البيانات عبر نفس `QuickAddModal`.
- `apps/web/src/features/trips/quick-add-modal.tsx` + `trip-entry-panel.tsx`: تحقق موحد لمنع تكرار الاسم واللوحة في نقاط الإضافة، مع تطبيع الأرقام العربية/الفارسية ومسافات النص.
- `apps/web/src/components/nav-header.tsx` + CSS: رابط القائمة وتجربة الموبايل.
- `e2e/master-data.spec.ts` + `playwright.ui.config.ts`: اختبار Chromium E2E للسلوك، وليس GoTrue أو HTTP auth.
- `tools/auth-boundary-smoke.mjs`: فحص route الجديد وظهور fixture من SSR دون كشف مسارات الحفظ الحقيقي؛ `.github/workflows/verify.yml` لتشغيلهما في PR.
- [PR #6](https://github.com/body199-cmyk/1-mohamed/pull/6) هو مرجع حالة هذا التغيير حتى اعتماده؛ [STATUS](STATUS.md) آخر حالة. **فتح الصفحة لا يعني وجود تعديل/أرشفة أو تسجيل دائم.**

## H044 — UI-BASE-01B (Demo-only)
- `apps/web/src/demo/demo-{types,context,data}.ts*`: `isArchived` على المقاولين والعربيات؛ عمليات تعديل/أرشفة/إعادة تفعيل مع سبب وسجل مراجعة in-memory؛ `cashOpenings` لكل (`contractorId`, `vehicleId`) بدون مضاعفة محرك حساب.
- `apps/web/src/features/master-data/master-record-editor.tsx`: نموذج تعديل أو أرشفة/تفعيل بسبب إلزامي. `cash-openings-panel.tsx`: عرض/تسجيل افتتاحي نقد تجريبي منفصل. `master-data-validation.ts`: تطبيع الاسم واللوحة، تاريخ حقيقي، وتحويل جنيه/قروش بـ`BigInt` دون float.
- `apps/web/src/features/master-data/master-data-view.tsx`: ثلاث تبويبات وسجل مراجعة. CSS ذاتها.
- `apps/web/src/features/trips/{trip-form-fields,trip-entry-panel}.tsx`: إخفاء المؤرشف من الاختيارات الجديدة ورفض إرسال مسودة تشير إلى مؤرشف.
- `apps/web/e2e/master-data-validation.test.ts` (Vitest خاص)، و`e2e/master-data.spec.ts` (Playwright)، وخطوة CI تشغيل الاختبارات.

## H045 — REPORTS-01 (معاينة يومية لا تخزين دائم)
- `apps/web/src/features/reports/daily-work-report.ts`: فلترة وقراءة لقطة النقلات من DemoStore وتحقق من حساب الصف والتجميع **باستخدام حزمة المحاسبة**؛ إرجاع خطأ عند اختلاف snapshot؛ لا نقد ولا أرصدة.
- `apps/web/src/features/reports/daily-work-view.tsx` + `daily-work.module.css`: عرض تاريخ يوم واحد واتجاهين وجدول ونتيجة فلاتر في RTL.
- `apps/web/src/app/demo/reports/daily/page.tsx`: مسار عام تجريبي فقط؛ `components/nav-header.tsx`: رابط تنقل.
- `apps/web/e2e/daily-work-validation.test.ts`: Vitest مالي مضبوط. `e2e/daily-work.spec.ts`: Chromium regression، والموجود في `verify.yml` مع باقي اختبارات المشروع.

### H046 — T09.1
- `packages/statement-export/src/render-statement-image.ts`: تخطيط/طلاء الصورة بمتصفح Canvas من **نفس** `ContractorStatementDocument` الخاص بـHTML/CSV؛ خط Cairo محلي بعد `document.fonts.load`، وحد سعة صريح بلا إسقاط صامت.
- `packages/statement-export/tests/image-rendering.test.ts`: مطابقة قيم الملخص والحركات ورفض السعة.
- `apps/web/src/features/contractor-statements/statement-export-actions.tsx`: زر تنزيل PNG فقط (dynamic import)، بلا اتصالات أو APIs؛ `e2e/statement-image.spec.ts` متصفح Chromium يتحقق من bytes PNG الأصلية والفترة والتاريخ.

### H047 / T08.1
- `supabase/migrations/20261104200030_payments_schema.sql`: جدول payments، FK مركّب (vehicle_id, responsible_contractor_id) إلى vehicle_accounts، رابط وصفي اختياري `linked_trip_id` يحميه trigger عند الإدخال والتعديل؛ لا يخصم نقدًا ولا يغيّر الشغل. RLS مالك قراءة فقط ومنع كتابة مباشرة وTRUNCATE.
- `supabase/tests/06_payments_schema_verification.sql`: Suite مستقل للربط/المبالغ/الإلغاء/RLS بدون خداع نتيجة رفض، باستخدام مساعدات suites A/B/C؛ `tools/db-verify.mjs` يشغل migration 11 وsuite بعد C.
- D15 في `DECISIONS` و`ACCOUNTING_RULES` أصبح معتمدًا؛ D16 يظل مفتوحًا ولا توجد RPC دفعات في T08.1.

### H048 / T08.2
- `supabase/migrations/20261104200031_payment_operations.sql`: cash balance/minimum per business day D15/D16 مع حسابات رقمية دقيقة، owner-gated locked payment create/update/cancel/read RPC؛ no API route or cloud connection.
- `supabase/tests/07_payment_operations_verification.sql`: temporal, edit old instance, replays, cancellation, auth and rollback SQL cases; `tools/db-verify.mjs` includes phase D after C/schema.
- `docs/DECISIONS.md` + `ACCOUNTING_RULES.md`: تثبيت D16=أ صراحةً.

### H049 / T08.3
- `apps/web/src/features/payments/cash-ledger.ts`: محرك عرض/تحقق D15/D16 التجريبي بالقروش، فصل مسؤول النقد، كشف مخارج نقلة من `calculateTripAmounts` الأصلي، لا نسخ محرك DB.
- `apps/web/src/demo/demo-types.ts` و`demo-context.tsx`: دفعات في الذاكرة مع create/edit/cancel، أثر وتواريخ وإصدار. `PRIMARY_AHMED` معرف افتراضي داخل Demo فقط.
- `apps/web/src/features/payments/payments-view.tsx` + `payments.module.css`، مسار `/demo/payments` وشريط التنقل؛ `cash-openings-panel.tsx` يدعم افتتاحي المسؤول الأساسي.
- `apps/web/e2e/payments-validation.test.ts` Vitest مالي، `e2e/payments.spec.ts` Chromium إجرائي؛ workflow يضيف الاختبارين. `auth-boundary-smoke.mjs` يؤكد المسار التجريبي فقط، بينما مسار `/payments` الحقيقي يظل محميًا.

### H050 / REPORTS Vehicle Cash
- apps/web/src/features/reports/vehicle-cash-report.ts: إسقاط الفترة والسابق والمدفوع والمستحق والختامي من buildCashLedger، لا نسخ حساب آخر.
- apps/web/src/features/reports/vehicle-cash-view.tsx وapp/demo/reports/vehicle-cash/page.tsx: شاشة واحدة تتنقل فيها بين العربيات والمقاولين المسؤولين والتواريخ، وتعرض الترتيب وخط السير والاتجاه.
- apps/web/src/features/payments/cash-ledger.ts: استبعاد دفعة مستقبلية بالنسبة إلى نهاية التقرير التاريخي بدلاً من رفضه.
- apps/web/e2e/vehicle-cash-report-validation.test.ts: 6 اختبارات مال؛ e2e/vehicle-cash.spec.ts: 3 متصفح. GitHub CI وHTTP guard يختبرانها.

### H051 / T08.6 Dashboard
- apps/web/src/features/reports/dashboard-summary.ts: مؤشرات عمل اليوم عبر buildDailyWorkReport، ومؤشر دفعات اليوم المستقل بالنقود النصية BigInt.
- apps/web/src/features/reports/dashboard-view.tsx + dashboard.module.css وapp/demo/dashboard/page.tsx: لوحة الرئيسية والتوجيه من app/page.tsx، روابط لبقية الشاشات وعرض نشاط حديث.
- apps/web/e2e/dashboard-validation.test.ts: 6 unit؛ e2e/dashboard.spec.ts: 2 Chromium E2E. tools/auth-boundary-smoke.mjs يثبت قبول المعاينة وتحويل الجذر.
