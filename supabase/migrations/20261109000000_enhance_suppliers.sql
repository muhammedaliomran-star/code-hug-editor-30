-- Optional supplier profile fields used by the enhanced supplier form.
alter table public.suppliers
  add column if not exists supplier_code integer,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists category text,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists tax_number text,
  add column if not exists commercial_register text,
  add column if not exists preferred_contact_method text,
  add column if not exists preferred_payment_method text,
  add column if not exists payment_term_days integer not null default 0,
  add column if not exists credit_limit numeric(12,2) not null default 0,
  add column if not exists status text not null default 'active',
  add column if not exists joined_at date,
  add column if not exists attachment_url text;

update public.suppliers
set joined_at = created_at::date
where joined_at is null;

with numbered as (
  select id, row_number() over (order by created_at, id)::integer as code
  from public.suppliers
  where supplier_code is null
)
update public.suppliers s
set supplier_code = numbered.code
from numbered
where s.id = numbered.id;

create unique index if not exists idx_suppliers_user_code
  on public.suppliers (user_id, supplier_code)
  where supplier_code is not null;

alter table public.suppliers
  drop constraint if exists suppliers_status_check;

alter table public.suppliers
  add constraint suppliers_status_check check (status in ('active', 'paused'));
