import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { JWT } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";

function secretKey(secret: string | Uint8Array) {
  return typeof secret === "string" ? new TextEncoder().encode(secret) : secret;
}

// In production the frontend and API are on different Railway subdomains (cross-origin).
// SameSite=Lax (Auth.js default) blocks the cookie from being sent cross-site.
// SameSite=None + Secure allows it; only active on HTTPS so local dev is unaffected.
const isProd = (process.env.NEXTAUTH_URL ?? "").startsWith("https");

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  ...(isProd && {
    cookies: {
      sessionToken: {
        name: "__Secure-authjs.session-token",
        options: {
          httpOnly: true,
          sameSite: "none" as const,
          path: "/",
          secure: true,
        },
      },
    },
  }),
  jwt: {
    encode: async ({ token, secret }) => {
      return new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(secretKey(secret as string));
    },
    decode: async ({ token, secret }) => {
      const { payload } = await jwtVerify(token!, secretKey(secret as string), {
        algorithms: ["HS256"],
      });
      return payload as JWT;
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.sub = profile.sub ?? account.providerAccountId;
        token.provider = account.provider;
        token.email = profile.email;
        token.name = profile.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? "";
      return session;
    },
    async redirect({ url, baseUrl }) {
      // After OAuth, go through model setup then to dashboard
      if (url === baseUrl || url === `${baseUrl}/`) return `${baseUrl}/setup`;
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },
});
