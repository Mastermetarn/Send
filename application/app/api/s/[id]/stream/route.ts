import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getLinkOwner, getEmitter } from "@/lib/message-store";
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
    return new Response("Not found", { status: 404 });
  }

  if (!sid || sid !== owner) {
    return new Response("Forbidden", { status: 403 });
  }

  const emitter = getEmitter(id);

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      emitter.on("message", send);

      // Clean up when client disconnects
      _req.signal.addEventListener("abort", () => {
        emitter.off("message", send);
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
