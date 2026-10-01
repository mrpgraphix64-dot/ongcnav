-- AlterEnum
ALTER TYPE "AttendeeStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DailyPassStatus" AS ENUM ('ACTIVE', 'REVOKED', 'USED');

-- CreateEnum
CREATE TYPE "DailyPassEmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "registration_status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "employees_registration_status_idx" ON "employees"("registration_status");

-- CreateTable
CREATE TABLE "daily_employee_passes" (
    "id" BIGSERIAL NOT NULL,
    "attendee_id" BIGINT NOT NULL,
    "event_date" VARCHAR(20) NOT NULL,
    "qr_token" VARCHAR(100) NOT NULL,
    "status" "DailyPassStatus" NOT NULL DEFAULT 'ACTIVE',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email_sent_at" TIMESTAMP(3),
    "email_status" "DailyPassEmailStatus" NOT NULL DEFAULT 'PENDING',
    "email_error" TEXT,
    "checked_in_at" TIMESTAMP(3),
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "test_session_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_employee_passes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_employee_passes_qr_token_key" ON "daily_employee_passes"("qr_token");

-- CreateIndex
CREATE UNIQUE INDEX "daily_employee_passes_attendee_id_event_date_is_test_key" ON "daily_employee_passes"("attendee_id", "event_date", "is_test");

-- CreateIndex
CREATE INDEX "daily_employee_passes_event_date_email_status_idx" ON "daily_employee_passes"("event_date", "email_status");

-- CreateIndex
CREATE INDEX "daily_employee_passes_qr_token_idx" ON "daily_employee_passes"("qr_token");

-- CreateIndex
CREATE INDEX "daily_employee_passes_is_test_idx" ON "daily_employee_passes"("is_test");

-- CreateIndex
CREATE INDEX "daily_employee_passes_test_session_id_idx" ON "daily_employee_passes"("test_session_id");

-- AddForeignKey
ALTER TABLE "daily_employee_passes" ADD CONSTRAINT "daily_employee_passes_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
