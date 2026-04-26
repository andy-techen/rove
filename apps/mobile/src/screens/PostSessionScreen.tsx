import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { RootStackParamList, Mood } from '../types';

const COLORS = { bg: '#111', primary: '#E05C3A', text: '#F5F5F0', muted: '#888', card: '#1E1E1E', dim: '#2A2A2A' };

const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: 'rough', label: 'Rough', emoji: '😬' },
  { value: 'okay', label: 'Okay', emoji: '😐' },
  { value: 'good', label: 'Good', emoji: '🙂' },
  { value: 'great', label: 'Great', emoji: '😄' },
];

type Nav = NativeStackNavigationProp<RootStackParamList, 'PostSession'>;
type Route = RouteProp<RootStackParamList, 'PostSession'>;

export default function PostSessionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { sessionId } = route.params;

  const [mood, setMood] = useState<Mood | null>(null);
  const [intentNote, setIntentNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleDone() {
    setSaving(true);
    await supabase
      .from('sessions')
      .update({ mood, intent_note: intentNote.trim() || null })
      .eq('id', sessionId);
    setSaving(false);
    // Pop back to Main tabs (Home)
    navigation.navigate('Main');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.inner}>
          <Text style={styles.heading}>How did that feel?</Text>

          <View style={styles.moods}>
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={[styles.moodButton, mood === m.value && styles.moodButtonSelected]}
                onPress={() => setMood(m.value)}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={[styles.moodLabel, mood === m.value && styles.moodLabelSelected]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.subHeading}>What were you going for?</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional…"
            placeholderTextColor={COLORS.muted}
            value={intentNote}
            onChangeText={setIntentNote}
            returnKeyType="done"
            maxLength={200}
          />

          <TouchableOpacity
            style={[styles.doneButton, saving && styles.doneButtonDisabled]}
            onPress={handleDone}
            disabled={saving}
          >
            <Text style={styles.doneButtonText}>{saving ? 'Saving…' : 'Done'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },
  heading: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 24 },
  moods: { flexDirection: 'row', gap: 12, marginBottom: 40 },
  moodButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.dim,
  },
  moodButtonSelected: { borderColor: COLORS.primary },
  moodEmoji: { fontSize: 24, marginBottom: 4 },
  moodLabel: { color: COLORS.muted, fontSize: 13 },
  moodLabelSelected: { color: COLORS.text, fontWeight: '600' },
  subHeading: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.dim,
    marginBottom: 40,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonDisabled: { opacity: 0.6 },
  doneButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
