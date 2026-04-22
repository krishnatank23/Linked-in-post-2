import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type AuthUser = {
  id: number;
  unique_id: string;
  username: string;
  email?: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
};

const TOKEN_KEY = 'postpilot_token';
const USER_KEY = 'postpilot_user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredAuth() {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }

  const token = localStorage.getItem(TOKEN_KEY);
  const storedUser = localStorage.getItem(USER_KEY);

  let user: AuthUser | null = null;
  if (storedUser) {
    try {
      user = JSON.parse(storedUser) as AuthUser;
    } catch {
      user = null;
    }
  }

  return { token, user };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initial = readStoredAuth();
  const [token, setToken] = useState<string | null>(initial.token);
  const [user, setUser] = useState<AuthUser | null>(initial.user);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = readStoredAuth();
    setToken(next.token);
    setUser(next.user);
    setHydrated(true);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    token,
    user,
    hydrated,
    login: (nextToken, nextUser) => {
      setToken(nextToken);
      setUser(nextUser);
      localStorage.setItem(TOKEN_KEY, nextToken);
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    },
    logout: () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  }), [token, user, hydrated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
