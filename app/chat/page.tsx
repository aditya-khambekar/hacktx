"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ComponentProps, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

const MAX_SUGGESTIONS = 3
const DEMO_DELAY_MS = 400

const STATUS_LABELS: Record<string, string> = {
  maps_search: "Searching maps",
  web_search: "Checking listings",
  place: "Loading the place",
  reviews: "Reading reviews",
  directions_walking: "Walking to the Tower",
  directions_cycling: "Biking to the Tower",
  classify_reviews: "Classifying reviews",
  extract_listing: "Reading floor plans",
}

type SuggestionCardModel = {
  key: string
  placeId: string | null
  profile: Record<string, unknown>
}

type TranscriptItem =
  | { id: string; kind: "message"; role: "user" | "assistant"; text: string }
  | { id: string; kind: "suggestion"; card: SuggestionCardModel }

type Failure = {
  text: string
  signIn?: boolean
}

type ChatEvent =
  | { type: "status"; phase: string }
  | { type: "suggestion"; profile: Record<string, unknown> }
  | { type: "message"; text: string }
  | { type: "error"; error: string }
  | { type: "done"; conversationId: string | null }

type AddStatus = "saving" | "saved"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseSseBlock(block: string): ChatEvent | null {
  let eventName = ""
  const dataLines: string[] = []

  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "")
    if (!line || line.startsWith(":")) continue
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim()
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^ /, ""))
    }
  }

  if (!eventName || dataLines.length === 0) return null

  let payload: unknown
  try {
    payload = JSON.parse(dataLines.join("\n"))
  } catch {
    return { type: "error", error: "The reply could not be read." }
  }

  if (!isRecord(payload)) {
    return { type: "error", error: "The reply could not be read." }
  }

  switch (eventName) {
    case "status":
      return typeof payload.phase === "string"
        ? { type: "status", phase: payload.phase }
        : null
    case "suggestion":
      return { type: "suggestion", profile: payload }
    case "message":
      return typeof payload.text === "string"
        ? { type: "message", text: payload.text }
        : null
    case "error":
      return {
        type: "error",
        error:
          typeof payload.error === "string" && payload.error.trim()
            ? payload.error
            : "Something went wrong.",
      }
    case "done":
      return {
        type: "done",
        conversationId:
          typeof payload.conversationId === "string" ? payload.conversationId : null,
      }
    default:
      return null
  }
}

async function* readServerSentEvents(response: Response): AsyncGenerator<ChatEvent> {
  const body = response.body
  if (!body) {
    throw new Error("The chat service returned an empty response.")
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  function* take(flush: boolean): Generator<ChatEvent> {
    buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    let boundary = buffer.indexOf("\n\n")
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const event = parseSseBlock(block)
      if (event) yield event
      boundary = buffer.indexOf("\n\n")
    }
    if (flush && buffer.trim()) {
      const event = parseSseBlock(buffer)
      buffer = ""
      if (event) yield event
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (value) {
      buffer += decoder.decode(value, { stream: true })
    }
    if (done) {
      buffer += decoder.decode()
      yield* take(true)
      return
    }
    yield* take(false)
  }
}

async function errorText(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.error === "string" && body.error.trim()) {
      return body.error
    }
  } catch {
    // The body is not JSON.
  }
  return fallback
}

async function chatFailure(response: Response): Promise<Failure> {
  if (response.status === 401) {
    return { text: "Sign in to search West Campus apartments.", signIn: true }
  }
  if (response.status === 404) {
    return { text: "The chat service is not available yet." }
  }
  return {
    text: await errorText(response, `The chat service returned ${response.status}.`),
  }
}

async function addFailure(response: Response): Promise<string> {
  if (response.status === 401) return "Sign in to add this place."
  if (response.status === 404) {
    return "Could not add this place. The dashboard service is not available yet."
  }
  return errorText(response, `Could not add this place (${response.status}).`)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function formatHonestRating(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : null
}

function legDuration(
  profile: Record<string, unknown>,
  mode: "walking" | "cycling",
): string | null {
  const campus = profile.campus
  if (!isRecord(campus)) return null
  const leg = campus[mode]
  if (!isRecord(leg)) return null
  return typeof leg.formattedDuration === "string" && leg.formattedDuration.trim()
    ? leg.formattedDuration
    : null
}

function routeLeg(
  distanceMeters: number,
  durationSeconds: number,
  formattedDistance: string,
  formattedDuration: string,
) {
  return { distanceMeters, durationSeconds, formattedDistance, formattedDuration }
}

function demoProfile(input: {
  placeId: string
  name: string
  address: string | null
  thumbnail: string | null
  honestRating: number | null
  honestCount: number
  walking: ReturnType<typeof routeLeg> | null
  cycling: ReturnType<typeof routeLeg> | null
}): Record<string, unknown> {
  return {
    placeId: input.placeId,
    name: input.name,
    address: input.address,
    thumbnail: input.thumbnail,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${input.placeId}`,
    website: null,
    phone: null,
    labels: [],
    fetchedAt: "2026-10-24T20:00:00.000Z",
    googleRating: 4.1,
    googleReviewCount: 80,
    honestRating: input.honestRating,
    honestCount: input.honestCount,
    excludedTour: 1,
    unclearCount: 0,
    campus: {
      destination: "UT Tower",
      endCoords: "30.2862,-97.7394",
      walking: input.walking,
      cycling: input.cycling,
    },
    floorplans: [],
    reviews: [],
    sources: [],
  }
}

const DEMO_EVENTS: Array<{ event: string; data: unknown }> = [
  { event: "status", data: { phase: "maps_search" } },
  { event: "status", data: { phase: "web_search" } },
  { event: "status", data: { phase: "place" } },
  { event: "status", data: { phase: "reviews" } },
  { event: "status", data: { phase: "directions_walking" } },
  { event: "status", data: { phase: "directions_cycling" } },
  { event: "status", data: { phase: "classify_reviews" } },
  { event: "status", data: { phase: "extract_listing" } },
  {
    event: "suggestion",
    data: demoProfile({
      placeId: "demo-castilian",
      name: "The Castilian",
      address: "2323 San Antonio St, Austin, TX 78705",
      thumbnail:
        "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&h=450&q=80",
      honestRating: 4.2,
      honestCount: 18,
      walking: routeLeg(1700, 1320, "1.1 mi", "22 min"),
      cycling: null,
    }),
  },
  {
    event: "suggestion",
    data: demoProfile({
      placeId: "demo-26-west",
      name: "26 West",
      address: "2510 Leon St, Austin, TX 78705",
      thumbnail:
        "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=800&h=450&q=80",
      honestRating: null,
      honestCount: 0,
      walking: routeLeg(1200, 900, "0.7 mi", "15 min"),
      cycling: routeLeg(1200, 360, "0.7 mi", "6 min"),
    }),
  },
  {
    event: "suggestion",
    data: demoProfile({
      placeId: "demo-rambler",
      name: "Rambler",
      address: "2512 Rio Grande St, Austin, TX 78705",
      thumbnail:
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&h=450&q=80",
      honestRating: 3.8,
      honestCount: 11,
      walking: routeLeg(2100, 1680, "1.3 mi", "28 min"),
      cycling: routeLeg(2100, 540, "1.3 mi", "9 min"),
    }),
  },
  {
    event: "suggestion",
    data: demoProfile({
      placeId: "demo-hidden",
      name: "Should Not Appear",
      address: "1 Hidden St, Austin, TX 78705",
      thumbnail:
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&h=450&q=80",
      honestRating: 5,
      honestCount: 1,
      walking: routeLeg(100, 60, "0.1 mi", "1 min"),
      cycling: routeLeg(100, 30, "0.1 mi", "1 min"),
    }),
  },
  {
    event: "message",
    data: {
      text: "Here are a few West Campus places. Walk and bike times are to the UT Tower.",
    },
  },
  { event: "done", data: { conversationId: "demo-conversation" } },
]

function demoChatResponse(): Response {
  const encoder = new TextEncoder()
  const chunks = DEMO_EVENTS.map(({ event, data }) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
  )
  let index = 0

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, DEMO_DELAY_MS))
      }
      const chunk = chunks[index]
      index += 1
      if (chunk) controller.enqueue(chunk)
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  })
}

function cardId(card: SuggestionCardModel): string {
  return card.placeId ?? card.key
}

function SuggestionCard({
  card,
  saved,
  saving,
  error,
  onAdd,
}: {
  card: SuggestionCardModel
  saved: boolean
  saving: boolean
  error: string | null
  onAdd: (card: SuggestionCardModel) => void
}) {
  const name = typeof card.profile.name === "string" ? card.profile.name : "Apartment"
  const address =
    typeof card.profile.address === "string" && card.profile.address.trim()
      ? card.profile.address
      : null
  const thumbnail =
    typeof card.profile.thumbnail === "string" && card.profile.thumbnail.trim()
      ? card.profile.thumbnail
      : null
  const honestRating = formatHonestRating(card.profile.honestRating)
  const walking = legDuration(card.profile, "walking")
  const cycling = legDuration(card.profile, "cycling")

  return (
    <Card
      size="sm"
      data-artifact="suggestion"
      data-place-id={card.placeId ?? undefined}
      className="w-full"
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={`Photo of ${name}`}
          className="aspect-[16/9] w-full object-cover"
        />
      ) : null}
      <CardHeader>
        <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
          Suggestion
        </p>
        <h2 className="font-heading text-base leading-snug font-medium">{name}</h2>
        {address ? <CardDescription>{address}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1">
          <dt className="text-muted-foreground">Honest rating</dt>
          <dd className="text-right tabular-nums">{honestRating ?? ""}</dd>
          <dt className="text-muted-foreground">Walk</dt>
          <dd className="text-right">{walking ?? ""}</dd>
          <dt className="text-muted-foreground">Bike</dt>
          <dd className="text-right">{cycling ?? ""}</dd>
        </dl>
        <p className="mt-3 text-muted-foreground">to the UT Tower</p>
      </CardContent>
      <CardFooter>
        <div className="flex w-full flex-col items-start gap-2">
          <Button
            type="button"
            disabled={saving || saved}
            aria-busy={saving}
            onClick={() => onAdd(card)}
          >
            {saved ? "Added" : "Add to dashboard"}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
              {error === "Sign in to add this place." ? (
                <>
                  {" "}
                  <Link href="/" className="font-medium underline underline-offset-4">
                    Sign in
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  )
}

function isDemoRequest() {
  return new URLSearchParams(window.location.search).get("demo") === "1"
}

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(max-width: 800px)")
    const apply = () => setNarrow(query.matches)
    apply()
    query.addEventListener("change", apply)
    return () => query.removeEventListener("change", apply)
  }, [])

  return narrow
}

function ChatWorkspace() {
  const narrow = useNarrowViewport()
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [transcript, setTranscript] = useState<TranscriptItem[]>([])
  const [addStatus, setAddStatus] = useState<Record<string, AddStatus>>({})
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})

  const conversationIdRef = useRef<string | null>(null)
  const sendingRef = useRef(false)
  const liveRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const addingRef = useRef(new Set<string>())
  const savedRef = useRef(new Set<string>())
  const suggestionsThisTurnRef = useRef(0)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    liveRef.current = true
    return () => {
      liveRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [transcript, status, failure])

  async function onAdd(card: SuggestionCardModel) {
    const id = cardId(card)
    if (addingRef.current.has(id) || savedRef.current.has(id)) return
    addingRef.current.add(id)
    setAddStatus((current) => ({ ...current, [id]: "saving" }))
    setAddErrors((current) => {
      if (!(id in current)) return current
      const next = { ...current }
      delete next[id]
      return next
    })

    try {
      const response = await fetch("/api/apartments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: card.profile }),
      })
      if (!liveRef.current) return
      if (!response.ok) {
        const message = await addFailure(response)
        if (!liveRef.current) return
        setAddStatus((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
        setAddErrors((current) => ({ ...current, [id]: message }))
        return
      }
      savedRef.current.add(id)
      setAddStatus((current) => ({ ...current, [id]: "saved" }))
    } catch {
      if (!liveRef.current) return
      setAddStatus((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      setAddErrors((current) => ({ ...current, [id]: "Could not add this place." }))
    } finally {
      addingRef.current.delete(id)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || sendingRef.current) return

    sendingRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    setDraft("")
    setPending(true)
    setStatus(null)
    setFailure(null)
    setAddErrors({})
    suggestionsThisTurnRef.current = 0
    setTranscript((current) => [
      ...current,
      { id: crypto.randomUUID(), kind: "message", role: "user", text: message },
    ])

    const apply = (chatEvent: ChatEvent) => {
      if (!liveRef.current) return
      switch (chatEvent.type) {
        case "status":
          setStatus(STATUS_LABELS[chatEvent.phase] ?? "Working on that")
          return
        case "suggestion":
          if (suggestionsThisTurnRef.current >= MAX_SUGGESTIONS) return
          suggestionsThisTurnRef.current += 1
          setTranscript((current) => {
            const placeId =
              typeof chatEvent.profile.placeId === "string" ? chatEvent.profile.placeId : null
            return [
              ...current,
              {
                id: crypto.randomUUID(),
                kind: "suggestion",
                card: {
                  key: `${placeId ?? "suggestion"}-${suggestionsThisTurnRef.current}`,
                  placeId,
                  profile: chatEvent.profile,
                },
              },
            ]
          })
          return
        case "message":
          setStatus(null)
          setTranscript((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              kind: "message",
              role: "assistant",
              text: chatEvent.text,
            },
          ])
          return
        case "error":
          setStatus(null)
          setFailure({ text: chatEvent.error })
          return
        case "done":
          setStatus(null)
          if (chatEvent.conversationId) {
            conversationIdRef.current = chatEvent.conversationId
          }
          return
      }
    }

    try {
      const payload = conversationIdRef.current
        ? { message, conversationId: conversationIdRef.current }
        : { message }
      const response = isDemoRequest()
        ? demoChatResponse()
        : await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          })

      if (!response.ok) {
        if (liveRef.current) setFailure(await chatFailure(response))
        return
      }

      const contentType = response.headers.get("content-type") ?? ""
      if (!contentType.includes("text/event-stream")) {
        if (liveRef.current) {
          setFailure({ text: "The chat service is not available yet." })
        }
        return
      }

      for await (const chatEvent of readServerSentEvents(response)) {
        if (!liveRef.current) return
        apply(chatEvent)
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    } catch (error) {
      if (isAbortError(error) || !liveRef.current) return
      setFailure({ text: "Could not reach the chat service." })
    } finally {
      sendingRef.current = false
      if (liveRef.current) {
        setPending(false)
        setStatus(null)
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <ResizablePanelGroup
        key={narrow ? "vertical" : "horizontal"}
        orientation={narrow ? "vertical" : "horizontal"}
        className="min-h-0 flex-1"
      >
        <ResizablePanel
          defaultSize={narrow ? "58%" : "66.67%"}
          minSize={narrow ? "30%" : "35%"}
          className="min-w-0"
        >
          <section aria-label="Dashboard" className="flex h-full min-h-0 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
              Dashboard
            </div>
          </section>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          defaultSize={narrow ? "42%" : "33.33%"}
          minSize={narrow ? "32%" : 280}
          className="min-w-0"
        >
          <section aria-label="Chat" className="flex h-full min-h-0 flex-col bg-muted/40">
            <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <ol className="flex flex-col gap-3">
                {transcript.length === 0 && !pending ? (
                  <li className="py-8 text-center text-sm text-muted-foreground">
                    Ask for a West Campus place.
                  </li>
                ) : null}
                {transcript.map((item) => {
                  if (item.kind === "suggestion") {
                    const id = cardId(item.card)
                    return (
                      <li key={item.id} className="flex justify-start">
                        <div className="w-full max-w-[95%]">
                          <SuggestionCard
                            card={item.card}
                            saved={addStatus[id] === "saved"}
                            saving={addStatus[id] === "saving"}
                            error={addErrors[id] ?? null}
                            onAdd={onAdd}
                          />
                        </div>
                      </li>
                    )
                  }

                  return (
                    <li
                      key={item.id}
                      className={
                        item.role === "user" ? "flex justify-end" : "flex justify-start"
                      }
                    >
                      <p
                        className={
                          item.role === "user"
                            ? "max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm whitespace-pre-wrap break-words text-primary-foreground"
                            : "max-w-[85%] rounded-2xl bg-card px-3 py-2 text-sm whitespace-pre-wrap break-words ring-1 ring-foreground/10"
                        }
                      >
                        {item.text}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </div>
            <div className="flex flex-col gap-2 px-4 pb-2">
              <p
                aria-live="polite"
                className={
                  status
                    ? "flex items-center gap-2 text-sm text-muted-foreground"
                    : "sr-only"
                }
              >
                {status ? (
                  <span
                    className="size-1.5 animate-pulse rounded-full bg-primary"
                    aria-hidden="true"
                  />
                ) : null}
                {status ?? ""}
              </p>
              {failure ? (
                <p role="alert" className="text-sm text-destructive">
                  {failure.text}
                  {failure.signIn ? (
                    <>
                      {" "}
                      <Link href="/" className="font-medium underline underline-offset-4">
                        Sign in
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <form onSubmit={onSubmit} className="flex items-center gap-2 border-t p-4">
              <label htmlFor="chat-message" className="sr-only">
                Message
              </label>
              <Input
                id="chat-message"
                className="min-w-0 flex-1"
                value={draft}
                placeholder="Pet-friendly 2-bed under $1,500"
                disabled={pending}
                autoComplete="off"
                autoFocus
                // The styled input forwards Base UI's onValueChange, which is
                // how a controlled value stays in sync.
                {...({
                  onValueChange: (value: string) => setDraft(value),
                } as ComponentProps<typeof Input>)}
              />
              <Button type="submit" disabled={pending || draft.trim() === ""}>
                Send
              </Button>
            </form>
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export default function ChatPage() {
  return <ChatWorkspace />
}
