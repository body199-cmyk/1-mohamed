-- ============================================================================
-- Migration: 20261104200011_phase_b_operations.sql
-- Module: BUILD-01 / Phase B — عمليات البيانات الأساسية المحمية (RPC)
--
-- يعتمد على 20261104200010_phase_b_foundation.sql.
-- كل RPC: (مفتاح طلب ثابت، حمولة JSON) ⇒ استجابة JSON.
-- الترتيب داخل كل RPC ثابت: بوابة المالك → بوابة منع التكرار → التحقق →
-- الكتابة → التدقيق → إغلاق المفتاح. الاستثناء في أي خطوة يتراجع بالكل.
--
-- الأرقام الدقيقة تُعاد كنصوص داخل JSON؛ لا تمر عبر JavaScript Number.
-- لا توجد عملية حذف نهائي، ولا تعديل افتتاحية، ولا تحويل افتتاحي قديم.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ١. إضافة مقاول (مع افتتاحيته اختياريًا في عملية واحدة ذرية)
--    الحمولة: {id, name, opening?: {start_date, signed_piastres, notes}, start_mode?}
--    «الاسم وحده ليس هوية»: لا يوجد قيد فريد على الاسم.
-- ---------------------------------------------------------------------------

create or replace function public.app_op_contractor_create(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_user uuid := public.app_require_owner();
    v_key text := btrim(coalesce(p_request_key, ''));
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_gate jsonb;
    v_id text;
    v_name text;
    v_opening jsonb;
    v_start date;
    v_amount bigint;
    v_opening_id text;
    v_response jsonb;
begin
    v_gate := public.app_idempotency_begin(v_key, 'contractor.create', v_payload, v_user);
    if (v_gate->>'__replay')::boolean then
        return v_gate->'response';
    end if;

    v_id := public.app_require_text(v_payload->>'id', 'contractor id');
    v_name := public.app_require_text(v_payload->>'name', 'contractor name');

    if v_payload ? 'is_primary' and (v_payload->>'is_primary')::boolean then
        raise exception 'The primary contractor is created administratively only'
            using errcode = '42501';
    end if;

    v_opening := v_payload->'opening';
    if coalesce(v_payload->>'start_mode', 'TOTAL') = 'DETAILS'
       and v_opening is not null then
        raise exception 'Starting with details must not add a comprehensive opening balance'
            using errcode = '22023';
    end if;

    insert into public.contractors (id, name) values (v_id, v_name);

    if v_opening is not null and jsonb_typeof(v_opening) = 'object' then
        v_start := (public.app_require_text(v_opening->>'start_date', 'opening start_date'))::date;
        v_amount := public.app_exact_bigint(v_opening->'signed_piastres', 'opening signed_piastres');
        v_opening_id := v_id || ':OPENING';

        insert into public.opening_balances
            (id, balance_type, contractor_id, vehicle_id, start_date, signed_piastres, notes)
        values
            (v_opening_id, 'CONTRACTOR_WORK', v_id, null, v_start, v_amount, v_opening->>'notes');

        perform public.app_write_audit(
            'OPENING_BALANCE', v_opening_id, 'INSERT', null, null,
            jsonb_build_object('start_date', v_start,
                               'signed_piastres', v_amount::text,
                               'balance_type', 'CONTRACTOR_WORK'),
            null, v_user
        );
    end if;

    perform public.app_write_audit(
        'CONTRACTOR', v_id, 'INSERT', null, null,
        jsonb_build_object('id', v_id, 'name', v_name, 'version', 1), null, v_user
    );

    v_response := jsonb_build_object(
        'status', 'OK',
        'contractor_id', v_id,
        'version', 1,
        'opening_balance_id', v_opening_id
    );
    perform public.app_idempotency_complete(v_key, v_response);
    return v_response;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٢. تعديل بيانات مقاول:expected_version إلزامي + سجل أثر بالقديم والجديد
-- ---------------------------------------------------------------------------

create or replace function public.app_op_contractor_update(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_user uuid := public.app_require_owner();
    v_key text := btrim(coalesce(p_request_key, ''));
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_gate jsonb;
    v_id text;
    v_name text;
    v_expected integer;
    v_old public.contractors%rowtype;
    v_response jsonb;
begin
    v_gate := public.app_idempotency_begin(v_key, 'contractor.update', v_payload, v_user);
    if (v_gate->>'__replay')::boolean then
        return v_gate->'response';
    end if;

    v_id := public.app_require_text(v_payload->>'id', 'contractor id');
    v_name := public.app_require_text(v_payload->>'name', 'contractor name');
    v_expected := (v_payload->>'expected_version')::integer;
    if v_expected is null then
        raise exception 'expected_version is required for an update' using errcode = '22023';
    end if;

    select * into v_old from public.contractors where id = v_id for update;
    if not found then
        raise exception 'Contractor not found: %', v_id using errcode = '22023';
    end if;
    if v_old.is_primary then
        raise exception 'Primary contractor identity cannot be modified' using errcode = '42501';
    end if;
    if v_old.version <> v_expected then
        raise exception 'Version conflict: expected %, found %', v_expected, v_old.version
            using errcode = 'P2003';
    end if;

    update public.contractors
       set name = v_name, version = version + 1, updated_at = now()
     where id = v_id;

    perform public.app_write_audit(
        'CONTRACTOR', v_id, 'UPDATE', v_payload->>'reason',
        to_jsonb(v_old),
        jsonb_build_object('id', v_id, 'name', v_name, 'version', v_old.version + 1),
        jsonb_build_object('name', jsonb_build_array(v_old.name, v_name)),
        v_user
    );

    v_response := jsonb_build_object('status', 'OK', 'contractor_id', v_id,
                                     'version', v_old.version + 1);
    perform public.app_idempotency_complete(v_key, v_response);
    return v_response;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٣. أرشفة / إعادة تفعيل مقاول (لا حذف نهائي)
-- ---------------------------------------------------------------------------

create or replace function public.app_op_contractor_set_archived(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_user uuid := public.app_require_owner();
    v_key text := btrim(coalesce(p_request_key, ''));
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_gate jsonb;
    v_id text;
    v_archived boolean;
    v_expected integer;
    v_old public.contractors%rowtype;
    v_response jsonb;
begin
    v_gate := public.app_idempotency_begin(v_key, 'contractor.set_archived', v_payload, v_user);
    if (v_gate->>'__replay')::boolean then
        return v_gate->'response';
    end if;

    v_id := public.app_require_text(v_payload->>'id', 'contractor id');
    v_archived := (v_payload->>'archived')::boolean;
    v_expected := (v_payload->>'expected_version')::integer;
    if v_archived is null or v_expected is null then
        raise exception 'archived and expected_version are required' using errcode = '22023';
    end if;

    select * into v_old from public.contractors where id = v_id for update;
    if not found then
        raise exception 'Contractor not found: %', v_id using errcode = '22023';
    end if;
    if v_old.is_primary then
        raise exception 'Primary contractor cannot be archived' using errcode = '42501';
    end if;
    if v_old.version <> v_expected then
        raise exception 'Version conflict: expected %, found %', v_expected, v_old.version
            using errcode = 'P2003';
    end if;

    update public.contractors
       set is_archived = v_archived, version = version + 1, updated_at = now()
     where id = v_id;

    perform public.app_write_audit(
        'CONTRACTOR', v_id, 'UPDATE', v_payload->>'reason',
        to_jsonb(v_old),
        jsonb_build_object('is_archived', v_archived, 'version', v_old.version + 1),
        jsonb_build_object('is_archived', jsonb_build_array(v_old.is_archived, v_archived)),
        v_user
    );

    v_response := jsonb_build_object('status', 'OK', 'contractor_id', v_id,
                                     'archived', v_archived, 'version', v_old.version + 1);
    perform public.app_idempotency_complete(v_key, v_response);
    return v_response;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٤. إضافة عربية: لو لوحة مؤرشفة مطابقة موجودة، يُعاد «قرار مطلوب»
--    ولا تُنشأ عربية جديدة صامتة. التطبيع لا يدمج لوحات مختلفة.
--    يمكن إنشاء حسابها لدى المقاول المسؤول في نفس العملية.
-- ---------------------------------------------------------------------------

create or replace function public.app_op_vehicle_create(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_user uuid := public.app_require_owner();
    v_key text := btrim(coalesce(p_request_key, ''));
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_gate jsonb;
    v_id text;
    v_plate text;
    v_norm text;
    v_conflict text;
    v_contractor text;
    v_account_created boolean := false;
    v_response jsonb;
begin
    v_gate := public.app_idempotency_begin(v_key, 'vehicle.create', v_payload, v_user);
    if (v_gate->>'__replay')::boolean then
        return v_gate->'response';
    end if;

    v_id := public.app_require_text(v_payload->>'id', 'vehicle id');
    v_plate := public.app_require_text(v_payload->>'plate_number', 'plate number');
    v_norm := public.app_normalize_plate(v_plate);

    select v.id into v_conflict
      from public.vehicles v
     where v.is_archived
       and public.app_normalize_plate(v.plate_number) = v_norm
     limit 1;

    if v_conflict is not null then
        v_response := jsonb_build_object(
            'status', 'NEEDS_DECISION',
            'code', 'ARCHIVED_PLATE_EXISTS',
            'archived_vehicle_id', v_conflict,
            'message', 'توجد عربية مؤرشفة بنفس اللوحة؛ أعد تفعيلها بدل إنشاء عربية جديدة'
        );
        perform public.app_idempotency_complete(v_key, v_response);
        return v_response;
    end if;

    insert into public.vehicles (id, plate_number, driver_name, notes)
    values (v_id, v_plate, v_payload->>'driver_name', v_payload->>'notes');

    if v_payload ? 'contractor_id'
       and coalesce(btrim(v_payload->>'contractor_id'), '') <> '' then
        v_contractor := btrim(v_payload->>'contractor_id');
        v_account_created := public.app_ensure_vehicle_account(v_id, v_contractor, v_user);
    end if;

    perform public.app_write_audit(
        'VEHICLE', v_id, 'INSERT', null, null,
        jsonb_build_object('id', v_id, 'plate_number', v_plate,
                           'normalized_plate', v_norm, 'version', 1),
        null, v_user
    );

    v_response := jsonb_build_object(
        'status', 'OK', 'vehicle_id', v_id, 'version', 1,
        'vehicle_account_created', v_account_created
    );
    perform public.app_idempotency_complete(v_key, v_response);
    return v_response;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٥. تعديل عربية (اللوحة، السائق، الملاحظات) مع تعارض الإصدار
-- ---------------------------------------------------------------------------

create or replace function public.app_op_vehicle_update(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_user uuid := public.app_require_owner();
    v_key text := btrim(coalesce(p_request_key, ''));
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_gate jsonb;
    v_id text;
    v_plate text;
    v_expected integer;
    v_old public.vehicles%rowtype;
    v_response jsonb;
begin
    v_gate := public.app_idempotency_begin(v_key, 'vehicle.update', v_payload, v_user);
    if (v_gate->>'__replay')::boolean then
        return v_gate->'response';
    end if;

    v_id := public.app_require_text(v_payload->>'id', 'vehicle id');
    v_plate := public.app_require_text(v_payload->>'plate_number', 'plate number');
    v_expected := (v_payload->>'expected_version')::integer;
    if v_expected is null then
        raise exception 'expected_version is required for an update' using errcode = '22023';
    end if;

    select * into v_old from public.vehicles where id = v_id for update;
    if not found then
        raise exception 'Vehicle not found: %', v_id using errcode = '22023';
    end if;
    if v_old.version <> v_expected then
        raise exception 'Version conflict: expected %, found %', v_expected, v_old.version
            using errcode = 'P2003';
    end if;

    if exists (
        select 1 from public.vehicles v
         where v.id <> v_id
           and not v.is_archived
           and public.app_normalize_plate(v.plate_number) = public.app_normalize_plate(v_plate)
    ) then
        raise exception 'Another active vehicle already carries this plate' using errcode = '23505';
    end if;

    update public.vehicles
       set plate_number = v_plate,
           driver_name = v_payload->>'driver_name',
           notes = v_payload->>'notes',
           version = version + 1,
           updated_at = now()
     where id = v_id;

    perform public.app_write_audit(
        'VEHICLE', v_id, 'UPDATE', v_payload->>'reason',
        to_jsonb(v_old),
        jsonb_build_object('plate_number', v_plate, 'version', v_old.version + 1),
        jsonb_build_object('plate_number', jsonb_build_array(v_old.plate_number, v_plate)),
        v_user
    );

    v_response := jsonb_build_object('status', 'OK', 'vehicle_id', v_id,
                                     'version', v_old.version + 1);
    perform public.app_idempotency_complete(v_key, v_response);
    return v_response;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٦. أرشفة / إعادة تفعيل عربية، مع منع لوحتين نشطتين متطابقتين
-- ---------------------------------------------------------------------------

create or replace function public.app_op_vehicle_set_archived(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_user uuid := public.app_require_owner();
    v_key text := btrim(coalesce(p_request_key, ''));
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_gate jsonb;
    v_id text;
    v_archived boolean;
    v_expected integer;
    v_old public.vehicles%rowtype;
    v_response jsonb;
begin
    v_gate := public.app_idempotency_begin(v_key, 'vehicle.set_archived', v_payload, v_user);
    if (v_gate->>'__replay')::boolean then
        return v_gate->'response';
    end if;

    v_id := public.app_require_text(v_payload->>'id', 'vehicle id');
    v_archived := (v_payload->>'archived')::boolean;
    v_expected := (v_payload->>'expected_version')::integer;
    if v_archived is null or v_expected is null then
        raise exception 'archived and expected_version are required' using errcode = '22023';
    end if;

    select * into v_old from public.vehicles where id = v_id for update;
    if not found then
        raise exception 'Vehicle not found: %', v_id using errcode = '22023';
    end if;
    if v_old.version <> v_expected then
        raise exception 'Version conflict: expected %, found %', v_expected, v_old.version
            using errcode = 'P2003';
    end if;

    if not v_archived and exists (
        select 1 from public.vehicles v
         where v.id <> v_id
           and not v.is_archived
           and public.app_normalize_plate(v.plate_number)
               = public.app_normalize_plate(v_old.plate_number)
    ) then
        raise exception 'Cannot reactivate: an active vehicle already carries this plate'
            using errcode = '23505';
    end if;

    update public.vehicles
       set is_archived = v_archived, version = version + 1, updated_at = now()
     where id = v_id;

    perform public.app_write_audit(
        'VEHICLE', v_id, 'UPDATE', v_payload->>'reason',
        to_jsonb(v_old),
        jsonb_build_object('is_archived', v_archived, 'version', v_old.version + 1),
        jsonb_build_object('is_archived', jsonb_build_array(v_old.is_archived, v_archived)),
        v_user
    );

    v_response := jsonb_build_object('status', 'OK', 'vehicle_id', v_id,
                                     'archived', v_archived, 'version', v_old.version + 1);
    perform public.app_idempotency_complete(v_key, v_response);
    return v_response;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٧. تأمين حساب العربية لدى المقاول المسؤول (واجهة مستقلة لنفس الأداة)
-- ---------------------------------------------------------------------------

create or replace function public.app_op_vehicle_account_ensure(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_user uuid := public.app_require_owner();
    v_key text := btrim(coalesce(p_request_key, ''));
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_gate jsonb;
    v_vehicle text;
    v_contractor text;
    v_created boolean;
    v_response jsonb;
begin
    v_gate := public.app_idempotency_begin(v_key, 'vehicle_account.ensure', v_payload, v_user);
    if (v_gate->>'__replay')::boolean then
        return v_gate->'response';
    end if;

    v_vehicle := public.app_require_text(v_payload->>'vehicle_id', 'vehicle id');
    v_contractor := public.app_require_text(v_payload->>'contractor_id', 'contractor id');
    v_created := public.app_ensure_vehicle_account(v_vehicle, v_contractor, v_user);

    v_response := jsonb_build_object('status', 'OK', 'created', v_created,
                                     'vehicle_id', v_vehicle, 'contractor_id', v_contractor);
    perform public.app_idempotency_complete(v_key, v_response);
    return v_response;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٨. افتتاحية أولية معتمدة بتاريخ بداية.
--    افتتاحي فرق الشغل (CONTRACTOR_WORK) منفصل تمامًا عن الافتتاحي النقدي
--    لحساب العربية (VEHICLE_CASH) ويشترط وجود الحساب المركب أولًا.
--    «البدء بالتفاصيل» لا يضيف افتتاحية شاملة لنفس الشغل (D04).
--    لا توجد هنا عملية تعديل افتتاحية أو تحويل القديم إلى تفاصيل: مؤجلة.
-- ---------------------------------------------------------------------------

create or replace function public.app_op_opening_balance_create(p_request_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
    v_user uuid := public.app_require_owner();
    v_key text := btrim(coalesce(p_request_key, ''));
    v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
    v_gate jsonb;
    v_id text;
    v_type text;
    v_contractor text;
    v_vehicle text;
    v_start date;
    v_amount bigint;
    v_response jsonb;
begin
    v_gate := public.app_idempotency_begin(v_key, 'opening_balance.create', v_payload, v_user);
    if (v_gate->>'__replay')::boolean then
        return v_gate->'response';
    end if;

    if coalesce(v_payload->>'start_mode', 'TOTAL') = 'DETAILS' then
        raise exception 'Starting with details must not add a comprehensive opening balance'
            using errcode = '22023';
    end if;

    v_id := public.app_require_text(v_payload->>'id', 'opening balance id');
    v_type := public.app_require_text(v_payload->>'balance_type', 'balance type');
    if v_type not in ('CONTRACTOR_WORK', 'VEHICLE_CASH') then
        raise exception 'Unknown opening balance type: %', v_type using errcode = '22023';
    end if;
    v_contractor := public.app_require_text(v_payload->>'contractor_id', 'contractor id');
    v_start := (public.app_require_text(v_payload->>'start_date', 'start date'))::date;
    v_amount := public.app_exact_bigint(v_payload->'signed_piastres', 'signed_piastres');

    if not exists (select 1 from public.contractors
                    where id = v_contractor and not is_archived) then
        raise exception 'Contractor does not exist or is archived' using errcode = '23503';
    end if;

    if v_type = 'VEHICLE_CASH' then
        v_vehicle := public.app_require_text(v_payload->>'vehicle_id', 'vehicle id');
        if not exists (
            select 1 from public.vehicle_accounts
             where vehicle_id = v_vehicle and contractor_id = v_contractor
        ) then
            raise exception 'The vehicle account must exist before its cash opening balance'
                using errcode = '23503';
        end if;
    else
        if coalesce(btrim(v_payload->>'vehicle_id'), '') <> '' then
            raise exception 'CONTRACTOR_WORK opening must not reference a vehicle'
                using errcode = '22023';
        end if;
        v_vehicle := null;
    end if;

    insert into public.opening_balances
        (id, balance_type, contractor_id, vehicle_id, start_date, signed_piastres, notes, version)
    values
        (v_id, v_type, v_contractor, v_vehicle, v_start, v_amount, v_payload->>'notes', 1);

    perform public.app_write_audit(
        'OPENING_BALANCE', v_id, 'INSERT', null, null,
        jsonb_build_object('balance_type', v_type, 'contractor_id', v_contractor,
                           'vehicle_id', v_vehicle, 'start_date', v_start,
                           'signed_piastres', v_amount::text),
        null, v_user
    );

    v_response := jsonb_build_object(
        'status', 'OK', 'opening_balance_id', v_id,
        'balance_type', v_type, 'start_date', v_start,
        'signed_piastres', v_amount::text, 'version', 1
    );
    perform public.app_idempotency_complete(v_key, v_response);
    return v_response;
end;
$$;

-- ---------------------------------------------------------------------------
-- ٩. الصلاحيات: لا EXECUTE للعموم ولا لـ anon؛ authenticated فقط،
--    وبوابة المالك داخل كل دالة تحسم أن المالك وحده ينفّذ فعليًا.
--    لا توجد أي RPC حذف: السجل المرتبط بحركات لا يُحذف نهائيًا.
-- ---------------------------------------------------------------------------

revoke execute on function
    public.app_op_contractor_create(text, jsonb),
    public.app_op_contractor_update(text, jsonb),
    public.app_op_contractor_set_archived(text, jsonb),
    public.app_op_vehicle_create(text, jsonb),
    public.app_op_vehicle_update(text, jsonb),
    public.app_op_vehicle_set_archived(text, jsonb),
    public.app_op_vehicle_account_ensure(text, jsonb),
    public.app_op_opening_balance_create(text, jsonb)
    from public, anon, authenticated;

grant execute on function
    public.app_op_contractor_create(text, jsonb),
    public.app_op_contractor_update(text, jsonb),
    public.app_op_contractor_set_archived(text, jsonb),
    public.app_op_vehicle_create(text, jsonb),
    public.app_op_vehicle_update(text, jsonb),
    public.app_op_vehicle_set_archived(text, jsonb),
    public.app_op_vehicle_account_ensure(text, jsonb),
    public.app_op_opening_balance_create(text, jsonb)
    to authenticated;
