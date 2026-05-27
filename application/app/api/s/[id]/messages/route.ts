import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getLinkOwner, getMessagesForLink } from "@/lib/message-store";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const owner = getLinkOwner(id);

  if (!owner) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 },
    );
  }

  if (!sid || sid !== owner) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }

  const messages = getMessagesForLink(id);
  return NextResponse.json({ ok: true, messages });
}
