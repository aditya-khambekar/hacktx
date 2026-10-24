import "server-only"

import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { connection } from "next/server"

import { prisma } from "@/lib/db"

export function googleAuthReady() {
  return Boolean(
    process.env.AUTH_SECRET &&
      process.env.DATABASE_URL &&
      process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET,
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  pages: {
    signIn: "/",
    error: "/",
  },
  trustHost: true,
})

export async function getLandingSession() {
  if (!process.env.AUTH_SECRET || !process.env.DATABASE_URL) {
    return null
  }

  await connection()

  try {
    return await auth()
  } catch {
    return null
  }
}
