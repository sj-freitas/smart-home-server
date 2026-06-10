import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

const AUTH_API_KEY_SECRET = process.env.AUTH_API_KEY_SECRET!;
const ENCRYPTION_KEY = createHash("sha256").update(AUTH_API_KEY_SECRET).digest();
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_IV_LENGTH = 12;

export function hashApiKey(apiKey: string): string {
  return createHmac("sha256", AUTH_API_KEY_SECRET).update(apiKey).digest("hex");
}

export function generateApiKey(): string {
  return randomBytes(32).toString("base64");
}

export function verifyApiKey(providedKey: string, storedHash: string): boolean {
  const providedHash = hashApiKey(providedKey);

  return timingSafeEqual(
    Buffer.from(providedHash, "hex"),
    Buffer.from(storedHash, "hex"),
  );
}

/**
 * Generates a random opaque token, used for OAuth authorization codes,
 * access tokens, refresh tokens and dynamically registered client secrets.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hashes an opaque token using the same secret as the API keys, so it can be
 * safely persisted and looked up without storing the raw value.
 */
export function hashOpaqueToken(token: string): string {
  return createHmac("sha256", AUTH_API_KEY_SECRET).update(token).digest("hex");
}

/**
 * Encrypts a secret (e.g. a dynamically registered OAuth client secret) so it
 * can be stored at rest but still recovered, since OAuth client authentication
 * requires comparing the original value.
 */
export function encryptSecret(plainText: string): string {
  const iv = randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(encryptedText: string): string {
  const buffer = Buffer.from(encryptedText, "base64");
  const iv = buffer.subarray(0, ENCRYPTION_IV_LENGTH);
  const authTag = buffer.subarray(ENCRYPTION_IV_LENGTH, ENCRYPTION_IV_LENGTH + 16);
  const encrypted = buffer.subarray(ENCRYPTION_IV_LENGTH + 16);

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
