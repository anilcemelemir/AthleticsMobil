import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { NotificationBell } from '@/components/NotificationBell';

type HeaderAction = React.ReactNode;

interface AthletixHeaderProps {
  left?: HeaderAction;
  right?: HeaderAction;
  onBack?: () => void;
  /** Hide the auto-rendered notification bell (e.g. on the login screen). */
  hideNotifications?: boolean;
}

export function AthletixHeader({ left, right, onBack, hideNotifications }: AthletixHeaderProps) {
  const leftContent =
    left ??
    (onBack ? (
      <Pressable
        onPress={onBack}
        className="h-10 w-10 items-center justify-center rounded-sm active:bg-surface-container-high"
      >
        <Ionicons name="chevron-back" size={22} color="#ebe2d0" />
      </Pressable>
    ) : (
      <View className="h-10 w-10" />
    ));

  return (
    <View className="h-16 flex-row items-center border-b border-outline-variant bg-surface-container-lowest px-5">
      <View className="w-12 items-start">{leftContent}</View>
      <View className="flex-1 flex-row items-center justify-center gap-2">
        <Ionicons name="flash" size={18} color="#facc15" />
        <Text
          className="text-on-background"
          style={{ fontFamily: 'Lexend_900Black', fontSize: 18, letterSpacing: 0.8 }}
        >
          Athletix
        </Text>
      </View>
      <View className="min-w-12 flex-row items-center justify-end gap-1">
        {!hideNotifications && <NotificationBell />}
        {right}
      </View>
    </View>
  );
}
