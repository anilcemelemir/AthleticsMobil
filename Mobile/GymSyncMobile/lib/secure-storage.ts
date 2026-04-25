import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Cross-platform secure storage.
 * expo-secure-store is native-only; on web we fall back to localStorage.
 */

async function webGet(key: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

async function webSet(key: string, value: string): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

async function webDelete(key: string): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webGet(key);
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') return webSet(key, value);
  return SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') return webDelete(key);
  return SecureStore.deleteItemAsync(key);
}
