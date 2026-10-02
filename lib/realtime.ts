import { EventEmitter } from "events";

/*
 * In-memory pub/sub used to push realtime events (SSE) to connected clients.
 *
 * Works while the app runs as a single instance. If the App Service scales out
 * to multiple instances, replace the internals of `publish`/`subscribe` with a
 * shared broker (Redis pub/sub, Azure Web PubSub) — callers don't change.
 */

type Handler<T> = (data: T) => void;

// Shared across module reloads (dev HMR) and separately bundled route handlers
const globalForRealtime = globalThis as unknown as { qmaxRealtime?: EventEmitter };

const emitter = (globalForRealtime.qmaxRealtime ??= (() => {
  const e = new EventEmitter();
  e.setMaxListeners(0); // one listener per open SSE connection
  return e;
})());

export function publish<T>(channel: string, data: T) {
  emitter.emit(channel, data);
}

/** Returns an unsubscribe function. */
export function subscribe<T>(channel: string, handler: Handler<T>) {
  emitter.on(channel, handler);
  return () => {
    emitter.off(channel, handler);
  };
}
