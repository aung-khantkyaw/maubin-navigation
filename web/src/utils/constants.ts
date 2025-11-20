export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000";

export const STORAGE_KEYS = {
  token: "access_token",
  user: "user",
} as const;
