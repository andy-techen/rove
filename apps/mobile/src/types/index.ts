export type Goal = 'expand_range' | 'consistency' | 'confidence' | 'specific_song';
export type Genre = 'pop' | 'rnb' | 'musical_theatre' | 'folk' | 'other';
export type Mood = 'rough' | 'okay' | 'good' | 'great';
export type PromptType = 'warmup' | 'focus' | 'expressive';
export type AnalysisStatus = 'pending' | 'complete' | 'failed';

export interface Profile {
  id: string;
  created_at: string;
  goal: Goal;
  genre: Genre;
  minutes_per_day: 2 | 5 | 10;
}

export interface Prompt {
  id: string;
  text: string;
  type: PromptType;
  goal_tags: Goal[];
  genre_tags: (Genre | 'all')[];
  duration_min: number;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: string;
  prompt_id: string;
  mood: Mood | null;
  intent_note: string | null;
  duration_sec: number;
  prompts?: Prompt;
}

export interface Recording {
  id: string;
  session_id: string;
  user_id: string;
  created_at: string;
  storage_path: string;
  file_size: number | null;
}

export interface Metric {
  id: string;
  recording_id: string;
  user_id: string;
  created_at: string;
  lowest_note: string | null;
  highest_note: string | null;
  lowest_midi: number | null;
  highest_midi: number | null;
  range_semitones: number | null;
  analysis_status: AnalysisStatus;
}

export interface Milestone {
  id: string;
  user_id: string;
  created_at: string;
  type: 'highest_note' | 'lowest_note' | 'first_session' | 'range_record';
  value: string;
}

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  PostSession: { sessionId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Record: undefined;
  History: undefined;
};
