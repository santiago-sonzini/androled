-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adminId" TEXT,
    "code" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "hasDietRestriction" BOOLEAN NOT NULL DEFAULT false,
    "dietRestrictionComment" TEXT,
    "rsvp" BOOLEAN NOT NULL DEFAULT true,
    "isMainGuest" BOOLEAN NOT NULL DEFAULT false,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plusOne" BOOLEAN NOT NULL DEFAULT false,
    "goesWith" TEXT,
    "mesa" INTEGER,
    "nroPulsera" INTEGER,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,
    "from" TEXT NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AndroLedGuest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "hasDietRestriction" BOOLEAN NOT NULL DEFAULT false,
    "dietRestrictionComment" TEXT,
    "rsvp" BOOLEAN NOT NULL DEFAULT true,
    "isMainGuest" BOOLEAN NOT NULL DEFAULT false,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plusOne" BOOLEAN NOT NULL DEFAULT false,
    "goesWith" TEXT,
    "mesa" INTEGER,
    "nroPulsera" INTEGER,
    "pulseraEntregada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AndroLedGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigusAlbum" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "counts" JSONB NOT NULL DEFAULT '{}',
    "packsLeft" TEXT[] DEFAULT ARRAY['start']::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FigusAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigusTrivia" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "answer" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "activeAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FigusTrivia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigusCodigo" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "activeAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "usedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FigusCodigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FigusCardStock" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "maxCount" INTEGER NOT NULL DEFAULT 10,
    "issued" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FigusCardStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_code_key" ON "Event"("code");

-- CreateIndex
CREATE INDEX "Guest_eventId_idx" ON "Guest"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "AndroLedGuest_eventId_idx" ON "AndroLedGuest"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "FigusAlbum_guestId_key" ON "FigusAlbum"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "FigusCardStock_eventId_cardId_key" ON "FigusCardStock"("eventId", "cardId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AndroLedGuest" ADD CONSTRAINT "AndroLedGuest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FigusAlbum" ADD CONSTRAINT "FigusAlbum_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "AndroLedGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
