-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- AlterTable attendees
ALTER TABLE "attendees" ADD COLUMN "order_id" BIGINT;

-- CreateTable commercial_orders
CREATE TABLE "commercial_orders" (
    "id" BIGSERIAL NOT NULL,
    "order_number" VARCHAR(100) NOT NULL,
    "registration_type" "RegistrationType" NOT NULL DEFAULT 'COMMERCIAL',
    "customer_name" VARCHAR(255) NOT NULL,
    "customer_mobile" VARCHAR(20) NOT NULL,
    "customer_email" VARCHAR(255) NOT NULL,
    "ticket_type" VARCHAR(50) NOT NULL DEFAULT 'COMMERCIAL_DAILY',
    "selected_dates" JSONB NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_paise" INTEGER NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "order_status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "razorpay_order_id" VARCHAR(100),
    "razorpay_payment_id" VARCHAR(100),
    "razorpay_signature" VARCHAR(255),
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable payment_webhook_events
CREATE TABLE "payment_webhook_events" (
    "id" BIGSERIAL NOT NULL,
    "event_id" VARCHAR(100) NOT NULL,
    "order_id" BIGINT,
    "event_type" VARCHAR(100) NOT NULL,
    "payment_id" VARCHAR(100),
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "payload_summary" JSONB,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commercial_orders_order_number_key" ON "commercial_orders"("order_number");
CREATE UNIQUE INDEX "commercial_orders_razorpay_order_id_key" ON "commercial_orders"("razorpay_order_id");
CREATE UNIQUE INDEX "commercial_orders_razorpay_payment_id_key" ON "commercial_orders"("razorpay_payment_id");
CREATE INDEX "commercial_orders_order_number_idx" ON "commercial_orders"("order_number");
CREATE INDEX "commercial_orders_razorpay_order_id_idx" ON "commercial_orders"("razorpay_order_id");
CREATE INDEX "commercial_orders_customer_mobile_idx" ON "commercial_orders"("customer_mobile");
CREATE INDEX "commercial_orders_order_status_idx" ON "commercial_orders"("order_status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_event_id_key" ON "payment_webhook_events"("event_id");
CREATE INDEX "payment_webhook_events_event_id_idx" ON "payment_webhook_events"("event_id");
CREATE INDEX "payment_webhook_events_payment_id_idx" ON "payment_webhook_events"("payment_id");

-- CreateIndex
CREATE INDEX "attendees_order_id_idx" ON "attendees"("order_id");

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commercial_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commercial_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
