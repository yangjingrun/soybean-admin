-- CreateTable
CREATE TABLE "AiUserSerperConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "apiBase" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "encryptedApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUserSerperConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUserHunterConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "apiBase" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "encryptedApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUserHunterConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiUserSerperConfig_userId_key" ON "AiUserSerperConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiUserHunterConfig_userId_key" ON "AiUserHunterConfig"("userId");

-- AddForeignKey
ALTER TABLE "AiUserSerperConfig" ADD CONSTRAINT "AiUserSerperConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "SystemUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUserHunterConfig" ADD CONSTRAINT "AiUserHunterConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "SystemUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
