import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildGoogleAuthUrl, deleteCookie } from "./use-auth";

describe("buildGoogleAuthUrl", () => {
  const CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  const REDIRECT_URI = "http://localhost:3001/api/auth/google/callback";

  it("returns a URL pointing at the Google OAuth v2 endpoint", () => {
    const url = buildGoogleAuthUrl(CLIENT_ID, REDIRECT_URI);
    expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
  });

  it("includes client_id in the query string", () => {
    const url = buildGoogleAuthUrl(CLIENT_ID, REDIRECT_URI);
    expect(url).toContain(`client_id=${encodeURIComponent(CLIENT_ID)}`);
  });

  it("includes redirect_uri in the query string", () => {
    const url = buildGoogleAuthUrl(CLIENT_ID, REDIRECT_URI);
    expect(url).toContain(
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
    );
  });

  it("sets response_type to code", () => {
    const url = buildGoogleAuthUrl(CLIENT_ID, REDIRECT_URI);
    expect(url).toContain("response_type=code");
  });

  it("requests offline access", () => {
    const url = buildGoogleAuthUrl(CLIENT_ID, REDIRECT_URI);
    expect(url).toContain("access_type=offline");
  });

  it("includes default scopes (openid, email, profile)", () => {
    const url = buildGoogleAuthUrl(CLIENT_ID, REDIRECT_URI);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("openid");
    expect(decoded).toContain("email");
    expect(decoded).toContain("profile");
  });

  it("accepts custom scopes", () => {
    const url = buildGoogleAuthUrl(CLIENT_ID, REDIRECT_URI, ["openid", "email"]);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("openid");
    expect(decoded).toContain("email");
    expect(decoded).not.toContain("profile");
  });

  it("includes a random state parameter", () => {
    const url1 = buildGoogleAuthUrl(CLIENT_ID, REDIRECT_URI);
    const url2 = buildGoogleAuthUrl(CLIENT_ID, REDIRECT_URI);
    const state1 = new URL(url1).searchParams.get("state");
    const state2 = new URL(url2).searchParams.get("state");
    expect(state1).not.toBeNull();
    expect(state2).not.toBeNull();
    expect(state1).not.toBe(state2);
  });
});

describe("deleteCookie", () => {
  const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;

  afterEach(() => {
    Object.defineProperty(document, "cookie", originalCookie);
  });

  it("sets Max-Age=0 for the named cookie to clear it", () => {
    const written: string[] = [];
    Object.defineProperty(document, "cookie", {
      set: (val: string) => written.push(val),
      get: () => "",
      configurable: true,
    });

    deleteCookie("session");

    expect(written).toHaveLength(1);
    expect(written[0]).toContain("session=");
    expect(written[0]).toContain("Max-Age=0");
  });

  it("includes the path in the deletion directive", () => {
    const written: string[] = [];
    Object.defineProperty(document, "cookie", {
      set: (val: string) => written.push(val),
      get: () => "",
      configurable: true,
    });

    deleteCookie("session", "/api");

    expect(written[0]).toContain("path=/api");
  });

  it("uses lowercase 'session' — matching the server-set cookie name", () => {
    const written: string[] = [];
    Object.defineProperty(document, "cookie", {
      set: (val: string) => written.push(val),
      get: () => "",
      configurable: true,
    });

    deleteCookie("session");

    // Specifically guard against the historical 'Session' (capital S) bug
    expect(written[0]).toMatch(/^session=/);
  });
});
