-- Issue #3: persist the expense's treasury account / branch on the expenses row
-- itself instead of relying on localStorage (client-only) or the meta blob
-- embedded in `expenses.notes`.
alter table public.expenses add column if not exists account_id text;
alter table public.expenses add column if not exists branch_id  text;

-- Backfill from expense_metadata when that table exists.
do $mig$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'expense_metadata'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'expense_metadata' and column_name = 'expense_id'
  ) then
    execute $q$
      update public.expenses e
         set account_id = coalesce(e.account_id, m.account_id),
             branch_id  = coalesce(e.branch_id,  m.branch_id)
        from public.expense_metadata m
       where m.expense_id = e.id
         and (e.account_id is null or e.branch_id is null)
    $q$;
  end if;
end $mig$;

-- Backfill from the legacy meta blob embedded in notes: <!--seg_meta:{"accountId":"..."}-->
update public.expenses
   set account_id = coalesce(account_id, nullif(substring(notes from '"accountId"\s*:\s*"([^"]+)"'), '')),
       branch_id  = coalesce(branch_id,  nullif(substring(notes from '"branchId"\s*:\s*"([^"]+)"'), ''))
 where notes like '%seg_meta:%'
   and (account_id is null or branch_id is null);

create index if not exists expenses_user_account_idx on public.expenses (user_id, account_id);
create index if not exists expenses_user_branch_idx  on public.expenses (user_id, branch_id);
