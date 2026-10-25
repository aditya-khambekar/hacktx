"use client";

import { AppHeader } from "@/components/app-header";
import { useState } from "react";
import { ChevronDown, Close, Cloud, Menu, Share } from "./icons";

export type WorkspaceView = "workspace" | "saved";

type SiteHeaderProps = {
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  savedCount: number;
  saveStatus: string;
  onShare: () => void;
  shareLabel: string;
};

const NAV: Array<{ id: WorkspaceView; label: string }> = [
  { id: "workspace", label: "My workspace" },
  { id: "saved", label: "Saved places" },
];

export function SiteHeader({ view, onViewChange, savedCount, saveStatus, onShare, shareLabel }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = NAV.map((item) => {
    const active = item.id === view;
    return (
      <button
        key={item.id}
        type="button"
        aria-current={active ? "page" : undefined}
        onClick={() => {
          onViewChange(item.id);
          setMenuOpen(false);
        }}
        className={`relative flex items-center gap-1.5 py-2.5 text-sm whitespace-nowrap transition-colors md:h-full md:py-0 ${
          active ? "font-semibold text-clay-dark" : "text-ink-soft hover:text-ink"
        }`}
      >
        {item.label}
        {item.id === "saved" && savedCount > 0 && <span className="text-xs font-medium text-ink-soft tabular-nums">({savedCount})</span>}
        {active && <span className="absolute inset-x-0 bottom-0 hidden h-0.5 bg-clay-dark md:block" />}
      </button>
    );
  });

  return (
    <AppHeader>
        <label className="relative ml-3 hidden items-center sm:flex">
          <span className="sr-only">Campus</span>
          <select
            defaultValue="ut-austin"
            className="w-[110px] cursor-pointer appearance-none rounded-md bg-transparent py-1.5 pr-8 pl-2 text-sm text-ink-soft hover:bg-chip focus-visible:outline-2 focus-visible:outline-clay"
          >
            <option value="ut-austin">UT Austin</option>
            <option value="other" disabled>
              More campuses soon
            </option>
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-2 text-ink-soft" />
        </label>

        <nav aria-label="Primary" className="ml-6 hidden h-full items-stretch gap-7 md:flex lg:ml-[26px]">
          {navItems}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs whitespace-nowrap text-ink-soft xl:flex" aria-live="polite">
            <Cloud size={16} />
            {saveStatus}
          </span>
          <button
            type="button"
            onClick={onShare}
            className="ml-2 hidden h-[37px] items-center gap-2 rounded-md border border-line bg-paper-raised px-3.5 text-[13px] font-semibold whitespace-nowrap text-ink hover:border-ink/30 sm:flex"
          >
            <Share size={16} />
            <span aria-live="polite">{shareLabel}</span>
          </button>
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-sage text-[11px] font-semibold text-sage-ink" title="Signed-in user (sample)">
            JL
          </span>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-ink hover:bg-chip md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <Close size={20} /> : <Menu size={20} />}
          </button>
        </div>

      {menuOpen && (
        <nav id="mobile-nav" aria-label="Primary" className="absolute inset-x-0 top-full flex flex-col border-b border-line bg-paper-raised px-4 pt-1 pb-4 md:hidden">
          {navItems}
          <button
            type="button"
            onClick={() => {
              onShare();
              setMenuOpen(false);
            }}
            className="mt-2 flex h-11 items-center justify-center gap-2 rounded-md border border-line text-sm font-semibold sm:hidden"
          >
            <Share size={16} />
            {shareLabel}
          </button>
        </nav>
      )}
    </AppHeader>
  );
}
