-- Stable, read-only product sequence for inventory items.
-- Existing rows are numbered by creation order; future rows continue from the same sequence.
alter table public.stock_items
  add column if not exists product_code bigint;

do $$
begin
  if not exists (select 1 from pg_class where relname = 'stock_product_code_seq') then
    create sequence public.stock_product_code_seq;
  end if;
end $$;

with numbered as (
  select id,
         row_number() over (partition by user_id order by created_at asc, id asc) as code
  from public.stock_items
  where product_code is null
)
update public.stock_items s
set product_code = numbered.code
from numbered
where s.id = numbered.id;

alter table public.stock_items
  alter column product_code set not null,
  alter column product_code set default nextval('public.stock_product_code_seq');

select setval(
  'public.stock_product_code_seq',
  greatest(coalesce((select max(product_code) from public.stock_items), 0), 1),
  true
);

create unique index if not exists stock_items_product_code_user_idx
  on public.stock_items (user_id, product_code);

comment on column public.stock_items.product_code is 'Automatic immutable product sequence displayed before the product name.';
