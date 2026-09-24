-- CreateEnum
CREATE TYPE "EmployeeCategory" AS ENUM ('REGULAR', 'RETIRED', 'CONTRACT');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "employee_category" "EmployeeCategory" NOT NULL DEFAULT 'REGULAR';

-- AlterTable
ALTER TABLE "family_members" ADD COLUMN     "photo_path" VARCHAR(500);

-- AlterTable
ALTER TABLE "attendees" ADD COLUMN     "booking_days" JSONB;

-- DataMigration: backfill per-attendee booking_days from the employee's
-- existing (shared) booking_days, so pre-existing attendees keep exactly
-- their current effective behavior until a new registration submits real
-- per-person dates. Idempotent (scoped by IS NULL) and safe to re-run.
UPDATE "attendees" a
SET "booking_days" = e."booking_days"
FROM "employees" e
WHERE a."employee_id" = e."id"
  AND a."booking_days" IS NULL;
