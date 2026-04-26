-- Add ON DELETE CASCADE to FKs so deleting an auth user cleans up app data.

alter table public.profiles
  drop constraint profiles_id_fkey,
  add constraint profiles_id_fkey foreign key (id)
    references auth.users(id) on delete cascade;

alter table public.sessions
  drop constraint sessions_user_id_fkey,
  add constraint sessions_user_id_fkey foreign key (user_id)
    references public.profiles(id) on delete cascade;

alter table public.recordings
  drop constraint recordings_session_id_fkey,
  add constraint recordings_session_id_fkey foreign key (session_id)
    references public.sessions(id) on delete cascade;

alter table public.recordings
  drop constraint recordings_user_id_fkey,
  add constraint recordings_user_id_fkey foreign key (user_id)
    references public.profiles(id) on delete cascade;

alter table public.metrics
  drop constraint metrics_recording_id_fkey,
  add constraint metrics_recording_id_fkey foreign key (recording_id)
    references public.recordings(id) on delete cascade;

alter table public.metrics
  drop constraint metrics_user_id_fkey,
  add constraint metrics_user_id_fkey foreign key (user_id)
    references public.profiles(id) on delete cascade;

alter table public.milestones
  drop constraint milestones_user_id_fkey,
  add constraint milestones_user_id_fkey foreign key (user_id)
    references public.profiles(id) on delete cascade;
