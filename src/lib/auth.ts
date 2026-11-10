import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authService } from "@/services/auth";
import { RateLimitError } from "@/lib/errors";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/account" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        try {
          const user = await authService.authenticate(credentials, request.headers ?? {});
          return user ? { id: user.id, name: user.name, email: user.email } : null;
        } catch (error) {
          // NextAuth owns this route and normalizes errors in its callback flow.
          // Keep the exposed error message generic and predictable for the UI.
          if (error instanceof RateLimitError) throw new Error("RATE_LIMITED");
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.sub === "string") session.user.id = token.sub;
      return session;
    },
  },
};
