-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('EMPLOYEE', 'COMMERCIAL', 'FREE');

-- AlterTable
-- Add registration_type column to attendees with default EMPLOYEE.
-- All existing attendee rows were created for ONGC employees and family members,
-- so defaulting to 'EMPLOYEE' cleanly and correctly backfills existing data without NULLs.
ALTER TABLE "attendees" ADD COLUMN "registration_type" "RegistrationType" NOT NULL DEFAULT 'EMPLOYEE';

-- CreateIndex
CREATE INDEX "attendees_registration_type_idx" ON "attendees"("registration_type");
