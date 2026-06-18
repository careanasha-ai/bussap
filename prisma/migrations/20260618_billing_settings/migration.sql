-- AlterTable: Add billing fields to Shop
ALTER TABLE "Shop" ADD COLUMN "billingStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Shop" ADD COLUMN "subscriptionId" TEXT;
ALTER TABLE "Shop" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);

-- CreateTable: ShopSettings
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "emailReportsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailReportFrequency" TEXT NOT NULL DEFAULT 'weekly',
    "emailReportDay" INTEGER NOT NULL DEFAULT 1,
    "emailReportRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultDateRange" TEXT NOT NULL DEFAULT 'last_30_days',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "aiInsightsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiAdvisorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EmailReport
CREATE TABLE "EmailReport" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipients" TEXT[],
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "data" JSONB,

    CONSTRAINT "EmailReport_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ShopSettings_shopId_key" ON "ShopSettings"("shopId");

-- CreateIndex
CREATE INDEX "EmailReport_shopId_sentAt_idx" ON "EmailReport"("shopId", "sentAt");

-- AddForeignKey
ALTER TABLE "ShopSettings" ADD CONSTRAINT "ShopSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailReport" ADD CONSTRAINT "EmailReport_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;