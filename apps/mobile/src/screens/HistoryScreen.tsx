import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { Session, Metric, Milestone } from '../types';

const COLORS = {
  bg: '#111',
  primary: '#E05C3A',
  text: '#F5F5F0',
  muted: '#888',
  card: '#1E1E1E',
  dim: '#2A2A2A',
};

const RANGE_MIN_MIDI = 36; // C2
const RANGE_MAX_MIDI = 84; // C6

const MOOD_LABELS: Record<string, string> = {
  rough: '😬 Rough', okay: '😐 Okay', good: '🙂 Good', great: '😄 Great',
};

function midiToNote(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface SessionWithExtras extends Omit<Session, 'prompts'> {
  recordings?: { id: string; storage_path: string }[];
  metrics?: Metric[];
  prompts?: { text: string; type: string };
}

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionWithExtras[]>([]);
  const [allMetrics, setAllMetrics] = useState<Metric[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const realtimeRef = useRef<RealtimeChannel | null>(null);

  const subscribeToMetrics = useCallback((userId: string) => {
    realtimeRef.current?.unsubscribe();
    realtimeRef.current = supabase
      .channel(`metrics-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'metrics',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Metric;
          if (updated.analysis_status === 'complete') {
            setAllMetrics((prev) => {
              const without = prev.filter((m) => m.id !== updated.id);
              return [...without, updated];
            });
            setSessions((prev) =>
              prev.map((s) => ({
                ...s,
                metrics: s.metrics?.map((m) => (m.id === updated.id ? updated : m)),
              }))
            );
          }
        }
      )
      .subscribe();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [sessionsRes, metricsRes, milestonesRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('*, prompts(text, type), recordings(id, storage_path), metrics(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('metrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('analysis_status', 'complete'),
      supabase.from('milestones').select('*').eq('user_id', user.id),
    ]);

    setSessions((sessionsRes.data as SessionWithExtras[]) || []);
    setAllMetrics((metricsRes.data as Metric[]) || []);
    setMilestones((milestonesRes.data as Milestone[]) || []);
    setLoading(false);

    // Subscribe with user_id so the filter is scoped server-side
    subscribeToMetrics(user.id);
  }, [subscribeToMetrics]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        realtimeRef.current?.unsubscribe();
        soundRef.current?.unloadAsync();
      };
    }, [loadData])
  );

  const lowestMidi = allMetrics.length
    ? Math.min(...allMetrics.map((m) => m.lowest_midi!).filter(Boolean))
    : null;
  const highestMidi = allMetrics.length
    ? Math.max(...allMetrics.map((m) => m.highest_midi!).filter(Boolean))
    : null;

  const highestNoteMilestone = milestones.find((m) => m.type === 'highest_note');
  const rangeRecordMilestone = milestones.find((m) => m.type === 'range_record');

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function playRecording(storagePath: string, recordingId: string) {
    if (playingId === recordingId) {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      setPlayingId(null);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    const { data } = await supabase.storage.from('recordings').createSignedUrl(storagePath, 3600);
    if (!data?.signedUrl) return;

    const { sound } = await Audio.Sound.createAsync({ uri: data.signedUrl });
    soundRef.current = sound;
    setPlayingId(recordingId);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        setPlayingId(null);
        sound.unloadAsync();
        soundRef.current = null;
      }
    });
  }

  const today = new Date();
  const sessionDateSet = new Set(
    sessions.map((s) => new Date(s.created_at).toISOString().slice(0, 10))
  );
  const heatmapDays = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (83 - i));
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
        <Text style={styles.screenTitle}>History</Text>

        {/* Vocal Range Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vocal Range</Text>
          {lowestMidi !== null && highestMidi !== null ? (
            <>
              <View style={styles.rangeBarContainer}>
                <View
                  style={[
                    styles.rangeBarFill,
                    {
                      left: `${((lowestMidi - RANGE_MIN_MIDI) / (RANGE_MAX_MIDI - RANGE_MIN_MIDI)) * 100}%`,
                      right: `${((RANGE_MAX_MIDI - highestMidi) / (RANGE_MAX_MIDI - RANGE_MIN_MIDI)) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.rangeLabels}>
                <Text style={styles.rangeNote}>{midiToNote(lowestMidi)}</Text>
                <Text style={styles.rangeNote}>{midiToNote(highestMidi)}</Text>
              </View>
              <View style={styles.badges}>
                {highestNoteMilestone && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      🏆 Highest: {midiToNote(parseInt(highestNoteMilestone.value))}
                    </Text>
                  </View>
                )}
                {rangeRecordMilestone && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      🎯 Range: {rangeRecordMilestone.value} semitones
                    </Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <Text style={styles.empty}>Complete a session to see your range.</Text>
          )}
        </View>

        {/* Session Timeline */}
        <Text style={styles.sectionTitle}>Sessions</Text>
        {sessions.length === 0 && (
          <Text style={styles.empty}>No sessions yet. Start recording!</Text>
        )}
        {sessions.map((session) => {
          const isExpanded = expanded.has(session.id);
          const sessionMetric = session.metrics?.[0];
          const recording = session.recordings?.[0];

          return (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionRow}
              onPress={() => toggleExpand(session.id)}
              activeOpacity={0.7}
            >
              <View style={styles.sessionHeader}>
                <View style={styles.sessionMain}>
                  <Text style={styles.sessionDate}>{formatDate(session.created_at)}</Text>
                  {session.prompts && (
                    <Text style={styles.sessionPrompt} numberOfLines={isExpanded ? undefined : 1}>
                      {session.prompts.text}
                    </Text>
                  )}
                </View>
                <View style={styles.sessionMeta}>
                  {session.mood && (
                    <Text style={styles.moodTag}>{MOOD_LABELS[session.mood]}</Text>
                  )}
                  <Text style={styles.duration}>{formatDuration(session.duration_sec)}</Text>
                </View>
              </View>

              {isExpanded && (
                <View style={styles.sessionDetail}>
                  {session.intent_note ? (
                    <Text style={styles.intentNote}>&ldquo;{session.intent_note}&rdquo;</Text>
                  ) : null}

                  {sessionMetric?.analysis_status === 'complete' ? (
                    <View style={styles.metricsRow}>
                      <Text style={styles.metricItem}>⬇ {sessionMetric.lowest_note}</Text>
                      <Text style={styles.metricItem}>⬆ {sessionMetric.highest_note}</Text>
                      <Text style={styles.metricItem}>↕ {sessionMetric.range_semitones} semitones</Text>
                    </View>
                  ) : sessionMetric?.analysis_status === 'pending' ? (
                    <Text style={styles.pending}>Analysis in progress…</Text>
                  ) : null}

                  {recording && (
                    <TouchableOpacity
                      style={styles.playButton}
                      onPress={() => playRecording(recording.storage_path, recording.id)}
                    >
                      <Text style={styles.playButtonText}>
                        {playingId === recording.id ? '⏹ Stop' : '▶ Play'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* 12-week heatmap */}
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.heatmap}>
          {heatmapDays.map((date) => (
            <View
              key={date}
              style={[styles.heatCell, sessionDateSet.has(date) && styles.heatCellFilled]}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text, paddingTop: 24, marginBottom: 24 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 32, borderWidth: 1, borderColor: COLORS.dim },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.muted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  rangeBarContainer: { height: 8, backgroundColor: COLORS.dim, borderRadius: 4, marginBottom: 8, position: 'relative' },
  rangeBarFill: { position: 'absolute', top: 0, bottom: 0, backgroundColor: COLORS.primary, borderRadius: 4 },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  rangeNote: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: '#2D1F1A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  empty: { color: COLORS.muted, fontSize: 15, marginBottom: 24, lineHeight: 22 },
  sessionRow: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.dim },
  sessionHeader: { flexDirection: 'row', gap: 12 },
  sessionMain: { flex: 1 },
  sessionDate: { color: COLORS.muted, fontSize: 12, marginBottom: 4 },
  sessionPrompt: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  sessionMeta: { alignItems: 'flex-end', gap: 4 },
  moodTag: { color: COLORS.muted, fontSize: 12 },
  duration: { color: COLORS.muted, fontSize: 12 },
  sessionDetail: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.dim, gap: 12 },
  intentNote: { color: COLORS.muted, fontSize: 14, fontStyle: 'italic' },
  metricsRow: { flexDirection: 'row', gap: 16 },
  metricItem: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  pending: { color: COLORS.muted, fontSize: 13 },
  playButton: { alignSelf: 'flex-start', backgroundColor: COLORS.dim, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  playButtonText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 32 },
  heatCell: { width: 14, height: 14, borderRadius: 3, backgroundColor: COLORS.dim },
  heatCellFilled: { backgroundColor: COLORS.primary },
});
