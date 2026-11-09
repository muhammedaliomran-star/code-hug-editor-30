-- Customer profile preferences used by the new customer dialog.
alter table public.customers
  add column if not exists customer_code bigint,
  add column if not exists paper_ledger_number text,
  add column if not exists customer_segment text not null default 'regular',
  add column if not exists assigned_staff_id text,
  add column if not exists preferred_contact text not null default 'whatsapp',
  add column if not exists preferred_payment_method text not null default 'cash',
  add column if not exists debt_alert_threshold bigint not null default 0,
  add column if not exists due_notifications boolean not null default true,
  add column if not exists tags text[] not null default '{}';

comment on column public.customers.customer_segment is 'Customer classification: regular, vip, wholesale, retail, or new';
comment on column public.customers.assigned_staff_id is 'Local staff member id responsible for this customer';

with ranked_customers as (
  select id, row_number() over (partition by user_id order by created_at, id) as code
  from public.customers
  where customer_code is null
)
update public.customers c
set customer_code = ranked_customers.code
from ranked_customers
where c.id = ranked_customers.id;

create or replace function public.assign_customer_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(coalesce(new.user_id::text, ''), 0));
    select coalesce(max(customer_code), 0) + 1
      into new.customer_code
      from public.customers
     where user_id = new.user_id;
  elsif tg_op = 'UPDATE' and new.customer_code is distinct from old.customer_code then
    new.customer_code := old.customer_code;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_assign_code on public.customers;
create trigger customers_assign_code
before insert or update of customer_code on public.customers
for each row execute function public.assign_customer_code();

create unique index if not exists customers_user_customer_code_uidx
  on public.customers (user_id, customer_code);
