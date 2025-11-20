import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "@/utils/constants";
import { useAuth } from "./useAuth";

type UseFetchOptions<T> = {
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
  immediate?: boolean;
  skip?: boolean;
  dependencies?: unknown[];
  parser?: (response: Response) => Promise<T>;
};

type UseFetchState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (override?: RequestInit) => Promise<T | null>;
  reset: () => void;
};

const defaultParser = async <T,>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
};

export function useFetch<T = unknown>(
  path: string,
  options: UseFetchOptions<T> = {}
): UseFetchState<T> {
  const { token } = useAuth();
  const {
    method = "GET",
    body = null,
    headers,
    immediate = true,
    skip = false,
    dependencies: dependenciesOverride = [],
    parser = defaultParser<T>,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate && !skip);
  const [error, setError] = useState<Error | null>(null);

  const baseHeaders = useMemo(() => {
    const result = new Headers(headers);
    if (token) {
      result.set("Authorization", `Bearer ${token}`);
    }
    if (body && !(body instanceof FormData) && !result.has("Content-Type")) {
      result.set("Content-Type", "application/json");
    }
    return result;
  }, [headers, token, body]);

  const execute = useCallback(
    async (override: RequestInit = {}) => {
      setLoading(true);
      setError(null);

      try {
        const requestHeaders = new Headers(baseHeaders);
        if (override.headers) {
          new Headers(override.headers).forEach((value, key) => {
            requestHeaders.set(key, value);
          });
        }

        const requestInit: RequestInit = {
          method,
          body,
          ...override,
          headers: requestHeaders,
        };

        const response = await fetch(`${API_BASE_URL}${path}`, requestInit);
        if (!response.ok) {
          const message = `${response.status} ${response.statusText}`;
          throw new Error(message);
        }

        const parsed = await parser(response);
        setData(parsed);
        return parsed;
      } catch (fetchError) {
        const fallbackError =
          fetchError instanceof Error
            ? fetchError
            : new Error("Request failed");
        setError(fallbackError);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [baseHeaders, body, method, parser, path]
  );

  const watchDependencies = useMemo(
    () => (Array.isArray(dependenciesOverride) ? dependenciesOverride : []),
    [dependenciesOverride]
  );

  useEffect(() => {
    if (skip || !immediate) return;
    void execute();
  }, [execute, skip, immediate, watchDependencies]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}
