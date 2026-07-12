import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import crypto from "crypto";

import { createLink } from "@/lib/message-store";
import { appUrl, requestOrigin } from "@/lib/paths";
import { SqliteSessionStore } from "@/lib/session-store";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import type { AppSession } from "@/lib/session-types";
import { NextRequest } from "next/server";
import { getLinkOneTimeRead, getOldLink } from "@/lib/message-store";

export const runtime = "nodejs";

const store = new SqliteSessionStore();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as { oneTimeRead?: boolean }));
  const oneTimeRead = Boolean(body?.oneTimeRead);

  // console.log("POST /api/ask/create called");
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  let effectiveSid: string | null = sid ?? null;

  // Reuse session if valid
  if (sid) {
      console.log("Create API called, sid=", sid);
    const session = await store.get(sid);
    if (session) {
        console.log("session", session);
      const updated: AppSession = {
        ...session,
        lastSeenAt: new Date().toISOString(),
        oneTimeRead,
      };

      await store.touch(sid, updated);
    } else {
      effectiveSid = null;
    }
  }

  // console.log("effectiveSid=", effectiveSid);

  // Create new session
  if (!effectiveSid) {
    const h = await headers();

    const userAgent = h.get("user-agent") ?? null;

    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    effectiveSid = crypto.randomUUID();

    const now = new Date().toISOString();

    const maxAge = 30 * 24 * 60 * 60;

    const sessionObj: AppSession = {
      startedAt: now,
      lastSeenAt: now,
      userAgent,
      ipAddress: ip,
      oneTimeRead,
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
  createLink(id, effectiveSid, oneTimeRead);

  const url = appUrl(`/s/${id}`, requestOrigin(req));

  const response = NextResponse.json({ ok: true, url, oneTimeRead });

  if (!sid || sid !== effectiveSid) {
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

export async function GET(req: NextRequest) {
//   const { id } = await params;
  // console.log("GET /api/ask/create called");
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const oldLink = getOldLink(String(sid));
  console.log("Old link for sid", sid, "is", oldLink);

  const url = oldLink ? appUrl(`/s/${oldLink}`, requestOrigin(req)) : null;
  const oneTimeRead = oldLink ? getLinkOneTimeRead(oldLink) : false;

  return NextResponse.json({ ok: true, url, oneTimeRead });
}
