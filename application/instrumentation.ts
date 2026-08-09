export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startDataRetentionScheduler } = await import("./lib/data-retention");
  startDataRetentionScheduler();
}
