import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AthletixHeader } from '@/components/AthletixHeader';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL, ROLE } from '@/lib/api';

const ROLE_NAMES: Record<number, string> = {
  0: 'Admin',
  1: 'Kişisel Antrenör',
  2: 'Üye',
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [copied, setCopied] = useState(false);

  const profileStats = useMemo(() => {
    if (!user) return null;
    const usedCredits = Math.max(0, user.totalCredits - user.remainingCredits);
    const level = user.role === ROLE.PT ? 24 : user.role === ROLE.Admin ? 99 : 12 + usedCredits;
    const weeklyHours = user.role === ROLE.PT ? '8.0' : Math.max(1.2, usedCredits * 0.7).toFixed(1);
    return {
      level,
      title:
        user.role === ROLE.PT
          ? 'Elit Antrenör'
          : user.role === ROLE.Admin
            ? 'Operasyon Lideri'
            : 'Elit Powerlifter',
      weeklyHours,
      streak: user.role === ROLE.Member ? Math.min(12, usedCredits + 1) : 5,
      volume: user.role === ROLE.Member ? `${Math.max(4, usedCredits * 2)}k` : '24k',
    };
  }, [user]);

  if (!user || !profileStats) return null;

  const copyKey = async () => {
    try {
      await Clipboard.setStringAsync(user.uniqueAccessKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      Alert.alert('Kopyalanamadı', 'Panoya kopyalanamadi.');
    }
  };

  const initials = user.fullName
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <AthletixHeader
        right={
          <View className="h-9 w-9 items-center justify-center rounded-sm border border-primary bg-surface-container">
          <Text className="text-xs font-bold text-primary">{initials.slice(0, 1)}</Text>
          </View>
        }
      />

      <ScrollView contentContainerClassName="gap-8 px-5 pb-28 pt-6">
        <View className="relative items-center">
          <Pressable className="absolute right-0 top-0 p-2 active:opacity-70">
            <Ionicons name="settings-outline" size={28} color="#d1c6ab" />
          </Pressable>
          <View>
            <View
              className="h-28 w-28 items-center justify-center rounded-full border-4 border-primary bg-surface-container-high"
              style={{
                shadowColor: '#facc15',
                shadowOpacity: 0.22,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 0 },
              }}
            >
              <Text
                className="text-primary"
                style={{ fontFamily: 'Lexend_900Black', fontSize: 36 }}
              >
                {initials}
              </Text>
            </View>
            <View className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-sm border border-outline-variant bg-surface-container-highest px-3 py-1">
              <Text className="text-sm font-bold uppercase text-primary">
                LVL {profileStats.level}
              </Text>
            </View>
          </View>
          <Text
            className="mt-7 text-center uppercase text-on-background"
            style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 32, lineHeight: 36 }}
          >
            {user.fullName}
          </Text>
          <Text className="mt-1 text-base text-on-surface-variant">{profileStats.title}</Text>
          <View className="mt-3 rounded-sm border border-outline-variant bg-surface-container-high px-3 py-1">
            <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              {ROLE_NAMES[user.role] ?? 'User'}
            </Text>
          </View>
        </View>

        <View className="gap-3">
          <SectionLabel title="Haftalık Performans" />
          <View className="rounded-sm border border-outline-variant bg-surface-container-low p-4">
            <View className="mb-6 flex-row items-end justify-between">
              <View className="flex-row items-baseline">
                <Text
                  className="text-primary"
                  style={{ fontFamily: 'Lexend_900Black', fontSize: 40, lineHeight: 44 }}
                >
                  {profileStats.weeklyHours}
                </Text>
                <Text className="ml-1 text-base text-on-surface-variant">saat</Text>
              </View>
              <View className="rounded-sm bg-primary/10 px-2 py-1">
              <Text className="text-xs font-semibold text-primary">Önceki haftaya göre +12%</Text>
              </View>
            </View>
            <View className="h-24 flex-row items-end gap-2">
              {[30, 50, 80, 40, 100, 10, 20].map((height, index) => (
                <View
                  key={index}
                  className={`flex-1 rounded-t-sm ${index === 4 ? 'bg-primary' : 'bg-surface-container-highest'}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </View>
            <View className="mt-2 flex-row justify-between px-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                <Text
                  key={`${day}-${index}`}
                  className={`text-xs ${index === 4 ? 'font-bold text-primary' : 'text-on-surface-variant'}`}
                >
                  {day}
                </Text>
              ))}
            </View>
          </View>

          <View className="flex-row gap-3">
            <MiniStat icon="flame-outline" value={String(profileStats.streak)} label="Gün Serisi" />
            <MiniStat icon="barbell-outline" value={profileStats.volume} label="Vol (Lbs)" />
          </View>
        </View>

        <View className="gap-3">
          <SectionLabel title="Rozetler" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
            <Badge icon="ribbon" label="1000 Club" />
            <Badge icon="timer" label="Erkenci" />
            <Badge icon="lock-closed" label="Iron Man" locked />
            <Badge icon="lock-closed" label="Century" locked />
          </ScrollView>
        </View>

        <View className="gap-3">
          <SectionLabel title="Kişisel Rekorlar" />
          <View className="overflow-hidden rounded-sm border border-outline-variant bg-surface-container-low">
            <RecordRow label="Max Squat" value="405" unit="lbs" highlight />
            <RecordRow label="Deadlift" value="495" unit="lbs" highlight />
            <RecordRow label="Bench Press" value="275" unit="lbs" />
            <RecordRow label="En Hızlı 5K" value="21:45" isLast />
          </View>
        </View>

        <Pressable
          onPress={copyKey}
          className="rounded-sm border-2 border-primary bg-surface-container-low p-5 active:opacity-80"
          style={{
            shadowColor: '#facc15',
            shadowOpacity: 0.14,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              Giriş Anahtarım
            </Text>
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={18}
              color={copied ? '#86efac' : '#facc15'}
            />
          </View>
          <Text
            selectable
            className="mt-3 text-primary"
            style={{ fontFamily: 'Lexend_900Black', fontSize: 34, letterSpacing: 3 }}
          >
            {user.uniqueAccessKey}
          </Text>
          <Text className="mt-2 text-xs text-on-surface-variant">
            {copied ? 'Panoya kopyalandı.' : 'Kopyalamak için dokun. Güvende tut.'}
          </Text>
        </Pressable>

        <View className="rounded-sm border border-outline-variant bg-surface-container p-4">
          <SectionLabel title="Hesap" />
          <InfoRow label="E-posta" value={user.email} />
          <InfoRow label="Telefon" value={user.phoneNumber || '-'} />
          <InfoRow label="Kredi" value={`${user.remainingCredits}/${user.totalCredits}`} />
          <InfoRow label="Kayıt tarihi" value={new Date(user.createdAt).toLocaleDateString()} />
          <InfoRow label="API adresi" value={API_BASE_URL} isLast />
        </View>

        <Pressable
          onPress={signOut}
          className="flex-row items-center justify-center rounded-sm border border-accent-red/40 bg-surface-container p-4 active:bg-surface-container-high"
        >
          <Ionicons name="log-out-outline" size={20} color="#ffb4ab" />
          <Text className="ml-2 text-sm font-bold tracking-wider text-accent-red">ÇIKIŞ YAP</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text className="pl-1 text-sm font-bold uppercase tracking-widest text-on-surface-variant">
      {title}
    </Text>
  );
}

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  label: string;
}) {
  return (
    <View className="flex-1 rounded-sm border border-outline-variant bg-surface-container-low p-4">
      <Ionicons name={icon} size={22} color="#d1c6ab" />
      <Text
        className="mt-3 text-on-background"
        style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 24, lineHeight: 28 }}
      >
        {value}
      </Text>
      <Text className="text-xs font-semibold uppercase text-on-surface-variant">{label}</Text>
    </View>
  );
}

function Badge({
  icon,
  label,
  locked,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  locked?: boolean;
}) {
  return (
    <View className={`w-20 items-center gap-2 ${locked ? 'opacity-50' : ''}`}>
      <View
        className={`h-16 w-16 items-center justify-center rounded-full border ${
          locked
            ? 'border-outline-variant bg-surface-container-lowest'
            : 'border-primary bg-surface-container'
        }`}
      >
        <Ionicons name={icon} size={32} color={locked ? '#d1c6ab' : '#facc15'} />
      </View>
      <Text
        className={`text-center text-xs ${locked ? 'text-on-surface-variant' : 'text-on-background'}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function RecordRow({
  label,
  value,
  unit,
  highlight,
  isLast,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between p-4 ${
        isLast ? '' : 'border-b border-surface-container-highest'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <View className={`h-8 w-2 rounded-sm ${highlight ? 'bg-primary' : 'bg-surface-container-highest'}`} />
        <Text className="text-sm font-bold uppercase text-on-background">{label}</Text>
      </View>
      <View className="flex-row items-baseline gap-1">
        <Text
          className={highlight ? 'text-primary' : 'text-on-background'}
          style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 24, lineHeight: 28 }}
        >
          {value}
        </Text>
        {unit ? <Text className="text-xs text-on-surface-variant">{unit}</Text> : null}
      </View>
    </View>
  );
}

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between py-3 ${isLast ? '' : 'border-b border-outline-variant/40'}`}>
      <Text className="text-sm text-on-surface-variant">{label}</Text>
      <Text className="max-w-[62%] text-right text-sm font-medium text-on-background" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

