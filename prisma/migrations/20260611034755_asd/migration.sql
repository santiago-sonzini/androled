/*
  Warnings:

  - You are about to drop the column `eventId` on the `AndroLedGuest` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `FigusAlbum` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "AndroLedGuest" DROP CONSTRAINT "AndroLedGuest_eventId_fkey";

-- DropIndex
DROP INDEX "AndroLedGuest_eventId_idx";

-- AlterTable
ALTER TABLE "AndroLedGuest" DROP COLUMN "eventId";

-- AlterTable
ALTER TABLE "FigusAlbum" DROP COLUMN "eventId";
