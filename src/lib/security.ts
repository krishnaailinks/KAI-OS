import { NextResponse } from "next/server";

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
  const offset = parseInt(tzOffsetMinutes, 10);
  if (isNaN(offset)) {
    return new Date().toISOString().split('T')[0];
  }
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
