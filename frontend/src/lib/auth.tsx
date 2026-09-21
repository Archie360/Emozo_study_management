"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Reads a browser-only external source (localStorage) that isn't
  // available during SSR, so this genuinely can't run before mount — the
  // resulting extra render is the deliberate two-phase (loading -> ready)
  // pattern `loading` exists for, not an accidental cascade.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const raw = window.localStorage.getItem("user");
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        window.localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const login = useCallback(
    async (email: string) => {
      const { token, user } = await api.post<{ token: string; user: User }>("/auth/dev-login", {
        email,
      });
      window.localStorage.setItem("token", token);
      window.localStorage.setItem("user", JSON.stringify(user));
      setUser(user);
      router.push("/dashboard");
    },
    [router]
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("user");
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
