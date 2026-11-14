-- Independent expected values at the exact half-pound boundary; no float math.
do $$
declare
  actual jsonb;
begin
  actual := public.app_trip_totals(499,100,100,0);
  if actual->>'contractor_total_piastres' <> '0' then raise exception 'D19 below-half rounded incorrectly'; end if;
  actual := public.app_trip_totals(500,100,200,0);
  if actual->>'contractor_total_piastres' <> '100' or actual->>'vehicle_total_piastres' <> '100' then
    raise exception 'D19 half-pound or independent rate mismatch';
  end if;
  actual := public.app_trip_totals(1500,10000,10100,100);
  if actual->>'contractor_total_piastres' <> '15100' or actual->>'vehicle_total_piastres' <> '15300' then
    raise exception 'D19 expense or independent-rate error';
  end if;
  if public.app_parse_scaled_unsigned('100.49',2,'amount') <> 10000
     or public.app_parse_scaled_unsigned('100.50',2,'amount') <> 10100
     or public.app_parse_scaled_unsigned('1.499',3,'weight') <> 1499 then
    raise exception 'D19 money/weight normalization mismatch';
  end if;
  actual := public.app_trip_totals(1000,9007199254741000,9007199254741000,0);
  if actual->>'contractor_total_piastres' <> '9007199254741000' then
    raise exception 'D19 lost large-integer precision';
  end if;
  if not exists (select 1 from pg_constraint where conname='payment_whole_pounds')
     or not exists (select 1 from pg_constraint where conname='opening_whole_pounds')
     or not exists (select 1 from pg_constraint where conname='trip_whole_pounds') then
    raise exception 'D19 whole-pound write constraints missing';
  end if;
  begin
    perform public.app_parse_scaled_unsigned('92233720368547758.08',2,'amount');
    raise exception 'D19 raw overflow bypassed validation by rounding down';
  exception when numeric_value_out_of_range then null;
  end;
end;
$$;

do $$
declare
  item record;
  caught text;
begin
  for item in select * from (values
    ('payments','amount_piastres','payment_whole_pounds'),
    ('opening_balances','signed_piastres','opening_whole_pounds'),
    ('trips','contractor_total_piastres','trip_whole_pounds')
  ) as cases(table_name,column_name,constraint_name) loop
    begin
      execute format('update public.%I set %I=101 where id=(select id from public.%I limit 1)',
        item.table_name,item.column_name,item.table_name);
      raise exception 'D19 fractional write unexpectedly succeeded on %',item.table_name;
    exception when check_violation then
      get stacked diagnostics caught = constraint_name;
      if caught <> item.constraint_name then raise exception 'Wrong constraint rejected D19 input: %',caught; end if;
    end;
  end loop;
end;
$$;
