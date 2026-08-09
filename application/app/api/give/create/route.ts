import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

import { appUrl, requestOrigin } from "@/lib/paths";
import { SqliteSessionStore } from "@/lib/session-store";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import type { AppSession } from "@/lib/session-types";
import {
  createGiveLink,
  getGiveStats,
  getOwnerGiveLink,
} from "@/lib/give-store";

export const runtime = "nodejs";

const store = new SqliteSessionStore();

async function getOrCreateOwnerSid() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  let effectiveSid: string | null = sid ?? null;

  if (sid) {
    const session = await store.get(sid);
    if (session) {
      const updated: AppSession = {
        ...session,
        lastSeenAt: new Date().toISOString(),
      };

      await store.touch(sid, updated);
    } else {
      effectiveSid = null;
    }
  }

  if (!effectiveSid) {
    effectiveSid = crypto.randomUUID();

    const now = new Date().toISOString();
    const maxAge = 30 * 24 * 60 * 60;

    const sessionObj: AppSession = {
      startedAt: now,
      lastSeenAt: now,
      cookie: {
        httpOnly: true,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge,
        expires: new Date(Date.now() + maxAge * 1000),
      },
    };

    await store.set(effectiveSid, sessionObj);
  }

  return { sid, effectiveSid };
}

export async function POST(req: NextRequest) {
  const body = await req
    .json()
    .catch(() => ({} as { message?: string; maxReads?: number }));

  const message = String(body.message ?? "").trim();
  const parsedMaxReads = Number(body.maxReads ?? 1);
  const maxReads = Number.isFinite(parsedMaxReads)
    ? Math.max(1, Math.min(100, Math.floor(parsedMaxReads)))
    : 1;

  if (!message) {
    return NextResponse.json(
      { ok: false, error: "message-required" },
      { status: 400 },
    );
  }

  const { sid, effectiveSid } = await getOrCreateOwnerSid();

  const id = crypto.randomUUID();
  createGiveLink(id, effectiveSid, message, maxReads);

  const url = appUrl(`/g/${id}`, requestOrigin(req));
  const stats = getGiveStats(id);

  const response = NextResponse.json({
    ok: true,
    url,
    maxReads,
    accessCount: stats.accessCount,
    readCount: stats.readCount,
    remainingReads: stats.remainingReads,
  });

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

  if (!sid) {
    return NextResponse.json({ ok: true, url: null });
  }

  const link = getOwnerGiveLink(sid);
  if (!link) {
    return NextResponse.json({ ok: true, url: null });
  }

  const stats = getGiveStats(link.id);
  const url = appUrl(`/g/${link.id}`, requestOrigin(req));

  return NextResponse.json({
    ok: true,
    url,
    maxReads: link.maxReads,
    accessCount: stats.accessCount,
    readCount: stats.readCount,
    remainingReads: stats.remainingReads,
  });
}
