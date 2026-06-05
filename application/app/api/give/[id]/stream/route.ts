import { NextRequest } from "next/server";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/lib/session";
import {
  getGiveEmitter,
  getGiveStats,
  ownerCanManageGiveLink,
} from "@/lib/give-store";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sid || !ownerCanManageGiveLink(id, sid)) {
    return new Response("Forbidden", { status: 403 });
  }

  const emitter = getGiveEmitter(id);

  const stream = new ReadableStream({
    start(controller) {
      const sendStats = (stats: unknown) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(stats)}\n\n`),
        );
      };

      sendStats(getGiveStats(id));
      emitter.on("stats", sendStats);

      req.signal.addEventListener("abort", () => {
        emitter.off("stats", sendStats);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
