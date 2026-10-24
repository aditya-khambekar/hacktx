# Work split

Eight sections, one person each. Every section implements the names in [architecture.md](/cursor/stores/self/docs/architecture.md) and does not invent a second API. The repo is `~/Desktop/allprojects/hacktx`. `architecture.md` in that repo is the same spec.

The Next.js starter is already there. Leave `app/page.tsx`, `app/layout.tsx`, `architecture.md`, `README.md`, and `AGENTS.md` alone. Replacing the starter with a sign-in page is not one of these sections.

Each person uses their own branch. The only files more than one branch will touch are `package.json` and `package-lock.json`. Add only the dependencies listed for that section.

These are the only shared code names. Shapes of requests, tool arguments, and `ApartmentProfile` stay in the architecture doc.

- `lib/db.ts` exports `prisma`
- `lib/auth.ts` exports `auth`
- `lib/serpapi.ts` exports `serpSearch` and `withSerpBudget`
- `lib/rating.ts` exports `honestRating`
- `lib/profile.ts` exports `buildProfile`

`withSerpBudget` and `buildProfile` are how the architecture's per-message SerpAPI cap and `build_profile` tool are split across files. Do not rename them.

## Who owns what

| Section | Files | Read in architecture.md |
| --- | --- | --- |
| Auth and database | `prisma/schema.prisma`, `lib/db.ts`, `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `.env.example` | Environment, Data model |
| SerpAPI client | `lib/serpapi.ts` | Repo layout, Constants, Quotas and failures |
| Honest rating | `lib/rating.ts`, `lib/rating.test.ts`, Vitest setup in `package.json` | `build_profile` step 4 and the `honestRating` rules, Tests |
| Profile assembly | `lib/profile.ts`, `lib/profile.test.ts`, `lib/fixtures/` | `build_profile`, ApartmentProfile, Tests |
| Agent and chat API | `lib/agent/loop.ts`, `lib/agent/tools.ts`, `lib/agent/prompt.ts`, `app/api/chat/route.ts` | Meta Responses API, Agent tools, `POST /api/chat` |
| Chat page | `app/chat/page.tsx` | Pages (`/chat`), `POST /api/chat` events |
| Apartment routes | `app/api/apartments/route.ts`, `app/api/apartments/[id]/route.ts`, `app/api/apartments/[id]/refresh/route.ts` | HTTP API apartment routes, Data model |
| Dashboard page | `app/dashboard/page.tsx` | Pages (`/dashboard`), `GET /api/apartments` |

## Auth and database

Prisma models `User`, `Account`, `Session`, `VerificationToken`, `Conversation`, `Message`, and `Apartment` match the Data model section, including `@@unique([userId, placeId])`. Auth.js v5 Google provider. `app/api/auth/[...nextauth]/route.ts` exports `GET` and `POST`.

`.env.example` lists every name in the Environment section and nothing else. Other sections do not add env files.

Dependencies: `next-auth`, `@auth/prisma-adapter`, `prisma`, `@prisma/client`.

Done when a session resolves for a signed-in user and `prisma` can read and write `Apartment`. Do not change `app/page.tsx`.

## SerpAPI client

`serpSearch(params: Record<string, string>): Promise<unknown>` GETs `https://serpapi.com/search.json` as the Repo layout section describes. It throws when the JSON has an `error` string.

`withSerpBudget(fn)` runs `fn` with a fresh counter. Inside that call, `serpSearch` increments the counter. At `MAX_SERP_CALLS` it returns `{ error: "serp_budget_exhausted" }` and does not hit the network. Outside `withSerpBudget`, `serpSearch` still performs the request. No other file implements this cap.

No new dependencies. Use `fetch`.

## Honest rating

`honestRating(reviews)` follows the architecture rules: mean of `about === "apartment"` only, `tour` and `unclear` stay out of the mean, all-tour sample returns `honestRating: null`. It does not call Muse or SerpAPI.

This section adds Vitest and the `test` script. Other sections add `*.test.ts` files only, not another test runner.

Tests cover the four cases in the Tests section.

## Profile assembly

`buildProfile(placeId: string)` performs `build_profile` steps 1 through 6 and returns an `ApartmentProfile`. It calls `serpSearch` and `honestRating`. It makes the `ReviewLabels` and `ListingFacts` structured calls. It does not implement `search_apartments`, `save_apartment`, or `add_label`.

Drop a floor plan whose `sourceUrl` is null or was not in `organic_results[].link`. Copy route figures from `directions[0]`. Do not let the model author rent, fees, ratings, or route numbers.

Dependencies: `openai`.

The fixture test in the Tests section lives here, under `lib/fixtures/`.

## Agent and chat API

`POST /api/chat` requires a session and streams the events in that section. Wrap the run in `withSerpBudget`. Cap model turns at `MAX_MODEL_TURNS`.

Tools are `search_apartments`, `build_profile`, `save_apartment`, and `add_label`, with the parameters in Agent tools. `build_profile` calls `buildProfile` and caches the profile on the turn by `placeId`. `save_apartment` persists that cache for the session user and does not trust model-authored rent or ratings. `add_label` updates that user's row only. Reject a model argument named `userId`.

Use `previous_response_id` as the Meta Responses API section describes. Do not call Chat Completions or Meta `web_search`.

Depends on `openai` from the profile section. Do not add a second copy of the dependency if it is already in `package.json`; a parallel branch may add it once and the merge keeps one.

This section does not build the chat page.

## Chat page

`app/chat/page.tsx` only. Render `status`, `suggestion`, `message`, and `error` events. Show at most `MAX_SUGGESTIONS` cards. Each card shows name, address, honest rating, walk duration, and bike duration. **Add to dashboard** POSTs that suggestion's `profile` to `POST /api/apartments` and is enabled only after the `suggestion` event.

Do not import `lib/agent` or call SerpAPI or Muse from the client.

Can be built against a mocked SSE stream that uses the event names in the architecture doc.

## Apartment routes

Implement `GET` and `POST /api/apartments`, `PATCH /api/apartments/[id]`, and `POST /api/apartments/[id]/refresh` as written. Session required. 401 without a session, 404 when the row is not the session user's.

`POST` validates the profile and does not call SerpAPI or Muse. `refresh` calls `buildProfile`, overwrites the profile and rating columns, and keeps existing labels.

Label rules match `add_label`: trim, lowercase, reject empty, reject over 32 characters, dedupe.

No new dependencies.

## Dashboard page

`app/dashboard/page.tsx` only. Load `GET /api/apartments`. Filter by label. The collapsed card shows name, address, labels, honest rating, walk time, and bike time. The expanded card reads `profile` only and splits reviews the way the Pages section describes, including the null-score copy and `googleRating` beside the honest score.

Do not call SerpAPI or Muse from the client. Can be built against fixture JSON that matches `ApartmentProfile`.

## What can start together

Auth, the SerpAPI client, the rating function, the chat page, and the dashboard page have no code dependency on the other sections. Profile assembly needs the `serpSearch` and `honestRating` names above. The agent and the apartment routes need `buildProfile`, `auth`, and `prisma`. The pages need their routes only at integration time; until then they use fixtures.

Suggested merge order: rating, SerpAPI client, and auth first; profile next; apartment routes and the agent in either order; chat page and dashboard page last.
