export async function startScheduler<T>(
  fn: () => Promise<T>,
  intervalInMilliseconds: number,
): Promise<T> {
  // Run immediately
  const firstRun = await fn();
  // Schedule future runs
  setInterval(() => {
    // An unhandled rejection here would take the whole process down.
    fn().catch((err) => {
      console.error("Scheduled task failed, will retry on next run:", err);
    });
  }, intervalInMilliseconds);

  return firstRun;
}
