import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { getConversations, ROLE, type ConversationDto } from '@/lib/api';
import { chatConnection } from '@/lib/chat-connection';

const ROLE_LABEL: Record<number, string> = {
  0: 'Admin',
  1: 'PT',
  2: 'Member',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const diff = (now.getTime() - d.getTime()) / 86_400_000;
  if (diff < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<ConversationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getConversations();
      setItems(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  // Refresh whenever the tab gains focus (e.g. after returning from a chat).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live-update the list when a new message arrives.
  useEffect(() => {
    return chatConnection.onMessage(() => {
      load();
    });
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openChat = (c: ConversationDto) => {
    router.push({
      pathname: '/chat/[userId]',
      params: { userId: String(c.otherUserId), name: c.otherUserName },
    });
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#facc15" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="px-5 pb-3 pt-2">
        <Text className="text-sm text-on-surface-variant">Inbox</Text>
        <Text className="text-3xl font-bold text-on-background">Messages</Text>
      </View>

      {error && (
        <View className="mx-5 mb-3 rounded-xl border border-accent-red/40 bg-accent-red/10 p-3">
          <Text className="text-sm text-accent-red">{error}</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(it) => it.otherUserId.toString()}
        contentContainerClassName="px-5 pb-10"
        ItemSeparatorComponent={() => <View className="h-2" />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
        ListEmptyComponent={
          <View className="mt-12 items-center px-6">
            <Ionicons name="chatbubbles-outline" size={48} color="#9a9078" />
            <Text className="mt-2 text-center text-sm text-on-surface-variant">
              No conversations yet.{'\n'}
              {user?.role === ROLE.PT
                ? 'Send a message to a member to start chatting.'
                : 'Your trainer will reach out soon.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openChat(item)}
            className="flex-row items-center rounded-2xl bg-surface-container p-4 shadow-sm active:bg-surface-container-high"
          >
            <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Text className="text-base font-bold text-primary">
                {item.otherUserName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1 pr-2">
              <View className="flex-row items-center">
                <Text className="flex-1 text-base font-semibold text-on-background" numberOfLines={1}>
                  {item.otherUserName}
                </Text>
                <Text className="text-xs text-outline">{formatWhen(item.lastTimestamp)}</Text>
              </View>
              <View className="mt-0.5 flex-row items-center">
                <View className="mr-2 rounded-full bg-surface-container-high px-2 py-0.5">
                  <Text className="text-[10px] font-semibold uppercase text-on-surface-variant">
                    {ROLE_LABEL[item.otherUserRole] ?? '—'}
                  </Text>
                </View>
                <Text
                  className={`flex-1 text-sm ${item.unreadCount > 0 ? 'font-semibold text-on-background' : 'text-on-surface-variant'}`}
                  numberOfLines={1}
                >
                  {item.lastMessage}
                </Text>
              </View>
            </View>
            {item.unreadCount > 0 && (
              <View className="ml-2 h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5">
                <Text className="text-[11px] font-bold text-on-primary">{item.unreadCount}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
