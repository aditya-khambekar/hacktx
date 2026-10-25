import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper-raised">
      <div className="flex min-h-[70px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-clay" aria-label="Unlisted home"><BrandMark /></Link>
        {children}
      </div>
    </header>
  );
}
