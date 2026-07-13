import { NextRequest, NextResponse } from "next/server";
import { getLinkPublicKey, linkExists } from "@/lib/message-store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const exists = await linkExists(id);

  return NextResponse.json({
    exists,
    publicKey: exists ? getLinkPublicKey(id) : null,
  });
}
