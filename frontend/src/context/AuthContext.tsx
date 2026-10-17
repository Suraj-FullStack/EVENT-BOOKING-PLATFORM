"use client";

/**
 * Holds the signed-in user for the whole app.
 *
 * On first mount we call /api/auth/me - the HttpOnly cookie is what actually
 * keeps the session alive across refreshes, this context just caches the
 * result so pages don't each re-fetch it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, authApi } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  /** True until the initial /me request has settled. */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    () =>
      authApi
        .me()
        .then((u) => setUser(u))
        .catch((err: unknown) => {
          // 401 just means "not logged in" - anything else we also treat as
          // logged-out but let the console know.
          if (!(err instanceof ApiError && err.status === 401)) console.warn("auth refresh failed", err);
          setUser(null);
        })
        .finally(() => setLoading(false)),
    [],
  );

  // Initial session check. State updates happen inside the promise
  // callbacks, i.e. asynchronously, so there's no synchronous setState here.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await authApi.login({ email, password });
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user } = await authApi.register({ name, email, password });
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
