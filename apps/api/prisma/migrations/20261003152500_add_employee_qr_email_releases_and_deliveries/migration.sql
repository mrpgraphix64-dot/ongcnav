-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'ACCEPTED', 'DELIVERED', 'FAILED', 'BOUNCED', 'REJECTED', 'DEFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailReleaseStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "employee_qr_email_releases" (
    "id" BIGSERIAL NOT NULL,
    "release_type" VARCHAR(50) NOT NULL DEFAULT 'PERMANENT_QR',
    "status" "EmailReleaseStatus" NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "queued_count" INTEGER NOT NULL DEFAULT 0,
    "sending_count" INTEGER NOT NULL DEFAULT 0,
    "accepted_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "bounced_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" VARCHAR(100),
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_qr_email_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_qr_email_deliveries" (
    "id" BIGSERIAL NOT NULL,
    "release_id" BIGINT,
    "attendee_id" BIGINT NOT NULL,
    "reference_number" VARCHAR(100) NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" VARCHAR(50) NOT NULL DEFAULT 'HOSTINGER',
    "provider_message_id" VARCHAR(255),
    "provider_event_id" VARCHAR(255),
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "error_type" VARCHAR(50),
    "last_error" TEXT,
    "last_provider_error" TEXT,
    "last_provider_response" TEXT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_qr_email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_qr_email_releases_status_idx" ON "employee_qr_email_releases"("status");
CREATE INDEX "employee_qr_email_releases_is_test_idx" ON "employee_qr_email_releases"("is_test");
CREATE INDEX "employee_qr_email_releases_created_at_idx" ON "employee_qr_email_releases"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "employee_qr_email_deliveries_provider_event_id_key" ON "employee_qr_email_deliveries"("provider_event_id");
CREATE INDEX "employee_qr_email_deliveries_attendee_id_idx" ON "employee_qr_email_deliveries"("attendee_id");
CREATE INDEX "employee_qr_email_deliveries_release_id_idx" ON "employee_qr_email_deliveries"("release_id");
CREATE INDEX "employee_qr_email_deliveries_status_idx" ON "employee_qr_email_deliveries"("status");
CREATE INDEX "employee_qr_email_deliveries_recipient_email_idx" ON "employee_qr_email_deliveries"("recipient_email");
CREATE INDEX "employee_qr_email_deliveries_provider_message_id_idx" ON "employee_qr_email_deliveries"("provider_message_id");
CREATE INDEX "employee_qr_email_deliveries_created_at_idx" ON "employee_qr_email_deliveries"("created_at");
CREATE INDEX "employee_qr_email_deliveries_is_test_idx" ON "employee_qr_email_deliveries"("is_test");

-- AddForeignKey
ALTER TABLE "employee_qr_email_releases" ADD CONSTRAINT "employee_qr_email_releases_created_by_fkey" FOREIGN KEY ("id") REFERENCES "employee_qr_email_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_qr_email_releases" DROP CONSTRAINT "employee_qr_email_releases_created_by_fkey";

ALTER TABLE "employee_qr_email_deliveries" ADD CONSTRAINT "employee_qr_email_deliveries_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "employee_qr_email_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_qr_email_deliveries" ADD CONSTRAINT "employee_qr_email_deliveries_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
