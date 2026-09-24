-- AlterEnum: IncidentCategory
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'TICKET_ISSUE';
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'CAPACITY_LIMIT';
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'DUPLICATE_CLAIM';
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'LOST_FOUND';

-- AlterEnum: IncidentStatus
ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';

-- AlterTable: daily_checkins
ALTER TABLE "daily_checkins" ADD COLUMN IF NOT EXISTS "is_manual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "daily_checkins" ADD COLUMN IF NOT EXISTS "manual_reason" TEXT;
ALTER TABLE "daily_checkins" ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMP(3);
ALTER TABLE "daily_checkins" ADD COLUMN IF NOT EXISTS "voided_by_id" BIGINT;
ALTER TABLE "daily_checkins" ADD COLUMN IF NOT EXISTS "void_reason" TEXT;

-- Foreign key for voided_by_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_checkins_voided_by_id_fkey'
  ) THEN
    ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_voided_by_id_fkey"
      FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable: incidents
ALTER TABLE "incidents" ALTER COLUMN "gate_id" DROP NOT NULL;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "ticket_id" VARCHAR(50);
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "attendee_id" BIGINT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "resolved_by_id" BIGINT;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "incident_date" VARCHAR(20);
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "incident_time" VARCHAR(20);

-- Foreign key for incidents attendee_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incidents_attendee_id_fkey'
  ) THEN
    ALTER TABLE "incidents" ADD CONSTRAINT "incidents_attendee_id_fkey"
      FOREIGN KEY ("attendee_id") REFERENCES "attendees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Foreign key for incidents resolved_by_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incidents_resolved_by_id_fkey'
  ) THEN
    ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolved_by_id_fkey"
      FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Update gate_id foreign key on incidents to ON DELETE SET NULL
ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "incidents_gate_id_fkey";
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_gate_id_fkey"
  FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "incidents_ticket_id_idx" ON "incidents"("ticket_id");
CREATE INDEX IF NOT EXISTS "incidents_incident_date_idx" ON "incidents"("incident_date");
