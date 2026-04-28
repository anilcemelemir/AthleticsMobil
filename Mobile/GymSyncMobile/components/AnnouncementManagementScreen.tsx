import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AthletixHeader } from '@/components/AthletixHeader';
import { useAuth } from '@/contexts/AuthContext';
import {
  AnnouncementAudience,
  AnnouncementDto,
  createAnnouncement,
  deleteAnnouncement,
  getAllAnnouncements,
  ROLE,
} from '@/lib/api';

const AUDIENCE_OPTIONS: { value: AnnouncementAudience; label: string }[] = [
  { value: 'All', label: 'Herkes' },
  { value: 'PT', label: 'Antrenörler' },
  { value: 'Member', label: 'Üyeler' },
];

const AUDIENCE_LABEL: Record<string, string> = {
  All: 'HERKES',
  PT: 'ANTRENÖRLER',
  Member: 'ÜYELER',
};

export default function AnnouncementManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === ROLE.Admin;

  const [items, setItems] = useState<AnnouncementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('All');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getAllAnnouncements();
      setItems(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Duyurular yüklenemedi.');
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [isAdmin, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setAudience('All');
  };

  const handleCreate = async () => {
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) {
      Alert.alert('Eksik bilgi', 'Başlık ve içerik zorunludur.');
      return;
    }
    try {
      setSubmitting(true);
      const created = await createAnnouncement({ title: t, content: c, targetAudience: audience });
      setItems((prev) => [created, ...prev]);
      resetForm();
      setFormOpen(false);
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.message ?? err?.message ?? 'Duyuru oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (item: AnnouncementDto) => {
    Alert.alert(
      'Duyuruyu sil',
      `"${item.title}" başlıklı duyuru tüm kullanıcılar için silinecek. Devam edilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(item.id);
              await deleteAnnouncement(item.id);
              setItems((prev) => prev.filter((a) => a.id !== item.id));
            } catch (err: any) {
              Alert.alert('Hata', err?.response?.data?.message ?? err?.message ?? 'Silinemedi.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  if (!isAdmin) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-black px-6">
        <Ionicons name="lock-closed-outline" size={42} color="#9a9078" />
        <Text
          className="mt-3 text-on-background"
          style={{ fontFamily: 'Lexend_700Bold', fontSize: 16 }}
        >
          Yetkin yok
        </Text>
        <Text
          className="mt-1 text-center text-on-surface-variant"
          style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
        >
          Bu sayfa yalnızca yöneticiler içindir.
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

      <ScrollView
        contentContainerClassName="px-5 pb-10"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
      >
        <View className="pb-4 pt-6">
          <Text
            className="text-3xl text-on-background"
            style={{ fontFamily: 'Lexend_800ExtraBold', lineHeight: 36 }}
          >
            Duyuru Yönetimi
          </Text>
          <Text
            className="mt-1 text-on-surface-variant"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
          >
            Üyelere ve antrenörlere duyuru yayınla, gerektiğinde sil.
          </Text>
        </View>

        <Pressable
          onPress={() => setFormOpen(true)}
          className="mb-5 flex-row items-center justify-center rounded-sm bg-primary py-4 active:scale-[0.99]"
        >
          <Ionicons name="add-circle-outline" size={18} color="#000" />
          <Text
            className="ml-2 text-black"
            style={{ fontFamily: 'Lexend_900Black', fontSize: 13, letterSpacing: 1 }}
          >
            YENİ DUYURU
          </Text>
        </Pressable>

        {error && (
          <View className="mb-4 rounded-sm border border-accent-red/40 bg-accent-red/10 p-3">
            <Text className="text-sm text-accent-red">{error}</Text>
          </View>
        )}

        {loading ? (
          <View className="items-center py-12">
            <ActivityIndicator color="#facc15" />
          </View>
        ) : items.length === 0 ? (
          <View className="items-center rounded-sm border border-outline-variant bg-surface-container-lowest p-8">
            <Ionicons name="megaphone-outline" size={42} color="#9a9078" />
            <Text
              className="mt-3 text-on-background"
              style={{ fontFamily: 'Lexend_700Bold', fontSize: 15 }}
            >
              Henüz duyuru yok
            </Text>
            <Text
              className="mt-1 text-center text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
            >
              "Yeni Duyuru" butonuna basarak ilkini oluştur.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View
              key={item.id}
              className="mb-3 rounded-sm border-l-4 border-l-primary bg-surface-container p-4"
            >
              <View className="flex-row items-start justify-between">
                <View className="mr-3 flex-1">
                  <Text
                    className="text-on-background"
                    style={{ fontFamily: 'Lexend_700Bold', fontSize: 15 }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    className="mt-1 text-on-surface-variant"
                    style={{ fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 }}
                  >
                    {item.content}
                  </Text>
                  <View className="mt-3 flex-row items-center">
                    <View className="rounded-sm bg-primary/15 px-2 py-0.5">
                      <Text
                        className="text-primary"
                        style={{ fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.6 }}
                      >
                        {AUDIENCE_LABEL[item.targetAudience] ?? item.targetAudience}
                      </Text>
                    </View>
                    <Text
                      className="ml-2 text-on-surface-variant"
                      style={{ fontFamily: 'Inter_400Regular', fontSize: 11 }}
                    >
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
                <Pressable
                  disabled={deletingId === item.id}
                  onPress={() => handleDelete(item)}
                  hitSlop={8}
                  className="h-9 w-9 items-center justify-center rounded-sm active:bg-red-500/10"
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  )}
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={formOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFormOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/70"
        >
          <View className="rounded-t-2xl border-t border-outline-variant bg-surface-container-lowest p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <Text
                className="text-on-background"
                style={{ fontFamily: 'Lexend_700Bold', fontSize: 16 }}
              >
                Yeni Duyuru
              </Text>
              <Pressable
                onPress={() => setFormOpen(false)}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-sm active:bg-surface-container-high"
              >
                <Ionicons name="close" size={20} color="#ebe2d0" />
              </Pressable>
            </View>

            <Text
              className="mb-1 text-on-surface-variant"
              style={{ fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8 }}
            >
              BAŞLIK
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Örn. Pazartesi bakım"
              placeholderTextColor="#6b6354"
              maxLength={120}
              className="mb-4 rounded-sm border border-outline-variant bg-surface-container px-3 py-3 text-on-background"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}
            />

            <Text
              className="mb-1 text-on-surface-variant"
              style={{ fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8 }}
            >
              İÇERİK
            </Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Duyuru detayı..."
              placeholderTextColor="#6b6354"
              multiline
              maxLength={2000}
              className="mb-4 rounded-sm border border-outline-variant bg-surface-container px-3 py-3 text-on-background"
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />

            <Text
              className="mb-2 text-on-surface-variant"
              style={{ fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8 }}
            >
              HEDEF KİTLE
            </Text>
            <View className="mb-5 flex-row gap-2">
              {AUDIENCE_OPTIONS.map((opt) => {
                const active = audience === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setAudience(opt.value)}
                    className={`flex-1 items-center rounded-sm border py-3 ${
                      active
                        ? 'border-primary bg-primary/10'
                        : 'border-outline-variant bg-surface-container'
                    }`}
                  >
                    <Text
                      className={active ? 'text-primary' : 'text-on-surface-variant'}
                      style={{ fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 0.5 }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              disabled={submitting}
              onPress={handleCreate}
              className="items-center rounded-sm bg-primary py-4 active:scale-[0.99] disabled:opacity-40"
            >
              {submitting ? (
                <ActivityIndicator color="#3c2f00" />
              ) : (
                <Text
                  className="text-black"
                  style={{ fontFamily: 'Lexend_900Black', fontSize: 13, letterSpacing: 1 }}
                >
                  YAYINLA
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
