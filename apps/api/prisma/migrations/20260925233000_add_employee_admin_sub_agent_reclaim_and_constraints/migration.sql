-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EMPLOYEE_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COMMERCIAL_SUB_AGENT';

-- AlterTable commercial_orders: update default payment_mode to RAZORPAY and migrate existing ONLINE records
ALTER TABLE "commercial_orders" ALTER COLUMN "payment_mode" SET DEFAULT 'RAZORPAY';
UPDATE "commercial_orders" SET "payment_mode" = 'RAZORPAY' WHERE "payment_mode" = 'ONLINE';

-- Add check constraints to agent_allocations
ALTER TABLE "agent_allocations" DROP CONSTRAINT IF EXISTS "check_booked_quantity_non_negative";
ALTER TABLE "agent_allocations" ADD CONSTRAINT "check_booked_quantity_non_negative" CHECK ("booked_quantity" >= 0);

ALTER TABLE "agent_allocations" DROP CONSTRAINT IF EXISTS "check_sub_allocated_quantity_non_negative";
ALTER TABLE "agent_allocations" ADD CONSTRAINT "check_sub_allocated_quantity_non_negative" CHECK ("sub_allocated_quantity" >= 0);

ALTER TABLE "agent_allocations" DROP CONSTRAINT IF EXISTS "check_allocated_quantity_covers_booked_and_sub";
ALTER TABLE "agent_allocations" ADD CONSTRAINT "check_allocated_quantity_covers_booked_and_sub" CHECK ("booked_quantity" + "sub_allocated_quantity" <= "allocated_quantity");

-- CreateEnum AllocationEventType
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AllocationEventType') THEN
        CREATE TYPE "AllocationEventType" AS ENUM ('ALLOCATE', 'SUB_ALLOCATE', 'RECLAIM', 'CONSUMPTION');
    END IF;
END$$;

-- CreateTable allocation_events
CREATE TABLE IF NOT EXISTS "allocation_events" (
    "id" BIGSERIAL NOT NULL,
    "allocation_id" BIGINT NOT NULL,
    "event_type" "AllocationEventType" NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "performed_by_id" BIGINT,
    "order_id" BIGINT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "allocation_events_allocation_id_idx" ON "allocation_events"("allocation_id");
CREATE INDEX IF NOT EXISTS "allocation_events_event_type_idx" ON "allocation_events"("event_type");
CREATE INDEX IF NOT EXISTS "allocation_events_performed_by_id_idx" ON "allocation_events"("performed_by_id");

-- AddForeignKey
ALTER TABLE "allocation_events" DROP CONSTRAINT IF EXISTS "allocation_events_allocation_id_fkey";
ALTER TABLE "allocation_events" ADD CONSTRAINT "allocation_events_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "agent_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "allocation_events" DROP CONSTRAINT IF EXISTS "allocation_events_performed_by_id_fkey";
ALTER TABLE "allocation_events" ADD CONSTRAINT "allocation_events_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "allocation_events" DROP CONSTRAINT IF EXISTS "allocation_events_order_id_fkey";
ALTER TABLE "allocation_events" ADD CONSTRAINT "allocation_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commercial_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
