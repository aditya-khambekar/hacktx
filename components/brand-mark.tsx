/** Shared doorway symbol for the header, landing page and compact brand uses. */
export function BrandIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false" className="shrink-0">
      <rect width="40" height="40" rx="10" fill="var(--color-clay-tint)" />
      <path d="M13 29V12a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" fill="none" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 28.5V15h6v13.5" fill="none" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21" cy="22" r="1" fill="var(--color-ink)" />
      <path d="M11.5 29h17" stroke="var(--color-clay)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandIcon />
      <span className="font-brand pb-1 text-[1.75rem] leading-none font-semibold tracking-[-0.025em] text-ink">
        un<span className="relative inline-block">l<span className="inline-block bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(to bottom, var(--color-clay) 0.34em, var(--color-ink) 0.34em)" }}>i</span>sted<span className="absolute inset-x-0 -bottom-[0.15em] h-0.5 rounded-full bg-clay" aria-hidden="true" /></span>
      </span>
    </span>
  );
}
