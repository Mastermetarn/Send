import { NextRequest, NextResponse } from "next/server";

import { getGiveLink, readGiveMessage } from "@/lib/give-store";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const link = getGiveLink(id);
  if (!link) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 },
    );
  }

  const result = readGiveMessage(id);

  if (!result.ok) {
    if (result.error === "limit-reached") {
      return NextResponse.json(
        { ok: false, error: "limit-reached" },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: result.message.content,
    deleted: result.deleted,
  });
}
