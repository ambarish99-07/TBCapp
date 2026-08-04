import type { LoginRequest, SignupRequest, User } from "@tbc/shared-types";
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

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>("/auth/me");
  return data.user;
}
