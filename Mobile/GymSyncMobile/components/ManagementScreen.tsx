import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import {
  assignCredits,
  bulkSendMessage,
  getMembers,
  register,
  ROLE,
  type UserDto,
} from '@/lib/api';

const PRESET_AMOUNTS = [8, 12];

function getCreditTone(remaining: number) {
  if (remaining <= 1) return { label: 'LOW', color: '#ffb4ab' };
  if (remaining <= 4) return { label: 'WATCH', color: '#fbbf24' };
  return { label: 'OK', color: '#86efac' };
}

/**
 * Admin / PT management screen — IRON PULSE dark theme.
 * Admin sees: member list with access keys, can add credits, bulk-message,
 *   and (most importantly) onboard new members → shows generated key in
 *   a large success modal.
 * PT sees: client list, can chat directly.
 */
export default function ManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === ROLE.Admin;
  const isPt = user?.role === ROLE.PT;

  const [members, setMembers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Credit modal (admin only).
  const [selected, setSelected] = useState<UserDto | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bulk message mode.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSending, setBulkSending] = useState(false);

  // Add Member flow (admin only).
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<number>(ROLE.Member);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<{ name: string; key: string } | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      setError(null);
      const list = await getMembers();
      setMembers(list);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load members.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadMembers();
      setLoading(false);
    })();
  }, [loadMembers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  }, [loadMembers]);

  const closeCreditModal = () => {
    setSelected(null);
    setCustomAmount('');
    setSubmitting(false);
  };

  const handleAssign = async (amount: number) => {
    if (!selected) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a positive number.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await assignCredits({ userId: selected.id, amount });
      setMembers((prev) =>
        prev.map((m) =>
          m.id === res.userId
            ? { ...m, totalCredits: res.totalCredits, remainingCredits: res.remainingCredits }
            : m,
        ),
      );
      closeCreditModal();
      Alert.alert('Credits assigned', res.message);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to assign credits.';
      Alert.alert('Error', msg);
      setSubmitting(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const selectAll = () => {
    setSelectedIds(new Set(members.map((m) => m.id)));
  };

  const handleBulkSend = async () => {
    const ids = Array.from(selectedIds);
    const content = bulkText.trim();
    if (ids.length === 0 || !content) return;
    try {
      setBulkSending(true);
      const res = await bulkSendMessage(ids, content);
      setBulkOpen(false);
      setBulkText('');
      exitSelectMode();
      Alert.alert(
        'Message sent',
        `Delivered to ${res.sentCount} member${res.sentCount === 1 ? '' : 's'}.${
          res.failedMemberIds.length ? `\nFailed: ${res.failedMemberIds.length}` : ''
        }`,
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? err?.message ?? 'Bulk send failed.');
    } finally {
      setBulkSending(false);
    }
  };

  const openChat = (m: UserDto) => {
    router.push({
      pathname: '/chat/[userId]',
      params: { userId: String(m.id), name: m.fullName },
    });
  };

  // -- Add Member handlers
  const resetAddForm = () => {
    setNewName('');
    setNewEmail('');
    setNewRole(ROLE.Member);
    setCreateError(null);
    setCreating(false);
  };

  const handleCreateMember = async () => {
    const fullName = newName.trim();
    if (!fullName) {
      setCreateError('Full name is required.');
      return;
    }
    try {
      setCreating(true);
      setCreateError(null);
      const res = await register({
        fullName,
        email: newEmail.trim() || undefined,
        role: newRole,
      });
      setAddOpen(false);
      resetAddForm();
      setCreatedKey({ name: res.user.fullName, key: res.accessKey });
      // Refresh list so the new member appears.
      loadMembers();
    } catch (err: any) {
      setCreateError(
        err?.response?.data?.message ?? err?.message ?? 'Failed to create member.',
      );
      setCreating(false);
    }
  };

  const copyCreatedKey = async () => {
    if (!createdKey) return;
    try {
      await Clipboard.setStringAsync(createdKey.key);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const dismissCreatedKey = () => {
    setCreatedKey(null);
    setKeyCopied(false);
  };

  const headerTitle = isPt ? 'CLIENTS' : 'MEMBERS';
  const headerSubtitle = isPt ? 'Personal Trainer' : 'Admin';
  const selectedCount = selectedIds.size;

  const headerActions = useMemo(() => {
    if (selectMode) {
      return (
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={selectAll}
            className="rounded-sm border border-outline-variant bg-surface-container px-3 py-2 active:bg-surface-container-high"
          >
            <Text
              className="text-on-surface-variant"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1 }}
            >
              ALL
            </Text>
          </Pressable>
          <Pressable
            onPress={exitSelectMode}
            className="rounded-sm border border-outline-variant bg-surface-container px-3 py-2 active:bg-surface-container-high"
          >
            <Text
              className="text-on-surface-variant"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1 }}
            >
              CANCEL
            </Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View className="flex-row items-center gap-2">
        {isAdmin && (
          <Pressable
            onPress={() => {
              resetAddForm();
              setAddOpen(true);
            }}
            className="flex-row items-center rounded-sm bg-primary px-3 py-2 active:bg-primary-dim"
          >
            <Ionicons name="person-add" size={14} color="#3c2f00" />
            <Text
              className="ml-1.5 text-on-primary"
              style={{ fontFamily: 'Lexend_700Bold', fontSize: 11, letterSpacing: 1 }}
            >
              ADD
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={enterSelectMode}
          className="flex-row items-center rounded-sm border border-outline-variant bg-surface-container px-3 py-2 active:bg-surface-container-high"
        >
          <Ionicons name="paper-plane-outline" size={13} color="#facc15" />
          <Text
            className="ml-1.5 text-primary"
            style={{ fontFamily: 'Lexend_700Bold', fontSize: 11, letterSpacing: 1 }}
          >
            BULK
          </Text>
        </Pressable>
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectMode, isAdmin]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#facc15" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-5 pb-4 pt-2">
        <View className="flex-1">
          <Text
            className="text-on-surface-variant"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.5 }}
          >
            {headerSubtitle.toUpperCase()}
          </Text>
          <Text
            className="text-on-background"
            style={{
              fontFamily: 'Lexend_800ExtraBold',
              fontSize: 30,
              letterSpacing: -0.5,
              lineHeight: 34,
            }}
          >
            {headerTitle}
          </Text>
          <Text
            className="mt-1 text-on-surface-variant"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
          >
            {members.length} registered
          </Text>
        </View>
        {headerActions}
      </View>

      {error && (
        <View className="mx-5 mb-3 rounded-sm border border-accent-red/40 bg-accent-red/10 p-3">
          <Text
            className="text-accent-red"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
          >
            {error}
          </Text>
        </View>
      )}

      <FlatList
        data={members}
        keyExtractor={(item) => item.id.toString()}
        contentContainerClassName="px-5 pb-32"
        ItemSeparatorComponent={() => <View className="h-2" />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
        ListEmptyComponent={
          <View className="mt-12 items-center">
            <Ionicons name="people-outline" size={48} color="#9a9078" />
            <Text
              className="mt-2 text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              No members yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const tone = getCreditTone(item.remainingCredits);
          const checked = selectedIds.has(item.id);
          return (
            <Pressable
              onPress={() => {
                if (selectMode) toggleSelect(item.id);
                else if (isAdmin) setSelected(item);
                else openChat(item);
              }}
              onLongPress={() => {
                if (!selectMode) {
                  enterSelectMode();
                  toggleSelect(item.id);
                }
              }}
              className="rounded-sm border border-outline-variant bg-surface-container p-4 active:bg-surface-container-high"
            >
              <View className="flex-row items-center">
                {selectMode && (
                  <View
                    className={`mr-3 h-6 w-6 items-center justify-center rounded-sm border ${
                      checked ? 'border-primary bg-primary' : 'border-outline bg-transparent'
                    }`}
                  >
                    {checked && <Ionicons name="checkmark" size={14} color="#3c2f00" />}
                  </View>
                )}
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-sm bg-primary">
                  <Text
                    className="text-on-primary"
                    style={{ fontFamily: 'Lexend_900Black', fontSize: 16 }}
                  >
                    {item.fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1 pr-2">
                  <Text
                    className="text-on-background"
                    style={{ fontFamily: 'Lexend_700Bold', fontSize: 15 }}
                    numberOfLines={1}
                  >
                    {item.fullName}
                  </Text>
                  <Text
                    className="text-primary"
                    style={{
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 12,
                      letterSpacing: 1.5,
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {item.uniqueAccessKey}
                  </Text>
                </View>
                {!selectMode && isPt && (
                  <Pressable
                    onPress={() => openChat(item)}
                    className="ml-2 h-9 w-9 items-center justify-center rounded-sm border border-outline-variant bg-surface-container-high"
                  >
                    <Ionicons name="chatbubble-ellipses" size={14} color="#facc15" />
                  </Pressable>
                )}
                <View className="ml-2 items-end">
                  <Text
                    style={{
                      fontFamily: 'Lexend_800ExtraBold',
                      fontSize: 18,
                      color: tone.color,
                    }}
                  >
                    {item.remainingCredits}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      fontSize: 9,
                      letterSpacing: 1,
                      color: tone.color,
                    }}
                  >
                    {tone.label}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Bulk action bar */}
      {selectMode && (
        <View className="absolute inset-x-0 bottom-0 border-t border-outline-variant bg-surface-container-low px-5 py-4">
          <View className="flex-row items-center">
            <View className="flex-1">
              <Text
                className="text-on-background"
                style={{ fontFamily: 'Lexend_700Bold', fontSize: 14 }}
              >
                {selectedCount} selected
              </Text>
              <Text
                className="text-on-surface-variant"
                style={{ fontFamily: 'Inter_400Regular', fontSize: 11 }}
              >
                Compose a message to all of them.
              </Text>
            </View>
            <Pressable
              disabled={selectedCount === 0}
              onPress={() => setBulkOpen(true)}
              className="flex-row items-center rounded-sm bg-primary px-4 py-3 active:bg-primary-dim disabled:opacity-50"
            >
              <Ionicons name="send" size={14} color="#3c2f00" />
              <Text
                className="ml-1.5 text-on-primary"
                style={{ fontFamily: 'Lexend_700Bold', fontSize: 12, letterSpacing: 1 }}
              >
                MESSAGE
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Credit modal (admin only) */}
      <Modal
        visible={selected !== null}
        animationType="fade"
        transparent
        onRequestClose={closeCreditModal}
      >
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View className="w-full rounded-sm border border-outline-variant bg-surface-container p-6">
            <Text
              className="text-on-background"
              style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 20, letterSpacing: -0.3 }}
            >
              Add credits
            </Text>
            <Text
              className="mt-1 text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              How many credits to add to{' '}
              <Text className="text-on-background" style={{ fontFamily: 'Inter_600SemiBold' }}>
                {selected?.fullName}
              </Text>
              ?
            </Text>

            <View className="mt-5 flex-row gap-3">
              {PRESET_AMOUNTS.map((amt) => (
                <Pressable
                  key={amt}
                  disabled={submitting}
                  onPress={() => handleAssign(amt)}
                  className="flex-1 items-center rounded-sm bg-primary py-3 active:bg-primary-dim disabled:opacity-50"
                >
                  <Text
                    className="text-on-primary"
                    style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 16 }}
                  >
                    +{amt}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text
              className="mb-2 mt-4 text-on-surface-variant"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5 }}
            >
              CUSTOM AMOUNT
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                value={customAmount}
                onChangeText={setCustomAmount}
                keyboardType="number-pad"
                placeholder="e.g. 5"
                placeholderTextColor="#6b6450"
                editable={!submitting}
                className="flex-1 rounded-sm border border-outline-variant bg-surface-container-low px-4 py-3 text-on-background"
                style={{ fontFamily: 'Inter_500Medium', fontSize: 15 }}
              />
              <Pressable
                disabled={submitting || !customAmount}
                onPress={() => handleAssign(parseInt(customAmount, 10))}
                className="items-center justify-center rounded-sm bg-on-background px-5 active:opacity-80 disabled:opacity-50"
              >
                <Text
                  className="text-background"
                  style={{ fontFamily: 'Lexend_700Bold', fontSize: 12, letterSpacing: 1 }}
                >
                  ADD
                </Text>
              </Pressable>
            </View>

            <Pressable
              disabled={submitting}
              onPress={closeCreditModal}
              className="mt-5 items-center rounded-sm border border-outline-variant py-3 active:bg-surface-container-high disabled:opacity-50"
            >
              <Text
                className="text-on-surface-variant"
                style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 1 }}
              >
                CANCEL
              </Text>
            </Pressable>

            {submitting && (
              <View className="mt-3 items-center">
                <ActivityIndicator color="#facc15" />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Bulk message modal */}
      <Modal
        visible={bulkOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setBulkOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/70">
          <View className="rounded-t-sm border-t border-outline-variant bg-surface-container p-6">
            <View className="mb-3 self-start rounded-sm bg-primary p-2">
              <Ionicons name="megaphone-outline" size={18} color="#3c2f00" />
            </View>
            <Text
              className="text-on-background"
              style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 20 }}
            >
              Bulk message
            </Text>
            <Text
              className="mt-1 text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              Send to {selectedCount} member{selectedCount === 1 ? '' : 's'}.
            </Text>

            <TextInput
              value={bulkText}
              onChangeText={setBulkText}
              placeholder="Type your announcement…"
              placeholderTextColor="#6b6450"
              multiline
              editable={!bulkSending}
              className="mt-4 h-32 rounded-sm border border-outline-variant bg-surface-container-low px-4 py-3 text-on-background"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 14, textAlignVertical: 'top' }}
            />

            <View className="mt-5 flex-row gap-3">
              <Pressable
                disabled={bulkSending}
                onPress={() => setBulkOpen(false)}
                className="flex-1 items-center rounded-sm border border-outline-variant py-3 active:bg-surface-container-high disabled:opacity-50"
              >
                <Text
                  className="text-on-surface-variant"
                  style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 1 }}
                >
                  CANCEL
                </Text>
              </Pressable>
              <Pressable
                disabled={bulkSending || !bulkText.trim()}
                onPress={handleBulkSend}
                className="flex-1 items-center rounded-sm bg-primary py-3 active:bg-primary-dim disabled:opacity-50"
              >
                {bulkSending ? (
                  <ActivityIndicator color="#3c2f00" />
                ) : (
                  <Text
                    className="text-on-primary"
                    style={{ fontFamily: 'Lexend_700Bold', fontSize: 13, letterSpacing: 1 }}
                  >
                    SEND
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Member modal */}
      <Modal
        visible={addOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAddOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/70">
          <View className="rounded-t-sm border-t border-outline-variant bg-surface-container p-6">
            <Text
              className="text-on-background"
              style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 22, letterSpacing: -0.3 }}
            >
              Add a Member
            </Text>
            <Text
              className="mt-1 text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
            >
              A unique access key will be generated automatically.
            </Text>

            <Text
              className="mb-2 mt-5 text-on-surface-variant"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5 }}
            >
              FULL NAME *
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Ada Lovelace"
              placeholderTextColor="#6b6450"
              editable={!creating}
              className="rounded-sm border border-outline-variant bg-surface-container-low px-4 py-3 text-on-background"
              style={{ fontFamily: 'Inter_500Medium', fontSize: 15 }}
            />

            <Text
              className="mb-2 mt-4 text-on-surface-variant"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5 }}
            >
              EMAIL (OPTIONAL)
            </Text>
            <TextInput
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="ada@example.com"
              placeholderTextColor="#6b6450"
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!creating}
              className="rounded-sm border border-outline-variant bg-surface-container-low px-4 py-3 text-on-background"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}
            />

            <Text
              className="mb-2 mt-4 text-on-surface-variant"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5 }}
            >
              ROLE
            </Text>
            <View className="flex-row gap-2">
              {[
                { v: ROLE.Member, l: 'MEMBER' },
                { v: ROLE.PT, l: 'TRAINER' },
              ].map((r) => {
                const active = newRole === r.v;
                return (
                  <Pressable
                    key={r.v}
                    onPress={() => setNewRole(r.v)}
                    disabled={creating}
                    className={`flex-1 items-center rounded-sm border py-3 ${
                      active
                        ? 'border-primary bg-primary'
                        : 'border-outline-variant bg-surface-container-low'
                    }`}
                  >
                    <Text
                      style={{
                        fontFamily: 'Lexend_700Bold',
                        fontSize: 12,
                        letterSpacing: 1,
                        color: active ? '#3c2f00' : '#d1c6ab',
                      }}
                    >
                      {r.l}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {createError && (
              <View className="mt-4 rounded-sm border border-accent-red/40 bg-accent-red/10 px-3 py-2">
                <Text
                  className="text-accent-red"
                  style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
                >
                  {createError}
                </Text>
              </View>
            )}

            <View className="mt-5 flex-row gap-3">
              <Pressable
                disabled={creating}
                onPress={() => {
                  setAddOpen(false);
                  resetAddForm();
                }}
                className="flex-1 items-center rounded-sm border border-outline-variant py-3 active:bg-surface-container-high disabled:opacity-50"
              >
                <Text
                  className="text-on-surface-variant"
                  style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 1 }}
                >
                  CANCEL
                </Text>
              </Pressable>
              <Pressable
                disabled={creating}
                onPress={handleCreateMember}
                className="flex-1 flex-row items-center justify-center rounded-sm bg-primary py-3 active:bg-primary-dim disabled:opacity-50"
              >
                {creating ? (
                  <ActivityIndicator color="#3c2f00" />
                ) : (
                  <>
                    <Ionicons name="key" size={14} color="#3c2f00" />
                    <Text
                      className="ml-1.5 text-on-primary"
                      style={{ fontFamily: 'Lexend_700Bold', fontSize: 13, letterSpacing: 1 }}
                    >
                      GENERATE KEY
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Generated-key success modal */}
      <Modal
        visible={createdKey !== null}
        animationType="fade"
        transparent
        onRequestClose={dismissCreatedKey}
      >
        <View className="flex-1 items-center justify-center bg-black/80 px-6">
          <View
            className="w-full items-center rounded-sm border-2 border-primary bg-surface-container-low p-8"
            style={{
              shadowColor: '#facc15',
              shadowOpacity: 0.4,
              shadowRadius: 32,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <View className="h-16 w-16 items-center justify-center rounded-sm bg-primary">
              <Ionicons name="checkmark" size={32} color="#3c2f00" />
            </View>
            <Text
              className="mt-4 text-on-background"
              style={{ fontFamily: 'Lexend_900Black', fontSize: 20, letterSpacing: 1 }}
            >
              MEMBER CREATED
            </Text>
            <Text
              className="mt-1 text-on-surface-variant text-center"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              Share this access key with{' '}
              <Text
                className="text-on-background"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                {createdKey?.name}
              </Text>
              .
            </Text>

            <View className="mt-6 w-full items-center rounded-sm border border-outline-variant bg-background py-6">
              <Text
                selectable
                className="text-primary"
                style={{
                  fontFamily: 'Lexend_900Black',
                  fontSize: 40,
                  letterSpacing: 5,
                }}
              >
                {createdKey?.key}
              </Text>
            </View>

            <Pressable
              onPress={copyCreatedKey}
              className="mt-4 w-full flex-row items-center justify-center rounded-sm border border-outline-variant bg-surface-container py-3 active:bg-surface-container-high"
            >
              <Ionicons
                name={keyCopied ? 'checkmark-circle' : 'copy-outline'}
                size={16}
                color={keyCopied ? '#86efac' : '#facc15'}
              />
              <Text
                className="ml-2"
                style={{
                  fontFamily: 'Inter_600SemiBold',
                  fontSize: 13,
                  letterSpacing: 1,
                  color: keyCopied ? '#86efac' : '#facc15',
                }}
              >
                {keyCopied ? 'COPIED' : 'COPY KEY'}
              </Text>
            </Pressable>

            <Pressable
              onPress={dismissCreatedKey}
              className="mt-3 w-full items-center rounded-sm bg-primary py-3 active:bg-primary-dim"
            >
              <Text
                className="text-on-primary"
                style={{ fontFamily: 'Lexend_700Bold', fontSize: 13, letterSpacing: 1.5 }}
              >
                DONE
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
