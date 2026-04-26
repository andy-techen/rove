import { supabase } from './supabase';

export async function getStreak(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('sessions')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) return 0;

  const sessionDates = [
    ...new Set(
      data.map((s) => new Date(s.created_at).toISOString().slice(0, 10))
    ),
  ].sort((a, b) => b.localeCompare(a));

  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Streak must include today or yesterday to be alive
  if (sessionDates[0] !== today && sessionDates[0] !== yesterday) return 0;

  let expected = sessionDates[0];
  for (const date of sessionDates) {
    if (date === expected) {
      streak++;
      const d = new Date(expected);
      d.setDate(d.getDate() - 1);
      expected = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  return streak;
}

export async function getSessionDates(userId: string): Promise<Set<string>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await supabase
    .from('sessions')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo);

  return new Set(
    (data || []).map((s) => new Date(s.created_at).toISOString().slice(0, 10))
  );
}
