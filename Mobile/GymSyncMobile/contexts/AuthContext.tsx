import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as ApiModule from '@/lib/api';
import { chatConnection } from '@/lib/chat-connection';
import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from '@/lib/secure-storage';

const TOKEN_KEY = 'gymsync.token';
const USER_KEY = 'gymsync.user';

type User = ApiModule.UserDto;

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithKey: (accessKey: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await getSecureItem(TOKEN_KEY);
        const savedUser = await getSecureItem(USER_KEY);
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          ApiModule.setAuthToken(savedToken);
          chatConnection.start(savedToken).catch((e) =>
            console.warn('chat connect (restore) failed', e),
          );
        }
      } catch (err) {
        console.warn('Failed to restore session', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await ApiModule.login({ email, password });
    ApiModule.setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
    await setSecureItem(TOKEN_KEY, res.token);
    await setSecureItem(USER_KEY, JSON.stringify(res.user));
    chatConnection.start(res.token).catch((e) =>
      console.warn('chat connect (signIn) failed', e),
    );
  }, []);

  const signInWithKey = useCallback(async (accessKey: string) => {
    const res = await ApiModule.loginWithKey({ accessKey });
    ApiModule.setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
    await setSecureItem(TOKEN_KEY, res.token);
    await setSecureItem(USER_KEY, JSON.stringify(res.user));
    chatConnection.start(res.token).catch((e) =>
      console.warn('chat connect (signInWithKey) failed', e),
    );
  }, []);

  const signOut = useCallback(async () => {
    await chatConnection.stop();
    ApiModule.setAuthToken(null);
    setToken(null);
    setUser(null);
    await deleteSecureItem(TOKEN_KEY);
    await deleteSecureItem(USER_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await ApiModule.getCurrentUser();
      setUser(fresh);
      await setSecureItem(USER_KEY, JSON.stringify(fresh));
    } catch (err) {
      // Non-fatal: keep the cached user. Surface the error for debugging.
      console.warn('refreshUser failed', err);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!token,
      signIn,
      signInWithKey,
      signOut,
      refreshUser,
    }),
    [user, token, isLoading, signIn, signInWithKey, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
