CREATE TABLE "CrmGeoCityName" (
  "id" TEXT NOT NULL,
  "geonameId" INTEGER NOT NULL,
  "countryCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "asciiName" TEXT,
  "timeZone" TEXT NOT NULL,
  "population" INTEGER NOT NULL DEFAULT 0,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "nameSource" TEXT NOT NULL,
  "languageCode" TEXT,
  "isPreferred" BOOLEAN NOT NULL DEFAULT false,
  "isShort" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmGeoCityName_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmGeoCityName_countryCode_normalizedName_geonameId_key"
  ON "CrmGeoCityName"("countryCode", "normalizedName", "geonameId");

CREATE INDEX "CrmGeoCityName_countryCode_normalizedName_population_idx"
  ON "CrmGeoCityName"("countryCode", "normalizedName", "population");

CREATE INDEX "CrmGeoCityName_geonameId_idx"
  ON "CrmGeoCityName"("geonameId");
