import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { ProfileRefreshContext } from '../lib/profileContext';
import { RootStackParamList } from '../types';
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PostSessionScreen from '../screens/PostSessionScreen';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    setHasProfile(!!data);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) checkProfile(data.session.user.id);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) checkProfile(newSession.user.id);
      else {
        setHasProfile(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [checkProfile]);

  const refreshProfile = useCallback(() => {
    if (session) checkProfile(session.user.id);
  }, [session, checkProfile]);

  if (loading) return null;

  return (
    <ProfileRefreshContext.Provider value={refreshProfile}>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : hasProfile === false ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="PostSession"
              component={PostSessionScreen}
              options={{ presentation: 'modal' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </ProfileRefreshContext.Provider>
  );
}
