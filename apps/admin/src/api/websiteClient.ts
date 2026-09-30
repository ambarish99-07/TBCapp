import axios from "axios";

// The Lickyeat website (D:\Lickyeat website) is a completely separate pnpm workspace — no shared
// @lickyeat/shared-types package to import here, so this is a deliberately minimal hand-written
// type covering only the one endpoint this client calls.
interface WebsiteLoginResponse {
  token: string;
  user: { role: string };
}

// Dev default matches the website's apps/api dev port (4100) — see that project's AGENT.md.
const websiteApiBaseUrl = import.meta.env.VITE_WEBSITE_API_BASE_URL ?? "http://localhost:4100";

const websiteClient = axios.create({ baseURL: websiteApiBaseUrl });

export type WebsiteLoginResult = { ok: true; token: string } | { ok: false };

/**
 * Logs into the website's own (entirely separate) backend using the same credentials just used
 * for the app admin login, so the "Manage the website" button can hand off an already-authenticated
 * session instead of asking for the password a second time. Never throws — a website-side failure
 * (wrong/out-of-sync password, website API unreachable, not an admin there) must never break the
 * primary app login this runs alongside.
 */
export async function loginToWebsite(identifier: string, password: string): Promise<WebsiteLoginResult> {
  try {
    const { data } = await websiteClient.post<WebsiteLoginResponse>("/auth/login", { identifier, password });
    if (data.user.role !== "admin") return { ok: false };
    return { ok: true, token: data.token };
  } catch {
    return { ok: false };
  }
}
