import type { NextRequest } from "next/server"

import { handlers } from "@/lib/auth"

export function GET(req: NextRequest) {
  return handlers.GET(req)
}

export function POST(req: NextRequest) {
  return handlers.POST(req)
}
