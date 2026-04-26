import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMyAppointments, type AppointmentDto } from '@/lib/api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
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

export default function ActiveReservationsScreen() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getMyAppointments();
      setAppointments(res);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load reservations.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const activeReservations = useMemo(
    () =>
      appointments
        .filter((appointment) => {
          const end = appointment.slotEnd || appointment.appointmentDate;
          return new Date(end).getTime() > Date.now() && appointment.status !== 'Cancelled';
        })
        .sort((a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime()),
    [appointments],
  );

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#facc15" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-black">
      <View className="flex-row items-center justify-between border-b border-outline-variant px-5 py-4">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="active:opacity-70">
            <Ionicons name="arrow-back" size={24} color="#facc15" />
          </Pressable>
          <Text
            className="text-xl text-primary"
            style={{ fontFamily: 'Lexend_900Black', letterSpacing: 0 }}
          >
            RESERVATIONS
          </Text>
        </View>
        <View className="h-10 w-10 items-center justify-center rounded-sm border border-primary bg-surface-container">
          <Ionicons name="calendar" size={18} color="#facc15" />
        </View>
      </View>

      <FlatList
        data={activeReservations}
        keyExtractor={(item) => item.id.toString()}
        contentContainerClassName="px-5 pb-10"
        ItemSeparatorComponent={() => <View className="h-2" />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
        ListHeaderComponent={
          <View className="pb-5 pt-6">
            <Text
              className="text-3xl text-on-background"
              style={{ fontFamily: 'Lexend_800ExtraBold', lineHeight: 36 }}
            >
              Active Reservations
            </Text>
            <Text className="mt-1 text-sm text-on-surface-variant">
              Upcoming bookings that have not passed yet.
            </Text>

            <View className="mt-4 self-start rounded-sm bg-primary px-3 py-1">
              <Text className="text-xs font-bold text-on-primary">
                {activeReservations.length} ACTIVE
              </Text>
            </View>

            {error && (
              <View className="mt-4 rounded-sm border border-accent-red/40 bg-accent-red/10 p-3">
                <Text className="text-sm text-accent-red">{error}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="mt-10 items-center border border-outline-variant bg-surface-container-lowest p-8">
            <Ionicons name="calendar-clear-outline" size={44} color="#9a9078" />
            <Text className="mt-3 text-base font-bold text-on-background">
              No active reservations
            </Text>
            <Text className="mt-1 text-center text-sm text-on-surface-variant">
              Book a trainer to see your upcoming sessions here.
            </Text>
          </View>
        }
        renderItem={({ item }) => <ReservationRow appointment={item} />}
      />
    </SafeAreaView>
  );
}

function ReservationRow({ appointment }: { appointment: AppointmentDto }) {
  return (
    <View className="flex-row items-center border-l-4 border-l-primary bg-surface-container p-4">
      <View className="mr-4 h-16 w-16 items-center justify-center rounded-sm bg-primary">
        <Text className="text-xs font-bold uppercase text-on-primary">
          {new Date(appointment.slotStart).toLocaleDateString(undefined, { month: 'short' })}
        </Text>
        <Text className="text-2xl font-bold text-on-primary">
          {new Date(appointment.slotStart).getDate()}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-xs font-bold uppercase tracking-tight text-primary">
          Booked Trainer
        </Text>
        <Text className="text-lg font-bold text-on-background" numberOfLines={1}>
          {appointment.ptName}
        </Text>
        <Text className="mt-1 text-xs text-on-surface-variant">
          {formatDate(appointment.slotStart)} / {formatTime(appointment.slotStart)} -{' '}
          {formatTime(appointment.slotEnd)}
        </Text>
      </View>
      <View className="ml-3 h-10 w-10 items-center justify-center rounded-sm bg-surface-container-high">
        <Ionicons name="fitness-outline" size={18} color="#facc15" />
      </View>
    </View>
  );
}
