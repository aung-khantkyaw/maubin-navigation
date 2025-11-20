import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { STORAGE_KEYS } from "@/utils/constants";
import {
  clearStoredAuth,
  getStoredAuth,
  persistAuth,
  type StorageKeyConfig,
} from "@/utils/helpers";

export type AuthUser = {
  id?: string;
  user_id?: string;
  username?: string;
  email?: string;
  role?: string;
  user_type?: string;
  is_admin?: boolean;
  [key: string]: unknown;
} | null;

type AuthContextValue = {
  token: string | null;
  user: AuthUser;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCollaborator: boolean;
  login: (token: string | null, user: AuthUser) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export { AuthContext };

function resolveRoles(user: AuthUser) {
  const roleCandidates = [
    user?.role,
    user?.user_type,
    Array.isArray(user?.roles) ? user?.roles?.[0] : null,
  ];

  const normalized = roleCandidates
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());

  return {
    isAdmin: Boolean(user?.is_admin) || normalized.includes("admin"),
    isCollaborator: normalized.includes("collaborator"),
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const keys = useMemo<StorageKeyConfig>(
    () => ({ token: STORAGE_KEYS.token, user: STORAGE_KEYS.user }),
    []
  );

  const readAuth = useCallback(() => getStoredAuth<AuthUser>(keys), [keys]);

  const [{ token, user }, setAuthState] = useState(readAuth);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleChange = () => {
      setLoading(true);
      setAuthState(readAuth());
      setLoading(false);
    };

    window.addEventListener("storage", handleChange);
    window.addEventListener("user-auth-changed", handleChange);
    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener("user-auth-changed", handleChange);
    };
  }, [readAuth]);

  const login = useCallback(
    (nextToken: string | null, nextUser: AuthUser) => {
      persistAuth(keys, nextToken, nextUser);
      setAuthState({ token: nextToken, user: nextUser ?? null });
    },
    [keys]
  );

  const logout = useCallback(() => {
    clearStoredAuth(keys);
    setAuthState({ token: null, user: null });
  }, [keys]);

  const setUser = useCallback(
    (nextUser: AuthUser) => {
      persistAuth(keys, token, nextUser);
      setAuthState((prev) => ({ token: prev.token, user: nextUser ?? null }));
    },
    [keys, token]
  );

  const { isAdmin, isCollaborator } = useMemo(() => resolveRoles(user), [user]);

  const value = useMemo<AuthContextValue>(() => {
    const isAuthenticated = Boolean(token);

    return {
      token,
      user,
      loading,
      isAuthenticated,
      isAdmin,
      isCollaborator,
      login,
      logout,
      setUser,
    };
  }, [token, user, loading, isAdmin, isCollaborator, login, logout, setUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
