import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AthletixHeader } from '@/components/AthletixHeader';
import { getMyProgram, TrainingProgramDto } from '@/lib/api';

export default function MyProgramScreen() {
  const router = useRouter();
  const [program, setProgram] = useState<TrainingProgramDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getMyProgram();
      setProgram(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Program yüklenemedi.');
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

  const hasContent =
    program &&
    ((program.workoutRoutine && program.workoutRoutine.trim().length > 0) ||
      (program.nutritionPlan && program.nutritionPlan.trim().length > 0));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <AthletixHeader onBack={() => router.back()} />

      <ScrollView
        contentContainerClassName="px-5 pb-12"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
      >
        <View className="pb-4 pt-6">
          <Text
            className="text-on-surface-variant"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.5 }}
          >
            KİŞİSEL
          </Text>
          <Text
            className="mt-1 text-3xl text-on-background"
            style={{ fontFamily: 'Lexend_800ExtraBold', lineHeight: 36 }}
          >
            Programım
          </Text>
          {program?.assignedByName && (
            <Text
              className="mt-1 text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
            >
              Hocan: {program.assignedByName}
              {program.updatedAt
                ? ` · Son güncelleme ${new Date(program.updatedAt).toLocaleDateString()}`
                : ''}
            </Text>
          )}
        </View>

        {loading ? (
          <View className="items-center py-12">
            <ActivityIndicator color="#facc15" />
          </View>
        ) : error ? (
          <View className="rounded-sm border border-accent-red/40 bg-accent-red/10 p-4">
            <Text
              className="text-accent-red"
              style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
            >
              {error}
            </Text>
          </View>
        ) : !hasContent ? (
          <View className="items-center rounded-sm border border-outline-variant bg-surface-container p-8">
            <Ionicons name="document-text-outline" size={48} color="#9a9078" />
            <Text
              className="mt-3 text-on-background"
              style={{ fontFamily: 'Lexend_700Bold', fontSize: 16 }}
            >
              Henüz program yok
            </Text>
            <Text
              className="mt-2 text-center text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              Hocan henüz bir program tanımlamadı.
            </Text>
          </View>
        ) : (
          <>
            <ProgramSection
              icon="barbell-outline"
              title="Antrenman Rutini"
              content={program!.workoutRoutine}
            />
            <ProgramSection
              icon="nutrition-outline"
              title="Beslenme Planı"
              content={program!.nutritionPlan}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgramSection({
  icon,
  title,
  content,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  content: string;
}) {
  const trimmed = (content ?? '').trim();
  return (
    <View className="mb-4 rounded-sm border-l-4 border-l-primary bg-surface-container p-4">
      <View className="mb-3 flex-row items-center">
        <Ionicons name={icon} size={18} color="#facc15" />
        <Text
          className="ml-2 text-on-background"
          style={{ fontFamily: 'Lexend_700Bold', fontSize: 15 }}
        >
          {title}
        </Text>
      </View>
      {trimmed.length === 0 ? (
        <Text
          className="text-on-surface-variant"
          style={{ fontFamily: 'Inter_400Regular', fontSize: 13, fontStyle: 'italic' }}
        >
          Bu bölüm henüz boş.
        </Text>
      ) : (
        <Text
          className="text-on-background"
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            lineHeight: 22,
          }}
          selectable
        >
          {trimmed}
        </Text>
      )}
    </View>
  );
}
