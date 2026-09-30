import type { LoginRequest, User } from "@tbc/shared-types";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { adminClient, clearStoredToken, getStoredToken, storeToken } from "../api/adminClient.js";
import { loginToWebsite } from "../api/websiteClient.js";

export type WebsiteAuthStatus = "idle" | "ok" | "failed";

interface AdminAuthValue {
  user: User | null;
  isLoading: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  /** Hydrates a session from a token acquired elsewhere (the website's admin sidebar handoff),
   * instead of a fresh identifier+password login. Returns whether it succeeded. */
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => void;
  websiteAuthStatus: WebsiteAuthStatus;
  websiteToken: string | null;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [websiteAuthStatus, setWebsiteAuthStatus] = useState<WebsiteAuthStatus>("idle");
  const [websiteToken, setWebsiteToken] = useState<string | null>(null);

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

    // Best-effort, silent — a website-side failure (out-of-sync password, website API down,
    // not an admin there) must never surface as an app-login error. loginToWebsite() never throws.
    setWebsiteAuthStatus("idle");
    const websiteResult = await loginToWebsite(payload.identifier, payload.password);
    if (websiteResult.ok) {
      setWebsiteToken(websiteResult.token);
      setWebsiteAuthStatus("ok");
    } else {
      setWebsiteToken(null);
      setWebsiteAuthStatus("failed");
    }
  }, []);

  const loginWithToken = useCallback(async (token: string) => {
    storeToken(token);
    try {
      const { data } = await adminClient.get<{ user: User }>("/auth/me");
      if (data.user.role !== "admin") {
        clearStoredToken();
        return false;
      }
      setUser(data.user);
      return true;
    } catch {
      clearStoredToken();
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setWebsiteToken(null);
    setWebsiteAuthStatus("idle");
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{ user, isLoading, login, loginWithToken, logout, websiteAuthStatus, websiteToken }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
