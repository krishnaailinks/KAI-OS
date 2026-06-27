import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getUserScopedSupabase } from "@/lib/server/supabase";

const DASHBOARD_ROLES: Record<string, string> = {
  "/dashboard/director": "director",
  "/dashboard/employee": "employee",
  "/dashboard/client": "client",
};

const ROLE_REDIRECT_MAP: Record<string, string> = {
  director: "/dashboard/director",
  employee: "/dashboard/employee",
  client: "/dashboard/client",
};

const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://meet.jit.si",
  "font-src 'self' https://fonts.gstatic.com",
  // meet.jit.si uses WebSocket signalling (wss://) and HTTPS API calls
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://meet.jit.si wss://meet.jit.si",
  // meet.jit.si must be in frame-src or the iframe is blocked before it even loads
  "frame-src 'self' https://*.supabase.co https://challenges.cloudflare.com https://meet.jit.si",
  // blob: is required for WebRTC MediaStream object URLs in the parent frame
  "media-src 'self' blob: mediastream:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Allow camera/mic for our page (self) AND for the Jitsi Meet iframe (meet.jit.si).
  // The previous camera=() / microphone=() completely blocked device access site-wide,
  // which prevented any video or voice call from working even inside the iframe.
  "Permissions-Policy": 'camera=(self "https://meet.jit.si"), microphone=(self "https://meet.jit.si"), display-capture=(self "https://meet.jit.si"), geolocation=(), interest-cohort=()',
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/static") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  // Apply security headers to API routes but skip auth/routing logic
  if (pathname.startsWith("/api")) {
    const apiResponse = NextResponse.next();
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
      apiResponse.headers.set(key, value);
    });
    apiResponse.headers.set("Content-Security-Policy", CSP_HEADER);
    return apiResponse;
  }

  const response = NextResponse.next();

  // Apply security headers to every response
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  response.headers.set("Content-Security-Policy", CSP_HEADER);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isLandingPage = pathname === "/";
  const isDashboardRoute = pathname.startsWith("/dashboard/");

  if (!session) {
    if (isDashboardRoute) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDashboardRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const userDb = getUserScopedSupabase(session.access_token);
  const { data: profile } = await userDb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const actualRole = (profile?.role as string) || "employee";

  if (isDashboardRoute) {
    const allowedRole = DASHBOARD_ROLES[pathname];
    if (allowedRole && actualRole !== allowedRole) {
      const target = ROLE_REDIRECT_MAP[actualRole] || "/dashboard/employee";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  if (isAuthPage && session) {
    const target = ROLE_REDIRECT_MAP[actualRole] || "/dashboard/employee";
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (isLandingPage && session) {
    const target = ROLE_REDIRECT_MAP[actualRole] || "/dashboard/employee";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
