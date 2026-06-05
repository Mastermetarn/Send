import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/lib/session";
import { deleteGiveLinkByOwner } from "@/lib/give-store";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sid) {
    return NextResponse.json({ ok: false, error: "no-session" }, { status: 400 });
  }

  deleteGiveLinkByOwner(sid);
  return NextResponse.json({ ok: true });
}
