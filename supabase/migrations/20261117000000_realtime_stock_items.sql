-- Extend Supabase Realtime publication to cover stock_items, so the
-- Products page receives live updates across devices.
-- Idempotent: safe to run even if the table is already published.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_items'
  ) then
    alter publication supabase_realtime add table public.stock_items;
  end if;
end $$;
