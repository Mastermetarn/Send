import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import crypto from "crypto";

import { createLink } from "@/lib/message-store";
import { SqliteSessionStore } from "@/lib/session-store";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { NextRequest } from "next/server";
import { getOldLink, getMessagesForLink } from "@/lib/message-store";

export const runtime = "nodejs";

const store = new SqliteSessionStore();

export async function POST() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  let effectiveSid: string | null = sid ?? null;

  // Reuse session if valid
  if (sid) {
      console.log("Create API called, sid=", sid);
    const session = await store.get(sid);
    if (session) {
        console.log("session", session);
      const updated = {
        ...session,
        lastSeenAt: new Date().toISOString(),
      };

      await store.touch(sid, updated);
    } else {
      effectiveSid = null;
    }
  }

  console.log("effectiveSid=", effectiveSid);

  // Create new session
  if (!effectiveSid) {
    const h = await headers();

    const userAgent = h.get("user-agent") ?? null;

    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    effectiveSid = crypto.randomUUID();

    const now = new Date().toISOString();

    const maxAge = 30 * 24 * 60 * 60;

    const sessionObj = {
      startedAt: now,
      lastSeenAt: now,
      userAgent,
      ipAddress: ip,
      cookie: {
        httpOnly: true,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge,
        expires: new Date(Date.now() + maxAge * 1000), // <-- fix
      },
    };

    await store.set(effectiveSid, sessionObj);
  }

  // Create link
  const id = crypto.randomUUID();
  createLink(id, effectiveSid);

  const url = `${process.env.AUTH_URL ?? "http://localhost:3000"}/s/${id}`;

  const response = NextResponse.json({ ok: true, url });

  if (!sid) {
    response.cookies.set(SESSION_COOKIE_NAME, effectiveSid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
  }

  return response;
}

export async function GET(
  _req: NextRequest,
//   { params }: { > },
) {
//   const { id } = await params;

  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const oldLink = getOldLink(String(sid));
  const url = `${process.env.AUTH_URL ?? "http://localhost:3000"}/s/${oldLink}`;

  

  return NextResponse.json({ ok: true, url });
}
