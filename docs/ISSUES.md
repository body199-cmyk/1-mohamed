# الأخطاء والإصلاحات

## H057 — UX/A11Y-057 / بطاقة اتجاه النقلة
- **دليل من الكود الحالي:** trip-form-fields.tsx كان يقدم حاويتين div من نوع directionOption مع onClick وبداخلها radio، فتفعيل البطاقة نفسها لا يحمل دلالة HTML قابلة للتشغيل بالكيبورد، ويختلط حدث الحاوية مع onChange الراديو. صورة التصميم وحدها لا تكشف العيب.
- **الإصلاح:** استبدال الحاويتين بعنصري label يلفان radio الأصلي، وتجميعهما في radiogroup باسم مالي واضح وإزالة onClick المكرر، مع :focus-within واضح. لا تغيير للمسؤول المالي أو action reducer.
- **التحقق المستهدف:** Playwright بالنقر على نص البطاقة وSpace على راديو مختلف والتحقق من حالة checked، واختبارات regressions القديمة، وصور الموبايل.
- **الحالة:** قيد CI وreview داخل PR H057؛ لا يدّعي اختبار قارئ شاشة بشري.

## H057 — UX-057B / ألوان badges في Dark
- **الدليل:** trips.module.css استخدم ألوان Hex ثابتة فاتحة لرسائل النجاح والتحذير/info وزر حذف، رغم وجود CSS theme tokens Light/Dark.
- **الإصلاح:** الاعتماد على --color-success/--color-warning/--color-info والسطوح المقابلة، وتكبير زر إغلاق الحوار من 36 إلى 44px، من دون تعديل المنطق.
- **الحالة:** قيد إثبات H057 في المتصفح.



## H055 / T11 — عيوب جودة معاينة (٥ نوفمبر ٢٠٢٦)

### UX-055A — القائمة الطويلة داخل الهيدر الثابت على الهاتف
- **الدليل من الكود قبل الإصلاح:** `nav-header.module.css` يضع 7 روابط وزر الوضع في `flex-wrap: wrap`، والروابط بعرض أساس 130px عند <=640 داخل Header sticky؛ يؤدي إلى عدة صفوف تغطي جزءًا كبيرًا من طول شاشة 360px.
- **السبب:** تنقل desktop متعدد الروابط نُقل لنسخة mobile بالتفاف عمودي بلا حد للارتفاع.
- **الإصلاح H055:** عند <=1100، `nav` صف واحد مع `overflow-x:auto` و`white-space:nowrap` وأزرار >=44px، مع أولوية إظهار المحتوى، واختبار 360/768/1024 وجميع صفحات المعاينة.
- **الحالة:** تصحيح على PR H055، القبول بناءً على نجاح CI على آخر SHA؛ لا يُدعى اختبار موبايل فعلي.

### A11Y-055B — تخطي القائمة والتركيز المرئي للرابط
- **الدليل:** `app/layout.tsx` لا يتضمن Skip Navigation، و`globals.css` يطبق `:focus-visible` على الحقول والأزرار دون الروابط.
- **الإصلاح H055:** link أول Tab إلى `main#main-content` مع إظهار عند التركيز، وoutline لجميع الروابط، وفحص Keyboard Tab/Enter. لا تغيّر بوابات Auth.
- **الحالة:** قيد قبول PR H055 وChromium keyboard.

### A11Y-055C — تباين نص التحذير في Light
- **الدليل الحسابي:** `--color-warning:#d97706` فوق `--color-warning-bg:#fffbeb` بنسبة contrast≈3.07:1 وهي أقل من WCAG AA 4.5:1 للنص العادي؛ Dark≈6.97:1.
- **الإصلاح H055:** Light warning text `#92400e` contrast≈6.84:1، والتأكد باختبار computed colors في الوضعين.
- **الحالة:** ينتظر نجاح CI النهائي، ليس مراجعة الوصول الشاملة أو جهازًا فعليًا.


توجد الآن معاينة فعلية؛ سجل المراجعة H034 أدناه يصحح وصف «لم يُبنَ» القديم. مخاطر المرجع القديم محفوظة في [مراجعته](../LEGACY_PROJECT_REVIEW.md)، وليست تذاكر أعطال حالية هنا.

## H038 / DB-03 — اكتشاف جديد يحتاج تحققًا (٥ نوفمبر ٢٠٢٦)

### BUG-007 — فقد وصف النقلة بين المعاينة وتخزين قاعدة البيانات

- **الحالة الأحدث (H040): مغلق ضمن نطاق DB-03 المعزول**؛ [PR #1](https://github.com/body199-cmyk/1-mohamed/pull/1) مدموج على main `cf96b0c5`، وCI النهائي `41943012378` ناجح بعد مرور مراجعة نقدية منفصل. **HTTP/Supabase الحقيقي خارج النطاق ولم يُختبر**.
- **الأولوية:** مرتفعة قبل ربط الحفظ الدائم، لأن البيانات الوصفية والمرجع الورقي قد تُفقد عند الإدخال.
- **الدليل:** `apps/web/src/features/trips/trip-entry-panel.tsx` يسجل `origin`/`destination`/`receiptNumber`، و`PROJECT_REQUIREMENTS.md` وD09 و`UI_PROPOSAL.md` تعتمد هذه الحقول؛ لكن `20261104200020_phase_c_trips.sql` لا يُنشئها، و`20261104200022_phase_c_trip_operations.sql` لا يكتبها؛ وظيفة القراءة لا تعيد `notes` رغم تخزينها.
- **السبب الجذري:** عدم مطابقة عقد قاعدة البيانات لحقل البيانات الوصفية في الواجهة والمواصفات. لا مشكلة حسابية في هذه الحقول.
- **الإصلاح المقترح والمنفذ على الفرع:** Migration إضافية `23_phase_c_trip_details` تضيف أعمدة اختيارية وتُحدّث دوال Create/Update/Read دون تغيير توقيعها؛ تحفظ رقم الإيصال كنص وتُدخل وصف النقلة في تدقيق التعديل. اختبار SQL مستقل `04_phase_c_trip_details_verification` يغطي إنشاء/تعديل/إعادة الطلب/قراءة/إدخال غير صالح.
- **التحقق:** فحص ساكن للشيفرة؛ **نجاح فعلي** في GitHub Actions run `41941247401` / commit `000c93cc`: خطوات SQL A/B/C/metadata وأدوات التحكم السلبي A/B/C. لا يوجد اختبار Supabase HTTP أو توصيل واجهة إنتاج، ويلزم CI على أحدث commit.
- **دليل الإغلاق:** تحقق GitHub Actions `41943012378` (١٦ خطوة SQL و٣ أدوات تحكم سلبي) ومرور مراجعة نقدية موثق في PR #1؛ merge commit `cf96b0c5`. لا ادعاء باختبار Auth/HTTP أو بيئة إنتاج.

### DOC-002 — ملفات الاستلام لا تعكس وجود كود المرحلة C على main

- **الحالة الأحدث (H040): مغلق توثيقيًا**؛ تصحيح نقطة البداية موجود على main بعد PR #1 (`cf96b0c5`) وتوثيق H040 يحدد المرحلة التالية.
- **الدليل:** `docs/STATUS.md` و`docs/TASKS.md` وملحق `docs/SUBTASKS.md` كانت تسجل C «لم تبدأ»، في حين توجد بالفعل migrations `20`–`22`، جناح `03` وإعداد مشغّل القاعدة لها على الفرع `main`.
- **التصحيح:** تحديث الحالة والمهام والخريطة ونقطة الاستئناف مع بقاء H037 تاريخيًا دون محو. لا يُدّعى نجاح التشغيل بمجرد وجود الملفات.

## سجل المشاكل الفعلية

### DOC-001 — عيوب توثيق مواصفات الدفعات والتصحيح في تسليم H025

- **المعرف:** DOC-001.
- **العنوان والحالة:** عيوب توثيق مواصفات الدفعات والتصحيح والتزامن — مغلق (تم الإصلاح في PLAN-02-FIX-01 بدليل H026).
- **الأولوية والأثر:** أثر توثيقي عالي على عقود العمليات المالية؛ لم يمس كودًا أو قاعدة بيانات لأن التطبيق لم يُبرمج بعد.
- **الوصف والعيوب المكتشفة من المراجع:**
  1. تصنيف فحص المسار البيني للأرصدة (D16) كـ «توصية ملزمة مشتقة» بدلاً من تصنيفه الصحيح كـ «مقترح يحتاج قرار المستخدم»، مع إغفال أثره السلبي في منع تسجيل الدفعات الحقيقية المنسية.
  2. تضمين قاعدة غير دقيقة تنص على أن «تخفيض مبلغ الدفعة يُقبل دائمًا» دون اشتراط فحص كفاية الرصيد للمبلغ الجديد بالكامل بعد استبعاد القديم حسابيًا (كما في حالة تصحيح الشغل إلى مبلغ أقل من الدفعة المخفضة).
  3. صياغة معرف الطلب بأنه «لكل نقرة» بدلاً من «معرف ثابت لمحاولة الحفظ المنطقية الواحدة»، وإيهام وجود رصيد مستقل للنقلة عند التصحيح بدلاً من الحساب الكلي للعربية لدى المقاول.
- **الإصلاح المنفذ:**
  - إعادة D16 وD15 إلى تصنيف «مقترح يحتاج قرار المستخدم» وتوضيح أثرهما على الدفعات المنسية في ACCOUNTING_RULES وDECISIONS.
  - تصحيح عقد تعديل مبلغ الدفعة في DATA_MODEL باشتراط فحص البديل بكامل مبلغه وتوثيق المثال المضاد.
  - تصحيح عقد معرف الطلب والحفظ المتزامن، وتوضيح أن أثر تصحيح النقلة يخفض رصيد الحساب ككل دون افتراض رصيد مستقل للنقلة أو تحول الحساب لسالب تلقائيًا.
  - إدراج الأمثلة الرقمية الصريحة والمقارنات في TESTING_AND_RECOVERY.
- **تاريخ الإغلاق:** ٣ نوفمبر ٢٠٢٦ — مرجع التسليم H026.

## قالب المشكلة

- المعرف: BUG-001 وما بعده.
- العنوان والحالة: جديد / يحتاج إعادة إنتاج / مؤكد / قيد الإصلاح / يحتاج تحققًا / مغلق.
- الأولوية والأثر: هل يغير المال أو يفقد البيانات أو يمنع الاستخدام؟
- البيئة والإصدار والتاريخ، دون بيانات مالية شخصية أو أسرار في السجل.
- خطوات إعادة الإنتاج، المتوقع، والفعلي، ودليل قابل للمراجعة.
- السبب الجذري: غير معروف حتى يتم التحقق، لا تخمين يعرض كحقيقة.
- النطاق والملفات المتأثرة ورابط المهمة.
- الإصلاح والسبب، وخطة الرجوع إن مس بيانات.
- اختبار يمنع العودة، ونتيجته، وما لم يُختبر.
- تاريخ الإغلاق ومرجع التغيير/التسليم.

الإصلاح الذي يخفي العرض ولا يصلح المصدر لا يغلق المشكلة. إذا ثبت أن البلاغ غير صحيح، يحتفظ به مع تفسير؛ لا حذف تاريخ. تغييرات الوثائق المعتادة تسجل في HANDOFF_LOG ولا تحتاج بلاغًا مصطنعًا.

## مخاطر وقائية مرتبطة بخطة العمل

هذه ليست أعطالًا موجودة: استرجاع جزئي (T10)، اختلاف معادلات الكشوف (T08/T09)، فقد تاريخ الدفعة (T08)، تشغيل نسخ غير مصرح (T10/T11)، تحميل كل البيانات (T11)، وتضخم ملفات المسؤوليات (كل مهمة). معايير منعها في الدستور والاختبارات.

## مراجعة APP-01 — H034 (٤ نوفمبر ٢٠٢٦)

| المعرف | إعادة الإنتاج والسبب | الإصلاح | دليل منع العودة |
|---|---|---|---|
| BUG-001 | افتتاحية مثل 1,000 تُقرأ جزئيًا عبر parseFloat، والمدخل الفاسد يتحول لصفر؛ حساب بالقيمة العائمة | استخدام محرك المبالغ الدقيق وتطبيع الأرقام العربية ورفض الفواصل الملتبسة | اختبار افتتاحية ٢٥٫٥٠ ورفض 1,000 في review-regressions |
| BUG-002 | تعديل الطريق فقط ثم نقلة جديدة لا يحذر؛ التنقل يفقد المسودة لأن الحالة في الصفحة؛ الحفظ يصفرها تلقائيًا | سياق جلسة أعلى الصفحات، مقارنة كل الحقول بخط البداية، الاحتفاظ بعد الحفظ وقفل الإضافة حتى نقلة جديدة | اختبار المسودة والتنقل والنقر المزدوج والطريق |
| BUG-003 | 0.000 لا يساوي النص 0 فيمر؛ تاريخ سابق لبداية المقاول يفسد الكشف | رفض الوزن الصفري بعد التحقق الرقمي وفحص تاريخ النقلة بمحرك الكشف | اختبار الوزن والتاريخ في review-regressions |
| BUG-004 | إضافة مقاول من المشترك تعدل مقاول النقلة الحالية | هدف إضافة صريح للمشترك أو النقلة | اختبار المشترك مقابل النقلة |
| BUG-005 | تبعيات APP-01 بها تحذيرات audit؛ التقرير نسب منع ترقية كاسرة للتكليف بلا دليل | ترقية محلية محددة، إزالة ازدواج React عبر dedupe، قفل موحد | npm audit وbuild وnpm ci في تقرير المراجعة |
| BUG-006 | المتصفح يطلب favicon.ico غير موجود (404) | أيقونة SVG محلية معلنة بالـmetadata | التقاط console/pageerror للواجهتين بثلاثة عروض |

حالة الإغلاق ونتائج التشغيل النهائية في [APP_01_REVIEW](APP_01_REVIEW.md). لا بيانات إنتاج تأثرت. هذه الإصلاحات لا تعادل الحماية المالية من الخادم؛ تلك الحماية لم تُنفذ بعد.

## H040 — إغلاق العيوب الموثقة بعد الدمج (٥ نوفمبر)

- **BUG-007:** إغلاق محدود لنطاق تخزين حقول النقلات في SQL؛ اختبارات CREATE/UPDATE/READ/CANCEL/replay والمراجعة الأمنية اللاحقة نجحت على قاعدة معزولة، PR #1 مدموج. **لا يُفسَّر هذا كاكتمال واجهة حفظ دائم**.
- **DOC-002:** انحراف نقطة الاستئناف القديمة صُحّح، والسجل التاريخي محفوظ. STATUS H040 هي المرجع الحالي الوحيد؛ أي مهمة جديدة تقارنها بملفات الكود الفعلية وGitHub.
- **H039:** عيوب الحراسة المؤقتة رُصدت وأُصلحت **قبل الدمج** ضمن مراجعتها النقدية؛ دليل HTTP/CI في PR #2 وAUTH_01_H039_REVIEW. لا توجد تذكرة عطل إنتاج لأن Auth الحقيقية لم تبدأ ولم توجد بيانات إنتاج.

## H058 / BUG-008 — Dashboard E2E assertions tied to wall-clock date (6 Nov 2026)

- **Status:** correction submitted for CI re-verification in PR #21 (not closed until PASS).
- **Evidence:** GitHub Actions run `42141473302`: 3 old Chromium assertions expected the 2026-11-05 fixture (`2.000` tonnes, `1000.00/900.00` EGP and payment on the 5th), but the current Cairo date became 2026-11-06 (`1.500` tonnes, `600.00/525.00` EGP). New H058 tests passed. No proof of financial-engine error.
- **Root cause:** tests read live `cairoBusinessDate()` while expecting one specific fixture day. **Correction:** fixed browser clock at 2026-11-05 noon Cairo before each affected E2E navigation; retain all existing monetary assertions. Production date handling unchanged.
- **Follow-up:** require full green CI and critical review on exact PR SHA; do not merge otherwise. Long-term server/physical-device clock alignment remains an integration quality gate.

## H059 / BUG-009 — Active navigation contrast below AA in dark mode

- **Status:** fixed on H059 branch; final acceptance requires passing CI at latest SHA and PR review.
- **Evidence:** inspected actual dark-mode H058 contractor report screenshot, then verified theme tokens and `nav-header.module.css`: active text `#3b82f6` against `#1e3a8a` gives **2.82:1**, below WCAG AA 4.5:1 for ordinary text. Light mode was 4.75:1. This is a measurable visual/accessibility defect, not a financial issue.
- **Correction:** active link text uses `--text-main` while preserving primary underline and active background. The expected dark contrast from exact tokens is **9.9:1**. Added computed-color Playwright regression in `e2e/visual-audit-h059.spec.ts` testing both themes with threshold 4.5:1.
- **Verification:** full H059 CI and final patch review required; physical Android and final user aesthetic acceptance remain separate.

## H061 / BUG-010 — E2E screenshot theme hydration race (6 Nov 2026)

- **Evidence:** H061 CI run `42194563268` on initial PR #24 head: all unit, SQL-negative, backup, build, Auth/HTTP steps PASS; browser results **47 passed, one failed and one flaky**. The H059 seven-route screenshot test in *light mode* at 360px and 1280px sometimes timed out at 120 seconds while waiting to click `getByRole('button', { name: 'تفعيل الوضع الفاتح' })`. Tests often passed if retried after hydration. All 12 new H061 screenshots were uploaded and their own UI tests passed.
- **Root cause:** `html[data-theme]` is set in the client ThemeProvider `useEffect`. The screenshot test read `getAttribute('data-theme')` immediately after `page.goto`, sometimes receiving `null` before hydration and choosing the wrong toggle (asking for “light switch” even though default mode is light).
- **Fix:** E2E only: `await expect(page.locator("html")).toHaveAttribute("data-theme", /^(light|dark)$/)` before deciding to toggle in `e2e/visual-audit-h059.spec.ts` and new `e2e/h061-operational-forms.spec.ts`. No production UI, calculations, auth, storage or theme provider changed.
- **Status:** pending full CI verification on latest PR head and critical review; do **not** merge on first failed run.
## H061 / BUG-011 — Dark primary text contrast just below 4.5 (6 Nov 2026)
- **Evidence:** second H061 CI run `42195882955`, 48 browser cases pass while new contrast test fails consistently for `/demo/trips` dark primary action: measured **4.438954753:1** vs WCAG 4.5:1 target. Earlier H059 hydration race was fixed: old screenshots all passed. Financial/DB/backup/build/Auth steps green.
- **Correction:** dark theme primary label token in `apps/web/src/styles/variables.css` dark changes `#10283f` → `#061629` for a measurable contrast margin; `e2e/h061-operational-forms.spec.ts` also waits for `data-theme` after each navigation and logs exact computed foreground/background in test errors, avoiding color checks during theme rehydration.
- **Status:** pending complete CI on final head and separate patch review before merge. No changes to records, amounts, calculations, or application behaviour.

## H063 / TEST-012 — Old CSV and A4 header assertions lagged user-approved six-column report (6 Nov 2026)
- Initial H063 PR #26 run `42213645950` failed in **3 legacy rendering tests only**: 2 CSV exact-array expectations and 1 HTML required-heading check still expected 5 columns (e.g., “المرجع”, “قيمة الشغل”) instead of approved 6 columns (“رقم النقلة”, “رقم الإيصال”, “الأثر على حساب أحمد”). TypeScript checks and 29 package tests passed; no evidence of business calculation defect.
- Change: update these *exact order assertions* to the six-column structure, including explicit “—” for optional missing receipt. Do not weaken security escaping/formula guard or record-order tests. New H063 positive/negative and receipt tests remain active.
- **Status: CLOSED.** Updated the legacy exact-column assertions on PR #26; final run `42215230226` passed 54/54 Chromium and all package tests. Security/formula guard, escaping, and row-order assertions remain intact.

## H063 / BUG-013 — PDF/PNG summary bidi displaced leading financial signs (6 Nov 2026)
- Evidence: H063 browser CI `42214020869` passed 54/54 Playwright and all full checks on head `6df1c472`, with actual PDF artifact `13498989823`. After rendering its A4 page to an image, **row values displayed −600/+300 correctly, but summary mixed Arabic currency with digits and visually placed +/− after numbers** (e.g. `ج.م 600.00-`). User explicitly requested sign on number; this visual problem would undermine D18 despite passing byte equality tests.
- Narrow fix in `render-statement-image.ts` only: when metric value ends with ` ج.م`, draw the numeric amount including leading sign as its own LTR canvas text token, and display `(ج.م)` in the summary metric label. Underlying raw `ContractorStatementDocument` string, amount, sign, page widths and financial calculations remain unchanged. Update exact `image-rendering.test.ts` text expectations and add explicit leading-sign assertion in H063 renderer test; preserve six columns/receipts.
- **Status: CLOSED.** Final CI `42215230226` passed; artifact `13501365580` was downloaded and PDF/PNG visually inspected. The summary now draws signed numerals as LTR and places currency in the label; leading signs are visually correct. Merged with PR #26 at `7735761450571f755041cb02a75b30b392b9f0cb`.


## H064 / TEST-013 — E2E baseline measurement and CSV regression (7 Nov 2026)

- **CSV:** تم تحديث توقع regression إلى صيغة H063 المعتمدة مع الإشارة الموجبة وعلامة حماية CSV؛ لم يتغير كود التصدير أو الحساب. أُضيف ملف `e2e/review-regressions.spec.ts` إلى GitHub Actions؛ نجحت اختبارات الملف 9/9.
- **H059 contrast:** لا يوجد عيب جديد في ألوان التطبيق. كانت قراءة 1.56:1 أثناء انتقال CSS بين الثيمين؛ القيم النهائية الداكنة `#eaf1f8` على `#1c4167` تعطي نحو 9.21:1. عُدّل الاختبار لينتظر انتهاء انتقالات CSS عبر Web Animations API ثم يقيس اللون النهائي، مع بقاء حد 4.5:1 كما هو.
- **H055/H060:** تم انتظار جاهزية العناصر وقياس زر الإجراء بعد انتهاء انتقال الخلفية؛ شريط التنبيه في H055 لا يملك انتقال ألوان، لذلك يُقاس مباشرة بعد تطبيق سمة الثيم.
- **forms-h057:** فشل Target crashed الذي ظهر محليًا لم يتكرر في GitHub CI؛ لا دليل على عيب في التطبيق. لا نُخفيه من السجل التاريخي، لكنه لا يمنع خط الأساس بعد نجاح CI.
- **Final evidence:** PR #28 merged at `433658bfc32a411dbfbbd2640a6d564f3577a1e4`; exact tested head `1e533d6f0a9c0c84aecd1299a2accf15e4f0bfdb`; run `42314459722` SUCCESS (55 + 9 browser tests and all remaining workflow checks).
- **Status: CLOSED.** Test-only/CI/documentation correction; no application source, accounting, SQL, Auth, or persistence changes.


## H065 / BUG-014 — وصف حركة كشف نقد العربية يسرّب رقم الإيصال بدل معرّف الحركة (١١ نوفمبر ٢٠٢٦)

- **العيب:** وصف حركة النقلة في `buildCashLedger` كان يُبنى من `trip.receiptNumber || trip.id`، ووصف الدفعة بنفس النمط `payment.receiptNumber || payment.id`، فيظهر رقم الإيصال في شاشة كشف نقد العربية وفي التصديرات الخمس (HTML/Print وPDF وPNG وCSV وXLSX) رغم قرار إخفاء الإيصال من وصف الحركة (H065). الدليل الأول من CI #42881454697: نص الجدول `مستحق نقلة REC-001`.
- **السبب:** السطران 106 و130 في `apps/web/src/features/payments/cash-ledger.ts` بنايا الوصف من `receiptNumber` بدل معرّف الحركة، والشاشة والتصديرات يمرران `row.label` كما هو.
- **الإصلاح (CASH-LABEL-01):** الوصف يعتمد `trip.id` و`payment.id` فقط؛ بيانات `receiptNumber` الأصلية لم تُحذف أو تُغيّر في أي سجل، ولا تغيير في المبالغ أو الأرصدة أو التواريخ أو ترتيب الحركات. أُضيف اختبار مستقل `apps/web/e2e/cash-movement-label-validation.test.ts` (نقلة ودفعة لهما إيصالان + حالة إيصال فارغ)، وصُحّحت تأكيدات كانت تُثبّت السلوك المعيب في `vehicle-cash-report-validation.test.ts` و`e2e/vehicle-cash.spec.ts` بشرط ظهور معرّف الحركة وغياب الإيصال.
- **المتابعة خارج النطاق:** `apps/web/src/features/dashboard-view.tsx` (سطران 82 و96) لا يزالان يعرضان `receiptNumber || id` في شاشة الرئيسية؛ خارج نطاق كشف نقد العربية ويحتاج قرارًا منفصلًا.


## BUG-015 — اختلاف مدقق الافتتاحي بين الكتابة والقراءة يُبطل قراءة الحد الأدنى لـbigint الموقّع (١١ نوفمبر ٢٠٢٦)

- **العيب:** على رأس PR #44 عند `4bd06635c61b7d09c2bdbd40dcf3eb3bccd209e8`، `validOpeningPiastres` (المدقق المعتمد) و`parseOpeningEgp` يقبلان ويخزنان الافتتاحي `-9223372036854775808` (الحد الأدنى لـbigint الموقّع في SQL، ومثبت مخزنًا في `08_fin07_numeric_boundaries_verification.sql`)، لكن `buildCashLedger` في `apps/web/src/features/payments/cash-ledger.ts:73` كان يرفضه بفحص نطاق زائد `balance < -MAX_PIASTRES` ⇒ كشف نقد الحساب كله يفشل بـ«رصيد افتتاحي نقدي غير صالح.» لافتتاحي مُخزَّن بنجاح. **إعادة إنتاج:** افتتاحي نقد `(V1، أحمد)` بقيمة `-9223372036854775808` ⇒ أي `buildCashLedger`/تقرير نقد/حفظ دفعة على هذا الحساب يفشل.
- **السبب:** تحقق مكرر للنطاق في مسار القراءة لا يطابق المدقق المعتمد في مسار الكتابة؛ الحد الأدنى الصحيح `-(2^63)` وليس `-MAX_PIASTRES`.
- **الإصلاح:** حذف سطر الفحص الزائد فقط؛ `validOpeningPiastres` هو مصدر الحقيقة الوحيد لصحة الافتتاحي (نطاق bigint الموقّع كاملًا بما فيه `-(MAX+1)`). **حدود الحركات والمبالغ والمدفوعات لم تتغير** (`MAX_PIASTRES` باقٍ على سطور 25/104/127)، ولا تغيير في الحساب أو SQL أو migrations.
- **الاختبار المانع للعودة:** حالة `BUG-015` في `apps/web/e2e/payments-validation.test.ts` (ملف موصول بـCI في خطوة «Check D16 demo payment ledger and isolated accounts»): قبول الحد الأدنى `-(2^63)` في الكشف مع أرصدته، رفض `-9223372036854775809` بقرش أقل بنفس رسالة الخطأ، وبقاء الحد الموجب الأقصى مقبولًا. 20/20 PASS محليًا قبل الرفع.
