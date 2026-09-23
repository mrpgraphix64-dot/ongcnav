-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EVENT_ADMIN', 'GATE_SUPERVISOR', 'GATE_MANAGER', 'GATE_OPERATOR', 'SCANNER_STAFF', 'HELP_DESK', 'REGISTRATION_STAFF', 'VOLUNTEER', 'REPORT_VIEWER');

-- CreateEnum
CREATE TYPE "GateType" AS ENUM ('REGULAR', 'VIP', 'OFFICIAL', 'SERVICE', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "GateStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AttendeeStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CheckinStatus" AS ENUM ('SUCCESS', 'VOIDED');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('SECURITY', 'CROWD', 'MEDICAL', 'VIP', 'SYSTEM', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LoadTestMode" AS ENUM ('DRY_RUN', 'REAL_HTTP');

-- CreateEnum
CREATE TYPE "LoadTestStatus" AS ENUM ('PREPARING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "LoadTestScenario" AS ENUM ('NORMAL', 'DUPLICATE', 'PEAK_BURST', 'INVALID_QR', 'MIXED');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "staff_id" VARCHAR(50),
    "password" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'GATE_OPERATOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gates" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "gate_number" VARCHAR(50) NOT NULL,
    "gate_type" "GateType" NOT NULL DEFAULT 'REGULAR',
    "status" "GateStatus" NOT NULL DEFAULT 'ACTIVE',
    "capacity_per_hour" INTEGER,
    "total_capacity" INTEGER,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "is_scanning_paused" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_users" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "gate_id" BIGINT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" BIGSERIAL NOT NULL,
    "cpf" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "designation" VARCHAR(255) NOT NULL,
    "department" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "photo_path" VARCHAR(500),
    "booking_days" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" BIGSERIAL NOT NULL,
    "employee_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "relation" VARCHAR(100) NOT NULL,
    "age" INTEGER,
    "gender" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendees" (
    "id" BIGSERIAL NOT NULL,
    "employee_id" BIGINT NOT NULL,
    "family_member_id" BIGINT,
    "ticket_number" VARCHAR(100) NOT NULL,
    "qr_code_token" VARCHAR(100) NOT NULL,
    "status" "AttendeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_checkins" (
    "id" BIGSERIAL NOT NULL,
    "attendee_id" BIGINT NOT NULL,
    "gate_id" BIGINT NOT NULL,
    "scanned_by_id" BIGINT,
    "event_date" VARCHAR(20) NOT NULL,
    "checkin_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CheckinStatus" NOT NULL DEFAULT 'SUCCESS',
    "is_load_test" BOOLEAN NOT NULL DEFAULT false,
    "load_test_run_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_logs" (
    "id" BIGSERIAL NOT NULL,
    "attendee_id" BIGINT,
    "gate_id" BIGINT,
    "scanned_by_id" BIGINT,
    "result" VARCHAR(50) NOT NULL,
    "response_time_ms" INTEGER NOT NULL DEFAULT 0,
    "is_load_test" BOOLEAN NOT NULL DEFAULT false,
    "load_test_run_id" BIGINT,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(255),
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" BIGSERIAL NOT NULL,
    "incident_number" VARCHAR(50) NOT NULL,
    "gate_id" BIGINT NOT NULL,
    "reported_by_id" BIGINT NOT NULL,
    "category" "IncidentCategory" NOT NULL DEFAULT 'SECURITY',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "action" VARCHAR(100) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" BIGSERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_test_runs" (
    "id" BIGSERIAL NOT NULL,
    "scenario" "LoadTestScenario" NOT NULL DEFAULT 'NORMAL',
    "mode" "LoadTestMode" NOT NULL DEFAULT 'REAL_HTTP',
    "status" "LoadTestStatus" NOT NULL DEFAULT 'PREPARING',
    "simulated_users" INTEGER NOT NULL DEFAULT 100,
    "ramp_up_seconds" INTEGER NOT NULL DEFAULT 5,
    "started_by_id" BIGINT,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "total_requests" BIGINT NOT NULL DEFAULT 0,
    "successful_requests" BIGINT NOT NULL DEFAULT 0,
    "duplicate_requests" BIGINT NOT NULL DEFAULT 0,
    "invalid_requests" BIGINT NOT NULL DEFAULT 0,
    "error_requests" BIGINT NOT NULL DEFAULT 0,
    "requests_per_second" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_response_time_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bytes_transferred" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "load_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_test_requests" (
    "id" BIGSERIAL NOT NULL,
    "run_id" BIGINT NOT NULL,
    "token" VARCHAR(100) NOT NULL,
    "gate_id" VARCHAR(50) NOT NULL,
    "result" VARCHAR(50) NOT NULL,
    "response_time_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "load_test_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_staff_id_key" ON "users"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "gates_gate_number_key" ON "gates"("gate_number");

-- CreateIndex
CREATE UNIQUE INDEX "gate_users_user_id_gate_id_key" ON "gate_users"("user_id", "gate_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_cpf_key" ON "employees"("cpf");

-- CreateIndex
CREATE INDEX "employees_cpf_idx" ON "employees"("cpf");

-- CreateIndex
CREATE INDEX "employees_phone_idx" ON "employees"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_family_member_id_key" ON "attendees"("family_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_ticket_number_key" ON "attendees"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_qr_code_token_key" ON "attendees"("qr_code_token");

-- CreateIndex
CREATE INDEX "attendees_ticket_number_idx" ON "attendees"("ticket_number");

-- CreateIndex
CREATE INDEX "attendees_qr_code_token_idx" ON "attendees"("qr_code_token");

-- CreateIndex
CREATE INDEX "daily_checkins_event_date_status_idx" ON "daily_checkins"("event_date", "status");

-- CreateIndex
CREATE INDEX "daily_checkins_gate_id_event_date_idx" ON "daily_checkins"("gate_id", "event_date");

-- CreateIndex
CREATE INDEX "daily_checkins_is_load_test_idx" ON "daily_checkins"("is_load_test");

-- CreateIndex
CREATE UNIQUE INDEX "daily_checkins_attendee_id_event_date_key" ON "daily_checkins"("attendee_id", "event_date");

-- CreateIndex
CREATE INDEX "scan_logs_scanned_at_idx" ON "scan_logs"("scanned_at");

-- CreateIndex
CREATE INDEX "scan_logs_result_idx" ON "scan_logs"("result");

-- CreateIndex
CREATE INDEX "scan_logs_is_load_test_idx" ON "scan_logs"("is_load_test");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_incident_number_key" ON "incidents"("incident_number");

-- CreateIndex
CREATE INDEX "incidents_category_idx" ON "incidents"("category");

-- CreateIndex
CREATE INDEX "incidents_severity_idx" ON "incidents"("severity");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "gate_users" ADD CONSTRAINT "gate_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_users" ADD CONSTRAINT "gate_users_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_family_member_id_fkey" FOREIGN KEY ("family_member_id") REFERENCES "family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_scanned_by_id_fkey" FOREIGN KEY ("scanned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_load_test_run_id_fkey" FOREIGN KEY ("load_test_run_id") REFERENCES "load_test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "attendees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_scanned_by_id_fkey" FOREIGN KEY ("scanned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_load_test_run_id_fkey" FOREIGN KEY ("load_test_run_id") REFERENCES "load_test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_test_requests" ADD CONSTRAINT "load_test_requests_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "load_test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

