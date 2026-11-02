import { startScheduler } from "./scheduler";

describe("startScheduler", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  it("runs immediately and then on every interval", async () => {
    const fn = jest.fn().mockResolvedValue("ok");

    await expect(startScheduler(fn, 1000)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("keeps running when a scheduled run rejects", async () => {
    const fn = jest
      .fn()
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue("ok");

    await startScheduler(fn, 1000);
    await jest.advanceTimersByTimeAsync(2000);

    expect(fn).toHaveBeenCalledTimes(3);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
