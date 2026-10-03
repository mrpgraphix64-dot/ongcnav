-- AlterTable
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "date_of_birth" TIMESTAMP(3);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "date_of_joining" TIMESTAMP(3);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "guidelines_accepted_at" TIMESTAMP(3);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "guidelines_version" VARCHAR(50);

-- AlterTable
ALTER TABLE "family_members" ADD COLUMN IF NOT EXISTS "date_of_birth" TIMESTAMP(3);
