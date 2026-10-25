# West Campus apartment finder

Implementation spec for agents building the app. Product intent lives in the plan; names, endpoints, and payloads in this file are the ones to code against.

UT students sign in with Google, search West Campus apartments through a Muse Spark agent, and save a JSON profile per apartment. The profile holds floor plans, fees, walk and bike time to the UT Tower, reviews, and an honest rating. Muse labels each review as about a tour or about the apartment. Code computes the average from the apartment labels only.

One Next.js app. Route Handlers are the backend. No Python service. No JSON files on disk. Secrets never reach the browser.

## Curated apartment data for the hackathon

The user-authorized workbook `outputs/unlisted-apartments-20261025/Unlisted-apartment-dataset.xlsx`
is compiled into `lib/curated-apartment-data.ts`; the app imports that TypeScript data,
not the workbook or a JSON file at runtime. `lib/curated-apartments.ts` overlays the
curated floor plans, fees, amenities and lease terms for ION Austin, Union on San
Antonio, Moontower and the eight separately addressed Block locations. No database
migration, environment variable or automatic shortlist insertion is needed.

Match a known Austin property by explicit name aliases and, for The Block, its
location name or street address. A generic Block result must not inherit one
building's data. Never replace reviews, ratings, routes, user labels or place IDs.
Apply the overlay to new profile builds and validated saved/cache reads, including
the agent's board memory, so existing saves get current curated details on reload.

`ApartmentProfile.curated` carries the trusted record's provenance, dated lease
terms, amenities and complete fee schedule. Each curated floor plan also carries
its original row in `floorplans[].curated`, preserving ranges, installment cadence,
eligibility, occupancy, reported totals and floor-plan image URLs. These optional
fields are regenerated server-side from the bundled data, never trusted from a
client submission. Non-curated profiles retain source-validated search and official-page research.
Curated source URLs use the supplied official URL when available; otherwise use a
`curated:<record-id>` source identifier and display “User-supplied pricing” without
inventing a public source URL.

Only unconditional, fixed required charges enter calculated required subtotals.
Optional, conditional, alternative, annual, usage-based, range and percentage fees
remain separately visible with their conditions. Deposits are refundable only when
explicitly stated. Per-installment prices must retain that label. Never assume that
an unconfirmed rent basis means per person. Missing values remain unknown; dated
curated records are labeled “Curated demo data”, not live availability or quotes.

Bedroom priorities also project the card/detail floor-plan menus onto the exact
selected bedroom count. Displayed rent and fees use a remaining plan. Filtering
never rewrites the saved profile; clearing the priority restores all plans.

## Constants

### Criteria-based recommendations and Snowflake

Muse calls `recommend_apartments` for requests that combine price, room counts,
amenities or ranking. Arguments are validated data, never SQL. Defaults are base
rent, per-person pricing, strict "under" a supplied maximum, resident-review score,
at least one resident review, any room type, and no SMART-only options unless
requested. The reply states these assumptions and the scope actually checked.

Snowflake is the primary public catalogue query engine via its SQL REST API.
`lib/snowflake.ts` accepts only configured Snowflake account hosts, binds values,
bounds async polling and result partitions, and keeps all credentials server-side.
Use `UNLISTED_FLOORPLANS` and `UNLISTED_RESEARCH` in the configured database/schema.
`npm run snowflake:seed` uploads the bundled public catalogue, without user labels,
accounts or conversations. UNLISTED_RESEARCH is an optional read-only public cache;
fresh runtime research is written only to the existing Postgres ApartmentResearch cache. Snowflake errors or missing configuration
fall back to public Postgres research and the curated catalogue. The result names
the provider actually used; fallback must never be described as a Snowflake hit.

The catalogue filters all matching plans before selecting a bounded research pool
of up to eight properties. SerpAPI verifies known Austin identities and refreshes
one review page per candidate. Muse labels reviews; code computes and ranks the
resident scores. Recommendation passes omit route calls; the existing refresh flow populates routes. Each uncached candidate uses discovery, place verification and one reviews page. Retain the
24-call per-message SerpAPI cap. Unknown price/basis, unknown requested amenities,
and incomplete required recurring costs never become confirmed budget matches.
Room counts and price constraints must hold for the SAME plan. Shared rooms,
SMART restrictions, price ranges and promotions remain explicit. Highest rated
means among the candidates checked, not all apartments in Austin.

Server-only Snowflake configuration is optional so the existing application works
without it: `SNOWFLAKE_ACCOUNT_HOST`, `SNOWFLAKE_TOKEN`, `SNOWFLAKE_TOKEN_TYPE`
(PROGRAMMATIC_ACCESS_TOKEN by default), `SNOWFLAKE_DATABASE`, `SNOWFLAKE_SCHEMA`,
`SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_ROLE`. Never log or return tokens, connection
strings, raw SQL-provider errors or another user's saved data. No new Postgres
schema or standalone scraping service is required.

Use these exact values.

| Name | Value |
| --- | --- |
| `MUSE_BASE_URL` | `https://api.meta.ai/v1` |
| `MUSE_MODEL` | env `MUSE_MODEL`, default `muse-spark-1.3`. Allowed override: `muse-wonder-1.0` |
| `WEST_CAMPUS_LL` | `@30.291,-97.752,15z` |
| `UT_TOWER_COORDS` | `30.2862,-97.7394` |
| `CAMPUS_DESTINATION` | `UT Tower` |
| `MAX_SUGGESTIONS` | `3` |
| `MAX_MODEL_TURNS` | `8` |
| `MAX_SERP_CALLS` | `24` per user message |
| `REVIEW_PAGE_SIZE` | `20` |
| `MAX_REVIEW_PAGES` | `2` |

## Environment

Server only. Read these names and no others.

- `MODEL_API_KEY` — Bearer token for Meta
- `MUSE_MODEL` — optional
- `SERPAPI_KEY` — sent as the `api_key` query parameter
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `DATABASE_URL` — Postgres
- Optional `SNOWFLAKE_*` names listed in the Snowflake subsection above.

## Repo layout

```
app/page.tsx
app/chat/page.tsx
app/dashboard/page.tsx
app/api/auth/[...nextauth]/route.ts
app/api/chat/route.ts
app/api/apartments/route.ts
app/api/apartments/[id]/route.ts
app/api/apartments/[id]/refresh/route.ts
lib/auth.ts
lib/db.ts
lib/serpapi.ts
lib/rating.ts
lib/profile.ts
lib/agent/loop.ts
lib/agent/tools.ts
lib/agent/prompt.ts
prisma/schema.prisma
```

`lib/serpapi.ts` exports `serpSearch(params: Record<string, string>): Promise<unknown>`. It GETs `https://serpapi.com/search.json`, adds `api_key` from `SERPAPI_KEY`, `output=json`, `hl=en`, and `gl=us` unless the caller already set `hl` or `gl`. It throws if the JSON has an `error` string. Every call increments the per-message counter in the agent loop. At `MAX_SERP_CALLS`, further calls return `{ error: "serp_budget_exhausted" }` to the model and do not hit the network.

## Meta Responses API

Client: OpenAI SDK pointed at `MUSE_BASE_URL` with `apiKey: process.env.MODEL_API_KEY`.

Endpoint: `POST /v1/responses`.

Do not call `POST /v1/chat/completions`. Do not pass `response_format` (that is the Chat Completions parameter). Do not register Meta's built-in `web_search` tool. Do not set `reasoning.effort` to `"none"`. `tool_choice` is `"auto"`.

Tool definitions are flat. `name`, `description`, and `parameters` sit on the tool object, not under a nested `function` key.

```ts
await client.responses.create({
  model: process.env.MUSE_MODEL ?? "muse-spark-1.3",
  input, // string on the first turn, or items after that
  tools,
  tool_choice: "auto",
  previous_response_id, // omit on the first turn of a conversation
});
```

Read `response.output`. For each item with `type === "function_call"`, `name` is the tool, `arguments` is a JSON string, and `call_id` is the id to answer. Execute the tool, then continue:

```ts
await client.responses.create({
  model,
  previous_response_id: response.id,
  tools,
  tool_choice: "auto",
  input: [
    {
      type: "function_call_output",
      call_id: item.call_id,
      output: JSON.stringify(result),
    },
  ],
});
```

Stop when a response has no `function_call` item, or after `MAX_MODEL_TURNS`. The user-visible reply is `response.output_text`. Persist `response.id` as `Conversation.previousResponseId`.

Structured output uses `text.format`, not `response_format`. Two calls, outside the tool loop, named exactly:

- `ReviewLabels`
- `ListingFacts`

```ts
await client.responses.create({
  model,
  input: prompt,
  text: {
    format: {
      type: "json_schema",
      name: "ReviewLabels", // or "ListingFacts"
      strict: true,
      schema,
    },
  },
});
```

Parse `response.output_text` as JSON. Do not ask the chat tool-loop to emit these objects in prose.

## Agent tools

### Chat response style

User-facing replies lead with the answer and normally stay under 100 words:
2–4 short sentences or up to three brief bullets. Use everyday words, short
sentences and descriptive hyperlinks. Recommendation bullets show a bold property
name, matching rent and pricing basis, a known rating and one useful reason.
Expand only when requested or needed to explain an important price condition.
Keep fee uncertainty, shared-room conditions, eligibility and dated-price limits
beside the relevant claim. Avoid internal tool jargon and repeated dashboard
details. Describe a provider fallback as using saved apartment details unless
the user asks for technical information.

Defined in `lib/agent/tools.ts`. The session user id is closed over by the runner. Reject any model argument named `userId`.

### `search_apartments`

Parameters: `query` (string, required), `beds` (number, optional), `maxRent` (number, optional).

Calls, in order:

1. Maps search. `GET https://serpapi.com/search.json`

```
engine=google_maps
type=search
q={query}
ll=@30.291,-97.752,15z
hl=en
```

Read `local_results[]`. Keep at most `MAX_SUGGESTIONS` items that have a `place_id`. Fields to keep from each item: `title`, `place_id`, `data_id`, `address`, `gps_coordinates.latitude`, `gps_coordinates.longitude`, `rating`, `reviews`, `type`.

2. For each kept `place_id`, a web check. Same host.

```
engine=google
q={title} West Campus Austin apartment
hl=en
gl=us
num=5
```

A place is verified only when some `organic_results[]` entry has a `title` or `snippet` that contains the place `title` (case-insensitive) and `Austin`. Drop unverified places. If none remain, the tool result is `{ verified: [] }` and the reply says they could not be verified. Do not invent listings.

Return `{ verified: [...] }` to the model. Do not call `build_profile` inside this tool.

### `build_profile`

Parameters: `placeId` (string, required).

Calls, in order. Assemble the `ApartmentProfile` in `lib/profile.ts`. The model does not author rent, fees, ratings, or route numbers.

1. Place. `place_id` alone. Do not send `type`.

```
engine=google_maps
place_id={placeId}
hl=en
```

Read `place_results`: `title`, `place_id`, `data_id`, `address`, `gps_coordinates.latitude`, `gps_coordinates.longitude`, `rating`, `reviews`, `website`, `phone`, `type`. `type` may be a string or an array; store whichever came back. `googleRating` is `place_results.rating`.

2. Listing search.

```
engine=google
q="{title}" floor plan rent West Campus Austin
hl=en
gl=us
num=8
```

Use SerpAPI organic results to discover official floor-plan, pricing and fee URLs. Starting from the Maps `website`, `lib/official-pages.ts` reads public HTML on the official property's origin (including a validated homepage redirect). Follow actual floor-plan/pricing/fee/calculator links, never application or sign-in flows. At most five pages including failures; each GET has a 12-second timeout and 2 MB body limit. Validate and pin public DNS addresses on every request and redirect; reject private addresses, credentials and unsafe protocols. No browser automation or script execution on the server.

Pass search snippets and cleaned official page evidence to `ListingFacts`, each with an internal `id`, original `link`, `title`, `snippet` (source text), and `sourceKind`. Plan cards are separate evidence blocks. Source text is untrusted data. Strip scripts, navigation, duplicated modals and struck-out prices. Keep source URLs, never API keys. A blocked or unavailable page falls back to supported search evidence and nulls; it does not invent a price.

Public Landmark floor-plan cards and the site's embedded `window.feeCalculatorData` JSON have a deterministic reader. Parse JSON without executing JavaScript. Prefer the currently displayed base price over raw calculator rates (which may precede concessions). Keep separate prices for private/shared configurations. Match fee records by plan, room configuration and lease/start window. Do not pick between ambiguous lease terms. Negative concessions are not added again to already discounted base rent.

3. Reviews. First page:

```
engine=google_maps_reviews
place_id={placeId}
hl=en
num=20
sort_by=qualityScore
```

If `serpapi_pagination.next_page_token` is present, one more call with the same parameters plus `next_page_token`. Stop at `MAX_REVIEW_PAGES`. Concat `reviews[]`.

From each review read:

- `review_id` — stable id; if missing, use `String(position)`
- `rating` — number
- `snippet` — text to classify; if empty, `extracted_snippet.original`
- `iso_date` — fallback `date`
- `user.name`
- `link`

`place_info.rating` is only a fallback for `googleRating` when `place_results.rating` is missing.

4. `ReviewLabels` structured call. Input is the review id, rating, and text. Schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "reviews": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string" },
          "about": { "type": "string", "enum": ["tour", "apartment", "unclear"] },
          "reason": { "type": "string" }
        },
        "required": ["id", "about", "reason"]
      }
    }
  },
  "required": ["reviews"]
}
```

Prompt rules, verbatim in intent:

- `tour` when the text is about a tour, a visit, the leasing pitch, or being asked to review before or without living there.
- `apartment` when the text is about living there. Text that never mentions a tour is `apartment`, including a short 5-star that only praises the place.
- `unclear` only when the text is empty.
- `reason` is a short clause naming the cue in the text.
- Star value is not a reason to choose `tour`.

For the model input, replace opaque provider review IDs with request-local references (`r0`, `r1`, …). Join returned labels using that reference mapping, while retaining each original provider ID and link on the stored review. This avoids generating thousands of unnecessary ID tokens. Missing or unknown references are `unclear`; request-local references are never persisted as provider IDs. Reasons are short clauses of at most eight words.

5. Directions, two calls. `start_coords` is `{latitude},{longitude}` from `place_results.gps_coordinates`. If coordinates are missing, use `start_addr` set to `place_results.address` and omit `start_coords`. `end_coords` is always `30.2862,-97.7394`.

Walking:

```
engine=google_maps_directions
start_coords={lat},{lng}
end_coords=30.2862,-97.7394
travel_mode=2
distance_unit=1
hl=en
gl=us
```

Cycling: the same query with `travel_mode=1`.

`travel_mode` values: `2` walking, `1` cycling, `0` driving, `3` transit, `6` best. This app sends only `2` and `1`.

From `directions[0]` copy `distance` (meters), `duration` (seconds), `formatted_distance`, `formatted_duration`, and `travel_mode`. If `directions` is missing or empty, that mode is `null`. Do not read `trips` or `durations`.

6. `ListingFacts` structured call over search snippets and official page evidence. The base floor-plan schema is:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "floorplans": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "name": { "type": ["string", "null"] },
          "beds": { "type": ["number", "null"] },
          "baths": { "type": ["number", "null"] },
          "sqft": { "type": ["number", "null"] },
          "baseRent": { "type": ["number", "null"] },
          "sourceUrl": { "type": ["string", "null"] },
          "fees": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "name": { "type": "string" },
                "amount": { "type": ["number", "null"] },
                "cadence": { "type": ["string", "null"] }
              },
              "required": ["name", "amount", "cadence"]
            }
          }
        },
        "required": ["name", "beds", "baths", "sqft", "baseRent", "sourceUrl", "fees"]
      }
    }
  },
  "required": ["floorplans"]
}
```

The structured schema additionally requires `sourceId` on plans and property-wide fees, matching the exact evidence block and its `sourceUrl`. Plan properties also include nullable `rentBasis` (`per person` or `per unit`), `publishedMonthlyTotal`, `priceKind` (`starting at`, `exact`, `range`), and `leaseTerm`. Fees include `applies` (`required`, `optional`, `conditional`) and nullable `conditions`. Top-level `amenities` contains exact source phrases with source URLs, and `propertyFees` contains sourced property-wide fee records.

Prompt rule: a number is present only when it appears in that specific evidence block. `baseRent` must be explicitly labeled base rent; inclusive prices are kept in `publishedMonthlyTotal` only when explicitly inclusive of mandatory fees. Do not borrow values from other plans or lease periods. Missing facts remain null. Drop plans with an unknown source ID/URL. Code validates model amounts against the cited text; the deterministic official reader takes precedence when available.

`lib/rating.ts` exports `honestRating(reviews)`. It ignores the model for the math.

- `honestCount` = reviews with `about === "apartment"`
- `honestRating` = mean of their `rating`, or `null` when `honestCount` is 0
- `excludedTour` = count of `about === "tour"`
- `unclearCount` = count of `about === "unclear"`

`build_profile` returns the assembled `ApartmentProfile` and caches it on the turn, keyed by `placeId`, so `save_apartment` can persist that object.

### `save_apartment`

Parameters: `placeId` (string, required).

Load the cached `ApartmentProfile` for that `placeId` from this turn. If it is missing, return `{ error: "profile_not_built" }` and do not write. Upsert `Apartment` on `(userId, placeId)` for the session user. Do not take rent, rating, or labels from the model arguments. Existing `labels` are kept.

### `add_label`

Parameters: `placeId` (string, required), `label` (string, required).

Normalize `label` with trim and lowercase, reject empty and anything over 32 characters, dedupe against the row's `labels`. The row must belong to the session user. Return `{ error: "not_saved" }` if this user has no apartment with that `placeId`.

## ApartmentProfile

Stored in `Apartment.profile`. This is the document the dashboard renders. Null means the source did not say.

```ts
type ApartmentProfile = {
  placeId: string;
  name: string;
  address: string | null;
  mapsUrl: string;
  website: string | null;
  phone: string | null;
  labels: string[];
  fetchedAt: string; // ISO 8601
  googleRating: number | null;
  googleReviewCount: number | null;
  honestRating: number | null;
  honestCount: number;
  excludedTour: number;
  unclearCount: number;
  campus: {
    destination: "UT Tower";
    endCoords: "30.2862,-97.7394";
    walking: RouteLeg | null;
    cycling: RouteLeg | null;
  };
  floorplans: Array<{
    name: string | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    baseRent: number | null;
    sourceUrl: string | null;
    fees: Array<{ name: string; amount: number | null; cadence: string | null }>;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    text: string;
    date: string | null;
    author: string | null;
    link: string | null;
    about: "tour" | "apartment" | "unclear";
    reason: string;
  }>;
  sources: string[];
};

type RouteLeg = {
  distanceMeters: number;
  durationSeconds: number;
  formattedDistance: string;
  formattedDuration: string;
};
```

`mapsUrl` is `https://www.google.com/maps/search/?api=1&query_place_id={placeId}`.

`sources` lists every SerpAPI search URL used for that profile, including both directions calls, plus official pages successfully read.

Profiles also support optional `pricingVersion: 1`, `amenities`, and `propertyFees`. Floor plans support `rentBasis`, `publishedMonthlyTotal`, `priceKind`, `leaseTerm`, and `sourceKind` (`official page` or `search snippet`). Fees support `sourceUrl`, `applies`, and `conditions`. `lib/listing-types.ts` defines these shared fields; API validation accepts legacy profiles and validates every extension. The shared research cache requires the current pricing version; an explicit Refresh pricing & research action rebuilds saved profiles while keeping labels.

The UI labels starting prices and lease periods, displays cents, and separates base rent from inclusive monthly installments. A published inclusive price already includes mandatory monthly charges, so never add itemized fees to it again. Optional/conditional charges are shown separately and excluded from calculated subtotals. Missing rent means it was not found in the available sources, not that the property does not publish it.

`reviews` includes tour and unclear rows, not only rows in the average.

Column copies for sorting, written from the same object: `honestRating`, `honestCount`, `excludedTour`. `labels` is also a Postgres `String[]` and must match `profile.labels`.

## HTTP API

All `/api/chat` and `/api/apartments` routes require an Auth.js session. No session returns 401.

### `POST /api/chat`

Body: `{ "conversationId"?: string, "message": string }`.

Response: `Content-Type: text/event-stream`. Events:

- `event: status` `data: {"phase":"maps_search"|"web_search"|"place"|"reviews"|"directions_walking"|"directions_cycling"|"classify_reviews"|"extract_listing"}`
- `event: suggestion` `data:` one `ApartmentProfile` JSON object. At most `MAX_SUGGESTIONS` per response.
- `event: message` `data: {"text": string}`
- `event: error` `data: {"error": string}`
- `event: done` `data: {"conversationId": string}`

Create a `Conversation` when `conversationId` is omitted. Load `previousResponseId` when it is present and belongs to the session user.

### `GET /api/apartments`

Returns the session user's rows: `{ id, placeId, name, address, labels, honestRating, honestCount, excludedTour, profile }`.

### `POST /api/apartments`

Body: `{ "profile": ApartmentProfile }`.

Validate with the schema above. Reject a floor plan whose `sourceUrl` is null. Upsert on `(userId, placeId)`. This is the Add button. It does not call SerpAPI or Muse. It saves the profile already built for the suggestion.

### `PATCH /api/apartments/[id]`

Body: `{ "addLabels"?: string[], "removeLabels"?: string[] }`.

Same label normalization as `add_label`. 404 when the row is not the session user's.

### `POST /api/apartments/[id]/refresh`

Re-runs `build_profile` for the row's `placeId`, overwrites `profile` and the rating columns, and keeps existing `labels` (copied back onto `profile.labels`). 404 when the row is not the session user's.

## Data model

Prisma, Postgres. Auth.js models `User`, `Account`, `Session`, `VerificationToken` via `@auth/prisma-adapter`. App models:

```prisma
model Conversation {
  id                 String    @id @default(cuid())
  userId             String
  previousResponseId String?
  createdAt          DateTime  @default(now())
  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages           Message[]
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String
  content        Json
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}

model Apartment {
  id            String   @id @default(cuid())
  userId        String
  placeId       String
  name          String
  address       String?
  labels        String[]
  profile       Json
  honestRating  Float?
  honestCount   Int      @default(0)
  excludedTour  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, placeId])
}
```

`Message.content` for an assistant turn is `{ "text": string, "suggestions": ApartmentProfile[] }`.

## Pages

- `/` — Google sign-in. `lib/auth.ts` uses `next-auth` v5 `Google` provider. `app/api/auth/[...nextauth]/route.ts` exports `GET` and `POST`.
- `/chat` — transcript, status line from `status` events, suggestion cards. Each card shows name, address, honest rating, `campus.walking.formattedDuration`, and `campus.cycling.formattedDuration`. **Add to dashboard** POSTs that suggestion's profile. The button is enabled only when the `suggestion` event has arrived.
- `/dashboard` — cards filtered by label. Collapsed card shows name, address, labels, honest rating, walk time, and bike time. Expanded card reads `profile` only: floor plans (`name`, `beds`, `baths`, `sqft`, `baseRent`, `fees`), both route legs (`formattedDistance` and `formattedDuration`), reviews with `about === "apartment"`, and a separate group of reviews with `about === "unclear"` omitted from the score and reviews with `about === "tour"` each showing `reason`. Copy when `honestRating` is null: the sample has no reviews about the apartment itself. Show `googleRating` beside the honest score, plus `honestCount` and `excludedTour`.

Walk and bike times are to the UT Tower, not the nearest classroom. A null leg is left blank.

## Tests

- `honestRating`: a 5-star `apartment` review stays in the mean; a `tour` review of any star value stays out; empty-text `unclear` stays out; an all-tour sample returns `honestRating: null`.
- `build_profile` against a saved SerpAPI fixture, including one walking and one cycling `directions` payload. Stored meters, seconds, and formatted strings match `directions[0]`. A floor plan whose `sourceUrl` was not in `organic_results[].link` is dropped.
- Sign in, ask for a pet-friendly 2-bed under a stated budget, add one card, apply a label from chat, expand it. Tour reviews are grouped apart from the average. Walk and bike time are shown.

## Research responsiveness

Structured profile calls use a 90-second timeout and no automatic retries; failures preserve the saved profile. The UI displays a research status message and bounds a research request to 150 seconds, clearing the loading state with a retry message if it times out. Model phase durations are logged without keys, source text, or user identifiers.

## Quotas and failures

Each full profile is one place call, three Google searches (floor plans, amenities, fees), one or two review pages, and two directions calls, plus up to five direct official-page GETs. Direct page reads do not use SerpAPI credits. The existing 24-call SerpAPI budget still applies. Three suggestions plus their web checks can spend most of `MAX_SERP_CALLS`.

Floor plans and fees exist only when supported by cited search evidence or official page content. The honest rating is over the fetched pages, and only over reviews labeled `apartment`. A solicited review that never mentions a tour can be kept. A resident comment that is about tour day can be set aside. The reason string is what the UI shows.

## Apartment detail location map

The full apartment view includes an interactive map for that apartment only.
The existing authenticated `/api/apartments/campus-map` handler accepts
`locationOnly: true` to fetch/cache the owned apartment's Maps coordinates without
spending walking/cycling calls. Location and route caches use separate keys. The
reused street map hides the UT Tower marker in this mode and centers on the one
apartment; no campus outline or invented route is drawn.

## Workspace scroll layout

On desktop, /chat fills the dynamic viewport below the shared header. The board
and assistant thread scroll independently; long replies and expanded modules must
not increase the outer document height. Grid and flex children use zero minimum
heights so content can scroll. Keep the assistant heading and composer visible.
Mobile keeps normal document scrolling and its existing assistant sheet.

## Shared brand mark

Use the shared BrandMark on every header and landing surface: lowercase Outfit
SemiBold in the existing dark green, with a thin terracotta underline beneath the
entire "listed" portion. BrandIcon is a simple outlined doorway in a rounded cream
tile. Compact LogoMark delegates to that same icon to prevent visual drift.
