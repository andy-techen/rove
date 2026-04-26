import { supabase } from './supabase';
import { Goal, Genre, Prompt } from '../types';

export async function getDailyPrompt(goal: Goal, genre: Genre): Promise<Prompt | null> {
  // Two separate queries — the PostgREST `cs` operator inside `.or()` doesn't support
  // quoted string values, so we fetch both possible genre matches then merge.
  const [goalGenre, goalAll] = await Promise.all([
    supabase
      .from('prompts')
      .select('*')
      .contains('goal_tags', [goal])
      .contains('genre_tags', [genre]),
    supabase
      .from('prompts')
      .select('*')
      .contains('goal_tags', [goal])
      .contains('genre_tags', ['all']),
  ]);

  const seen = new Set<string>();
  const data: Prompt[] = [];
  for (const row of [...(goalGenre.data ?? []), ...(goalAll.data ?? [])]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      data.push(row as Prompt);
    }
  }

  if (data.length === 0) {
    // Fallback: any prompt at all
    const { data: anyData } = await supabase.from('prompts').select('*').limit(50);
    if (!anyData || anyData.length === 0) {
      console.warn('[Rove] no prompts found in DB');
      return null;
    }
    data.push(...(anyData as Prompt[]));
  }

  // Seed by today's date so every user sees a consistent prompt for the day
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return data[seed % data.length];
}
