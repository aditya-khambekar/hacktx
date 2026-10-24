import "server-only"

import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth, { type DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import { connection } from "next/server"

import { prisma } from "@/lib/db"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}

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
  logger: {
    error(error) {
      const cause =
        error.cause && typeof error.cause === "object"
          ? (error.cause as { error?: unknown; providerId?: unknown })
          : undefined
      // #region agent log
      fetch("http://127.0.0.1:7918/ingest/7f2113e6-8bdc-48b8-8acb-df123eb968a0", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "5ea556" }, body: JSON.stringify({ sessionId: "5ea556", runId: "pre-fix", hypothesisId: "A", location: "lib/auth.ts:logger.error", message: "Auth.js logger error", data: { name: error.name, type: "type" in error ? error.type : undefined, message: error.message.slice(0, 180), oauthError: typeof cause?.error === "string" ? cause.error : undefined, providerId: typeof cause?.providerId === "string" ? cause.providerId : undefined }, timestamp: Date.now() }) }).catch(() => {})
      // #endregion
      console.error(`[auth][error] ${"type" in error ? error.type : error.name}: ${error.message}`)
    },
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
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
