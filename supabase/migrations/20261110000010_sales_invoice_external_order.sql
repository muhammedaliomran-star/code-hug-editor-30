-- Store an external order/reference number on POS invoices.
alter table public.invoices
  add column if not exists external_order_number text;

create index if not exists invoices_user_external_order_idx
  on public.invoices(user_id, external_order_number)
  where external_order_number is not null;

create or replace function public.create_sale_with_workflow_v3(
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
  p_source text default 'pos',
  p_external_order_number text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_invoice_id uuid;
begin
  v_invoice_id := public.create_sale_with_workflow_v2(
    p_customer_id, p_total, p_down_payment, p_monthly_installment,
    p_first_due_date, p_notes, p_discount_pct, p_discount_amount,
    p_tax_pct, p_tax_amount, p_status, p_paid, p_items, p_invoice_id,
    p_down_payment_method, p_down_payment_account_id, p_down_payment_reference,
    p_split_cash_amount, p_split_electronic_amount, p_split_electronic_method,
    p_shipment, p_branch_id, p_cashier_id, p_source
  );

  update public.invoices
     set external_order_number = nullif(trim(p_external_order_number), '')
   where id = v_invoice_id and user_id = auth.uid();
  return v_invoice_id;
end;
$$;

revoke all on function public.create_sale_with_workflow_v3(uuid,numeric,numeric,numeric,date,text,numeric,numeric,numeric,numeric,text,numeric,jsonb,uuid,text,text,text,numeric,numeric,text,jsonb,uuid,uuid,text,text) from public, anon;
grant execute on function public.create_sale_with_workflow_v3(uuid,numeric,numeric,numeric,date,text,numeric,numeric,numeric,numeric,text,numeric,jsonb,uuid,text,text,text,numeric,numeric,text,jsonb,uuid,uuid,text,text) to authenticated;
