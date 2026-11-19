# تقرير LOCAL-ENV-01 — تجهيز البيئة المحلية والتحقق من التشغيل

- **التاريخ:** ١٠ نوفمبر ٢٠٢٦
- **الفرع:** `codex/local-env-01` (داخل worktree منفصل: `Y:\برمجه\محمد اخي-local-env-01`)
- **الأساس المختبر (`origin/main` و`HEAD`):** `1e1dae637d9bb1c29e74b31b2180e7ddda2769b5`
- **النطاق:** تجهيز وفحص البيئة المحلية وتشغيل أحدث `main` دون تعديل كود التطبيق أو الاختبارات أو القاعدة أو دمج فروع.

---

## ١. حالة المستودع وإصدارات الأدوات والموارد

- المجلد الرئيسي `Y:\برمجه\محمد اخي` نظيف على `main` عند `1e1dae637d9bb1c29e74b31b2180e7ddda2769b5` ولم يُعدل؛ نُفذ الفحص داخل worktree منفصل `Y:\برمجه\محمد اخي-local-env-01` على فرع `codex/local-env-01`.
- **Node.js:** `v22.23.2`
- **npm:** `12.0.2`
  *(ملاحظة بيئة Windows PowerShell: `ExecutionPolicy` يرفض تشغيل `npm.ps1` مباشرة؛ يعمل بنجاح عبر `cmd /c` أو `npm.cmd` دون تغيير سياسات النظام).*
- **Git:** `2.54.0.windows.1` (الربط `origin` عبر SSH: `git@github.com:body199-cmyk/1-mohamed.git`؛ المصادقة بحساب `body199-cmyk` ناجحة).
- **أداة GitHub CLI (`gh`):** غير مثبتة على الجهاز، ولا توجد متغيرات `GITHUB_TOKEN` أو `GH_TOKEN`.
- **Playwright / المتصفح:** `@playwright/test` إصدار `1.64.1`؛ متصفح Chromium المنزّل لـ Playwright غير موجود محليًا (`%LOCALAPPDATA%\ms-playwright` غير موجود)، بينما Microsoft Edge مثبت بإصدار `156.0.4314.58` ومفعّل في `playwright.config.ts` (`channel: "msedge"`).
- **مساحة القرص (`Y:\`):** `493,193 MB` متاحة.
- **المنافذ:** المنفذ `3000` كان خاليًا قبل التشغيل (فحص `netstat -ano`؛ لم تُوقف أي عملية تخص المستخدم)، وبعد بدء المعاينة استمع عليه خادم `next start` المحلي.

---

## ٢. أوامر الفحص ونتائجها الفعلية

| الأمر | البيئة / المسار | النتيجة الفعلية |
|---|---|---|
| `cmd /c "npm ci"` | جذر worktree | **نجاح** (`exit 0`): `added 83 packages, and audited 89 packages in 1m`، `found 0 vulnerabilities`. |
| `cmd /c "npm run check"` | جذر worktree | **نجاح** (`exit 0`): `typecheck` على 5 workspaces بلا أخطاء، ونجاح **195/195** اختبار وحدة (20 ملفًا): `@ledger/accounting` (73/73)، `@ledger/contractor-statements` (64/64)، `@ledger/statement-export` (40/40)، `@ledger/trip-entry` (18/18). |
| `cmd /c "npm run build"` | جذر worktree | **نجاح** (`exit 0`): `next build --webpack` (Next.js 16.4.5)؛ compile `10.3s`، TypeScript `5.1s`، توليد 13 صفحة ثابتة + 11 مسارًا مع `Proxy (Middleware)`. |
| `cmd /c "npm run db:verify"` | جذر worktree (PGlite بالذاكرة) | **نجاح** (`exit 0`): اجتياز كل الـ 20 خطوة (A + B + C + H038 + T08.1 + T08.2) على PostgreSQL 18.6 (PGlite 0.5.15)؛ ثم نجاح `db:verify:negative` و`db:verify:negative-b` و`db:verify:negative-c`. |
| `node tools/auth-sdk-boundary-check.mjs` | جذر worktree | **نجاح** (`exit 0`): `AUTH-01/H041 PASS`. |
| `node --test tools/backup-core.test.mjs` | جذر worktree | **نجاح** (`exit 0`): 12/12 اختبارًا. |
| `npx vitest run apps/web/e2e/...` (من الجذر) | جذر worktree | **فشل** (`exit 1`): `TypeError: Cannot read properties of undefined (reading 'config')` على Vitest 5.1.0؛ وعند تشغيل نفس الـ 5 ملفات من داخل `apps/web` **نجحت 5/5 ملفات (26/26 اختبارًا)**. |
| `node tools/auth-boundary-smoke.mjs http://127.0.0.1:3000` | ضد الخادم المحلي | **فشل** (`exit 1`) عند السطر 40: يتوقع إعادة توجيه `/` إلى `/demo/dashboard` بينما التطبيق على `1e1dae6` يوجه `/` إلى `/demo/home`. |
| `npx playwright test demo-flow.spec.ts payments.spec.ts vehicle-cash.spec.ts review-regressions.spec.ts dashboard.spec.ts` | ضد `http://localhost:3000` | **13 نجح / 10 فشل** (انظر القسم ٤: فشل الاختبارات القديمة بسبب تغييرات واجهة `1e1dae6`). أُعيدت ملفات اللقطات المتغيرة عبر `git checkout -- apps/web/e2e/screenshots/` للحفاظ على نظافة الفرع. |

---

## ٣. الفحص التفاعلي في المتصفح والتصدير (`http://localhost:3000`)

أُجري فحص تفاعلي ببيانات تجريبية فقط عبر Microsoft Edge (`headless`) في جلسة متصلة تحفظ ذاكرة `DemoStore` بين الشاشات:

1. **الرئيسية والتنقل:**
   - طلب `/` يحول إلى `/demo/home` (8 بلاطات اختصارات، عنوان «أهلًا بك في إدارة الشغل»).
   - تم التنقل بنجاح عبر شريط «التنقل الرئيسي» إلى المسارات التسعة: `/demo/trips`، `/demo/payments`، `/demo/contractors`، `/demo/reports/vehicle-cash`، `/demo/reports/daily`، `/demo/master-data`، `/demo/dashboard`، `/demo/settings`، `/demo/home`.
   - تم التحقق من تبديل المظهر (فاتح/داكن) في `/demo/settings`، وتمرير التبويبات الثلاثة في `/demo/master-data` (`المقاولون (3)`، `العربيات (3)`، `افتتاحيات نقد العربيات`)، وعرض الهاتف `390px` على `/demo/home` بدون تجاوز أفقي (`scrollWidth=390`, `innerWidth=390`).
2. **تسجيل نقلة تجريبية (`/demo/trips`):**
   - سُجلت نقلة بتاريخ `2026-11-10` للمقاول `K1` باتجاه `AHMED_SUPPLIES` على العربية `V1` (وزن `10` طن، سعر مقاول `150`، سعر عربية `120`، مصاريف `50`، خط سير `محجر تجريبي ← موقع تجريبي`).
   - طابقت بطاقة المعاينة المباشرة الحساب بالقرش (`1550.00 ج.م` للمقاول، `1250.00 ج.م` للعربية)، وظهرت رسالة النجاح (`TRIP-DEMO-1-7063`).
3. **كشف المقاول (`/demo/contractors`):**
   - بعد اختيار `K1` حتى `2026-11-10`، ظهرت النقلة فورًا في جدول الحركات وارتفع صافي المستحق في البطاقة الزرقاء إلى `1850.00 ج.م` لصالح أحمد أبو علي.
4. **الدفعات وتقرير نقد العربية (`/demo/payments` و`/demo/reports/vehicle-cash`):**
   - على حساب `V1` عند «أحمد أبو علي (الأساسي)» (رصيده بعد النقلة الجديدة `1530.00 ج.م`)، تم تسجيل دفعة `100` جنيه بتاريخ `2026-11-10` فأصبح المتبقي `1430.00 ج.م`.
   - وفي تجربة منفصلة لدورة الدفعة (بدءًا من `280.00 ج.م`): إنشاء `100` (`180.00`) ← تعديل إلى `150` (`130.00`) ← إلغاء مع سبب (`280.00` مع بقاء سطر «ملغاة»).
   - انعكست النقلة والدفعة في `/demo/reports/vehicle-cash` (`مستحق شغل العربية 1530.00 ج.م`، `الدفعات 100.00 ج.م`، `المتبقي 1430.00 ج.م`، النقلات: `2`، الدفعات السارية: `1`)، وكذلك في `/demo/reports/daily` (`1550.00` و`1250.00`) و`/demo/dashboard` (`1550.00` و`100.00`).
5. **التصدير الفعلي:**
   - من `/demo/contractors`: تم تنزيل الملفات التالية والتحقق من حجمها وترويستها الفعلية:
     - CSV: `demo-statement-2026-11-01-2026-11-10.csv` (`1390` بايت، يتضمن `1850.00 ج.م` ورقم `TRIP-DEMO-1-7063`).
     - Excel XLSX: `demo-statement-2026-11-01-2026-11-10.xlsx` (`11368` بايت، ترويسة `PK` ZIP صالحة).
     - PNG: `demo-statement-2026-11-01-2026-11-10.png` (`169302` بايت، توقيع `89504e470d0a1a0a`).
     - PDF مباشر: `demo-statement-2026-11-01-2026-11-10.pdf` (`169543` بايت، ترويسة `%PDF-1.4`).
   - من `/demo/reports/vehicle-cash`: تم تنزيل `vehicle-cash-2026-11-01-2026-11-30.csv` (`1242` بايت، يتضمن `1430.00 ج.م`).
6. **أخطاء المتصفح والخادم والحراسة:**
   - سجّل الفحص التفاعلي **0** `console.error`، و**0** `pageerror`، و**0** استجابات HTTP >= 400، ولم تظهر أخطاء في مخرجات خادم `next start`.
   - طلب المسار المحمي `/trips` أعاد توجيه المتصفح إلى `/login?next=%2Ftrips` كما هو مصمم في `apps/web/src/proxy.ts`.

---

## ٤. العيوب المكتشفة والعوائق وما لم يُختبر

### عيوب وملاحظات موثقة في الكود الحالي على `main` (دون إصلاح في هذه المهمة)

1. **عيب في معاينة الرصيد قبل/بعد الدفعة (`apps/web/src/features/payments/payments-view.tsx:59`):**
   - **خطوات إعادة الإنتاج:** افتح `/demo/payments` واكتب مبلغًا رقميًا صحيحًا مثل `100` في حقل «المبلغ بالجنيه».
   - **السلوك المتوقع:** ظهور قسم `الرصيد بعد الدفعة` (`draftPreview`) لعرض المتبقي قبل الدفعة وبعدها.
   - **السلوك الفعلي:** لا يظهر قسم `الرصيد بعد الدفعة` مطلقًا (`visible=false`) رغم قبول المبلغ عند الحفظ.
   - **السبب والملف المرجح:** استخدام شرطة مائلة عكسية مزدوجة داخل حرفي RegExp في `apps/web/src/features/payments/payments-view.tsx` سطر 59: `!/^\\d+(?:\\.\\d{1,2})?$/`، فيطابق حرف `\` متبوعًا بـ `d` بدل الأرقام.

2. **تعليق زر «مشاركة صورة الكشف مباشرة» في Edge headless (`apps/web/src/features/contractor-statements/statement-export-actions.tsx:27-28`، ومثيله في `apps/web/src/features/reports/report-export-actions.tsx:39-40`):**
   - **خطوات إعادة الإنتاج:** على `/demo/contractors` في Edge headless على Windows، اضغط «مشاركة صورة الكشف مباشرة».
   - **السلوك المتوقع:** فتح قائمة المشاركة أو ظهور رسالة بديلة عند عدم التوفر دون قفل الأزرار.
   - **السلوك الفعلي:** لأن `typeof navigator.share === "function"` و`navigator.canShare({ files }) === true` في هذه البيئة، يدخل الكود في `await navigator.share(...)` ولا يكتمل أو يرفض في headless (مهلة > 30 ثانية)، ما يبقي `lock.current = true` و`busy = true` ويعطل أزرار التصدير حتى إعادة تحميل الصفحة.

3. **عدم تحديث الاختبارات القديمة لتغييرات `1e1dae6` على `main`:**
   - `tools/auth-boundary-smoke.mjs:40` ما زال يتوقع توجيه `/` إلى `/demo/dashboard` بينما `/` يوجه إلى `/demo/home`.
   - فشلت 10 حالات من عينة `playwright test` (من أصل 23) لنفس السبب: تغير وجهة `/`، إخفاء زر المظهر أسفل `767px` في `nav-header.module.css:172` (مع نقله إلى `/demo/settings`)، إزالة حقول `رقم إيصال الدفعة` والربط من `payments-view.tsx`، وإخفاء حقل `من تاريخ` في `/demo/contractors` عندما يكون `نطاق كشف الحساب` على «من بداية حساب المقاول».

### العوائق وما لم يُختبر

- **المصادقة الحقيقية وSupabase الخارجي:** لم تُضف أسرار أو متغيرات بيئة، ولم يُجرَ أي اتصال بقاعدة Supabase خارجية أو اختبار GoTrue/PostgREST؛ لا يزال التطبيق يعمل في وضع المعاينة بالذاكرة (`DemoStore`) مع حراسة `proxy.ts` المغلقة افتراضيًا.
- **ما لم يُختبر:**
  - التشغيل الفعلي على هواتف Android/iOS ومشاركة Web Share API الحقيقية عبر واتساب/تطبيقات الجهاز.
  - نافذة `طباعة / حفظ PDF` (`window.print()`) التفاعلية للمستخدم.
  - جناح `playwright.ui.config.ts` الكامل عبر `chromium` (لعدم تثبيت `chromium` الخاص بـ Playwright محليًا؛ واجهات التصدير الحرجة جُربت على Edge).
  - فتح الـ PR برمجيًا عبر `gh` غير متاح لعدم وجود `gh` CLI أو `GITHUB_TOKEN` في البيئة (رُفع الفرع عبر SSH لتجهيز الـ PR مباشرة).

---

## ٥. رابط التشغيل المحلي والتوصية

- **رابط التشغيل المحلي:** `http://localhost:3000` (على `http://localhost:3000/demo/home`، من worktree `Y:\برمجه\محمد اخي-local-env-01`).
- **حالة الخادم:** تُركت عملية الخادم الخلفية (`next start`) تعمل على المنفذ `3000` وقت تسليم المهمة (ويمكن تشغيلها في أي وقت عبر `cmd /c "npm run start"` أو `npm.cmd run start`).
- **التوصية:**
  - **جاهز للمعاينة المحلية والتجربة اليدوية** (التثبيت، البناء، الفحوص الأساسية، قاعدة PGlite المحلية، كل الشاشات التسعة، والتصدير بالصيغ الأربع تعمل بدون أخطاء متصفح أو خادم، مع استدعاء `npm` عبر `npm.cmd` أو `cmd /c`).
  - **غير جاهز للدمج/الاعتماد الكامل دون معالجة محددة:** يلزم في مهام إصلاح لاحقة معالجة: (١) تعبير Regex المكسور في `payments-view.tsx:59`، (٢) تحديث `tools/auth-boundary-smoke.mjs` واختبارات E2E القديمة لتطابق واجهة `1e1dae6` المعتمدة، (٣) مراجعة معالجة `navigator.share` عند عدم استجابة نظام المشاركة.
