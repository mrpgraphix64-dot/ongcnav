-- Ensure payment.razorpay_enabled defaults to '0' (OFF) for current deployment/testing environment
INSERT INTO "settings" ("key", "value", "updated_at")
VALUES ('payment.razorpay_enabled', '0', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = '0';
