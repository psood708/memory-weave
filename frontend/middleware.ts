import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isSignInPage = nextUrl.pathname === "/sign-in";
  const isApiAuth = nextUrl.pathname.startsWith("/api/auth");

  if (isApiAuth) return NextResponse.next();
  if (!session && !isSignInPage) {
    return NextResponse.redirect(new URL("/sign-in", nextUrl));
  }
  if (session && isSignInPage) {
    return NextResponse.redirect(new URL("/setup", nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
