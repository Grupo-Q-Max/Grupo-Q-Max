import { subscribeToMember, subscribeToPipeline } from "@/lib/crm-realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Azure App Service drops idle requests after ~230s; keep the stream busy
const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream for a pipeline (`?pipelineId=`) or for the notifications
 * of a team member (`?memberId=`). Emits a `data:` message every time
 * something changes; clients refetch when they receive one.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const pipelineId = params.get("pipelineId");
  const memberId = params.get("memberId");
  if (!pipelineId && !memberId) {
    return Response.json({ error: "Missing pipelineId or memberId" }, { status: 400 });
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
      const unsubscribe = pipelineId ? subscribeToPipeline(pipelineId, forward) : subscribeToMember(memberId!, forward);
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
