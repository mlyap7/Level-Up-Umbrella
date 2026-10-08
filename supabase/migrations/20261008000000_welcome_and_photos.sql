-- Welcome flow fields and progress photos.
-- Run this once in the Supabase SQL editor BEFORE merging the app update that uses it.

-------------------------------------------------------------------------------
-- Welcome / setup flow
-------------------------------------------------------------------------------

alter table public.profiles
  add column if not exists onboarded_at        timestamptz,
  add column if not exists goal_weight_kg      numeric(5, 2) check (goal_weight_kg > 20 and goal_weight_kg < 400),
  add column if not exists coaching_started_on date;

-- Clients may fill these in on their own profile (role and archived stay locked).
grant update (onboarded_at, goal_weight_kg, coaching_started_on) on public.profiles to authenticated;

-------------------------------------------------------------------------------
-- Progress photos
-------------------------------------------------------------------------------

create table if not exists public.progress_photos (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  taken_on      date not null default current_date,
  pose          text not null check (pose in ('front', 'side', 'back')),
  storage_path  text not null,
  created_at    timestamptz not null default now(),
  unique (client_id, taken_on, pose),
  -- A photo row can only point at a file in its own client's folder.
  check (storage_path like client_id::text || '/%')
);
create index if not exists progress_photos_client_date_idx on public.progress_photos (client_id, taken_on);

alter table public.progress_photos enable row level security;

create policy "progress_photos: client reads own, coach reads all"
  on public.progress_photos for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));

create policy "progress_photos: client inserts own"
  on public.progress_photos for insert to authenticated
  with check (client_id = (select auth.uid()));

create policy "progress_photos: client updates own"
  on public.progress_photos for update to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

create policy "progress_photos: client deletes own"
  on public.progress_photos for delete to authenticated
  using (client_id = (select auth.uid()));

-- Private storage bucket. Files live at <client id>/<random name>.jpg.
-- Nothing is public: the app asks for short-lived links each time it shows a photo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "progress-photos: owner or coach can view"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_coach()))
  );

create policy "progress-photos: owner uploads to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "progress-photos: owner replaces own files"
  on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "progress-photos: owner deletes own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
