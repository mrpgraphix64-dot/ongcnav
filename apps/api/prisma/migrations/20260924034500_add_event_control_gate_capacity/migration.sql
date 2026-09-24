-- AlterTable: attendees (standalone attendee fields)
ALTER TABLE "attendees" ALTER COLUMN "employee_id" DROP NOT NULL;
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255);
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "mobile" VARCHAR(20);
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) DEFAULT 'General';
CREATE INDEX IF NOT EXISTS "attendees_mobile_idx" ON "attendees"("mobile");

-- AlterTable: gates (event control capacity controls)
ALTER TABLE "gates" ADD COLUMN IF NOT EXISTS "capacity_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "gates" ADD COLUMN IF NOT EXISTS "block_when_full" BOOLEAN NOT NULL DEFAULT false;
