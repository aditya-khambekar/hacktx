import Link from "next/link"
import { cn } from "cn"

import { signInWithGoogle, signOutOfStride } from "@/app/actions/auth"
import { GoogleSubmitButton } from "@/components/google-submit-button"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field"

export type LandingUser = {
  name?: string | null
  email?: string | null
}

export function LoginForm({
  className,
  user,
  error,
  ...props
}: React.ComponentProps<"div"> & {
  user: LandingUser | null
  error?: string | null
}) {
  const message = signInMessage(error)
  const label = user?.name || user?.email

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            {user
              ? label
                ? `You're signed in as ${label}.`
                : "You're signed in."
              : "We'll create your Unlisted account the first time you continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <FieldGroup>
              <Field>
                <Link href="/chat" className={cn(buttonVariants({ size: "lg" }), "h-11 w-full")}>
                  Continue to search
                </Link>
              </Field>
              <Field>
                <form action={signOutOfStride}>
                  <Button variant="ghost" type="submit" className="w-full">
                    Sign out
                  </Button>
                </form>
              </Field>
            </FieldGroup>
          ) : (
            <form action={signInWithGoogle}>
              <FieldGroup>
                {message ? (
                  <p role="alert" className="text-center text-sm text-destructive">
                    {message}
                  </p>
                ) : null}
                <Field>
                  <GoogleSubmitButton />
                  <FieldDescription className="text-center">
                    New here? This same button creates your account.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#terms">Terms of Service</a>{" "}
        and <a href="#privacy">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}

function signInMessage(error: string | null | undefined) {
  switch (error) {
    case "config":
    case "Configuration":
      return "Google sign-in needs AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET, and DATABASE_URL."
    case "AccessDenied":
      return "Google did not grant access to Unlisted."
    case "OAuthAccountNotLinked":
      return "That email is already linked to a different sign-in method."
    case undefined:
    case null:
    case "":
      return null
    default:
      return "Google sign-in did not finish. Try again."
  }
}
