import type {
  LoginRequest,
  RequestOtpRequest,
  SignupRequest,
  UpdateProfileRequest,
  User,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from "@tbc/shared-types";
import { apiClient } from "./client";

interface AuthResponse {
  token: string;
  user: User;
}

export async function signupRequest(payload: SignupRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/signup", payload);
  return data;
}

export async function loginRequest(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
  return data;
}

export async function requestOtpRequest(payload: RequestOtpRequest): Promise<{ sent: boolean }> {
  const { data } = await apiClient.post<{ sent: boolean }>("/auth/otp/request", payload);
  return data;
}

/** Returns either `{ requiresName: true }` (verified, new number) or `{ token, user }` (logged in). */
export async function verifyOtpRequest(payload: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  const { data } = await apiClient.post<VerifyOtpResponse>("/auth/otp/verify", payload);
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>("/auth/me");
  return data.user;
}

export async function updateProfileRequest(payload: UpdateProfileRequest): Promise<User> {
  const { data } = await apiClient.patch<{ user: User }>("/auth/me", payload);
  return data.user;
}
