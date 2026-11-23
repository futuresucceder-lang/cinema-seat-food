-- SeatBite production security hardening
-- Apply only after reviewing the matching application changes in this branch.

begin;

-- Customer order access uses a random bearer token, never a public table SELECT.
alter table public.orders
  add column if not exists tracking_token uuid not null default gen_random_uuid();

create unique index if not exists orders_tracking_token_key
  on public.orders (tracking_token);

-- Remove broad policies that expose or mutate cross-cinema records.
drop policy if exists "Allow food court to read orders" on public.orders;
drop policy if exists "Managers and food court can read orders" on public.orders;
drop policy if exists "Managers and food court can update orders" on public.orders;
drop policy if exists "Allow customers to create orders" on public.orders;
drop policy if exists "authenticated can insert orders" on public.orders;

create policy "Staff can read orders in their cinema"
on public.orders for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('manager', 'food_court')
  and cinema_id::text = auth.jwt() -> 'app_metadata' ->> 'cinema_id'
);

create policy "Staff can update orders in their cinema"
on public.orders for update to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('manager', 'food_court')
  and cinema_id::text = auth.jwt() -> 'app_metadata' ->> 'cinema_id'
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('manager', 'food_court')
  and cinema_id::text = auth.jwt() -> 'app_metadata' ->> 'cinema_id'
);

create policy "Customers can create valid cinema orders"
on public.orders for insert to anon
with check (
  cinema_id is not null
  and exists (
    select 1 from public.cinemas c
    where c.id = orders.cinema_id and c.is_active = true
  )
  and coalesce(total, 0) >= 0
  and delivery_option in ('NOW', 'INTERVAL')
  and tracking_token is not null
);

-- No anonymous/authenticated direct order reads. Customers use narrowly-scoped RPCs.
drop policy if exists "Managers can delete food items" on public.food_items;
drop policy if exists "Managers can insert food items" on public.food_items;
drop policy if exists "Managers can update food items" on public.food_items;
drop policy if exists "Allow public read access on food_items" on public.food_items;

create policy "Public can view available items at active cinemas"
on public.food_items for select to anon, authenticated
using (
  is_available = true
  and exists (
    select 1 from public.cinemas c
    where c.id = food_items.cinema_id and c.is_active = true
  )
);

create policy "Managers can view their cinema food items"
on public.food_items for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = auth.jwt() -> 'app_metadata' ->> 'cinema_id'
);

create policy "Managers can insert food items for their cinema"
on public.food_items for insert to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = auth.jwt() -> 'app_metadata' ->> 'cinema_id'
);

create policy "Managers can update food items in their cinema"
on public.food_items for update to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = auth.jwt() -> 'app_metadata' ->> 'cinema_id'
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = auth.jwt() -> 'app_metadata' ->> 'cinema_id'
);

create policy "Managers can delete food items in their cinema"
on public.food_items for delete to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = auth.jwt() -> 'app_metadata' ->> 'cinema_id'
);

-- Public QR customers do not need direct access to the screen/seat tables.
drop policy if exists "Public and staff can view screens" on public.screens;
drop policy if exists "Public can view all seats" on public.seats;

-- Staff order dashboard queries and cinema menu queries.
create index if not exists food_items_cinema_available_created_idx
  on public.food_items (cinema_id, is_available, created_at);
create index if not exists screens_cinema_id_idx
  on public.screens (cinema_id);
create index if not exists orders_cinema_status_created_idx
  on public.orders (cinema_id, status, created_at desc);

-- Only return the small set of fields customers need to track their own order.
create or replace function public.get_customer_order(p_tracking_token uuid)
returns table (
  order_code text,
  cinema_id uuid,
  screen text,
  seat text,
  food_items jsonb,
  total numeric,
  status text,
  created_at timestamptz,
  delivery_option text
)
language sql
security definer
set search_path = public
as $$
  select o.order_code, o.cinema_id, o.screen, o.seat, o.food_items,
         o.total, o.status, o.created_at, o.delivery_option
  from public.orders o
  where o.tracking_token = p_tracking_token
  limit 1;
$$;

create or replace function public.get_customer_orders(p_tracking_tokens uuid[])
returns table (
  tracking_token uuid,
  order_code text,
  cinema_id uuid,
  screen text,
  seat text,
  food_items jsonb,
  total numeric,
  status text,
  created_at timestamptz,
  delivery_option text
)
language sql
security definer
set search_path = public
as $$
  select o.tracking_token, o.order_code, o.cinema_id, o.screen, o.seat, o.food_items,
         o.total, o.status, o.created_at, o.delivery_option
  from public.orders o
  where o.tracking_token = any(coalesce(p_tracking_tokens, array[]::uuid[]))
  order by o.created_at desc
  limit 100;
$$;

revoke all on function public.get_customer_order(uuid) from public;
revoke all on function public.get_customer_orders(uuid[]) from public;
grant execute on function public.get_customer_order(uuid) to anon, authenticated;
grant execute on function public.get_customer_orders(uuid[]) to anon, authenticated;

commit;
