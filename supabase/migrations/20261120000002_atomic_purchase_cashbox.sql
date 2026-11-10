-- Keep cash purchases visible in the same database transaction as the invoice
-- and inventory changes. This table is compatible with the existing cashbox sync.
create table if not exists public.treasury_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id text,
  to_account_id text,
  type text not null,
  amount numeric(14,2) not null default 0,
  category text,
  description text,
  reference_number text,
  fee numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.treasury_transactions
  add column if not exists from_account_id text,
  add column if not exists to_account_id text,
  add column if not exists type text,
  add column if not exists amount numeric(14,2) default 0,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists reference_number text,
  add column if not exists fee numeric(14,2) default 0,
  add column if not exists created_at timestamptz default now();

create unique index if not exists treasury_transactions_purchase_ref_idx
  on public.treasury_transactions(user_id, reference_number)
  where reference_number like 'purchase:%';

alter table public.treasury_transactions enable row level security;
drop policy if exists "Users manage own treasury transactions" on public.treasury_transactions;
create policy "Users manage own treasury transactions" on public.treasury_transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.treasury_transactions to authenticated;
grant all on public.treasury_transactions to service_role;

create or replace function public.sync_purchase_cashbox_transaction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.payment_type = 'cash' and new.status = 'posted' and not new.deleted then
    insert into public.treasury_transactions(
      id, user_id, from_account_id, type, amount, category, description, reference_number, created_at
    ) values (
      new.id, new.user_id, 'acc-cash-main', 'manual_out', coalesce(new.total, 0), 'مشتريات',
      'شراء بضاعة — ' || coalesce((select name from public.suppliers where id = new.supplier_id), 'مورد'),
      'purchase:' || new.id::text, new.purchase_date::timestamptz
    )
    on conflict (id) do update set
      amount = excluded.amount, description = excluded.description,
      created_at = excluded.created_at, reference_number = excluded.reference_number;
  else
    delete from public.treasury_transactions
    where id = new.id and user_id = new.user_id and reference_number = 'purchase:' || new.id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_sync_cashbox_transaction on public.purchases;
create trigger purchases_sync_cashbox_transaction
after insert or update of payment_type, status, total, purchase_date, deleted on public.purchases
for each row execute function public.sync_purchase_cashbox_transaction();

-- Supplier payment rows remain separate cash movements and use a stable reference.
create or replace function public.sync_supplier_payment_cashbox_transaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_purchase public.purchases; v_ref text;
begin
  if tg_op = 'DELETE' then
    delete from public.treasury_transactions where id = old.id and user_id = old.user_id;
    return old;
  end if;
  select * into v_purchase from public.purchases where id = new.purchase_id and user_id = new.user_id;
  v_ref := 'purchase:' || coalesce(new.purchase_id::text, new.id::text) || ':payment:' || new.id::text;
  if new.purchase_id is not null and new.payment_method = 'cash' and not new.voided then
    insert into public.treasury_transactions(id, user_id, from_account_id, type, amount, category, description, reference_number, created_at)
    values(new.id, new.user_id, 'acc-cash-main', 'manual_out', new.amount, 'مشتريات', 'دفعة للمورد', v_ref, new.paid_at)
    on conflict (id) do update set amount = excluded.amount, created_at = excluded.created_at, reference_number = excluded.reference_number;
  else
    delete from public.treasury_transactions where id = new.id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_payments_sync_cashbox_transaction on public.supplier_payments;
create trigger supplier_payments_sync_cashbox_transaction
after insert or update of amount, paid_at, payment_method, purchase_id, voided or delete on public.supplier_payments
for each row execute function public.sync_supplier_payment_cashbox_transaction();
