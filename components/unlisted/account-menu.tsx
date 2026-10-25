"use client";

import { signOutOfStride } from "@/app/actions/auth";
import { useEffect, useId, useRef, useState } from "react";
import type { HeaderUser } from "./site-header";

type AccountMenuProps = {
  user: HeaderUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function userInitials(user: HeaderUser) {
  const source = user.name?.trim() || user.email?.trim() || "";
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function AccountMenu({ user, open, onOpenChange }: AccountMenuProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = Boolean(user.image) && !imageFailed;
  const displayName = user.name?.trim() || "Signed-in user";
  const email = user.email?.trim() || "";

  useEffect(() => {
    setImageFailed(false);
  }, [user.image]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        aria-label="Account menu"
        onClick={() => onOpenChange(!open)}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-clay"
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google avatar URL from session
          <img
            src={user.image!}
            alt=""
            width={34}
            height={34}
            referrerPolicy="no-referrer"
            className="h-[34px] w-[34px] shrink-0 rounded-full object-cover ring-1 ring-line"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-sage text-[11px] font-semibold text-sage-ink">
            {userInitials(user)}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-40 mt-2 w-64 rounded-md border border-line bg-paper-raised p-3 shadow-sm"
        >
          <div className="px-1 py-1" role="none">
            <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
            {email ? <p className="mt-0.5 truncate text-xs text-ink-soft" title={email}>{email}</p> : null}
          </div>
          <div className="my-2 border-t border-line" role="none" />
          <form action={signOutOfStride}>
            <button
              type="submit"
              role="menuitem"
              className="flex h-10 w-full items-center rounded-md px-2 text-sm font-semibold text-ink hover:bg-chip"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
