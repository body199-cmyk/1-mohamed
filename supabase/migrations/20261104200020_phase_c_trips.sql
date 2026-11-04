-- ============================================================================
-- Migration: 20261104200020_phase_c_trips.sql
-- Module: BUILD-01 / Phase C (DB-03-TRIPS) — جدول النقلات وقيوده وصلاحياته
--
-- additive: يُطبّق بعد migrations A وB فقط بعد نجاح اختباراتها.
-- المرجع الوحيد للمعادلات: docs/ACCOUNTING_RULES.md (A01, D01, D05, D14)
-- ونموذج الحساب المرجعي: packages/accounting/src/trip-amounts.ts
--
-- مبادئ التصميم الملزمة هنا:
--  * لا إجماليات يفرضها العميل: القيمتان تُحسبان على الخادم دائمًا.
--  * الوزن يُخزن ملي-طن (٣ منازل)، والأسعار والمصاريف قروش (منزلتان).
--  * same_rate مفعّلة افتراضيًا؛ عند تفعيلها يفرض القيد تساوي السعرين (D14).
--  * responsible_contractor_id مشتق على الخادم من الاتجاه (A02/A04):
--      AHMED_SUPPLIES  ⇒ المسؤول = المقاول الأساسي (أحمد)
--      OTHER_SUPPLIES  ⇒ المسؤول = المقاول الطرف نفسه
--  * الملغى يُستبعد ماليًا (فهارس جزئية not is_cancelled) ويبقى للتدقيق.
--  * السجل يحتفظ بأسعار نقطته ولا يتأثر بأي بيانات مشتركة ليوم جديد (A13-R1).
-- ============================================================================

create table if not exists public.trips (
    id text primary key,
    vehicle_id text not null references public.vehicles(id) on delete restrict,
    counterparty_contractor_id text not null references public.contractors(id) on delete restrict,
    responsible_contractor_id text not null references public.contractors(id) on delete restrict,
    direction text not null check (direction in ('AHMED_SUPPLIES', 'OTHER_SUPPLIES')),
    trip_date date not null,
    weight_milli_tonnes bigint not null check (weight_milli_tonnes > 0),
    contractor_rate_piastres bigint not null check (contractor_rate_piastres >= 0),
    vehicle_rate_piastres bigint not null check (vehicle_rate_piastres >= 0),
    same_rate boolean not null default true,
    expense_piastres bigint not null check (expense_piastres >= 0),
    contractor_total_piastres bigint not null check (contractor_total_piastres >= 0),
    vehicle_total_piastres bigint not null check (vehicle_total_piastres >= 0),
    notes text null,
    is_cancelled boolean not null default false,
    cancel_reason text null,
    cancelled_at timestamptz null,
    version integer not null default 1 check (version >= 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- D14: عند تفعيل «نفس السعر» يجب أن يتساوى السعران فعليًا.
    constraint chk_trips_same_rate check (
        not same_rate or contractor_rate_piastres = vehicle_rate_piastres
    ),
    -- الإلغاء يستوجب سببًا، والسجل النشط لا يحمل حقول إلغاء.
    constraint chk_trips_cancel_reason check (
        not is_cancelled or (cancel_reason is not null and btrim(cancel_reason) <> '')
    ),
    constraint chk_trips_active_has_no_cancel_fields check (
        is_cancelled or (cancel_reason is null and cancelled_at is null)
    )
);

comment on table public.trips is
    'Trip records with server-computed totals. Cancelled trips stay for audit but are excluded financially via partial indexes.';

comment on column public.trips.responsible_contractor_id is
    'Derived on the server from direction: primary contractor for AHMED_SUPPLIES, counterparty for OTHER_SUPPLIES. Never trusted from the client.';

comment on column public.trips.contractor_total_piastres is
    'round_half_up(weight x contractor_rate) + expense. Computed server-side exactly as @ledger/accounting.';

comment on column public.trips.vehicle_total_piastres is
    'round_half_up(weight x vehicle_rate) + expense. Computed server-side exactly as @ledger/accounting.';

-- فهارس القراءة بالفترة والحساب والطرف، والملغى مستبعد ماليًا.
create index if not exists idx_trips_account_date
on public.trips (vehicle_id, responsible_contractor_id, trip_date)
where not is_cancelled;

create index if not exists idx_trips_counterparty_date
on public.trips (counterparty_contractor_id, trip_date)
where not is_cancelled;

-- فهرس الترقيم (trip_date, id) يدعم keyset pagination المستخدم في قراءة النقلات.
create index if not exists idx_trips_period_cursor
on public.trips (trip_date, id);

-- ============================================================================
-- RLS: قراءة للمالك فقط، ولا كتابة مباشرة من أي عميل.
-- TRUNCATE مسحوب صراحة: RLS لا يغطيه إطلاقًا (ثغرة أُغلقت في المرحلة A).
-- ============================================================================

alter table public.trips enable row level security;

create policy "Owner can view trips"
on public.trips for select to authenticated
using (public.app_is_owner());

create policy "Disallow direct insert on trips"
on public.trips for insert to public
with check (false);

create policy "Disallow direct update on trips"
on public.trips for update to public
using (false);

create policy "Disallow direct delete on trips"
on public.trips for delete to public
using (false);

revoke truncate on public.trips from anon, authenticated;
