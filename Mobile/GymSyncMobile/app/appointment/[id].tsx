import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMyAppointments, type AppointmentDto } from '@/lib/api';

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
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

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointmentId = Number(id);

  const [appointment, setAppointment] = useState<AppointmentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const appointments = await getMyAppointments();
      const found = appointments.find((item) => item.id === appointmentId) ?? null;
      setAppointment(found);
      if (!found) setError('Appointment not found.');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load appointment.');
    }
  }, [appointmentId]);

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

  const times = useMemo(() => {
    if (!appointment) return null;
    const start = new Date(appointment.slotStart || appointment.appointmentDate);
    const end = new Date(appointment.slotEnd || start.getTime() + 60 * 60 * 1000);
    return { start, end };
  }, [appointment]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#facc15" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
      >
        <View className="mb-5 mt-2 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="mr-3 h-10 w-10 items-center justify-center rounded-sm bg-surface-container active:bg-surface-container-high"
          >
            <Ionicons name="chevron-back" size={22} color="#ebe2d0" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xs text-on-surface-variant">Reserved slot</Text>
            <Text className="text-2xl font-bold text-on-background">Session Details</Text>
          </View>
        </View>

        {error && (
          <View className="mb-4 rounded-sm border border-accent-red/40 bg-accent-red/10 p-4">
            <Text className="text-sm text-accent-red">{error}</Text>
          </View>
        )}

        {appointment && times && (
          <>
            <View className="mb-3 rounded-sm border border-primary/40 bg-primary/10 p-5">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-primary">CONFIRMED SESSION</Text>
                <View className="rounded-sm bg-accent-green/20 px-3 py-1">
                  <Text className="text-xs font-bold text-accent-green">
                    {appointment.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text className="text-3xl font-bold text-on-background">
                {formatTime(times.start)} - {formatTime(times.end)}
              </Text>
              <Text className="mt-1 text-sm text-on-surface-variant">
                {formatDate(times.start)}
              </Text>
            </View>

            <View className="mb-3 rounded-sm border border-outline-variant bg-surface-container p-5">
              <Text className="mb-4 text-base font-bold text-on-background">Member</Text>
              <DetailRow icon="person" label="Name" value={appointment.memberName} />
              <DetailRow icon="mail" label="Email" value={appointment.memberEmail || '-'} />
              <DetailRow
                icon="call"
                label="Phone"
                value={appointment.memberPhoneNumber || '-'}
              />
              <DetailRow
                icon="flash"
                label="Credits left"
                value={String(appointment.memberRemainingCredits)}
                isLast
              />
            </View>

            <View className="rounded-sm border border-outline-variant bg-surface-container p-5">
              <Text className="mb-4 text-base font-bold text-on-background">Reservation</Text>
              <DetailRow icon="barbell" label="Trainer" value={appointment.ptName} />
              <DetailRow
                icon="calendar"
                label="Booked at"
                value={new Date(appointment.createdAt).toLocaleString()}
              />
              <DetailRow
                icon="key"
                label="Appointment ID"
                value={`#${appointment.id}`}
                isLast
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center py-3 ${
        isLast ? '' : 'border-b border-outline-variant/40'
      }`}
    >
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-sm bg-background">
        <Ionicons name={icon} size={17} color="#facc15" />
      </View>
      <View className="flex-1">
        <Text className="text-xs text-on-surface-variant">{label}</Text>
        <Text className="mt-0.5 text-sm font-semibold text-on-background">{value}</Text>
      </View>
    </View>
  );
}
