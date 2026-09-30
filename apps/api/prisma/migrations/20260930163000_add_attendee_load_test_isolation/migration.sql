-- AlterTable
ALTER TABLE "attendees" ADD COLUMN "is_load_test" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "attendees" ADD COLUMN "load_test_run_id" BIGINT;

-- AlterTable
ALTER TABLE "load_test_runs" ADD COLUMN "cleanup_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING';
ALTER TABLE "load_test_runs" ADD COLUMN "cleaned_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "attendees_is_load_test_idx" ON "attendees"("is_load_test");
CREATE INDEX "attendees_load_test_run_id_idx" ON "attendees"("load_test_run_id");

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_load_test_run_id_fkey" FOREIGN KEY ("load_test_run_id") REFERENCES "load_test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing synthetic load-test attendees so they are immediately isolated
UPDATE "attendees"
SET "is_load_test" = true
WHERE "qr_code_token" LIKE 'LOADTEST-%'
   OR "name" LIKE '[LOAD_TEST]%'
   OR "ticket_number" LIKE 'TK-LT-%';

UPDATE "attendees"
SET "load_test_run_id" = CAST(substring("qr_code_token" FROM 'LOADTEST-R([0-9]+)-') AS BIGINT)
WHERE "qr_code_token" LIKE 'LOADTEST-R%'
  AND "qr_code_token" ~ 'LOADTEST-R[0-9]+-';
