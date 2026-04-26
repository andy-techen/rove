import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';

const COLORS = { bg: '#111', primary: '#E05C3A', text: '#F5F5F0', muted: '#888', card: '#1E1E1E' };

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupSent, setSignupSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setLoading(true);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (error) Alert.alert('Error', error.message);
      else setSignupSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (error) Alert.alert('Error', error.message);
    }
  }

  if (signupSent) {
    return (
      <KeyboardAvoidingView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.logo}>Rove</Text>
          <View style={styles.sentBox}>
            <Text style={styles.sentText}>Confirm your email.</Text>
            <Text style={styles.sentSub}>
              We sent a confirmation link to {email}. Tap it to activate your account, then come back here to sign in.
            </Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => { setSignupSent(false); setMode('signin'); setPassword(''); }}
            >
              <Text style={styles.backText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>Rove</Text>
        <Text style={styles.tagline}>Your daily vocal check-in.</Text>

        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor={COLORS.muted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={COLORS.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
        >
          <Text style={styles.toggleText}>
            {mode === 'signup' ? 'Already have an account? Sign in' : "New here? Create an account"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 56, fontWeight: '800', color: COLORS.primary, letterSpacing: -2, marginBottom: 8 },
  tagline: { fontSize: 18, color: COLORS.muted, marginBottom: 48 },
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  toggle: { alignSelf: 'center', marginTop: 20 },
  toggleText: { color: COLORS.primary, fontSize: 15 },
  sentBox: { backgroundColor: COLORS.card, borderRadius: 12, padding: 24, marginTop: 32 },
  sentText: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  sentSub: { color: COLORS.muted, fontSize: 15, lineHeight: 22, marginBottom: 20 },
  backButton: { alignSelf: 'flex-start' },
  backText: { color: COLORS.primary, fontSize: 15 },
});
