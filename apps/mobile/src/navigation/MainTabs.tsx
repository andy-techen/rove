import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { MainTabParamList } from '../types';
import HomeScreen from '../screens/HomeScreen';
import RecordScreen from '../screens/RecordScreen';
import HistoryScreen from '../screens/HistoryScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const COLORS = {
  primary: '#E05C3A',
  inactive: '#888',
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen
        name="Record"
        component={RecordScreen}
        options={{
          tabBarLabel: 'Record',
          tabBarItemStyle: styles.recordTab,
          tabBarLabelStyle: { ...styles.label, color: COLORS.primary, fontWeight: '700' },
        }}
      />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'History' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1A1A1A',
    borderTopColor: '#2A2A2A',
    height: 64,
  },
  label: {
    fontSize: 11,
    marginBottom: 4,
  },
  recordTab: {
    borderTopWidth: 2,
    borderTopColor: '#E05C3A',
  },
});
