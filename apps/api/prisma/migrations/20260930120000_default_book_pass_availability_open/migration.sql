-- Ensure commercial.book_pass_availability defaults to 'OPEN'
INSERT INTO "settings" ("key", "value", "updated_at")
VALUES ('commercial.book_pass_availability', 'OPEN', NOW())
ON CONFLICT ("key") DO NOTHING;
