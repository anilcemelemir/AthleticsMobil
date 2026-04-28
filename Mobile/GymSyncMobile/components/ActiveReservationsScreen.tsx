import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AthletixHeader } from '@/components/AthletixHeader';
import { useAuth } from '@/contexts/AuthContext';
import { cancelAppointment, getMyAppointments, type AppointmentDto } from '@/lib/api';

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  const { refreshUser } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getMyAppointments();
      setAppointments(res);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Rezervasyonlar yüklenemedi.');
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

  const handleCancel = useCallback(
    (appointment: AppointmentDto) => {
      const msUntilStart = new Date(appointment.slotStart).getTime() - Date.now();
      if (msUntilStart < CANCEL_WINDOW_MS) {
        Alert.alert(
          'İptal edilemez',
          'Randevuya 24 saatten az kaldığı için iptal edilemez.',
        );
        return;
      }
      Alert.alert(
        'Randevuyu iptal et',
        'Bu randevuyu iptal etmek istediğine emin misin? Kullandığın kredi iade edilecek.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'İptal Et',
            style: 'destructive',
            onPress: async () => {
              try {
                setCancellingId(appointment.id);
                setError(null);
                await cancelAppointment(appointment.id);
                setAppointments((prev) => prev.filter((a) => a.id !== appointment.id));
                await refreshUser();
              } catch (err: any) {
                const msg =
                  err?.response?.data?.message ??
                  err?.message ??
                  'Randevu iptal edilemedi.';
                setError(msg);
                Alert.alert('İptal başarısız', msg);
              } finally {
                setCancellingId(null);
              }
            },
          },
        ],
      );
    },
    [refreshUser],
  );

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
      <AthletixHeader
        onBack={() => router.back()}
        right={
          <View className="h-10 w-10 items-center justify-center rounded-sm border border-primary bg-surface-container">
            <Ionicons name="calendar" size={18} color="#facc15" />
          </View>
        }
      />

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
              Aktif Rezervasyonlar
            </Text>
            <Text className="mt-1 text-sm text-on-surface-variant">
              Saati geçmemiş yaklaşan rezervasyonların.
            </Text>

            <View className="mt-4 self-start rounded-sm bg-primary px-3 py-1">
              <Text className="text-xs font-bold text-on-primary">
                {activeReservations.length} AKTİF
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
              Aktif rezervasyon yok
            </Text>
            <Text className="mt-1 text-center text-sm text-on-surface-variant">
              Yaklaşan seanslarını burada görmek için bir antrenör rezerve et.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReservationRow
            appointment={item}
            onCancel={handleCancel}
            cancelling={cancellingId === item.id}
          />
        )}
      />
    </SafeAreaView>
  );
}

function ReservationRow({
  appointment,
  onCancel,
  cancelling,
}: {
  appointment: AppointmentDto;
  onCancel: (appointment: AppointmentDto) => void;
  cancelling: boolean;
}) {
  const msUntilStart = new Date(appointment.slotStart).getTime() - Date.now();
  const canCancel = msUntilStart >= CANCEL_WINDOW_MS;

  return (
    <View className="border-l-4 border-l-primary bg-surface-container p-4">
      <View className="flex-row items-center">
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
            Rezerve Edilen Antrenör
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

      <View className="mt-3 flex-row items-center justify-end border-t border-outline-variant pt-3">
        <Pressable
          disabled={cancelling}
          onPress={() => onCancel(appointment)}
          hitSlop={8}
          className={`flex-row items-center rounded-sm px-3 py-2 ${
            cancelling ? 'opacity-60' : 'active:bg-red-500/10'
          }`}
        >
          {cancelling ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <>
              <Ionicons
                name="trash-outline"
                size={16}
                color={canCancel ? '#ef4444' : '#9a9078'}
              />
              <Text
                className={`ml-2 text-xs ${canCancel ? 'text-red-500' : 'text-on-surface-variant'}`}
                style={{ fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}
              >
                {canCancel ? 'Randevuyu İptal Et' : 'Son 24 saat — İptal edilemez'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

