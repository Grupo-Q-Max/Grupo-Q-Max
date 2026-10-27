// Relative path with extension so node:test can load this file (Node resolves neither @/ nor extensionless imports)
import { redis } from "./realtime.ts";

// Fixed window. With REDIS_URL the count is shared by every instance; without it (or when Redis
// fails) it falls back to this process's memory, so logins keep working while Redis is down.
const hits = new Map<string, { count: number; resetAt: number }>();

/** Counts a hit for `key`. Returns seconds to wait when over `limit` per `windowMs`, else null. */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const client = redis();
  if (client) {
    try {
      const redisKey = `ratelimit:${key}`;
      const result = await client.multi().incr(redisKey).pexpire(redisKey, windowMs, "NX").pttl(redisKey).exec();
      const count = Number(result?.[0]?.[1]);
      const ttl = Number(result?.[2]?.[1]);
      if (Number.isFinite(count)) return count > limit ? Math.ceil(Math.max(ttl, 1000) / 1000) : null;
    } catch (error) {
      console.error("[rate-limit] redis failed, counting in memory:", error instanceof Error ? error.message : error);
    }
  }
  return memoryRateLimit(key, limit, windowMs);
}

function memoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);

  const entry = hits.get(key) ?? { count: 0, resetAt: now + windowMs };
  entry.count++;
  hits.set(key, entry);
  return entry.count > limit ? Math.ceil((entry.resetAt - now) / 1000) : null;
}

/** 429 telling the user how long to wait. */
export function tooManyRequests(wait: number) {
  const minutes = Math.ceil(wait / 60);
  return Response.json(
    { error: `Muitas tentativas. Tente de novo em ${minutes} minuto${minutes > 1 ? "s" : ""}.` },
    { status: 429, headers: { "Retry-After": String(wait) } }
  );
}

/**
 * Client IP. Azure App Service appends the real client to X-Forwarded-For (as `ip:port`),
 * so the last entry is trusted; earlier ones can be forged by the client.
 */
export function clientIp(req: Request) {
  const last = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "";
  // "[2001:db8::1]:443" → IPv6 without port; "1.2.3.4:443" → IPv4 without port; a bare IPv6 stays as is
  const bracketed = last.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) return bracketed[1];
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(last)) return last.replace(/:\d+$/, "");
  return last || "local";
}
