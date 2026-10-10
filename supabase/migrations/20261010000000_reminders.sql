-- Push-notification reminders.
-- Run this once in the Supabase SQL editor BEFORE merging the app update that uses it.
-- The private keys and the schedule are set up separately (see README: Reminders).

-------------------------------------------------------------------------------
-- Reminder settings on each profile (clients can change these in Profile)
-------------------------------------------------------------------------------

alter table public.profiles
  add column if not exists remind_morning    boolean  not null default true,
  add column if not exists remind_checkin    boolean  not null default true,
  add column if not exists remind_photos     boolean  not null default true,
  add column if not exists remind_water      boolean  not null default false,
  add column if not exists water_every_hours smallint not null default 2 check (water_every_hours in (2, 3));

grant update (remind_morning, remind_checkin, remind_photos, remind_water, water_every_hours)
  on public.profiles to authenticated;

-------------------------------------------------------------------------------
-- Devices that allowed notifications
-------------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text not null default '',
  created_at    timestamptz not null default now(),
  last_sent_at  timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: read own"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push_subscriptions: delete own"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Saves this device for the signed-in person. If someone else used to be
-- signed in on the same phone, the device moves to the new person.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then
    raise exception 'Invalid push endpoint' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-------------------------------------------------------------------------------
-- Sender configuration and log (server only: no app access at all)
-------------------------------------------------------------------------------

create table if not exists public.push_config (
  id             boolean primary key default true check (id),
  vapid_public   text not null,
  vapid_private  text not null,
  cron_secret    text not null,
  contact        text not null default 'mailto:hello@levelup-transformations.com'
);
alter table public.push_config enable row level security; -- no policies: only the server can read it

create table if not exists public.push_log (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  kind     text not null,
  slot     text not null, -- e.g. the date, or date + hour for water; stops duplicates
  sent_at  timestamptz not null default now(),
  primary key (user_id, kind, slot)
);
alter table public.push_log enable row level security; -- no policies: server only

-------------------------------------------------------------------------------
-- Which reminders are due right now (Malaysia time)
--   morning   08:00-09:59 daily, until today's weight is logged
--   check-in  Sunday 19:00-20:59, until this week's check-in is sent
--   photos    Saturday 09:00-10:59 on photo weeks, until photos are added
--   water     10:00-20:00 every 2 or 3 hours, opt-in
-- The sender runs every 15 minutes; push_log makes sure each goes out once.
-------------------------------------------------------------------------------

create or replace function public.due_push_reminders(at_time timestamptz default now())
returns table (user_id uuid, kind text, slot text, title text, body text, url text,
               subscription_id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = ''
as $$
  with now_local as (
    select (at_time at time zone 'Asia/Kuala_Lumpur') as ts
  ), clock as (
    select ts::date as d, extract(hour from ts)::int as h, extract(dow from ts)::int as dow from now_local
  ), people as (
    select p.*, c.d, c.h, c.dow
    from public.profiles p cross join clock c
    where not p.archived
  ), due as (
    select id as user_id, 'morning' as kind, d::text as slot,
           'Good morning! ☀️' as title,
           'Time for your morning check-in: weight, sleep, steps and water. It takes 2 minutes.' as body,
           '/' as url
    from people
    where remind_morning and h between 8 and 9
      and not exists (select 1 from public.daily_logs l where l.client_id = people.id and l.log_date = people.d and l.weight_kg is not null)
    union all
    select id, 'checkin', d::text,
           'Sunday check-in 📋',
           'How did your week go? Send your weekly check-in to your coach.',
           '/check-in'
    from people
    where remind_checkin and dow = 0 and h between 19 and 20
      and not exists (select 1 from public.check_ins ci where ci.client_id = people.id and ci.week_start = date_trunc('week', people.d)::date)
    union all
    select id, 'photos', d::text,
           'Photo week 📸',
           'Snap your front, side and back photos this morning. Same spot, same light as last time.',
           '/photos'
    from people
    where remind_photos and dow = 6 and h between 9 and 10
      and ((date_trunc('week', d)::date - date_trunc('week', coalesce(coaching_started_on, created_at::date))::date) / 7) % 2 = 0
      and not exists (select 1 from public.progress_photos ph where ph.client_id = people.id and ph.taken_on >= people.d - 10)
    union all
    select id, 'water', d::text || '-' || h::text,
           'Water break 💧',
           'Grab a glass of water. Small sips add up!',
           '/'
    from people
    where remind_water and h between 10 and 20 and (h - 10) % water_every_hours = 0
  )
  select due.user_id, due.kind, due.slot, due.title, due.body, due.url,
         s.id, s.endpoint, s.p256dh, s.auth
  from due
  join public.push_subscriptions s on s.user_id = due.user_id
  where not exists (
    select 1 from public.push_log g where g.user_id = due.user_id and g.kind = due.kind and g.slot = due.slot
  );
$$;

revoke execute on function public.due_push_reminders(timestamptz) from public, anon, authenticated;
