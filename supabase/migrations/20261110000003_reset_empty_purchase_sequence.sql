-- Reset the purchase sequence only after the last physical purchase row is deleted.
-- Archived invoices remain rows, so their numbering is never reused accidentally.

create or replace function public.reset_empty_purchase_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.purchases
    where user_id = old.user_id
  ) then
    update public.purchase_number_counters
    set next_number = 1
    where user_id = old.user_id;
  end if;

  return old;
end;
$$;

drop trigger if exists reset_empty_purchase_sequence_after_delete
on public.purchases;

create trigger reset_empty_purchase_sequence_after_delete
after delete on public.purchases
for each row
execute function public.reset_empty_purchase_sequence();

-- Repair accounts that already deleted every purchase before this migration.
update public.purchase_number_counters c
set next_number = 1
where not exists (
  select 1
  from public.purchases p
  where p.user_id = c.user_id
);
