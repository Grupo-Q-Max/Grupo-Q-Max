import { EventEmitter } from "events";
import Redis from "ioredis";

/*
 * Pub/sub used to push realtime events (SSE) to connected clients.
 *
 * The EventEmitter fans an event out to the SSE streams open on this instance.
 * With REDIS_URL set, events go through Redis pub/sub so every instance of the
 * App Service gets them; without it, everything stays in memory (single instance,
 * local dev). Events only tell clients to refetch, so a lost one is harmless.
 */

type Handler<T> = (data: T) => void;

/** Every channel starts with this (see lib/crm-realtime.ts); the subscriber listens to all of them */
const CHANNEL_PREFIX = "crm:";

// Shared across module reloads (dev HMR) and separately bundled route handlers
const globalForRealtime = globalThis as unknown as {
  qmaxRealtime?: EventEmitter;
  qmaxRedisPub?: Redis;
  qmaxRedisSub?: Redis;
};

const emitter = (globalForRealtime.qmaxRealtime ??= (() => {
  const e = new EventEmitter();
  e.setMaxListeners(0); // one listener per open SSE connection
  return e;
})());

const connect = (role: string) => {
  const client = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 2 });
  // ioredis reconnects by itself; without a listener an "error" event would crash the process.
  // Logged once per outage, not on every reconnect attempt
  let down = false;
  client.on("error", (error) => {
    if (!down) console.error(`[realtime] redis ${role} unavailable (retrying):`, error.message);
    down = true;
  });
  client.on("ready", () => {
    if (down) console.log(`[realtime] redis ${role} reconnected`);
    down = false;
  });
  return client;
};

/**
 * Shared Redis client of this instance (publishing, rate limits), or null without REDIS_URL.
 * Created on first use, never at import, so `next build` doesn't connect.
 */
export function redis() {
  if (!process.env.REDIS_URL) return null;
  return (globalForRealtime.qmaxRedisPub ??= connect("pub"));
}

/** Starts this instance's Redis subscriber once: messages of every instance reach the local SSE streams. */
function ensureSubscriber() {
  if (!process.env.REDIS_URL || globalForRealtime.qmaxRedisSub) return;
  const sub = (globalForRealtime.qmaxRedisSub = connect("sub"));
  sub.psubscribe(`${CHANNEL_PREFIX}*`).catch((error) => console.error("[realtime] redis psubscribe:", error.message));
  sub.on("pmessage", (_pattern, channel, message) => {
    try {
      emitter.emit(channel, JSON.parse(message));
    } catch (error) {
      console.error("[realtime] bad message on", channel, error);
    }
  });
}

export function publish<T>(channel: string, data: T) {
  const client = redis();
  if (!client) {
    emitter.emit(channel, data);
    return;
  }
  // Redis delivers it back to this instance too, so no local emit (it would arrive twice).
  // ponytail: pub/sub keeps nothing; an event published while a subscriber reconnects is lost (clients catch up on the next one)
  client.publish(channel, JSON.stringify(data)).catch((error) => {
    console.error("[realtime] redis publish failed, delivering locally:", error.message);
    emitter.emit(channel, data);
  });
}

/** Returns an unsubscribe function. */
export function subscribe<T>(channel: string, handler: Handler<T>) {
  ensureSubscriber();
  emitter.on(channel, handler);
  return () => {
    emitter.off(channel, handler);
  };
}
