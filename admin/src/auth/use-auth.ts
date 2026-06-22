import { useCallback, useEffect, useState } from "react";

const DEFAULT_SCOPE = ["openid", "email", "profile"];
const GOOGLE_AUTH_V2_URL = "https://accounts.google.com/o/oauth2/v2";

export type AuthState =
  | "LoggedOut"
  | "LoggingIn"
  | "NeedsLogIn"
  | "AuthFullAccess"
  | "AuthRestricted";

function buildGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  scope: string[] = DEFAULT_SCOPE,
) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scope.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: Math.random().toString(36).slice(2),
  });
  return `${GOOGLE_AUTH_V2_URL}/auth?${params.toString()}`;
}

function deleteCookie(name: string, path = "/") {
  document.cookie = `${name}=; Max-Age=0; path=${path}`;
}

export type UseAuthReturnType = {
  authState: AuthState;
  logout: () => Promise<void>;
  startLogin: () => void;
};

export function useAuth(): UseAuthReturnType {
  const API_BASE = `${import.meta.env.VITE_API_HOSTNAME}/api/auth`;
  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [authState, setAuthState] = useState<AuthState>("LoggedOut");

  useEffect(() => {
    if (authState !== "LoggedOut") return;

    fetch(`${API_BASE}/check`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.status === 200) {
          setAuthState("AuthFullAccess");
        } else if (res.status === 403) {
          setAuthState("AuthRestricted");
        } else if (res.status === 401) {
          setAuthState("NeedsLogIn");
        } else {
          setAuthState("AuthRestricted");
        }
      })
      .catch(() => {
        setAuthState("AuthRestricted");
      });
  }, [authState, API_BASE]);

  const startLogin = useCallback(() => {
    setAuthState("LoggingIn");
    const redirectUri = `${API_BASE}/google/callback`;
    window.location.href = buildGoogleAuthUrl(CLIENT_ID, redirectUri);
  }, [API_BASE, CLIENT_ID]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/google/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // best-effort logout
    } finally {
      deleteCookie("Session");
      setAuthState("LoggedOut");
    }
  }, [API_BASE]);

  return { authState, logout, startLogin };
}
