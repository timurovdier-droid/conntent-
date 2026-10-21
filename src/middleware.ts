import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth/token";

const publicExact = new Set([
  "/",
  "/login",
  "/register",
  "/forgot",
  "/reset",
  "/legal/terms",
  "/legal/privacy",
  "/api/health",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot",
  "/api/auth/reset",
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = publicExact.has(pathname) || pathname.startsWith("/legal/");
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Войдите в аккаунт, чтобы продолжить.",
            requestId: crypto.randomUUID(),
            retryable: false,
          },
        },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
