# Snowflake recommendations

1. Use an existing Snowflake database/schema/warehouse and a role authorized to use them, or create dedicated ones in Snowsight. The application does not create roles or grant access.
2. Copy the variables from `snowflake.env.example` into your local `.env.local` (Next.js) and `.env` (seed). Use the SQL API account hostname, without `https://` or a path. Use uppercase unquoted identifiers. Create a programmatic access token for the configured role; satisfy your account's token/network policies. Never expose it to the frontend.
3. Run `npm run snowflake:seed`. The seed role needs CREATE TABLE in the schema plus SELECT, INSERT and UPDATE for these tables. It creates two tables and upserts the bundled public catalog; it does not delete rows, upload user data, or modify Postgres. An application role only needs SELECT on both tables.
4. Restart `npm run dev -- --port 3100`. Ask: “Find the highest rated apartments under $1,100 per person.” The tool result reports `provider: snowflake` when the SQL query succeeds. Missing credentials, unavailable tables or query failures use Postgres public research and the bundled catalog.

Muse converts the request into validated criteria; it never writes SQL. Snowflake runs a parameterized, same-floorplan bedroom/bathroom/base-price query. Application code rechecks eligibility, amenities and known required recurring fees against the bundled source catalog. Re-run the seed after catalog changes; this is a synchronized demo dataset, not a live leasing inventory. A successful query with no rows is a real empty result, not a provider failure.

Up to eight eligible properties are checked per turn, using cached public research where available. Uncached candidates use SerpAPI Maps discovery, place verification and one review page, then Muse review classification. This fits the existing 24-call budget. Resident ranking excludes tour reviews. Properties without qualifying review evidence cannot be ranked; the response includes checked coverage and failed research counts. Routes are not fetched during this recommendation pass; the apartment's existing refresh flow can populate them.

`UNLISTED_RESEARCH` is an optional public review cache with columns PROPERTY_ID, PROFILE (VARIANT), FETCHED_AT. Runtime fresh research is cached in Postgres; this version does not automatically mirror that cache into Snowflake. Never upload private boards or conversation data into the public cache. Ratings are based on the fetched sample, not a guarantee about all resident reviews.

Defaults: strictly below budget, base rent per person, no SMART eligibility offers unless explicitly requested, any room type, resident score with at least one resident review. A bathroom criterion means at least that many bathrooms. Explicit private-room requests exclude layouts whose room type is unknown. Utilities, one-time and optional fees are disclosed separately. Unknown required recurring costs prevent confirmed all-in budget matching.

Live Snowflake connectivity must be checked after configuring credentials. Local automated tests cannot confirm your account permissions or network policy.

Official references: https://docs.snowflake.com/en/developer-guide/sql-api/submitting-requests and https://docs.snowflake.com/en/developer-guide/sql-api/authenticating
