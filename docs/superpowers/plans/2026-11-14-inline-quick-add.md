# إضافة فورية من خانات الاختيار — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إضافة عربية أو مقاول جديد فورًا من خانة الاختيار في شاشة "تسجيل الشغل والدفعات" الحقيقية، بحفظ دائم عبر مسار `app_op_*` الحالي، ثم استخدامه مباشرة في النموذج.

**Architecture:** مكون بحث `SearchableChoice` يأخذ زر إضافة اختياري؛ نافذتان صغيرتان (سجل واحد / حساب دفعة) تعملان بنفس دالة `write` الحالية. لا SQL ولا معادلات جديدة.

**Tech Stack:** React client components، vitest (دوال نقية + `renderToStaticMarkup`)، Playwright workspace fixture (توجيه شبكة وهمي).

**Spec:** `docs/superpowers/specs/2026-11-14-inline-quick-add-design.md`

## Global Constraints

- الحفظ عبر `write("vehicle.create"|"contractor.create"|"vehicle.account.ensure")` فقط؛ لا حفظ أو حساب من المتصفح.
- معرفات السجلات الجديدة تُولَّد في الpayload قبل الإرسال (`"VEH-"+crypto.randomUUID()` / `"CTR-"+…` بنمط `master-data-entry.tsx`) — هذا هو ما يتيح تحديدها بعد النجاح دون تغيير توقيع `write`.
- التطبيع للمنع التكراري = `normalizeMasterKey` من `../master-data/master-data-validation` (نفسه المستخدم في شاشة البيانات الأساسية؛ يغطي الأرقام والمسافات وحالة الأحرف فقط، ولا يوحّد الهمزات — لا تُدّعى سياسة لغوية إضافية).
- حالة `busy` تعطل كل أزرار النافذة؛ النافذة تفشل بنص واضح عند رفض الحفظ وتبقى مفتوحة.
- كل نصوص الواجهة عربية. أزرار الفتح والإلغاء `type="button"`؛ زر حفظ النافذة `type="submit"` داخل form مستقل خاص بها لدعم Enter، بلا تداخل مع form النقلة أو الدفعة.
- هدف الحجم ٢٠٠–٣٠٠ سطر للملف اليدوي؛ لا ملف يتجاوز ٤٠٠ سطر.

## Review Focus

1. **نقر مزدوج على زر حفظ النافذة** → لا يصنع عربية/مقاول مكرر: زر النافذة يُعطل أول ما يدخل الحفظ، وpayload id ثابت. اختبار: `quick-add-double-submit.spec.ts` خطوة النقر السريع مثل اختبار retry القائم.
2. **لوحة مكررة بالأرقام العربية أو فرق المسافات (٥٦٧٨ مقابل 5678)** → الواجهة تمنع برسالة واضحة ولا تُرسل طلبًا. اختبار: `quick-add-validation.test.ts`.
3. **رفض الخادم (مثل لوحة مكررة فاتت الفحص المحلي)** → النافذة تبقى مفتوحة برسالة فشل ولا تُحدد قيمة في الخانة. اختبار: Playwright برد 409.
4. **حساب دفعة لزوج موجود أصلًا** → طلب `vehicle.account.ensure` واحد فقط، بلا زوج تاني (الensure أصلًا idempotent). اختبار: Playwright يعدّ الطلبات.
5. **إغلاق النافذة بـEscape** يرجع التركيز ولا يترك القيم مكتوبة. موروث من `useModalFocus` — اختبار Playwright خطوة Escape.

---

### Task 1: دوال التحقق النقية

**Files:**
- Create: `apps/web/src/features/ledger/quick-add-validation.ts`
- Test: `apps/web/e2e/quick-add-validation.test.ts`

**Interfaces:**
- Consumes: `normalizeMasterKey(value: string): string` من `../master-data/master-data-validation`.
- Produces:
  - `validateQuickPlate(plate: string, activePlates: readonly string[]): string | null` — يرجع `null` عند الصلاحية، وإلا رسالة الخطأ.
  - `validateQuickContractorName(name: string, activeNames: readonly string[]): string | null`.

الرسائل المعتمدة حرفيًا:
- لوحة فاضية: `"أدخل رقم اللوحة."`
- لوحة مكررة: `"اللوحة مسجلة بالفعل. اخترها من القائمة بدل إضافتها مرتين."`
- اسم فاضي: `"أدخل اسم المقاول."`
- اسم مكرر: `"الاسم مسجل بالفعل. اختره من القائمة بدل إضافته مرتين."`

- [ ] **Step 1: اكتب الاختبار الفاشل** — حالات: لوحة فاضية؛ تطابق مُطبّع (`"د هـ و ٥٦٧٨"` مقابل `"د هـ و 5678"`)؛ لوحة مختلفة → null؛ اسم فاضي؛ تطابق `"مصنع  النور"` مقابل `"مصنع النور"`؛ تشابه جزئي (`"مصنع النور"` مقابل `"مصنع النور للأعمال"`) → null.
- [ ] **Step 2: شغّل** `npm run test:web` → FAIL (الوحدة غير موجودة).
- [ ] **Step 3: نفّذ الدالتين** بجسم من سطر لكل حالة على `normalizeMasterKey`.
- [ ] **Step 4: شغّل** `npm run test:web` → PASS.
- [ ] **Step 5:** `git add -A && git commit -m "feat(ledger): quick-add duplicate validation"`

### Task 2: نافذة السجل الواحد + زر الإضافة في خانة البحث

**Files:**
- Create: `apps/web/src/features/ledger/quick-record-modal.tsx`
- Modify: `apps/web/src/features/ledger/searchable-choice.tsx`
- Test: `apps/web/e2e/quick-record-modal.test.tsx`

**Interfaces:**
- Produces (`quick-record-modal.tsx`):
  ```tsx
  export type QuickRecordKind = "vehicle" | "contractor";
  export function QuickRecordModal(props: {
    kind: QuickRecordKind; open: boolean; busy: boolean;
    existing: readonly string[];                     // اللوحات أو الأسماء النشطة
    onClose: () => void;
    onCreate: (input: { plate: string; driver: string; name: string }) => Promise<string | null>;
    onCreated: (id: string) => void;
  }): ReactNode | null
  ```
  المودال يستدعي دالة التحقق المناسبة لنوعه قبل `onCreate`؛ عند `null` من `onCreate` (فشل خادم) يعرض
  `"لم تتم الإضافة. راجع رسالة النظام أعلى الصفحة."` في `<p role="alert">` ويبقى مفتوحًا؛ عند النجاح
  يستدعي `onCreated(id)` ثم `onClose()` ويصفّر حقوله.
- Produces (`searchable-choice.tsx`): props اختيارية `onAdd?: () => void` و `addLabel?: string` —
  عند وجود `onAdd` يُعرض `<button type="button" id={id+"-add"}>{addLabel}</button>` بعد حقل البحث.
- Consumes: `useModalFocus` من `../../components/use-modal-focus` (حصر الحركة والهروب بـEscape).

بنية النافذة: `role="dialog" aria-modal="true" aria-label="إضافة عربية سريعة" / "إضافة مقاول سريع"`؛
عنوان `➕ إضافة عربية جديدة` / `➕ إضافة مقاول جديد`؛ حقول: اللوحة (مطلوب) + السائق (اختياري) أو الاسم فقط؛
زرّا `إلغاء` و`حفظ وإضافة` (تعطيل أثناء `busy` أو أثناء انتظار الطلب المحلي).

- [ ] **Step 1: اكتب الاختبار الفاشل** (`renderToStaticMarkup`): نافذة مغلقة ترجع فارغًا؛ مفتوحة تعرض role=dialog وحقل اللوحة وزر الحفظ المعطل؛ `SearchableChoice` مع `onAdd` يعرض الزر، وبدونه لا يعرضه.
- [ ] **Step 2:** `npm run test:web` → FAIL.
- [ ] **Step 3: نفّذ** المكونين (أنماط inline بنفس أسلوب `transaction-entry.tsx`).
- [ ] **Step 4:** `npm run test:web` → PASS.
- [ ] **Step 5:** `git commit -m "feat(ledger): quick record modal and add affordance in SearchableChoice"`

### Task 3: التوصيل في تسجيل النقلة

**Files:**
- Modify: `apps/web/src/features/ledger/transaction-entry.tsx`
- Test: `e2e/workspace/quick-add.spec.ts`

**Interfaces:**
- Consumes: `QuickRecordModal`، `validateQuickPlate`، `validateQuickContractorName`، `write` من props.
- Produces (داخل `TransactionEntry`):
  ```tsx
  const [quickModal, setQuickModal] = useState<null | "vehicle" | "contractor" | "payment">(null);
  async function quickCreateVehicle(plate: string, driver: string): Promise<string | null>
  // payload: { id: "VEH-"+crypto.randomUUID(), plate_number: plate, driver_name: driver || null }
  // write("vehicle.create", payload) → true ? payload.id : null
  async function quickCreateContractor(name: string): Promise<string | null>
  // payload: { id: "CTR-"+crypto.randomUUID(), name, start_mode: "DETAILS" } → write("contractor.create", …)
  ```
  - خانة العربية: `onAdd={() => setQuickModal("vehicle")}` و`addLabel="+ عربية جديدة"`؛ `onCreated={(id)=>setTripVehicle(id)}`.
  - خانة المقاول الطرف: `onAdd={() => setQuickModal("contractor")}` و`addLabel="+ مقاول جديد"`؛ `onCreated={(id)=>setTripCounterparty(id)}`.
  - القوائم الممررة للنافذة: `vehicles.filter(v=>!v.is_archived).map(v=>v.plate_number)` و
    `contractors.filter(c=>!c.is_archived).map(c=>c.name)` (بمن فيهم أحمد الأساسي، للمنع فقط).

**Playwright fixture:** انسخ نمط `workspace.spec.ts`؛ اجعل `vehicles`/`contractors` مصفوفات متغيرة تُلحق عند
نجاح `vehicle.create`/`contractor.create` في مسار operations، حتى يظهر السجل الجديد بعد refresh التلقائي.

- [ ] **Step 1: اكتب الاختبار الفاشل** — ثلاث حالات:
  1. إضافة عربية من نقلة: يفتح النافذة، لوحة `"د هـ و 1234"` وسائق `"سائق تجربة"` → طلب `vehicle.create` بالحقلين → بعد الحفظ `#real-trip-vehicle` قيمته معرف الجديد.
  2. إضافة مقاول من نقلة: اسم `"مقاول تجربة"` → طلب `contractor.create` → `#real-trip-counterparty` قيمته معرف الجديد.
  3. رفض خادم (fulfill 409): النافذة تبقى ظاهرة ورسالة `لم تتم الإضافة` ظاهرة، والselect بلا تغيير.
- [ ] **Step 2:** `npx playwright test e2e/workspace/quick-add.spec.ts` → FAIL.
- [ ] **Step 3: نفّذ** التوصيل أعلاه.
- [ ] **Step 4:** `npx playwright test e2e/workspace/quick-add.spec.ts` → PASS.
- [ ] **Step 5:** `git commit -m "feat(ledger): inline vehicle and contractor creation in trip entry"`

### Task 4: حساب الدفعة الجديد (vehicle + contractor + ensure)

**Files:**
- Create: `apps/web/src/features/ledger/payment-account-modal.tsx`
- Modify: `apps/web/src/features/ledger/transaction-entry.tsx`
- Test: `e2e/workspace/quick-add.spec.ts` (توسعة)

**Interfaces:**
- Produces (`payment-account-modal.tsx`):
  ```tsx
  export function PaymentAccountModal(props: {
    open: boolean; busy: boolean;
    vehicles: readonly { id: string; plate_number: string }[];
    contractors: readonly { id: string; name: string }[];
    activePlates: readonly string[];
    activeContractorNames: readonly string[];
    onClose: () => void;
    createVehicle: (plate: string, driver: string) => Promise<string | null>;
    createContractor: (name: string) => Promise<string | null>;
    ensureAccount: (vehicleId: string, contractorId: string) => Promise<boolean>;
    onAccountReady: (vehicleId: string, contractorId: string) => void;
  }): ReactNode | null
  ```
  الحقول: اختيار عربية من القائمة أو لوحة جديدة (+سائق اختياري)؛ اختيار مقاول من القائمة أو اسم جديد.
  التسلسل عند الحفظ: إنشاء الناقص فقط → `ensureAccount(vehicleId, contractorId)` → عند `true`
  `onAccountReady` وإغلاق؛ فشل أي خطوة يبقي النافذة برسالة `لم يتم فتح الحساب. راجع رسالة النظام أعلى الصفحة.`
  تحقق قبل الإرسال: `validateQuickPlate`/`validateQuickContractorName` عند إدخال جديد، و
  `"اختر عربية أو أدخل لوحة جديدة."` إذا الاتنين فاضيين، و`"اختر مقاولًا أو أدخل اسمًا جديدًا."` بالمثل.
- في `TransactionEntry`: زر `+ حساب جديد` تحت select الدفعة يفتح `PaymentAccountModal`؛
  `ensureAccount` = `write("vehicle.account.ensure", { vehicle_id, contractor_id })`؛
  `onAccountReady={(v,c)=>setPaymentAccount(v+"|"+c)}`.

- [ ] **Step 1: وسّع الاختبار** — حالة ٤: زوج جداد (لوحة `"ج س ر 7777"` واسم `"مقاول الدفعة"`) →
  ثلاثة طلبات بالترتيب `vehicle.create` ثم `contractor.create` ثم `vehicle.account.ensure` →
  select الدفعة قيمته `"<VEH-…>|<CTR-…>"`. حالة ٥: زوج موجود من القائمتين → طلب ensure واحد فقط (عدّ الطلبات).
  حالة ٦: Escape يغلق النافذة بلا أي طلب.
- [ ] **Step 2:** `npx playwright test e2e/workspace/quick-add.spec.ts` → FAIL.
- [ ] **Step 3: نفّذ** `payment-account-modal.tsx` والتوصيل.
- [ ] **Step 4:** `npx playwright test e2e/workspace/quick-add.spec.ts` → PASS (٦ اختبارات).
- [ ] **Step 5:** `git commit -m "feat(ledger): inline payment account creation with ensure"`

### Task 5: نقر مزدوج + تنظيف التعليق القديم + توثيق

**Files:**
- Test: `e2e/workspace/quick-add.spec.ts` (توسعة)
- Modify: `apps/web/src/app/api/ledger/operations/route.ts` (تعليق فقط)
- Modify: `docs/STATUS.md`، `docs/HANDOFF_LOG.md`، `docs/CODE_MAP.md` (سجلات المهمة)
- Test: `apps/web/e2e/quick-record-modal.test.tsx` (توسعة بسيطة إن لزم)

- [ ] **Step 1: اختبار النقر المزدوج** — حالة ٧: فتح نافذة العربية ثم نقرتا `حفظ وإضافة` متتاليتان
  (نفس أسلوب `evaluate(b=>{b.click();b.click();})` في `workspace.spec.ts`) → طلب `vehicle.create` واحد فقط.
- [ ] **Step 2:** `npx playwright test e2e/workspace/quick-add.spec.ts` → PASS.
- [ ] **Step 3: صحّح التعليق القديم** في `route.ts` أسطر ١٥–١٨ إلى:
  `POST on /api/ledger/operations is allowlisted in proxy.ts; every write is an audited DB RPC requiring owner JWT + RLS.`
  (لا تغيير سلوك).
- [ ] **Step 4: الفحص الكامل على آخر commit:** `npm run typecheck` (exit 0) + `npm run test:web` (91+ PASS) +
  `npx playwright test --config=playwright.workspace.config.ts` (كل الاختبارات PASS) — وثّق الأرقام في PR.
- [ ] **Step 5: وثّق** في `STATUS` (إدخال بتاريخ اليوم أعلى الملف) و`HANDOFF_LOG` و`CODE_MAP`
  (الملفات الثلاثة الجديدة)، ونص PR: النطاق، حالات القبول (المهام ١–٥)، الأوامر ونتائجها،
  **غير مختبر:** حفظ حي على Supabase (بعتمد على إثبات Live Write المنفصل)، والأجهزة الحقيقية.
- [ ] **Step 6:** `git push -u origin feat/inline-quick-add-20261114` وافتح PR إلى `main` بموجب قاعدة H038.
