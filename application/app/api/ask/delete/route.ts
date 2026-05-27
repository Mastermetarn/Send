import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import crypto from "crypto";

import { removeLink } from "@/lib/message-store";
import { SqliteSessionStore } from "@/lib/session-store";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { NextRequest } from "next/server";
import { getOldLink, getMessagesForLink } from "@/lib/message-store";

export const runtime = "nodejs";

const store = new SqliteSessionStore();

export async function POST() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sid) {
        return NextResponse.json({ ok: false, error: "no-session" }, { status: 400 });
    }


    removeLink(sid);

    const response = NextResponse.json({ ok: true });

  

  return response;
}


