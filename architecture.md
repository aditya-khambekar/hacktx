West Campus apartment finder

Implementation spec for agents building the app. Product intent lives in the plan; names, endpoints, and payloads in this file are the ones to code against.

UT students sign in with Google, search West Campus apartments through a Muse Spark agent, and save a JSON profile per apartment. The profile holds floor plans, fees, walk and bike time to the UT Tower, reviews, and an honest rating. Muse labels each review as about a tour or about the apartment. Code computes the average from the apartment labels only.

One Next.js app. Route Handlers are the backend. No Python service. No JSON files on disk. Secrets never reach the browser.

Constants

Use these exact values.







Name



Value





MUSE_BASE_URL



https://api.meta.ai/v1





MUSE_MODEL



env MUSE_MODEL, default muse-spark-1.3. Allowed override: muse-wonder-1.0





WEST_CAMPUS_LL



@30.291,-97.752,15z





UT_TOWER_COORDS



30.2862,-97.7394





CAMPUS_DESTINATION



UT Tower





MAX_SUGGESTIONS



3





MAX_MODEL_TURNS



8





MAX_SERP_CALLS



24 per user message





REVIEW_PAGE_SIZE



20





MAX_REVIEW_PAGES



2

Environment

Server only. Read these names and no others.





MODEL_API_KEY — Bearer token for Meta



MUSE_MODEL — optional



SERPAPI_KEY — sent as the api_key query parameter



AUTH_SECRET



AUTH_GOOGLE_ID



AUTH_GOOGLE_SECRET



DATABASE_URL — Postgres

Repo layout

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

lib/serpapi.ts exports serpSearch(params: Record<string, string>): Promise<unknown>. It GETs https://serpapi.com/search.json, adds api_key from SERPAPI_KEY, output=json, hl=en, and gl=us unless the caller already set hl or gl. It throws if the JSON has an error string. Every call increments the per-message counter in the agent loop. At MAX_SERP_CALLS, further calls return { error: "serp_budget_exhausted" } to the model and do not hit the network.

Meta Responses API

Client: OpenAI SDK pointed at MUSE_BASE_URL with apiKey: process.env.MODEL_API_KEY.

Endpoint: POST /v1/responses.

Do not call POST /v1/chat/completions. Do not pass response_format (that is the Chat Completions parameter). Do not register Meta's built-in web_search tool. Do not set reasoning.effort to "none". tool_choice is "auto".

Tool definitions are flat. name, description, and parameters sit on the tool object, not under a nested function key.

await client.responses.create({
  model: process.env.MUSE_MODEL ?? "muse-spark-1.3",
  input, // string on the first turn, or items after that
  tools,
  tool_choice: "auto",
  previous_response_id, // omit on the first turn of a conversation
});

Read response.output. For each item with type === "function_call", name is the tool, arguments is a JSON string, and call_id is the id to answer. Execute the tool, then continue:

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

Stop when a response has no function_call item, or after MAX_MODEL_TURNS. The user-visible reply is response.output_text. Persist response.id as Conversation.previousResponseId.

Structured output uses text.format, not response_format. Two calls, outside the tool loop, named exactly:





ReviewLabels



ListingFacts

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

Parse response.output_text as JSON. Do not ask the chat tool-loop to emit these objects in prose.

Agent tools

Defined in lib/agent/tools.ts. The session user id is closed over by the runner. Reject any model argument named userId.

search_apartments

Parameters: query (string, required), beds (number, optional), maxRent (number, optional).

Calls, in order:





Maps search. GET https://serpapi.com/search.json

engine=google_maps
type=search
q={query}
ll=@30.291,-97.752,15z
hl=en

Read local_results[]. Keep at most MAX_SUGGESTIONS items that have a place_id. Fields to keep from each item: title, place_id, data_id, address, gps_coordinates.latitude, gps_coordinates.longitude, rating, reviews, type.





For each kept place_id, a web check. Same host.

engine=google
q={title} West Campus Austin apartment
hl=en
gl=us
num=5

A place is verified only when some organic_results[] entry has a title or snippet that contains the place title (case-insensitive) and Austin. Drop unverified places. If none remain, the tool result is { verified: [] } and the reply says they could not be verified. Do not invent listings.

Return { verified: [...] } to the model. Do not call build_profile inside this tool.

build_profile

Parameters: placeId (string, required).

Calls, in order. Assemble the ApartmentProfile in lib/profile.ts. The model does not author rent, fees, ratings, or route numbers.





Place. place_id alone. Do not send type.

engine=google_maps
place_id={placeId}
hl=en

Read place_results: title, place_id, data_id, address, gps_coordinates.latitude, gps_coordinates.longitude, rating, reviews, website, phone, type. type may be a string or an array; store whichever came back. googleRating is place_results.rating.





Listing search.

engine=google
q="{title}" floor plan rent West Campus Austin
hl=en
gl=us
num=8

Pass organic_results[].title, organic_results[].link, and organic_results[].snippet into the ListingFacts call. Nothing else.





Reviews. First page:

engine=google_maps_reviews
place_id={placeId}
hl=en
num=20
sort_by=qualityScore

If serpapi_pagination.next_page_token is present, one more call with the same parameters plus next_page_token. Stop at MAX_REVIEW_PAGES. Concat reviews[].

From each review read:





review_id — stable id; if missing, use String(position)



rating — number



snippet — text to classify; if empty, extracted_snippet.original



iso_date — fallback date



user.name



link

place_info.rating is only a fallback for googleRating when place_results.rating is missing.





ReviewLabels structured call. Input is the review id, rating, and text. Schema:

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

Prompt rules, verbatim in intent:





tour when the text is about a tour, a visit, the leasing pitch, or being asked to review before or without living there.



apartment when the text is about living there. Text that never mentions a tour is apartment, including a short 5-star that only praises the place.



unclear only when the text is empty.



reason is a short clause naming the cue in the text.



Star value is not a reason to choose tour.

Join labels onto reviews by id. A missing or unknown id is unclear.





Directions, two calls. start_coords is {latitude},{longitude} from place_results.gps_coordinates. If coordinates are missing, use start_addr set to place_results.address and omit start_coords. end_coords is always 30.2862,-97.7394.

Walking:

engine=google_maps_directions
start_coords={lat},{lng}
end_coords=30.2862,-97.7394
travel_mode=2
distance_unit=1
hl=en
gl=us

Cycling: the same query with travel_mode=1.

travel_mode values: 2 walking, 1 cycling, 0 driving, 3 transit, 6 best. This app sends only 2 and 1.

From directions[0] copy distance (meters), duration (seconds), formatted_distance, formatted_duration, and travel_mode. If directions is missing or empty, that mode is null. Do not read trips or durations.





ListingFacts structured call over the organic results only. Schema:

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

Prompt rule: a rent or fee is present only when that number appears in a snippet. sourceUrl is the link of that organic result. Otherwise null. Drop any floor plan whose sourceUrl is null or is not one of the links that were passed in.

lib/rating.ts exports honestRating(reviews). It ignores the model for the math.





honestCount = reviews with about === "apartment"



honestRating = mean of their rating, or null when honestCount is 0



excludedTour = count of about === "tour"



unclearCount = count of about === "unclear"

build_profile returns the assembled ApartmentProfile and caches it on the turn, keyed by placeId, so save_apartment can persist that object.

save_apartment

Parameters: placeId (string, required).

Load the cached ApartmentProfile for that placeId from this turn. If it is missing, return { error: "profile_not_built" } and do not write. Upsert Apartment on (userId, placeId) for the session user. Do not take rent, rating, or labels from the model arguments. Existing labels are kept.

add_label

Parameters: placeId (string, required), label (string, required).

Normalize label with trim and lowercase, reject empty and anything over 32 characters, dedupe against the row's labels. The row must belong to the session user. Return { error: "not_saved" } if this user has no apartment with that placeId.

ApartmentProfile

Stored in Apartment.profile. This is the document the dashboard renders. Null means the source did not say.

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

mapsUrl is https://www.google.com/maps/search/?api=1&query_place_id={placeId}.

sources lists every SerpAPI search URL used for that profile, including both directions calls.

reviews includes tour and unclear rows, not only rows in the average.

Column copies for sorting, written from the same object: honestRating, honestCount, excludedTour. labels is also a Postgres String[] and must match profile.labels.

HTTP API

All /api/chat and /api/apartments routes require an Auth.js session. No session returns 401.

POST /api/chat

Body: { "conversationId"?: string, "message": string }.

Response: Content-Type: text/event-stream. Events:





event: status data: {"phase":"maps_search"|"web_search"|"place"|"reviews"|"directions_walking"|"directions_cycling"|"classify_reviews"|"extract_listing"}



event: suggestion data: one ApartmentProfile JSON object. At most MAX_SUGGESTIONS per response.



event: message data: {"text": string}



event: error data: {"error": string}



event: done data: {"conversationId": string}

Create a Conversation when conversationId is omitted. Load previousResponseId when it is present and belongs to the session user.

GET /api/apartments

Returns the session user's rows: { id, placeId, name, address, labels, honestRating, honestCount, excludedTour, profile }.

POST /api/apartments

Body: { "profile": ApartmentProfile }.

Validate with the schema above. Reject a floor plan whose sourceUrl is null. Upsert on (userId, placeId). This is the Add button. It does not call SerpAPI or Muse. It saves the profile already built for the suggestion.

PATCH /api/apartments/[id]

Body: { "addLabels"?: string[], "removeLabels"?: string[] }.

Same label normalization as add_label. 404 when the row is not the session user's.

POST /api/apartments/[id]/refresh

Re-runs build_profile for the row's placeId, overwrites profile and the rating columns, and keeps existing labels (copied back onto profile.labels). 404 when the row is not the session user's.

Data model

Prisma, Postgres. Auth.js models User, Account, Session, VerificationToken via @auth/prisma-adapter. App models:

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

Message.content for an assistant turn is { "text": string, "suggestions": ApartmentProfile[] }.

Pages





/ — Google sign-in. lib/auth.ts uses next-auth v5 Google provider. app/api/auth/[...nextauth]/route.ts exports GET and POST.



/chat — transcript, status line from status events, suggestion cards. Each card shows name, address, honest rating, campus.walking.formattedDuration, and campus.cycling.formattedDuration. Add to dashboard POSTs that suggestion's profile. The button is enabled only when the suggestion event has arrived.



/dashboard — cards filtered by label. Collapsed card shows name, address, labels, honest rating, walk time, and bike time. Expanded card reads profile only: floor plans (name, beds, baths, sqft, baseRent, fees), both route legs (formattedDistance and formattedDuration), reviews with about === "apartment", and a separate group of reviews with about === "unclear" omitted from the score and reviews with about === "tour" each showing reason. Copy when honestRating is null: the sample has no reviews about the apartment itself. Show googleRating beside the honest score, plus honestCount and excludedTour.

Walk and bike times are to the UT Tower, not the nearest classroom. A null leg is left blank.

Tests





honestRating: a 5-star apartment review stays in the mean; a tour review of any star value stays out; empty-text unclear stays out; an all-tour sample returns honestRating: null.



build_profile against a saved SerpAPI fixture, including one walking and one cycling directions payload. Stored meters, seconds, and formatted strings match directions[0]. A floor plan whose sourceUrl was not in organic_results[].link is dropped.



Sign in, ask for a pet-friendly 2-bed under a stated budget, add one card, apply a label from chat, expand it. Tour reviews are grouped apart from the average. Walk and bike time are shown.

Quotas and failures

Each full profile is one place call, one Google search, one or two review pages, and two directions calls. Three suggestions plus their web checks can spend most of MAX_SERP_CALLS.

Floor plans and fees exist only when a snippet stated them. The honest rating is over the fetched pages, and only over reviews labeled apartment. A solicited review that never mentions a tour can be kept. A resident comment that is about tour day can be set aside. The reason string is what the UI shows.