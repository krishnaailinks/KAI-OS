import { NextResponse } from "next/server";

export const getClientIp = (req: Request): string =>
  req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

/**
 * Supabase-backed rate limiter — atomic, durable, multi-instance safe.
 * Requires migration 006_rate_limit_counters.sql to be applied.
 * Falls open (allows the request) when the DB check fails so an outage
 * never locks out legitimate users.
 */
const isRateLimitBypassed =
  process.env.NODE_ENV === 'test' || process.env.CI === 'true' || process.env.PW_TEST === '1';

export const checkRateLimit = async (
  key: string,
  maxRequests = 60,
  windowMs = 60_000,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> => {
  // Avoid DB/RPC dependency for e2e runs.
  if (isRateLimitBypassed) {
    const result = rateLimit(key, maxRequests, windowMs);
    return { allowed: result.allowed, remaining: result.remaining, resetAt: result.resetAt };
  }

  try {
    const { getServiceSupabase } = await import("./server/supabase");
    const db = getServiceSupabase();
    type RateLimitRow = { allowed: boolean; remaining: number; reset_at: string };
    type RateLimitResult = { data: RateLimitRow | null; error: { message: string } | null };
    const { data, error } = (await db
      .rpc("check_rate_limit", { p_key: key, p_max: maxRequests, p_window_ms: windowMs })
      .single()) as unknown as RateLimitResult;

    if (error || !data) {
      console.error("[rate_limit] DB check failed, failing open:", error?.message);
      return { allowed: true, remaining: maxRequests - 1, resetAt: Date.now() + windowMs };
    }

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      resetAt: new Date(data.reset_at).getTime(),
    };
  } catch (err) {
    console.error("[rate_limit] unexpected error, failing open:", err);
    return { allowed: true, remaining: maxRequests - 1, resetAt: Date.now() + windowMs };
  }
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (entry.resetAt <= now) rateLimitMap.delete(key);
  }
};

export const rateLimit = (
  key: string,
  maxRequests = 60,
  windowMs = 60_000,
): { allowed: boolean; remaining: number; resetAt: number } => {
  if (Date.now() - lastCleanup > CLEANUP_INTERVAL) {
    cleanup();
    lastCleanup = Date.now();
  }

  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
};

export const rateLimitResponse = (resetAt: number) =>
  NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    },
  );

// CSRF TOKENS — retained for future use if cookie-based auth is ever added.
// KAI-OS API routes authenticate via Authorization: Bearer <token> headers,
// which browsers never send automatically on cross-origin requests.
// CSRF attacks require automatic credential submission (cookies), so these
// functions are intentionally not enforced in the current architecture.
export const generateCsrfToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

export const validateCsrfToken = (token: string, expectedToken: string): boolean => {
  if (!token || !expectedToken) return false;
  if (token.length !== 64 || expectedToken.length !== 64) return false;
  try {
    const tokenBuf = new Uint8Array(token.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const expectedBuf = new Uint8Array(expectedToken.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    if (tokenBuf.length !== 32 || expectedBuf.length !== 32) return false;
    let diff = 0;
    for (let i = 0; i < 32; i++) diff |= tokenBuf[i] ^ expectedBuf[i];
    return diff === 0;
  } catch {
    return false;
  }
};

export const safeRedirect = (url: string): string => {
  if (!url.startsWith("/dashboard/") && !url.startsWith("/login") && !url.startsWith("/register")) {
    return "/login";
  }
  return url;
};

/** Validates that a date string is in YYYY-MM-DD format. Returns true if valid. */
export const isValidDateParam = (date: string): boolean =>
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(date);

/** Compute local date (YYYY-MM-DD) for a given UTC offset in minutes (e.g., -300 for EST).
 *  Falls back to UTC date if offset is not provided. */
export function getLocalDate(tzOffsetMinutes?: string): string {
  if (tzOffsetMinutes === undefined) {
    return new Date().toISOString().split('T')[0];
  }
  const raw = parseInt(tzOffsetMinutes, 10);
  if (isNaN(raw)) {
    return new Date().toISOString().split('T')[0];
  }
  // Clamp to real-world timezone bounds: UTC-12 (−720 min) to UTC+14 (+840 min)
  const offset = Math.max(-720, Math.min(840, raw));
  const local = new Date(Date.now() + offset * 60_000);
  return local.toISOString().split('T')[0];
}

/** Parse pagination query params, returning { limit, page, from, to } with sensible defaults and caps. */
export function parsePagination(searchParams: URLSearchParams, defaultLimit = 50, maxLimit = 200) {
  const rawLimit = parseInt(searchParams.get('limit') || String(defaultLimit), 10);
  const limit = Math.min(Math.max(isNaN(rawLimit) ? defaultLimit : rawLimit, 1), maxLimit);
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { limit, page, from, to };
}
