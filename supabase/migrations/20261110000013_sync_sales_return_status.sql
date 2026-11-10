-- Keep the invoice lifecycle status in sync with sale return records.
create or replace function public.sync_sale_invoice_return_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  v_returned numeric := 0;
  v_total numeric := 0;
begin
  if v_invoice_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select coalesce(sum(total_amount), 0) into v_returned
    from public.return_records
   where invoice_id = v_invoice_id and type = 'sale';

  select total into v_total from public.invoices where id = v_invoice_id;

  if v_total is not null and v_returned >= v_total then
    update public.invoices set status = 'returned_full', updated_at = now() where id = v_invoice_id;
  elsif v_returned > 0 then
    update public.invoices set status = 'returned_partial', updated_at = now() where id = v_invoice_id;
  else
    update public.invoices
       set status = case when paid >= total then 'paid' else 'pending' end,
           updated_at = now()
     where id = v_invoice_id and status in ('returned_partial', 'returned_full');
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists sync_sale_invoice_return_status_trigger on public.return_records;
create trigger sync_sale_invoice_return_status_trigger
after insert or update or delete on public.return_records
for each row execute function public.sync_sale_invoice_return_status();
