import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { ROLE } from '@/lib/api';

function TabBarIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={24} name={name} color={color} />;
}

export default function TabLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLE.Admin;
  const isPt = user?.role === ROLE.PT;
  const isMember = user?.role === ROLE.Member;

  const homeTitle = isAdmin ? 'Management' : isPt ? 'Schedule' : 'Dashboard';
  const homeIcon: React.ComponentProps<typeof Ionicons>['name'] = isAdmin
    ? 'people'
    : isPt
      ? 'calendar'
      : 'home';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#facc15',
        tabBarInactiveTintColor: '#9a9078',
        tabBarStyle: {
          backgroundColor: '#0B0905',
          borderTopColor: '#4d4632',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
          letterSpacing: 0.4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: homeTitle,
          tabBarIcon: ({ color }) => <TabBarIcon name={homeIcon} color={color} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: 'Book',
          // Hide from non-members.
          href: isMember ? '/(tabs)/book' : null,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="add-circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          // PT-only tab to view & message members.
          href: isPt ? '/(tabs)/clients' : null,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="people" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          // Admins manage; only PT and Members chat.
          href: isAdmin ? null : '/(tabs)/messages',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="chatbubbles" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="person-circle" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
