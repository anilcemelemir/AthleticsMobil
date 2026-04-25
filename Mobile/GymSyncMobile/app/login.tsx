import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';

/**
 * Access-key login. Members enter the unique key issued by an Admin
 * (e.g. "GS-72A9B"). The "GS-" prefix is auto-prepended if missing.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { signInWithKey } = useAuth();

  const [key, setKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    const trimmed = key.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter your access key.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signInWithKey(trimmed);
      router.replace('/(tabs)');
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.response?.status === 401
          ? 'That key is not recognized.'
          : err?.message ?? 'Login failed. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header bar with brand */}
        <View className="flex-row items-center justify-center border-b border-outline-variant/40 bg-surface-container-lowest px-5 py-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="flash" size={22} color="#facc15" />
            <Text
              className="text-on-background"
              style={{ fontFamily: 'Lexend_900Black', letterSpacing: 1.5 }}
            >
              IRON PULSE
            </Text>
          </View>
        </View>

        <View className="flex-1 justify-center px-6">
          {/* Headline */}
          <View className="mb-12">
            <Text
              className="text-on-background"
              style={{
                fontFamily: 'Lexend_800ExtraBold',
                fontSize: 40,
                lineHeight: 44,
                letterSpacing: -0.5,
              }}
            >
              ENTER{'\n'}YOUR KEY
            </Text>
            <Text
              className="mt-3 text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 14 }}
            >
              Use the unique access key issued to you by your gym admin.
            </Text>
          </View>

          {/* Key input */}
          <View
            className={`rounded-sm border-2 bg-surface-container px-4 py-5 ${
              error ? 'border-accent-red' : 'border-outline-variant'
            }`}
            style={{
              shadowColor: '#facc15',
              shadowOpacity: 0.08,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text
              className="mb-2 text-on-surface-variant"
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 11,
                letterSpacing: 1.5,
              }}
            >
              MEMBER KEY
            </Text>
            <TextInput
              value={key}
              onChangeText={setKey}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
              placeholder="GS-XXXXX"
              placeholderTextColor="#6b6450"
              selectionColor="#facc15"
              style={{
                fontFamily: Platform.select({
                  ios: 'Menlo',
                  android: 'monospace',
                  default: 'monospace',
                }),
                fontSize: 28,
                color: '#facc15',
                letterSpacing: 4,
                paddingVertical: 4,
              }}
            />
          </View>

          {error && (
            <View className="mt-4 rounded-sm border border-accent-red/40 bg-accent-red/10 px-3 py-2">
              <Text
                className="text-accent-red"
                style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
              >
                {error}
              </Text>
            </View>
          )}

          {/* CTA */}
          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            className={`mt-8 flex-row items-center justify-center rounded-sm px-6 py-4 ${
              submitting ? 'bg-primary/60' : 'bg-primary active:bg-primary-dim'
            }`}
            style={{
              shadowColor: '#facc15',
              shadowOpacity: 0.3,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 0 },
              elevation: 8,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#3c2f00" />
            ) : (
              <>
                <Text
                  className="text-on-primary"
                  style={{
                    fontFamily: 'Lexend_800ExtraBold',
                    fontSize: 15,
                    letterSpacing: 1.2,
                  }}
                >
                  START YOUR JOURNEY
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#3c2f00"
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </Pressable>

          <Text
            className="mt-8 text-center text-on-surface-variant/60"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 11, letterSpacing: 0.5 }}
          >
            Don't have a key? Contact your gym admin.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
