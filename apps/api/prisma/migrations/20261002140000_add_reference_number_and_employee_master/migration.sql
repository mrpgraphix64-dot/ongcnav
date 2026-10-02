-- AlterTable
ALTER TABLE "employees" ADD COLUMN "reference_number" VARCHAR(50);

-- AlterTable
ALTER TABLE "family_members" ADD COLUMN "email" VARCHAR(255);

-- CreateTable
CREATE TABLE "reference_sequences" (
    "name" VARCHAR(50) NOT NULL,
    "current_value" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_sequences_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "ongc_employee_masters" (
    "cpf" VARCHAR(10) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "dob" VARCHAR(50),
    "doj" VARCHAR(50),
    "mobile" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ongc_employee_masters_pkey" PRIMARY KEY ("cpf")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_reference_number_key" ON "employees"("reference_number");

-- CreateIndex
CREATE INDEX "employees_reference_number_idx" ON "employees"("reference_number");

-- CreateIndex
CREATE INDEX "ongc_employee_masters_mobile_idx" ON "ongc_employee_masters"("mobile");
