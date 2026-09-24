-- AlterTable
-- Nullable, additive column. Reserved for future category-specific fields
-- (e.g. retirement date for RETIRED, contract end date for CONTRACT).
-- Not written to by any code path yet — no category currently has fields
-- that differ from the others. No backfill needed; existing rows simply
-- get NULL here, which the application already treats as "no
-- category-specific data yet."
ALTER TABLE "employees" ADD COLUMN     "category_data" JSONB;
