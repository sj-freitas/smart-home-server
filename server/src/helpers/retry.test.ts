import { withRetries, RetryError } from './retry';

jest.mock('./sleep', () => ({ sleep: jest.fn().mockResolvedValue(undefined) }));

describe('withRetries', () => {
  let sleep: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    sleep = require('./sleep').sleep;
  });

  it('returns result when function succeeds on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    await expect(withRetries(fn)()).resolves.toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries on failure and returns result on second attempt', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    await expect(withRetries(fn, 3)()).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws RetryError after all retries are exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetries(fn, 2)()).rejects.toBeInstanceOf(RetryError);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('RetryError carries all failures and total attempt count', async () => {
    const err = new Error('fail');
    const fn = jest.fn().mockRejectedValue(err);
    const caught = await withRetries(fn, 1)().catch((e: unknown) => e) as RetryError;
    expect(caught).toBeInstanceOf(RetryError);
    expect(caught.failures).toEqual([err, err]);
    expect(caught.attempts).toBe(2);
  });

  it('passes arguments through to the wrapped function', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    await withRetries(fn)('arg1', 42);
    expect(fn).toHaveBeenCalledWith('arg1', 42);
  });

  it('uses linear backoff by default', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error())
      .mockResolvedValue('ok');
    await withRetries(fn, 1, 500)();
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it('applies exponential backoff when enabled', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error())
      .mockRejectedValueOnce(new Error())
      .mockResolvedValue('ok');
    await withRetries(fn, 2, 100, true)();
    expect(sleep).toHaveBeenNthCalledWith(1, 100);  // 100 * 2^0
    expect(sleep).toHaveBeenNthCalledWith(2, 200);  // 100 * 2^1
  });
});
