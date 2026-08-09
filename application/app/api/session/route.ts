import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

import { SqliteSessionStore } from "@/lib/session-store";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_DAYS } from "@/lib/session";
import type { AppSession } from "@/lib/session-types";

export const runtime = "nodejs";

const store = new SqliteSessionStore();

export async function POST() {
  const cookieStore = await cookies();
  const existingSid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  // Reuse existing session if valid
  if (existingSid) {
    const session = await store.get(existingSid);

    if (session) {
      const updatedSession: AppSession = {
        ...session,
        lastSeenAt: new Date().toISOString(),
        oneTimeRead: session.oneTimeRead ?? false,
      };

      await store.touch(existingSid, updatedSession);

      return NextResponse.json({
        ok: true,
        sessionId: existingSid,
      });
    }
  }

  // Create new session
  const sid = crypto.randomUUID();
  const now = new Date().toISOString();

  const maxAge = 30 * 24 * 60 * 60;

  const sessionObj: AppSession = {
    startedAt: now,
    lastSeenAt: now,
    oneTimeRead: false,
    cookie: {
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge,
      expires: new Date(Date.now() + maxAge * 1000), // <-- fix
    },
  };

  await store.set(sid, sessionObj);

  const res = NextResponse.json({
    ok: true,
    sessionId: sid,
  });

  res.cookies.set(SESSION_COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
    path: "/",
  });

  return res;
}
