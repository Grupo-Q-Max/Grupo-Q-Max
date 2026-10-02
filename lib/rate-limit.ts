// ponytail: in-memory fixed window, same single-instance limit as lib/realtime.ts; move to the DB/Redis if the app scales out
const hits = new Map<string, { count: number; resetAt: number }>();

/** Counts a hit for `key`. Returns seconds to wait when over `limit` per `windowMs`, else null. */
export function rateLimit(key: string, limit: number, windowMs: number) {
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
  return last.replace(/:\d+$/, "") || "local";
}
