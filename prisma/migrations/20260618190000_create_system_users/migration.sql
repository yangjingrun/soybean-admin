CREATE TABLE "SystemUser" (
  "id" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  "nickName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "roles" TEXT[],
  "status" TEXT NOT NULL DEFAULT 'enabled',
  "companyName" TEXT,
  "expireAt" TIMESTAMP(3),
  "remark" TEXT,
  "passwordHash" TEXT NOT NULL,
  "passwordSalt" TEXT NOT NULL,
  "lastLoginAt" TIMESTAMP(3),
  "lastLoginIp" TEXT,
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "passwordResetAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SystemUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemUser_userName_key" ON "SystemUser"("userName");
CREATE INDEX "SystemUser_status_idx" ON "SystemUser"("status");
CREATE INDEX "SystemUser_expireAt_idx" ON "SystemUser"("expireAt");
CREATE INDEX "SystemUser_lockedUntil_idx" ON "SystemUser"("lockedUntil");

INSERT INTO "SystemUser" (
  "id",
  "userName",
  "nickName",
  "roles",
  "status",
  "passwordHash",
  "passwordSalt",
  "createdAt",
  "updatedAt"
) VALUES
  (
    '1',
    'Super',
    'Super',
    ARRAY['R_SUPER'],
    'enabled',
    'e9b1afc33441fe8e33688b8e43a0d8d21d25486a65bb54eb0e6a91dda8096ae0377233a1525915f6aca6442434282bd25736609082fc9d23c2ab6d3c82615137',
    'a544eef915b2b570302870fd84018cb0',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    '2',
    'Admin',
    'Admin',
    ARRAY['R_ADMIN'],
    'enabled',
    'b7afbf2b21efac92feb46f02d5339c1b33b3b1ecb513687eb0d0993ea337dff07c846c5dc8a3b8135a93ded55858fff2dfc8eeef49567c6eb81c0be050a129d3',
    'e6469bb84ba7c6f47656c3c41ee59d20',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    '3',
    'User',
    'User',
    ARRAY['R_USER'],
    'enabled',
    '814c4dcd0663b3c860175826e4483ea3114a9f5776a5f0e265807bbf698ae50f121ccea32cfeb737c328eb80b85a081e1cda2f2c48138654388ca539315afd75',
    'a78fb317fcbacab2fd2143a77312661a',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    '4',
    'Soybean',
    'Soybean',
    ARRAY['R_SUPER'],
    'enabled',
    '7a42d0bba6acfa9f7c286bdfe2a1e9ddcfb73e202d629a1069ec11548ad48a1d9b0610f934c2ef69880b73767b7511e194216edcb35edb00c73d35a039c24980',
    '50b0ca3d7552f1a72f11c46b0300a47e',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
