import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";
import { sign, verify } from "jsonwebtoken";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  jwt: {
    encode: async ({ token, secret }) => {
      return sign(token as object, secret as string, { algorithm: "HS256" });
    },
    decode: async ({ token, secret }) => {
      return verify(token!, secret as string) as JWT;
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.sub = profile.sub ?? account.providerAccountId;
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
      if (url === baseUrl || url === `${baseUrl}/`) return `${baseUrl}/setup`;
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },
});
