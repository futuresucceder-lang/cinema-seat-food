-- SeatBite production security hardening
-- Apply only after reviewing the matching application changes in this branch.

begin;

-- Customer order access uses a random bearer token, never a public table SELECT.
alter table public.orders
  add column if not exists tracking_token uuid not null default gen_random_uuid();

create unique index if not exists orders_tracking_token_key
  on public.orders (tracking_token);

-- SECURITY DEFINER helper allows public menu/order checks without exposing cinema rows.
create or replace function public.is_active_cinema(p_cinema_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.cinemas c
    where c.id = p_cinema_id and c.is_active = true
  );
$function$;
revoke all on function public.is_active_cinema(uuid) from public;
grant execute on function public.is_active_cinema(uuid) to anon, authenticated;

-- Master Admin profile role is server-managed (no client update policy exists).
create or replace function public.is_master_admin()
returns boolean
language sql
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'master_admin'
  );
$function$;
revoke all on function public.is_master_admin() from public;
grant execute on function public.is_master_admin() to authenticated;

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
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
);

create policy "Staff can update orders in their cinema"
on public.orders for update to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('manager', 'food_court')
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('manager', 'food_court')
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
);

create policy "Customers can create valid cinema orders"
on public.orders for insert to anon
with check (
  cinema_id is not null
  and public.is_active_cinema(cinema_id)
  and coalesce(total, 0) >= 0
  and delivery_option in ('NOW', 'INTERVAL')
  and tracking_token is not null
);

-- No anonymous/authenticated direct order reads. Customers use narrowly-scoped RPCs.
-- Least-privilege SQL grants complement RLS: customers can insert only the checkout fields,
-- and staff can update only the order status.
revoke select on table public.orders from anon;
revoke insert on table public.orders from anon;
grant insert (order_code, movie, cinema_id, screen, seat, food_items, total, status, delivery_option, tracking_token)
  on table public.orders to anon;

revoke update on table public.orders from authenticated;
grant update (status) on table public.orders to authenticated;

drop policy if exists "Managers can delete food items" on public.food_items;
drop policy if exists "Managers can insert food items" on public.food_items;
drop policy if exists "Managers can update food items" on public.food_items;
drop policy if exists "Allow public read access on food_items" on public.food_items;

create policy "Public can view available items at active cinemas"
on public.food_items for select to anon
using (
  is_available = true
  and public.is_active_cinema(cinema_id)
);

create policy "Managers can view their cinema food items"
on public.food_items for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
);

create policy "Managers can insert food items for their cinema"
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

create policy "Managers can delete food items in their cinema"
on public.food_items for delete to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
);

-- Master Admin policies accept the protected server-managed profile role.
drop policy if exists "Master admins can delete cinemas" on public.cinemas;
drop policy if exists "Master admins can insert cinemas" on public.cinemas;
drop policy if exists "Master admins can update cinemas" on public.cinemas;
drop policy if exists "Master admins can view cinemas" on public.cinemas;

create policy "Master admins can delete cinemas"
on public.cinemas for delete to authenticated
using (public.is_master_admin());

create policy "Master admins can insert cinemas"
on public.cinemas for insert to authenticated
with check (public.is_master_admin());

create policy "Master admins can update cinemas"
on public.cinemas for update to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create policy "Master admins can view cinemas"
on public.cinemas for select to authenticated
using (public.is_master_admin());

-- Keep public show-time lookup anonymous; signed-in staff see only their own cinema.
drop policy if exists "Public can read show schedules" on public.show_schedules;
create policy "Public can read show schedules"
on public.show_schedules for select to anon
using (true);

create policy "Managers can view schedules for their cinema"
on public.show_schedules for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
  and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id')
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

-- Validate every public order against the authoritative cinema, seat and menu records.
-- This prevents forged prices, fake seats, unavailable items and client-supplied status values.
create or replace function public.validate_customer_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_screen_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_quantity integer;
  v_food record;
  v_total numeric := 0;
  v_normalized_items jsonb := '[]'::jsonb;
begin
  if not public.is_active_cinema(new.cinema_id) then
    raise exception 'This cinema is not accepting online orders.';
  end if;

  if new.delivery_option not in ('NOW', 'INTERVAL') then
    raise exception 'Invalid delivery option.';
  end if;

  select s.id into v_screen_id
  from public.screens s
  where s.cinema_id = new.cinema_id
    and coalesce(substring(s.name from '[0-9]+'), s.name) = new.screen
  limit 1;

  if v_screen_id is null then
    raise exception 'The selected screen does not belong to this cinema.';
  end if;

  if not exists (
    select 1 from public.seats st
    where st.screen_id = v_screen_id
      and st.seat_number = new.seat
      and st.is_active = true
  ) then
    raise exception 'The selected seat is not active for this screen.';
  end if;

  if jsonb_typeof(new.food_items) is distinct from 'array' then
    raise exception 'The food item list is invalid.';
  end if;

  if jsonb_array_length(new.food_items) = 0
     or jsonb_array_length(new.food_items) > 30 then
    raise exception 'An order must contain between 1 and 30 food item lines.';
  end if;

  for v_item in select value from jsonb_array_elements(new.food_items)
  loop
    begin
      v_item_id := (v_item ->> 'id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'The order contains an invalid food item.';
    end;

    if v_quantity is null or v_quantity < 1 or v_quantity > 20 then
      raise exception 'Food item quantity must be between 1 and 20.';
    end if;

    select fi.id, fi.name, fi.price
      into v_food
    from public.food_items fi
    where fi.id = v_item_id
      and fi.cinema_id = new.cinema_id
      and fi.is_available = true;

    if not found then
      raise exception 'A selected food item is unavailable for this cinema.';
    end if;

    v_total := v_total + (v_food.price * v_quantity);
    v_normalized_items := v_normalized_items || jsonb_build_array(
      jsonb_build_object(
        'id', v_food.id,
        'name', v_food.name,
        'price', v_food.price,
        'emoji', coalesce(nullif(v_item ->> 'emoji', ''), '🍿'),
        'quantity', v_quantity
      )
    );
  end loop;

  new.food_items := v_normalized_items;
  new.total := v_total;
  new.status := 'NEW';
  new.movie := null;
  return new;
end;
$function$;

drop trigger if exists validate_customer_order_before_insert on public.orders;
create trigger validate_customer_order_before_insert
before insert on public.orders
for each row
execute function public.validate_customer_order();

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
  where cardinality(coalesce(p_tracking_tokens, array[]::uuid[])) <= 100
    and o.tracking_token = any(coalesce(p_tracking_tokens, array[]::uuid[]))
  order by o.created_at desc
  limit 100;
$$;

revoke all on function public.get_customer_order(uuid) from public;
revoke all on function public.get_customer_orders(uuid[]) from public;
grant execute on function public.get_customer_order(uuid) to anon, authenticated;
grant execute on function public.get_customer_orders(uuid[]) to anon, authenticated;

commit;
