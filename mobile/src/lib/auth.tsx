import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { signOutOfGoogle } from './google';

const TOKEN_KEY = 'shunyascape.session';
const ONBOARDED_KEY = 'shunyascape.onboarded';

interface AuthState {
  ready: boolean;
  token: string | null;
  onboarded: boolean;
  /** Store the session the backend issued. */
  signIn: (token: string) => Promise<void>;
  /** Forget the session (and tell the backend, unless it already ended). */
  signOut: (opts?: { remote?: boolean }) => Promise<void>;
  finishOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Session token in the device's secure storage; remembered across launches. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(ONBOARDED_KEY)])
      .then(([t, o]) => {
        setToken(t);
        setOnboarded(o === '1');
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (t: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, t);
    setToken(t);
  }, []);

  const signOut = useCallback(
    async ({ remote = true } = {}) => {
      if (remote && token) await api.logout(token).catch(() => {});
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      await signOutOfGoogle();
      setToken(null);
    },
    [token],
  );

  const finishOnboarding = useCallback(async () => {
    await SecureStore.setItemAsync(ONBOARDED_KEY, '1').catch(() => {});
    setOnboarded(true);
  }, []);

  const value = useMemo(
    () => ({ ready, token, onboarded, signIn, signOut, finishOnboarding }),
    [ready, token, onboarded, signIn, signOut, finishOnboarding],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
