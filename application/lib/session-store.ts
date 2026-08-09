import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type { SessionStore } from "next-session";

const dbPath = path.resolve(process.cwd(), "data", "sessions.db");
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

type StoreSession = Parameters<SessionStore["set"]>[1];

export function purgeExpiredSessions(now = Date.now()) {
  return db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now)
    .changes;
}

export function purgeLegacySessionMetadata() {
  const rows = db.prepare("SELECT sid, data FROM sessions").all() as Array<{
    sid: string;
    data: string;
  }>;
  const update = db.prepare("UPDATE sessions SET data = ? WHERE sid = ?");

  return db.transaction(() => {
    let sanitized = 0;

    for (const row of rows) {
      let session: Record<string, unknown>;

      try {
        session = JSON.parse(row.data) as Record<string, unknown>;
      } catch {
        continue;
      }

      const hadIpAddress = Object.hasOwn(session, "ipAddress");
      const hadUserAgent = Object.hasOwn(session, "userAgent");

      if (!hadIpAddress && !hadUserAgent) continue;

      delete session.ipAddress;
      delete session.userAgent;
      update.run(JSON.stringify(session), row.sid);
      sanitized += 1;
    }

    return sanitized;
  })();
}

function getExpiresAt(session: StoreSession): number {
  const cookie = session.cookie;

  if (cookie?.expires) {
    return new Date(cookie.expires).getTime();
  }

  return Date.now() + 1000 * 60 * 60 * 24 * 30;
}

export class SqliteSessionStore implements SessionStore {
  async get(sid: string) {
    const row = db
      .prepare("SELECT data, expires_at FROM sessions WHERE sid = ?")
      .get(sid) as
      | { data: string; expires_at: number }
      | undefined;

    if (!row) return null;

    if (row.expires_at <= Date.now()) {
      db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      return null;
    }

    return JSON.parse(row.data);
  }

  async set(sid: string, session: StoreSession) {
    const expiresAt = getExpiresAt(session);
    const updatedAt = Date.now();

    db.prepare(
      `INSERT INTO sessions (sid, data, expires_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET
         data = excluded.data,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
    ).run(sid, JSON.stringify(session), expiresAt, updatedAt);
  }

  async destroy(sid: string) {
    db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
  }

  async touch(sid: string, session: StoreSession) {
    const expiresAt = getExpiresAt(session);
    const updatedAt = Date.now();

    db.prepare(
      "UPDATE sessions SET expires_at = ?, updated_at = ? WHERE sid = ?",
    ).run(expiresAt, updatedAt, sid);
  }
}
