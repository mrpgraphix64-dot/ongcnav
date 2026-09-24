-- AlterTable
-- Nullable, additive column — existing family_members rows (created before
-- this field existed) simply get NULL. The API DTO enforces this as
-- required for every new registration; no NOT NULL constraint at the DB
-- level to avoid breaking any pre-existing rows.
ALTER TABLE "family_members" ADD COLUMN     "phone" VARCHAR(20);
