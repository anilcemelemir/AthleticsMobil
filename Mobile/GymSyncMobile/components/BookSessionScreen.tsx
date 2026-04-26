import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import {
  bookAppointment,
  getMyAppointments,
  getSlotsForPt,
  getTrainers,
  type AppointmentDto,
  type AvailabilityDto,
  type TrainerDto,
} from '@/lib/api';

const TRAINER_IMAGES = [
  'https://images.unsplash.com/photo-1571019613914-85f342c6a11e?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=500&q=80',
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateCard(date: Date) {
  return {
    key: dateKey(date.toISOString()),
    month: date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    day: String(date.getDate()),
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
  };
}

function trainerSpecialty(index: number): string {
  const labels = ['Strength Coach', 'HIIT Specialist', 'Mobility Pro', 'Performance PT'];
  return labels[index % labels.length];
}

export default function BookSessionScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [trainers, setTrainers] = useState<TrainerDto[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerDto | null>(null);
  const [slots, setSlots] = useState<AvailabilityDto[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilityDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    const res = await getMyAppointments();
    setAppointments(res);
  }, []);

  const loadSlots = useCallback(async (ptId: number) => {
    const res = await getSlotsForPt(ptId);
    setSlots(res);
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      setError(null);
      const [trainerRes, appointmentRes] = await Promise.all([
        getTrainers(),
        getMyAppointments(),
      ]);
      setTrainers(trainerRes);
      setAppointments(appointmentRes);

      const first = trainerRes[0] ?? null;
      setSelectedTrainer(first);
      if (first) {
        const slotRes = await getSlotsForPt(first.id);
        setSlots(slotRes);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load booking.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadInitial();
      setLoading(false);
    })();
  }, [loadInitial]);

  const futureSlots = useMemo(
    () =>
      slots
        .filter((slot) => !slot.isBooked && new Date(slot.slotEnd).getTime() > Date.now())
        .sort((a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime()),
    [slots],
  );

  const dateCards = useMemo(() => {
    const unique = Array.from(new Set(futureSlots.map((slot) => dateKey(slot.slotStart))));
    if (unique.length > 0) {
      return unique.slice(0, 10).map((key) => formatDateCard(new Date(`${key}T12:00:00`)));
    }
    return Array.from({ length: 7 }, (_, index) => formatDateCard(addDays(new Date(), index)));
  }, [futureSlots]);

  useEffect(() => {
    if (!dateCards.length) return;
    if (!selectedDateKey || !dateCards.some((card) => card.key === selectedDateKey)) {
      setSelectedDateKey(dateCards[0].key);
      setSelectedSlot(null);
    }
  }, [dateCards, selectedDateKey]);

  const slotsForSelectedDate = useMemo(
    () => futureSlots.filter((slot) => dateKey(slot.slotStart) === selectedDateKey),
    [futureSlots, selectedDateKey],
  );

  useEffect(() => {
    if (selectedSlot && !slotsForSelectedDate.some((slot) => slot.id === selectedSlot.id)) {
      setSelectedSlot(null);
    }
  }, [selectedSlot, slotsForSelectedDate]);

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

  const onRefresh = useCallback(async () => {
    if (!selectedTrainer) return;
    try {
      setRefreshing(true);
      setError(null);
      await Promise.all([loadSlots(selectedTrainer.id), loadAppointments()]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  }, [loadAppointments, loadSlots, selectedTrainer]);

  const selectTrainer = async (trainer: TrainerDto) => {
    try {
      setSelectedTrainer(trainer);
      setSelectedSlot(null);
      setSelectedDateKey(null);
      setLoadingSlots(true);
      setError(null);
      await loadSlots(trainer.id);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load slots.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const confirmBooking = async () => {
    if (!selectedSlot || !selectedTrainer) {
      Alert.alert('Select a time', 'Choose an available time slot before confirming.');
      return;
    }

    Alert.alert(
      'Confirm booking',
      `${selectedTrainer.fullName}\n${formatFullDate(selectedSlot.slotStart)} at ${formatTime(
        selectedSlot.slotStart,
      )}\n\n1 credit will be used.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setBooking(true);
              const res = await bookAppointment(selectedSlot.id);
              setSelectedSlot(null);
              setSlots((prev) =>
                prev.map((slot) =>
                  slot.id === res.availabilityId ? { ...slot, isBooked: true } : slot,
                ),
              );
              await Promise.all([refreshUser(), loadAppointments()]);
              Alert.alert('Booked!', `Remaining credits: ${res.remainingCredits}`);
            } catch (err: any) {
              const msg = err?.response?.data?.message ?? err?.message ?? 'Booking failed.';
              Alert.alert('Booking failed', msg);
            } finally {
              setBooking(false);
            }
          },
        },
      ],
    );
  };

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
            BOOK A TRAINER
          </Text>
        </View>
        <View className="h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface-container">
          <Text className="text-sm font-bold text-primary">
            {user?.fullName?.charAt(0).toUpperCase() ?? 'U'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="pb-44"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
      >
        {error && (
          <View className="mx-5 mt-4 rounded-sm border border-accent-red/40 bg-accent-red/10 p-3">
            <Text className="text-sm text-accent-red">{error}</Text>
          </View>
        )}

        <SectionHeader title="EXPERT TRAINERS" action="VIEW ALL" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 px-5 pb-2"
        >
          {trainers.map((trainer, index) => {
            const selected = selectedTrainer?.id === trainer.id;
            return (
              <Pressable
                key={trainer.id}
                onPress={() => selectTrainer(trainer)}
                className={`w-[200px] overflow-hidden rounded-sm bg-surface-container ${
                  selected ? 'border-l-4 border-l-primary' : 'border border-outline-variant'
                }`}
              >
                <Image
                  source={{ uri: TRAINER_IMAGES[index % TRAINER_IMAGES.length] }}
                  className="h-48 w-full bg-surface-container-high"
                  resizeMode="cover"
                />
                <View className="p-3">
                  <Text
                    className={selected ? 'text-lg text-primary' : 'text-lg text-on-background'}
                    numberOfLines={1}
                    style={{ fontFamily: 'Lexend_800ExtraBold' }}
                  >
                    {trainer.fullName.split(' ')[0].toUpperCase()}
                  </Text>
                  <Text className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    {trainerSpecialty(index)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <SectionHeader title="SELECT DATE" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-5"
        >
          {dateCards.map((card) => {
            const selected = card.key === selectedDateKey;
            return (
              <Pressable
                key={card.key}
                onPress={() => {
                  setSelectedDateKey(card.key);
                  setSelectedSlot(null);
                }}
                className={`h-20 w-16 items-center justify-center rounded-sm ${
                  selected ? 'bg-primary' : 'border border-outline-variant bg-surface-container'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${selected ? 'text-on-primary' : 'text-on-surface-variant'}`}
                >
                  {card.month}
                </Text>
                <Text
                  className={`text-2xl font-bold ${selected ? 'text-on-primary' : 'text-on-background'}`}
                >
                  {card.day}
                </Text>
                <Text
                  className={`text-xs font-bold ${selected ? 'text-on-primary' : 'text-on-surface-variant'}`}
                >
                  {card.weekday}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <SectionHeader title="TIME SLOTS" />
        {loadingSlots ? (
          <ActivityIndicator className="mt-6" size="large" color="#facc15" />
        ) : (
          <View className="mx-5 flex-row flex-wrap gap-2">
            {slotsForSelectedDate.length === 0 ? (
              <View className="w-full items-center border border-outline-variant bg-surface-container-lowest p-6">
                <Ionicons name="time-outline" size={34} color="#9a9078" />
                <Text className="mt-2 text-sm text-on-surface-variant">
                  No available slots for this date.
                </Text>
              </View>
            ) : (
              slotsForSelectedDate.map((slot) => {
                const selected = selectedSlot?.id === slot.id;
                return (
                  <Pressable
                    key={slot.id}
                    onPress={() => setSelectedSlot(slot)}
                    className={`w-[31.5%] items-center rounded-sm py-4 ${
                      selected
                        ? 'bg-primary'
                        : 'border border-outline-variant bg-surface-container'
                    }`}
                  >
                    <Text
                      className={`text-lg font-bold ${
                        selected ? 'text-on-primary' : 'text-on-background'
                      }`}
                    >
                      {formatTime(slot.slotStart)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        <SectionHeader title="SESSION DETAILS" />
        <View className="mx-5 rounded-sm border border-outline-variant bg-surface-container-high p-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
                SESSION DETAILS
              </Text>
              <Text
                className="text-2xl text-on-background"
                style={{ fontFamily: 'Lexend_800ExtraBold', lineHeight: 28 }}
              >
                STRENGTH & HYPERTROPHY
              </Text>
            </View>
            <View className="rounded-sm bg-surface-container-highest p-2">
              <Ionicons name="barbell" size={22} color="#facc15" />
            </View>
          </View>
          <View className="mt-4 flex-row gap-5">
            <DetailPill icon="time-outline" label="60 MINS" />
            <DetailPill icon="flash-outline" label="HIGH INTENSITY" />
          </View>
        </View>

        <SectionHeader title="ACTIVE RESERVATIONS" />
        <View className="mx-5 gap-2">
          {activeReservations.length === 0 ? (
            <View className="items-center border border-outline-variant bg-surface-container-lowest p-6">
              <Ionicons name="calendar-clear-outline" size={34} color="#9a9078" />
              <Text className="mt-2 text-sm text-on-surface-variant">
                You have no upcoming reservations.
              </Text>
            </View>
          ) : (
            activeReservations.map((appointment) => (
              <View
                key={appointment.id}
                className="flex-row items-center border-l-4 border-l-primary bg-surface-container p-4"
              >
                <View className="mr-3 h-12 w-12 items-center justify-center rounded-sm bg-primary">
                  <Text className="text-xs font-bold text-on-primary">
                    {new Date(appointment.slotStart).toLocaleDateString(undefined, {
                      month: 'short',
                    })}
                  </Text>
                  <Text className="text-base font-bold text-on-primary">
                    {new Date(appointment.slotStart).getDate()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-on-background" numberOfLines={1}>
                    {appointment.ptName}
                  </Text>
                  <Text className="text-xs text-on-surface-variant">
                    {formatFullDate(appointment.slotStart)} / {formatTime(appointment.slotStart)} -{' '}
                    {formatTime(appointment.slotEnd)}
                  </Text>
                </View>
                <Text className="text-xs font-bold uppercase text-primary">
                  {appointment.status}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-outline-variant bg-black px-5 pb-6 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              TOTAL AMOUNT
            </Text>
            <Text
              className="text-2xl text-on-background"
              style={{ fontFamily: 'Lexend_800ExtraBold' }}
            >
              $65.00
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-on-surface-variant">PER SESSION</Text>
            <Text className="text-xs font-bold text-primary">
              {user?.remainingCredits ?? 0} CREDITS LEFT
            </Text>
          </View>
        </View>
        <Pressable
          disabled={booking || !selectedSlot}
          onPress={confirmBooking}
          className="items-center rounded-sm bg-primary py-4 active:scale-[0.99] disabled:opacity-40"
        >
          {booking ? (
            <ActivityIndicator color="#3c2f00" />
          ) : (
            <Text
              className="text-xl text-black"
              style={{ fontFamily: 'Lexend_900Black', letterSpacing: 0 }}
            >
              CONFIRM BOOKING
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View className="mb-4 mt-8 flex-row items-end justify-between px-5">
      <Text
        className="text-2xl text-on-background"
        style={{ fontFamily: 'Lexend_800ExtraBold', lineHeight: 28 }}
      >
        {title}
      </Text>
      {action ? (
        <Text className="text-xs font-bold uppercase tracking-widest text-primary">{action}</Text>
      ) : null}
    </View>
  );
}

function DetailPill({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={14} color="#d1c6ab" />
      <Text className="text-xs font-semibold text-on-surface-variant">{label}</Text>
    </View>
  );
}
