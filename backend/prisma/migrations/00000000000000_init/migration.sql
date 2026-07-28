-- CreateTable
CREATE TABLE "RewardImage" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "totalSections" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "cols" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRewardProgress" (
    "id" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "rewardImageId" INTEGER NOT NULL,
    "unlockedSections" TEXT NOT NULL DEFAULT '[]',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerRewardProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseQrCode" (
    "id" SERIAL NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "customerId" TEXT,
    "rewardImageId" INTEGER,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rewardProgressId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseQrCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardImage_imageUrl_key" ON "RewardImage"("imageUrl");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRewardProgress_customerId_rewardImageId_key" ON "CustomerRewardProgress"("customerId", "rewardImageId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseQrCode_purchaseId_key" ON "PurchaseQrCode"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseQrCode_token_key" ON "PurchaseQrCode"("token");

-- AddForeignKey
ALTER TABLE "CustomerRewardProgress" ADD CONSTRAINT "CustomerRewardProgress_rewardImageId_fkey" FOREIGN KEY ("rewardImageId") REFERENCES "RewardImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseQrCode" ADD CONSTRAINT "PurchaseQrCode_rewardImageId_fkey" FOREIGN KEY ("rewardImageId") REFERENCES "RewardImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseQrCode" ADD CONSTRAINT "PurchaseQrCode_rewardProgressId_fkey" FOREIGN KEY ("rewardProgressId") REFERENCES "CustomerRewardProgress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

