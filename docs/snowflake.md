# Snowflake research cache

The app saves the information its existing SerpAPI and official-page scraper already
finds: floor plans, rent, fees, amenities, lease terms, public reviews and routes.
The scraper itself is unchanged. Snowflake makes that work reusable across users
and server restarts. There is no bundled apartment dataset or demo price fallback.

1. Copy `snowflake.env.example` into your local `.env.local` alongside the existing
   variables. Set the account SQL API hostname (such as
   `your-org-your-account.snowflakecomputing.com`), token, database, schema,
   warehouse and role. Keep credentials server-side and out of Git/chat.
2. Run `npm run snowflake:prepare` once. This reads `.env.local` and `.env` using
   Next's environment loader and creates `UNLISTED_RESEARCH` if needed. It keeps
   existing records. The setup role needs CREATE TABLE on the schema; the runtime
   role needs SELECT, INSERT and UPDATE on the table plus the usual warehouse and
   database/schema usage permissions. The app does not create roles or grants.
3. Restart `npm run dev`. Research an apartment normally. The first request scrapes
   it and upserts the complete public profile. Later requests read that profile
   before calling SerpAPI or Muse again.

Data stays fresh for **24 hours**. After that, the next research request rebuilds
it. The existing Refresh pricing & research action forces a fresh scrape right
away. Failed research keeps the previous successful record. This is on-demand
refreshing; no daily background job is installed.

A small 60-second process cache coalesces simultaneous Snowflake reads. Public
Postgres research remains a fallback and fresh existing results are mirrored to
Snowflake on reuse. Snowflake errors do not break live research. Missing credentials
leave the existing app usable, but persistence in Snowflake starts only after
configuration and table setup succeed.

Only public research is shared. User labels, saved boards, accounts and conversations
stay in Postgres. Each user's labels are kept when their board loads newer public
research. Invalid or old demo overlays are ignored and must be researched again.
Older `UNLISTED_FLOORPLANS` seed rows are no longer queried; this change does not
delete database tables or user saves.

Recommendations query these researched profiles with bound price/bed/bath filters
and recheck fees, basis and amenities in code. Empty caches can research up to two
verified live candidates per turn under the existing SerpAPI budget. Coverage grows
as apartments are researched; the database is not prepopulated with every UT property.

To check persistence in Snowsight after researching an apartment:

```sql
SELECT PROPERTY_ID, FETCHED_AT,
       PROFILE:name::STRING AS NAME,
       ARRAY_SIZE(PROFILE:floorplans) AS FLOOR_PLANS,
       PROFILE:floorplans[0]:baseRent::FLOAT AS FIRST_PLAN_BASE_RENT
FROM UNLISTED_RESEARCH
ORDER BY FETCHED_AT DESC;
```

Live Snowflake writes and account permissions still need verification after local
credentials are configured. Tests mock the SQL API and cannot verify an account.
