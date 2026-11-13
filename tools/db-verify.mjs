// BUILD-01 — مشغّل التحقق على قاعدة PostgreSQL معزولة داخل المشروع.
//
// يشغّل الملفات بالترتيب الصارم:
//   00_isolated_harness.sql   (محاكاة بيئة Supabase: أدوار + auth.users + auth.uid)
//   migrations A: 01..04      (الثلاث الأصلية + طبقة تصحيحات المراجعة)
//   01_db_02_schema_verification.sql      (اختبارات المرحلة A)
//   migrations B: 05..06      (أساس العمليات + دوال الكتابة المحمية)
//   02_phase_b_operations_verification.sql (اختبارات المرحلة B)
//   migrations C: 07..09      (جدول النقلات + حسابها + عملياتها)
//   03_phase_c_trips_verification.sql     (اختبارات المرحلة C)
//   migration 10: trip details additive fix (H038)
//   04_phase_c_trip_details_verification.sql (metadata regression tests)
//
// القاعدة في الذاكرة ولا تُكتب على القرص، ولا تتصل بأي خدمة سحابية.
// الخروج برمز 1 عند أي فشل؛ لا يُطبع «نجاح» إلا بعد وصول كل خطوة لنهايتها.
//
// التشغيل:
//   node tools/db-verify.mjs                     — التحقق الكامل (A + B + C)
//   node tools/db-verify.mjs --negative-control  — يزيل حماية TRUNCATE عن قصد،
//        ويتوقع أن تفشل اختبارات A؛ يثبت أنها غير وهمية.
//   node tools/db-verify.mjs --negative-control-b — يعطّل بوابة المالك عن قصد،
//        ويتوقع أن تفشل اختبارات B؛ يثبت أنها تكتشف تسريب صلاحية حقيقي.
//   node tools/db-verify.mjs --negative-control-c — يمنح TRUNCATE على جدول
//        النقلات عن قصد، ويتوقع أن تفشل اختبارات C.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const negativeMode = args.includes('--negative-control') ? 'a'
  : args.includes('--negative-control-b') ? 'b'
  : args.includes('--negative-control-c') ? 'c'
  : null;
const negativeStep = negativeMode === 'a' ? 'tests'
  : negativeMode === 'b' ? 'tests B'
  : negativeMode === 'c' ? 'tests C'
  : null;

// كل طراز يزيل حماية واحدة فقط، قبل جناح الاختبارات المعني مباشرة.
const mutations = {
  tests: 'grant truncate on public.contractors, public.opening_balances to authenticated;',
  'tests B': `
    create or replace function public.app_require_owner()
    returns uuid
    language sql
    security definer
    set search_path = pg_catalog, public, auth
    as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
  `,
  'tests C': 'grant truncate on public.trips to authenticated;',
};

const steps = [
  ['harness', 'supabase/tests/00_isolated_harness.sql', 'تجهيز البيئة المعزولة (أدوار ومحاكاة auth)'],
  ['migration 01', 'supabase/migrations/20261104200000_auth_owner_and_security.sql', 'A: المالك المحمي والدوال'],
  ['migration 02', 'supabase/migrations/20261104200001_core_entities_and_accounts.sql', 'A: الكيانات والحسابات والافتتاحيات'],
  ['migration 03', 'supabase/migrations/20261104200002_audit_and_idempotency.sql', 'A: التدقيق ومنع التكرار'],
  ['migration 04', 'supabase/migrations/20261104200003_db02_review_fixes.sql', 'A: تصحيحات المراجعة'],
  ['tests', 'supabase/tests/01_db_02_schema_verification.sql', 'A: اختبارات القبول والصلاحيات'],
  ['migration 05', 'supabase/migrations/20261104200010_phase_b_foundation.sql', 'B: أساس العمليات المحمية'],
  ['migration 06', 'supabase/migrations/20261104200011_phase_b_operations.sql', 'B: دوال الكتابة المحمية'],
  ['tests B', 'supabase/tests/02_phase_b_operations_verification.sql', 'B: اختبارات العمليات والتراجع'],
  ['migration 07', 'supabase/migrations/20261104200020_phase_c_trips.sql', 'C: جدول النقلات وقيوده وصلاحياته'],
  ['migration 08', 'supabase/migrations/20261104200021_phase_c_trip_math.sql', 'C: حساب النقلة والتحقق الدقيق'],
  ['migration 09', 'supabase/migrations/20261104200022_phase_c_trip_operations.sql', 'C: عمليات النقلات المحمية'],
  ['tests C', 'supabase/tests/03_phase_c_trips_verification.sql', 'C: اختبارات النقلات والحفظ الذري'],
  ['migration 10', 'supabase/migrations/20261104200023_phase_c_trip_details.sql', 'C: حفظ خط السير ورقم الإيصال وإرجاع الملاحظات'],
  ['tests C details', 'supabase/tests/04_phase_c_trip_details_verification.sql', 'C: اختبارات بيانات النقلة والتدقيق وإعادة الطلب'],
  ['tests C security review', 'supabase/tests/05_phase_c_adversarial_review.sql', 'C: مراجعة مستقلة للصلاحيات والإلغاء وإعادة الطلب'],
  ['migration 11', 'supabase/migrations/20261104200030_payments_schema.sql', 'T08.1: جدول الدفعات وعلاقاته دون عمليات الصرف'],
  ['tests payments schema', 'supabase/tests/06_payments_schema_verification.sql', 'T08.1: تحقق العلاقات والدقة والصلاحيات والحركات المحفوظة'],
  ['migration 12', 'supabase/migrations/20261104200031_payment_operations.sql', 'T08.2: عمليات الدفعات مع D15/D16 والحماية المالية'],
  ['tests payment operations', 'supabase/tests/07_payment_operations_verification.sql', 'T08.2: قواعد الحساب التاريخي والعمليات المحمية'],
  ['tests fin01 fin02 acceptance', 'supabase/tests/08_fin01_fin02_operation_verification.sql', 'FIN-01/02: real SQL payment reassignment, audit and rollback'],
  ['tests fin07 numeric parity', 'supabase/tests/08_fin07_numeric_boundaries_verification.sql', 'FIN-07: SQL aggregate and stored bigint limits'],
  ['migration fin04', 'supabase/migrations/20261109210000_fin04_cash_opening_timeline.sql', 'FIN-04: vehicle cash opening/trip transaction timeline'],
  ['tests fin04', 'supabase/tests/09_fin04_cash_opening_timeline_verification.sql', 'FIN-04: SQL reject earlier trip or payment atomically'],
  ['migration fin05', 'supabase/migrations/20261109210010_fin05_payment_period_opening.sql', 'FIN-05: period opening and closing semantics'],
  ['tests fin05', 'supabase/tests/10_fin05_payment_period_opening_verification.sql', 'FIN-05: opening day, historical cutoff and independent current balance'],
  ['migration payment keyset', 'supabase/migrations/20261113110000_payment_history_keyset.sql', 'PRE-LIVE: stable owner-only payment history pagination'],
  ['tests payment keyset', 'supabase/tests/11_payment_history_keyset_verification.sql', 'PRE-LIVE: no skipped payments, unchanged cash balances'],
];

function describe(error) {
  if (!error) return 'unknown error';
  const parts = [error.message ?? String(error)];
  if (error.code) parts.push(`sqlstate=${error.code}`);
  if (error.detail) parts.push(`detail=${error.detail}`);
  if (error.position) parts.push(`position=${error.position}`);
  return parts.join(' | ');
}

// لا نغيّر حجز الذاكرة: وحدة PostgreSQL داخل PGlite تُعلن 2048 صفحة (128MB)
// كحد أدنى ثابت، وأي تقليل يفشل فورًا عند WebAssembly.instantiate().
const db = new PGlite();
let negativeHit = false;

console.log('BUILD-01 — isolated PostgreSQL verification (Phases A + B + C)');
console.log('============================================================');
if (negativeMode) {
  console.log(`NEGATIVE CONTROL mode ${negativeMode}: expecting a deliberate FAILURE at [${negativeStep}].\n`);
}

try {
  const version = await db.query('select version() as v');
  console.log(`engine: ${version.rows[0].v}\n`);
} catch (error) {
  console.error(`FATAL: could not initialise the isolated database: ${describe(error)}`);
  await db.close();
  process.exit(1);
}

for (const [id, relative, label] of steps) {
  if (negativeMode && id === negativeStep) {
    try {
      await db.exec(mutations[negativeStep]);
      negativeHit = true;
      console.log(`NEGATIVE CONTROL: protection removed before [${id}].`);
    } catch (error) {
      console.error(`FATAL: could not apply the negative-control mutation: ${describe(error)}`);
      await db.close();
      process.exit(1);
    }
  }

  const absolute = path.join(root, relative);
  let sql;
  try {
    sql = await readFile(absolute, 'utf8');
  } catch (error) {
    console.error(`FAIL [${id}] cannot read ${relative}: ${describe(error)}`);
    await db.close();
    process.exit(1);
  }

  try {
    await db.exec(sql);
    if (negativeMode && id === negativeStep) {
      console.error('NEGATIVE CONTROL FAILED: the suite PASSED although a protection was removed.');
      await db.close();
      process.exit(1);
    }
    console.log(`PASS [${id}] ${label}`);
  } catch (error) {
    if (negativeMode && id === negativeStep) {
      console.log('EXPECTED FAILURE (negative control):');
      console.log(`      ${describe(error)}`);
      console.log('\nNEGATIVE CONTROL PASSED — the suite genuinely detects a removed protection.');
      await db.close();
      process.exit(0);
    }
    console.error(`FAIL [${id}] ${label}`);
    console.error(`      file: ${relative}`);
    console.error(`      ${describe(error)}`);
    await db.close();
    process.exit(1);
  }
}

if (negativeMode) {
  console.error('NEGATIVE CONTROL FAILED: the target test step was never executed.');
  await db.close();
  process.exit(1);
}

// فحص إضافي: عدد الجداول والصفوف والدوال، كدليل ملموس لا كادعاء.
try {
  const counts = await db.query(`
    select
      (select count(*) from public.contractors)        as contractors,
      (select count(*) from public.vehicles)           as vehicles,
      (select count(*) from public.vehicle_accounts)   as vehicle_accounts,
      (select count(*) from public.opening_balances)   as opening_balances,
      (select count(*) from public.trips)              as trips,
      (select count(*) from public.trips where is_cancelled) as cancelled_trips,
      (select count(*) from public.payments) as payments,
      (select count(*) from public.payments where is_cancelled) as cancelled_payments,
      (select count(*) from public.audit_log)          as audit_rows,
      (select count(*) from public.idempotency_keys)   as idempotency_rows,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'app_op_%') as write_rpcs,
      (select count(*) from pg_tables where schemaname = 'public') as tables
  `);
  console.log('\nfinal state:', JSON.stringify(counts.rows[0]));
  console.log('\nALL STEPS PASSED — A/B/C plus T08.1 payments schema and isolated SQL suites executed on PostgreSQL.');
  console.log('NOTE: this is PostgreSQL, NOT Supabase Auth/GoTrue/PostgREST.');
  console.log('NOTE: PGlite is a single in-memory connection; true concurrent requests and login flows still require a real Supabase instance.');
} catch (error) {
  console.error(`FAIL [post-check] ${describe(error)}`);
  await db.close();
  process.exit(1);
}

await db.close();
