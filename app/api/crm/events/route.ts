import { subscribeToMember, subscribeToPipeline, subscribeToRequests } from "@/lib/crm-realtime";
import { sessionMemberId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Azure App Service drops idle requests after ~230s; keep the stream busy
const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream for a pipeline (`?pipelineId=`), for the notifications of the
 * signed-in member (`?notifications=1`) or for the improvement requests (`?requests=1`).
 * Emits a `data:` message every time something changes; clients refetch when they receive one.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const pipelineId = params.get("pipelineId");
  const requests = params.has("requests");
  const memberId = params.has("notifications") ? sessionMemberId(req) : null;
  if (!pipelineId && !memberId && !requests) {
    return Response.json({ error: "Missing pipelineId, notifications or requests" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const forward = (event: unknown) => send(`data: ${JSON.stringify(event)}\n\n`);
      const unsubscribe = pipelineId
        ? subscribeToPipeline(pipelineId, forward)
        : memberId
          ? subscribeToMember(memberId, forward)
          : subscribeToRequests(forward);
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", () => cleanup());

      // Client reconnect delay, then flush headers so EventSource fires `open`
      send("retry: 3000\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform keeps the Next.js server from gzip-buffering the stream
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
