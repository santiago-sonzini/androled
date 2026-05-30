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

-- CreateIndex
CREATE INDEX "AndroLedGuest_eventId_idx" ON "AndroLedGuest"("eventId");

-- AddForeignKey
ALTER TABLE "AndroLedGuest" ADD CONSTRAINT "AndroLedGuest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
