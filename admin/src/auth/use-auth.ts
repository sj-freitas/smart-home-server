import { useCallback, useEffect, useState } from "react";

export type AuthState =
  | "Checking"
  | "Authorized"
  | "Forbidden";

export type UseAuthReturnType = {
  authState: AuthState;
  logout: () => Promise<void>;
};

export function useAuth(): UseAuthReturnType {
  const [authState, setAuthState] = useState<AuthState>("Checking");

  useEffect(() => {
    if (authState !== "Checking") return;

    fetch("/api/auth/check", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => {
        if (res.status === 200) {
          setAuthState("Authorized");
        } else if (res.status === 403) {
          setAuthState("Forbidden");
        } else {
          // 401 → not logged in → send to main app which owns the login flow
          window.location.href = "/";
        }
      })
      .catch(() => {
        // Network error — treat as unauthenticated
        window.location.href = "/";
      });
  }, [authState]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/google/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // best-effort
    } finally {
      window.location.href = "/";
    }
  }, []);

  return { authState, logout };
}
