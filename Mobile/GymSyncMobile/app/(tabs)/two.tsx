import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL, ROLE } from '@/lib/api';

const ROLE_NAMES: Record<number, string> = {
  0: 'Admin',
  1: 'Personal Trainer',
  2: 'Member',
};

/**
 * Profile screen — IRON PULSE dark theme.
 * Highlights the user's UniqueAccessKey in a large, copyable display.
 */
export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const copyKey = async () => {
    try {
      await Clipboard.setStringAsync(user.uniqueAccessKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      Alert.alert('Copy failed', 'Could not copy to clipboard.');
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-5 pb-10">
        <Text
          className="mb-6 mt-2 text-on-background"
          style={{ fontFamily: 'Lexend_800ExtraBold', fontSize: 32, letterSpacing: -0.5 }}
        >
          Profile
        </Text>

        {/* Avatar block */}
        <View className="mb-4 items-center rounded-sm border border-outline-variant bg-surface-container p-6">
          <View
            className="h-20 w-20 items-center justify-center rounded-sm bg-primary"
            style={{
              shadowColor: '#facc15',
              shadowOpacity: 0.3,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text
              className="text-on-primary"
              style={{ fontFamily: 'Lexend_900Black', fontSize: 32 }}
            >
              {user.fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text
            className="mt-3 text-on-background"
            style={{ fontFamily: 'Lexend_700Bold', fontSize: 20 }}
          >
            {user.fullName}
          </Text>
          <Text
            className="text-on-surface-variant"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
          >
            {user.email}
          </Text>
          <View className="mt-2 rounded-sm border border-outline-variant bg-surface-container-high px-2 py-1">
            <Text
              className="text-on-surface-variant"
              style={{ fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1 }}
            >
              {ROLE_NAMES[user.role]?.toUpperCase() ?? 'USER'}
            </Text>
          </View>
        </View>

        {/* Access key card */}
        <Pressable
          onPress={copyKey}
          className="mb-4 rounded-sm border-2 border-primary bg-surface-container-low p-6 active:opacity-80"
          style={{
            shadowColor: '#facc15',
            shadowOpacity: 0.15,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text
              className="text-on-surface-variant"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2 }}
            >
              MY ACCESS KEY
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
            style={{
              fontFamily: 'Lexend_900Black',
              fontSize: 36,
              letterSpacing: 4,
            }}
          >
            {user.uniqueAccessKey}
          </Text>
          <Text
            className="mt-2 text-on-surface-variant"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 11 }}
          >
            {copied ? 'Copied to clipboard.' : 'Tap to copy. Keep this safe.'}
          </Text>
        </Pressable>

        {/* API endpoint */}
        <View className="mb-4 rounded-sm border border-outline-variant bg-surface-container p-4">
          <Text
            className="mb-1 text-on-surface-variant"
            style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5 }}
          >
            API ENDPOINT
          </Text>
          <Text
            className="text-on-background"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
          >
            {API_BASE_URL}
          </Text>
        </View>

        {/* Sign out */}
        <Pressable
          onPress={signOut}
          className="flex-row items-center justify-center rounded-sm border border-accent-red/40 bg-surface-container p-4 active:bg-surface-container-high"
        >
          <Ionicons name="log-out-outline" size={20} color="#ffb4ab" />
          <Text
            className="ml-2 text-accent-red"
            style={{ fontFamily: 'Lexend_700Bold', fontSize: 14, letterSpacing: 1 }}
          >
            SIGN OUT
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
