import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import { useAuth } from '@/contexts/AuthContext';
import {
  getMembers,
  getMyAppointments,
  type AppointmentDto,
  type UserDto,
} from '@/lib/api';

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTimeParts(iso: string) {
  const d = new Date(iso);
  const hour = d.getHours() % 12 || 12;
  return {
    hour: String(hour).padStart(2, '0'),
    meridiem: d.getHours() >= 12 ? 'PM' : 'AM',
  };
}

function weekDays() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function PTDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [members, setMembers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [appointmentRes, memberRes] = await Promise.all([
        getMyAppointments(),
        getMembers(),
      ]);
      setAppointments(appointmentRes);
      setMembers(memberRes);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load dashboard.');
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

  const todayAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => isSameLocalDay(new Date(appointment.slotStart), new Date()))
        .sort((a, b) => new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime()),
    [appointments],
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          new Date(appointment.slotEnd || appointment.appointmentDate).getTime() > Date.now() &&
          appointment.status !== 'Cancelled',
      ),
    [appointments],
  );

  const activeClientCount = useMemo(
    () => new Set(upcomingAppointments.map((appointment) => appointment.memberId)).size,
    [upcomingAppointments],
  );

  const firstName = user?.fullName.split(' ')[0] ?? 'Coach';
  const days = weekDays();

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#facc15" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-outline-variant bg-black px-5 py-3">
        <View className="flex-row items-center gap-4">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-surface-container-high">
            <Text className="text-sm font-bold text-primary">
              {firstName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text
            className="text-xl italic text-primary"
            style={{ fontFamily: 'Lexend_900Black', letterSpacing: 0 }}
          >
            TRAINER HUB
          </Text>
        </View>
        <Pressable className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-container">
          <Ionicons name="notifications-outline" size={22} color="#9ca3af" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="gap-8 px-5 pb-28 pt-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
      >
        <View>
          <Text
            className="text-on-background"
            style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 40, lineHeight: 44 }}
          >
            Welcome back, <Text className="text-primary">Coach</Text>
          </Text>
          <Text className="mt-1 text-base text-on-surface-variant">
            Let's crush today's goals.
          </Text>
          {error ? (
            <View className="mt-4 rounded-sm border border-accent-red/40 bg-accent-red/10 p-3">
              <Text className="text-sm text-accent-red">{error}</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row flex-wrap gap-2">
          <StatCard label="Sessions" value={String(todayAppointments.length)} icon="barbell" />
          <StatCard label="Clients" value={String(activeClientCount || members.length)} icon="people" />
          <StatCard
            label="Upcoming"
            value={String(upcomingAppointments.length)}
            icon="calendar"
            wide
          />
        </View>

        <View className="gap-4">
          <SectionTitle title="Today's Schedule" action="View All" onPress={() => router.push('/(tabs)/today')} />
          <View className="gap-2">
            {todayAppointments.length === 0 ? (
              <EmptyPanel icon="calendar-clear-outline" text="No booked sessions today." />
            ) : (
              todayAppointments.slice(0, 3).map((appointment, index) => (
                <ScheduleItem
                  key={appointment.id}
                  appointment={appointment}
                  active={index === 0 && new Date(appointment.slotEnd).getTime() > Date.now()}
                />
              ))
            )}
          </View>
        </View>

        <View className="gap-4">
          <SectionTitle title="This Week" />
          <View className="rounded-sm border border-[#4B5563] bg-[#111827] p-4">
            <View className="flex-row justify-between">
              {days.map((day) => {
                const hasSession = appointments.some((appointment) =>
                  isSameLocalDay(new Date(appointment.slotStart), day),
                );
                const isToday = isSameLocalDay(day, new Date());
                return (
                  <View key={day.toISOString()} className="items-center gap-1">
                    <Text
                      className={`text-[10px] font-semibold uppercase ${
                        isToday ? 'text-primary' : 'text-[#D1D5DB]'
                      }`}
                    >
                      {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    </Text>
                    <View
                      className={`h-8 w-8 items-center justify-center rounded-full ${
                        isToday ? 'bg-primary' : ''
                      }`}
                    >
                      <Text
                        className={`font-bold ${
                          isToday ? 'text-[#111827]' : 'text-on-background'
                        }`}
                      >
                        {day.getDate()}
                      </Text>
                    </View>
                    <View
                      className={`h-1 w-1 rounded-full ${
                        hasSession ? 'bg-primary' : 'bg-[#4B5563]'
                      }`}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View className="gap-2">
          <Pressable
            onPress={() => router.push('/(tabs)/schedule')}
            className="w-full flex-row items-center justify-center gap-2 rounded-sm bg-primary py-3 active:scale-[0.99]"
          >
            <Ionicons name="add-circle" size={22} color="#000000" />
            <Text
              className="text-2xl uppercase text-black"
              style={{ fontFamily: 'Lexend_800ExtraBold' }}
            >
              ADD NEW SESSION
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/messages')}
            className="w-full flex-row items-center justify-center gap-2 rounded-sm border border-[#4B5563] bg-[#111827] py-3 active:scale-[0.99]"
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#ebe2d0" />
            <Text className="text-sm font-bold uppercase text-on-background">
              MESSAGE CLIENTS
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
  wide,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  wide?: boolean;
}) {
  return (
    <View className={`${wide ? 'w-full' : 'flex-1'} rounded-sm border border-[#4B5563] bg-[#111827] p-4`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold uppercase text-on-surface-variant">{label}</Text>
        <Ionicons name={icon} size={20} color="#facc15" />
      </View>
      <Text
        className="mt-1 text-on-background"
        style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 32, lineHeight: 36 }}
      >
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View className="flex-row items-end justify-between">
      <Text
        className="border-l-4 border-primary pl-2 text-2xl text-on-background"
        style={{ fontFamily: 'Lexend_700Bold', lineHeight: 28 }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onPress}>
          <Text className="text-xs font-semibold uppercase text-primary">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ScheduleItem({
  appointment,
  active,
}: {
  appointment: AppointmentDto;
  active?: boolean;
}) {
  const time = formatTimeParts(appointment.slotStart);

  return (
    <View
      className={`flex-row items-center justify-between rounded-sm border-y border-r border-[#4B5563] bg-[#111827] p-4 ${
        active ? 'border-l-2 border-l-primary' : 'border-l border-l-[#4B5563]'
      }`}
    >
      <View className="flex-row items-center gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-sm bg-surface-container">
          <Text className="text-sm font-bold leading-none text-on-background">{time.hour}</Text>
          <Text className={`text-xs leading-none ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
            {time.meridiem}
          </Text>
        </View>
        <View>
          <Text className="text-sm font-bold text-on-background">{appointment.memberName}</Text>
          <Text className="text-sm text-on-surface-variant">Training Session</Text>
        </View>
      </View>
      {active ? (
        <View className="rounded-sm border border-[#4B5563] bg-[#1F2937] px-3 py-1">
          <Text className="text-xs font-semibold uppercase text-[#D1D5DB]">In Progress</Text>
        </View>
      ) : null}
    </View>
  );
}

function EmptyPanel({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
}) {
  return (
    <View className="items-center rounded-sm border border-[#4B5563] bg-[#111827] p-6">
      <Ionicons name={icon} size={34} color="#9a9078" />
      <Text className="mt-2 text-sm text-on-surface-variant">{text}</Text>
    </View>
  );
}
