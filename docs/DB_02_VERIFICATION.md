# تقرير التحقق والتسليم لمهمة: DB-02-SCHEMA

- **المهمة:** `DB-02-SCHEMA` — تصحيح مراجعة DB-01-PREP وتنفيذ أساس قاعدة البيانات محليًا.
- **التاريخ:** ٤ نوفمبر ٢٠٢٦.
- **المنفذ:** Antigravity.
- **المراجع / المخطط:** المساعد المنسق.
- **الحالة:** **تحتاج مراجعة المساعد** (إصلاحات التصميم المعتمدة، إنشاء migrations أساس القاعدة، وجناح اختبارات SQL).

---

## ١. ملخص معالجة ملاحظات مراجعة DB-01-PREP

تمت معالجة كافة ملاحظات المراجعة وتصحيحها في وثائق التصميم وملفات الـ Migrations الفعلية:

| م | الملاحظة من المراجعة | كيف عولجت في DB-02-SCHEMA | مسار الدليل في المستودع |
|---|---|---|---|
| ١ | **حذف سياسة "Authenticated user full access" العامة** | حُذفت السياسة تمامًا. استُبدلت بنظام المالك المحمي `app_owner` ودالة `public.app_is_owner()` التي تفحص مطابقة `auth.uid()` الصريحة للمالك؛ ويُمنع أي مستخدم مسجل آخر من قراءة أو كتابة أي بيانات (Fail-Closed). | [`supabase/migrations/20261104200000_auth_owner_and_security.sql`](../supabase/migrations/20261104200000_auth_owner_and_security.sql) و[`docs/DATA_MODEL.md`](DATA_MODEL.md#١-كيان-المالك-المحمي-app_owner--أساس-الصلاحيات) |
| ٢ | **حظر الكتابة المباشرة للجداول من العميل** | أُغلقت عمليات `INSERT, UPDATE, DELETE` المباشرة بسياسات `with check (false)` و`using (false)` على كافة جداول البيانات؛ التعديلات المستقبلية ستمر حصرًا عبر دوال RPC ذات صلاحيات محددة. | [`supabase/migrations/20261104200001_core_entities_and_accounts.sql`](../supabase/migrations/20261104200001_core_entities_and_accounts.sql) و[`docs/ARCHITECTURE.md`](ARCHITECTURE.md#٦-الأمان-وعزل-الأسرار-security--secrets-isolation) |
| ٣ | **حماية دوال `SECURITY DEFINER`** | تم إلزام كافة دوال `SECURITY DEFINER` بضبط مسار آمن `SET search_path = pg_catalog, public, auth;` وسحب صلاحية `EXECUTE` من `PUBLIC`. | [`supabase/migrations/20261104200000_auth_owner_and_security.sql`](../supabase/migrations/20261104200000_auth_owner_and_security.sql) |
| ٤ | **تصحيح معادلة تعديل الدفعة في الوثائق** | حُذفت معادلة إضافة `old_amount` غير المشروطة. تم توثيق القاعدة الصحيحة: استبعاد السجل القديم من حسابه الأصلي وفقط في التواريخ التي كان مخصومًا فيها ($t \ge \text{old\_date}$)؛ مع إضافة مثال الرفض الصارم عند نقل تاريخ دفعة إلى ما قبل تاريخ الشغل. | [`docs/DATA_MODEL.md`](DATA_MODEL.md#تصحيح-عقد-تعديل-الدفعة-documentation-fix) |
| ٥ | **إلغاء حذف مفاتيح منع التكرار بعد ٧ أيام** | حُذفت سياسة الحذف التلقائي بعد ٧ أيام؛ مفاتيح العمليات المالية المكتملة تُحفظ دائمًا لضمان عدم تكرار قيد مالي عند وصول طلب قديم متأخرًا. | [`supabase/migrations/20261104200002_audit_and_idempotency.sql`](../supabase/migrations/20261104200002_audit_and_idempotency.sql) و[`docs/DATA_MODEL.md`](DATA_MODEL.md#٧-كيان-معرفات-محاولات-الحفظ-ومنع-التكرار-idempotency_keys) |
| ٦ | **تصحيح دقة ونطاق الأنواع بين DB وTS** | تم توضيح حدود `bigint` في PostgreSQL ($\pm 9.22 \times 10^{18}$) مقابل `BigInt` في JS، والتأكيد على نقل كافة المبالغ والأرصدة في JSON كنصوص (`string`) لتجنب فقدان الدقة في المتصفح عند تجاوز `Number.MAX_SAFE_INTEGER`، وفحص دقة الكسور بالـ Regex قبل SQL لمنع التقريب الصامت لـ `numeric`. | [`docs/DATA_MODEL.md`](DATA_MODEL.md#٣-دقة-الحسابات-وحدود-النطاقات-بين-postgresql-وtypescript) |
| ٧ | **الربط المركب لافتتاحي العربية بـ `vehicle_accounts`** | أُضيف مفتاح خارجي مركب `foreign key (vehicle_id, contractor_id) references public.vehicle_accounts(vehicle_id, contractor_id)` لمنع إنشاء افتتاحي لحساب عربية غير موجود. | [`supabase/migrations/20261104200001_core_entities_and_accounts.sql`](../supabase/migrations/20261104200001_core_entities_and_accounts.sql) |
| ٨ | **استكمال حقول إلغاء الافتتاحي والفهارس الجزئية** | أُضيفت حقول `is_cancelled` و`cancel_reason` و`cancelled_at` مع فهارس فريدة تطبق فقط على الأرصدة النشطة (`where not is_cancelled`). | [`supabase/migrations/20261104200001_core_entities_and_accounts.sql`](../supabase/migrations/20261104200001_core_entities_and_accounts.sql) |
| ٩ | **الإنشاء الآمن المتزامن لحساب العربية** | توثيق نمط الإنشاء الآمن `INSERT ... ON CONFLICT (vehicle_id, contractor_id) DO NOTHING` لمنع تصادم الطلبات المتزامنة. | [`docs/DATA_MODEL.md`](DATA_MODEL.md#٤-كيان-حساب-العربية-لدى-المقاول-المسؤول-vehicle_accounts) |
| ١٠ | **حماية المقاول الأساسي** | إضافة قيد تحقق يمنع أرشفة المقاول الأساسي `check (not (is_primary and is_archived))`، وقيد تفرد يضمن وجود مقاول أساسي واحد فقط. | [`supabase/migrations/20261104200001_core_entities_and_accounts.sql`](../supabase/migrations/20261104200001_core_entities_and_accounts.sql) |
| ١١ | **إلغاء حظر تشابه أسماء المقاولين** | أُزيل قيد التفرد التعسفي على الاسم؛ واستُبدل بفهرس بحث سريع مع توصية بعرض تحذير في الواجهة إذا تطابق الاسم دون منع الحفظ. | [`supabase/migrations/20261104200001_core_entities_and_accounts.sql`](../supabase/migrations/20261104200001_core_entities_and_accounts.sql) |
| ١٢ | **تطبيع لوحات العربيات** | استخدام دالة تطبيع موحدة تحذف المسافات المكررة وتضبط الأحرف في الفهرس الفريد للوحات النشطة. | [`supabase/migrations/20261104200001_core_entities_and_accounts.sql`](../supabase/migrations/20261104200001_core_entities_and_accounts.sql) |
| ١٣ | **تصحيح عبارة DemoStoreProvider** | توضيح أن `DemoStoreProvider` لا يُستبدل؛ بل تظل المعاينة `/demo/*` قائمة ومستقلة بالذاكرة، ويكون ربط قاعدة البيانات في مسارات محمية مستقلة. | [`docs/DATA_MODEL.md`](DATA_MODEL.md#٦-ربط-المعاينة-والتطبيق-الحقيقي-demo-isolation) و[`docs/ARCHITECTURE.md`](ARCHITECTURE.md#٣-بنية-الحفظ-الدائم-وعزل-بيئة-المعاينة-persistence-vs-demo-isolation) |
| ١٤ | **تصحيح ادعاءات DB-01-PREP** | تصحيح وصف "معتمدة للتنفيذ" إلى حالتها الحقيقية؛ وتوضيح أن أمثلة SQL كانت نصوصًا توثيقية داخل Markdown ولم تُنشأ أو تُطبق كـ migrations إلا في DB-02-SCHEMA. | [`docs/DB_01_PREP_REPORT.md`](DB_01_PREP_REPORT.md) |
| ١٥ | **تصحيح اتساق التقارير متعددة الصفحات** | بيان أن `REPEATABLE READ` لا يضمن وحده اتساق طلبات التصفح المنفصلة عبر HTTP؛ ويلزم مؤشر لقطة زمني (Snapshot Token) في مهمة الكشوف DB-05. | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md#٧-اتساق-التقارير-وتعدد-الصفحات-pagination-consistency) |

---

## ٢. الملفات المضافة والمعدلة

### أ) ملفات الـ Migrations المنشأة (`supabase/migrations/`):
1. [`supabase/migrations/20261104200000_auth_owner_and_security.sql`](../supabase/migrations/20261104200000_auth_owner_and_security.sql):
   - جدول `app_owner` بصف وحيد (`id = 1`).
   - دالة `public.app_get_owner_id()` ودالة `public.app_is_owner()`.
   - دالة التهيئة الإدارية المحمية `public.app_set_initial_owner(uuid)` المسحوبة الصلاحيات من العميل.
   - سياسات RLS المحكمة لحظر أي وصول لغير المالك.
2. [`supabase/migrations/20261104200001_core_entities_and_accounts.sql`](../supabase/migrations/20261104200001_core_entities_and_accounts.sql):
   - جداول: `contractors`, `vehicles`, `vehicle_accounts`, `opening_balances`, `business_settings`.
   - قيود الحماية: حماية المقاول الأساسي، منع تعدد الأساسي، تطبيع اللوحات، والعلاقة المركبة لافتتاحي العربية.
   - سياسات RLS: القراءة متاحة للمالك فقط (`SELECT`)، والكتابة المباشرة من العميل محظورة كليًا (`INSERT/UPDATE/DELETE WITH CHECK (false)`).
3. [`supabase/migrations/20261104200002_audit_and_idempotency.sql`](../supabase/migrations/20261104200002_audit_and_idempotency.sql):
   - جداول: `audit_log` (سجل تدقيق رقابي تراكمي لا يقبل التعديل)، و`idempotency_keys` (احتفاظ دائم بمفاتيح العمليات وبصمة المدخلات).
   - سياسات RLS: القراءة للمالك فقط، ومنع التعديل أو الحذف المباشر من العميل.

### ب) ملفات الاختبارات المنشأة:
- [`supabase/tests/01_db_02_schema_verification.sql`](../supabase/tests/01_db_02_schema_verification.sql):
  - جناح اختبارات SQL شامل يغطي ١٢ حالة تحقق وقبول عبر الأدوار الثلاثة (`anon`, `authenticated` غير المالك، `authenticated` المالك).

### ج) وثائق التصميم المحدثة:
- [`docs/DATA_MODEL.md`](DATA_MODEL.md): المرجع الأساسي المصحح والمحدث.
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md): تحديث معمارية الأمان والاتساق.
- [`docs/CODE_MAP.md`](CODE_MAP.md): تحديث جدول Migrations لعرض الملفات المنشأة الفعلية.
- [`docs/SUBTASKS.md`](SUBTASKS.md): تحديث حالة بطاقة `DB-02-SCHEMA`.
- [`docs/TASKS.md`](TASKS.md): تحديث حالة المهمة الأم T04.
- [`docs/STATUS.md`](STATUS.md): تحديث موجز الحالة لجلسة H036.
- [`docs/HANDOFF_LOG.md`](HANDOFF_LOG.md): توثيق تسليم جلسة H036.
- [`docs/DB_01_PREP_REPORT.md`](DB_01_PREP_REPORT.md): إضافة حاشية توثيقية لتصحيحات المراجعة.

---

## ٣. مصفوفة الصلاحيات الشاملة (Permissions Matrix)

| الجدول / الكيان | دور المجهول (`anon`) | دور مستخدم مسجل غير المالك (`authenticated non-owner`) | دور المالك المعتمد (`authenticated owner`) | الكتابة المباشرة من العميل (`INSERT/UPDATE/DELETE`) | مسار التعديل المصرح به |
|---|---|---|---|---|---|
| `app_owner` | محظور (0 صفوف) | محظور (0 صفوف) | قراءة فقط (`SELECT`) | **محظور كليًا** للجميع | إجراء إداري داخلي عبر ترحيل/مدير القاعدة |
| `contractors` | محظور (0 صفوف) | محظور (0 صفوف) | قراءة فقط (`SELECT`) | **محظور كليًا** من العميل | دوال RPC محمية للخادم مستقبلاً |
| `vehicles` | محظور (0 صفوف) | محظور (0 صفوف) | قراءة فقط (`SELECT`) | **محظور كليًا** من العميل | دوال RPC محمية للخادم مستقبلاً |
| `vehicle_accounts` | محظور (0 صفوف) | محظور (0 صفوف) | قراءة فقط (`SELECT`) | **محظور كليًا** من العميل | تلقائيًا مع النقلة/الدفعة عبر RPC |
| `opening_balances` | محظور (0 صفوف) | محظور (0 صفوف) | قراءة فقط (`SELECT`) | **محظور كليًا** من العميل | دوال RPC محمية للتحقق والتدقيق |
| `business_settings` | محظور (0 صفوف) | محظور (0 صفوف) | قراءة فقط (`SELECT`) | **محظور كليًا** من العميل | دوال RPC محمية للمالك فقط |
| `audit_log` | محظور (0 صفوف) | محظور (0 صفوف) | قراءة فقط (`SELECT`) | **محظور كليًا** للجميع | دوال الخادم المعتمدة (`SECURITY DEFINER`) فقط |
| `idempotency_keys` | محظور (0 صفوف) | محظور (0 صفوف) | قراءة مفاتيحه فقط | **محظور كليًا** من العميل | إدارة داخلية تلقائية ضمن معاملات RPC |

---

## ٤. فحص البيئة والعوائق التشغيلية

- **فحص بيئة النظام المحلي (Windows):**
  - تم فحص وجود أداة `supabase CLI`: غير مثبتة على مسار النظام العام.
  - تم فحص وجود `docker`: غير مثبت على الجهاز (`The term 'docker' is not recognized`).
  - تم فحص وجود خدمة محرك `PostgreSQL` محلية: لا توجد خدمة PostgreSQL مثبتة أو تعمل محليًا.
- **التزام عدم التزييف (Adherence to Guidelines):**
  - طبقًا لتوجيهات المهمة الصارمة: *"إذا كانت بيئة التشغيل غير متاحة: أنجز الملفات الممكنة، وسجل العائق وأمر التشغيل المطلوب. لا تستبدل اختبار PostgreSQL بمحاكاة SQLite، ولا تدّع نجاح التطبيق الفعلي."*
  - لم يتم استبدال محرك PostgreSQL بمحاكاة SQLite، ولم ندّعِ تشغيل الاختبارات ضد خادم حي على هذا الجهاز لغياب المحرك.
- **أوامر التشغيل المعتمدة عند توفر البيئة أو تشغيل الحاوية:**
  ```powershell
  # ١. في حال تثبيت Docker وSupabase CLI:
  supabase init
  supabase start
  supabase db reset
  supabase test db

  # ٢. في حال توفر خادم PostgreSQL محلي أو حاوية اختبار مخصصة:
  psql -h localhost -U postgres -d test_ledger -f supabase/migrations/20261104200000_auth_owner_and_security.sql
  psql -h localhost -U postgres -d test_ledger -f supabase/migrations/20261104200001_core_entities_and_accounts.sql
  psql -h localhost -U postgres -d test_ledger -f supabase/migrations/20261104200002_audit_and_idempotency.sql
  psql -h localhost -U postgres -d test_ledger -f supabase/tests/01_db_02_schema_verification.sql
  ```

---

## ٥. حالات التحقق الـ ١٢ المشمولة بجناح الاختبارات (`01_db_02_schema_verification.sql`)

صُمم جناح الاختبارات في [`supabase/tests/01_db_02_schema_verification.sql`](../supabase/tests/01_db_02_schema_verification.sql) ليتحقق بدقة حاسمة من الحالات التالية:
1. **تطبيق migrations بنجاح** على قاعدة بيانات نظيفة دون أخطاء بناء أو تضارب مفاتيح.
2. **التهيئة الأحادية للمالك:** نجاح ضبط المالك لمرة واحدة، وفشل أي محاولة ثانية لضبطه.
3. **منع تعدد المقاول الأساسي:** إدراج مقاول أساسي ثانٍ يفشل فورًا بخرق قيد التفرد الجزئي.
4. **حماية المقاول الأساسي:** محاولة أرشفة المقاول الأساسي تفشل بخرق قيد التحقق `chk_primary_cannot_be_archived`.
5. **تطبيع وفحص لوحات العربيات:** إدراج عربية نشطة بنفس اللوحة بعد ضبط المسافات يفشل بخرق قيد التفرد.
6. **العلاقة المركبة للافتتاحي:** إدراج افتتاحي عربية لحساب غير مسجل في `vehicle_accounts` يفشل بخرق المفتاح الخارجي المركب.
7. **منع تكرار الافتتاحي النشط:** محاولة إدخال افتتاحي نشط ثانٍ لنفس الحساب تفشل بخرق الفهرس الفريد الجزئي.
8. **استبدال الافتتاحي الملغى:** وسم الافتتاحي الأول بـ `is_cancelled = true` يتيح إدخال افتتاحي جديد مصحح لنفس الحساب بنجاح.
9. **حفظ الأعداد الكبيرة دون فقد دقة:** حفظ رصيد قرشي كبير يتجاوز `Number.MAX_SAFE_INTEGER` ($10^{17}$) داخل `bigint` بنجاح وتطابق تام.
10. **حظر دور `anon`:** فحص استعلام `SELECT` من دور `anon` يعيد 0 صفوف، وفحص أي إدراج مباشر يفشل.
11. **حظر دور `authenticated` غير المالك:** مستخدم مسجل بهوية مختلفة يعيد 0 صفوف، ومحاولته تعيين نفسه مالكًا تفشل بـ `permission denied`.
12. **صلاحيات المالك المعتمد وحظر الكتابة المباشرة:** المالك يستطيع القراءة فقط، بينما أي محاولة مباشرة من العميل لإجراء `INSERT`, `UPDATE`, `DELETE` على جداول البيانات أو `audit_log` أو `idempotency_keys` تفشل فورًا برفض RLS.

---

## ٦. ما لم يُختبر وحدود العمل

1. لم تُشغل اختبارات SQL ضد خادم PostgreSQL حي لعدم توفر Docker أو خدمة PostgreSQL محلية على جهاز الويندوز؛ وقد تم توثيق أوامر الاختبار والملفات بدقة كاملة.
2. لم تُنفذ جداول وعمليات النقلات ومصروفاتها (مؤجلة لمهمة `DB-03-TRIPS`).
3. لم تُنفذ جداول وعمليات الدفعات وفحص الرصيد المزدوج D13-B (مؤجلة لمهمة `DB-04-PAYMENTS`).
4. لم تُنفذ شاشات المصادقة بالواجهة أو وسيط الحماية في Next.js (مؤجلة لمهمة `AUTH-01`).
5. لم يُنشأ مشروع Supabase سحابي ولم يتم المساس بالبيئة أو النشر.
6. واجهات المعاينة وحزم المنطق بالذاكرة تعمل كما هي دون أي مساس بكودها.

---

## ٧. القرارات المفتوحة والخطوة التالية المقترحة

- **القرارات المفتوحة:**
  - **D15 (ترتيب نفس اليوم):** هل الشغل يسبق الدفع دائمًا داخل نفس اليوم التقويمي؟ (المقترح الموصى به: نعم؛ معروض على المستخدم).
  - **D16 (فحص المسار البيني الكامل للرصيد):** هل يفحص الخادم كل يوم وسيط لمنع أي هبوط دفتري للرصيد تحت الصفر أم يكتفي بالمعتمد D13-B بفحص تاريخ الدفعة واليوم الحالي؟ (المعتمد D13-B؛ ومقترح D16 معروض على المستخدم).
- **الخطوة التالية المقترحة:**
  - مراجعة المساعد المنسق لملفات الـ Migrations المنشأة وجناح الاختبارات وهذا التقرير.
  - حسم سؤالي D15 وD16 من المستخدم.
  - إصدار تكليف المهمة التالية **`DB-03-TRIPS`** لإنشاء جدول النقلات والعمليات الذرية لحسابها وحفظها وتعديلها وإلغائها بمعرف الطلب ورقم الإصدار.
