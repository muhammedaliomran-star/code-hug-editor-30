-- Product enhancements: image URL + supplier link.
alter table public.stock_items
  add column if not exists image_url text,
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists idx_stock_items_supplier on public.stock_items (supplier_id);
