import type { AuthUser } from "@/context/AuthContext";
import { api } from "./api";
import { STORAGE_KEYS } from "@/utils/constants";
import {
  clearStoredAuth,
  getStoredAuth,
  persistAuth,
  type StorageKeyConfig,
} from "@/utils/helpers";

type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  is_success?: boolean;
  access_token?: string;
  user?: AuthUser;
  msg?: string;
  error?: string;
};

const storageConfig: StorageKeyConfig = {
  token: STORAGE_KEYS.token,
  user: STORAGE_KEYS.user,
};

export async function login(payload: LoginPayload) {
  const response = await api.post<LoginResponse>("/login", payload, {
    skipAuth: true,
  });

  if (!response?.is_success || !response?.access_token) {
    const message = response?.msg || response?.error || "Login failed";
    throw new Error(message);
  }

  persistAuth(storageConfig, response.access_token, response.user ?? null);
  return response;
}

export function logout() {
  clearStoredAuth(storageConfig);
}

export function getCurrentUser() {
  return getStoredAuth<AuthUser>(storageConfig).user;
}

export function getCurrentToken() {
  return getStoredAuth<AuthUser>(storageConfig).token;
}
