import Link from "next/link"
import { Suspense } from "react"

import { BrandMark } from "@/components/brand-mark"
import { getLandingSession } from "@/lib/auth"

export default function ChatLayout({ children }: LayoutProps<"/chat">) {
  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <Link href="/" aria-label="Unlisted">
          <BrandMark />
        </Link>
        <Suspense fallback={<span className="size-8" aria-hidden="true" />}>
          <AccountPhoto />
        </Suspense>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

async function AccountPhoto() {
  const session = await getLandingSession()
  const user = session?.user
  if (!user) return null

  const label = user.name || user.email || "Account"
  if (user.image) {
    return (
      <img src={user.image} alt={label} className="size-8 rounded-full object-cover" />
    )
  }

  const initial = label.trim().charAt(0).toUpperCase()
  return (
    <span
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-medium"
    >
      {initial || "?"}
    </span>
  )
}
