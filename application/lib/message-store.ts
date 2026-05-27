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

db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    ownerSid TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT NOT NULL,
    content TEXT NOT NULL,
    poster_sid TEXT,
    created_at INTEGER NOT NULL
  );
`);

// Migrate: ensure messages.poster_sid column exists for older DBs
const msgInfo = db.prepare("PRAGMA table_info(messages)").all() as Array<{
  name: string;
}>;
if (!msgInfo.find((c) => c.name === "poster_sid")) {
  try {
    db.prepare("ALTER TABLE messages ADD COLUMN poster_sid TEXT").run();
  } catch (e) {
    // ignore if cannot alter (very old sqlite?)
  }
}

export function createLink(id: string, ownerSid: string) {
  const now = Date.now();

  //remove old link for this owner if exists
  const oldLink = getOldLink(ownerSid);
  if (oldLink) {
    db.prepare("DELETE FROM links WHERE id = ?").run(oldLink);
    db.prepare("DELETE FROM messages WHERE link_id = ?").run(oldLink);
  }

  db.prepare(
    "INSERT INTO links (id, ownerSid, created_at) VALUES (?, ?, ?)",
  ).run(id, ownerSid, now);
}

export function getLinkOwner(id: string) {
  const row = db.prepare("SELECT ownerSid FROM links WHERE id = ?").get(id) as
    | { ownerSid: string }
    | undefined;
  return row?.ownerSid ?? null;
}

// In-memory emitters for Server-Sent Events per link
const emitters = new Map<string, EventEmitter>();

export function getEmitter(linkId: string) {
  let e = emitters.get(linkId);
  if (!e) {
    e = new EventEmitter();
    emitters.set(linkId, e);
  }
  return e;
}

export function removeLink(ownerSid: string) {
  const linkId = getOldLink(ownerSid);
  if (!linkId) return;

  db.prepare("DELETE FROM links WHERE id = ?").run(linkId);
  db.prepare("DELETE FROM messages WHERE link_id = ?").run(linkId);
  emitters.delete(linkId);
}

export function addMessage(
  linkId: string,
  content: string,
  posterSid?: string | null,
) {
  const validLink = linkExists(linkId);
  if (!validLink) {
    // throw new Error("Link does not exist");
    console.log("Attempted to add message to non-existent linkId=", linkId);
    return null;
  }
  const now = Date.now();
  const res = db
    .prepare(
      "INSERT INTO messages (link_id, content, poster_sid, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(linkId, content, posterSid ?? null, now) as {
    lastInsertRowid?: number;
  };
  console.log("Message added to DB with id=", res.lastInsertRowid);
  const id = (res && (res as any).lastInsertRowid) ?? null;

  const message = {
    id,
    content,
    posterSid: posterSid ?? null,
    createdAt: now,
  };

  // Emit to any SSE listeners for this link
  try {
    const emitter = getEmitter(linkId);
    emitter.emit("message", message);
  } catch (e) {
    // noop
  }

  return message;
}

export function linkExists(linkId: string) {
  const row = db.prepare("SELECT 1 FROM links WHERE id = ?").get(linkId);
  return !!row;
}

export function getMessagesForLink(linkId: string) {
  const rows = db
    .prepare(
      "SELECT id, content, poster_sid, created_at FROM messages WHERE link_id = ? ORDER BY created_at ASC",
    )
    .all(linkId) as Array<{
    id: number;
    content: string;
    poster_sid?: string | null;
    created_at: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    posterSid: r.poster_sid ?? null,
    createdAt: r.created_at,
  }));
}

// CREATE TABLE IF NOT EXISTS links (
//     id TEXT PRIMARY KEY,
//     ownerSid TEXT NOT NULL,
//     created_at INTEGER NOT NULL
//   );

export function getOldLink(ownerSid: string) {
  const row = db
    .prepare("SELECT id FROM links WHERE ownerSid = ?")
    .get(ownerSid) as { id: string } | undefined;

  return row?.id ?? null;
}
