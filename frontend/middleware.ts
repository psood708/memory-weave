import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const { pathname } = nextUrl;

  // Always allow NextAuth API routes
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  // Redirect legacy sign-in page to the home page (auth modal is there now)
  if (pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // Home page is public — the landing page and auth modal live here
  if (pathname === "/") return NextResponse.next();

  // All other routes (/dashboard, /setup, etc.) require a session
  if (!session) {
    const loginUrl = new URL("/", nextUrl);
    loginUrl.searchParams.set("auth", "signin");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
