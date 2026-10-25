CREATE TABLE "ApartmentResearch" (
  "placeId" TEXT NOT NULL,
  "profile" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApartmentResearch_pkey" PRIMARY KEY ("placeId")
);
