import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { supabase } from '../lib/supabase';
import { getDailyPrompt } from '../lib/prompts';
import { getStreak, getSessionDates } from '../lib/streak';
import { MainTabParamList, Prompt } from '../types';

const COLORS = { bg: '#111', primary: '#E05C3A', text: '#F5F5F0', muted: '#888', card: '#1E1E1E', dim: '#2A2A2A' };

const PROMPT_TYPE_LABELS: Record<string, string> = {
  warmup: 'Warmup',
  focus: 'Focus',
  expressive: 'Expressive',
};

type Nav = BottomTabNavigationProp<MainTabParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [streak, setStreak] = useState(0);
  const [sessionDates, setSessionDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profileData) return;

    const [dailyPrompt, currentStreak, dates] = await Promise.all([
      getDailyPrompt(profileData.goal, profileData.genre),
      getStreak(user.id),
      getSessionDates(user.id),
    ]);

    setPrompt(dailyPrompt);
    setStreak(currentStreak);
    setSessionDates(dates);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const today = new Date();
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.appName}>Rove</Text>
          <View style={styles.headerRight}>
            <View style={styles.streakBadge}>
              <Text style={styles.streakIcon}>🔥</Text>
              <Text style={styles.streakCount}>{streak}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {prompt ? (
          <View style={styles.promptCard}>
            <View style={styles.promptMeta}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{PROMPT_TYPE_LABELS[prompt.type]}</Text>
              </View>
              <Text style={styles.promptDuration}>{prompt.duration_min} min</Text>
            </View>
            <Text style={styles.promptText}>{prompt.text}</Text>
          </View>
        ) : (
          <View style={styles.promptCard}>
            <Text style={styles.promptText}>No prompt found. Add seed data to Supabase.</Text>
          </View>
        )}

        <TouchableOpacity style={styles.startButton} onPress={() => navigation.navigate('Record')}>
          <Text style={styles.startButtonText}>Start</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('History')}>
          <View style={styles.heatmap}>
            {last30.map((date) => (
              <View
                key={date}
                style={[styles.heatCell, sessionDates.has(date) && styles.heatCellFilled]}
              />
            ))}
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, marginBottom: 32 },
  appName: { fontSize: 28, fontWeight: '800', color: COLORS.primary, letterSpacing: -1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  streakIcon: { fontSize: 18 },
  streakCount: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  logoutButton: { paddingHorizontal: 4, paddingVertical: 6 },
  logoutText: { color: COLORS.muted, fontSize: 13 },
  promptCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: COLORS.dim },
  promptMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  typeBadge: { backgroundColor: '#2D1F1A', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  typeBadgeText: { color: COLORS.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  promptDuration: { color: COLORS.muted, fontSize: 13 },
  promptText: { color: COLORS.text, fontSize: 20, lineHeight: 30, fontWeight: '500' },
  startButton: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 20, alignItems: 'center', marginBottom: 32 },
  startButtonText: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatCell: { width: 16, height: 16, borderRadius: 3, backgroundColor: COLORS.dim },
  heatCellFilled: { backgroundColor: COLORS.primary },
});
