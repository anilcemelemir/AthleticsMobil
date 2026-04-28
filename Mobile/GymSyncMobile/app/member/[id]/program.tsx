import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AthletixHeader } from '@/components/AthletixHeader';
import { useAuth } from '@/contexts/AuthContext';
import {
  getProgramForMember,
  ROLE,
  TrainingProgramDto,
  upsertProgramForMember,
} from '@/lib/api';

export default function MemberProgramScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const memberId = Number(params.id);
  const passedName = typeof params.name === 'string' ? params.name : '';

  const canEdit = user?.role === ROLE.PT || user?.role === ROLE.Admin;

  const [program, setProgram] = useState<TrainingProgramDto | null>(null);
  const [workout, setWorkout] = useState('');
  const [nutrition, setNutrition] = useState('');
  const [memberName, setMemberName] = useState(passedName);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(memberId)) return;
    try {
      setError(null);
      const data = await getProgramForMember(memberId);
      setProgram(data);
      setWorkout(data.workoutRoutine ?? '');
      setNutrition(data.nutritionPlan ?? '');
      if (data.memberName) setMemberName(data.memberName);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Program yüklenemedi.');
    }
  }, [memberId]);

  useEffect(() => {
    if (!canEdit) return;
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [canEdit, load]);

  const handleSave = async () => {
    if (!Number.isFinite(memberId)) return;
    try {
      setSaving(true);
      const saved = await upsertProgramForMember(memberId, {
        workoutRoutine: workout,
        nutritionPlan: nutrition,
      });
      setProgram(saved);
      Alert.alert('Kaydedildi', 'Program başarıyla güncellendi.');
    } catch (err: any) {
      Alert.alert(
        'Hata',
        err?.response?.data?.message ?? err?.message ?? 'Program kaydedilemedi.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-black px-6">
        <Ionicons name="lock-closed-outline" size={42} color="#9a9078" />
        <Text
          className="mt-3 text-on-background"
          style={{ fontFamily: 'Lexend_700Bold', fontSize: 16 }}
        >
          Yetkin yok
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 rounded-sm border border-outline-variant px-5 py-3 active:bg-surface-container"
        >
          <Text
            className="text-on-background"
            style={{ fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1 }}
          >
            GERİ DÖN
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-black">
      <AthletixHeader onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="px-5 pb-12" keyboardShouldPersistTaps="handled">
          <View className="pb-4 pt-6">
            <Text
              className="text-on-surface-variant"
              style={{ fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.5 }}
            >
              PROGRAM YÖNETİMİ
            </Text>
            <Text
              className="mt-1 text-3xl text-on-background"
              style={{ fontFamily: 'Lexend_800ExtraBold', lineHeight: 36 }}
            >
              {memberName || 'Üye'}
            </Text>
            {program?.updatedAt && program.assignedByName && (
              <Text
                className="mt-1 text-on-surface-variant"
                style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
              >
                Son güncelleme: {new Date(program.updatedAt).toLocaleString()} ·{' '}
                {program.assignedByName}
              </Text>
            )}
          </View>

          {error && (
            <View className="mb-4 rounded-sm border border-accent-red/40 bg-accent-red/10 p-3">
              <Text className="text-sm text-accent-red">{error}</Text>
            </View>
          )}

          {loading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#facc15" />
            </View>
          ) : (
            <>
              {/* Workout Routine */}
              <View className="mb-5 rounded-sm border-l-4 border-l-primary bg-surface-container p-4">
                <View className="mb-3 flex-row items-center">
                  <Ionicons name="barbell-outline" size={18} color="#facc15" />
                  <Text
                    className="ml-2 text-on-background"
                    style={{ fontFamily: 'Lexend_700Bold', fontSize: 15 }}
                  >
                    Antrenman Rutini
                  </Text>
                </View>
                <Text
                  className="mb-2 text-on-surface-variant"
                  style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
                >
                  Egzersiz, set ve tekrar bilgilerini gir.
                </Text>
                <TextInput
                  value={workout}
                  onChangeText={setWorkout}
                  multiline
                  placeholder={
                    'Pazartesi - Göğüs / Triceps\n' +
                    '• Bench Press 4×8\n' +
                    '• Incline DB Press 3×10\n' +
                    '• Cable Fly 3×12'
                  }
                  placeholderTextColor="#6b6354"
                  maxLength={8000}
                  className="rounded-sm border border-outline-variant bg-surface-container-lowest px-3 py-3 text-on-background"
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 14,
                    minHeight: 180,
                    textAlignVertical: 'top',
                    lineHeight: 20,
                  }}
                />
              </View>

              {/* Nutrition Plan */}
              <View className="mb-5 rounded-sm border-l-4 border-l-primary bg-surface-container p-4">
                <View className="mb-3 flex-row items-center">
                  <Ionicons name="nutrition-outline" size={18} color="#facc15" />
                  <Text
                    className="ml-2 text-on-background"
                    style={{ fontFamily: 'Lexend_700Bold', fontSize: 15 }}
                  >
                    Beslenme Planı
                  </Text>
                </View>
                <Text
                  className="mb-2 text-on-surface-variant"
                  style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
                >
                  Günlük öğünler, makro hedefleri ve önerileri yaz.
                </Text>
                <TextInput
                  value={nutrition}
                  onChangeText={setNutrition}
                  multiline
                  placeholder={
                    'Kahvaltı: 4 yumurta, 2 dilim tam buğday ekmeği\n' +
                    'Ara öğün: 30g badem\n' +
                    'Öğle: 200g tavuk göğsü, pirinç, salata\n' +
                    'Akşam: balık, sebze'
                  }
                  placeholderTextColor="#6b6354"
                  maxLength={8000}
                  className="rounded-sm border border-outline-variant bg-surface-container-lowest px-3 py-3 text-on-background"
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 14,
                    minHeight: 180,
                    textAlignVertical: 'top',
                    lineHeight: 20,
                  }}
                />
              </View>

              <Pressable
                disabled={saving}
                onPress={handleSave}
                className="flex-row items-center justify-center rounded-sm bg-primary py-4 active:scale-[0.99] disabled:opacity-50"
              >
                {saving ? (
                  <ActivityIndicator color="#3c2f00" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#000" />
                    <Text
                      className="ml-2 text-black"
                      style={{
                        fontFamily: 'Lexend_900Black',
                        fontSize: 13,
                        letterSpacing: 1,
                      }}
                    >
                      PROGRAMI KAYDET
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
