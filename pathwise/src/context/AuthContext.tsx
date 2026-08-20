import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser } from '../types';
import { api, tokenStore } from '../services/api';
import { clearJournal } from '../utils/planJournal';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  register: (input: {
    name: string;
    email: string;
    password: string;
    nationality?: string;
    age?: number;
  }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isPremium: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_KEY = 'pathwise.user';
const cacheUser = (u: AuthUser | null) =>
  u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY);
const readCachedUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep the cached copy in sync so we can boot offline.
  const setUser = (u: AuthUser | null) => {
    cacheUser(u);
    setUserState(u);
  };

  // Bootstrap: if we hold an access token, resolve the current user. When
  // offline, hydrate from the cached user so the app still opens.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      if (!navigator.onLine) {
        if (active) setUserState(readCachedUser());
        if (active) setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if (active) setUser(me);
      } catch {
        // Network failure → keep the cached session; only a real 401 clears it
        // (the api layer already dropped tokens on a failed refresh).
        const cached = readCachedUser();
        if (cached && tokenStore.access) {
          if (active) setUserState(cached);
        } else {
          tokenStore.clear();
          cacheUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const register: AuthContextValue['register'] = async (input) => {
    const res = await api.register(input);
    setUser(res.user);
  };

  const login: AuthContextValue['login'] = async (input) => {
    const res = await api.login(input);
    setUser(res.user);
  };

  const logout: AuthContextValue['logout'] = async () => {
    await api.logout();
    // An unsent plan edit belongs to the session that made it. Leaving it
    // behind would let it be replayed into whoever signs in on this browser
    // next — the journal is keyed by user id, but there is no reason to keep
    // a stranger's plan on their machine either.
    clearJournal();
    setUser(null);
  };

  const refreshUser: AuthContextValue['refreshUser'] = async () => {
    try {
      setUser(await api.me());
    } catch {
      /* ignore — keep current user */
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
        login,
        logout,
        refreshUser,
        // Backend computes isPremium (paid tier OR active trial/reward window).
        isPremium: user?.isPremium ?? user?.subscriptionTier === 'premium',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
