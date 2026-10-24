import Link from "next/link"
import { Suspense } from "react"

import { BrandMark } from "@/components/brand-mark"
import { LoginForm } from "@/components/login-form"
import { getLandingSession } from "@/lib/auth"

const points = [
  {
    title: "Ask in plain language",
    body: "Beds, a budget, pet-friendly. Unlisted searches West Campus and comes back with a few places.",
  },
  {
    title: "A rating from residents",
    body: "The honest score averages reviews about living there. Tour reviews stay out of that average and show the reason they were set aside.",
  },
  {
    title: "Walk and bike to the Tower",
    body: "Every place shows the walk and the ride to the UT Tower, not the nearest classroom.",
  },
]

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link href="/" aria-label="Unlisted">
          <BrandMark />
        </Link>
        <Suspense fallback={<span className="h-8 w-28" aria-hidden="true" />}>
          <HeaderAccount />
        </Suspense>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-8 md:px-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,28rem)] lg:py-16">
        <section>
          <p className="text-sm font-medium text-primary">West Campus, Austin</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Find a West Campus place you can actually live with.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
            Unlisted searches apartments near UT, sets tour reviews aside, and shows
            the walk and bike to the Tower.
          </p>
          <ol className="mt-10 max-w-xl space-y-6">
            {points.map((point, index) => (
              <li key={point.title} className="flex gap-4">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-medium">{point.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{point.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl bg-muted p-6 md:p-8" aria-label="Google sign-in">
          <Suspense fallback={<LoginCardFallback />}>
            <LandingAuth searchParams={searchParams} />
          </Suspense>
        </section>
      </main>

      <footer className="flex flex-wrap gap-x-6 gap-y-2 px-6 py-8 text-sm text-muted-foreground md:px-10">
        <span>Unlisted</span>
        <a id="terms" href="#terms" className="underline-offset-4 hover:underline">
          Terms of Service
        </a>
        <a id="privacy" href="#privacy" className="underline-offset-4 hover:underline">
          Privacy Policy
        </a>
      </footer>
    </div>
  )
}

async function HeaderAccount() {
  const session = await getLandingSession()
  if (!session?.user) {
    return null
  }

  return (
    <Link href="/chat" className="text-sm font-medium underline-offset-4 hover:underline">
      Continue
    </Link>
  )
}

async function LandingAuth({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const [params, session] = await Promise.all([searchParams, getLandingSession()])
  const error = Array.isArray(params.error) ? params.error[0] : params.error
  // #region agent log
  fetch("http://127.0.0.1:7918/ingest/7f2113e6-8bdc-48b8-8acb-df123eb968a0", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "5ea556" }, body: JSON.stringify({ sessionId: "5ea556", runId: "pre-fix", hypothesisId: "D", location: "app/page.tsx:LandingAuth", message: "Landing page error query", data: { error: error ?? null, signedIn: Boolean(session?.user) }, timestamp: Date.now() }) }).catch(() => {})
  // #endregion

  return <LoginForm user={session?.user ?? null} error={error} />
}

function LoginCardFallback() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="h-56 animate-pulse rounded-xl bg-card ring-1 ring-foreground/10" />
      <div className="mx-auto h-4 w-48 animate-pulse rounded bg-foreground/10" />
    </div>
  )
}
