import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AthletixHeader } from '@/components/AthletixHeader';
import { useAuth } from '@/contexts/AuthContext';
import { getChatHistory, sendChatMessage, type MessageDto } from '@/lib/api';
import { chatConnection } from '@/lib/chat-connection';

const TYPING_TIMEOUT_MS = 2500;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shouldShowDateBreak(prev: MessageDto | undefined, curr: MessageDto): boolean {
  if (!prev) return true;
  const a = new Date(prev.timestamp);
  const b = new Date(curr.timestamp);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string; name?: string }>();
  const otherUserId = Number(params.userId);
  const otherName = (params.name as string) ?? 'Sohbet';
  const { user } = useAuth();
  const myId = user?.id ?? 0;

  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef<number>(0);
  const listRef = useRef<FlatList<MessageDto>>(null);

  // Initial history load.
  useEffect(() => {
    if (!otherUserId) return;
    (async () => {
      setLoading(true);
      try {
        const data = await getChatHistory(otherUserId);
        setMessages(data);
      } catch (e) {
        console.warn('history failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [otherUserId]);

  // Mark thread as read whenever opened or new messages arrive.
  useEffect(() => {
    chatConnection.markAsRead(otherUserId);
  }, [otherUserId, messages.length]);

  // Live updates from SignalR.
  useEffect(() => {
    const offMsg = chatConnection.onMessage((m) => {
      const involves =
        (m.senderId === myId && m.receiverId === otherUserId) ||
        (m.senderId === otherUserId && m.receiverId === myId);
      if (!involves) return;
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
      // Receiver got a message → mark read.
      if (m.senderId === otherUserId) {
        chatConnection.markAsRead(otherUserId);
      }
    });
    const offTyping = chatConnection.onTyping((senderId) => {
      if (senderId !== otherUserId) return;
      setOtherTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setOtherTyping(false), TYPING_TIMEOUT_MS);
    });
    return () => {
      offMsg();
      offTyping();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [myId, otherUserId]);

  // Auto-scroll to bottom on new content.
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length, otherTyping]);

  const onChangeText = useCallback(
    (v: string) => {
      setText(v);
      const now = Date.now();
      if (now - lastTypingSent.current > 1500) {
        lastTypingSent.current = now;
        chatConnection.typing(otherUserId);
      }
    },
    [otherUserId],
  );

  const send = useCallback(async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      const viaHub = await chatConnection.send(otherUserId, content);
      if (!viaHub) {
        // fallback to REST
        const fallback = await sendChatMessage(otherUserId, content);
        setMessages((prev) =>
          prev.some((x) => x.id === fallback.id) ? prev : [...prev, fallback],
        );
      }
    } catch (e: any) {
      console.warn('send failed', e?.message ?? e);
      try {
        const fallback = await sendChatMessage(otherUserId, content);
        setMessages((prev) =>
          prev.some((x) => x.id === fallback.id) ? prev : [...prev, fallback],
        );
      } catch (err) {
        console.warn('fallback send failed', err);
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, otherUserId]);

  const data = useMemo(() => messages, [messages]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <AthletixHeader onBack={() => router.back()} />
      <View className="flex-row items-center border-b border-outline-variant/40 bg-surface-container px-4 py-3">
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Text className="text-sm font-bold text-primary">
            {otherName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-on-background" numberOfLines={1}>
            {otherName}
          </Text>
          <Text className="text-xs text-on-surface-variant">
            {otherTyping ? 'Yazıyor...' : 'Çevrim ici'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        style={{ flex: 1 }}
      >
        {loading ? (
          <ActivityIndicator className="mt-12" size="large" color="#facc15" />
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(m) => m.id.toString()}
            contentContainerClassName="px-3 pt-3 pb-2"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View className="mt-12 items-center">
                <Ionicons name="chatbox-outline" size={48} color="#9a9078" />
                <Text className="mt-2 text-sm text-on-surface-variant">Merhaba de</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const mine = item.senderId === myId;
              const showDate = shouldShowDateBreak(data[index - 1], item);
              return (
                <View>
                  {showDate && (
                    <View className="my-2 items-center">
                      <View className="rounded-full bg-surface-container-high px-3 py-1">
                        <Text className="text-[11px] font-semibold text-on-surface-variant">
                          {new Date(item.timestamp).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                  )}
                  <View
                    className={`my-0.5 flex-row ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <View
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                        mine
                          ? 'rounded-br-md bg-primary'
                          : 'rounded-bl-md bg-surface-container shadow-sm'
                      }`}
                    >
                      <Text
                        className={`text-[15px] ${mine ? 'text-on-primary' : 'text-on-background'}`}
                      >
                        {item.content}
                      </Text>
                      <Text
                        className={`mt-1 text-[10px] ${mine ? 'text-on-primary/70' : 'text-outline'}`}
                      >
                        {formatTime(item.timestamp)}
                        {mine && (item.isRead ? '  ✓✓' : '  ✓')}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              otherTyping ? (
                <View className="my-1 flex-row justify-start">
                  <View className="rounded-2xl rounded-bl-md bg-surface-container px-3.5 py-2 shadow-sm">
                    <Text className="text-sm italic text-on-surface-variant">Yazıyor...</Text>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        <View className="flex-row items-end gap-2 border-t border-outline-variant bg-surface-container px-3 py-2">
          <TextInput
            value={text}
            onChangeText={onChangeText}
            placeholder="Mesaj yaz..."
            placeholderTextColor="#9a9078"
            multiline
            className="max-h-32 flex-1 rounded-2xl bg-surface-container-high px-4 py-2.5 text-[15px] text-on-background"
          />
          <Pressable
            onPress={send}
            disabled={sending || !text.trim()}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-50"
          >
            {sending ? (
              <ActivityIndicator color="#3c2f00" />
            ) : (
              <Ionicons name="send" size={18} color="#3c2f00" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

