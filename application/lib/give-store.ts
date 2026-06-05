import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { EventEmitter } from "events";

const dbPath = path.resolve(process.cwd(), "data", "sessions.db");
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

const giveEmitters = new Map<string, EventEmitter>();

db.exec(`
  CREATE TABLE IF NOT EXISTS give_links (
    id TEXT PRIMARY KEY,
    owner_sid TEXT NOT NULL,
    max_reads INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS give_messages (
    link_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS give_access_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT NOT NULL,
    accessed_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS give_read_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT NOT NULL,
    read_at INTEGER NOT NULL
  );
`);

export function getOwnerGiveLink(ownerSid: string) {
  const row = db
    .prepare(
      "SELECT id, owner_sid, max_reads, created_at FROM give_links WHERE owner_sid = ?",
    )
    .get(ownerSid) as
    | {
        id: string;
        owner_sid: string;
        max_reads: number;
        created_at: number;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    ownerSid: row.owner_sid,
    maxReads: row.max_reads,
    createdAt: row.created_at,
  };
}

export function getGiveLink(linkId: string) {
  const row = db
    .prepare(
      "SELECT id, owner_sid, max_reads, created_at FROM give_links WHERE id = ?",
    )
    .get(linkId) as
    | {
        id: string;
        owner_sid: string;
        max_reads: number;
        created_at: number;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    ownerSid: row.owner_sid,
    maxReads: row.max_reads,
    createdAt: row.created_at,
  };
}

export function getGiveMessage(linkId: string) {
  const row = db
    .prepare("SELECT content, created_at FROM give_messages WHERE link_id = ?")
    .get(linkId) as { content: string; created_at: number } | undefined;

  if (!row) return null;

  return {
    content: row.content,
    createdAt: row.created_at,
  };
}

export function getGiveStats(linkId: string) {
  const accessRow = db
    .prepare("SELECT COUNT(*) AS count FROM give_access_events WHERE link_id = ?")
    .get(linkId) as { count: number } | undefined;

  const readRow = db
    .prepare("SELECT COUNT(*) AS count FROM give_read_events WHERE link_id = ?")
    .get(linkId) as { count: number } | undefined;

  const link = getGiveLink(linkId);
  const maxReads = link?.maxReads ?? 0;
  const readCount = readRow?.count ?? 0;

  return {
    accessCount: accessRow?.count ?? 0,
    readCount,
    maxReads,
    remainingReads: Math.max(maxReads - readCount, 0),
  };
}

export function getGiveEmitter(linkId: string) {
  let emitter = giveEmitters.get(linkId);
  if (!emitter) {
    emitter = new EventEmitter();
    giveEmitters.set(linkId, emitter);
  }
  return emitter;
}

function emitGiveStats(linkId: string) {
  const emitter = getGiveEmitter(linkId);
  emitter.emit("stats", getGiveStats(linkId));
}

function deleteGiveLinkById(linkId: string) {
  emitGiveStats(linkId);
  db.prepare("DELETE FROM give_messages WHERE link_id = ?").run(linkId);
  db.prepare("DELETE FROM give_access_events WHERE link_id = ?").run(linkId);
  db.prepare("DELETE FROM give_read_events WHERE link_id = ?").run(linkId);
  db.prepare("DELETE FROM give_links WHERE id = ?").run(linkId);
  giveEmitters.delete(linkId);
}

export function createGiveLink(
  id: string,
  ownerSid: string,
  content: string,
  maxReads: number,
) {
  const now = Date.now();

  const existing = getOwnerGiveLink(ownerSid);
  if (existing) {
    deleteGiveLinkById(existing.id);
  }

  db.prepare(
    "INSERT INTO give_links (id, owner_sid, max_reads, created_at) VALUES (?, ?, ?, ?)",
  ).run(id, ownerSid, maxReads, now);

  db.prepare(
    "INSERT INTO give_messages (link_id, content, created_at) VALUES (?, ?, ?)",
  ).run(id, content, now);
}

export function deleteGiveLinkByOwner(ownerSid: string) {
  const existing = getOwnerGiveLink(ownerSid);
  if (!existing) return false;

  deleteGiveLinkById(existing.id);
  return true;
}

export function ownerCanManageGiveLink(linkId: string, ownerSid: string) {
  const link = getGiveLink(linkId);
  if (!link) return false;
  return link.ownerSid === ownerSid;
}

export function recordGiveAccess(linkId: string) {
  const now = Date.now();
  db.prepare(
    "INSERT INTO give_access_events (link_id, accessed_at) VALUES (?, ?)",
  ).run(linkId, now);
  emitGiveStats(linkId);
}

export function readGiveMessage(linkId: string) {
  const tx = db.transaction((targetLinkId: string) => {
    const link = getGiveLink(targetLinkId);
    if (!link) {
      return { ok: false as const, error: "not-found" as const };
    }

    const message = getGiveMessage(targetLinkId);
    if (!message) {
      return { ok: false as const, error: "not-found" as const };
    }

    const statsBefore = getGiveStats(targetLinkId);
    if (statsBefore.readCount >= link.maxReads) {
      return {
        ok: false as const,
        error: "limit-reached" as const,
        stats: statsBefore,
      };
    }

    const now = Date.now();
    db.prepare("INSERT INTO give_read_events (link_id, read_at) VALUES (?, ?)").run(
      targetLinkId,
      now,
    );

    const statsAfter = getGiveStats(targetLinkId);
    const deleted = statsAfter.remainingReads === 0;

    getGiveEmitter(targetLinkId).emit("stats", statsAfter);

    if (deleted) {
      db.prepare("DELETE FROM give_messages WHERE link_id = ?").run(targetLinkId);
    }

    return {
      ok: true as const,
      message,
      stats: statsAfter,
      deleted,
    };
  });

  return tx(linkId);
}
