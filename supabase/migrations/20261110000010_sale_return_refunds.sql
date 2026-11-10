-- Record refunds when a paid sale is returned.

create table if not exists public.invoice_refunds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  return_id uuid not null references public.return_records(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_method text not null default 'cash',
  account_id text,
  reference_number text,
  created_at timestamptz not null default now()
);
alter table public.invoice_refunds enable row level security;
drop policy if exists invoice_refunds_owner on public.invoice_refunds;
create policy invoice_refunds_owner on public.invoice_refunds for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.create_sale_return_with_refund(
  p_invoice_id uuid, p_reason text, p_items jsonb,
  p_payment_method text default 'cash', p_account_id text default null, p_reference_number text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_invoice public.invoices;
  v_return_id uuid;
  v_paid numeric;
  v_new_total numeric;
  v_refund numeric;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id and user_id = auth.uid() for update;
  if not found then raise exception 'الفاتورة غير موجودة أو غير مسموح'; end if;
  v_paid := v_invoice.paid;
  v_return_id := public.create_sale_return(p_invoice_id, p_reason, p_items);
  select total into v_new_total from public.invoices where id = p_invoice_id and user_id = auth.uid();
  v_refund := greatest(0, v_paid - v_new_total);
  if v_refund > 0 then
    insert into public.invoice_refunds(user_id, invoice_id, return_id, amount, payment_method, account_id, reference_number)
      values (auth.uid(), p_invoice_id, v_return_id, v_refund,
        coalesce(nullif(trim(p_payment_method), ''), 'cash'), p_account_id, nullif(trim(p_reference_number), ''));
    if coalesce(nullif(trim(p_payment_method), ''), 'cash') = 'cash' then
      insert into public.treasury_transactions(
        id, user_id, from_account_id, type, amount, category, description, reference_number, created_at
      ) values (
        gen_random_uuid(), auth.uid(), coalesce(p_account_id, 'acc-cash-main'), 'manual_out', v_refund,
        'مرتجع مبيعات', 'رد مبلغ مرتجع فاتورة', 'invoice-refund:' || v_return_id::text, now()
      );
    end if;
  end if;
  return v_return_id;
end;
$$;

revoke all on function public.create_sale_return_with_refund(uuid,text,jsonb,text,text,text) from public, anon;
grant execute on function public.create_sale_return_with_refund(uuid,text,jsonb,text,text,text) to authenticated;
