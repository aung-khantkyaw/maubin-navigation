export type StorageKeyConfig = {
  token: string;
  user: string;
};

type AuthPayload<UserShape> = {
  token: string | null;
  user: UserShape | null;
};

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function safeParseJSON<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("Failed to parse JSON", error);
    return fallback;
  }
}

export function getStoredAuth<UserShape = Record<string, unknown>>(
  keys: StorageKeyConfig
): AuthPayload<UserShape> {
  if (!isBrowser()) {
    return { token: null, user: null };
  }

  const token = window.localStorage.getItem(keys.token);
  const user = safeParseJSON<UserShape | null>(
    window.localStorage.getItem(keys.user),
    null
  );

  return { token, user };
}

export function persistAuth<UserShape = Record<string, unknown>>(
  keys: StorageKeyConfig,
  token: string | null,
  user: UserShape | null
) {
  if (!isBrowser()) return;

  if (token) {
    window.localStorage.setItem(keys.token, token);
  } else {
    window.localStorage.removeItem(keys.token);
  }

  if (user) {
    window.localStorage.setItem(keys.user, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(keys.user);
  }

  window.dispatchEvent(new Event("user-auth-changed"));
}

export function clearStoredAuth(keys: StorageKeyConfig) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(keys.token);
  window.localStorage.removeItem(keys.user);
  window.dispatchEvent(new Event("user-auth-changed"));
}
