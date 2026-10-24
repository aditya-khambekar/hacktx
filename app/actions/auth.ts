"use server"

import { AuthError } from "next-auth"
import { redirect } from "next/navigation"

import { googleAuthReady, signIn, signOut } from "@/lib/auth"

export async function signInWithGoogle() {
  const ready = googleAuthReady()
  // #region agent log
  fetch("http://127.0.0.1:7918/ingest/7f2113e6-8bdc-48b8-8acb-df123eb968a0", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "5ea556" }, body: JSON.stringify({ sessionId: "5ea556", runId: "pre-fix", hypothesisId: "B", location: "app/actions/auth.ts:signInWithGoogle", message: "Google sign-in action started", data: { ready }, timestamp: Date.now() }) }).catch(() => {})
  // #endregion
  if (!ready) {
    redirect("/?error=config")
  }

  try {
    await signIn("google", { redirectTo: "/chat" })
  } catch (error) {
    const authType = error instanceof AuthError ? error.type : undefined
    // #region agent log
    fetch("http://127.0.0.1:7918/ingest/7f2113e6-8bdc-48b8-8acb-df123eb968a0", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "5ea556" }, body: JSON.stringify({ sessionId: "5ea556", runId: "pre-fix", hypothesisId: "B", location: "app/actions/auth.ts:signInWithGoogle:catch", message: "Google sign-in action threw", data: { name: error instanceof Error ? error.name : typeof error, authType, isAuthError: error instanceof AuthError }, timestamp: Date.now() }) }).catch(() => {})
    // #endregion
    if (error instanceof AuthError) {
      redirect(`/?error=${error.type}`)
    }
    throw error
  }
}

export async function signOutOfStride() {
  await signOut({ redirectTo: "/" })
}
