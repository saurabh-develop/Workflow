import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
  useRef,
} from "react";
import type { User } from "../types/auth.types";
import { authApi, setAccessToken, getAccessToken } from "../lib/api";

interface AuthContext {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (tokens: { accessToken: string; user: User }) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isInitialized, setInitialized] = useState(false);

  const login = useCallback(
    ({ accessToken, user }: { accessToken: string; user: User }) => {
      setAccessToken(accessToken);
      setUser(user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {}
    setAccessToken(null);
    setUser(null);
  }, []);

  const isAccessTokenExpired = useCallback((token: string) => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:8001"}/api/v1/auth/refresh`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      console.log("Refresh status:", res.status);

      if (!res.ok) {
        console.log("Refresh failed:", await res.json().catch(() => ({})));
        return;
      }
      const { accessToken, user } = await res.json();
      setAccessToken(accessToken);
      setUser(user);
    } catch (err) {
      console.log("Refresh threw:", err);
      setUser(null);
    }
  }, []);

  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (hasRefreshed.current) return;
    hasRefreshed.current = true;

    const token = getAccessToken();

    if (!token || isAccessTokenExpired(token)) {
      refresh().finally(() => setInitialized(true));
    } else {
      setInitialized(true);
    }

    setLoading(false);
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{
        user,
        isLoading: !isInitialized,
        isAuthenticated: !!user,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
