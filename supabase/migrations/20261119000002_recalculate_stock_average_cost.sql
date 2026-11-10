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
  set last_unit_cost = case when v_qty > 0 then round(v_value / v_qty, 2) else last_unit_cost end,
      updated_at = now()
  where id = p_stock_item_id;
end;
$$;

-- The application calls this helper only after a complete movement-backed
-- operation. We intentionally do not install a global trigger or rewrite all
-- existing products: legacy products may predate stock_movements and their
-- current cost must not be reset to zero.
