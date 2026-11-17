import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticateAdmin } from "./db";

const secure = process.env.NEXTAUTH_URL?.startsWith("https://") === true;
const prefix = secure ? "__Secure-" : "";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  cookies: {
    sessionToken: {
      name: `${prefix}tw-admin.session-token`,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure },
    },
    csrfToken: {
      name: secure ? "__Host-tw-admin.csrf-token" : "tw-admin.csrf-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure },
    },
    callbackUrl: {
      name: `${prefix}tw-admin.callback-url`,
      options: { sameSite: "lax", path: "/", secure },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Tidewell administrator",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const admin = await authenticateAdmin(credentials?.email, credentials?.password);
        return admin ? { id: admin.id, email: admin.email, name: admin.name } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.sub === "string") session.user.id = token.sub;
      return session;
    },
  },
};
