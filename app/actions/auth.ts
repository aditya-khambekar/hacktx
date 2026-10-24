"use server"

import { AuthError } from "next-auth"
import { redirect } from "next/navigation"

import { googleAuthReady, signIn, signOut } from "@/lib/auth"

export async function signInWithGoogle() {
  if (!googleAuthReady()) {
    redirect("/?error=config")
  }

  try {
    await signIn("google", { redirectTo: "/chat" })
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/?error=${error.type}`)
    }
    throw error
  }
}

export async function signOutOfStride() {
  await signOut({ redirectTo: "/" })
}
