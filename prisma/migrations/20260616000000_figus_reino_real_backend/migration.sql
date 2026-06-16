-- AlterTable
ALTER TABLE "FigusAlbum" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "tradeCode" TEXT;

-- CreateTable
CREATE TABLE "FigusEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FigusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigusGold" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "goldIdx" INTEGER NOT NULL,
    "winnerId" TEXT,
    "winnerName" TEXT,
    "wonAt" TIMESTAMP(3),

    CONSTRAINT "FigusGold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigusPrize" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "prizeKey" TEXT NOT NULL,
    "winnerId" TEXT,
    "winnerName" TEXT,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "FigusPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigusTradeRequest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "figId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FigusTradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FigusEvent_eventId_createdAt_idx" ON "FigusEvent"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FigusGold_eventId_goldIdx_key" ON "FigusGold"("eventId", "goldIdx");

-- CreateIndex
CREATE UNIQUE INDEX "FigusPrize_eventId_prizeKey_key" ON "FigusPrize"("eventId", "prizeKey");

-- CreateIndex
CREATE INDEX "FigusTradeRequest_eventId_status_idx" ON "FigusTradeRequest"("eventId", "status");

-- CreateIndex
CREATE INDEX "FigusTradeRequest_guestId_idx" ON "FigusTradeRequest"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "FigusAlbum_tradeCode_key" ON "FigusAlbum"("tradeCode");

