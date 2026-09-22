-- =============================================================
-- APPLY_PENDING_SECURITY.sql — سكربت مجمّع واحد لكل المعلّق أمنياً
-- انسخ الملف كاملاً والصقه في Supabase Dashboard > SQL Editor ثم Run.
-- كل الأوامر idempotent: آمن إعادة تشغيله.
-- الترتيب مهم: البوابات أولاً، ثم دوال النسخ، ثم تنظيف البقايا.
-- =============================================================

-- ==================== الجزء 1: إغلاق الثغرات الحرجة ====================

create or replace function public.sync_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.sync_set_updated_at() from public;
grant execute on function public.sync_set_updated_at() to authenticated;
grant execute on function public.sync_set_updated_at() to service_role;

-- 1. الشحنات: حذف السياسة المفتوحة (أي مستخدم يرى شحنات أي محل)
drop policy if exists "Allow authenticated full access to shipments"
  on public.shipments;

-- 2. الأدوار: حذف الترقية الذاتية (أي مستخدم يمنح نفسه owner)
drop policy if exists "Users manage own roles"
  on public.user_roles;

-- Bootstrap المالك الأول (SECURITY DEFINER حتى لا يُخدع)
create or replace function public.no_owner_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.user_roles where role = 'owner');
$$;

revoke all on function public.no_owner_exists() from public;
grant execute on function public.no_owner_exists() to authenticated;

drop policy if exists "Bootstrap first owner" on public.user_roles;
create policy "Bootstrap first owner" on public.user_roles
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and role = 'owner'::public.app_role
    and public.no_owner_exists()
  );

-- 3. جدول shifts (تزامن الورديات يكتبه فعلياً ولا وجود له)
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  shift_number integer not null default 0,
  cashier_name text,
  opened_at timestamptz,
  closed_at timestamptz,
  opening_balance numeric not null default 0,
  expected_cash numeric not null default 0,
  actual_cash numeric not null default 0,
  cash_sales numeric not null default 0,
  electronic_sales numeric not null default 0,
  installment_sales numeric not null default 0,
  expenses numeric not null default 0,
  purchases numeric not null default 0,
  returns numeric not null default 0,
  variance numeric not null default 0,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The table may already exist live without some columns (created
-- out-of-band). Add every column the sync payloads use, idempotently —
-- otherwise CREATE INDEX (updated_at) below fails and rolls back everything.
alter table public.shifts add column if not exists user_id uuid;
alter table public.shifts add column if not exists shift_number integer not null default 0;
alter table public.shifts add column if not exists cashier_name text;
alter table public.shifts add column if not exists opened_at timestamptz;
alter table public.shifts add column if not exists closed_at timestamptz;
alter table public.shifts add column if not exists opening_balance numeric not null default 0;
alter table public.shifts add column if not exists expected_cash numeric not null default 0;
alter table public.shifts add column if not exists actual_cash numeric not null default 0;
alter table public.shifts add column if not exists cash_sales numeric not null default 0;
alter table public.shifts add column if not exists electronic_sales numeric not null default 0;
alter table public.shifts add column if not exists installment_sales numeric not null default 0;
alter table public.shifts add column if not exists expenses numeric not null default 0;
alter table public.shifts add column if not exists purchases numeric not null default 0;
alter table public.shifts add column if not exists returns numeric not null default 0;
alter table public.shifts add column if not exists variance numeric not null default 0;
alter table public.shifts add column if not exists status text not null default 'open';
alter table public.shifts add column if not exists notes text;
alter table public.shifts add column if not exists created_at timestamptz not null default now();
alter table public.shifts add column if not exists updated_at timestamptz not null default now();

alter table public.shifts enable row level security;

drop policy if exists "Users manage own shifts" on public.shifts;
create policy "Users manage own shifts" on public.shifts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_updated_at_shifts on public.shifts;
create trigger set_updated_at_shifts
  before update on public.shifts
  for each row execute function public.sync_set_updated_at();

create index if not exists idx_shifts_user_opened on public.shifts (user_id, opened_at desc);
create index if not exists idx_shifts_updated_at on public.shifts (updated_at);

-- ==================== الجزء 2: دوال النسخ الذرية ====================

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
begin
  perform public.assert_backup_manager();

  if p_tables is null or jsonb_typeof(p_tables) <> 'object' then
    raise exception 'بيانات الجداول ناقصة';
  end if;

  for v_key in select jsonb_object_keys(p_tables) loop
    if not (v_key = any (v_order)) then
      v_errors := v_errors || jsonb_build_object('table', v_key, 'error', 'جدول غير معروف — لن يُستورد');
    end if;
  end loop;

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
      if (v_seen -> v_key) ? v_id then
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

-- ==================== الجزء 3: تنظيف بقايا المتجر ====================

drop policy if exists "Public storefront product images are readable"
  on storage.objects;
drop policy if exists "Merchants upload storefront product images"
  on storage.objects;
drop policy if exists "Merchants update storefront product images"
  on storage.objects;
drop policy if exists "Merchants delete storefront product images"
  on storage.objects;

-- NOTE: Supabase blocks direct DELETEs on storage.objects
-- (storage.protect_delete). Dropping the 4 policies above is sufficient:
-- with no SELECT policy, the orphaned objects become completely
-- inaccessible. Delete the empty bucket itself from Dashboard >
-- Storage UI if desired (the UI uses the Storage API).

-- ==================== تحقق سريع (اختياري بعد التنفيذ) ====================
-- select policyname from pg_policies where tablename = 'shipments';
--   المتوقع: Users manage own shipments فقط
-- select policyname from pg_policies where tablename = 'user_roles';
--   المتوقع: Users can view own roles + Bootstrap first owner فقط
-- select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--   and p.proname in ('restore_backup','wipe_user_data','assert_backup_manager','no_owner_exists');
--   المتوقع: 4 صفوف
