-- Seat Bite tenant isolation and private customer order access.
-- Apply only after deploying the matching customer API changes.
begin;

-- Food items remain publicly readable for QR menus, but all writes are
-- restricted to the manager's trusted app_metadata cinema_id.
drop policy if exists "Managers can delete food items" on public.food_items;
drop policy if exists "Managers can insert food items" on public.food_items;
drop policy if exists "Managers can update food items" on public.food_items;

create policy "Managers can delete food items in their cinema"
on public.food_items for delete to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
);

create policy "Managers can insert food items in their cinema"
on public.food_items for insert to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
);

create policy "Managers can update food items in their cinema"
on public.food_items for update to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
);

-- Remove broad anonymous order reads and unvalidated client-side inserts.
drop policy if exists "Allow food court to read orders" on public.orders;
drop policy if exists "Managers and food court can read orders" on public.orders;
drop policy if exists "Managers and food court can update orders" on public.orders;
drop policy if exists "Allow customers to create orders" on public.orders;
drop policy if exists "authenticated can insert orders" on public.orders;

-- Authenticated staff can only read/update orders assigned to their cinema.
create policy "Cinema staff can read their cinema orders"
on public.orders for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('manager', 'food_court')
  and cinema_id is not null
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
);

create policy "Cinema staff can update their cinema orders"
on public.orders for update to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('manager', 'food_court')
  and cinema_id is not null
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('manager', 'food_court')
  and cinema_id is not null
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
);

create index if not exists orders_cinema_created_at_idx
on public.orders (cinema_id, created_at desc);

commit;
