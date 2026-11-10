-- Persist operational metadata for cashier-created sales invoices.
alter table public.invoices
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists cashier_id uuid references auth.users(id) on delete set null,
  add column if not exists source text not null default 'pos';

create index if not exists invoices_user_branch_idx on public.invoices(user_id, branch_id, created_at desc);
create index if not exists invoices_user_source_idx on public.invoices(user_id, source, created_at desc);

create or replace function public.create_sale_with_workflow_v2(
  p_customer_id uuid,
  p_total numeric,
  p_down_payment numeric,
  p_monthly_installment numeric,
  p_first_due_date date,
  p_notes text,
  p_discount_pct numeric,
  p_discount_amount numeric,
  p_tax_pct numeric,
  p_tax_amount numeric,
  p_status text,
  p_paid numeric,
  p_items jsonb,
  p_invoice_id uuid,
  p_down_payment_method text default 'cash',
  p_down_payment_account_id text default null,
  p_down_payment_reference text default null,
  p_split_cash_amount numeric default 0,
  p_split_electronic_amount numeric default 0,
  p_split_electronic_method text default null,
  p_shipment jsonb default null,
  p_branch_id uuid default null,
  p_cashier_id uuid default null,
  p_source text default 'pos'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_invoice_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches where id = p_branch_id and user_id = auth.uid()
  ) then raise exception 'الفرع غير موجود أو غير مسموح'; end if;
  if p_cashier_id is not null and p_cashier_id <> auth.uid() then
    raise exception 'الكاشير غير مسموح';
  end if;

  v_invoice_id := public.create_sale_with_workflow(
    p_customer_id, p_total, p_down_payment, p_monthly_installment,
    p_first_due_date, p_notes, p_discount_pct, p_discount_amount,
    p_tax_pct, p_tax_amount, p_status, p_paid, p_items, p_invoice_id,
    p_down_payment_method, p_down_payment_account_id, p_down_payment_reference,
    p_split_cash_amount, p_split_electronic_amount, p_split_electronic_method,
    p_shipment
  );

  update public.invoices
     set branch_id = p_branch_id,
         cashier_id = coalesce(p_cashier_id, auth.uid()),
         source = coalesce(nullif(trim(p_source), ''), 'pos')
   where id = v_invoice_id and user_id = auth.uid();
  return v_invoice_id;
end;
$$;

revoke all on function public.create_sale_with_workflow_v2(uuid,numeric,numeric,numeric,date,text,numeric,numeric,numeric,numeric,text,numeric,jsonb,uuid,text,text,text,numeric,numeric,text,jsonb,uuid,uuid,text) from public, anon;
grant execute on function public.create_sale_with_workflow_v2(uuid,numeric,numeric,numeric,date,text,numeric,numeric,numeric,numeric,text,numeric,jsonb,uuid,text,text,text,numeric,numeric,text,jsonb,uuid,uuid,text) to authenticated;
