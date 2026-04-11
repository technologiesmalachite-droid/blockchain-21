import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "mx_access_token";

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
];

const isPrivatePath = (pathname: string) => PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isPrivatePath(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (accessToken) {
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
  ],
};
