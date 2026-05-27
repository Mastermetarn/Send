import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addMessage, linkExists } from "@/lib/message-store";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {

    const { id } = await params;
    const validLink = await linkExists(id);
    if (!validLink) {
        return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    }

  const body = await req.json();
  const content = String(body.content ?? "").trim();

  if (!content) {
    return NextResponse.json(
      { ok: false, error: "empty" },
      { status: 400 },
    );
  }

  // Save message for link; record poster session if present
  const cookieStore = await cookies();
  const posterSid =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  addMessage(id, content, posterSid);

  return NextResponse.json({ ok: true });
}