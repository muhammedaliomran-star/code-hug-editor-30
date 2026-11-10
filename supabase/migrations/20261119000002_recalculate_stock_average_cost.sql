-- Keep stock average cost correct after purchases, reversals and supplier returns.

create or replace function public.recalculate_stock_average_cost(p_stock_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty numeric;
  v_value numeric;
begin
  select coalesce(sum(quantity), 0), coalesce(sum(quantity * unit_cost), 0)
  into v_qty, v_value
  from public.stock_movements
  where stock_item_id = p_stock_item_id
    and movement_type in ('purchase', 'reversal', 'return');

  update public.stock_items
  set last_unit_cost = case when v_qty > 0 then round(v_value / v_qty, 2) else 0 end,
      updated_at = now()
  where id = p_stock_item_id;
end;
$$;

create or replace function public.stock_movement_recalculate_average_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_stock_average_cost(old.stock_item_id);
    return old;
  end if;
  perform public.recalculate_stock_average_cost(new.stock_item_id);
  if tg_op = 'UPDATE' and old.stock_item_id is distinct from new.stock_item_id then
    perform public.recalculate_stock_average_cost(old.stock_item_id);
  end if;
  return new;
end;
$$;

drop trigger if exists stock_movement_average_cost_trigger on public.stock_movements;
create trigger stock_movement_average_cost_trigger
after insert or update or delete on public.stock_movements
for each row execute function public.stock_movement_recalculate_average_cost();

-- Repair existing products once using their movement ledger.
do $$
declare v_stock record;
begin
  for v_stock in select id from public.stock_items loop
    perform public.recalculate_stock_average_cost(v_stock.id);
  end loop;
end;
$$;
