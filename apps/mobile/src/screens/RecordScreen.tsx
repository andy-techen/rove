import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { getDailyPrompt } from '../lib/prompts';
import { MainTabParamList, RootStackParamList, Profile, Prompt } from '../types';

const COLORS = { bg: '#111', primary: '#E05C3A', text: '#F5F5F0', muted: '#888', dim: '#2A2A2A' };

type Nav = BottomTabNavigationProp<MainTabParamList, 'Record'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

function makeUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function RecordScreen() {
  const navigation = useNavigation<Nav>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [logged, setLogged] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnimRef = useRef(new Animated.Value(1));
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!data) return;
    setProfile(data as Profile);
    const p = await getDailyPrompt(data.goal, data.genre);
    setPrompt(p);
  }, []);

  useEffect(() => {
    loadProfile();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadProfile]);

  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimRef.current, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnimRef.current, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }

  function stopPulse() {
    pulseLoop.current?.stop();
    pulseAnimRef.current.setValue(1);
  }

  async function handlePress() {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording: rec } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      setRecording(rec);
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      startPulse();
    } catch {
      Alert.alert('Microphone Error', 'Could not start recording. Check microphone permissions.');
    }
  }

  async function stopRecording() {
    if (!recording || !profile || !prompt) return;

    stopPulse();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    const durationSec = elapsed;
    setSaving(true);

    const sessionId = makeUuid();
    const recordingId = makeUuid();

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error('No recording URI');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No user session');
      const user = session.user;

      const storagePath = `${user.id}/${sessionId}/${recordingId}.m4a`;

      await supabase.from('sessions').insert({
        id: sessionId,
        user_id: user.id,
        prompt_id: prompt.id,
        duration_sec: durationSec,
      });

      await supabase.from('recordings').insert({
        id: recordingId,
        session_id: sessionId,
        user_id: user.id,
        storage_path: storagePath,
      });

      // fetch the file URI as a blob — avoids Buffer which is unavailable in React Native
      const fileResponse = await fetch(uri);
      const blob = await fileResponse.blob();

      await supabase.storage.from('recordings').upload(storagePath, blob, {
        contentType: 'audio/m4a',
        upsert: false,
      });

      await supabase.from('metrics').insert({
        recording_id: recordingId,
        user_id: user.id,
        analysis_status: 'pending',
      });

      const fastApiUrl = process.env.EXPO_PUBLIC_FASTAPI_URL;
      if (fastApiUrl) {
        fetch(`${fastApiUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ recording_id: recordingId, storage_path: storagePath }),
        }).catch((err) => {
          console.warn('[Rove] /analyze fire-and-forget failed:', err);
        });
      }

      setLogged(true);
      setSaving(false);

      setTimeout(() => {
        setLogged(false);
        setElapsed(0);
        setRecording(null);
        const rootNav = navigation.getParent<RootNav>();
        rootNav?.navigate('PostSession', { sessionId });
      }, 800);
    } catch (err) {
      // Best-effort cleanup of any rows that were inserted before the failure
      await supabase.from('metrics').delete().eq('recording_id', recordingId);
      await supabase.from('recordings').delete().eq('id', recordingId);
      await supabase.from('sessions').delete().eq('id', sessionId);

      setSaving(false);
      const msg = err instanceof Error ? err.message : 'Something went wrong saving your session.';
      Alert.alert('Error', msg);
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.promptArea}>
          {prompt ? (
            <Text style={styles.promptText}>{prompt.text}</Text>
          ) : (
            <Text style={styles.promptPlaceholder}>Loading prompt…</Text>
          )}
        </View>

        <View style={styles.recordArea}>
          {isRecording && (
            <Text style={styles.timer}>{formatTime(elapsed)}</Text>
          )}

          <Animated.View style={{ transform: [{ scale: pulseAnimRef.current }] }}>
            <TouchableOpacity
              style={[styles.recordButton, isRecording && styles.recordButtonActive]}
              onPress={handlePress}
              disabled={saving}
              activeOpacity={0.8}
            >
              {isRecording ? (
                <View style={styles.stopSquare} />
              ) : (
                <View style={styles.micIcon}>
                  <Text style={styles.micText}>🎙</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {logged && <Text style={styles.loggedText}>Logged ✓</Text>}
          {saving && !logged && <Text style={styles.savingText}>Saving…</Text>}
        </View>

        <Text style={styles.hint}>{isRecording ? 'Tap to stop' : 'Tap to start'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  promptArea: { flex: 1, justifyContent: 'center', paddingBottom: 32 },
  promptText: { color: COLORS.text, fontSize: 24, lineHeight: 36, fontWeight: '500', textAlign: 'center' },
  promptPlaceholder: { color: COLORS.muted, fontSize: 18, textAlign: 'center' },
  recordArea: { alignItems: 'center', gap: 16, marginBottom: 16 },
  timer: { color: COLORS.text, fontSize: 32, fontWeight: '300', letterSpacing: 2 },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  recordButtonActive: { backgroundColor: '#C04020' },
  stopSquare: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#fff' },
  micIcon: { alignItems: 'center', justifyContent: 'center' },
  micText: { fontSize: 40 },
  loggedText: { color: '#4CAF50', fontSize: 18, fontWeight: '700' },
  savingText: { color: COLORS.muted, fontSize: 16 },
  hint: { textAlign: 'center', color: COLORS.muted, fontSize: 14, marginBottom: 32 },
});
