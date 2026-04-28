import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  AnnouncementDto,
  dismissAnnouncement,
  getMyAnnouncements,
} from '@/lib/api';
import { getSecureItem, setSecureItem } from '@/lib/secure-storage';

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} gün önce`;
  return d.toLocaleDateString();
}

const AUDIENCE_LABEL: Record<string, string> = {
  All: 'HERKES',
  PT: 'ANTRENÖRLER',
  Member: 'ÜYELER',
};

const readKey = (userId: number | string) => `notif_read_${userId}`;
const dismissedKey = (userId: number | string) => `notif_dismissed_${userId}`;

async function loadIdSet(key: string): Promise<Set<number>> {
  try {
    const raw = await getSecureItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n) => typeof n === 'number'));
  } catch {
    return new Set();
  }
}

async function saveIdSet(key: string, set: Set<number>): Promise<void> {
  try {
    await setSecureItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const userId = user?.id;

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AnnouncementDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const hydratedRef = useRef(false);

  // Hydrate persisted read/dismissed sets when the user becomes available.
  useEffect(() => {
    if (!userId) {
      hydratedRef.current = false;
      setReadIds(new Set());
      setDismissedIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const [r, d] = await Promise.all([
        loadIdSet(readKey(userId)),
        loadIdSet(dismissedKey(userId)),
      ]);
      if (cancelled) return;
      setReadIds(r);
      setDismissedIds(d);
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await getMyAnnouncements();
      setItems(data);
    } catch {
      // Silent — bell stays usable even if request fails.
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch + light polling so the badge stays roughly fresh.
  useEffect(() => {
    if (!userId) return;
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [userId, load]);

  // Visible items = everything not locally dismissed.
  const visibleItems = useMemo(
    () => items.filter((a) => !dismissedIds.has(a.id)),
    [items, dismissedIds],
  );

  // Badge = visible AND not read.
  const unreadCount = useMemo(
    () => visibleItems.reduce((acc, a) => (readIds.has(a.id) ? acc : acc + 1), 0),
    [visibleItems, readIds],
  );

  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  const markAllVisibleRead = useCallback(() => {
    if (!userId) return;
    if (visibleItems.length === 0) return;
    setReadIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const a of visibleItems) {
        if (!next.has(a.id)) {
          next.add(a.id);
          changed = true;
        }
      }
      if (!changed) return prev;
      saveIdSet(readKey(userId), next);
      return next;
    });
  }, [userId, visibleItems]);

  const handleOpen = () => {
    setOpen(true);
    load();
    // Reset the badge immediately on open.
    markAllVisibleRead();
  };

  // After a refetch while the sheet is open, mark any newly fetched items read too.
  useEffect(() => {
    if (!open) return;
    markAllVisibleRead();
  }, [open, items, markAllVisibleRead]);

  const handleDismiss = async (id: number) => {
    if (!userId) return;
    // Optimistic local dismissal + persistence.
    setDismissedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveIdSet(dismissedKey(userId), next);
      return next;
    });
    try {
      setDismissingId(id);
      await dismissAnnouncement(id);
      // Server-side dismissed: drop from items so storage doesn't grow forever.
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // Even on failure we keep it locally hidden; next fetch will reconcile.
    } finally {
      setDismissingId(null);
    }
  };

  if (!userId) return null;

  return (
    <>
      <Pressable
        onPress={handleOpen}
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-sm active:bg-surface-container-high"
      >
        <Ionicons name="notifications-outline" size={22} color="#facc15" />
        {unreadCount > 0 && (
          <View
            className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1"
            style={{ borderWidth: 1.5, borderColor: '#0a0a0a' }}
          >
            <Text
              className="text-white"
              style={{ fontFamily: 'Inter_700Bold', fontSize: 9, lineHeight: 11 }}
            >
              {badgeText}
            </Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/70">
          <View
            className="rounded-t-2xl border-t border-outline-variant bg-surface-container-lowest"
            style={{ maxHeight: '80%' }}
          >
            <View className="flex-row items-center justify-between border-b border-outline-variant px-5 py-4">
              <View className="flex-row items-center">
                <Ionicons name="notifications" size={18} color="#facc15" />
                <Text
                  className="ml-2 text-on-background"
                  style={{ fontFamily: 'Lexend_700Bold', fontSize: 16, letterSpacing: 0.5 }}
                >
                  Duyurular
                </Text>
                {visibleItems.length > 0 && (
                  <View className="ml-2 rounded-sm bg-primary px-2 py-0.5">
                    <Text
                      className="text-on-primary"
                      style={{ fontFamily: 'Inter_700Bold', fontSize: 10 }}
                    >
                      {visibleItems.length}
                    </Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-sm active:bg-surface-container-high"
              >
                <Ionicons name="close" size={20} color="#ebe2d0" />
              </Pressable>
            </View>

            {loading && visibleItems.length === 0 ? (
              <View className="items-center py-12">
                <ActivityIndicator color="#facc15" />
              </View>
            ) : visibleItems.length === 0 ? (
              <View className="items-center px-6 py-12">
                <Ionicons name="notifications-off-outline" size={42} color="#9a9078" />
                <Text
                  className="mt-3 text-on-background"
                  style={{ fontFamily: 'Lexend_700Bold', fontSize: 15 }}
                >
                  Henüz bir duyuru yok
                </Text>
                <Text
                  className="mt-1 text-center text-on-surface-variant"
                  style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
                >
                  Yeni duyurular geldiğinde burada görünecek.
                </Text>
              </View>
            ) : (
              <ScrollView
                contentContainerClassName="px-4 pb-8 pt-3"
                showsVerticalScrollIndicator={false}
              >
                {visibleItems.map((item) => {
                  const isRead = readIds.has(item.id);
                  return (
                    <View
                      key={item.id}
                      className={
                        isRead
                          ? 'mb-3 rounded-sm bg-surface-container p-4'
                          : 'mb-3 rounded-sm border border-primary/40 border-l-4 border-l-primary bg-surface-container p-4'
                      }
                      style={{ opacity: isRead ? 0.55 : 1 }}
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="mr-3 flex-1">
                          <View className="mb-1 flex-row items-center">
                            {!isRead && (
                              <View
                                className="mr-2 h-2 w-2 rounded-full bg-primary"
                                accessibilityLabel="Okunmadı"
                              />
                            )}
                            <Text
                              className="flex-1 text-on-background"
                              style={{
                                fontFamily: isRead ? 'Inter_600SemiBold' : 'Lexend_700Bold',
                                fontSize: 14,
                                letterSpacing: 0.3,
                              }}
                              numberOfLines={2}
                            >
                              {item.title}
                            </Text>
                          </View>
                          <Text
                            className="text-on-surface-variant"
                            style={{
                              fontFamily: 'Inter_400Regular',
                              fontSize: 13,
                              lineHeight: 19,
                            }}
                          >
                            {item.content}
                          </Text>
                          <View className="mt-3 flex-row items-center">
                            <View className="rounded-sm bg-primary/15 px-2 py-0.5">
                              <Text
                                className="text-primary"
                                style={{
                                  fontFamily: 'Inter_700Bold',
                                  fontSize: 9,
                                  letterSpacing: 0.6,
                                }}
                              >
                                {AUDIENCE_LABEL[item.targetAudience] ?? item.targetAudience}
                              </Text>
                            </View>
                            <Text
                              className="ml-2 text-on-surface-variant"
                              style={{ fontFamily: 'Inter_400Regular', fontSize: 11 }}
                            >
                              {formatRelative(item.createdAt)}
                              {item.createdByName ? ` · ${item.createdByName}` : ''}
                            </Text>
                          </View>
                        </View>

                        <Pressable
                          disabled={dismissingId === item.id}
                          onPress={() => handleDismiss(item.id)}
                          hitSlop={12}
                          accessibilityLabel="Duyuruyu sil"
                          className="h-9 w-9 items-center justify-center rounded-sm border border-outline-variant active:bg-red-500/15"
                        >
                          {dismissingId === item.id ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                            <Ionicons name="close" size={18} color="#ef4444" />
                          )}
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
