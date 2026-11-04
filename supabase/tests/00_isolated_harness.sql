-- ============================================================================
-- Test harness: 00_isolated_harness.sql
-- BUILD-01 / Phase A — ISOLATED POSTGRESQL ONLY.
--
-- WARNING: هذا الملف للاختبار المحلي المعزول فقط.
-- لا يُشغّل على مشروع Supabase حقيقي: هناك توجد أدوار anon/authenticated
-- وجدول auth.users ودالة auth.uid() بالفعل ويملكها Supabase.
--
-- الغرض: تجهيز بيئة تطابق افتراضات Supabase على قاعدة PostgreSQL عادية،
-- لتُطبَّق بعدها migrations الثلاثة الأصلية + migration تصحيحات المراجعة،
-- ثم جناح الاختبارات 01_db_02_schema_verification.sql.
--
-- ترتيب التنفيذ موثّق في tools/db-verify.mjs ولا يُغيّر.
-- ============================================================================

create schema if not exists auth;

-- بذرة مطابقة للعمود المستخدم في Supabase Auth (بدون GoTrue ولا PostgREST).
-- وجودها يجعل فحص app_set_initial_owner لوجود المستخدم حقيقيًا لا مُحاكى.
create table if not exists auth.users (
    id uuid primary key,
    email text null,
    created_at timestamptz not null default now()
);

-- أدوار Supabase القياسية. on Supabase الحقيقي موجودة مسبقًا.
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
    end if;
end
$$;

-- محاكاة دالتي الهوية. في Supabase تُوفّرهما المنصة نفسها.
-- IMPORTANT: هذه محاكاة لأغراض اختبار الصلاحيات فقط، وليست بديلًا عن
-- اختبار تسجيل الدخول الكامل (Auth) كما هو موضح في تقرير الحزمة.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;

-- Supabase يمنح افتراضيًا صلاحيات واسعة على public ويعتمد على RLS للحماية.
-- نحاكي ذلك بدقة، لأن RLS لا يغطي TRUNCATE وهذه ثغرة حقيقية يجب أن يكتشفها الاختبار.
grant select, insert, update, delete, truncate, references
    on all tables in schema public to anon, authenticated;

alter default privileges in schema public
    grant select, insert, update, delete, truncate, references on tables
    to anon, authenticated;

-- مستخدما الاختبار: مالك معتمد، ومستخدم مسجل آخر غير مالك.
insert into auth.users (id, email) values
    ('00000000-0000-0000-0000-000000000001', 'owner@test.invalid'),
    ('00000000-0000-0000-0000-000000000002', 'stranger@test.invalid')
on conflict (id) do nothing;
