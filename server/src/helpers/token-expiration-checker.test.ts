import { isTokenActive } from './token-expiration-checker';

describe('isTokenActive', () => {
  const now = 1_000_000;

  it('returns true when the token has not yet expired', () => {
    const expiration = now + 120_000; // expires 2 min from now
    expect(isTokenActive(expiration, 60_000, now)).toBe(true);
  });

  it('returns false when now is after expiration minus grace period', () => {
    const expiration = now + 30_000; // expires in 30s, grace period is 60s
    expect(isTokenActive(expiration, 60_000, now)).toBe(false);
  });

  it('returns false when token is already expired', () => {
    const expiration = now - 1_000;
    expect(isTokenActive(expiration, 0, now)).toBe(false);
  });

  it('uses a default grace period of 60 000 ms when not specified', () => {
    const exactlyAtGraceEdge = now + 60_000;
    // now < expiration - 60_000  =>  now < now  => false
    expect(isTokenActive(exactlyAtGraceEdge, undefined, now)).toBe(false);
  });

  it('uses Date.now() by default for the current time', () => {
    const futureExpiration = Date.now() + 600_000;
    expect(isTokenActive(futureExpiration)).toBe(true);
  });
});
