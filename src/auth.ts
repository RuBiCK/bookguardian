import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true, // Trust host when behind reverse proxy (Dokploy)
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
    // Sign in callback - called when user signs in
    async signIn({ user }) {
      // Update lastLogin timestamp
      // Use email to find user since id might not be in DB yet on first sign-in
      if (user?.email) {
        try {
          await prisma.user.update({
            where: { email: user.email },
            data: { lastLogin: new Date() },
          })
        } catch (error) {
          // Silently fail if user doesn't exist yet (first sign-in in progress)
          // The adapter will create the user, and lastLogin will be updated on next sign-in
          console.log('Could not update lastLogin, user may not exist yet:', error)
        }
      }
      return true
    },
    // JWT callback - called when JWT is created or updated
    jwt({ token, user }) {
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
