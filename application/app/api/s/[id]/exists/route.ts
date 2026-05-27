import { NextRequest, NextResponse } from "next/server";
import { linkExists } from "@/lib/message-store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  console.log("Checking existence for linkId=", await context.params);
  const { id } = await context.params;

  return NextResponse.json({
    exists: await linkExists(id),
  });
}
