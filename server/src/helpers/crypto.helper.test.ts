// ENV must be set before the module is imported because AUTH_API_KEY_SECRET is
// captured at module load time.
process.env.AUTH_API_KEY_SECRET = 'test-secret-for-crypto-tests';

import { generateApiKey, hashApiKey, verifyApiKey } from './crypto.helper';

describe('generateApiKey', () => {
  it('returns a non-empty string', () => {
    expect(generateApiKey()).toBeTruthy();
  });

  it('returns a different value on each call', () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });

  it('returns a base64 encoded string of 32 random bytes (44 chars with padding)', () => {
    // 32 bytes -> 44 base64 chars (with potential padding)
    expect(generateApiKey()).toHaveLength(44);
  });
});

describe('hashApiKey', () => {
  it('returns a lowercase hex string', () => {
    expect(hashApiKey('any-key')).toMatch(/^[a-f0-9]+$/);
  });

  it('produces the same hash for the same input', () => {
    expect(hashApiKey('stable')).toBe(hashApiKey('stable'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashApiKey('key-a')).not.toBe(hashApiKey('key-b'));
  });
});

describe('verifyApiKey', () => {
  it('returns true when the provided key matches the stored hash', () => {
    const key = 'my-secret-api-key';
    const hash = hashApiKey(key);
    expect(verifyApiKey(key, hash)).toBe(true);
  });

  it('returns false when the provided key does not match the stored hash', () => {
    const hash = hashApiKey('correct-key');
    expect(verifyApiKey('wrong-key', hash)).toBe(false);
  });
});
