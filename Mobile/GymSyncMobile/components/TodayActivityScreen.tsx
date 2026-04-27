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

import { AthletixHeader } from '@/components/AthletixHeader';
import {
  getMyAppointments,
  getMySlots,
  type AppointmentDto,
  type AvailabilityDto,
} from '@/lib/api';

type TodayRow = {
  slot: AvailabilityDto;
  appointment?: AppointmentDto;
};

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hourLabel(d: Date): { hour: string; meridiem: string } {
  const raw = d.getHours();
  const hour = raw % 12 || 12;
  return {
    hour: hour.toString().padStart(2, '0'),
    meridiem: raw >= 12 ? 'PM' : 'AM',
  };
}

export default function TodayActivityScreen() {
  const router = useRouter();
  const [slots, setSlots] = useState<AvailabilityDto[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [slotRes, appointmentRes] = await Promise.all([
        getMySlots(),
        getMyAppointments(),
      ]);
      setSlots(slotRes);
      setAppointments(appointmentRes);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Bugünün programı yüklenemedi.');
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

  const rows = useMemo<TodayRow[]>(() => {
    const today = new Date();
    const appointmentsBySlotId = new Map<number, AppointmentDto>();
    for (const appointment of appointments) {
      if (appointment.availabilityId) {
        appointmentsBySlotId.set(appointment.availabilityId, appointment);
      }
    }

    return slots
      .filter((slot) => isSameLocalDay(new Date(slot.slotStart), today))
      .sort((a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime())
      .map((slot) => ({
        slot,
        appointment: appointmentsBySlotId.get(slot.id),
      }));
  }, [appointments, slots]);

  const bookedCount = rows.filter((row) => row.appointment || row.slot.isBooked).length;
  const availableCount = rows.filter((row) => !row.slot.isBooked).length;

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#facc15" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <AthletixHeader />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.slot.id.toString()}
        contentContainerClassName="px-5 pb-10"
        ItemSeparatorComponent={() => <View className="h-2" />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
        ListHeaderComponent={
          <View>
            <View className="mb-5 mt-5 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-sm border border-primary">
                  <Ionicons name="calendar" size={18} color="#facc15" />
                </View>
                <View>
                  <Text
                    className="text-primary"
                    style={{ fontFamily: 'Lexend_900Black', fontSize: 18, letterSpacing: 0 }}
                  >
                    BUGÜN
                  </Text>
                  <Text className="text-xs font-semibold text-on-surface-variant">
                    BUGÜN / {formatDate(new Date()).toUpperCase()}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push('/(tabs)/schedule')}
                className="h-10 w-10 items-center justify-center rounded-sm bg-surface-container"
              >
                <Ionicons name="create-outline" size={18} color="#facc15" />
              </Pressable>
            </View>

            <View className="mb-5 flex-row items-end justify-between">
              <View className="flex-1 pr-3">
                <Text
                  className="text-on-background"
                  style={{
                    fontFamily: 'Lexend_800ExtraBold',
                    fontSize: 32,
                    lineHeight: 36,
                    letterSpacing: 0,
                  }}
                >
                  Program Detayı
                </Text>
                <View className="mt-3 flex-row gap-2">
                  <View className="rounded-sm bg-surface-container-highest px-3 py-1">
                    <Text className="text-xs font-bold text-on-surface-variant">
                      {bookedCount} DOLU SAAT
                    </Text>
                  </View>
                  <View className="rounded-sm bg-primary px-3 py-1">
                    <Text className="text-xs font-bold text-on-primary">
                      {availableCount} UYGUN
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {error && (
              <View className="mb-3 rounded-sm border border-accent-red/40 bg-accent-red/10 p-3">
                <Text className="text-sm text-accent-red">{error}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="mt-10 items-center border border-outline-variant bg-surface-container-lowest p-8">
            <Ionicons name="calendar-clear-outline" size={44} color="#9a9078" />
            <Text className="mt-3 text-base font-bold text-on-background">Bugün aktivite yok</Text>
            <Text className="mt-1 text-center text-sm text-on-surface-variant">
              Günü doldurmak için takviminden uygun saat ekle.
            </Text>
          </View>
        }
        renderItem={({ item }) => <ActivityRow row={item} />}
      />
    </SafeAreaView>
  );
}

function ActivityRow({ row }: { row: TodayRow }) {
  const router = useRouter();
  const start = new Date(row.slot.slotStart);
  const end = new Date(row.slot.slotEnd);
  const time = hourLabel(start);
  const isPast = end.getTime() <= Date.now();
  const isBooked = row.slot.isBooked;
  const canOpenDetails = isBooked && row.appointment;

  const borderColor = isBooked ? 'border-l-primary' : isPast ? 'border-l-outline' : 'border-l-[#2f2a1b]';
  const bg = isBooked ? 'bg-surface-container' : isPast ? 'bg-surface-container-low' : 'bg-surface-container-lowest';

  const content = (
    <>
      <View className={`w-16 items-center ${isBooked ? '' : 'opacity-45'}`}>
        <Text
          className="text-on-background"
          style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 24, lineHeight: 28 }}
        >
          {time.hour}
        </Text>
        <Text className="text-xs font-bold text-outline">{time.meridiem}</Text>
      </View>

      <View className="flex-1">
        {isBooked ? (
          <>
            <Text className="mb-1 text-xs font-bold uppercase text-primary">
              Rezerve - {row.appointment?.memberName ?? 'Üye'}
            </Text>
            <Text className="text-lg font-bold text-on-surface">Antrenman Seansı</Text>
            <Text className="mt-1 text-xs text-on-surface-variant">
              {formatTime(start)} - {formatTime(end)}
            </Text>
          </>
        ) : (
          <>
            <Text className="text-base font-bold italic text-outline">
              {isPast ? 'Süresi geçmiş uygunluk' : 'Uygun'}
            </Text>
            <Text className="mt-1 text-xs text-on-surface-variant">
              {formatTime(start)} - {formatTime(end)}
            </Text>
          </>
        )}
      </View>

      <View className="ml-3 h-10 w-10 items-center justify-center rounded-sm bg-surface-container-high">
        <Ionicons
          name={isBooked ? 'barbell' : isPast ? 'time-outline' : 'add'}
          size={18}
          color={isBooked ? '#facc15' : '#9a9078'}
        />
      </View>
    </>
  );

  if (canOpenDetails) {
    return (
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/appointment/[id]',
            params: { id: String(row.appointment!.id) },
          })
        }
        className={`flex-row items-center gap-4 border-l-4 p-4 active:bg-surface-container-high ${borderColor} ${bg}`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className={`flex-row items-center gap-4 border-l-4 p-4 ${borderColor} ${bg}`}>
      {content}
    </View>
  );
}

