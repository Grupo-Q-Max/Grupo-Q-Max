import { subscribeToPipeline } from "@/lib/crm-realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Azure App Service drops idle requests after ~230s; keep the stream busy
const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream for a pipeline. Emits a `data:` message every time
 * the pipeline changes; clients refetch the pipeline when they receive one.
 */
export async function GET(req: Request) {
  const pipelineId = new URL(req.url).searchParams.get("pipelineId");
  if (!pipelineId) {
    return Response.json({ error: "Missing pipelineId" }, { status: 400 });
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

      const unsubscribe = subscribeToPipeline(pipelineId, (event) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      });
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
