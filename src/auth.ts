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
      // Create default library/shelf for new users
      // Use email to find user since id might not be in DB yet on first sign-in
      if (user?.email) {
        try {
          // Find user and include libraries to check if user is new
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            include: { libraries: true }
          })

          // If user exists and has no libraries, create default library and shelf
          if (dbUser && dbUser.libraries.length === 0) {
            await prisma.library.create({
              data: {
                name: 'Default',
                userId: dbUser.id,
                shelves: {
                  create: {
                    name: 'Default'
                  }
                }
              }
            })
            console.log('Created default library and shelf for new user:', user.email)
          }
        } catch (error) {
          // Silently fail if user doesn't exist yet (first sign-in in progress)
          // The adapter will create the user, and default library will be created on next sign-in
          console.log('Could not create default library:', error)
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
    async session({ session, token }) {
      // Add user ID from token to session
      if (token?.id && session.user) {
        session.user.id = token.id

        // Update lastLogin timestamp with throttling (only if more than 1 hour has passed)
        // This runs on every authenticated request but only updates DB when needed
        try {
          const user = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { lastLogin: true }
          })

          const now = new Date()
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

          // Update if lastLogin is null or older than 1 hour
          if (!user?.lastLogin || user.lastLogin < oneHourAgo) {
            // Fire and forget - don't await to avoid blocking session response
            prisma.user.update({
              where: { id: token.id as string },
              data: { lastLogin: now }
            }).catch(error => {
              console.error('Failed to update lastLogin:', error)
            })
          }
        } catch (error) {
          console.error('Error checking lastLogin:', error)
        }
      }
      return session
    },
  },
  session: {
    strategy: "jwt", // Use JWT sessions for Edge runtime compatibility
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Refresh session daily
  },
})
