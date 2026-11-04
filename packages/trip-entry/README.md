# محرك حالة تسجيل النقلات والبيانات المشتركة الاختيارية (`ENTRY-01`)

حزمة TypeScript نقية (`immutable`) لإدارة حالة جلسة إدخال النقلات، والمسودة المشتركة الاختيارية (`sharedDraft`)، واللقطة المطبقة (`appliedShared`)، ومسودة النقلة الحالية (`tripDraft`).

## 1. عقد الاستخدام والوظائف المصدّرة

* **`createEntryState(sessionDate: string): EntryState`**
  * ينشئ حالة جلسة جديدة بتاريخ `sessionDate` صريح من المستدعي.
  * تكون `appliedShared: null`، والتسجيل المباشر في `tripDraft` متاحًا فورًا بنفس التاريخ، مع `sameRate: true`، و`direction: null`، و`counterpartyId: null`، و`vehicleId: null`، وجميع الحقول النصية الأخرى فارغة `""`.
* **`reduceEntry(state: EntryState, action: EntryAction): EntryTransitionResult`**
  * دالة انتقال نقية لا تعدل الكائنات المدخلة (`immutable`)، وتعيد:
    * عند النجاح: `{ ok: true, state: EntryState }`
    * عند محاولة تعديل سعر العربية مباشرةً أثناء تفعيل ربط السعرين (`sameRate: true`): `{ ok: false, error: { code: "VEHICLE_RATE_LINKED" } }` دون تغيير الحالة.

## 2. قواعد الانتقال وحماية المسودة الحالية

1. **الفصل بين `sharedDraft` و`appliedShared` و`tripDraft`:**
   * تحرير `sharedDraft` لا يغير `appliedShared` ولا يمس `tripDraft`.
   * أمر `APPLY_SHARED` يأخذ لقطة مستقلة من `sharedDraft` ويضعها في `appliedShared` للنقلات القادمة فقط، **ولا يكتب فوق أي حقل في `tripDraft` الحالية**.
2. **بدء نقلة جديدة (`START_NEW_TRIP`):**
   * هو الأمر الوحيد الذي يستبدل `tripDraft`؛ فينسخ حقول `appliedShared` (إن وجدت) أو ينشئ مسودة فارغة بتاريخ `sessionDate` (إن كانت `appliedShared === null`)، ويصفّر دائمًا حقول النقلة الخاصة (`vehicleId: null`, `weightTonnes: ""`, `receiptNumber: ""`, `notes: ""`).
3. **تعطيل المشترك (`DISABLE_SHARED`):**
   * يجعل `appliedShared = null` دون المساس بـ `tripDraft` الحالية أو `sharedDraft`، فتبدأ النقلة التالية مباشرةً بلا قيم مشتركة.
4. **ربط السعرين (`sameRate`):**
   * يعمل بشكل مستقل في كل من `sharedDraft` و`tripDraft`.
   * عند `sameRate: true`: تعديل `contractorRateEgp` ينسخ النص نفسه إلى `vehicleRateEgp`، وتعديل `vehicleRateEgp` مباشرةً يُرفض بالخطأ `VEHICLE_RATE_LINKED`.
   * عند فك الربط (`sameRate: false`): تبقى القيمتان كما هما ويُسمح بتعديلهما منفردتين، ولا يُستنتج الربط تلقائيًا إذا تساوت القيمتان نصيًا.
   * عند إعادة الربط (`sameRate: true`): يُنسخ `contractorRateEgp` الحالي فورًا إلى `vehicleRateEgp`.
5. **بدء يوم/جلسة جديدة (`START_NEW_SESSION`):**
   * يحدث `sessionDate`، ويمسح `appliedShared` (`null`)، ويعيد `sharedDraft` فارغة بالتاريخ الجديد (`sameRate: true` والاتجاه والمقاول `null` دون ترحيل أسعار أو طرق من اليوم السابق)، **مع الاحتفاظ بـ `tripDraft` الحالية كاملةً بما فيها تاريخها القديم** لحماية أي عمل غير محفوظ إلى أن يطلب المستخدم `START_NEW_TRIP`.

## 3. حدود المسؤولية (ما لا تفعله هذه الوحدة)

* لا تتحقق من صلاحية الأرقام ماليًا ولا تقرب الكسور ولا تستخدم `bigint` أو `Number` (المدخلات نصوص إدخال خام قد تكون فارغة أو غير مكتملة أثناء الكتابة).
* لا تحسب قيم النقلات أو الإجماليات أو الدفعات أو الأرصدة.
* لا تستنتج `direction` تلقائيًا (يبقى `null` ما لم يُحدده المستخدم صراحةً بـ `"AHMED_SUPPLIES"` أو `"OTHER_SUPPLIES"`).
* لا تحفظ النقلات في قاعدة بيانات أو `localStorage`، ولا تفتح نوافذ تأكيد أو تنبيهات واجهة.

## 4. أوامر التثبيت وفحص الأنواع والاختبارات

تم تثبيت أدوات التطوير والتحقق منها فعليًا داخل المشروع في بيئة Node.js `v22.23.2` وnpm `12.0.2` مع توليد ملف القفل `package-lock.json`:

```bash
# تثبيت الاعتماديات
npm install

# فحص الأنواع الصارم (strict: true و skipLibCheck: false)
npm run typecheck

# تشغيل الاختبارات الحقيقية عبر Vitest (18 حالة اختبار)
npm run test

# الفحص المزدوج الشامل (الأنواع + الاختبارات)
npm run check
```

* **أدوات التطوير المعتمدة للحزمة:** `typescript: "5.4.5"` و `vitest: "5.1.0"` و `@types/node: "22.13.4"` (من نفس الإصدار الرئيسي لبيئة Node، وخالية تمامًا من أي ثغرات أمنية: 0 vulnerabilities).
* **ملاحظة أمنية:** تم فحص الحزمة عبر `npm audit` و`npm ci` وحققت خلوًا تامًا بنسبة 100% من أي ثغرات أمنية مباشرة أو غير مباشرة.
