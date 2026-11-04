-- ============================================================================
-- Migration: 20261104200021_phase_c_trip_math.sql
-- Module: BUILD-01 / Phase C — حساب النقلة والتحقق الدقيق ومشتقات الاتجاه
--
-- الغرض: عزل «الرياضيات» و«التحقق» في دوال صغيرة تُختبر مقابل
-- packages/accounting/src/trip-amounts.ts حرفيًا:
--   product_milli = weight_milli x rate_piastres
--   rounded       = floor((product_milli + 500) / 1000)     -- نصف القرش لأعلى
--   total         = rounded + expense_piastres              -- المصاريف مرة واحدة (D05)
--
-- كل المدخلات تصل نصوصًا عشرية مجردة مطابقة لصيغة الحزمة:
--   ^[0-9]+(\.[0-9]+)?$  مع حد أقصى للمنازل (٣ للوزن، ٢ للمال).
-- الرفض يقع على النص قبل أي تحويل رقمي؛ لا تقريب صامت أبدًا (D01).
-- الحساب الوسيط بـ numeric الدقيق، والفيض عن bigint يُرفض برسالة واضحة.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ١. تحويل نص عشري مجرد إلى عدد صحيح مكبّر، بحد الفيض.
-- ---------------------------------------------------------------------------

create or replace function public.app_parse_scaled_unsigned(
    p_text text,
    p_scale integer,
    p_label text
)
returns bigint
language plpgsql
immutable
as $$
declare
    v_text text := btrim(coalesce(p_text, ''));
    v_dot integer;
    v_int text;
    v_frac text;
    v_digits text;
begin
    if v_text !~ '^[0-9]+(\.[0-9]+)?$' then
        raise exception '% must be a plain non-negative decimal like 12 or 12.5', p_label
            using errcode = '22023';
    end if;

    v_dot := position('.' in v_text);
    if v_dot = 0 then
        v_int := v_text;
        v_frac := '';
    else
        v_int := left(v_text, v_dot - 1);
        v_frac := substring(v_text from v_dot + 1);
    end if;

    if length(v_frac) > p_scale then
        raise exception '% has more than % decimal digits; correct the value instead of truncating it',
                        p_label, p_scale
            using errcode = '22023';
    end if;

    v_digits := v_int || rpad(v_frac, p_scale, '0');

    begin
        return v_digits::bigint;
    exception when numeric_value_out_of_range then
        raise exception '% exceeds the bigint storage limit; correct the value', p_label
            using errcode = '22003';
    end;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٢. الحقل المالي يجب أن يصل «نصًا» لا رقم JSON، حتى لا يفقد دقته في المتصفح.
-- ---------------------------------------------------------------------------

create or replace function public.app_require_decimal_string(
    p_payload jsonb,
    p_field text,
    p_scale integer
)
returns bigint
language plpgsql
immutable
as $$
declare
    v_val jsonb := p_payload -> p_field;
begin
    if v_val is null or jsonb_typeof(v_val) <> 'string' then
        raise exception '% must be sent as a decimal string, never as a JSON number', p_field
            using errcode = '22023';
    end if;
    return public.app_parse_scaled_unsigned(v_val #>> '{}', p_scale, p_field);
end;
$$;

-- ---------------------------------------------------------------------------
-- ٣. قيمتا النقلة: تطابق حرفيًا calculateTripAmounts في @ledger/accounting.
--    تُعاد القيم نصًا داخل JSON حفاظًا على الدقة فوق Number.MAX_SAFE_INTEGER.
-- ---------------------------------------------------------------------------

create or replace function public.app_trip_totals(
    p_weight_milli bigint,
    p_contractor_rate bigint,
    p_vehicle_rate bigint,
    p_expense bigint
)
returns jsonb
language plpgsql
immutable
as $$
declare
    v_max numeric := 9223372036854775807::numeric;
    v_product numeric;
    v_rounded numeric;
    v_contractor numeric;
    v_vehicle numeric;
begin
    v_product := p_weight_milli::numeric * p_contractor_rate::numeric;
    v_rounded := floor((v_product + 500) / 1000);
    v_contractor := v_rounded + p_expense::numeric;

    v_product := p_weight_milli::numeric * p_vehicle_rate::numeric;
    v_rounded := floor((v_product + 500) / 1000);
    v_vehicle := v_rounded + p_expense::numeric;

    if v_contractor > v_max or v_vehicle > v_max then
        raise exception 'Trip total exceeds the bigint storage limit; correct weight or rates'
            using errcode = '22003';
    end if;

    return jsonb_build_object(
        'contractor_total_piastres', v_contractor::bigint::text,
        'vehicle_total_piastres', v_vehicle::bigint::text
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- ٤. قفل الحسابات المتأثرة بترتيب ثابت (فرز المفاتيح) لتفادي deadlock
--    بين طلبين متزامنين يمسّان نفس الحسابات بترتيب مختلف.
-- ---------------------------------------------------------------------------

create or replace function public.app_lock_trip_accounts(p_keys text[])
returns void
language plpgsql
as $$
declare
    r record;
begin
    for r in select distinct k from unnest(p_keys) as t(k) order by k loop
        perform pg_advisory_xact_lock(727303, hashtext(r.k));
    end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٥. اشتقاق المقاول المسؤول من الاتجاه + كل تحقق العلاقات والتواريخ (A02/A04).
--    الطرف لا يكون أبدًا المقاول الأساسي؛ فالمسؤول في AHMED_SUPPLIES هو الأساسي،
--    وفي OTHER_SUPPLIES هو الطرف نفسه — والحساب المركب يجب أن يكون موجودًا.
--    تاريخ النقلة لا يسبق تاريخ بداية أي حساب متأثر (افتتاحي الحساب أو الطرف).
-- ---------------------------------------------------------------------------

create or replace function public.app_resolve_trip_responsible(
    p_vehicle_id text,
    p_counterparty_id text,
    p_direction text,
    p_trip_date date
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_primary text;
    v_responsible text;
    v_start date;
begin
    if p_direction not in ('AHMED_SUPPLIES', 'OTHER_SUPPLIES') then
        raise exception 'Unknown trip direction: %', p_direction using errcode = '22023';
    end if;

    select id into v_primary from public.contractors where is_primary limit 1;
    if v_primary is null then
        raise exception 'Primary contractor is not configured' using errcode = '22023';
    end if;

    if p_counterparty_id = v_primary then
        raise exception 'The counterparty must differ from the primary contractor'
            using errcode = '22023';
    end if;

    if p_direction = 'AHMED_SUPPLIES' then
        v_responsible := v_primary;
    else
        v_responsible := p_counterparty_id;
    end if;

    if not exists (select 1 from public.contractors
                    where id = p_counterparty_id and not is_archived) then
        raise exception 'Counterparty contractor does not exist or is archived'
            using errcode = '23503';
    end if;
    if not exists (select 1 from public.vehicles
                    where id = p_vehicle_id and not is_archived) then
        raise exception 'Vehicle does not exist or is archived' using errcode = '23503';
    end if;
    if not exists (select 1 from public.vehicle_accounts
                    where vehicle_id = p_vehicle_id and contractor_id = v_responsible) then
        raise exception 'The vehicle has no account with the responsible contractor; create it first'
            using errcode = '23503';
    end if;

    select min(start_date) into v_start
      from public.opening_balances
     where balance_type = 'VEHICLE_CASH'
       and vehicle_id = p_vehicle_id
       and contractor_id = v_responsible
       and not is_cancelled;
    if v_start is not null and p_trip_date < v_start then
        raise exception 'Trip date % precedes the vehicle account start date %', p_trip_date, v_start
            using errcode = '22023';
    end if;

    select min(start_date) into v_start
      from public.opening_balances
     where balance_type = 'CONTRACTOR_WORK'
       and contractor_id = p_counterparty_id
       and not is_cancelled;
    if v_start is not null and p_trip_date < v_start then
        raise exception 'Trip date % precedes the counterparty work opening start date %',
                        p_trip_date, v_start
            using errcode = '22023';
    end if;

    return v_responsible;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٦. حملة تدقيق بأثر مالي (ت overloaded بمعامل تاسع؛ الأصل ذو الثمانية باقٍ كما هو).
--    القيم المالية داخل الأثر نصوص دائمًا.
-- ---------------------------------------------------------------------------

create or replace function public.app_write_audit(
    p_entity_type text,
    p_entity_id text,
    p_action text,
    p_reason text,
    p_old jsonb,
    p_new jsonb,
    p_diff jsonb,
    p_financial_impact jsonb,
    p_user uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    insert into public.audit_log
        (entity_type, entity_id, action, reason, old_data, new_data, diff,
         financial_impact, performed_by)
    values
        (p_entity_type, p_entity_id, p_action, p_reason, p_old, p_new, p_diff,
         p_financial_impact, p_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- ٧. كل الأدوات الداخلية: لا EXECUTE لأي دور عميل.
-- ---------------------------------------------------------------------------

revoke execute on function
    public.app_parse_scaled_unsigned(text, integer, text),
    public.app_require_decimal_string(jsonb, text, integer),
    public.app_trip_totals(bigint, bigint, bigint, bigint),
    public.app_lock_trip_accounts(text[]),
    public.app_resolve_trip_responsible(text, text, text, date),
    public.app_write_audit(text, text, text, text, jsonb, jsonb, jsonb, jsonb, uuid)
    from public, anon, authenticated;
