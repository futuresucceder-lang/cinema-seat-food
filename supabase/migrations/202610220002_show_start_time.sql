-- Add show start times while preserving existing Seat Bite show schedules.
alter table public.show_schedules
  add column if not exists show_start_at timestamptz;

-- Existing schedules only had an end time; estimate their start as two hours earlier
-- so they remain usable until the manager updates them with the real start time.
update public.show_schedules
set show_start_at = show_end_at - interval '2 hours'
where show_start_at is null;

alter table public.show_schedules
  alter column show_start_at set not null;

alter table public.show_schedules
  drop constraint if exists show_schedules_time_order_check;
alter table public.show_schedules
  add constraint show_schedules_time_order_check
  check (show_end_at > show_start_at);

create index if not exists show_schedules_cinema_screen_start_idx
  on public.show_schedules (cinema_id, screen, show_start_at);
