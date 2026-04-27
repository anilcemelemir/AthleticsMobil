import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { getConversations, ROLE } from '@/lib/api';
import { chatConnection } from '@/lib/chat-connection';

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
  const pathname = usePathname();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const isAdmin = user?.role === ROLE.Admin;
  const isPt = user?.role === ROLE.PT;
  const isMember = user?.role === ROLE.Member;

  const homeTitle = isAdmin ? 'Yönetim' : 'Panel';
  const homeIcon: React.ComponentProps<typeof Ionicons>['name'] = isAdmin
    ? 'people'
    : isPt
      ? 'speedometer'
      : 'home';

  const loadUnreadMessages = useCallback(async () => {
    if (!user || isAdmin) {
      setUnreadMessages(0);
      return;
    }

    try {
      const conversations = await getConversations();
      setUnreadMessages(
        conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
      );
    } catch {
      setUnreadMessages(0);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    loadUnreadMessages();
  }, [loadUnreadMessages, pathname]);

  useEffect(() => {
    if (!user || isAdmin) return;
    const offMessage = chatConnection.onMessage(loadUnreadMessages);
    const offRead = chatConnection.onRead(loadUnreadMessages);
    return () => {
      offMessage();
      offRead();
    };
  }, [isAdmin, loadUnreadMessages, user]);

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
          title: 'Randevu',
          // Hide from non-members.
          href: isMember ? '/(tabs)/book' : null,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="add-circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Rezervasyonlar',
          href: isMember ? '/(tabs)/reservations' : null,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Takvim',
          href: isPt ? '/(tabs)/schedule' : null,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Bugün',
          href: isPt ? '/(tabs)/today' : null,
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="today" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Üyeler',
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
          title: 'Mesajlar',
          // Admins manage; only PT and Members chat.
          href: isAdmin ? null : '/(tabs)/messages',
          tabBarBadge:
            unreadMessages > 0 ? (unreadMessages > 99 ? '99+' : unreadMessages) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#facc15',
            color: '#3c2f00',
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10,
          },
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="chatbubbles" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="person-circle" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

