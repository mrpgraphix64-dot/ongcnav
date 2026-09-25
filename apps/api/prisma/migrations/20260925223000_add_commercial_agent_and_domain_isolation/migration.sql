-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COMMERCIAL_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COMMERCIAL_AGENT';

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parent_agent_id" BIGINT;
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_parent_agent_id_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_parent_agent_id_fkey" FOREIGN KEY ("parent_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable commercial_orders
ALTER TABLE "commercial_orders" ADD COLUMN IF NOT EXISTS "source" VARCHAR(20) NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "commercial_orders" ADD COLUMN IF NOT EXISTS "payment_mode" VARCHAR(20) NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "commercial_orders" ADD COLUMN IF NOT EXISTS "agent_id" BIGINT;
ALTER TABLE "commercial_orders" DROP CONSTRAINT IF EXISTS "commercial_orders_agent_id_fkey";
ALTER TABLE "commercial_orders" ADD CONSTRAINT "commercial_orders_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "commercial_orders_source_idx" ON "commercial_orders"("source");
CREATE INDEX IF NOT EXISTS "commercial_orders_agent_id_idx" ON "commercial_orders"("agent_id");

-- CreateTable agent_allocations
CREATE TABLE IF NOT EXISTS "agent_allocations" (
    "id" BIGSERIAL NOT NULL,
    "agent_id" BIGINT NOT NULL,
    "pass_type" VARCHAR(50) NOT NULL,
    "allocated_quantity" INTEGER NOT NULL DEFAULT 0,
    "booked_quantity" INTEGER NOT NULL DEFAULT 0,
    "sub_allocated_quantity" INTEGER NOT NULL DEFAULT 0,
    "allocated_by_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agent_allocations_agent_id_pass_type_key" ON "agent_allocations"("agent_id", "pass_type");
CREATE INDEX IF NOT EXISTS "agent_allocations_agent_id_idx" ON "agent_allocations"("agent_id");

-- AddForeignKey
ALTER TABLE "agent_allocations" DROP CONSTRAINT IF EXISTS "agent_allocations_agent_id_fkey";
ALTER TABLE "agent_allocations" ADD CONSTRAINT "agent_allocations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_allocations" DROP CONSTRAINT IF EXISTS "agent_allocations_allocated_by_id_fkey";
ALTER TABLE "agent_allocations" ADD CONSTRAINT "agent_allocations_allocated_by_id_fkey" FOREIGN KEY ("allocated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
