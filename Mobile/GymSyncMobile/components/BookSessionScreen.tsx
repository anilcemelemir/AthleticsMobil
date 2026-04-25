import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import {
  bookAppointment,
  getSlotsForPt,
  getTrainers,
  type AvailabilityDto,
  type TrainerDto,
} from '@/lib/api';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BookSessionScreen() {
  const { user, refreshUser } = useAuth();

  // Step state
  const [trainers, setTrainers] = useState<TrainerDto[]>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTrainer, setSelectedTrainer] = useState<TrainerDto | null>(null);
  const [slots, setSlots] = useState<AvailabilityDto[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [pendingSlot, setPendingSlot] = useState<AvailabilityDto | null>(null);
  const [booking, setBooking] = useState(false);

  const loadTrainers = useCallback(async () => {
    try {
      setError(null);
      const res = await getTrainers();
      setTrainers(res);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load trainers.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingTrainers(true);
      await loadTrainers();
      setLoadingTrainers(false);
    })();
  }, [loadTrainers]);

  const loadSlots = useCallback(async (ptId: number) => {
    try {
      setError(null);
      const res = await getSlotsForPt(ptId);
      setSlots(res);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load slots.');
    }
  }, []);

  const openTrainer = async (t: TrainerDto) => {
    setSelectedTrainer(t);
    setLoadingSlots(true);
    await loadSlots(t.id);
    setLoadingSlots(false);
  };

  const onRefreshSlots = useCallback(async () => {
    if (!selectedTrainer) return;
    setRefreshing(true);
    await loadSlots(selectedTrainer.id);
    setRefreshing(false);
  }, [selectedTrainer, loadSlots]);

  const confirmBooking = async () => {
    if (!pendingSlot) return;
    try {
      setBooking(true);
      const res = await bookAppointment(pendingSlot.id);
      setPendingSlot(null);
      await refreshUser();
      // Remove the slot locally so the list updates instantly.
      setSlots((prev) => prev.filter((s) => s.id !== res.id && s.id !== pendingSlot.id));
      Alert.alert(
        'Booked!',
        `Session confirmed for ${formatDate(pendingSlot.slotStart)} at ${formatTime(pendingSlot.slotStart)}.\nRemaining credits: ${res.remainingCredits}`,
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Booking failed.';
      Alert.alert('Booking failed', msg);
    } finally {
      setBooking(false);
    }
  };

  // ---------- Render ----------

  if (loadingTrainers && !selectedTrainer) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#facc15" />
      </SafeAreaView>
    );
  }

  if (selectedTrainer) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <View className="flex-row items-center px-5 pb-3 pt-2">
          <Pressable
            onPress={() => {
              setSelectedTrainer(null);
              setSlots([]);
            }}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surface-container shadow-sm active:bg-surface-container-high"
          >
            <Ionicons name="chevron-back" size={22} color="#ebe2d0" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs text-on-surface-variant">Available slots</Text>
            <Text className="text-lg font-bold text-on-background" numberOfLines={1}>
              {selectedTrainer.fullName}
            </Text>
          </View>
        </View>

        <View className="mx-5 mb-3 flex-row items-center rounded-xl bg-primary/10 p-3">
          <Ionicons name="information-circle-outline" size={18} color="#facc15" />
          <Text className="ml-2 flex-1 text-xs text-primary">
            You have <Text className="font-bold">{user?.remainingCredits ?? 0}</Text> credit
            {user?.remainingCredits === 1 ? '' : 's'} remaining.
          </Text>
        </View>

        {error && (
          <View className="mx-5 mb-3 rounded-xl border border-accent-red/40 bg-accent-red/10 p-3">
            <Text className="text-sm text-accent-red">{error}</Text>
          </View>
        )}

        {loadingSlots ? (
          <ActivityIndicator className="mt-12" size="large" color="#facc15" />
        ) : (
          <FlatList
            data={slots}
            keyExtractor={(item) => item.id.toString()}
            contentContainerClassName="px-5 pb-10"
            ItemSeparatorComponent={() => <View className="h-2" />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefreshSlots} tintColor="#facc15" />
            }
            ListEmptyComponent={
              <View className="mt-12 items-center">
                <Ionicons name="time-outline" size={48} color="#9a9078" />
                <Text className="mt-2 text-sm text-on-surface-variant">
                  No available slots. Check back later.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setPendingSlot(item)}
                className="flex-row items-center rounded-2xl bg-surface-container p-4 shadow-sm active:bg-surface-container-high"
              >
                <View className="mr-3 h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
                  <Text className="text-xs font-semibold uppercase text-primary">
                    {new Date(item.slotStart)
                      .toLocaleDateString(undefined, { month: 'short' })}
                  </Text>
                  <Text className="text-base font-bold text-on-background">
                    {new Date(item.slotStart).getDate()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-on-background">
                    {formatTime(item.slotStart)} – {formatTime(item.slotEnd)}
                  </Text>
                  <Text className="text-xs text-on-surface-variant">{formatDate(item.slotStart)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9a9078" />
              </Pressable>
            )}
          />
        )}

        <Modal
          visible={pendingSlot !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPendingSlot(null)}
        >
          <View className="flex-1 items-center justify-center bg-black/50 px-6">
            <View className="w-full rounded-2xl bg-surface-container p-6">
              <View className="mb-3 self-start rounded-full bg-primary/20 p-3">
                <Ionicons name="alert-circle" size={22} color="#facc15" />
              </View>
              <Text className="text-lg font-bold text-on-background">Confirm booking</Text>
              <Text className="mt-1 text-sm text-on-surface-variant">
                {pendingSlot && (
                  <>
                    <Text className="font-semibold text-on-background">
                      {selectedTrainer.fullName}
                    </Text>
                    {'\n'}
                    {formatDate(pendingSlot.slotStart)} ·{' '}
                    {formatTime(pendingSlot.slotStart)} – {formatTime(pendingSlot.slotEnd)}
                  </>
                )}
              </Text>

              <View className="mt-4 rounded-xl bg-primary/10 p-3">
                <Text className="text-xs font-semibold text-primary">
                  ⚠ 1 credit will be deducted from your account.
                </Text>
              </View>

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  disabled={booking}
                  onPress={() => setPendingSlot(null)}
                  className="flex-1 items-center rounded-xl border border-outline-variant py-3 active:bg-background disabled:opacity-50"
                >
                  <Text className="text-sm font-semibold text-on-surface-variant">Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={booking}
                  onPress={confirmBooking}
                  className="flex-1 items-center rounded-xl bg-primary py-3 active:opacity-80 disabled:opacity-50"
                >
                  {booking ? (
                    <ActivityIndicator color="#3c2f00" />
                  ) : (
                    <Text className="text-sm font-bold text-on-primary">Confirm Booking</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Step 1: trainer list
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="px-5 pb-3 pt-2">
        <Text className="text-sm text-on-surface-variant">Step 1</Text>
        <Text className="text-3xl font-bold text-on-background">Book a session</Text>
        <Text className="mt-1 text-sm text-on-surface-variant">
          Pick a Personal Trainer to see their open slots.
        </Text>
      </View>

      {error && (
        <View className="mx-5 mb-3 rounded-xl border border-accent-red/40 bg-accent-red/10 p-3">
          <Text className="text-sm text-accent-red">{error}</Text>
        </View>
      )}

      <FlatList
        data={trainers}
        keyExtractor={(item) => item.id.toString()}
        contentContainerClassName="px-5 pb-10"
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          <View className="mt-12 items-center">
            <Ionicons name="people-outline" size={48} color="#9a9078" />
            <Text className="mt-2 text-sm text-on-surface-variant">No trainers available yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openTrainer(item)}
            className="flex-row items-center rounded-2xl bg-surface-container p-4 shadow-sm active:bg-surface-container-high"
          >
            <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Text className="text-base font-bold text-primary">
                {item.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-on-background" numberOfLines={1}>
                {item.fullName}
              </Text>
              <Text className="text-xs text-on-surface-variant" numberOfLines={1}>
                {item.email}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9a9078" />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
