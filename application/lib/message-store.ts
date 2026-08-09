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
    publicKey TEXT,
    oneTimeRead INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT NOT NULL,
    content TEXT NOT NULL,
    encrypted_key TEXT,
    iv TEXT,
    poster_sid TEXT,
    created_at INTEGER NOT NULL
  );
`);

const linkInfo = db.prepare("PRAGMA table_info(links)").all() as Array<{
  name: string;
}>;
if (!linkInfo.find((c) => c.name === "oneTimeRead")) {
  db.exec(`
    DROP TABLE IF EXISTS links;
    CREATE TABLE links (
      id TEXT PRIMARY KEY,
      ownerSid TEXT NOT NULL,
      publicKey TEXT,
      oneTimeRead INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

if (!linkInfo.find((c) => c.name === "publicKey")) {
  try {
    db.prepare("ALTER TABLE links ADD COLUMN publicKey TEXT").run();
  } catch (e) {
    // ignore migration failures on older databases
  }
}

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

if (!msgInfo.find((c) => c.name === "encrypted_key")) {
  try {
    db.prepare("ALTER TABLE messages ADD COLUMN encrypted_key TEXT").run();
  } catch (e) {
    // ignore migration failures on older databases
  }
}

if (!msgInfo.find((c) => c.name === "iv")) {
  try {
    db.prepare("ALTER TABLE messages ADD COLUMN iv TEXT").run();
  } catch (e) {
    // ignore migration failures on older databases
  }
}

export function createLink(
  id: string,
  ownerSid: string,
  oneTimeRead: boolean,
  publicKey: string,
) {
  const now = Date.now();

  //remove old link for this owner if exists
  const oldLink = getOldLink(ownerSid);
  if (oldLink) {
    db.prepare("DELETE FROM links WHERE id = ?").run(oldLink);
    db.prepare("DELETE FROM messages WHERE link_id = ?").run(oldLink);
  }

  db.prepare(
    "INSERT INTO links (id, ownerSid, publicKey, oneTimeRead, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, ownerSid, publicKey, oneTimeRead ? 1 : 0, now);
}

export function getLinkOwner(id: string) {
  const row = db.prepare("SELECT ownerSid FROM links WHERE id = ?").get(id) as
    | { ownerSid: string }
    | undefined;
  return row?.ownerSid ?? null;
}

export function getLinkOneTimeRead(id: string) {
  const row = db.prepare("SELECT oneTimeRead FROM links WHERE id = ?").get(id) as
    | { oneTimeRead: number }
    | undefined;

  return row?.oneTimeRead === 1;
}

export function getLinkPublicKey(id: string) {
  const row = db.prepare("SELECT publicKey FROM links WHERE id = ?").get(id) as
    | { publicKey: string | null }
    | undefined;

  return row?.publicKey ?? null;
}

// In-memory emitters for Server-Sent Events per link
const emitters = new Map<string, EventEmitter>();

export function purgeExpiredAskData(cutoff: number) {
  const expiredLinks = db
    .prepare("SELECT id FROM links WHERE created_at <= ?")
    .all(cutoff) as Array<{ id: string }>;

  if (expiredLinks.length === 0) return 0;

  const purge = db.transaction(() => {
    db.prepare(
      "DELETE FROM messages WHERE link_id IN (SELECT id FROM links WHERE created_at <= ?)",
    ).run(cutoff);
    db.prepare("DELETE FROM links WHERE created_at <= ?").run(cutoff);
  });

  purge();

  for (const { id } of expiredLinks) {
    emitters.delete(id);
  }

  return expiredLinks.length;
}

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
  encryptedKey: string,
  iv: string,
  posterSid?: string | null,
) {
  const validLink = linkExists(linkId);
  if (!validLink) {
    return null;
  }
  const now = Date.now();
  const res = db
    .prepare(
      "INSERT INTO messages (link_id, content, encrypted_key, iv, poster_sid, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(linkId, content, encryptedKey, iv, posterSid ?? null, now) as {
    lastInsertRowid?: number;
  };
  const id = (res && (res as any).lastInsertRowid) ?? null;

  const message = {
    id,
    content,
    encryptedKey,
    iv,
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
      "SELECT id, content, encrypted_key, iv, poster_sid, created_at FROM messages WHERE link_id = ? ORDER BY created_at ASC",
    )
    .all(linkId) as Array<{
    id: number;
    content: string;
    encrypted_key?: string | null;
    iv?: string | null;
    poster_sid?: string | null;
    created_at: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    encryptedKey: r.encrypted_key ?? null,
    iv: r.iv ?? null,
    posterSid: r.poster_sid ?? null,
    createdAt: r.created_at,
  }));
}

export function getMessageCountForLink(linkId: string) {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM messages WHERE link_id = ?")
    .get(linkId) as { count: number } | undefined;

  return row?.count ?? 0;
}

export function consumeMessagesForLink(linkId: string) {
  const consume = db.transaction((targetLinkId: string) => {
    const rows = db
      .prepare(
        "SELECT id, content, encrypted_key, iv, poster_sid, created_at FROM messages WHERE link_id = ? ORDER BY created_at ASC",
      )
      .all(targetLinkId) as Array<{
      id: number;
      content: string;
      encrypted_key?: string | null;
      iv?: string | null;
      poster_sid?: string | null;
      created_at: number;
    }>;

    db.prepare("DELETE FROM messages WHERE link_id = ?").run(targetLinkId);

    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      encryptedKey: r.encrypted_key ?? null,
      iv: r.iv ?? null,
      posterSid: r.poster_sid ?? null,
      createdAt: r.created_at,
    }));
  });

  return consume(linkId);
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
