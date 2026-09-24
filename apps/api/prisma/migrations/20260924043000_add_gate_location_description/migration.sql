-- AlterTable: gates (add location and description)
ALTER TABLE "gates" ADD COLUMN IF NOT EXISTS "location" VARCHAR(255);
ALTER TABLE "gates" ADD COLUMN IF NOT EXISTS "description" VARCHAR(500);
