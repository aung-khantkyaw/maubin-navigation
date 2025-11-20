import { API_BASE_URL, STORAGE_KEYS } from "@/utils/constants";
import { getStoredAuth, type StorageKeyConfig } from "@/utils/helpers";

type ApiRequestOptions = RequestInit & {
  token?: string | null;
  skipAuth?: boolean;
};

const storageConfig: StorageKeyConfig = {
  token: STORAGE_KEYS.token,
  user: STORAGE_KEYS.user,
};

function resolveToken(explicitToken: string | null | undefined) {
  if (explicitToken != null) {
    return explicitToken;
  }
  const { token } = getStoredAuth(storageConfig);
  return token;
}

export async function apiRequest<T>(
  path: string,
  { token, skipAuth = false, headers, ...rest }: ApiRequestOptions = {}
): Promise<T> {
  const resolvedToken = skipAuth ? null : resolveToken(token ?? null);
  const requestHeaders = new Headers(headers);

  if (resolvedToken) {
    requestHeaders.set("Authorization", `Bearer ${resolvedToken}`);
  }

  if (
    rest.body &&
    !(rest.body instanceof FormData) &&
    !requestHeaders.has("Content-Type")
  ) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: requestHeaders,
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function extractErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { msg?: string; error?: string };
    return body.msg || body.error || response.statusText;
  } catch (error) {
    console.warn("Failed to parse error response", error);
    return response.statusText;
  }
}

export const api = {
  get: <T,>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T,>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  put: <T,>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  patch: <T,>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  delete: <T,>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};
