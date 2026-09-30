-- =============================================================
-- verify_rls_negative.sql — اختبارات RLS سلبية (fail-fast)
-- شغّل ده في Supabase Dashboard > SQL Editor (كمستخدم postgres).
-- أي فحص يفشل يرمي EXCEPTION ويوقف السكربت ( pancake rollback تلقائي).
-- الفحص الناجح يطبع NOTICE. التنظيف تلقائي في النهاية.
-- =============================================================

-- Test identities (fake UUIDs — never real users)
-- A and B own one customer each; C has no roles at all.
DO $$ BEGIN RAISE NOTICE '--- SETUP: test rows ---'; END $$;

insert into public.customers (id, user_id, name)
values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'RLS_TEST_A'),
  ('a0000000-0000-4000-8000-000000000002', '22222222-2222-2222-2222-222222222222', 'RLS_TEST_B')
on conflict (id) do nothing;

-- ==================== 1. عزل القراءة: A لا يرى بيانات B ====================
DO $$
declare
  v_count integer;
  v_owner uuid;
begin
  set role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

  select count(*) into v_count from public.customers;
  if v_count <> 1 then
    raise exception 'FAIL: user A sees % customers, expected exactly 1 (own)', v_count;
  end if;

  select user_id into v_owner from public.customers limit 1;
  if v_owner <> '11111111-1111-1111-1111-111111111111'::uuid then
    raise exception 'FAIL: user A sees another user data';
  end if;

  -- A must see ZERO rows belonging to B, even with explicit filter
  select count(*) into v_count from public.customers
  where user_id = '22222222-2222-2222-2222-222222222222';
  if v_count <> 0 then
    raise exception 'FAIL: user A can read user B rows';
  end if;

  reset role;
  raise notice 'PASS: read isolation (A sees only own row)';
end $$;

-- ==================== 2. عزل الكتابة: A لا يعدّل/يحذف صف B ====================
DO $$
declare
  v_n integer;
begin
  set role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

  update public.customers set name = 'HACKED'
  where id = 'a0000000-0000-4000-8000-000000000002';
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'FAIL: user A updated user B row';
  end if;

  delete from public.customers
  where id = 'a0000000-0000-4000-8000-000000000002';
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'FAIL: user A deleted user B row';
  end if;

  -- A cannot smuggle another owner_id on insert (WITH CHECK)
  begin
    insert into public.customers (user_id, name)
    values ('22222222-2222-2222-2222-222222222222', 'RLS_TEST_SMUGGLER');
    raise exception 'FAIL: user A inserted a row owned by B';
  exception when insufficient_privilege then
    -- expected: RLS WITH CHECK blocked it
    null;
  end;

  reset role;
  raise notice 'PASS: write isolation (update/delete/insert-as-other blocked)';
end $$;

-- ==================== 3. الشحنات: لا تسرب عبر-مستأجر على بيانات حية ====================
DO $$
declare
  v_count integer;
begin
  set role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

  -- The critical Phase-0 hole: permissive USING(true) would leak ALL rows.
  -- A owns no shipments, so any visible foreign row = leak.
  select count(*) into v_count from public.shipments
  where user_id <> '11111111-1111-1111-1111-111111111111';
  if v_count <> 0 then
    raise exception 'FAIL: user A sees % foreign shipments (permissive policy leak)', v_count;
  end if;

  reset role;
  raise notice 'PASS: shipments cross-tenant isolation on live data';
end $$;

-- ==================== 4. الأدوار: لا ترقية ذاتية + لا تعداد ====================
DO $$
declare
  v_has_owner boolean;
begin
  -- If live already has an owner, self-grant must be rejected.
  -- (If no owner exists at all, Bootstrap legitimately allows first insert —
  --  that case is skipped, not failed.)
  select exists (select 1 from public.user_roles where role = 'owner')
  into v_has_owner;

  set role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

  -- A (fake user, no rows) must not enumerate anyone's roles
  if (select count(*) from public.user_roles) <> 0 then
    reset role;
    raise exception 'FAIL: user A can read other users roles';
  end if;

  if v_has_owner then
    begin
      insert into public.user_roles (user_id, role)
      values ('11111111-1111-1111-1111-111111111111', 'owner');
      reset role;
      raise exception 'FAIL: user A granted themselves owner';
    exception when insufficient_privilege then
      null; -- expected
    end;
    raise notice 'PASS: self-escalation rejected (owner exists live)';
  else
    raise notice 'SKIP: self-escalation test (no live owner; Bootstrap would allow first insert by design)';
  end if;

  reset role;
end $$;

-- ==================== 5. بوابات RPC: غير المالك مرفوض ====================
DO $$
begin
  -- C has no roles at all: both destructive RPCs must raise the gate error.
  set role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

  begin
    perform public.wipe_user_data();
    reset role;
    raise exception 'FAIL: non-owner executed wipe_user_data';
  exception when others then
    if sqlerrm not like '%المالك أو المدير%' then
      reset role;
      raise;
    end if;
  end;

  begin
    perform public.restore_backup('{}'::jsonb);
    reset role;
    raise exception 'FAIL: non-owner executed restore_backup';
  exception when others then
    if sqlerrm not like '%المالك أو المدير%' then
      reset role;
      raise;
    end if;
  end;

  reset role;
  raise notice 'PASS: RPC gates reject non-owner/manager';
end $$;

-- ==================== 6. المجهول: صفر بيانات ====================
DO $$
declare
  v_count integer;
begin
  set role anon;
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_count from public.customers;
  if v_count <> 0 then
    reset role;
    raise exception 'FAIL: anon reads % customers', v_count;
  end if;

  select count(*) into v_count from public.user_roles;
  if v_count <> 0 then
    reset role;
    raise exception 'FAIL: anon reads user_roles';
  end if;

  reset role;
  raise notice 'PASS: anon sees nothing (except intentional public surfaces)';
end $$;

-- ==================== تنظيف ====================
delete from public.customers
where id in (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002'
);

DO $$ BEGIN RAISE NOTICE '--- ALL RLS NEGATIVE TESTS PASSED ---'; END $$;
