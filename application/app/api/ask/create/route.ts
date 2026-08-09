import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

import { createLink } from "@/lib/message-store";
import { appUrl, requestOrigin } from "@/lib/paths";
import { SqliteSessionStore } from "@/lib/session-store";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import type { AppSession } from "@/lib/session-types";
import { NextRequest } from "next/server";
import { getLinkOneTimeRead, getLinkPublicKey, getOldLink } from "@/lib/message-store";

export const runtime = "nodejs";

const store = new SqliteSessionStore();

export async function POST(req: NextRequest) {
  const body = await req
    .json()
    .catch(() => ({} as { oneTimeRead?: boolean; publicKey?: string }));
  const oneTimeRead = Boolean(body?.oneTimeRead);
  const publicKey = String(body?.publicKey ?? "").trim();

  if (!publicKey) {
    return NextResponse.json(
      { ok: false, error: "public-key-required" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  let effectiveSid: string | null = sid ?? null;

  // Reuse session if valid
  if (sid) {
    const session = await store.get(sid);
    if (session) {
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

  // Create new session
  if (!effectiveSid) {
    effectiveSid = crypto.randomUUID();

    const now = new Date().toISOString();

    const maxAge = 30 * 24 * 60 * 60;

    const sessionObj: AppSession = {
      startedAt: now,
      lastSeenAt: now,
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
  createLink(id, effectiveSid, oneTimeRead, publicKey);

  const url = appUrl(`/s/${id}`, requestOrigin(req));

  const response = NextResponse.json({ ok: true, url, oneTimeRead, publicKey });

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
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const oldLink = getOldLink(String(sid));

  const url = oldLink ? appUrl(`/s/${oldLink}`, requestOrigin(req)) : null;
  const oneTimeRead = oldLink ? getLinkOneTimeRead(oldLink) : false;
  const publicKey = oldLink ? getLinkPublicKey(oldLink) : null;

  return NextResponse.json({ ok: true, url, oneTimeRead, publicKey });
}
