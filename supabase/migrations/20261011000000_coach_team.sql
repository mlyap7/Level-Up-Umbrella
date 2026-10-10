-- Coach team: a head coach, coaches who track their own progress, and
-- per-coach privacy.
-- Run this once in the Supabase SQL editor BEFORE merging the app update that uses it.
--
-- Who can see what
--   * Clients: only their own data (unchanged).
--   * Coaches: every client's data, plus their own. Not other coaches' data.
--   * Head coach: everyone's data, including other coaches'.
--   * Only the head coach can make someone a coach (or undo it), from the app.

-------------------------------------------------------------------------------
-- Head coach flag
-------------------------------------------------------------------------------

alter table public.profiles
  add column if not exists head_coach boolean not null default false;
-- Not added to the update grants: nobody can make themselves head coach from the app.

-- Whoever is a coach today becomes the head coach (today that is only the owner).
update public.profiles set head_coach = true where role = 'coach';

create or replace function public.is_head_coach()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'coach' and head_coach
  );
$$;

-- True when the signed-in person coaches `target`: the head coach coaches
-- everyone; other coaches coach clients and themselves.
create or replace function public.can_coach(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.role = 'coach'
      and (
        me.head_coach
        or target = me.id
        or exists (select 1 from public.profiles t where t.id = target and t.role = 'client')
      )
  );
$$;

-- Same check for a storage folder name (folders are named after the person's id).
create or replace function public.can_coach_folder(folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles t where t.id::text = folder and public.can_coach(t.id));
$$;

revoke execute on function public.is_head_coach() from public, anon;
revoke execute on function public.can_coach(uuid) from public, anon;
revoke execute on function public.can_coach_folder(text) from public, anon;
grant execute on function public.is_head_coach() to authenticated;
grant execute on function public.can_coach(uuid) to authenticated;
grant execute on function public.can_coach_folder(text) to authenticated;

-------------------------------------------------------------------------------
-- Replace "any coach reads everything" with "coaches read who they coach"
-------------------------------------------------------------------------------

drop policy if exists "profiles: read own or coach reads all" on public.profiles;
create policy "profiles: read own or coached"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.can_coach(id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'measurement_types', 'measurements', 'daily_logs',
    'journal_entries', 'check_ins', 'workout_sessions'
  ] loop
    execute format('drop policy if exists "%1$s: client reads own, coach reads all" on public.%1$I', t);
    execute format($p$
      create policy "%1$s: read own or coached"
        on public.%1$I for select to authenticated
        using (client_id = (select auth.uid()) or public.can_coach(client_id))
    $p$, t);
  end loop;
end;
$$;

drop policy if exists "session_sets: read via session" on public.session_sets;
create policy "session_sets: read via session"
  on public.session_sets for select to authenticated
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = session_id
      and (s.client_id = (select auth.uid()) or public.can_coach(s.client_id))
  ));

-- Programs: coaches write programs for the people they coach (themselves included).
drop policy if exists "programs: client reads own, coach reads all" on public.programs;
drop policy if exists "programs: coach writes" on public.programs;
create policy "programs: read own or coached"
  on public.programs for select to authenticated
  using (client_id = (select auth.uid()) or public.can_coach(client_id));
create policy "programs: coach writes"
  on public.programs for all to authenticated
  using (public.can_coach(client_id))
  with check (public.can_coach(client_id));

drop policy if exists "program_workouts: read via program" on public.program_workouts;
drop policy if exists "program_workouts: coach writes" on public.program_workouts;
create policy "program_workouts: read via program"
  on public.program_workouts for select to authenticated
  using (exists (
    select 1 from public.programs p
    where p.id = program_id
      and (p.client_id = (select auth.uid()) or public.can_coach(p.client_id))
  ));
create policy "program_workouts: coach writes"
  on public.program_workouts for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and public.can_coach(p.client_id)))
  with check (exists (select 1 from public.programs p where p.id = program_id and public.can_coach(p.client_id)));

drop policy if exists "workout_exercises: read via program" on public.workout_exercises;
drop policy if exists "workout_exercises: coach writes" on public.workout_exercises;
create policy "workout_exercises: read via program"
  on public.workout_exercises for select to authenticated
  using (exists (
    select 1 from public.program_workouts w
    join public.programs p on p.id = w.program_id
    where w.id = workout_id
      and (p.client_id = (select auth.uid()) or public.can_coach(p.client_id))
  ));
create policy "workout_exercises: coach writes"
  on public.workout_exercises for all to authenticated
  using (exists (
    select 1 from public.program_workouts w join public.programs p on p.id = w.program_id
    where w.id = workout_id and public.can_coach(p.client_id)
  ))
  with check (exists (
    select 1 from public.program_workouts w join public.programs p on p.id = w.program_id
    where w.id = workout_id and public.can_coach(p.client_id)
  ));

-- Check-in conversations.
drop policy if exists "check_in_comments: read via check-in" on public.check_in_comments;
drop policy if exists "check_in_comments: participants insert" on public.check_in_comments;
create policy "check_in_comments: read via check-in"
  on public.check_in_comments for select to authenticated
  using (exists (
    select 1 from public.check_ins c
    where c.id = check_in_id
      and (c.client_id = (select auth.uid()) or public.can_coach(c.client_id))
  ));
create policy "check_in_comments: participants insert"
  on public.check_in_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.check_ins c
      where c.id = check_in_id
        and (c.client_id = (select auth.uid()) or public.can_coach(c.client_id))
    )
  );

-- Coach replies show the coach's first name (clients can't read coach profiles).
alter table public.check_in_comments
  add column if not exists author_name text not null default '';

create or replace function public.set_comment_author_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(split_part(trim(full_name), ' ', 1), '') into new.author_name
  from public.profiles where id = new.author_id;
  new.author_name = coalesce(new.author_name, '');
  return new;
end;
$$;

drop trigger if exists check_in_comments_author_name on public.check_in_comments;
create trigger check_in_comments_author_name
  before insert on public.check_in_comments
  for each row execute function public.set_comment_author_name();

update public.check_in_comments c
set author_name = coalesce(split_part(trim(p.full_name), ' ', 1), '')
from public.profiles p
where p.id = c.author_id and c.author_name = '';

-- Photos.
drop policy if exists "progress_photos: client reads own, coach reads all" on public.progress_photos;
create policy "progress_photos: read own or coached"
  on public.progress_photos for select to authenticated
  using (client_id = (select auth.uid()) or public.can_coach(client_id));

drop policy if exists "progress-photos: owner or coach can view" on storage.objects;
create policy "progress-photos: owner or coach can view"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or public.can_coach_folder((storage.foldername(name))[1]))
  );

-- Questionnaire answers.
drop policy if exists "questionnaire: client reads own, coach reads all" on public.questionnaire_responses;
create policy "questionnaire: read own or coached"
  on public.questionnaire_responses for select to authenticated
  using (client_id = (select auth.uid()) or public.can_coach(client_id));

-------------------------------------------------------------------------------
-- Make coach (head coach only)
-------------------------------------------------------------------------------

create or replace function public.set_coach(target uuid, make boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_head_coach() then
    raise exception 'Only the head coach can change who is a coach' using errcode = '42501';
  end if;
  if target = (select auth.uid()) then
    raise exception 'You can''t change your own role' using errcode = '42501';
  end if;
  update public.profiles
  set role = case when make then 'coach' else 'client' end
  where id = target and not head_coach and not archived;
  if not found then
    raise exception 'That person can''t be changed' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.set_coach(uuid, boolean) from public, anon;
grant execute on function public.set_coach(uuid, boolean) to authenticated;
