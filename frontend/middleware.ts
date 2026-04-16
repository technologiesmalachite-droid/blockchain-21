import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sanitizePostAuthPath } from "./lib/auth/navigation";

const AUTH_COOKIE_NAME = "mx_access_token";
const AUTH_REFRESH_COOKIE_NAME = "mx_refresh_token_present";
const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

const PRIVATE_PREFIXES = [
  "/wallet",
  "/orders",
  "/profile",
  "/admin",
  "/kyc",
  "/deposit",
  "/withdraw",
  "/futures/positions",
  "/settings",
  "/history",
  "/notifications",
  "/support",
];

const isPrivatePath = (pathname: string) => PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
const isAuthPath = (pathname: string) => AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const refreshTokenMarker = request.cookies.get(AUTH_REFRESH_COOKIE_NAME)?.value;
  const hasAccessSession = Boolean(accessToken);
  const hasFullAuthSession = Boolean(accessToken && refreshTokenMarker);

  if (isAuthPath(pathname) && hasAccessSession) {
    const safeDestination = sanitizePostAuthPath(request.nextUrl.searchParams.get("next"), "/wallet");
    return NextResponse.redirect(new URL(safeDestination, request.url));
  }

  if (!isPrivatePath(pathname)) {
    return NextResponse.next();
  }

  if (hasAccessSession || hasFullAuthSession) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/wallet/:path*",
    "/orders/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/kyc/:path*",
    "/deposit/:path*",
    "/withdraw/:path*",
    "/futures/positions/:path*",
    "/settings/:path*",
    "/history/:path*",
    "/notifications/:path*",
    "/support/:path*",
  ],
};
