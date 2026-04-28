import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AthletixHeader } from '@/components/AthletixHeader';
import ManagementScreen from '@/components/ManagementScreen';
import PTDashboardScreen from '@/components/PTDashboardScreen';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE } from '@/lib/api';

const ROLE_NAMES: Record<number, string> = {
  0: 'Admin',
  1: 'Kişisel Antrenör',
  2: 'Üye',
};

export default function HomeTabScreen() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === ROLE.Admin) return <ManagementScreen />;
  if (user.role === ROLE.PT) return <PTDashboardScreen />;

  return <DashboardScreen />;
}

/**
 * Member dashboard — STRIVE bento grid.
 * Big yellow brand header, large remaining-credits number, and a small
 * grid of secondary metrics. Pull-to-refresh re-fetches /me.
 */
function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  }, [refreshUser]);

  if (!user) return null;

  const firstName = user.fullName.split(' ')[0] ?? user.fullName;
  const used = Math.max(0, user.totalCredits - user.remainingCredits);
  const pct =
    user.totalCredits > 0
      ? Math.min(100, Math.round((user.remainingCredits / user.totalCredits) * 100))
      : 0;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <AthletixHeader />
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#facc15"
          />
        }
      >
        <View className="mb-6 mt-5 flex-row justify-end">
          <View className="rounded-sm border border-outline-variant bg-surface-container px-2 py-1">
            <Text
              className="text-on-surface-variant"
              style={{ fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1 }}
            >
              {ROLE_NAMES[user.role]?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Welcome */}
        <View className="mb-6">
          <Text
            className="text-on-surface-variant"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
          >
            Tekrar hoş geldin,
          </Text>
          <Text
            className="text-on-background"
            style={{
              fontFamily: 'Lexend_800ExtraBold',
              fontSize: 32,
              letterSpacing: -0.5,
              lineHeight: 36,
            }}
          >
            {firstName}.
          </Text>
        </View>

        {/* Hero credit card */}
        <View
          className="mb-3 rounded-sm border-2 border-primary bg-primary p-6"
          style={{
            shadowColor: '#facc15',
            shadowOpacity: 0.25,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text
              className="text-on-primary"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2 }}
            >
              KALAN KREDİ
            </Text>
            <Ionicons name="flash" size={18} color="#3c2f00" />
          </View>
          <Text
            className="mt-2 text-on-primary"
            style={{
              fontFamily: 'Lexend_900Black',
              fontSize: 72,
              letterSpacing: -2,
              lineHeight: 76,
            }}
          >
            {user.remainingCredits}
          </Text>
          <Text
            className="text-on-primary/80"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
          >
            toplam {user.totalCredits} seans
          </Text>

          {/* Progress bar */}
          <View className="mt-4 h-1.5 overflow-hidden rounded-sm bg-on-primary/15">
            <View
              className="h-full bg-on-primary"
              style={{ width: `${pct}%` }}
            />
          </View>
        </View>

        {/* Bento grid */}
        <View className="mb-3 flex-row gap-3">
          <BentoCard
            label="KULLANILAN"
            value={String(used)}
            sub="seans"
            icon="checkmark-done"
          />
          <BentoCard
            label="SERİ"
            value="0"
            sub="bu hafta"
            icon="trending-up"
          />
        </View>

        {/* Programım */}
        <Pressable
          onPress={() => router.push('/program')}
          className="mb-3 flex-row items-center rounded-sm border border-primary/40 border-l-4 border-l-primary bg-surface-container p-4 active:bg-surface-container-high"
        >
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-sm bg-primary/15">
            <Ionicons name="document-text" size={20} color="#facc15" />
          </View>
          <View className="flex-1">
            <Text
              className="text-on-background"
              style={{
                fontFamily: 'Lexend_700Bold',
                fontSize: 13,
                letterSpacing: 1.2,
              }}
            >
              PROGRAMIM
            </Text>
            <Text
              className="text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 }}
            >
              Antrenman & Beslenme planı
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#facc15" />
        </Pressable>

        {/* Account block */}
        <View className="rounded-sm border border-outline-variant bg-surface-container p-5">
          <Text
            className="mb-4 text-on-background"
            style={{ fontFamily: 'Lexend_700Bold', fontSize: 16 }}
          >
            Hesap
          </Text>
          <InfoRow label="E-posta" value={user.email} />
          <InfoRow label="Kayıt tarihi" value={new Date(user.createdAt).toLocaleDateString()} isLast />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BentoCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View className="flex-1 rounded-sm border border-outline-variant bg-surface-container p-4">
      <View className="flex-row items-center justify-between">
        <Text
          className="text-on-surface-variant"
          style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5 }}
        >
          {label}
        </Text>
        <Ionicons name={icon} size={16} color="#facc15" />
      </View>
      <Text
        className="mt-2 text-on-background"
        style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 32, letterSpacing: -0.5 }}
      >
        {value}
      </Text>
      <Text
        className="text-on-surface-variant"
        style={{ fontFamily: 'Inter_400Regular', fontSize: 11 }}
      >
        {sub}
      </Text>
    </View>
  );
}

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View
      className={`flex-row items-center justify-between py-3 ${
        isLast ? '' : 'border-b border-outline-variant/40'
      }`}
    >
      <Text
        className="text-on-surface-variant"
        style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
      >
        {label}
      </Text>
      <Text
        className="text-on-background"
        style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
      >
        {value}
      </Text>
    </View>
  );
}
