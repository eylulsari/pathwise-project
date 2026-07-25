import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser } from '../types';
import { api, tokenStore } from '../services/api';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap: if we hold an access token, resolve the current user.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if (active) setUser(me);
      } catch {
        tokenStore.clear();
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
        isPremium: user?.subscriptionTier === 'premium',
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
