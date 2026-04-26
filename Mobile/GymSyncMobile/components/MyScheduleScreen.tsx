import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getMyAppointments,
  getMySlots,
  setMySlots,
  type AppointmentDto,
  type AvailabilityDto,
} from '@/lib/api';

const ONE_HOUR_MS = 60 * 60 * 1000;

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyScheduleScreen() {
  const router = useRouter();
  const [slots, setSlots] = useState<AvailabilityDto[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default: today at next whole hour.
  const [pickerDate, setPickerDate] = useState<Date>(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    return now;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load schedule.');
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

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setPickerDate((prev) => {
      const next = new Date(prev);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      return next;
    });
  };

  const onTimeChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowTimePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setPickerDate((prev) => {
      const next = new Date(prev);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      return next;
    });
  };

  const handleAdd = async () => {
    if (pickerDate.getTime() <= Date.now()) {
      Alert.alert('Invalid time', 'Please choose a future time.');
      return;
    }
    try {
      setSubmitting(true);
      const slotEnd = new Date(pickerDate.getTime() + ONE_HOUR_MS);
      const res = await setMySlots([
        {
          slotStart: pickerDate.toISOString(),
          slotEnd: slotEnd.toISOString(),
        },
      ]);
      if (res.createdCount === 0) {
        Alert.alert('Already added', 'You already have a slot at that time.');
      } else {
        Alert.alert('Slot added', `${formatDateLabel(pickerDate)} at ${formatTimeLabel(pickerDate)}`);
      }
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to add slot.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = useMemo(() => slots, [slots]);
  const appointmentsBySlotId = useMemo(() => {
    const map = new Map<number, AppointmentDto>();
    for (const appointment of appointments) {
      if (appointment.availabilityId) {
        map.set(appointment.availabilityId, appointment);
      }
    }
    return map;
  }, [appointments]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#facc15" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.id.toString()}
        contentContainerClassName="px-5 pb-10"
        ItemSeparatorComponent={() => <View className="h-2" />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
        ListHeaderComponent={
          <View>
            <View className="mt-2 mb-4">
              <Text className="text-sm text-on-surface-variant">Personal Trainer</Text>
              <Text className="text-3xl font-bold text-on-background">My Schedule</Text>
            </View>

            {error && (
              <View className="mb-3 rounded-xl border border-accent-red/40 bg-accent-red/10 p-3">
                <Text className="text-sm text-accent-red">{error}</Text>
              </View>
            )}

            <View className="mb-5 rounded-2xl bg-surface-container p-5 shadow-sm">
              <Text className="mb-3 text-base font-semibold text-on-background">
                Add a new slot (1 hour)
              </Text>

              <View className="mb-3 flex-row gap-3">
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  className="flex-1 flex-row items-center rounded-xl border border-outline-variant bg-background px-4 py-3"
                >
                  <Ionicons name="calendar-outline" size={18} color="#facc15" />
                  <Text className="ml-2 text-sm font-medium text-on-background">
                    {formatDateLabel(pickerDate)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowTimePicker(true)}
                  className="flex-1 flex-row items-center rounded-xl border border-outline-variant bg-background px-4 py-3"
                >
                  <Ionicons name="time-outline" size={18} color="#facc15" />
                  <Text className="ml-2 text-sm font-medium text-on-background">
                    {formatTimeLabel(pickerDate)}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={handleAdd}
                disabled={submitting}
                className="items-center rounded-xl bg-primary py-3 active:opacity-80 disabled:opacity-50"
              >
                {submitting ? (
                  <ActivityIndicator color="#3c2f00" />
                ) : (
                  <Text className="text-base font-bold text-on-primary">Add slot</Text>
                )}
              </Pressable>

              {showDatePicker && (
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={onDateChange}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={pickerDate}
                  mode="time"
                  is24Hour
                  onChange={onTimeChange}
                />
              )}
            </View>

            <Text className="mb-2 text-base font-semibold text-on-background">
              Upcoming & past slots
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="mt-6 items-center">
            <Ionicons name="calendar-clear-outline" size={48} color="#9a9078" />
            <Text className="mt-2 text-sm text-on-surface-variant">
              No slots yet. Add one above.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const start = new Date(item.slotStart);
          const end = new Date(item.slotEnd);
          const inPast = start.getTime() <= Date.now();
          const appointment = appointmentsBySlotId.get(item.id);
          const tone = item.isBooked
            ? { bg: 'bg-accent-green/20', text: 'text-accent-green', label: 'Booked' }
            : inPast
              ? { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', label: 'Expired' }
              : { bg: 'bg-primary/20', text: 'text-primary', label: 'Open' };
          const Row = item.isBooked && appointment ? Pressable : View;
          return (
            <Row
              {...(item.isBooked && appointment
                  ? {
                    onPress: () =>
                      router.push({
                        pathname: '/appointment/[id]',
                        params: { id: String(appointment.id) },
                      }),
                    className:
                      'flex-row items-center rounded-2xl bg-surface-container p-4 shadow-sm active:bg-surface-container-high',
                  }
                : {
                    className: 'flex-row items-center rounded-2xl bg-surface-container p-4 shadow-sm',
                  })}
            >
              <View className="mr-3 h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high">
                <Text className="text-xs font-semibold text-on-surface-variant">
                  {start.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                </Text>
                <Text className="text-base font-bold text-on-background">
                  {start.getDate()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-on-background">
                  {formatTimeLabel(start)} – {formatTimeLabel(end)}
                </Text>
                <Text className="text-xs text-on-surface-variant">
                  {appointment
                    ? `Reserved by ${appointment.memberName}`
                    : start.toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                </Text>
              </View>
              <View className="items-end">
                <View className={`rounded-full px-3 py-1 ${tone.bg}`}>
                  <Text className={`text-xs font-bold ${tone.text}`}>{tone.label}</Text>
                </View>
                {appointment && (
                  <View className="mt-1 flex-row items-center">
                    <Text className="mr-1 text-[10px] font-semibold text-primary">DETAILS</Text>
                    <Ionicons name="chevron-forward" size={14} color="#facc15" />
                  </View>
                )}
              </View>
            </Row>
          );
        }}
      />
    </SafeAreaView>
  );
}
