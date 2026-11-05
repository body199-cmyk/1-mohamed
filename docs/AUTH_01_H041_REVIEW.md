# AUTH-01 / H041 — تجهيز حزم Supabase الرسمية بدون تفعيل الدخول

**التاريخ:** ٥ نوفمبر ٢٠٢٦. **الفرع:** `feat/auth01-ssr-sdk-h041`، [PR #4](https://github.com/body199-cmyk/1-mohamed/pull/4).
**الحالة:** تكامل SDK تمهيدي؛ ينتظر المراجعة النقدية النهائية وCI على أحدث SHA. **ليس دخولًا حقيقيًا ولا حفظًا دائمًا.**

## 1. لماذا هذه مهمة مستقلة؟

`H040` وثّق أن `DB-03/H038` و`AUTH-01/PREP/H039` دُمجا في main. Proxy الحالية تمنع جميع المسارات غير العامة، حتى مع ضبط مفاتيح عامة. لا يجوز فتحها دون وجود Supabase Auth اختباري وفحص المالك الحقيقي. نبدأ بالاعتماديات وتكوين الأدوات فقط حتى نستطيع التحقق من البناء والـlockfile دون تحميل المستخدم مسؤولية إصلاحات تقنية.

## 2. ملفات التنفيذ

| الملف | التنفيذ | المخاطر/الحراسة |
|---|---|---|
| `apps/web/package.json` + `package-lock.json` | تثبيت دقيق `@supabase/ssr@0.12.7` و`@supabase/supabase-js@2.119.0`، وتسجيل الاعتماديات المحلولة | `npm ci` يجب أن يطابق الـlockfile؛ لا مفاتيح في الملفات |
| `apps/web/src/lib/supabase/client.ts` | عميل متصفح رسمي باستخدام publishable key | لا import من Demo؛ لا service-role |
| `apps/web/src/lib/supabase/server.ts` | عميل مخصص لـRoute Handlers، يطلب NextResponse صراحة ويحفظ الكوكي وheaders عليها | غير مستخدم؛ لا يسمح بالاعتماد على الكوكي دون تحقق حقيقي |
| `apps/web/src/lib/supabase/owner.ts` | فحص JWT عبر `auth.getClaims()` ثم تفويض المالك عبر RPC `app_is_owner`، وإرجاع رفض قاطع عند أي خطأ | غير مستخدم بعد؛ لا تفويض بالـemail أو session cookie منفردة |
| `apps/web/src/lib/supabase/proxy-session.ts` | محول جلسة مؤجل إلى مرحلة اختبار حقيقي؛ يحفظ الكوكي وheaders المحدثة | **غير مستورد في `src/proxy.ts`**؛ الحراسة الافتراضية القديمة باقية |
| `tools/auth-sdk-boundary-check.mjs` | تأكيد أن حراسة الإنتاج لم تُفتح وأن الحزم مثبتة مع الـlockfile | فحص آلي وقائي؛ لا يحل محل Auth E2E |

## 3. قاعدة عدم التفعيل

- `apps/web/src/proxy.ts` يُترك **كما هو**: أي مسار دائم غير عام محجوب، المعاينة فقط متاحة. `/login` تظل صفحة معلوماتية دون حقل كلمة مرور.
- لا توجد خدمة Supabase سحابية تجريبية مثبتة داخل هذا الـPR، ولا اتصالات HTTP للمصادقة، ولا مستخدم مالك مُسجل، ولا تسجيل دخول أو استرجاع أو خروج.
- لا يُغيَّر `.env.example` بقيم تشغيل أو كلمات مرور، ولا service-role key. SDK العمومية تعتمد فقط على متغيرات `NEXT_PUBLIC_*` التي لا تحتوي أسرارًا.
- لا تُستخدم `createRouteHandlerSupabaseClient` أو `verifyOwnerForRoute` حتى تُنفذ Route Handler كاملة تنقل الكوكي ورؤوس عدم التخزين وتُثبت صلاحية المالك عمليًا.

## 4. الفحص النقدي المطلوب

1. اقْرأ `git diff` كاملاً بعد الإنشاء مرة ثانية ولا تكتفِ بالـCI.
2. شغّل `npm ci`، فحص الأنواع و١٦٧ اختبار وحدة، ١٦ خطوة SQL معزولة وثلاثة negative controls، Next build وHTTP smoke (١٢ GET و٦ POST مرفوضة).
3. احمِ المعاينة من أي استيراد جديد لـSupabase، وأثبت أن `src/proxy.ts` لم يتغير.
4. راجع حواف session-refresh/Set-Cookie/cache-control، ولا تسمح بدخول فعلي أو بيانات مالية اعتمادًا على CI المعزول.
5. دوّن أي فجوة أو إصلاح جديد في هذا التقرير و`HANDOFF_LOG`، ثم اعتمد هذه المهمة المحدودة فقط.

## 5. المتبقي بعد H041

`AUTH-01/REAL-INTEGRATION` **متوقفة عند عدم توافر مشروع اختبار Supabase حقيقي**؛ عند توفيره نحتاج login/logout/recovery/callback، جلسات منتهية وتجديد cookie، رفض anon وغير المالك، RLS/RPC HTTP وتدقيق CSRF/cache/redirect، وإثبات رفض أي محاولة قبل Auth. لا بدء دفعات أو نشر أو استخدام مالي حتى ذلك.

**مراجع رسمية:** [Supabase SSR Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&package-manager=npm) و[Next.js server-only](https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning).

## مراجعة نقدية مستقلة بعد الإنشاء — اكتشاف وتصحيح

**المشكلة المكتشفة:** أول نموذج `server.ts` استخدم `cookies().set` وتجاهل `headers` التي يعيدها SDK خلال تحديث الجلسة. إهمال `Cache-Control/Set-Cookie` في تطبيق مالي يمكن أن يسبب جلسة تنتهي خطأً أو يُخفي مخاطر cache عند ربط API لاحقًا.

**الإصلاح الفعلي:** استُبدل بعميل `createRouteHandlerSupabaseClient(request, response)` الذي يُلزم المنشئ بتمرير كائن الاستجابة، ويطبّق كل تغييرات `request.cookies` و`response.cookies` و`response.headers`. صار فحص المالك `verifyOwnerForRoute(supabase)` يستقبل العميل المرتبط بالطلب ولا يُنشئ عميلًا عالميًا أو يتجاهل headers. أُضيفت assertions إلى فحص H041 لضمان وجود propagation وعدم تفعيل أي مسار.

**القيد:** نجاح هذا الإصلاح في TypeScript/static smoke لا يثبت صحته أمام Supabase Auth الحقيقي؛ اختبار فعلي للجلسات والكوكي والمالك في بيئة منفصلة **ما زال شرطًا صريحًا** قبل تفعيل أي Route Handler أو دمج مرحلة auth الحية.
