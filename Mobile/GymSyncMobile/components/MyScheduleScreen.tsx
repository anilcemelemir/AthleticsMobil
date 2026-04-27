import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deleteMySlot,
  getMyAppointments,
  getMySlots,
  setMySlots,
  setSlotBookedStatus,
  type AppointmentDto,
  type AvailabilityDto,
} from '@/lib/api';

const ONE_HOUR_MS = 60 * 60 * 1000;
const SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16]; // 09:00 → 17:00 (1-hour blocks)

const COLORS = {
  primary: '#facc15',
  onPrimary: '#3c2f00',
  background: '#121212',
  surface: '#1e1e1e',
  surfaceHigh: '#2a2a2a',
  outline: '#3a3a3a',
  textPrimary: '#fafafa',
  textMuted: '#9a9a9a',
  bookedBg: '#2a2a2a',
  bookedBorder: '#4a4a4a',
};

type SlotStatus = 'empty' | 'available' | 'memberBooked' | 'manualBooked' | 'past';

interface DaySlot {
  hour: number;
  slot?: AvailabilityDto;
  appointment?: AppointmentDto;
  status: SlotStatus;
}

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function MyScheduleScreen() {
  const router = useRouter();
  const [slots, setSlotsState] = useState<AvailabilityDto[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalYmd(new Date()));
  const [pendingHour, setPendingHour] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [slotRes, appointmentRes] = await Promise.all([
        getMySlots(),
        getMyAppointments(),
      ]);
      setSlotsState(slotRes);
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

  // Map availabilityId -> appointment (if a member booked it).
  const appointmentsBySlotId = useMemo(() => {
    const map = new Map<number, AppointmentDto>();
    for (const a of appointments) {
      if (a.availabilityId != null) map.set(a.availabilityId, a);
    }
    return map;
  }, [appointments]);

  // Marked dots on calendar for any day that has slots.
  const markedDates = useMemo(() => {
    const result: Record<string, any> = {};
    for (const s of slots) {
      const ymd = toLocalYmd(new Date(s.slotStart));
      if (!result[ymd]) result[ymd] = { marked: true, dotColor: COLORS.primary };
    }
    result[selectedDate] = {
      ...(result[selectedDate] ?? {}),
      selected: true,
      selectedColor: COLORS.primary,
      selectedTextColor: COLORS.onPrimary,
    };
    return result;
  }, [slots, selectedDate]);

  // Build the 09:00 → 16:00 row for the selected day.
  const daySlots: DaySlot[] = useMemo(() => {
    const day = fromYmd(selectedDate);
    const now = new Date();

    return SLOT_HOURS.map<DaySlot>((hour) => {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);

      const slot = slots.find((s) => {
        const sStart = new Date(s.slotStart);
        return (
          isSameLocalDay(sStart, day) &&
          sStart.getHours() === hour &&
          sStart.getMinutes() === 0
        );
      });

      const appointment = slot ? appointmentsBySlotId.get(slot.id) : undefined;
      const inPast = start.getTime() + ONE_HOUR_MS <= now.getTime();

      let status: SlotStatus;
      if (slot) {
        if (slot.isBooked && appointment) status = 'memberBooked';
        else if (slot.isBooked) status = 'manualBooked';
        else status = 'available';
      } else {
        status = inPast ? 'past' : 'empty';
      }

      return { hour, slot, appointment, status };
    });
  }, [selectedDate, slots, appointmentsBySlotId]);

  const selectedDateLabel = useMemo(() => {
    const d = fromYmd(selectedDate);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  // ---------- Slot actions ----------

  const buildSlotDate = (hour: number): { start: Date; end: Date } => {
    const start = fromYmd(selectedDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + ONE_HOUR_MS);
    return { start, end };
  };

  const handleMakeAvailable = async (hour: number) => {
    const { start, end } = buildSlotDate(hour);
    if (end.getTime() <= Date.now()) {
      Alert.alert('Invalid time', 'You cannot create a slot in the past.');
      return;
    }
    try {
      setPendingHour(hour);
      await setMySlots([{ slotStart: start.toISOString(), slotEnd: end.toISOString() }]);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to add slot.');
    } finally {
      setPendingHour(null);
    }
  };

  const handleMarkBlocked = async (hour: number) => {
    const { start, end } = buildSlotDate(hour);
    if (end.getTime() <= Date.now()) {
      Alert.alert('Invalid time', 'You cannot block a past slot.');
      return;
    }
    try {
      setPendingHour(hour);
      const res = await setMySlots([
        { slotStart: start.toISOString(), slotEnd: end.toISOString() },
      ]);
      const created = res.slots[0];
      if (created) {
        await setSlotBookedStatus(created.id, true);
      }
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to block slot.');
    } finally {
      setPendingHour(null);
    }
  };

  const handleRemoveAvailable = (slot: AvailabilityDto, hour: number) => {
    Alert.alert(
      'Remove availability?',
      `Members will no longer be able to book ${String(hour).padStart(2, '0')}:00.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setPendingHour(hour);
              await deleteMySlot(slot.id);
              await load();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to remove slot.');
            } finally {
              setPendingHour(null);
            }
          },
        },
      ]
    );
  };

  const handleUnblock = async (slot: AvailabilityDto, hour: number) => {
    try {
      setPendingHour(hour);
      // Unblock = set IsBooked back to false, then delete so it returns to empty.
      await setSlotBookedStatus(slot.id, false);
      await deleteMySlot(slot.id);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Failed to unblock slot.');
    } finally {
      setPendingHour(null);
    }
  };

  const handleSlotTap = (entry: DaySlot) => {
    if (pendingHour !== null) return;
    switch (entry.status) {
      case 'empty':
        handleMakeAvailable(entry.hour);
        break;
      case 'available':
        if (entry.slot) handleRemoveAvailable(entry.slot, entry.hour);
        break;
      case 'memberBooked':
        if (entry.appointment) {
          router.push({
            pathname: '/appointment/[id]',
            params: { id: String(entry.appointment.id) },
          });
        }
        break;
      case 'manualBooked':
        if (entry.slot) {
          Alert.alert(
            'Blocked slot',
            'This slot is marked as unavailable. Unblock it to make it available again.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Unblock',
                onPress: () => entry.slot && handleUnblock(entry.slot, entry.hour),
              },
            ]
          );
        }
        break;
      case 'past':
        // No-op for past empty slots.
        break;
    }
  };

  const handleSlotLongPress = (entry: DaySlot) => {
    if (pendingHour !== null) return;
    if (entry.status !== 'empty') return;
    Alert.alert(
      'Block this slot?',
      `Mark ${String(entry.hour).padStart(2, '0')}:00 as unavailable (e.g. break, personal). Members won't see it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => handleMarkBlocked(entry.hour),
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
        <View className="px-5 pt-2 pb-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="flash" size={18} color={COLORS.primary} />
            <Text
              className="text-on-background"
              style={{ fontFamily: 'Lexend_900Black', letterSpacing: 1.5, fontSize: 14 }}
            >
              IRON PULSE
            </Text>
          </View>
          <Text
            className="mt-3 text-on-background"
            style={{
              fontFamily: 'Lexend_800ExtraBold',
              fontSize: 28,
              letterSpacing: -0.5,
              lineHeight: 32,
            }}
          >
            My Schedule
          </Text>
          <Text
            className="mt-1 text-on-surface-variant"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
          >
            Tap a slot to make it available · long-press to block
          </Text>
        </View>

        {error && (
          <View className="mx-5 mb-3 rounded-sm border border-accent-red/40 bg-accent-red/10 p-3">
            <Text className="text-sm text-accent-red">{error}</Text>
          </View>
        )}

        {/* Calendar */}
        <View className="mx-5 overflow-hidden rounded-sm border border-outline-variant bg-surface-container">
          <Calendar
            current={selectedDate}
            onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            firstDay={1}
            enableSwipeMonths
            theme={{
              calendarBackground: COLORS.surface,
              backgroundColor: COLORS.surface,
              dayTextColor: COLORS.textPrimary,
              monthTextColor: COLORS.textPrimary,
              textSectionTitleColor: COLORS.textMuted,
              todayTextColor: COLORS.primary,
              arrowColor: COLORS.primary,
              selectedDayBackgroundColor: COLORS.primary,
              selectedDayTextColor: COLORS.onPrimary,
              dotColor: COLORS.primary,
              textDayFontFamily: 'Inter_500Medium',
              textMonthFontFamily: 'Lexend_700Bold',
              textDayHeaderFontFamily: 'Inter_600SemiBold',
              textDayFontSize: 13,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 11,
            }}
          />
        </View>

        {/* Selected day label */}
        <View className="mt-6 px-5">
          <Text
            className="text-on-surface-variant"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.5 }}
          >
            SELECTED
          </Text>
          <Text
            className="mt-1 text-on-background"
            style={{ fontFamily: 'Lexend_700Bold', fontSize: 18 }}
          >
            {selectedDateLabel}
          </Text>
        </View>

        {/* Slot grid */}
        <View className="mt-3 flex-row flex-wrap px-3">
          {daySlots.map((entry) => (
            <View key={entry.hour} className="w-1/2 p-2">
              <TimeSlot
                entry={entry}
                pending={pendingHour === entry.hour}
                onPress={() => handleSlotTap(entry)}
                onLongPress={() => handleSlotLongPress(entry)}
              />
            </View>
          ))}
        </View>

        {/* Legend */}
        <View className="mx-5 mt-4 rounded-sm border border-outline-variant bg-surface-container p-4">
          <Text
            className="mb-3 text-on-surface-variant"
            style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.5 }}
          >
            LEGEND
          </Text>
          <LegendRow color={COLORS.primary} label="Available · members can book" />
          <LegendRow color={COLORS.surfaceHigh} label="Booked by member · tap for details" outlined />
          <LegendRow color={COLORS.bookedBg} label="Blocked by you · tap to unblock" outlined />
          <LegendRow color="transparent" label="Empty · tap to open, long-press to block" outlined isLast />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- TimeSlot component ----------

interface TimeSlotProps {
  entry: DaySlot;
  pending: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TimeSlot({ entry, pending, onPress, onLongPress }: TimeSlotProps) {
  const { hour, status, appointment } = entry;
  const startLabel = `${String(hour).padStart(2, '0')}:00`;
  const endLabel = `${String(hour + 1).padStart(2, '0')}:00`;

  const visuals = getSlotVisuals(status);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={pending || status === 'past'}
      className="min-h-[88px] items-start justify-between rounded-sm border-2 p-3"
      style={visuals.containerStyle}
    >
      <View className="w-full flex-row items-center justify-between">
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 13,
            color: visuals.timeColor,
            letterSpacing: 0.5,
          }}
        >
          {startLabel} – {endLabel}
        </Text>
        {visuals.icon && (
          <Ionicons name={visuals.icon} size={14} color={visuals.iconColor} />
        )}
      </View>

      <View className="w-full flex-row items-center justify-between">
        <Text
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
            color: visuals.labelColor,
            letterSpacing: 1.2,
          }}
        >
          {pending ? 'WORKING…' : visuals.label}
        </Text>
        {pending && <ActivityIndicator size="small" color={visuals.iconColor} />}
      </View>

      {status === 'memberBooked' && appointment && (
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            color: COLORS.textMuted,
          }}
        >
          {appointment.memberName}
        </Text>
      )}
    </Pressable>
  );
}

// ---------- Visual helpers ----------

interface SlotVisuals {
  containerStyle: any;
  timeColor: string;
  labelColor: string;
  iconColor: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}

function getSlotVisuals(status: SlotStatus): SlotVisuals {
  switch (status) {
    case 'available':
      return {
        containerStyle: {
          backgroundColor: COLORS.primary,
          borderColor: COLORS.primary,
        },
        timeColor: COLORS.onPrimary,
        labelColor: COLORS.onPrimary,
        iconColor: COLORS.onPrimary,
        icon: 'flash',
        label: 'AVAILABLE',
      };
    case 'memberBooked':
      return {
        containerStyle: {
          backgroundColor: COLORS.surfaceHigh,
          borderColor: COLORS.outline,
        },
        timeColor: COLORS.textPrimary,
        labelColor: COLORS.primary,
        iconColor: COLORS.primary,
        icon: 'person',
        label: 'BOOKED',
      };
    case 'manualBooked':
      return {
        containerStyle: {
          backgroundColor: COLORS.bookedBg,
          borderColor: COLORS.bookedBorder,
          borderStyle: 'dashed',
        },
        timeColor: COLORS.textMuted,
        labelColor: COLORS.textMuted,
        iconColor: COLORS.textMuted,
        icon: 'lock-closed',
        label: 'BLOCKED',
      };
    case 'past':
      return {
        containerStyle: {
          backgroundColor: 'transparent',
          borderColor: COLORS.outline,
          borderStyle: 'dashed',
          opacity: 0.4,
        },
        timeColor: COLORS.textMuted,
        labelColor: COLORS.textMuted,
        iconColor: COLORS.textMuted,
        label: 'PAST',
      };
    case 'empty':
    default:
      return {
        containerStyle: {
          backgroundColor: 'transparent',
          borderColor: COLORS.outline,
          borderStyle: 'dashed',
        },
        timeColor: COLORS.textPrimary,
        labelColor: COLORS.textMuted,
        iconColor: COLORS.textMuted,
        icon: 'add',
        label: 'TAP TO OPEN',
      };
  }
}

function LegendRow({
  color,
  label,
  outlined,
  isLast,
}: {
  color: string;
  label: string;
  outlined?: boolean;
  isLast?: boolean;
}) {
  return (
    <View className={`flex-row items-center ${isLast ? '' : 'mb-2'}`}>
      <View
        className="mr-3 h-4 w-4 rounded-sm"
        style={{
          backgroundColor: color,
          borderWidth: outlined ? 1 : 0,
          borderColor: COLORS.outline,
          borderStyle: outlined && color === 'transparent' ? 'dashed' : 'solid',
        }}
      />
      <Text
        className="flex-1 text-on-background"
        style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
      >
        {label}
      </Text>
    </View>
  );
}
