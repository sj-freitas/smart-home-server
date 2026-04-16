import { AuthorizationHeaderVerificationService } from "./authorization-header-verification.service";
import { RequestContext } from "../request-context";

function makeService(authorizationHeader: string | undefined) {
  const ctx = { authorizationHeader } as Partial<RequestContext> as RequestContext;
  return new AuthorizationHeaderVerificationService(ctx);
}

describe("AuthorizationHeaderVerificationService.getBearerTokenValue", () => {
  it("returns null when there is no Authorization header", () => {
    expect(makeService(undefined).getBearerTokenValue()).toBeNull();
  });

  it("returns null for an empty Authorization header", () => {
    expect(makeService("").getBearerTokenValue()).toBeNull();
  });

  it("returns the token for a valid Bearer header", () => {
    expect(makeService("Bearer my-secret-token").getBearerTokenValue()).toBe(
      "my-secret-token",
    );
  });

  it("is case-insensitive for the Bearer scheme", () => {
    expect(makeService("bearer my-secret-token").getBearerTokenValue()).toBe(
      "my-secret-token",
    );
    expect(makeService("BEARER my-secret-token").getBearerTokenValue()).toBe(
      "my-secret-token",
    );
  });

  it("returns null when the scheme is not Bearer", () => {
    expect(makeService("Basic dXNlcjpwYXNz").getBearerTokenValue()).toBeNull();
  });

  it("returns null when the token part is missing", () => {
    expect(makeService("Bearer").getBearerTokenValue()).toBeNull();
  });
});
