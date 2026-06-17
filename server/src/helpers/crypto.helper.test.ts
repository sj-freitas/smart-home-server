// ENV must be set before the module is imported because AUTH_API_KEY_SECRET is
// captured at module load time.
process.env.AUTH_API_KEY_SECRET = "test-secret-for-crypto-tests";

import {
  decryptSecret,
  encryptSecret,
  generateApiKey,
  generateOpaqueToken,
  hashApiKey,
  hashOpaqueToken,
  verifyApiKey,
} from "./crypto.helper";

describe("generateApiKey", () => {
  it("returns a non-empty string", () => {
    expect(generateApiKey()).toBeTruthy();
  });

  it("returns a different value on each call", () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });

  it("returns a base64 encoded string of 32 random bytes (44 chars with padding)", () => {
    // 32 bytes -> 44 base64 chars (with potential padding)
    expect(generateApiKey()).toHaveLength(44);
  });
});

describe("hashApiKey", () => {
  it("returns a lowercase hex string", () => {
    expect(hashApiKey("any-key")).toMatch(/^[a-f0-9]+$/);
  });

  it("produces the same hash for the same input", () => {
    expect(hashApiKey("stable")).toBe(hashApiKey("stable"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashApiKey("key-a")).not.toBe(hashApiKey("key-b"));
  });
});

describe("verifyApiKey", () => {
  it("returns true when the provided key matches the stored hash", () => {
    const key = "my-secret-api-key";
    const hash = hashApiKey(key);
    expect(verifyApiKey(key, hash)).toBe(true);
  });

  it("returns false when the provided key does not match the stored hash", () => {
    const hash = hashApiKey("correct-key");
    expect(verifyApiKey("wrong-key", hash)).toBe(false);
  });
});

describe("generateOpaqueToken", () => {
  it("returns a non-empty string", () => {
    expect(generateOpaqueToken()).toBeTruthy();
  });

  it("returns a different value on each call", () => {
    expect(generateOpaqueToken()).not.toBe(generateOpaqueToken());
  });

  it("returns a base64url encoded string with no padding characters", () => {
    expect(generateOpaqueToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hashOpaqueToken", () => {
  it("returns a lowercase hex string", () => {
    expect(hashOpaqueToken("any-token")).toMatch(/^[a-f0-9]+$/);
  });

  it("produces the same hash for the same input", () => {
    expect(hashOpaqueToken("stable")).toBe(hashOpaqueToken("stable"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashOpaqueToken("token-a")).not.toBe(hashOpaqueToken("token-b"));
  });
});

describe("encryptSecret/decryptSecret", () => {
  it("decrypts back to the original plaintext", () => {
    const plainText = "super-secret-client-secret";
    const encrypted = encryptSecret(plainText);
    expect(decryptSecret(encrypted)).toBe(plainText);
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    const plainText = "super-secret-client-secret";
    expect(encryptSecret(plainText)).not.toBe(encryptSecret(plainText));
  });

  it("throws when the ciphertext has been tampered with", () => {
    const encrypted = encryptSecret("super-secret-client-secret");
    const tampered = Buffer.from(encrypted, "base64");
    tampered[tampered.length - 1] ^= 0xff;

    expect(() => decryptSecret(tampered.toString("base64"))).toThrow();
  });
});
