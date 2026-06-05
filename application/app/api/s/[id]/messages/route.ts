import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  consumeMessagesForLink,
  getLinkOneTimeRead,
  getLinkOwner,
  getMessageCountForLink,
  getMessagesForLink,
} from "@/lib/message-store";
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

  const oneTimeRead = getLinkOneTimeRead(id);

  if (oneTimeRead) {
    return NextResponse.json({
      ok: true,
      oneTimeRead,
      messageCount: getMessageCountForLink(id),
      messages: [],
    });
  }

  const messages = getMessagesForLink(id);

  return NextResponse.json({
    ok: true,
    oneTimeRead,
    messageCount: messages.length,
    messages,
  });
}

export async function POST(
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

  const oneTimeRead = getLinkOneTimeRead(id);
  if (!oneTimeRead) {
    const messages = getMessagesForLink(id);
    return NextResponse.json({
      ok: true,
      oneTimeRead,
      messageCount: messages.length,
      messages,
    });
  }

  const messages = consumeMessagesForLink(id);
  return NextResponse.json({
    ok: true,
    oneTimeRead,
    messageCount: 0,
    messages,
  });
}
