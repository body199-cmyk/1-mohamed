# SYNC-02 — جرد GitHub وخطة الدمج المرحلية
**تاريخ الفحص:** 10 نوفمبر 2026  
**المستودع:** body199-cmyk/1-mohamed  
**نقطة الأساس:** main@1e1dae637d9b  
**الفرع المستقل لهذا التقرير:** codex/sync-02-merge-audit-20261110

## 1. النطاق والنتيجة التنفيذية

هذه مراجعة قراءة فقط لملفات التطبيق والفروع وPRs ونتائج GitHub Actions وحالات Vercel. لم يُعدّل كود التطبيق أو migrations، ولم يُدمج أي فرع، ولم يُنشر أي إصدار، ولم تُنفذ كتابة على بيانات تشغيلية.

- أحدث main هو 1e1dae637d9bb1c29e74b31b2180e7ddda2769b5، وهو دمج PR #32.
- جرى جرد **51 فرعًا** و**46 PR**: يوجد **14 PR مفتوحًا، جميعها Draft**، وPR #33 مغلق دون دمج.
- أحدث دمج رئيسي هو PR #32. ومن المهم أن PR #30 الخاص بتصدير اليومية وكشف نقد العربية دُمج قبله، وCI الخاص به نجح؛ لذلك عبارة STATUS/TASKS الحالية التي تقول إن هذين التقريرين على الشاشة فقط أصبحت قديمة.
- حالة Vercel المجمعة على رؤوس الفروع: 21 نتيجة ظاهرة (18 نجاحًا و3 فشل)، و30 فرعًا بلا status entry. هذه **حالة Vercel وليست GitHub Actions CI**.
- لا توجد GitHub Actions runs ولا check-runs مرتبطة مباشرة بـSHA main الحالي؛ حالة Vercel عليه نجاح.
- لا يُوصى بدمج PR #44 الآن: آخر CI فشل في اختبار H062، وسجل H061 يحتوي فشلًا متقطعًا. كما أن اختبار H065 لم يصل إلى التنفيذ في هذا التشغيل.
- FIN-04 وFIN-05 مستقلان عن #44، لكنهما يشتركان معه في tools/db-verify.mjs؛ يجب دمج قوائم الاختبارات لا استبدال ملف بآخر.
- فرع تطوير كشف المقاول المرحلة الثالثة غير موجود في PR، ولا يحقق بعد كل المتطلبات المعتمدة D18–D22.

## 2. ما هو داخل main وما هو خارجه

### مدموج وموجود في main

| PR | النطاق المدموج | الدليل |
|---|---|---|
| #32 | أساس UX المعتمد، التنقل/الرئيسية/الإعدادات، ومراجعات العرض | main الحالي عند 1e1dae6 |
| #30 | H065: خمسة مخرجات لتقرير الشغل اليومي وكشف نقد العربية، مع مشاركة الصورة | [CI 42318569754](https://github.com/body199-cmyk/1-mohamed/actions/runs/42318569754) SUCCESS |
| #28 | H064: أساس اختبارات E2E وregression | [CI 42314459722](https://github.com/body199-cmyk/1-mohamed/actions/runs/42314459722) SUCCESS |
| #26 | H063: إشارة الشغل ومعرّف النقلة/الإيصال في كشف المقاول | مدموج؛ لا يزال D18 القديم ظاهرًا في سجل القرارات |
| #25/#24/#23 | H062/H061/H060: تقارير متجاوبة، نماذج تشغيلية، وأساس Tabler RTL | مدموجة في السلسلة السابقة |

**تصحيح مهم لـT09:** الكود الموجود على main في apps/web/src/features/reports/report-export-actions.tsx وreport-export-documents.ts يدعم HTML/Print وPDF وPNG وCSV وXLSX لتقرير اليومية وكشف نقد العربية. PR #30 مدموج وCI الخاص به أخضر. إذن T09 مكتملة تجريبيًا من ناحية صيغ التصدير لهذه التقارير، مع بقاء قيد أن البيانات في DemoStore وليست حفظًا دائمًا.

### ما زال خارج main

- PRs المفتوحة #31 و#34–#46، وجميعها Draft.
- فرع feat/contractor-statement-ux-stage3-20261107 بلا PR.
- FIN-04 وFIN-05 لم يندمجا.
- PR #33 مغلق دون دمج؛ لا يُعاد إحياؤه تلقائيًا.
- PR #38 هو خط أساس توثيقي مستقل، وليس جزءًا من تكامل #44.

## 3. جرد رؤوس الفروع وحالة Vercel

العلامة هنا تخص status entries التي أعادها GitHub للـSHA نفسه. — تعني عدم وجود status entry؛ ولا تعني نجاح CI. نتائج Actions للـPRs مفصلة في القسم التالي.

| الفرع | SHA مختصر | Vercel |
|---|---:|---|
| audit/approved-ux-and-report-corrections-20261107 | 2535b77 | success |
| audit/batch2-financial-hardening-20261107 | c99f57e | failure |
| audit/ops03-baseline-20261109 | f42b8ef | success |
| codex/sync-01-review-20261110 | ee41ec5 | success |
| design/approved-ux-phase1-20261107 | 12c1569 | success |
| design/ux-navigation-refresh | 73c1249 | success |
| docs/h040-verified-handover | a5a26ed | — |
| docs/h042-offline-first-plan | 020c5a3 | — |
| docs/h063-closeout-project-roadmap | c027720 | — |
| docs/h064-closeout-and-handoff | ff959b6 | — |
| docs/h065-exports-closeout | d9af1a0 | success |
| feat/auth01-safe-boundary-h039 | 58de799 | — |
| feat/auth01-ssr-sdk-h041 | 02e2c61 | — |
| feat/contractor-statement-ux-stage3-20261107 | 668f211 | failure |
| feat/h056-precloud-visual-foundation | 2148595 | — |
| feat/h057-precloud-forms-polish | a50b727 | — |
| feat/h058-precloud-reports-polish | ffc4f3f | — |
| feat/h059-precloud-visual-audit | 9323eb8 | — |
| feat/h060-tabler-rtl-visual-system | deed4b4 | — |
| feat/h061-tabler-operational-forms | c6048a7 | — |
| feat/h062-tabler-reports-fixed-export | 62758a2 | — |
| feat/h063-signed-contractor-report-receipts | 29ea160 | — |
| feat/h065-daily-vehicle-report-exports | 4007780 | success |
| feat/reports01-daily-work-h045 | 750ddd0 | — |
| feat/t08-1-payment-schema-h047 | 4cb952b | — |
| feat/t08-2-secure-payments-h048 | 37eb7af | — |
| feat/t08-3-demo-payment-ui-h049 | 6c73058 | — |
| feat/t08-4-5-vehicle-cash-report-h050 | 741f9e9 | — |
| feat/t08-6-home-dashboard-h051 | 1e2b0b2 | — |
| feat/t09-2-direct-pdf-h052 | 8a38861 | — |
| feat/t09-3-xlsx-export-h053 | 6347120 | — |
| feat/t09-image-png-export-h046 | e706465 | — |
| feat/t10-backup-core-h054 | 566ea75 | — |
| feat/t11-h055-responsive-a11y-quality | c153baa | — |
| feat/trip-entry-approved-ux-stage2-20261107 | 3e6f871 | failure |
| feat/ui-base01a-master-index-h043 | ad152fa | — |
| feat/ui-base01b-safe-edit-archive-cash-h044 | 7f06da1 | — |
| fix/db03-trip-details-h038 | d51d2e5 | — |
| fix/fin03-trip-cash-opening-20261109 | cae4269 | success |
| fix/fin04-cash-opening-timeline-20261109 | 8d9f85a | success |
| fix/fin05-payment-period-opening-20261109 | 305cb95 | success |
| fix/fin07-aggregate-balance-20261109 | 3d540a6 | success |
| fix/ci-approved-ui-compat-20261109 | e838c80 | success |
| fix/mobile-nav-scroll-and-ux-audit-20261107 | 30ba4de | success |
| fix/payment-preview-stage3-20261107 | 21fb859 | success |
| main | 1e1dae6 | success |
| opencode/fix-e2e-baseline | 1e533d6 | — |
| opencode/local-work | 2d28b38 | — |
| test/fin01-fin02-payment-boundaries-20261109 | 2160407 | success |
| test/integration-finance-mobile-20261109 | 337909f | success |
| test/ui01-payment-preview-boundaries-20261109 | 972cbb7 | success |

فشل Vercel في الفروع الثلاثة المشار إليها لا يُعامل كفشل اختبارات التطبيق؛ نتائج status تشير إلى فشل نشر/بناء preview، وبعضها مرتبط بحدود build. لا تستبدل هذه العلامات نتائج Actions.

## 4. حالة PRs المفتوحة وGitHub Actions

كل PRs أدناه مفتوحة بحالة Draft. أرقام التشغيل هي أحدث تشغيل مرتبط بآخر SHA المعروض وقت الفحص.

| PR | الفرع / SHA | CI على آخر SHA | ملاحظة المراجعة |
|---|---|---|---|
| #31 | design/ux-navigation-refresh / 73c1249 | لا يوجد run على SHA الحالي | 6 commits ahead و2 behind main؛ يتعارض مع أساس التنقل الذي دُمج في #32. لا تدمجه كما هو. |
| #34 | audit/approved-ux-and-report-corrections / 2535b77 | failure 42411260644 | helper قديم يبحث عن زر الثيم في موضع أزيل بعد UX #32. |
| #35 | feat/trip-entry-approved-ux-stage2 / 3e6f871 | failure 42413725359 | فشل E2E مرتبط بمحددات/موضع تبديل الثيم القديم؛ Vercel failure منفصل. |
| #36 | fix/payment-preview-stage3 / 21fb859 | failure 42393525895 | نفس مشكلة helper/محدد الثيم القديم. |
| #37 | audit/batch2-financial-hardening / c99f57e | failure 42413518581 | نفس مشكلة helper/محدد الثيم القديم؛ Vercel failure منفصل. |
| #38 | audit/ops03-baseline / f42b8ef | failure 42564627030 | Auth smoke يتوقع /demo/dashboard بينما المسار المعتمد /demo/home. |
| #39 | fix/fin03-trip-cash-opening / cae4269 | failure 42567777163 | 31 فشل متصفح؛ معظمها من helper الثيم القديم. |
| #40 | fix/fin07-aggregate-balance / 3d540a6 | failure 42569936250 | 28 فشل متصفح؛ helper الثيم القديم. |
| #41 | test/fin01-fin02-payment-boundaries / 2160407 | لا يوجد run على SHA الحالي | base المسجل في PR أقدم من رأس FIN-07 الحالي بخمسة commits؛ تكامل #44 يحتوي تغييرات هذا الفرع. |
| #42 | test/ui01-payment-preview-boundaries / 972cbb7 | failure 42567333196 | 32 فشل متصفح؛ helper الثيم القديم. |
| #43 | fix/ci-approved-ui-compat / e838c80 | failure 42569780673 | H065 يتوقع REC-002 في CSV وحقل إيصال دفعة لم يعد ظاهرًا. |
| #44 | test/integration-finance-mobile / 337909f | failure 42570988152 | 54 passed، اختبار واحد failed، واختبار واحد flaky؛ التفاصيل أدناه. |
| #45 | fix/fin04-cash-opening-timeline / 8d9f85a | failure 42570652617 | فشل HTTP Auth smoke بسبب /demo/dashboard القديم؛ خطوات DB السابقة اجتازت. |
| #46 | fix/fin05-payment-period-opening / 305cb95 | failure 42570656121 | نفس فشل HTTP Auth smoke؛ اختبارات SQL السابقة اجتازت. |

### نتائج تشغيل #44 بالتحديد

الرابط: [Actions run 42570988152](https://github.com/body199-cmyk/1-mohamed/actions/runs/42570988152).

1. **H062 — فشل حتمي في test fixture، لا دليل على فقد صف من التطبيق:** الاختبار يثبت الوقت عند 2026-11-05 ثم يتوقع 3 بطاقات. بيانات INITIAL_TRIPS تحتوي TRIP-HIST-001 في 2 نوفمبر، و002 في 5 نوفمبر، و003 في **6 نوفمبر**. الشاشة تنتهي عند تاريخ اليوم المثبت، لذلك لا يمكن أن تعرض النقلة الثالثة في 5 نوفمبر. الحل الاختباري: إما تثبيت وقت اختبار العرض عند 7 نوفمبر إذا كان المطلوب إثبات الثلاث نقلات، أو جعل التوقع 2 إذا كان المطلوب اختبار 5 نوفمبر. لا تغيّر منطق الفترة لمجاراة توقع غير متسق.
2. **H061 — flaky:** قياس تباين التبويب المحدد في الوضع الداكن أعاد 3.241:1 في المحاولة الأولى مقابل حد 4.5:1، ثم نجح retry. helper selectThemeViaSettings ينتظر data-theme فقط ولا ينتظر استقرار العرض قبل قراءة الألوان. يلزم انتظار مستقر/انتهاء أي animation أو transition ثم إعادة القياس؛ لا تخفّض معيار 4.5:1.
3. **H065 لم يُنفذ في هذا التشغيل** لأن خطوة E2E توقفت بعد فشل H062. لذلك لا يوجد إثبات أخضر لاختبارات H065 على SHA #44.
4. اختبار H065 الحالي على #44 ما زال يتوقع REC-002 وREC-001 داخل CSV. كود تصدير اليومية ونقد العربية لا يضع رقم الإيصال في أعمدة التصدير، وخطة الإغلاق المعتمدة في PR #34 تنص على إزالة رقم الإيصال من المخرجات المرئية مع الإبقاء على بيانات المصدر. فشل PR #43 بالفعل عند توقع REC-002. يجب تعديل التوقع ليطابق عقد التصدير المعتمد، لا إعادة حقل الإيصال.

## 5. مراجعة تكامل #44 من الملفات الفعلية

PR #44 عند 337909f3c9f37fc738a10e3a8d9357fa66ccbeb9 متقدم عن main بـ102 commit ويغيّر 76 ملفًا. هو فرع تجميعي كبير، وليس فرعًا صغيرًا مستقلًا.

### ما تحقق وجوده فعليًا

- apps/web/src/demo/demo-context.tsx يحتوي مساري writeDemoTrip وapplyDemoPaymentEdit؛ لا يوجد دليل على أن دمج تعديل الدفع أزال كتابة النقلة.
- payments-view.tsx يستخدم parsePaymentEgp نفسه للمعاينة والحفظ.
- trip-cash-opening-validation.ts موجود ويُستدعى قبل حفظ النقلة.
- cash-ledger.ts وpackages/accounting/src/trip-amounts.ts واختبار vehicle-cash-report-validation.test.ts لها blobs مطابقة لنسخ FIN-07 الحالية؛ إصلاح حد إجمالي الرصيد موجود في #44، وليس مفقودًا لمجرد أن رسم الفروع متشعب.
- tools/auth-boundary-smoke.mjs على #44 يتوقع /demo/home، ونجحت خطوة HTTP Auth smoke في تشغيل #44.
- tools/db-verify.mjs على #44 يحتوي اختبارات FIN-01/02 وFIN-07.

### ما لم يدخل #44

- لا يحتوي migration أو SQL test الخاصين بـFIN-04 أو FIN-05.
- لا يحتوي تحسينات كشف المقاول الفريدة في stage3: الفلاتر والبحث والتجميع اليومي.
- خطوة H065 في E2E لم تُثبت على SHA #44، كما سبق.

### لماذا لا تُدمج الفروع المتراكبة منفردة

تعديلات #34–#37 و#39–#43 تتشارك ملفات مثل demo-context.tsx وpayments-view.tsx وcash-ledger.ts وtools/db-verify.mjs وملفات E2E. #44 يجمع هذه التغييرات في حالة واحدة بعد معالجة التداخلات. لذلك لا تدمج PRs المتراكبة واحدًا تلو الآخر فوق #44؛ تعامل مع #44 كوحدة تكامل واحدة بعد اجتياز CI، واحتفظ بـ#38 كتوثيق مستقل إن بقي محتواه مطلوبًا.

## 6. FIN-04 وFIN-05

### FIN-04 — PR #45

الملفات الأساسية:
- supabase/migrations/20261109210000_fin04_cash_opening_timeline.sql
- supabase/tests/08_fin04_cash_opening_timeline_verification.sql
- tools/db-verify.mjs

المراجعة الفعلية:
- الحارس يرفض افتتاحي نقد بتاريخ لاحق لحركات سابقة، ويفحص النقلات والمدفوعات.
- حارس النقلة يمنع إدخال نقلة قبل تاريخ افتتاحي الحساب.
- اختبار SQL الحالي يثبت سيناريوهات النقلة السابقة، لكنه **لا يختبر دفعة سابقة لتاريخ الافتتاحي** رغم أن migration يفحص المدفوعات. أضف هذا السيناريو قبل الدمج.
- لا يوجد اختبار PostgreSQL بجلسَتين متزامنتين يثبت السباق بين إنشاء افتتاحي نقد وإدخال نقلة؛ اختبار PGlite المعزول لا يثبت هذا السلوك التزامني.

### FIN-05 — PR #46

الملفات الأساسية:
- supabase/migrations/20261109210010_fin05_payment_period_opening.sql
- supabase/tests/09_fin05_payment_period_opening_verification.sql
- tools/db-verify.mjs

المراجعة الفعلية:
- يستبدل app_op_payments_read مع الحفاظ على cash_balance_piastres القديم وإضافة period_opening_piastres وperiod_closing_piastres وcurrent_cash_balance_piastres.
- فرع #46 متفرع من SHA أقدم لـFIN-04؛ compare يعرض 5 commits ahead و1 behind، مع أن blob اختبار FIN-04 على #46 مطابق لنسخة رأس #45 الحالية. حدّث/تحقق من قاعدة الفرع قبل الدمج بدل الاعتماد على mergeable وحدها.
- واجهة DemoStore الحالية لا تستهلك حقول الفترة الجديدة من RPC؛ هذا تعديل لعقد SQL، وليس إثباتًا لميزة واجهة مستخدم متصلة بـSupabase.

### تعارض الدمج المشترك

tools/db-verify.mjs عُدّل في ثلاثة مسارات:
- #44 يضيف suites لـFIN-01/02 وFIN-07.
- FIN-04 يضيف migration واختبار FIN-04.
- FIN-05 يضيف migration واختبار FIN-05.

لا تستخدم نسخة أي فرع لاستبدال الملف كاملًا. اجمع كل خطوات migration/test بالترتيب، وتأكد أن التشغيل النهائي يحتوي جميع suites الستة المطلوبة دون إسقاط أي منها.

## 7. كشف المقاول — stage3

الفرع feat/contractor-statement-ux-stage3-20261107 عند 668f2114fff0855863e244d04fe7cc0556d6c638 بلا PR ولا GitHub Actions run على هذا الرأس. حالة Vercel عليه failure، ولا تُعاملها كاختبار كود ناجح أو فاشل.

مقارنة الفرع مع #44:
- merge-base: c99f57e.
- stage3 لديه 9 commits فريدة، و#44 لديه 35 commit فريدًا بعد نقطة الأساس.
- التغيير الفريد في stage3 خمس ملفات: contractor-statements-view.tsx وstatement-summary-card.tsx وstatement-table.tsx وstatements.module.css وe2e/contractor-statement-ux.spec.ts.

الموجود فعليًا في stage3:
- الفترة الافتراضية للشهر الحالي مع خيار كل الفترة.
- بحث وفلاتر اتجاه/منشأ/وجهة.
- ملخص منفصل لقيمة الشغل المفلترة، مع توضيح أنه ليس صافي الحساب النهائي.
- تجميع عرض الشاشة حسب اليوم ثم العربية والوجهات، وعدّ النقلات والعربيات.
- التصدير يبقى لكشف الحساب الكامل ولا يتبع فلاتر الشاشة.

الفجوات قبل اعتباره إغلاقًا كاملًا لـD18–D22:
1. D21 يتطلب فلتر نوع التسعير اليومي/بالنقلة؛ لا يوجد pricingMode في DemoTripRecord ولا في الفلاتر أو الاختبار.
2. التجميع اليومي الحالي يجمع صفوف نقلات؛ لا يمثل بعد سجل عمل يومي واحدًا بعِدّة وجهات وقيمة يومية واحدة، ولا يثبت منع ازدواج الحساب.
3. محرك ContractorStatement يستقبل حركات الشغل فقط ولا يستقبل دفعات/تسويات المقاول. بطاقة stage3 تعرض «صافي المستحق النهائي» من الافتتاحي وفرق الشغل، مع أن الدفعات النقدية منفصلة؛ يجب عدم تقديم هذا الرقم باعتباره صافي الحساب النهائي بعد التسويات دون توضيح أو توسيع النموذج.
4. stage3 لا يحدّث وثيقة التصدير لتشمل ملخص التجميع اليومي؛ تجميع اليوم/العربية موجود على الشاشة فقط.
5. docs/H063_CONTRACTOR_SIGNS_REVIEW.md على هذا الفرع ما زال يصف عمود الإيصال المنفصل، بينما كود stage3 نفسه لا يعرضه. الوثيقة متأخرة عن خطة الإغلاق المعتمدة.

النتيجة: لا تدمج stage3 كما هو. أعد تطبيق التغييرات الخمسة على main الجديد بعد #44، مع فصل تحسينات العرض عن قرارات نموذج التسعير والتسويات، ثم أعد الاختبارات.

## 8. تعارضات التوثيق

- docs/STATUS.md وdocs/TASKS.md وdocs/HANDOFF_LOG.md ما زالت عند H064 بتاريخ 7 نوفمبر، وتقول إن لا PRs مفتوحة وإن اليومية/نقد العربية على الشاشة فقط. هذا يخالف GitHub الحالي ودمج H065 في PR #30.
- docs/DECISIONS.md في D18 ما زال يطلب عمود إيصال مستقل. خطة الإغلاق المعتمدة المرتبطة بـPR #34 تنص لاحقًا على إزالة رقم الإيصال من واجهة وتقارير المقاول مع الاحتفاظ بقيمة receiptNumber في سجل المصدر. يجب تسجيل هذا الاستبدال صراحة، وعدم حذف بيانات المصدر.
- وثيقة H063 في فرع stage3 لا تزال تصف العمود القديم؛ يجب تحديثها عند إعادة تطبيق stage3.
- لا توجد موافقة في هذه المراجعة على D07 أو تغيير خصوصية المستودع أو تشغيل Supabase/Production.

## 9. خطة الدمج المقترحة

| الترتيب | الفرع/PR | الملفات الرئيسية | الاختبارات المطلوبة | الموانع/القرارات |
|---:|---|---|---|---|
| 1 | فرع إصلاح صغير من #44 | e2e/h062-device-independent-reports.spec.ts، e2e/h061-operational-forms.spec.ts أو helper الثيم، e2e/h065-daily-vehicle-report-exports.spec.ts | H062/H061/H065 ثم كامل Chromium، typecheck، unit، db:verify، Auth HTTP، build | تصحيح تاريخ fixture، تثبيت قياس التباين، جعل CSV assertions متوافقة مع receipt-free outputs؛ لا تغيّر الحسابات |
| 2 | #44 كوحدة تكامل | demo-context، payments/trips، accounting، tools/db-verify.mjs، E2E | CI كامل أخضر على الرأس النهائي ومراجعة diff مستقلة؛ تأكد من تشغيل H065 لا تخطيه | لا تدمج #34–#37/#39–#43 منفردة؛ #44 يضم التداخلات |
| 3 | FIN-04 على main بعد #44 | migration 20261109210000...، SQL test 08_fin04...، خطوة verifier | db:verify، اختبار نقلة سابقة ودفعة سابقة، negative controls؛ ثم اختبار PostgreSQL staging بجلسَتين إن أمكن | لا دمج قبل إضافة حالة payment-before-opening وتأكيد ترتيب الأقفال |
| 4 | FIN-05 فوق FIN-04 المحدث | migration 20261109210010...، SQL test 09_fin05...، verifier | اختبارات from/to، افتتاحي/ختامي، يوم الافتتاح واليوم التالي، قائمة غير مفلترة، ثم كامل CI | حدّث base من FIN-04 الحالي؛ اجمع verifier ولا تستبدل خطوات #44؛ لا تدّعِ UI integration |
| 5 | stage3 بعد استقرار #44 والمالية | الخمسة ملفات الفريدة المذكورة أعلاه | 3 اختبارات stage3، H063/H062، mobile 360 وdesktop 1280، full exports، full CI | استكمال/حسم D21 ونموذج daily pricing والتسويات، وتصحيح تسمية صافي الشغل والوثائق |
| 6 | إغلاق وتنظيف الفروع المتراكبة | PRs #34–#43 و#31/#33 و#38 | تحقق أن كل تغيير مطلوب موجود في main أو PR مستقل أخضر | أغلق المتجاوز فقط بعد إثبات احتواء التغيير؛ لا تستعد #33 أو #31 تلقائيًا |

### ملاحظات ترتيب إضافية

- #31: 6 commits ahead و2 behind main؛ تحديث التنقل المدموج في #32 هو المرجع. لا تدمجه.
- #33: مغلق دون دمج، ويتضمن تجربة تمرير/أزرار تنقل لم تُعتمد ضمن الخطة؛ لا تعِد فتحه تلقائيًا.
- #38: احتفظ به كتوثيق مستقل إذا بقيت قيمة OPS-03 مطلوبة، لكن صحح Auth smoke إلى /demo/home قبل أي دمج.
- #41 و#46: حدّث قواعد الفروع المتراكبة قبل الدمج، حتى إن كانت blobs لبعض الملفات متطابقة.
- FIN-09 وأي قواعد محاسبية غير محسومة تبقى خارج التنفيذ حتى قرار مالك العمل.

## 10. أول خطوة تنفيذ مقترحة فقط

ابدأ بفرع اختبار صغير من test/integration-finance-mobile-20261109 لإغلاق موانع #44 الثلاثة: اضبط تاريخ اختبار H062 ليتوافق مع صف 6 نوفمبر، واجعل قياس H061 ينتظر استقرار الثيم، وصحح H065 ليؤكد غياب أرقام الإيصال من التصدير بدل توقعها. بعد ذلك شغّل CI كاملًا على SHA واحد؛ لا تلمس منطق التطبيق ولا تدمج قبل نجاحه.

## 11. سجل التغيير

- هذه الوثيقة مراجعة GitHub وملفات فعلية، وليست موافقة دمج.
- لم يتغير كود التطبيق أو migrations أو إعدادات Supabase/Vercel.
- PR هذا مخصص للتقرير وتحديث وثائق الحالة/المهام/التسليم فقط.
- يجب تحديث رابط PR ورأس الفرع النهائي بعد فتح PR وإتمام آخر commit توثيقي.
