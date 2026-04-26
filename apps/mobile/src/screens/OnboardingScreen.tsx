import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useProfileRefresh } from '../lib/profileContext';
import { Goal, Genre } from '../types';

const COLORS = { bg: '#111', primary: '#E05C3A', text: '#F5F5F0', muted: '#888', card: '#1E1E1E', selected: '#2D1F1A' };

const GOALS: { value: Goal; label: string }[] = [
  { value: 'expand_range', label: 'Expand my range' },
  { value: 'consistency', label: 'Sing more consistently' },
  { value: 'confidence', label: 'Build confidence' },
  { value: 'specific_song', label: 'Nail a specific song' },
];

const GENRES: { value: Genre; label: string }[] = [
  { value: 'pop', label: 'Pop' },
  { value: 'rnb', label: 'R&B / Soul' },
  { value: 'musical_theatre', label: 'Musical Theatre' },
  { value: 'folk', label: 'Folk / Singer-songwriter' },
  { value: 'other', label: 'Other' },
];

const TIMES: { value: 2 | 5 | 10; label: string }[] = [
  { value: 2, label: '~2 minutes' },
  { value: 5, label: '~5 minutes' },
  { value: 10, label: '~10 minutes' },
];

const STEPS = [
  { title: 'What do you want\nto work on?', key: 'goal' },
  { title: 'What do you\nmostly sing?', key: 'genre' },
  { title: 'How much time\nper day?', key: 'time' },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [genre, setGenre] = useState<Genre | null>(null);
  const [minutes, setMinutes] = useState<2 | 5 | 10 | null>(null);
  const [saving, setSaving] = useState(false);
  const refreshProfile = useProfileRefresh();

  const currentOptions =
    step === 0 ? GOALS : step === 1 ? GENRES : TIMES;
  const currentValue = step === 0 ? goal : step === 1 ? genre : minutes;

  function handleSelect(value: Goal | Genre | 2 | 5 | 10) {
    if (step === 0) setGoal(value as Goal);
    else if (step === 1) setGenre(value as Genre);
    else setMinutes(value as 2 | 5 | 10);
  }

  async function handleNext() {
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    if (!goal || !genre || !minutes) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      goal,
      genre,
      minutes_per_day: minutes,
    });

    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else refreshProfile();
  }

  const canAdvance =
    (step === 0 && !!goal) ||
    (step === 1 && !!genre) ||
    (step === 2 && !!minutes);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.progress}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
          ))}
        </View>

        <Text style={styles.title}>{STEPS[step].title}</Text>

        <View style={styles.options}>
          {currentOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.option, currentValue === opt.value && styles.optionSelected]}
              onPress={() => handleSelect(opt.value)}
            >
              <Text style={[styles.optionText, currentValue === opt.value && styles.optionTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextButton, !canAdvance && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canAdvance || saving}
        >
          <Text style={styles.nextButtonText}>
            {saving ? 'Saving…' : step < 2 ? 'Next' : 'Start singing'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  progress: { flexDirection: 'row', gap: 8, marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' },
  dotActive: { backgroundColor: COLORS.primary },
  title: { fontSize: 32, fontWeight: '800', color: COLORS.text, lineHeight: 40, marginBottom: 32 },
  options: { gap: 12, flex: 1 },
  option: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
  },
  optionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.selected },
  optionText: { fontSize: 16, color: COLORS.muted },
  optionTextSelected: { color: COLORS.text, fontWeight: '600' },
  nextButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  nextButtonDisabled: { opacity: 0.4 },
  nextButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
