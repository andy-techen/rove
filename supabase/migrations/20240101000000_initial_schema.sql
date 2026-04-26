-- profiles
create table profiles (
  id              uuid references auth.users primary key,
  created_at      timestamptz default now(),
  goal            text,  -- 'expand_range' | 'consistency' | 'confidence' | 'specific_song'
  genre           text,  -- 'pop' | 'rnb' | 'musical_theatre' | 'folk' | 'other'
  minutes_per_day int    -- 2 | 5 | 10
);

-- prompts
create table prompts (
  id           uuid primary key default gen_random_uuid(),
  text         text,
  type         text,     -- 'warmup' | 'focus' | 'expressive'
  goal_tags    text[],   -- matches profile.goal values
  genre_tags   text[],   -- matches profile.genre values, or '{all}'
  duration_min int
);

-- sessions
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles(id),
  created_at   timestamptz default now(),
  prompt_id    uuid references prompts(id),
  mood         text,  -- 'rough' | 'okay' | 'good' | 'great'
  intent_note  text,  -- optional free text
  duration_sec int
);

-- recordings
create table recordings (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references sessions(id),
  user_id      uuid references profiles(id),
  created_at   timestamptz default now(),
  storage_path text,  -- path in Supabase Storage bucket
  file_size    int
);

-- metrics
create table metrics (
  id              uuid primary key default gen_random_uuid(),
  recording_id    uuid references recordings(id),
  user_id         uuid references profiles(id),
  created_at      timestamptz default now(),
  lowest_note     text,
  highest_note    text,
  lowest_midi     int,
  highest_midi    int,
  range_semitones int,
  analysis_status text    -- 'pending' | 'complete' | 'failed'
);

-- milestones
create table milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id),
  created_at  timestamptz default now(),
  type        text,  -- 'highest_note' | 'lowest_note' | 'longest_streak' | 'first_session' | 'range_record'
  value       text   -- e.g. 'A4' or '14 days'
);

-- Row Level Security
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table recordings enable row level security;
alter table metrics enable row level security;
alter table milestones enable row level security;

-- profiles policies (uses id directly, not user_id)
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- sessions policies
create policy "Users can view own sessions" on sessions
  for select using (auth.uid() = user_id);

create policy "Users can insert own sessions" on sessions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own sessions" on sessions
  for update using (auth.uid() = user_id);

-- recordings policies
create policy "Users can view own recordings" on recordings
  for select using (auth.uid() = user_id);

create policy "Users can insert own recordings" on recordings
  for insert with check (auth.uid() = user_id);

-- metrics policies
create policy "Users can view own metrics" on metrics
  for select using (auth.uid() = user_id);

create policy "Users can insert own metrics" on metrics
  for insert with check (auth.uid() = user_id);

-- milestones policies
create policy "Users can view own milestones" on milestones
  for select using (auth.uid() = user_id);

create policy "Users can insert own milestones" on milestones
  for insert with check (auth.uid() = user_id);

-- prompts: readable by all authenticated users
alter table prompts enable row level security;

create policy "Authenticated users can read prompts" on prompts
  for select using (auth.role() = 'authenticated');

-- Storage bucket for recordings (run after creating the bucket in dashboard)
-- Storage RLS: users can only read/write files under their own user_id prefix
insert into storage.buckets (id, name, public)
  values ('recordings', 'recordings', false)
  on conflict (id) do nothing;

create policy "Users can upload own recordings" on storage.objects
  for insert with check (
    bucket_id = 'recordings' and
    auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "Users can read own recordings" on storage.objects
  for select using (
    bucket_id = 'recordings' and
    auth.uid()::text = (string_to_array(name, '/'))[1]
  );
