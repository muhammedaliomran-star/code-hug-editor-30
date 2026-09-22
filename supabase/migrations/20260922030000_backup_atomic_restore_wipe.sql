-- Phase 2 (#15): atomic backup restore + wipe with server-side gates.
-- Both functions run in a single transaction: any error rolls everything back.

-- Gate helper: owner or manager (mirrors roles.ts ABILITIES for backups).
create or replace function public.assert_backup_manager()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'غير مصرح: سجّل الدخول أولاً';
  end if;
  if public.has_role(v_user, 'owner'::public.app_role) then
    return;
  end if;
  if public.has_role(v_user, 'manager'::public.app_role) then
    return;
  end if;
  raise exception 'النسخ الاحتياطي والمسح للمالك أو المدير فقط';
end;
$$;

revoke all on function public.assert_backup_manager() from public;
grant execute on function public.assert_backup_manager() to authenticated;

-- Atomic restore. Parents-first order satisfies immediate FK constraints.
-- Unknown columns are stripped, user_id is forced to the caller,
-- natural-key collisions (e.g. treasury local_key) count as skipped.
-- On any other error the whole transaction rolls back and nothing is written.
create or replace function public.restore_backup(
  p_tables jsonb,
  p_exported_by text default null,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_order text[] := array[
    'customers', 'suppliers', 'stock_items', 'expenses', 'branches',
    'shipping_carriers', 'payment_vouchers',
    'invoices', 'purchases', 'shipping_zones',
    'invoice_items', 'payments', 'invoice_installments',
    'purchase_items', 'supplier_payments',
    'return_records', 'return_items',
    'shipments', 'carrier_settlements', 'delivery_attempts',
    'stock_adjustments', 'stock_movements', 'shop_settings',
    'audit_events', 'audit_logs',
    'staff_members', 'staff_attendance', 'shifts',
    'treasury_accounts', 'treasury_manual_transactions',
    'treasury_transfers', 'treasury_denomination_audits',
    'collection_promises', 'collection_call_logs', 'held_invoices',
    'expense_metadata', 'recurring_expenses', 'category_budgets',
    'expense_settings', 'promo_coupons', 'qty_offers', 'bundles',
    'loyalty_config', 'licenses', 'admin_settings'
  ];
  v_key text;
  v_rows jsonb;
  v_row jsonb;
  v_clean jsonb;
  v_cols text[];
  v_has_user boolean;
  v_inserted int := 0;
  v_skipped int := 0;
  v_total int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_seen jsonb := '{}'::jsonb;
  v_id text;
  v_dup text;
begin
  perform public.assert_backup_manager();

  if p_tables is null or jsonb_typeof(p_tables) <> 'object' then
    raise exception 'بيانات الجداول ناقصة';
  end if;

  -- 1) Reject unknown tables up front
  for v_key in select jsonb_object_keys(p_tables) loop
    if not (v_key = any (v_order)) then
      v_errors := v_errors || jsonb_build_object('table', v_key, 'error', 'جدول غير معروف — لن يُستورد');
    end if;
  end loop;

  -- 2) Per-table shape + duplicate-id validation
  foreach v_key in array v_order loop
    v_rows := p_tables -> v_key;
    if v_rows is null then continue; end if;
    if jsonb_typeof(v_rows) <> 'array' then
      v_errors := v_errors || jsonb_build_object('table', v_key, 'error', 'بيانات الجدول غير صالحة');
      continue;
    end if;
    v_total := v_total + jsonb_array_length(v_rows);
    for v_row in select * from jsonb_array_elements(v_rows) loop
      if jsonb_typeof(v_row) <> 'object' or not (v_row ? 'id') or jsonb_typeof(v_row -> 'id') <> 'string' then
        v_errors := v_errors || jsonb_build_object('table', v_key, 'error', 'سجل بدون معرّف صالح');
        continue;
      end if;
      v_id := v_row ->> 'id';
      if v_seen ? v_key and (v_seen -> v_key) ? v_id then
        v_errors := v_errors || jsonb_build_object('table', v_key, 'error', 'معرّف مكرر داخل النسخة');
      else
        v_seen := jsonb_set(v_seen, array[v_key], coalesce(v_seen -> v_key, '{}'::jsonb) || jsonb_build_object(v_id, true));
      end if;
    end loop;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    return jsonb_build_object(
      'ok', false, 'tableCount', (select count(*) from jsonb_object_keys(p_tables)),
      'totalRows', v_total, 'inserted', 0, 'skipped', 0, 'failed', v_errors
    );
  end if;

  if p_dry_run then
    return jsonb_build_object(
      'ok', true, 'tableCount', (select count(*) from jsonb_object_keys(p_tables)),
      'totalRows', v_total, 'inserted', 0, 'skipped', 0, 'failed', '[]'::jsonb
    );
  end if;

  -- 3) Insert parents-first; any failure aborts the whole transaction
  foreach v_key in array v_order loop
    v_rows := p_tables -> v_key;
    if v_rows is null or jsonb_array_length(v_rows) = 0 then continue; end if;
    select array_agg(c.column_name) into v_cols
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = v_key;
    select exists(
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = v_key and c.column_name = 'user_id'
    ) into v_has_user;
    for v_row in select * from jsonb_array_elements(v_rows) loop
      select jsonb_object_agg(j.k, j.v) into v_clean
      from jsonb_each(v_row) as j(k, v)
      where j.k = any (v_cols);
      if v_has_user then
        v_clean := v_clean || jsonb_build_object('user_id', v_user::text);
      end if;
      begin
        execute format(
          'insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)',
          v_key, v_key
        ) using jsonb_build_array(v_clean);
        v_inserted := v_inserted + 1;
      exception
        when unique_violation then
          v_skipped := v_skipped + 1;
        when others then
          raise exception 'فشل إدخال سجل في %: %', v_key, sqlerrm;
      end;
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true, 'exportedBy', p_exported_by,
    'tableCount', (select count(*) from jsonb_object_keys(p_tables)),
    'totalRows', v_total, 'inserted', v_inserted, 'skipped', v_skipped,
    'failed', '[]'::jsonb
  );
end;
$$;

revoke all on function public.restore_backup(jsonb, text, boolean) from public;
grant execute on function public.restore_backup(jsonb, text, boolean) to authenticated;

-- Atomic wipe. Child-first order; per-table counts returned.
-- Any failure rolls everything back.
create or replace function public.wipe_user_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_order text[] := array[
    'admin_settings', 'licenses', 'loyalty_config', 'bundles', 'qty_offers',
    'promo_coupons', 'expense_settings', 'category_budgets', 'recurring_expenses',
    'expense_metadata', 'held_invoices', 'collection_call_logs', 'collection_promises',
    'shifts', 'staff_attendance', 'staff_members',
    'treasury_denomination_audits', 'treasury_transfers', 'treasury_manual_transactions',
    'treasury_accounts', 'invoice_installments', 'audit_logs', 'audit_events',
    'delivery_attempts', 'carrier_settlements', 'shipments', 'shipping_zones',
    'shipping_carriers', 'stock_movements', 'return_items', 'return_records',
    'payment_vouchers', 'branches', 'shop_settings', 'expenses', 'supplier_payments',
    'purchase_items', 'purchases', 'stock_adjustments', 'stock_items',
    'invoice_items', 'invoices', 'payments', 'customers', 'suppliers'
  ];
  v_t text;
  v_n int;
  v_deleted jsonb := '{}'::jsonb;
  v_has_user boolean;
begin
  perform public.assert_backup_manager();

  foreach v_t in array v_order loop
    select exists(
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = v_t and c.column_name = 'user_id'
    ) into v_has_user;
    if not v_has_user then continue; end if;
    execute format('delete from public.%I where user_id = $1', v_t) using v_user;
    get diagnostics v_n = row_count;
    v_deleted := v_deleted || jsonb_build_object(v_t, v_n);
  end loop;

  return jsonb_build_object('ok', true, 'deleted', v_deleted);
end;
$$;

revoke all on function public.wipe_user_data() from public;
grant execute on function public.wipe_user_data() to authenticated;
