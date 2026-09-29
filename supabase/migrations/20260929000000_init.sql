-- Level Up coaching app: initial schema.
--
-- Security model
--   * Every table has row level security (RLS) switched on.
--   * A client can only read and write their own rows.
--   * A coach (profiles.role = 'coach') can read every client's rows,
--     writes training programs, and comments on check-ins.
--   * Nobody can make themselves a coach from the app. The first coach is
--     promoted once by running an UPDATE in the Supabase SQL editor (see README).
--
-- Units: weights are stored in kg and lengths in cm. The app converts to each
-- viewer's preferred units for display.

-------------------------------------------------------------------------------
-- Profiles
-------------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null default '',
  role         text not null default 'client' check (role in ('client', 'coach')),
  weight_unit  text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  length_unit  text not null default 'cm' check (length_unit in ('cm', 'in')),
  goal_type    text not null default 'lose' check (goal_type in ('lose', 'gain', 'maintain')),
  goal_note    text not null default '',
  height_cm    numeric(5, 1) check (height_cm between 50 and 300),
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Used inside RLS policies. SECURITY DEFINER so it can read profiles without
-- recursing into the profiles policies.
create function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'coach'
  );
$$;

alter table public.profiles enable row level security;

create policy "profiles: read own or coach reads all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_coach()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Clients may only change these columns on their own profile.
-- role and archived are deliberately excluded.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, weight_unit, length_unit, goal_type, goal_note, height_cm)
  on public.profiles to authenticated;

-------------------------------------------------------------------------------
-- Sign-up gate
-------------------------------------------------------------------------------

-- Optional sign-up code. When set, new accounts must enter it, so strangers who
-- find the URL cannot create accounts that show up in the coach dashboard.
create table public.app_settings (
  id           boolean primary key default true check (id), -- single row
  signup_code  text
);
insert into public.app_settings (id, signup_code) values (true, null);

alter table public.app_settings enable row level security;

create policy "app_settings: coach reads"
  on public.app_settings for select to authenticated
  using ((select public.is_coach()));

create policy "app_settings: coach updates"
  on public.app_settings for update to authenticated
  using ((select public.is_coach()))
  with check ((select public.is_coach()));

-- Lets the sign-up form check the code before creating the account, so the
-- client sees a clear message instead of a generic error. Returns true when no
-- code is required.
create function public.check_signup_code(code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(trim(signup_code), '') = ''
      or trim(signup_code) = trim(coalesce(code, ''))
  from public.app_settings where id;
$$;

revoke execute on function public.check_signup_code(text) from public;
grant execute on function public.check_signup_code(text) to anon, authenticated;

-------------------------------------------------------------------------------
-- Measurements (custom per client; waist and hips created by default)
-------------------------------------------------------------------------------

create table public.measurement_types (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 40),
  position    integer not null default 100,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index measurement_types_client_name_key
  on public.measurement_types (client_id, lower(trim(name)));

create table public.measurements (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type_id      uuid not null references public.measurement_types (id) on delete cascade,
  measured_on  date not null default current_date,
  value_cm     numeric(6, 2) not null check (value_cm > 0 and value_cm < 1000),
  created_at   timestamptz not null default now(),
  unique (type_id, measured_on)
);
create index measurements_client_date_idx on public.measurements (client_id, measured_on);

-------------------------------------------------------------------------------
-- New-user trigger: create profile and default measurement types
-------------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  required_code text;
begin
  select signup_code into required_code from public.app_settings where id;

  if coalesce(trim(required_code), '') <> ''
     and coalesce(trim(new.raw_user_meta_data ->> 'signup_code'), '') <> trim(required_code) then
    raise exception 'Invalid sign-up code' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''));

  insert into public.measurement_types (client_id, name, position)
  values (new.id, 'Waist', 1), (new.id, 'Hips', 2);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- Daily logs (one row per client per day)
-------------------------------------------------------------------------------

create table public.daily_logs (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  log_date     date not null default current_date,
  weight_kg    numeric(5, 2) check (weight_kg > 20 and weight_kg < 400),
  steps        integer check (steps >= 0 and steps < 200000),
  sleep_hours  numeric(3, 1) check (sleep_hours >= 0 and sleep_hours <= 24),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, log_date)
);

-------------------------------------------------------------------------------
-- Journal
-------------------------------------------------------------------------------

create table public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  entry_date  date not null default current_date,
  mood        smallint check (mood between 1 and 5),
  body        text not null check (length(body) between 1 and 10000),
  created_at  timestamptz not null default now()
);
create index journal_entries_client_date_idx on public.journal_entries (client_id, entry_date desc);

-------------------------------------------------------------------------------
-- Weekly check-ins and the coach/client conversation on each one
-------------------------------------------------------------------------------

create table public.check_ins (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  week_start     date not null, -- Monday of the week being reviewed
  adherence      smallint not null check (adherence between 1 and 10),
  energy         smallint not null check (energy between 1 and 10),
  hunger         smallint not null check (hunger between 1 and 10),     -- 10 = very hungry
  sleep_quality  smallint not null check (sleep_quality between 1 and 10),
  stress         smallint not null check (stress between 1 and 10),     -- 10 = very stressed
  digestion      smallint not null check (digestion between 1 and 10),
  wins           text not null default '',
  struggles      text not null default '',
  questions      text not null default '',
  created_at     timestamptz not null default now(),
  unique (client_id, week_start)
);

create table public.check_in_comments (
  id           uuid primary key default gen_random_uuid(),
  check_in_id  uuid not null references public.check_ins (id) on delete cascade,
  author_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body         text not null check (length(body) between 1 and 5000),
  created_at   timestamptz not null default now()
);
create index check_in_comments_check_in_idx on public.check_in_comments (check_in_id, created_at);

-------------------------------------------------------------------------------
-- Training: coach-written programs, client-logged sessions
-------------------------------------------------------------------------------

create table public.programs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  notes       text not null default '',
  active      boolean not null default true,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index programs_client_idx on public.programs (client_id);

create table public.program_workouts (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  position    integer not null default 0
);
create index program_workouts_program_idx on public.program_workouts (program_id, position);

create table public.workout_exercises (
  id            uuid primary key default gen_random_uuid(),
  workout_id    uuid not null references public.program_workouts (id) on delete cascade,
  position      integer not null default 0,
  name          text not null check (length(trim(name)) between 1 and 80),
  target_sets   smallint check (target_sets between 1 and 20),
  target_reps   text not null default '',   -- e.g. "8-10" or "AMRAP"
  target_rpe    numeric(3, 1) check (target_rpe between 1 and 10),
  notes         text not null default ''
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id, position);

create table public.workout_sessions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_id    uuid references public.program_workouts (id) on delete set null,
  workout_name  text not null default '', -- kept so history survives program edits
  performed_on  date not null default current_date,
  feeling       smallint check (feeling between 1 and 5),
  remarks       text not null default '',
  created_at    timestamptz not null default now()
);
create index workout_sessions_client_date_idx on public.workout_sessions (client_id, performed_on desc);

create table public.session_sets (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_name  text not null check (length(trim(exercise_name)) between 1 and 80),
  set_number     smallint not null check (set_number between 1 and 50),
  weight_kg      numeric(6, 2) check (weight_kg >= 0 and weight_kg < 1000),
  reps           smallint check (reps >= 0 and reps < 1000),
  rpe            numeric(3, 1) check (rpe between 1 and 10)
);
create index session_sets_session_idx on public.session_sets (session_id);

-------------------------------------------------------------------------------
-- Row level security for client-owned tables
-------------------------------------------------------------------------------

-- Tables where the client owns the row directly through client_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'measurement_types', 'measurements', 'daily_logs',
    'journal_entries', 'check_ins', 'workout_sessions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$
      create policy "%1$s: client reads own, coach reads all"
        on public.%1$I for select to authenticated
        using (client_id = (select auth.uid()) or (select public.is_coach()))
    $p$, t);
    execute format($p$
      create policy "%1$s: client inserts own"
        on public.%1$I for insert to authenticated
        with check (client_id = (select auth.uid()))
    $p$, t);
    execute format($p$
      create policy "%1$s: client updates own"
        on public.%1$I for update to authenticated
        using (client_id = (select auth.uid()))
        with check (client_id = (select auth.uid()))
    $p$, t);
    execute format($p$
      create policy "%1$s: client deletes own"
        on public.%1$I for delete to authenticated
        using (client_id = (select auth.uid()))
    $p$, t);
  end loop;
end;
$$;

-- A measurement must point at one of the same client's measurement types.
create policy "measurements: type belongs to client (insert)"
  on public.measurements as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.measurement_types mt
    where mt.id = type_id and mt.client_id = (select auth.uid())
  ));
create policy "measurements: type belongs to client (update)"
  on public.measurements as restrictive for update to authenticated
  with check (exists (
    select 1 from public.measurement_types mt
    where mt.id = type_id and mt.client_id = (select auth.uid())
  ));

-- A session may only reference a workout from the client's own program.
create policy "workout_sessions: workout belongs to client (insert)"
  on public.workout_sessions as restrictive for insert to authenticated
  with check (
    workout_id is null or exists (
      select 1 from public.program_workouts w
      join public.programs p on p.id = w.program_id
      where w.id = workout_id and p.client_id = (select auth.uid())
    )
  );
create policy "workout_sessions: workout belongs to client (update)"
  on public.workout_sessions as restrictive for update to authenticated
  with check (
    workout_id is null or exists (
      select 1 from public.program_workouts w
      join public.programs p on p.id = w.program_id
      where w.id = workout_id and p.client_id = (select auth.uid())
    )
  );

-- Session sets inherit access from their session.
alter table public.session_sets enable row level security;

create policy "session_sets: read via session"
  on public.session_sets for select to authenticated
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = session_id
      and (s.client_id = (select auth.uid()) or (select public.is_coach()))
  ));

create policy "session_sets: client writes own"
  on public.session_sets for all to authenticated
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = session_id and s.client_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workout_sessions s
    where s.id = session_id and s.client_id = (select auth.uid())
  ));

-- Programs: clients read their own, coaches read and write all.
alter table public.programs enable row level security;
alter table public.program_workouts enable row level security;
alter table public.workout_exercises enable row level security;

create policy "programs: client reads own, coach reads all"
  on public.programs for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));

create policy "programs: coach writes"
  on public.programs for all to authenticated
  using ((select public.is_coach()))
  with check ((select public.is_coach()));

create policy "program_workouts: read via program"
  on public.program_workouts for select to authenticated
  using (exists (
    select 1 from public.programs p
    where p.id = program_id
      and (p.client_id = (select auth.uid()) or (select public.is_coach()))
  ));

create policy "program_workouts: coach writes"
  on public.program_workouts for all to authenticated
  using ((select public.is_coach()))
  with check ((select public.is_coach()));

create policy "workout_exercises: read via program"
  on public.workout_exercises for select to authenticated
  using (exists (
    select 1 from public.program_workouts w
    join public.programs p on p.id = w.program_id
    where w.id = workout_id
      and (p.client_id = (select auth.uid()) or (select public.is_coach()))
  ));

create policy "workout_exercises: coach writes"
  on public.workout_exercises for all to authenticated
  using ((select public.is_coach()))
  with check ((select public.is_coach()));

-- Check-in comments: the client who owns the check-in and any coach can read
-- and add to the thread. Authors can delete their own comments.
alter table public.check_in_comments enable row level security;

create policy "check_in_comments: read via check-in"
  on public.check_in_comments for select to authenticated
  using (exists (
    select 1 from public.check_ins c
    where c.id = check_in_id
      and (c.client_id = (select auth.uid()) or (select public.is_coach()))
  ));

create policy "check_in_comments: participants insert"
  on public.check_in_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.check_ins c
      where c.id = check_in_id
        and (c.client_id = (select auth.uid()) or (select public.is_coach()))
    )
  );

create policy "check_in_comments: author deletes own"
  on public.check_in_comments for delete to authenticated
  using (author_id = (select auth.uid()));

-------------------------------------------------------------------------------
-- Coach-only actions
-------------------------------------------------------------------------------

-- Archive or restore a client (hides them from the dashboard, keeps their data).
create function public.set_client_archived(target uuid, archive boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_coach() then
    raise exception 'Only coaches can archive clients' using errcode = '42501';
  end if;
  update public.profiles set archived = archive where id = target and role = 'client';
end;
$$;

revoke execute on function public.set_client_archived(uuid, boolean) from public, anon;
grant execute on function public.set_client_archived(uuid, boolean) to authenticated;

-- Keep daily_logs.updated_at current.
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger daily_logs_touch
  before update on public.daily_logs
  for each row execute function public.touch_updated_at();
