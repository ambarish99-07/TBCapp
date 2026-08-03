import type { LoginRequest, User } from "@tbc/shared-types";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { adminClient, clearStoredToken, getStoredToken, storeToken } from "../api/adminClient.js";

interface AdminAuthValue {
  user: User | null;
  isLoading: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getStoredToken()) {
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await adminClient.get<{ user: User }>("/auth/me");
      setUser(data.user.role === "admin" ? data.user : null);
    } catch {
      clearStoredToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(async (payload: LoginRequest) => {
    const { data } = await adminClient.post<{ token: string; user: User }>("/auth/login", payload);
    if (data.user.role !== "admin") {
      throw new Error("This account does not have admin access");
    }
    storeToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  return <AdminAuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
