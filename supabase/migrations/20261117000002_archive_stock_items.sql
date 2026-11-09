-- Soft-delete (archive) support for stock items.
alter table public.stock_items
  add column if not exists archived boolean not null default false;

create index if not exists idx_stock_items_user_archived on public.stock_items (user_id, archived);
