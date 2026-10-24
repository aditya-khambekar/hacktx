import type { NextRequest } from "next/server"

import { handlers } from "@/lib/auth"

function logAuthRequest(req: NextRequest, method: "GET" | "POST") {
  const { pathname, searchParams } = req.nextUrl
  // #region agent log
  fetch("http://127.0.0.1:7918/ingest/7f2113e6-8bdc-48b8-8acb-df123eb968a0", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "5ea556" }, body: JSON.stringify({ sessionId: "5ea556", runId: "pre-fix", hypothesisId: "C", location: "app/api/auth/[...nextauth]/route.ts", message: "Auth route request", data: { method, pathname, oauthError: searchParams.get("error"), hasCode: searchParams.has("code"), hasState: searchParams.has("state") }, timestamp: Date.now() }) }).catch(() => {})
  // #endregion
}

export function GET(req: NextRequest) {
  logAuthRequest(req, "GET")
  return handlers.GET(req)
}

export function POST(req: NextRequest) {
  logAuthRequest(req, "POST")
  return handlers.POST(req)
}
