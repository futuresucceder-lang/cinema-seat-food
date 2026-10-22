-- Seat Bite delivery choice and database-enforced show ordering cutoff.
alter table public.orders add column if not exists delivery_option text not null default 'NOW';
alter table public.orders drop constraint if exists orders_delivery_option_check;
alter table public.orders add constraint orders_delivery_option_check check (delivery_option in ('NOW', 'INTERVAL'));

create table if not exists public.show_schedules (
  id uuid primary key default gen_random_uuid(),
  cinema_id uuid not null references public.cinemas(id) on delete cascade,
  screen text not null,
  show_end_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint show_schedules_screen_not_blank check (length(trim(screen)) > 0)
);
create index if not exists show_schedules_cinema_screen_end_idx on public.show_schedules (cinema_id, screen, show_end_at);
alter table public.show_schedules enable row level security;

drop policy if exists "Public can read show schedules" on public.show_schedules;
create policy "Public can read show schedules" on public.show_schedules for select to anon, authenticated using (true);

drop policy if exists "Managers can add schedules for their cinema" on public.show_schedules;
create policy "Managers can add schedules for their cinema" on public.show_schedules for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager' and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id'));

drop policy if exists "Managers can delete schedules for their cinema" on public.show_schedules;
create policy "Managers can delete schedules for their cinema" on public.show_schedules for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'manager' and cinema_id::text = (auth.jwt() -> 'app_metadata' ->> 'cinema_id'));

create or replace function public.enforce_show_order_cutoff()
returns trigger language plpgsql security definer set search_path = public as $$
declare schedule_exists boolean; active_show_end timestamptz;
begin
  if new.cinema_id is null or new.screen is null then return new; end if;
  select exists(select 1 from public.show_schedules ss where ss.cinema_id = new.cinema_id and ss.screen = new.screen) into schedule_exists;
  if not schedule_exists then return new; end if;
  select ss.show_end_at into active_show_end from public.show_schedules ss
    where ss.cinema_id = new.cinema_id and ss.screen = new.screen and ss.show_end_at > now()
    order by ss.show_end_at asc limit 1;
  if active_show_end is null or now() >= active_show_end - interval '30 minutes' then
    raise exception 'Online ordering is closed for this show. Ordering closes 30 minutes before the show ends.' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

drop trigger if exists orders_show_cutoff_guard on public.orders;
create trigger orders_show_cutoff_guard before insert on public.orders for each row execute function public.enforce_show_order_cutoff();
