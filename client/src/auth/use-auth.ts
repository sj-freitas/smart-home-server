import { useCallback, useEffect, useState } from "react";

const DEFAULT_SCOPE = ["openid", "email", "profile"];
const GOOGLE_AUTH_V2_URL = "https://accounts.google.com/o/oauth2/v2";

type AuthenticationStates =
  | "AuthFullAccess"
  | "AuthRestricted"
  | "LoggingIn"
  | "NeedsLogIn"
  | "LoggedOut";

export function buildGoogleAuthUrl(
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

export function deleteCookie(name: string, path = "/") {
  document.cookie = `${name}=; Max-Age=0; path=${path}`;
}

export type UseAuthenticationReturnType = {
  appMode: AuthenticationStates;
  shouldRenderLogoutButton: boolean;
  logout: () => Promise<void>;
  startLogin: () => void;
};

export const useAuthentication = (): UseAuthenticationReturnType => {
  const API_BASE = `${import.meta.env.VITE_API_HOSTNAME}/auth`;
  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [appMode, setAppMode] = useState<AuthenticationStates>("LoggedOut");
  const [shouldRenderLogoutButton, setShouldRenderLogoutButton] =
    useState<boolean>(false);

  const runCheck = async () => {
    try {
      const res = await fetch(`${API_BASE}/check`, {
        method: "GET",
        credentials: "include",
        mode: "cors",
        cache: "no-store",
      });

      const text = await res.text().catch((err) => {
        console.error("Failed to read body as text", err);
        return null;
      });

      if (res.status === 200) {
        try {
          const body = text ? JSON.parse(text) : {};
          setAppMode("AuthFullAccess");
          setShouldRenderLogoutButton(body.shouldRenderLogoutButton);
          return;
        } catch (e) {
          console.error("JSON parse error for 200:", e);
          setAppMode("AuthRestricted");
          return;
        }
      }

      if (res.status === 403) {
        setAppMode("AuthRestricted");
        setShouldRenderLogoutButton(true);
        return;
      }

      if (res.status === 401) {
        setAppMode("NeedsLogIn");
        setShouldRenderLogoutButton(false);
        return;
      }

      console.warn(`Unexpected flow, status code is ${res.status}`);
      setAppMode("AuthRestricted");
    } catch (err) {
      console.error("Auth check error (caught):", err, err && (err as Error).stack);
      setAppMode("AuthRestricted");
    }
  };

  // Only check auth when in the logged-out state (initial mount or after logout).
  useEffect(() => {
    if (appMode !== "LoggedOut") return;
    runCheck();
  }, [appMode]);

  const startLogin = useCallback(() => {
    setAppMode("LoggingIn");
    const redirectUri = `${API_BASE}/google/callback`;
    const url = buildGoogleAuthUrl(CLIENT_ID, redirectUri);
    window.location.href = url;
  }, [API_BASE, CLIENT_ID]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/google/logout`, {
        method: "POST",
        credentials: "include",
      });

    } catch (e) {
      console.warn("logout failed", e);
    } finally {
      deleteCookie("session");
      setAppMode("LoggedOut");
    }
  }, [API_BASE]);

  return {
    appMode,
    shouldRenderLogoutButton,
    logout,
    startLogin,
  };
};
