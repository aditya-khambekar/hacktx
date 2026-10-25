import Link from "next/link";
import type { ReactNode } from "react";
import { formatUsd, summarizeCosts } from "./costs";
import { FeeBreakdown } from "./fee-breakdown";
import { ArrowRight, Bike, Sparkle, Star, Walk } from "./icons";
import { ListingPhoto } from "./listing-photo";
import { Logo } from "./logo";
import { SAMPLE_SHORTLIST } from "./sample-data";

const preview = SAMPLE_SHORTLIST[0];
const previewCosts = summarizeCosts(preview);

const COST_KINDS = [
  {
    label: "Advertised rent",
    amount: `${formatUsd(previewCosts.rent ?? 0)} / mo`,
    body: "The number on the listing. Useful, but rarely what you pay.",
    tone: "border-line bg-paper-raised",
  },
  {
    label: "+ Additional monthly fees",
    amount: `~${formatUsd((previewCosts.monthlyTotal ?? 0) - (previewCosts.rent ?? 0))} / mo`,
    body: "Utilities, parking, trash, amenity fees. Added to rent for a true monthly total.",
    tone: "border-line bg-paper-raised",
  },
  {
    label: "One-time charges",
    amount: `${formatUsd(previewCosts.oneTimeTotal)} at move-in`,
    body: "Application, admin, and deposits. Kept separate so they never inflate your rent.",
    tone: "border-dashed border-clay/50 bg-clay-tint/60",
  },
];

const FEATURES: Array<{ icon: ReactNode; title: string; body: string }> = [
  {
    icon: <Star size={18} />,
    title: "A score from people who live there",
    body: "Reviews about tours and the leasing pitch are set aside, with the reason shown. The resident score averages only reviews about living there.",
  },
  {
    icon: <Walk size={18} />,
    title: "Walk and bike to the Tower",
    body: "Every place shows the walk and the ride to the UT Tower, so “close to campus” means the same thing everywhere.",
  },
  {
    icon: <Sparkle size={18} />,
    title: "An assistant that asks the awkward questions",
    body: "Tell it what matters. It compares tradeoffs and drafts a message to property management that you review before anything is sent.",
  },
];

const STEPS = [
  { title: "Set your priorities", body: "Budget, bedrooms, the walk to class. Edit them any time." },
  { title: "Compare side by side", body: "Rent, fees, lease terms, and commute line up across every place." },
  { title: "Confirm with the property", body: "Unknown fees stay marked unknown until the property tells you." },
];

function PrimaryCta({ children = "Open your workspace" }: { children?: ReactNode }) {
  return (
    <Link
      href="/chat"
      className="inline-flex h-12 items-center gap-2 rounded-lg bg-clay px-5 text-[15px] font-semibold text-white shadow-sm hover:bg-clay-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
    >
      {children}
      <ArrowRight size={18} />
    </Link>
  );
}

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-paper font-sans text-ink">
      <header className="border-b border-line bg-paper-raised">
        <div className="mx-auto flex h-[70px] max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="Unlisted home" className="rounded-lg focus-visible:outline-2 focus-visible:outline-clay">
            <Logo />
          </Link>
          <nav aria-label="Sections" className="ml-6 hidden gap-6 text-sm text-ink-soft md:flex">
            <a href="#costs" className="hover:text-ink">
              What you pay
            </a>
            <a href="#features" className="hover:text-ink">
              Features
            </a>
            <a href="#how" className="hover:text-ink">
              How it works
            </a>
          </nav>
          <Link
            href="/chat"
            className="ml-auto inline-flex h-[37px] items-center rounded-md border border-line px-3.5 text-[13px] font-semibold whitespace-nowrap hover:border-ink/30"
          >
            Open workspace
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pt-20 lg:pb-24">
          <div>
            <p className="text-[12px] tracking-[0.06em] text-clay-dark uppercase">West Campus · UT Austin</p>
            <h1 className="mt-4 text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-[60px]">A clearer way home.</h1>
            <p className="mt-4 text-[20px] text-ink-soft">The details that make a difference.</p>
            <p className="mt-6 max-w-xl text-[16px] leading-[1.6] text-ink">
              Unlisted compares West Campus apartments by what you&rsquo;ll actually pay: advertised rent, the monthly fees on top of it, and what&rsquo;s
              due at move-in. Plus the real walk to the UT Tower and reviews from people who live there.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryCta />
              <a href="#how" className="inline-flex h-12 items-center rounded-lg border border-line bg-paper-raised px-5 text-[15px] font-semibold hover:border-ink/30">
                See how it works
              </a>
            </div>
            <p className="mt-4 text-[12px] text-ink-soft">Demo with sample listings. Google sign-in and live search connect with the backend.</p>
          </div>

          <div className="relative">
            <div className="absolute -inset-2 -z-0 rounded-[24px] bg-sage sm:-inset-6 sm:rounded-[28px]" aria-hidden="true" />
            <article aria-label={`Sample listing preview: ${preview.name}`} className="relative overflow-hidden rounded-[14px] border border-line bg-paper-raised shadow-[0_12px_40px_rgb(35_35_33/0.08)]">
              <div className="relative h-[140px]">
                <ListingPhoto tone={preview.photoTone} name={preview.name} />
                <span className="absolute top-3 left-3 rounded-[3px] bg-paper-raised px-1.5 py-[3px] text-[9.5px] leading-none tracking-[0.04em] text-ink-soft uppercase">
                  Illustrative listing
                </span>
              </div>
              <div className="px-4 pt-4 pb-4">
                <h2 className="text-[20px]">{preview.name}</h2>
                <p className="mt-1 text-[11px] text-ink-soft">
                  {preview.street} · {preview.neighborhood}
                </p>
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-[26px] leading-none tabular-nums">{formatUsd(preview.advertisedRent ?? 0)}</span>
                    <span className="text-[11px] text-ink-soft">/ person / mo</span>
                  </p>
                  <p className="flex items-center gap-3 text-[12px] text-ink-soft">
                    <span className="flex items-center gap-1">
                      <Walk size={14} /> {preview.walking?.formattedDuration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bike size={14} /> {preview.cycling?.formattedDuration}
                    </span>
                  </p>
                </div>
                <div className="mt-4">
                  <FeeBreakdown apartment={preview} defaultOpen />
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="costs" className="scroll-mt-6 border-y border-line bg-paper-raised">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <p className="text-[12px] tracking-[0.06em] text-clay-dark uppercase">What you pay</p>
            <h2 className="mt-3 max-w-2xl text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-[38px]">Three numbers, never blended.</h2>
            <p className="mt-3 max-w-2xl text-[16px] leading-[1.6] text-ink-soft">
              Listings lead with rent. We keep rent, recurring fees, and move-in charges apart, and we mark estimates and unknowns instead of guessing.
            </p>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {COST_KINDS.map((kind, index) => (
                <li key={kind.label} className={`rounded-[12px] border p-5 ${kind.tone}`}>
                  <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.06em] text-ink-soft uppercase">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-chip text-[10px] text-ink">{index + 1}</span>
                    {kind.label}
                  </p>
                  <p className="mt-3 text-[24px] font-semibold tabular-nums">{kind.amount}</p>
                  <p className="mt-2 text-[14px] leading-[1.55] text-ink-soft">{kind.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[12px] text-ink-soft">Example figures from the sample listing {preview.name}. &ldquo;~&rdquo; marks an estimate.</p>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-16 sm:px-6 lg:py-20">
          <p className="text-[12px] tracking-[0.06em] text-clay-dark uppercase">Beyond the listing</p>
          <h2 className="mt-3 max-w-2xl text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-[38px]">The parts a listing leaves out.</h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="rounded-[12px] border border-line bg-paper-raised p-5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-clay-tint text-clay-dark">{feature.icon}</span>
                <h3 className="mt-4 text-[16px] font-semibold">{feature.title}</h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-ink-soft">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="scroll-mt-6 bg-sage">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-20">
            <div>
              <p className="text-[12px] tracking-[0.06em] text-sage-ink uppercase">How it works</p>
              <h2 className="mt-3 text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-[38px]">From &ldquo;looks nice&rdquo; to &ldquo;signed.&rdquo;</h2>
              <div className="mt-8">
                <PrimaryCta>Start your shortlist</PrimaryCta>
              </div>
            </div>
            <ol className="flex flex-col gap-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4 rounded-[12px] bg-paper-raised p-5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-semibold text-white">{index + 1}</span>
                  <div>
                    <h3 className="text-[16px] font-semibold">{step.title}</h3>
                    <p className="mt-1 text-[14px] leading-[1.55] text-ink-soft">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper-raised">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-[12px] text-ink-soft sm:px-6">
          <span className="text-[15px] font-extrabold tracking-[-0.03em] text-brand">
            un<span className="border-b-2 border-clay">listed</span>
          </span>
          <span>Sample data: fictional listings, not verified prices or availability.</span>
          <span>Made for life around UT Austin.</span>
        </div>
      </footer>
    </div>
  );
}
