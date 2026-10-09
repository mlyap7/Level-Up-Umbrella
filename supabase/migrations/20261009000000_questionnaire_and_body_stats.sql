-- Coaching questionnaire, smart-scale body stats, water intake and main goal.
-- Run this once in the Supabase SQL editor BEFORE merging the app update that uses it.

-------------------------------------------------------------------------------
-- Profile: main goal (from setup) and smart-scale toggle
-------------------------------------------------------------------------------

alter table public.profiles
  add column if not exists main_goal       text not null default '' check (length(main_goal) <= 1000),
  add column if not exists has_smart_scale boolean not null default false;

grant update (main_goal, has_smart_scale) on public.profiles to authenticated;

-------------------------------------------------------------------------------
-- Morning check-in: water (filed under yesterday) and smart-scale readings
-------------------------------------------------------------------------------

alter table public.daily_logs
  add column if not exists water_l        numeric(4, 2) check (water_l >= 0 and water_l <= 15),
  add column if not exists body_fat_pct   numeric(4, 1) check (body_fat_pct >= 2 and body_fat_pct <= 75),
  add column if not exists muscle_mass_kg numeric(5, 2) check (muscle_mass_kg > 5 and muscle_mass_kg < 200),
  add column if not exists visceral_fat   numeric(4, 1) check (visceral_fat >= 1 and visceral_fat <= 60);

-------------------------------------------------------------------------------
-- Coaching questionnaire
-------------------------------------------------------------------------------

-- One row per client. Answers are saved as the client types (autosave);
-- submitted_at is set when they press Submit.
create table if not exists public.questionnaire_responses (
  client_id     uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  submitted_at  timestamptz,
  imported      boolean not null default false, -- true when copied from the old Google Form
  updated_at    timestamptz not null default now()
);

alter table public.questionnaire_responses enable row level security;

create policy "questionnaire: client reads own, coach reads all"
  on public.questionnaire_responses for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));

create policy "questionnaire: client creates own"
  on public.questionnaire_responses for insert to authenticated
  with check (client_id = (select auth.uid()));

create policy "questionnaire: client updates own"
  on public.questionnaire_responses for update to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

create trigger questionnaire_responses_touch
  before update on public.questionnaire_responses
  for each row execute function public.touch_updated_at();

-- Answers from the old Google Form, keyed by email. Clients cannot read this
-- table; when they sign in, claim_questionnaire_import() copies their own row
-- (matched on their account email) into questionnaire_responses.
create table if not exists public.questionnaire_imports (
  email           text primary key check (email = lower(email)),
  answers         jsonb not null,
  main_goal       text not null default '',
  goal_note       text not null default '',
  height_cm       numeric(5, 1),
  goal_weight_kg  numeric(5, 2),
  submitted_at    timestamptz not null,
  created_at      timestamptz not null default now()
);

alter table public.questionnaire_imports enable row level security;

create policy "questionnaire_imports: coach reads"
  on public.questionnaire_imports for select to authenticated
  using ((select public.is_coach()));

-- Copies an imported Google Form answer set to one account. Never overwrites
-- anything the client already entered in the app. Not callable from the app
-- directly (see grants below).
create or replace function public.apply_questionnaire_import(target uuid, target_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  imp public.questionnaire_imports;
begin
  select * into imp from public.questionnaire_imports where email = lower(trim(target_email));
  if not found then
    return false;
  end if;

  insert into public.questionnaire_responses (client_id, answers, submitted_at, imported)
  values (target, imp.answers, imp.submitted_at, true)
  on conflict (client_id) do nothing;

  update public.profiles set
    main_goal      = case when main_goal = '' then imp.main_goal else main_goal end,
    goal_note      = case when goal_note = '' then imp.goal_note else goal_note end,
    height_cm      = coalesce(height_cm, imp.height_cm),
    goal_weight_kg = coalesce(goal_weight_kg, imp.goal_weight_kg)
  where id = target;

  return true;
end;
$$;

revoke execute on function public.apply_questionnaire_import(uuid, text) from public, anon, authenticated;

-- Called by the app: claims an imported answer set for the signed-in client only.
create or replace function public.claim_questionnaire_import()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_email text;
begin
  if (select auth.uid()) is null then
    return false;
  end if;
  select email into my_email from auth.users where id = (select auth.uid());
  if my_email is null or exists (select 1 from public.questionnaire_responses where client_id = (select auth.uid())) then
    return false;
  end if;
  return public.apply_questionnaire_import((select auth.uid()), my_email);
end;
$$;

revoke execute on function public.claim_questionnaire_import() from public, anon;
grant execute on function public.claim_questionnaire_import() to authenticated;
