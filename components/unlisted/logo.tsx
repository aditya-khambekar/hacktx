/** "The underline" direction: a u tile, and a wordmark with "listed" underlined in clay. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" focusable="false">
      <rect width="34" height="34" rx="8" fill="#ead7ce" />
      <path d="M10 8h4.6v9.6c0 2 1 3 2.5 3s2.6-1 2.6-3V8h4.6v16h-4.3v-1.9c-.9 1.4-2.4 2.2-4.3 2.2-3.5 0-5.7-2.3-5.7-6.3z" fill="var(--color-brand)" />
      <rect x="10" y="27" width="14.3" height="2.6" fill="var(--color-clay)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[30px] leading-none font-extrabold tracking-[-0.04em] text-brand">
        un<span className="border-b-[3px] border-clay">listed</span>
      </span>
    </span>
  );
}
