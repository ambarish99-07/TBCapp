import axios from "axios";

const TOKEN_KEY = "tbc_admin_token";

// Relative "/api" is the local-dev default — vite.config.ts's dev-server proxy rewrites it to
// http://localhost:4000. Once the admin dashboard is deployed standalone (not reverse-proxied
// alongside the API), set VITE_API_BASE_URL to the real deployed API's origin at build time.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const adminClient = axios.create({ baseURL: apiBaseUrl });

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

adminClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
