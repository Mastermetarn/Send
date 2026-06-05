import { NextRequest, NextResponse } from "next/server";

import {
  getGiveLink,
  getGiveMessage,
  getGiveStats,
  recordGiveAccess,
} from "@/lib/give-store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const link = getGiveLink(id);
  const message = getGiveMessage(id);

  if (!link) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 },
    );
  }

  recordGiveAccess(id);

  const stats = getGiveStats(id);
  const canRead = Boolean(message) && stats.readCount < link.maxReads;

  return NextResponse.json({
    ok: true,
    canRead,
  });
}
