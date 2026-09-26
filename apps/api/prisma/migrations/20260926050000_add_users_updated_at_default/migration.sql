-- AlterTable: ensure users.updated_at has a default CURRENT_TIMESTAMP
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
