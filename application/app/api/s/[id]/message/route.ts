import { NextRequest, NextResponse } from "next/server";
import { addMessage, linkExists } from "@/lib/message-store";

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
  const encryptedKey = String(body.encryptedKey ?? "").trim();
  const iv = String(body.iv ?? "").trim();

  if (!content || !encryptedKey || !iv) {
    return NextResponse.json(
      { ok: false, error: "invalid-payload" },
      { status: 400 },
    );
  }

  addMessage(id, content, encryptedKey, iv);

  return NextResponse.json({ ok: true });
}
