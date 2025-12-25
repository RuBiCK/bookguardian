import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // JWT callback - called when JWT is created or updated
    jwt({ token, user, account, profile }) {
      // Initial sign in - add user ID to token
      if (user?.id) {
        token.id = user.id
      }
      return token
    },
    // Session callback - called when session is checked
    session({ session, token }) {
      // Add user ID from token to session
      if (token?.id && session.user) {
        session.user.id = token.id
      }
      return session
    },
  },
  session: {
    strategy: "jwt", // Use JWT sessions for Edge runtime compatibility
  },
})
