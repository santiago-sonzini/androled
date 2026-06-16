-- AlterTable
ALTER TABLE "FigusAlbum" ADD COLUMN     "state" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "FigusCodigo" ADD COLUMN     "value" INTEGER NOT NULL DEFAULT 4;
