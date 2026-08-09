import { purgeExpiredGiveData } from "./give-store";
import { purgeExpiredAskData } from "./message-store";
import {
  purgeExpiredSessions,
  purgeLegacySessionMetadata,
} from "./session-store";

export const DATA_RETENTION_DAYS = 30;

const RETENTION_INTERVAL_MS = 60 * 60 * 1000;
const DATA_RETENTION_MS = DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000;

let retentionTimer: NodeJS.Timeout | null = null;

function runCleanupSafely() {
  try {
    runDataRetentionCleanup();
  } catch {
    console.error("Scheduled data retention cleanup failed.");
  }
}

export function runDataRetentionCleanup(now = Date.now()) {
  const cutoff = now - DATA_RETENTION_MS;

  return {
    sanitizedSessions: purgeLegacySessionMetadata(),
    sessions: purgeExpiredSessions(now),
    askLinks: purgeExpiredAskData(cutoff),
    giveLinks: purgeExpiredGiveData(cutoff),
  };
}

export function startDataRetentionScheduler() {
  if (retentionTimer) return;

  runCleanupSafely();

  retentionTimer = setInterval(runCleanupSafely, RETENTION_INTERVAL_MS);

  retentionTimer.unref();
}
